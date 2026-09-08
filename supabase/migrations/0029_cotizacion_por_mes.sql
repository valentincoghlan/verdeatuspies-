-- ---------------------------------------------------------------------
-- 0029 · La cotización de cada mes, para poder mirar todo en dólares
--
-- En un país donde el peso se mueve, mirar tres temporadas en pesos no
-- dice nada: $41 millones de 2024 y $11 millones de 2026 no son
-- comparables. En dólares sí.
--
-- Cada movimiento ya guarda su `monto_usd`, dolarizado con la cotización
-- del día en que se hizo. Las ventas no: para ellas hace falta la
-- cotización del mes, y sale de los propios movimientos, que cubren
-- desde enero de 2023 hasta hoy.
--
-- Se toma la mediana y no el promedio: si un mes tiene un movimiento
-- cargado con una cotización rara, la mediana no se mueve.
-- ---------------------------------------------------------------------

create or replace view v_cotizacion_mes as
select
  to_char(fecha, 'YYYY-MM') as mes,
  round(
    (percentile_cont(0.5) within group (order by cotizacion))::numeric,
    2
  ) as mep,
  count(*)::int as movimientos
from movimientos
where cotizacion is not null
  and cotizacion > 0
group by 1;

comment on view v_cotizacion_mes is
  'Cotización mediana de cada mes, sacada de los movimientos ya cargados.';
