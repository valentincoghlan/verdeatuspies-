-- ---------------------------------------------------------------------
-- 0039 · El costo operativo se parte en dos: cosechar y mantener
--
-- Hasta acá toda la plata que salía para producir caía en una sola bolsa,
-- `operativo`. Eso escondía lo único que importa para decidir: cuánto te
-- cuesta CORTAR un metro —que sube y baja con lo que vendés— y cuánto te
-- cuesta MANTENER el campo vivo, que lo pagás igual aunque no vendas nada.
--
-- Los cinco valores de `tipo_plata` quedan así:
--
--   cosecha        lo que sale cada vez que cortás y entregás
--   mantenimiento  lo que cuesta tener el campo vivo, vendas o no
--   inversion      lo que se hace una vez y queda (se mira en el macro)
--   cobranza       la plata de una venta entrando
--   financiero     ajustes, dólares, aportes, préstamos, dividendos
--
-- El resultado fino de cada período pasa a ser:
--   facturado − cosecha − mantenimiento
-- La inversión queda afuera a propósito: no es costo del período.
--
-- Además se acomodan tres subcategorías que estaban en el rubro
-- equivocado. Los movimientos se mudan y la subcategoría vieja se apaga
-- en vez de borrarse, para no perder el rastro de lo ya cargado.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. El check acepta los dos valores nuevos
--
-- Va antes de los updates: si no, el primer update rebota contra el check
-- viejo.
-- ---------------------------------------------------------------------
alter table categorias drop constraint if exists categorias_tipo_plata_check;
alter table categorias add constraint categorias_tipo_plata_check
  check (tipo_plata in ('cosecha', 'mantenimiento', 'operativo', 'inversion', 'cobranza', 'financiero'));

-- ---------------------------------------------------------------------
-- 2. Cada rubro madre a su bolsa nueva
--
-- Insumos va a mantenimiento: fertilizar y curar es lo que hace que el
-- pasto siga creciendo, no una obra que quede. Impuestos también, que es
-- costo de tener el negocio andando.
-- ---------------------------------------------------------------------
update categorias set tipo_plata = 'cosecha'
 where padre_id is null and nombre = 'Cosecha';

update categorias set tipo_plata = 'mantenimiento'
 where padre_id is null and nombre in ('Mantenimiento', 'Insumos', 'Impuestos');

-- Las hijas heredan de su madre, que es como ya funcionaba la vista.
update categorias h
   set tipo_plata = m.tipo_plata
  from categorias m
 where h.padre_id = m.id
   and m.tipo_plata in ('cosecha', 'mantenimiento');

-- ---------------------------------------------------------------------
-- 3. Las tres subcategorías que estaban en el rubro equivocado
--
-- Instalar el riego es inversión; la luz de la bomba y arreglar lo que ya
-- está son gastos de todos los meses. Estaban colgadas de "Riego", que es
-- inversión, y por eso inflaban la inversión y vaciaban el mantenimiento.
-- ---------------------------------------------------------------------
do $$
declare
  mant_id    uuid;
  riego_id   uuid;
  destino_id uuid;
  origen_id  uuid;
begin
  select id into mant_id  from categorias where padre_id is null and nombre = 'Mantenimiento';
  select id into riego_id from categorias where padre_id is null and nombre = 'Riego';

  -- 3.a  Riego → Electricidad  ==>  Mantenimiento → Electricidad
  select id into destino_id from categorias where padre_id = mant_id and nombre = 'Electricidad';
  select id into origen_id  from categorias where padre_id = riego_id and nombre = 'Electricidad';
  if destino_id is not null and origen_id is not null then
    update movimientos set categoria_id = destino_id where categoria_id = origen_id;
    update categorias set activa = false where id = origen_id;
  end if;

  -- 3.b  Riego → Reparaciones  ==>  Mantenimiento → Reparaciones
  select id into destino_id from categorias where padre_id = mant_id and nombre = 'Reparaciones';
  select id into origen_id  from categorias where padre_id = riego_id and nombre = 'Reparaciones';
  if destino_id is not null and origen_id is not null then
    update movimientos set categoria_id = destino_id where categoria_id = origen_id;
    update categorias set activa = false where id = origen_id;
  end if;

  -- 3.c  Mantenimiento → Riego  ==>  Mantenimiento → Reparaciones
  --
  -- Era reparación de riego o reposición de aspersores: las dos cosas son
  -- mantenimiento y ya tienen su lugar. Se apaga porque tener un "Riego"
  -- adentro de Mantenimiento, con un rubro madre "Riego" que es inversión,
  -- es una trampa para volver a cargar mal.
  select id into origen_id from categorias where padre_id = mant_id and nombre = 'Riego';
  if destino_id is not null and origen_id is not null then
    update movimientos set categoria_id = destino_id where categoria_id = origen_id;
    update categorias set activa = false where id = origen_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Ya no queda nada en `operativo`: se saca del check
--
-- Lo que no encaje en ninguna bolsa cae en mantenimiento, que es el costo
-- de fondo: es la suposición menos peligrosa, porque lo deja adentro del
-- resultado en vez de esconderlo.
-- ---------------------------------------------------------------------
update categorias set tipo_plata = 'mantenimiento' where tipo_plata = 'operativo';

alter table categorias drop constraint if exists categorias_tipo_plata_check;
alter table categorias add constraint categorias_tipo_plata_check
  check (tipo_plata in ('cosecha', 'mantenimiento', 'inversion', 'cobranza', 'financiero'));

alter table categorias alter column tipo_plata set default 'mantenimiento';

comment on column categorias.tipo_plata is
  'Qué clase de plata mueve el rubro: cosecha y mantenimiento son los dos '
  'costos del período (facturado − cosecha − mantenimiento = resultado); '
  'inversion se mira en el macro; cobranza y financiero no son costo.';

-- ---------------------------------------------------------------------
-- 5. La vista, con el nuevo respaldo
--
-- El `coalesce` terminaba en 'operativo', que ya no existe. Pasa a
-- 'mantenimiento' por el mismo motivo del punto 4. La lista de columnas
-- queda intacta: lo único que cambia es ese respaldo.
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
  coalesce(pad.tipo_plata, cat.tipo_plata, 'mantenimiento') as tipo_plata
from movimientos m
left join cuentas cu on cu.id = m.cuenta_id
left join categorias cat on cat.id = m.categoria_id
left join categorias pad on pad.id = cat.padre_id
left join personas p on p.id = m.persona_id
left join lotes l on l.id = m.lote_id
left join clientes cl on cl.id = m.cliente_id;
