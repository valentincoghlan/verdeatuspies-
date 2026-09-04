-- =====================================================================
-- 0003 — Pedidos de pasto
--
-- Un pedido es una venta en estado 'pedido': ya está confirmado con el
-- comprador y el precio cerrado, pero todavía no se entregó y la entrega
-- depende del clima. Recién cuando se entrega nace la deuda.
--
-- Ciclo: pedido -> entregada        (se entregó, genera saldo)
--        pedido -> pedido           (reprogramado, fecha nueva)
--        pedido -> anulada          (se cayó)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estado nuevo en ventas
-- ---------------------------------------------------------------------
alter table ventas drop constraint if exists ventas_estado_check;
alter table ventas add constraint ventas_estado_check
  check (estado in ('presupuesto', 'pedido', 'confirmada', 'entregada', 'anulada'));

-- ---------------------------------------------------------------------
-- 2. Los tres roles de la cadena comercial
--
--    comprador      -> cliente_id     (el que paga, cuenta corriente)
--    vinculante     -> vinculante_id  (el que trae la venta, sin comisión)
--    cliente final  -> cliente_final  (quien recibe el pasto; puede ser
--                                      un consumidor final que no está
--                                      en la lista de clientes)
-- ---------------------------------------------------------------------
alter table ventas add column if not exists vinculante_id uuid
  references clientes(id) on delete set null;
alter table ventas add column if not exists cliente_final text;

-- ---------------------------------------------------------------------
-- 3. m² pedidos vs. m² entregados
--
--    m2_pedido    -> lo que se pactó al tomar el pedido (no cambia)
--    m2           -> los m² que se facturan (se ajusta al entregar)
--    m2_cortesia  -> los m² de regalo, salen del lote pero no se cobran
--    m2_entregados-> total que salió del campo = m2 + m2_cortesia
--
--    El total facturado sigue saliendo de m2 (los de cortesía no se cobran).
-- ---------------------------------------------------------------------
alter table ventas add column if not exists m2_pedido numeric(12,2);
alter table ventas add column if not exists m2_cortesia numeric(12,2) not null default 0;
alter table ventas add column if not exists m2_entregados numeric(12,2)
  generated always as (m2 + m2_cortesia) stored;

-- Las ventas que ya existían: lo pedido fue lo entregado.
update ventas set m2_pedido = m2 where m2_pedido is null;

create index if not exists ventas_entrega_idx on ventas (estado, fecha_entrega);
create index if not exists ventas_vinculante_idx on ventas (vinculante_id);

-- ---------------------------------------------------------------------
-- 4. Gastos imputados a una venta puntual (flete, mano de obra, etc.)
-- ---------------------------------------------------------------------
alter table pagos add column if not exists venta_id uuid
  references ventas(id) on delete set null;
create index if not exists pagos_venta_idx on pagos (venta_id);

-- ---------------------------------------------------------------------
-- 5. Los pedidos y presupuestos NO generan saldo
--
--    Antes sumaba todo lo que no estuviera anulado, con lo cual un pedido
--    que todavía no se entregó aparecía como deuda del comprador.
-- ---------------------------------------------------------------------
create or replace view v_cuenta_clientes as
select
  c.id as cliente_id,
  c.nombre,
  coalesce(v.total_vendido, 0) as total_vendido,
  coalesce(v.m2_vendidos, 0) as m2_vendidos,
  coalesce(co.total_cobrado, 0) as total_cobrado,
  coalesce(v.total_vendido, 0) - coalesce(co.total_cobrado, 0) as saldo,
  v.ultima_venta
from clientes c
left join (
  select cliente_id, sum(total) as total_vendido, sum(m2) as m2_vendidos, max(fecha) as ultima_venta
  from ventas where estado in ('confirmada', 'entregada') group by cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total_cobrado from cobros group by cliente_id
) co on co.cliente_id = c.id;

-- Mismo criterio para los m² del mes: un pedido todavía no es una venta.
create or replace view v_ventas_por_mes as
select
  date_trunc('month', fecha)::date as mes,
  sum(m2) as m2,
  sum(total) as total,
  count(*) as operaciones
from ventas
where estado in ('confirmada', 'entregada')
group by 1
order by 1;

-- ---------------------------------------------------------------------
-- 6. Pedidos pendientes con el pronóstico del día de entrega
-- ---------------------------------------------------------------------
create or replace view v_pedidos_pendientes as
select
  v.id,
  v.fecha,
  v.fecha_entrega,
  v.m2,
  v.m2_pedido,
  v.precio_m2,
  v.flete,
  v.total,
  v.notas,
  v.cliente_id,
  comp.nombre as comprador,
  v.vinculante_id,
  vinc.nombre as vinculante,
  v.cliente_final,
  v.lote_id,
  l.nombre as lote,
  cd.precipitacion_mm,
  cd.prob_precipitacion,
  cd.temp_max,
  cd.temp_min,
  coalesce(se.senado, 0) as senado
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join clima_dias cd on cd.fecha = v.fecha_entrega
left join (
  select venta_id, sum(monto) as senado from cobros where venta_id is not null group by venta_id
) se on se.venta_id = v.id
where v.estado = 'pedido';

-- ---------------------------------------------------------------------
-- 7. Margen por operación: lo facturado menos los gastos imputados
-- ---------------------------------------------------------------------
create or replace view v_margen_ventas as
select
  v.id as venta_id,
  v.fecha,
  v.fecha_entrega,
  v.estado,
  v.cliente_id,
  comp.nombre as comprador,
  vinc.nombre as vinculante,
  v.cliente_final,
  l.nombre as lote,
  v.m2,
  v.m2_cortesia,
  v.m2_entregados,
  v.precio_m2,
  v.flete,
  v.total as facturado,
  coalesce(g.gastos, 0) as gastos,
  v.total - coalesce(g.gastos, 0) as margen,
  coalesce(co.cobrado, 0) as cobrado,
  v.total - coalesce(co.cobrado, 0) as pendiente
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join (
  select venta_id, sum(monto) as gastos from pagos where venta_id is not null group by venta_id
) g on g.venta_id = v.id
left join (
  select venta_id, sum(monto) as cobrado from cobros where venta_id is not null group by venta_id
) co on co.venta_id = v.id
where v.estado in ('confirmada', 'entregada');
