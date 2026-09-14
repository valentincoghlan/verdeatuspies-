-- ---------------------------------------------------------------------
-- 0035 · Cargas en tanda
--
-- Un día de cosecha no es un gasto: es el pago a cinco personas, cada
-- una cobrando de una cuenta distinta, y todo eso corresponde a los tres
-- pedidos que esa cosecha abasteció. Hasta hoy eso se cargaba de a un
-- movimiento por vez, eligiendo una sola venta, y el reparto entre
-- pedidos había que hacerlo a mano con una calculadora.
--
-- Un movimiento sigue siendo una línea con una cuenta y una venta —eso
-- no cambia, es lo que hace que los saldos y los márgenes cierren—. Lo
-- que se suma es el hilo que ata a las que se cargaron juntas, para
-- poder verlas como lo que son y para poder deshacer la tanda entera si
-- se cargó mal.
-- ---------------------------------------------------------------------

alter table movimientos
  add column if not exists tanda_id uuid;

comment on column movimientos.tanda_id is
  'Ata los movimientos cargados en una misma tanda. Null = carga suelta.';

create index if not exists movimientos_tanda_idx
  on movimientos (tanda_id)
  where tanda_id is not null;
