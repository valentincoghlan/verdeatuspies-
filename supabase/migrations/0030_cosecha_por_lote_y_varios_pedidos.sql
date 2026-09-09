-- ---------------------------------------------------------------------
-- 0030 · De qué lote sale cada pan, y a qué pedidos va la cosecha
--
-- Dos cuellos de botella del modelo viejo:
--
-- 1. La cosecha guardaba UN lote. Si empezabas cortando en 20 de Junio y
--    terminabas en Yapeyú tenías que abrir dos cosechas y el contador se
--    partía en dos, cuando la carga es la misma. Ahora el lote va en cada
--    carga: el contador sigue siendo uno solo y de yapa sale cuántos
--    panes salieron de cada lote.
--
-- 2. La cosecha guardaba UN pedido. Si cosechabas 100 m² para tres
--    pedidos, solo podías apuntarlos a uno. Ahora el reparto va en su
--    propia tabla, con los m² que le tocan a cada uno.
--
-- De ahí sale también el lote de una venta, que es lo que se perdió al
-- sacar el campo del formulario: venta -> cosechas que la abastecieron
-- -> cargas -> lotes, ponderado por m².
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. El lote de cada carga
-- ---------------------------------------------------------------------
alter table cosecha_cargas
  add column if not exists lote_id uuid references lotes(id) on delete set null;

comment on column cosecha_cargas.lote_id is
  'De qué lote salió esta carga. Una cosecha puede tocar más de uno.';

create index if not exists cosecha_cargas_lote_idx on cosecha_cargas (lote_id);

-- Lo ya cargado sale del lote de su cosecha, que hasta ahora era uno solo.
update cosecha_cargas c
   set lote_id = co.lote_id
  from cosechas co
 where c.cosecha_id = co.id
   and c.lote_id is null
   and co.lote_id is not null;

-- ---------------------------------------------------------------------
-- 2. A qué pedidos va la cosecha, y cuántos m² a cada uno
-- ---------------------------------------------------------------------
create table if not exists cosecha_ventas (
  cosecha_id uuid not null references cosechas(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  m2 numeric(12,2) not null default 0 check (m2 >= 0),
  created_at timestamptz not null default now(),
  primary key (cosecha_id, venta_id)
);
create index if not exists cosecha_ventas_venta_idx on cosecha_ventas (venta_id);

-- El pedido único que ya tenían las cosechas pasa a la tabla nueva, con
-- los m² del pedido como reparto.
insert into cosecha_ventas (cosecha_id, venta_id, m2)
select c.id, c.venta_id, coalesce(v.m2, 0)
  from cosechas c
  join ventas v on v.id = c.venta_id
 where c.venta_id is not null
on conflict do nothing;

alter table cosecha_ventas enable row level security;
drop policy if exists miembros_all on cosecha_ventas;
create policy miembros_all on cosecha_ventas
  for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

-- ---------------------------------------------------------------------
-- 3. Cuántos panes salieron de cada lote, en cada cosecha
-- ---------------------------------------------------------------------
create or replace view v_cosecha_lotes as
select
  ca.cosecha_id,
  ca.lote_id,
  l.nombre as lote,
  sum(ca.pilas)::int as pilas,
  (sum(ca.pilas) * max(c.panes_por_pila))::int as panes,
  round(sum(ca.pilas) * max(c.panes_por_pila) * max(c.pan_largo_m) * max(c.pan_ancho_m), 2) as m2
from cosecha_cargas ca
join cosechas c on c.id = ca.cosecha_id
left join lotes l on l.id = ca.lote_id
group by ca.cosecha_id, ca.lote_id, l.nombre;

comment on view v_cosecha_lotes is
  'El desglose de una cosecha por lote: pilas, panes y m² de cada uno.';

-- ---------------------------------------------------------------------
-- 4. De qué lote salió cada venta
--
-- Sale de las cosechas que la abastecieron. Si una venta no tiene
-- cosecha —las históricas, o una cargada suelta— vale el lote que se
-- eligió a mano en el formulario.
-- ---------------------------------------------------------------------
create or replace view v_lotes_por_venta as
with de_cosecha as (
  select
    cv.venta_id,
    cl.lote,
    sum(cl.m2) as m2
  from cosecha_ventas cv
  join v_cosecha_lotes cl on cl.cosecha_id = cv.cosecha_id
  where cl.lote is not null
  group by cv.venta_id, cl.lote
)
select
  v.id as venta_id,
  coalesce(
    (select string_agg(d.lote, ' + ' order by d.m2 desc) from de_cosecha d where d.venta_id = v.id),
    l.nombre
  ) as lotes,
  (select count(*) from de_cosecha d where d.venta_id = v.id)::int as cuantos_lotes
from ventas v
left join lotes l on l.id = v.lote_id;

-- ---------------------------------------------------------------------
-- 5. La vista de cosechas: el comprador puede ser más de uno
-- ---------------------------------------------------------------------
drop view if exists v_cosechas;

create view v_cosechas as
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
  round(coalesce(ca.pilas, 0) * c.panes_por_pila * c.pan_largo_m * c.pan_ancho_m, 2) as m2_cosechados,
  coalesce(ca.ultima_linea, 0)::int as ultima_linea
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
) ca on ca.cosecha_id = c.id;
