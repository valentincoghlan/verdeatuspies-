-- =====================================================================
-- 0012 — Aportes de los socios, y correcciones de datos
--
-- MC y VC no son cuentas de plata disponible: son lo que pusieron
-- Valentín y Miguel, que se va bajando a medida que cobran dividendos.
-- Se miden SIEMPRE en dólares.
--
-- Las cuentas de verdad son: Efectivo, Banco del Sol, Galicia MC,
-- Galicia PC, Galicia CM, MercadoPago y USD.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nombres reales de las cuentas
-- ---------------------------------------------------------------------
update cuentas set nombre = 'Galicia PC' where nombre = 'Banco PC';
update cuentas set nombre = 'Galicia CM' where nombre = 'Banco CM';
update cuentas set nombre = 'MercadoPago' where nombre = 'M.Pago';

-- ---------------------------------------------------------------------
-- 2. Cada cuenta de socio sabe de quién es
-- ---------------------------------------------------------------------
alter table cuentas add column if not exists persona_id uuid references personas(id) on delete set null;

update cuentas set persona_id = (select id from personas where nombre = 'Coghlan, Miguel')
where nombre = 'MC';
update cuentas set persona_id = (select id from personas where nombre = 'Coghlan, Valentin')
where nombre = 'VC';

-- ---------------------------------------------------------------------
-- 3. Correcciones de datos importados
-- ---------------------------------------------------------------------

-- "VC entregó a MC": para VC es plata que pone, para MC es plata que
-- recibe. Estaban los dos como egreso, así que MC figuraba aportando
-- 3.000 en vez de recibirlos: 6.000 de diferencia contra la planilla.
update movimientos m
set tipo = 'I'
from cuentas c, categorias cat
where m.cuenta_id = c.id
  and m.categoria_id = cat.id
  and c.nombre = 'MC'
  and cat.nombre = 'VC entrego a MC';

-- Una venta a Block, Federico había quedado como "Dividendos".
update movimientos m
set categoria_id = (
  select h.id from categorias h
  join categorias p on p.id = h.padre_id
  where p.nombre = 'Ventas' and h.nombre = 'Particulares'
)
where m.categoria_id = (
  select h.id from categorias h
  join categorias p on p.id = h.padre_id
  where p.nombre = 'Ventas' and h.nombre = 'Dividendos'
);

-- ---------------------------------------------------------------------
-- 4. Cuadro de aportes y devoluciones, en dólares
--
--   aportado  -> todo lo que se pagó desde la cuenta de ese socio
--   devuelto  -> los dividendos que cobró
--   pendiente -> lo que todavía no recuperó
-- ---------------------------------------------------------------------
create or replace view v_aportes as
with puesto as (
  select
    c.persona_id,
    sum(case when m.tipo = 'E' then coalesce(m.monto_usd, 0) else -coalesce(m.monto_usd, 0) end) as aportado,
    count(*) as movimientos,
    count(*) filter (where m.monto_usd is null) as sin_cotizacion
  from movimientos m
  join cuentas c on c.id = m.cuenta_id
  where c.tipo = 'socio' and c.persona_id is not null
  group by c.persona_id
),
cobrado as (
  select m.persona_id, sum(coalesce(m.monto_usd, 0)) as devuelto
  from movimientos m
  join categorias h on h.id = m.categoria_id
  join categorias p on p.id = h.padre_id
  where m.tipo = 'E' and h.nombre = 'Dividendos' and p.nombre = 'Cobros'
    and m.persona_id is not null
  group by m.persona_id
)
select
  pe.id as persona_id,
  pe.nombre as socio,
  coalesce(pu.aportado, 0) as aportado_usd,
  coalesce(co.devuelto, 0) as devuelto_usd,
  coalesce(pu.aportado, 0) - coalesce(co.devuelto, 0) as pendiente_usd,
  coalesce(pu.movimientos, 0) as movimientos,
  coalesce(pu.sin_cotizacion, 0) as sin_cotizacion
from personas pe
left join puesto pu on pu.persona_id = pe.id
left join cobrado co on co.persona_id = pe.id
where pe.tipo = 'socio'
order by coalesce(pu.aportado, 0) desc;
