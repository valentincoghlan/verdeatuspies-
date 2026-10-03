-- ---------------------------------------------------------------------
-- 0047 · Una bonificación no es un costo de cosecha
--
-- Cuando se le perdona el flete a un cliente no sale plata de ninguna
-- cuenta: la venta vale menos, nada más. La manera de anotarlo que salió
-- sola fue un par ingreso + egreso por el mismo monto, y para la caja
-- está bien: entra 300.000, salen 300.000, neto cero.
--
-- El problema es dónde cayó el egreso: en "Cosecha · Flete", que es
-- bolsa `cosecha`. O sea que la app lo lee como costo de cortar. Son
-- $300.000 de costo que nunca se pagaron, inflando el costo por m² y
-- comiéndose el margen de esa venta.
--
-- Se le hace lugar propio colgado de Ajustes, que ya es `financiero`:
-- plata que cambia de lugar y no es costo de producir ni venta nueva.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. El subrubro nuevo
-- ---------------------------------------------------------------------
insert into categorias (nombre, padre_id, tipo, tipo_plata, activa)
select 'Bonificación', a.id, 'E', 'financiero', true
  from categorias a
 where a.padre_id is null
   and a.nombre = 'Ajustes'
   and not exists (
     select 1 from categorias h
      where h.padre_id = a.id and h.nombre = 'Bonificación'
   );

-- ---------------------------------------------------------------------
-- 2. El egreso que ya estaba cargado se muda
--
-- Solo los que SALEN y dicen bonificación en el detalle. El ingreso del
-- par no se toca: está en "Ventas · Distribuidores" y ahí corresponde,
-- porque es lo que hace que la deuda del cliente baje.
-- ---------------------------------------------------------------------
update movimientos m
   set categoria_id = (
     select h.id from categorias h
       join categorias a on a.id = h.padre_id
      where a.nombre = 'Ajustes' and h.nombre = 'Bonificación'
      limit 1
   )
 where m.tipo = 'E'
   and m.detalle ilike '%bonificaci%'
   and m.categoria_id in (
     select h.id from categorias h
       join categorias a on a.id = h.padre_id
      where a.nombre = 'Cosecha'
   );
