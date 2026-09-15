-- ---------------------------------------------------------------------
-- 0036 · Una venta puede estar cosechada
--
-- Entre "pedido" y "entregada" faltaba un escalón. Se corta el pasto un
-- día y se entrega al otro, y en el medio la venta figuraba igual que
-- una que todavía no tocó nadie: el pasto ya estaba cortado, apilado y
-- con la mano de obra pagada, pero la pantalla decía "pedido".
--
-- El estado lo pone sola la app cuando se cierra una cosecha y se le
-- asigna a esa venta. No se elige a mano.
--
-- Dónde suma:
--   · Las vistas de plata lo cuentan donde ya contaban "confirmada":
--     una venta cosechada está más avanzada que una confirmada, así que
--     si esa entraba, esta también. Lo único que sigue afuera es
--     "pedido", que es lo que todavía puede no pasar.
--   · La lista de pedidos por entregar lo sigue mostrando: estar
--     cosechado no es estar entregado, y ese pasto hay que llevarlo.
--
-- Las cuatro vistas van con `create or replace` y la lista de columnas
-- intacta: lo único que cambia es a qué estados mira cada una.
-- ---------------------------------------------------------------------

alter table ventas drop constraint if exists ventas_estado_check;
alter table ventas add constraint ventas_estado_check
  check (estado in ('presupuesto', 'pedido', 'cosechada', 'confirmada', 'entregada', 'anulada'));

-- Las que ya tienen cosecha asignada y siguen figurando como pedido.
update ventas v
set estado = 'cosechada'
where v.estado = 'pedido'
  and exists (select 1 from cosecha_ventas cv where cv.venta_id = v.id);

-- ---------------------------------------------------------------------
-- 1. El margen de cada venta
-- ---------------------------------------------------------------------
create or replace view v_margen_ventas as
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
where v.estado in ('cosechada', 'confirmada', 'entregada');

-- ---------------------------------------------------------------------
-- 2. El resumen por mes
-- ---------------------------------------------------------------------
create or replace view v_resumen_mes as
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
where estado in ('cosechada', 'confirmada', 'entregada')
group by 1
order by 1;

-- ---------------------------------------------------------------------
-- 3. La cuenta corriente de cada cliente
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
  from ventas where estado in ('cosechada', 'confirmada', 'entregada') group by cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total_cobrado
  from movimientos where tipo = 'I' and cliente_id is not null group by cliente_id
) co on co.cliente_id = c.id;

-- ---------------------------------------------------------------------
-- 4. Los pedidos por entregar
--
-- Sigue incluyendo los cosechados: el pasto está cortado pero todavía
-- hay que llevarlo, así que no puede desaparecer de la lista de salidas.
-- ---------------------------------------------------------------------
create or replace view v_pedidos_pendientes as
select
  v.id, v.fecha, v.fecha_entrega, v.m2, v.m2_pedido, v.precio_m2, v.flete, v.total,
  v.notas, v.canal, v.cliente_id,
  comp.nombre as comprador,
  v.vinculante_id, vinc.nombre as vinculante, v.cliente_final,
  v.lote_id, l.nombre as lote,
  cd.precipitacion_mm, cd.prob_precipitacion, cd.temp_max, cd.temp_min,
  coalesce(se.senado, 0) as senado
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join clima_dias cd on cd.fecha = v.fecha_entrega
left join (
  select venta_id, sum(monto) as senado
  from movimientos where tipo = 'I' and venta_id is not null group by venta_id
) se on se.venta_id = v.id
where v.estado in ('pedido', 'cosechada');
