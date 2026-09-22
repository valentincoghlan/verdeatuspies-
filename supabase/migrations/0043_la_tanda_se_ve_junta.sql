-- ---------------------------------------------------------------------
-- 0043 · La tanda se ve junta
--
-- Un día de cosecha se le paga a Pedro $ 300.000 y ese trabajo abasteció
-- diez pedidos. Adentro eso son diez movimientos —uno por pedido, con su
-- parte proporcional a los metros— y así tiene que seguir siendo: es lo
-- que hace que el costo de cada cosecha cierre.
--
-- Lo que no tiene que pasar es que la pantalla de Movimientos muestre
-- diez renglones de "Cosecha · Mano de obra · Pedro". Eso no fue lo que
-- pasó: salió UNA plata de UNA cuenta, y después se repartió.
--
-- El hilo que las ata ya existe desde la 0035 (`movimientos.tanda_id`),
-- pero la vista no lo exponía, así que la pantalla no tenía cómo
-- juntarlas. Lo único que cambia acá es esa columna.
-- ---------------------------------------------------------------------

create or replace view v_movimientos as
select
  m.id, m.fecha, m.tipo, m.monto, m.moneda, m.cotizacion, m.monto_usd,
  m.detalle, m.origen, m.notas, m.created_at,
  m.cuenta_id, cu.nombre as cuenta,
  m.categoria_id,
  coalesce(pad.nombre, cat.nombre) as categoria,
  case when pad.nombre is null then null else cat.nombre end as subcategoria,
  m.persona_id, p.nombre as persona, p.tipo as persona_tipo,
  m.lote_id, l.nombre as lote,
  m.venta_id, m.cliente_id, cl.nombre as cliente,
  m.metros,
  coalesce(pad.tipo_plata, cat.tipo_plata, 'mantenimiento') as tipo_plata,
  -- Va ultima y no al lado de venta_id, que es donde correspondia: un
  -- `create or replace view` solo deja AGREGAR columnas al final. Meterla
  -- en el medio le corre el nombre a las que siguen y Postgres lo rebota
  -- ("cannot change name of view column"). Para acomodarla habria que
  -- borrar la vista y volver a crearla, y no vale la pena.
  m.tanda_id
from movimientos m
left join cuentas cu on cu.id = m.cuenta_id
left join categorias cat on cat.id = m.categoria_id
left join categorias pad on pad.id = cat.padre_id
left join personas p on p.id = m.persona_id
left join lotes l on l.id = m.lote_id
left join clientes cl on cl.id = m.cliente_id;
