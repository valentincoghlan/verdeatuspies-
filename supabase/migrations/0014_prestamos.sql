-- =====================================================================
-- 0014 — Préstamos a personas
--
-- Plata que le prestás a alguien del equipo y que te tiene que devolver.
-- No es una venta, así que no va en el saldo de clientes: va en su
-- propio cuadro, por persona.
-- =====================================================================

insert into categorias (nombre, padre_id, tipo_mov, orden) values
  ('Préstamos', null, 'ambos', 140)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Préstamos' and padre_id is null), v.tipo, v.orden
from (values
  ('Préstamo otorgado', 'E', 10),
  ('Devolución de préstamo', 'I', 20)
) as v(nombre, tipo, orden)
on conflict (nombre, padre_id) do nothing;

-- ---------------------------------------------------------------------
-- El préstamo a Mario, que en la planilla estaba suelto sin fecha
-- ---------------------------------------------------------------------
insert into movimientos (fecha, tipo, cuenta_id, categoria_id, persona_id, detalle, monto, moneda, cotizacion, monto_usd, origen)
select
  date '2026-02-01',
  'E',
  (select id from cuentas where nombre = 'Efectivo'),
  (select h.id from categorias h join categorias p on p.id = h.padre_id
   where p.nombre = 'Préstamos' and h.nombre = 'Préstamo otorgado'),
  (select id from personas where nombre = 'Martinez Mario'),
  'Préstamo en efectivo',
  330000,
  'ARS',
  1464.60,
  225.30,
  'manual'
where not exists (
  select 1 from movimientos
  where fecha = date '2026-02-01' and monto = 330000 and detalle = 'Préstamo en efectivo'
);

-- ---------------------------------------------------------------------
-- Cuánto debe cada uno: lo prestado menos lo devuelto
-- ---------------------------------------------------------------------
create or replace view v_prestamos as
select
  p.id as persona_id,
  p.nombre as persona,
  p.tipo as persona_tipo,
  coalesce(sum(case when m.tipo = 'E' then m.monto else -m.monto end), 0) as saldo_ars,
  coalesce(sum(case when m.tipo = 'E' then coalesce(m.monto_usd, 0) else -coalesce(m.monto_usd, 0) end), 0) as saldo_usd,
  count(m.id) as movimientos,
  min(m.fecha) filter (where m.tipo = 'E') as desde,
  max(m.fecha) as ultimo
from personas p
join movimientos m on m.persona_id = p.id
join categorias h on h.id = m.categoria_id
join categorias pad on pad.id = h.padre_id
where pad.nombre = 'Préstamos'
group by p.id, p.nombre, p.tipo
having coalesce(sum(case when m.tipo = 'E' then m.monto else -m.monto end), 0) <> 0
order by 4 desc;
