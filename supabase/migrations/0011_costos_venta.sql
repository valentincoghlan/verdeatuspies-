-- =====================================================================
-- 0011 — Costo de cosecha y de envío en cada venta
--
-- La planilla guarda, por venta, cuánto costó cosechar ese pasto y
-- cuánto costó llevarlo. No son movimientos de caja: son la parte del
-- gasto que le corresponde a esa operación, para saber qué dejó cada
-- una. El gasto real ya está en Caja, cargado el día que se pagó.
--
--   flete        -> lo que le COBRÁS al comprador por el envío
--   costo_envio  -> lo que te SALE a vos ese envío
--   costo_cosecha-> la mano de obra de cosechar esos m²
-- =====================================================================

alter table ventas add column if not exists costo_cosecha numeric(14,2) not null default 0;
alter table ventas add column if not exists costo_envio numeric(14,2) not null default 0;

-- ---------------------------------------------------------------------
-- El margen ahora descuenta también esos dos costos
-- ---------------------------------------------------------------------
drop view if exists v_margen_ventas;

create view v_margen_ventas as
select
  v.id as venta_id, v.fecha, v.fecha_entrega, v.estado, v.canal, v.cliente_id,
  comp.nombre as comprador, vinc.nombre as vinculante, v.cliente_final, l.nombre as lote,
  v.m2, v.m2_cortesia, v.m2_entregados, v.precio_m2, v.flete,
  v.costo_cosecha, v.costo_envio,
  v.total as facturado,
  coalesce(g.gastos, 0) as gastos_imputados,
  v.costo_cosecha + v.costo_envio + coalesce(g.gastos, 0) as gastos,
  v.total - v.costo_cosecha - v.costo_envio - coalesce(g.gastos, 0) as margen,
  coalesce(co.cobrado, 0) as cobrado,
  v.total - coalesce(co.cobrado, 0) as pendiente
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join (
  select venta_id, sum(monto) as gastos
  from movimientos where tipo = 'E' and venta_id is not null group by venta_id
) g on g.venta_id = v.id
left join (
  select venta_id, sum(monto) as cobrado
  from movimientos where tipo = 'I' and venta_id is not null group by venta_id
) co on co.venta_id = v.id
where v.estado in ('confirmada', 'entregada');

-- ---------------------------------------------------------------------
-- El resumen por mes suma los costos, para ver el margen del mes
-- ---------------------------------------------------------------------
drop view if exists v_resumen_mes;

create view v_resumen_mes as
select
  date_trunc('month', fecha)::date as mes,
  sum(m2) as m2_vendidos,
  sum(m2_entregados) as m2_cosechados,
  sum(m2_cortesia) as m2_regalados,
  sum(total) as vendido,
  sum(costo_cosecha) as costo_cosecha,
  sum(costo_envio) as costo_envio,
  sum(total - costo_cosecha - costo_envio) as neto,
  count(*) as operaciones
from ventas
where estado in ('confirmada', 'entregada')
group by 1
order by 1;
