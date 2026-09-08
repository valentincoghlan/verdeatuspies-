-- ---------------------------------------------------------------------
-- 0028 · Qué clase de plata mueve cada categoría
--
-- Hasta hoy todo egreso pesaba igual en el resultado. Plantar los dos
-- lotes ($21,8 M), hacer la instalación de riego ($18,1 M) y comprar el
-- Tigre ($6,7 M) entraban como si fueran gasto de la temporada: 2025
-- daba -73% cuando en realidad había sido el año en que se montó el
-- campo. Un dividendo repartido también restaba, cuando es justamente el
-- reparto de la ganancia.
--
-- Ahora cada rubro dice qué clase de plata mueve:
--
--   operativo   El costo de producir y vender esta temporada. Es el
--               único que entra en el resultado y en el costo por m².
--   inversion   Lo que montó el campo. Se hizo una vez y se paga con
--               las temporadas que vienen.
--   cobranza    Plata que entra por una venta que YA está contada en
--               Facturado. Sumarla sería contar dos veces.
--   financiero  Plata que cambia de lugar sin ser ganancia ni costo:
--               dividendos, compra y venta de dólares, aportes de los
--               socios, préstamos y ajustes de saldo.
--
-- Lo lleva el rubro; las subcategorías heredan el del padre.
-- ---------------------------------------------------------------------

alter table categorias
  add column if not exists tipo_plata text not null default 'operativo';

alter table categorias drop constraint if exists categorias_tipo_plata_check;
alter table categorias add constraint categorias_tipo_plata_check
  check (tipo_plata in ('operativo', 'inversion', 'cobranza', 'financiero'));

comment on column categorias.tipo_plata is
  'Qué clase de plata mueve el rubro. Solo "operativo" entra en el resultado.';

-- Lo que montó el campo.
update categorias set tipo_plata = 'inversion'
 where padre_id is null
   and nombre in ('Plantación', 'Riego', 'Maquinas y Herramientas', 'Preparación terreno');

-- Cobranza de ventas ya facturadas.
update categorias set tipo_plata = 'cobranza'
 where padre_id is null and nombre = 'Ventas';

-- Plata que cambia de lugar.
update categorias set tipo_plata = 'financiero'
 where padre_id is null
   and nombre in ('Cobros', 'Compra USD', 'Venta USD', 'Aportes', 'Préstamos', 'Ajustes');

-- Las subcategorías siguen a su rubro, para que la vista pueda leer
-- cualquiera de las dos sin preguntar por el padre.
update categorias h
   set tipo_plata = p.tipo_plata
  from categorias p
 where h.padre_id = p.id;

-- ---------------------------------------------------------------------
-- La vista de movimientos expone el tipo de plata del rubro
--
-- La columna nueva va AL FINAL y no en su lugar "lógico": Postgres deja
-- agregar columnas a una vista existente, pero no meter una en el medio
-- ni renombrar las que ya están. Con `create or replace` al final, la
-- vista se actualiza sin tener que bajarla y sin romper lo que dependa
-- de ella.
-- ---------------------------------------------------------------------
create or replace view v_movimientos as
select
  m.id, m.fecha, m.tipo, m.monto, m.moneda, m.cotizacion, m.monto_usd,
  m.detalle, m.origen, m.notas, m.created_at,
  m.cuenta_id, cu.nombre as cuenta,
  m.categoria_id,
  coalesce(pad.nombre, cat.nombre) as categoria,
  case when pad.nombre is null then null else cat.nombre end as subcategoria,
  m.persona_id, p.nombre as persona, p.tipo as persona_tipo,
  m.lote_id, l.nombre as lote,
  m.venta_id, m.cliente_id, cl.nombre as cliente,
  m.metros,
  coalesce(pad.tipo_plata, cat.tipo_plata, 'operativo') as tipo_plata
from movimientos m
left join cuentas cu on cu.id = m.cuenta_id
left join categorias cat on cat.id = m.categoria_id
left join categorias pad on pad.id = cat.padre_id
left join personas p on p.id = m.persona_id
left join lotes l on l.id = m.lote_id
left join clientes cl on cl.id = m.cliente_id;

-- ---------------------------------------------------------------------
-- Limpieza de los cruces que encontramos al revisar el catálogo
-- ---------------------------------------------------------------------

-- "Nafta", "Combustible" y "Gasoil" de Mantenimiento son lo mismo. Los
-- movimientos pasan a Nafta y las otras dos se apagan.
with mant as (select id from categorias where padre_id is null and nombre = 'Mantenimiento'),
     nafta as (
       select c.id from categorias c, mant
        where c.padre_id = mant.id and c.nombre = 'Nafta'
     )
update movimientos m
   set categoria_id = (select id from nafta)
 where m.categoria_id in (
   select c.id from categorias c, mant
    where c.padre_id = mant.id and c.nombre in ('Combustible', 'Gasoil')
 );

update categorias set activa = false
 where padre_id = (select id from categorias where padre_id is null and nombre = 'Mantenimiento')
   and nombre in ('Combustible', 'Gasoil');

-- "Ventas / Dividendos" nunca se usó: los dividendos viven en Cobros.
delete from categorias
 where padre_id = (select id from categorias where padre_id is null and nombre = 'Ventas')
   and nombre = 'Dividendos'
   and not exists (select 1 from movimientos m where m.categoria_id = categorias.id);
