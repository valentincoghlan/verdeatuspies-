-- ---------------------------------------------------------------------
-- 0045 · "Federico Block" pasa a llamarse "Federico"
--
-- Es un renombre y nada más: el nombre del cliente vive solo en
-- `clientes.nombre` y todo lo demás —ventas, cosechas, cobros, cuenta
-- corriente— se cuelga del `cliente_id`. Cambiando la fila cambia en
-- todas las pantallas, sin tocar un solo registro de plata.
--
-- Va también en `personas`, que es la tabla de quien cobra y quien paga
-- en Movimientos: si estaba cargado ahí con el nombre viejo, la columna
-- "Persona" seguiría diciendo "Federico Block".
--
-- La 0023 lo nombra con el nombre viejo para marcarlo como distribuidor.
-- No se toca: ya corrió, y en una base nueva corre antes que esta.
-- ---------------------------------------------------------------------

update clientes set nombre = 'Federico'
 where nombre = 'Federico Block';

update personas set nombre = 'Federico'
 where nombre = 'Federico Block';

-- ---------------------------------------------------------------------
-- Los tres detalles donde el apellido estaba escrito a mano
--
-- El detalle de un movimiento es texto libre: no se renombra solo cuando
-- cambia el cliente. Eran dos fletes cargados "apellido, nombre" y un
-- cobro. Se emparejan por texto y no por id para que esto se pueda
-- volver a correr en una base nueva.
-- ---------------------------------------------------------------------

update movimientos set detalle = 'Flete Federico'
 where detalle = 'Flete Block, Federico';

update movimientos set detalle = replace(detalle, 'Federico Block', 'Federico')
 where detalle like '%Federico Block%';
