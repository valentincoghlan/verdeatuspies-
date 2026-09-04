-- =====================================================================
-- 0016 — Cada categoría sabe si es entrada, salida o las dos
--
-- "Cosecha · Combustible" nunca es una entrada de plata. Hasta ahora el
-- formulario te dejaba elegir cualquier categoría para cualquier lado, y
-- así se cuelan errores que después hay que buscar a mano.
--
-- Con esto, al marcar Sale o Entra el desplegable trae solo las que
-- corresponden. La regla se administra desde Ajustes -> Datos.
--
--   'E'      -> solo salidas (gastos, pagos)
--   'I'      -> solo entradas (ventas, cobros)
--   'ambos'  -> puede ir para los dos lados (aportes, préstamos)
-- =====================================================================

alter table categorias
  add column if not exists tipo text not null default 'ambos'
  check (tipo in ('E', 'I', 'ambos'));

-- ---------------------------------------------------------------------
-- 1. Deducir la regla de lo que ya está cargado
-- ---------------------------------------------------------------------
with uso as (
  select
    categoria_id,
    count(*) filter (where tipo = 'E') as salidas,
    count(*) filter (where tipo = 'I') as entradas
  from movimientos
  where categoria_id is not null
  group by categoria_id
)
update categorias c
set tipo = case
  when u.salidas > 0 and u.entradas > 0 then 'ambos'
  when u.entradas > 0 then 'I'
  else 'E'
end
from uso u
where u.categoria_id = c.id;

-- ---------------------------------------------------------------------
-- 2. El rubro es la suma de lo que hacen sus subcategorías usadas
-- ---------------------------------------------------------------------
with usadas as (
  select h.padre_id, h.tipo
  from categorias h
  where h.padre_id is not null
    and exists (select 1 from movimientos m where m.categoria_id = h.id)
),
resumen as (
  select
    padre_id,
    bool_or(tipo in ('E', 'ambos')) as hay_salida,
    bool_or(tipo in ('I', 'ambos')) as hay_entrada
  from usadas
  group by padre_id
)
update categorias p
set tipo = case
  when r.hay_salida and r.hay_entrada then 'ambos'
  when r.hay_entrada then 'I'
  else 'E'
end
from resumen r
where r.padre_id = p.id;

-- ---------------------------------------------------------------------
-- 3. Las subcategorías que nunca se usaron heredan su rubro
-- ---------------------------------------------------------------------
update categorias h
set tipo = p.tipo
from categorias p
where h.padre_id = p.id
  and not exists (select 1 from movimientos m where m.categoria_id = h.id);

-- ---------------------------------------------------------------------
-- 4. Lo que los números solos no pueden saber
--
-- Un aporte entra cuando el socio pone plata y sale cuando se le
-- devuelve. Un préstamo sale al otorgarlo y entra cuando lo cobrás.
-- ---------------------------------------------------------------------
update categorias set tipo = 'ambos'
  where nombre in ('Aportes', 'Préstamos', 'VC entrego a MC');

update categorias set tipo = 'E' where nombre = 'Préstamo otorgado';
update categorias set tipo = 'I' where nombre = 'Devolución de préstamo';
