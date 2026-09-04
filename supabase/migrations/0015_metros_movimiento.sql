-- =====================================================================
-- 0015 — Metros cuadrados en el movimiento
--
-- En la planilla, la mano de obra de cosecha venía anotada como
-- "Pedro (295)" o "Matias Cardales - 700mts": el nombre de quien cobró y
-- los metros que cosechó, todo mezclado en el detalle.
--
-- Separados, sirven para saber cuánto cuesta el metro cosechado.
-- =====================================================================

alter table movimientos add column if not exists metros numeric(12,2);
create index if not exists movimientos_metros_idx on movimientos (metros) where metros is not null;

-- ---------------------------------------------------------------------
-- La vista de movimientos expone los metros
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
  m.metros
from movimientos m
left join cuentas cu on cu.id = m.cuenta_id
left join categorias cat on cat.id = m.categoria_id
left join categorias pad on pad.id = cat.padre_id
left join personas p on p.id = m.persona_id
left join lotes l on l.id = m.lote_id
left join clientes cl on cl.id = m.cliente_id;

-- ---------------------------------------------------------------------
-- Costo por metro cosechado, por mes
-- ---------------------------------------------------------------------
create or replace view v_costo_cosecha as
select
  date_trunc('month', m.fecha)::date as mes,
  sum(m.metros) as metros,
  sum(m.monto) as costo_ars,
  sum(m.monto_usd) as costo_usd,
  round(sum(m.monto) / nullif(sum(m.metros), 0), 2) as ars_por_metro,
  round(sum(m.monto_usd) / nullif(sum(m.metros), 0), 4) as usd_por_metro,
  count(*) as pagos
from movimientos m
join categorias h on h.id = m.categoria_id
join categorias p on p.id = h.padre_id
where m.tipo = 'E' and p.nombre = 'Cosecha' and m.metros is not null and m.metros > 0
group by 1
order by 1;
