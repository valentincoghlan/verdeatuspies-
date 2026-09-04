-- =====================================================================
-- 0010 — Saldos separados por moneda
--
-- La cuenta USD tiene movimientos cargados en pesos (con su equivalente
-- en dólares al lado) y otros cargados directo en dólares. Sumarlos
-- juntos daba un número sin sentido: "US$ 10.937.708".
--
-- Cada movimiento sabe en qué moneda se cargó, así que el saldo se
-- calcula por moneda y la pantalla muestra la que corresponda.
-- =====================================================================

drop view if exists v_saldos_cuentas;

create view v_saldos_cuentas as
select
  c.id as cuenta_id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.activa,
  c.orden,
  coalesce(sum(case when m.moneda = 'ARS' then (case when m.tipo = 'I' then m.monto else -m.monto end) end), 0) as saldo_ars,
  coalesce(sum(case when m.moneda = 'USD' then (case when m.tipo = 'I' then m.monto else -m.monto end) end), 0) as saldo_usd,
  count(m.id) filter (where m.moneda = 'ARS') as movimientos_ars,
  count(m.id) filter (where m.moneda = 'USD') as movimientos_usd,
  count(m.id) as movimientos,
  max(m.fecha) as ultimo_movimiento
from cuentas c
left join movimientos m on m.cuenta_id = c.id
group by c.id, c.nombre, c.tipo, c.moneda, c.activa, c.orden;
