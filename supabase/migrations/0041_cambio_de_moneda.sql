-- ---------------------------------------------------------------------
-- 0041 · "Venta USD" deja de parecer una venta
--
-- En el desplegable de "Entra" aparecía "Venta USD", que se lee como una
-- venta de pasto cobrada en dólares. Para eso no hace falta una
-- categoría aparte: se elige "Ventas" y se pone la cuenta en dólares.
--
-- Pero lo que estaba cargado ahí no eran ventas. Los cuatro movimientos
-- de "Venta USD" van apareados uno a uno con los cuatro de "Compra USD"
-- —mismo día, mismo monto, sale de Efectivo y entra en la cuenta USD—:
-- son cambios de moneda, plata que pasó de un bolsillo al otro. Mandados
-- a "Ventas" habrían sumado $7,6 M de cobranzas que nunca existieron.
--
-- Así que el par no se borra: se llama por su nombre. Un solo rubro,
-- "Cambio de moneda", con los dos lados adentro. Sigue siendo plata
-- "financiera", o sea que no toca el resultado ni el costo por m².
-- ---------------------------------------------------------------------

do $$
declare
  cambio uuid;
  vieja_venta uuid;
begin
  select id into cambio from categorias where padre_id is null and nombre = 'Compra USD';
  select id into vieja_venta from categorias where padre_id is null and nombre = 'Venta USD';

  -- Ya corrida: no hay nada que hacer.
  if cambio is null and vieja_venta is null then
    return;
  end if;

  -- El rubro "Compra USD" es el que queda, con los dos lados adentro.
  update categorias
     set nombre = 'Cambio de moneda',
         tipo_mov = 'ambos',
         tipo_plata = 'financiero',
         orden = 100,
         activa = true
   where id = cambio;

  if vieja_venta is not null then
    -- Primero se mudan las hijas y los movimientos que colgaban del
    -- rubro viejo. Recién después se borra: `padre_id` tiene ON DELETE
    -- CASCADE, así que borrarlo antes se llevaría puestas a las hijas y
    -- dejaría los movimientos sin categoría.
    update categorias set padre_id = cambio where padre_id = vieja_venta;
    update movimientos set categoria_id = cambio where categoria_id = vieja_venta;
    delete from categorias where id = vieja_venta;
  end if;

  -- Los dos lados, dichos como los diría cualquiera.
  update categorias
     set nombre = 'Compré dólares', tipo_mov = 'E', tipo_plata = 'financiero', orden = 10
   where padre_id = cambio and nombre = 'Compra USD';

  update categorias
     set nombre = 'Vendí dólares', tipo_mov = 'I', tipo_plata = 'financiero', orden = 20
   where padre_id = cambio and nombre = 'Venta USD';
end $$;
