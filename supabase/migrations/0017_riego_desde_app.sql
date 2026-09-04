-- =====================================================================
-- 0017 — Los riegos ordenados desde la app
--
-- La tabla solo aceptaba dos orígenes: 'manual' (lo cargaste a mano) y
-- 'hydrawise' (lo trajo la sincronización). Ahora hay un tercero: el
-- riego que la app le ordena al controlador, que es el único con minutos
-- exactos en vez de estimados.
--
-- Sin esto la base rechaza el registro: el agua corre igual, pero el
-- riego no queda anotado.
-- =====================================================================

alter table riegos drop constraint if exists riegos_origen_check;

alter table riegos
  add constraint riegos_origen_check
  check (origen in ('manual', 'hydrawise', 'app'));
