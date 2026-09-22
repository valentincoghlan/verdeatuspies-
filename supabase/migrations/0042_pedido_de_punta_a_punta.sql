-- ---------------------------------------------------------------------
-- 0042 · El pedido, de punta a punta
--
-- Hasta acá el recorrido de un pedido vivía repartido en tres pantallas,
-- y cada una tenía su propio estado: Pedidos sabía si se había
-- entregado, Cosecha sabía si estaba abierta o cerrada, y Ventas sabía
-- si estaba cobrada. Para saber cómo venía UN pedido había que abrir las
-- tres y armar el cuento en la cabeza.
--
-- Acá se ordenan dos cosas:
--
-- 1. UNA SOLA ETAPA POR PEDIDO. La vista `v_flujo_pedidos` dice en qué
--    escalón está cada uno, sacándolo de lo que ya existe: el estado de
--    la venta, si tiene una cosecha abierta encima y cuánta plata entró.
--    No hay una columna nueva que alguien tenga que acordarse de mover:
--    la etapa se deduce, así que no puede quedar desincronizada.
--
--       pedido -> en cosecha -> cosechado -> entregado -> cobrado
--
-- 2. COSECHAR SIN CONTAR PILAS. El contador de pilas es la herramienta
--    fina, y sigue igual. Pero muchas veces el pasto ya está cortado y
--    lo único que hace falta es anotar cuántos metros salieron y de qué
--    lote. Para eso la cosecha pasa a tener dos modos:
--
--       conteo   los m² salen de las pilas contadas, como siempre
--       directo  los m² se escriben a mano, por lote, y listo
--
--    Los m² directos se guardan en `cosechas_lotes.m2`, que es la tabla
--    que ya decía de qué lotes salió esa cosecha. Así el desglose por
--    lote —y de ahí el lote de cada venta— sigue saliendo del mismo
--    lugar, sin inventar una tabla paralela.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Los dos modos de cosechar
-- ---------------------------------------------------------------------
alter table cosechas
  add column if not exists modo text not null default 'conteo';

alter table cosechas drop constraint if exists cosechas_modo_check;
alter table cosechas add constraint cosechas_modo_check
  check (modo in ('conteo', 'directo'));

comment on column cosechas.modo is
  'conteo: los m2 salen de las pilas contadas. directo: se escriben a mano en cosechas_lotes.m2.';

alter table cosechas_lotes
  add column if not exists m2 numeric(12,2);

comment on column cosechas_lotes.m2 is
  'Los m2 que salieron de este lote cuando la cosecha se cargo de una, sin contar pilas.';

-- ---------------------------------------------------------------------
-- 2. El desglose por lote suma los dos modos
--
-- Mismas columnas que antes, en el mismo orden: lo único que cambia es
-- que ahora también entran los m² escritos a mano.
-- ---------------------------------------------------------------------
create or replace view v_cosecha_lotes as
select
  x.cosecha_id,
  x.lote_id,
  l.nombre as lote,
  sum(x.pilas)::int as pilas,
  sum(x.panes)::int as panes,
  round(sum(x.m2), 2) as m2
from (
  -- Contadas: el tramo de líneas con sus pilas.
  select
    ca.cosecha_id,
    ca.lote_id,
    ca.pilas,
    (ca.pilas * c.panes_por_pila) as panes,
    (ca.pilas * c.panes_por_pila * c.pan_largo_m * c.pan_ancho_m) as m2
  from cosecha_cargas ca
  join cosechas c on c.id = ca.cosecha_id
  union all
  -- Directas: los metros escritos a mano. No hay pilas ni panes que
  -- contar, así que van en cero y no ensucian el promedio del pan.
  select cl.cosecha_id, cl.lote_id, 0, 0, cl.m2
  from cosechas_lotes cl
  where cl.m2 is not null and cl.m2 > 0
) x
left join lotes l on l.id = x.lote_id
group by x.cosecha_id, x.lote_id, l.nombre;

comment on view v_cosecha_lotes is
  'El desglose de una cosecha por lote: pilas, panes y m2 de cada uno, contados o cargados de una.';

-- ---------------------------------------------------------------------
-- 3. Lo cosechado de una cosecha también suma los dos modos
--
-- `create or replace` con la lista de columnas intacta: `modo` se suma
-- al final, que es lo único que Postgres deja agregar sin tirar la
-- vista abajo (y tirarla se llevaría puesta a v_lotes_por_venta).
-- ---------------------------------------------------------------------
create or replace view v_cosechas as
select
  c.id,
  c.fecha,
  c.estado,
  c.notas,
  c.lote_id,
  lo.nombres as lote,
  lo.cuantos as cantidad_lotes,
  c.venta_id,
  ve.compradores as comprador,
  coalesce(ve.cuantos, 0) as cantidad_pedidos,
  coalesce(ve.m2_asignados, 0) as m2_asignados,
  c.objetivo_m2,
  c.pan_largo_m,
  c.pan_ancho_m,
  c.panes_por_pila,
  round(c.pan_largo_m * c.pan_ancho_m, 4) as m2_por_pan,
  ceil(c.objetivo_m2 / (c.pan_largo_m * c.pan_ancho_m))::int as panes_objetivo,
  ceil(c.objetivo_m2 / (c.pan_largo_m * c.pan_ancho_m) / c.panes_por_pila)::int as pilas_objetivo,
  coalesce(ca.cargas, 0)::int as cargas,
  coalesce(ca.lineas, 0)::int as lineas,
  coalesce(ca.pilas, 0)::int as pilas_cargadas,
  (coalesce(ca.pilas, 0) * c.panes_por_pila)::int as panes_cargados,
  round(
    coalesce(ca.pilas, 0) * c.panes_por_pila * c.pan_largo_m * c.pan_ancho_m
    + coalesce(dir.m2, 0),
    2
  ) as m2_cosechados,
  coalesce(ca.ultima_linea, 0)::int as ultima_linea,
  c.modo
from cosechas c
left join (
  select
    cxl.cosecha_id,
    string_agg(l.nombre, ' + ' order by l.nombre) as nombres,
    count(*)::int as cuantos
  from cosechas_lotes cxl
  join lotes l on l.id = cxl.lote_id
  group by cxl.cosecha_id
) lo on lo.cosecha_id = c.id
left join (
  select
    cv.cosecha_id,
    string_agg(cl.nombre, ' + ' order by cl.nombre) as compradores,
    count(*)::int as cuantos,
    sum(cv.m2) as m2_asignados
  from cosecha_ventas cv
  join ventas v on v.id = cv.venta_id
  join clientes cl on cl.id = v.cliente_id
  group by cv.cosecha_id
) ve on ve.cosecha_id = c.id
left join (
  select
    cosecha_id,
    count(*) as cargas,
    sum(linea_hasta - linea_desde + 1) as lineas,
    sum(pilas) as pilas,
    max(linea_hasta) as ultima_linea
  from cosecha_cargas group by cosecha_id
) ca on ca.cosecha_id = c.id
left join (
  select cosecha_id, sum(m2) as m2
  from cosechas_lotes where m2 is not null group by cosecha_id
) dir on dir.cosecha_id = c.id;

-- ---------------------------------------------------------------------
-- 4. El recorrido de cada pedido, en una fila
--
-- Una fila por venta, con todo lo que la pantalla de Pedidos necesita
-- para pintarla y para saber cuál es el botón que sigue. La etapa NO se
-- guarda: se deduce cada vez de tres cosas que ya existen.
--
--   pedido       tomado, nadie cortó nada todavía
--   en_cosecha   hay un contador abierto para este pedido
--   cosechado    el pasto está cortado y asignado, falta llevarlo
--   entregado    salió del campo, falta que entre la plata
--   cobrado      no debe nada: el recorrido terminó
--
-- Y afuera del camino, los dos que no avanzan: `presupuesto` (todavía
-- no es un pedido) y `anulado` (se cayó).
--
-- Lo cobrado sale de los movimientos colgados de la venta, igual que en
-- v_margen_ventas. Antes de la entrega esa plata es una seña; después es
-- cobranza. Es la misma plata y se mira en la misma columna.
-- ---------------------------------------------------------------------
create or replace view v_flujo_pedidos as
with cos as (
  -- Cosechado de verdad es lo que le asignó una cosecha YA CERRADA. Una
  -- abierta se engancha al pedido desde el minuto cero para que el
  -- contador sepa para quién corta, pero todavía no cortó nada: contarla
  -- acá sería dar por cosechado un pedido que recién empieza.
  select
    cv.venta_id,
    sum(cv.m2) filter (where c.estado = 'cerrada') as m2_cosechados,
    count(*)::int as cosechas,
    (count(*) filter (where c.estado = 'abierta'))::int as cosechas_abiertas,
    (array_agg(c.id) filter (where c.estado = 'abierta'))[1] as cosecha_abierta_id,
    -- Lo que lleva contado el contador abierto, para poder mostrar cómo
    -- viene sin entrar a la cosecha.
    max(vc.m2_cosechados) filter (where c.estado = 'abierta') as m2_en_curso,
    max(c.fecha) as ultima_cosecha
  from cosecha_ventas cv
  join cosechas c on c.id = cv.cosecha_id
  left join v_cosechas vc on vc.id = c.id
  group by cv.venta_id
),
plata as (
  select venta_id, sum(monto) as cobrado
  from movimientos
  where tipo = 'I' and venta_id is not null
  group by venta_id
)
select
  v.id,
  v.fecha,
  v.fecha_entrega,
  v.estado,
  v.canal,
  v.cliente_id,
  comp.nombre as comprador,
  v.vinculante_id,
  vinc.nombre as vinculante,
  v.cliente_final,
  v.lote_id,
  coalesce(lv.lotes, l.nombre) as lote,
  v.m2,
  v.m2_pedido,
  v.m2_cortesia,
  v.precio_m2,
  v.flete,
  v.total,
  v.notas,
  v.quien_entrega,
  v.quien_retira,
  coalesce(co.m2_cosechados, 0) as m2_cosechados,
  coalesce(co.cosechas, 0) as cosechas,
  coalesce(co.cosechas_abiertas, 0) as cosechas_abiertas,
  co.cosecha_abierta_id,
  coalesce(co.m2_en_curso, 0) as m2_en_curso,
  co.ultima_cosecha,
  coalesce(pl.cobrado, 0) as cobrado,
  v.total - coalesce(pl.cobrado, 0) as pendiente,
  cd.precipitacion_mm,
  cd.prob_precipitacion,
  case
    when v.estado = 'anulada'     then 'anulado'
    when v.estado = 'presupuesto' then 'presupuesto'
    -- Medio peso de diferencia es redondeo, no una deuda.
    when v.estado = 'entregada' and v.total - coalesce(pl.cobrado, 0) <= 0.5 then 'cobrado'
    when v.estado = 'entregada'   then 'entregado'
    -- Un contador abierto manda sobre el estado: si un pedido ya
    -- cosechado a medias tiene una segunda cosecha en curso, lo que hay
    -- para hacer hoy es terminarla, no entregar.
    when coalesce(co.cosechas_abiertas, 0) > 0   then 'en_cosecha'
    when v.estado in ('cosechada', 'confirmada') then 'cosechado'
    else 'pedido'
  end as etapa,
  case
    when v.estado = 'anulada'     then 9
    when v.estado = 'presupuesto' then 0
    when v.estado = 'entregada' and v.total - coalesce(pl.cobrado, 0) <= 0.5 then 5
    when v.estado = 'entregada'   then 4
    when coalesce(co.cosechas_abiertas, 0) > 0   then 2
    when v.estado in ('cosechada', 'confirmada') then 3
    else 1
  end as orden_etapa
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join v_lotes_por_venta lv on lv.venta_id = v.id
left join cos co on co.venta_id = v.id
left join plata pl on pl.venta_id = v.id
left join clima_dias cd on cd.fecha = v.fecha_entrega;

comment on view v_flujo_pedidos is
  'Una fila por pedido con su etapa: pedido, en_cosecha, cosechado, entregado o cobrado.';
