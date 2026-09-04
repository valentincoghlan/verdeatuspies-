-- =====================================================================
-- 0024 — La categoría de los ajustes de saldo
--
-- Los saldos que arrastra la app vienen de la planilla, y la planilla
-- tiene huecos: la caja de efectivo daba negativo, que es imposible.
-- En vez de adivinar qué movimiento falta, se declara el saldo real de
-- hoy y la app asienta la diferencia como un movimiento más, a la vista.
--
-- Va en su propia categoría para que no ensucie ningún análisis: un
-- ajuste no es una venta ni un gasto, es reconocer que a los libros les
-- faltaba algo.
--
-- Quién puede hacerlo ya estaba resuelto: `perfiles.rol` distingue
-- 'admin' de 'operador', y el ajuste queda para los admin.
-- =====================================================================

insert into categorias (nombre, padre_id, tipo, orden)
select 'Ajustes', null, 'ambos', 900
where not exists (select 1 from categorias where nombre = 'Ajustes' and padre_id is null);

insert into categorias (nombre, padre_id, tipo, orden)
select h.nombre, c.id, 'ambos', h.orden
from categorias c
cross join (values ('Ajuste de saldo', 901), ('Cobro sin registrar', 902)) as h(nombre, orden)
where c.nombre = 'Ajustes' and c.padre_id is null
  and not exists (
    select 1 from categorias x where x.padre_id = c.id and x.nombre = h.nombre
  );

-- ---------------------------------------------------------------------
-- El origen 'ajuste'
--
-- Los movimientos tienen una lista cerrada de orígenes. Sin sumar este,
-- la base rechaza el asiento y el ajuste no se guarda.
-- ---------------------------------------------------------------------
alter table movimientos drop constraint if exists movimientos_origen_check;

alter table movimientos
  add constraint movimientos_origen_check
  check (origen in ('manual', 'importado', 'venta', 'pedido', 'ajuste'));
