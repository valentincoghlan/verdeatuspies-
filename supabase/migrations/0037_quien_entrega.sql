-- ---------------------------------------------------------------------
-- 0037 · Quién entregó y quién retiró
--
-- Al confirmar una entrega se anotaba cuánto y cuándo, pero no quién.
-- Y es lo primero que se pregunta cuando algo no cierra: si faltaron
-- panes, si el camión volvió tarde, si el cliente dice que nunca le
-- llegó. La respuesta vivía en la memoria del que estuvo ahí.
--
-- Son dos datos distintos:
--   · quien_entrega — alguien del equipo, de una lista corta.
--   · quien_retira  — del otro lado del mostrador. Puede ser el cliente,
--     un fletero, el encargado de una obra. No hay lista posible, así
--     que es texto libre y además opcional: muchas veces se deja en el
--     campo y nadie firma nada.
--
-- Texto y no una referencia a personas: el que retira casi nunca está
-- en el sistema y no tiene sentido darlo de alta como proveedor para
-- anotar que pasó a buscar unos metros.
-- ---------------------------------------------------------------------

alter table ventas
  add column if not exists quien_entrega text,
  add column if not exists quien_retira text;

comment on column ventas.quien_entrega is
  'Quién del equipo hizo la entrega.';
comment on column ventas.quien_retira is
  'Quién la recibió del otro lado. Opcional: a veces no hay nadie.';
