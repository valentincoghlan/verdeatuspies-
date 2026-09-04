-- =====================================================================
-- 0005 — Canal de venta
--
-- Cada venta entra por un canal:
--   directa -> se la vendés vos al comprador
--   masiva  -> la trae un tercero (vivero, paisajista) que revende
--
-- En las masivas, vinculante_id guarda quién la trajo. La columna se
-- sigue llamando así en la base para no romper lo que ya existe; en la
-- pantalla se lee "Quién trae la venta".
-- =====================================================================

alter table ventas add column if not exists canal text not null default 'directa';
alter table ventas drop constraint if exists ventas_canal_check;
alter table ventas add constraint ventas_canal_check
  check (canal in ('directa', 'masiva'));

-- Lo que ya tenía un tercero cargado es, por definición, masiva.
update ventas set canal = 'masiva' where vinculante_id is not null and canal <> 'masiva';

create index if not exists ventas_canal_idx on ventas (canal);

-- ---------------------------------------------------------------------
-- Las vistas exponen el canal
-- ---------------------------------------------------------------------
drop view if exists v_pedidos_pendientes;
create view v_pedidos_pendientes as
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
  v.canal,
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

drop view if exists v_margen_ventas;
create view v_margen_ventas as
select
  v.id as venta_id,
  v.fecha,
  v.fecha_entrega,
  v.estado,
  v.canal,
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

-- ---------------------------------------------------------------------
-- Resumen por mes: vendido, cosechado y regalado
--
--   m2_vendidos   -> los que se facturan
--   m2_cosechados -> todo lo que salió del campo (vendidos + cortesía)
--   m2_regalados  -> la diferencia: pasto entregado que no se cobró
-- ---------------------------------------------------------------------
create or replace view v_resumen_mes as
select
  date_trunc('month', fecha)::date as mes,
  sum(m2) as m2_vendidos,
  sum(m2_entregados) as m2_cosechados,
  sum(m2_cortesia) as m2_regalados,
  sum(total) as vendido,
  count(*) as operaciones
from ventas
where estado in ('confirmada', 'entregada')
group by 1
order by 1;
