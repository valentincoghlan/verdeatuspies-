-- =====================================================================
-- 0008 — Se cuenta por tramos, no línea por línea
--
-- Corrección de modelo. En el campo se cortan varias líneas al mismo
-- tiempo y se cuenta el total del grupo: "de la 2 a la 4 hay 62 pilas"
-- significa 62 entre las tres, no 62 en cada una.
--
-- Antes cada fila era una línea con sus pilas. Ahora cada fila es una
-- CARGA: un tramo de líneas con el total de pilas contadas en ese tramo.
-- =====================================================================

create table if not exists cosecha_cargas (
  id uuid primary key default gen_random_uuid(),
  cosecha_id uuid not null references cosechas(id) on delete cascade,
  linea_desde int not null check (linea_desde >= 1),
  linea_hasta int not null check (linea_hasta >= linea_desde),
  pilas int not null default 0 check (pilas >= 0),
  notas text,
  created_at timestamptz not null default now(),
  unique (cosecha_id, linea_desde, linea_hasta)
);
create index if not exists cosecha_cargas_idx on cosecha_cargas (cosecha_id, linea_desde);

-- Lo que ya estaba pasa como tramos de una sola línea.
insert into cosecha_cargas (cosecha_id, linea_desde, linea_hasta, pilas, notas, created_at)
select cosecha_id, numero, numero, pilas, notas, created_at
from cosecha_lineas
on conflict do nothing;

-- La vista todavía apunta a la tabla vieja, así que hay que bajarla antes
-- de borrarla y volver a crearla después.
drop view if exists v_cosechas;
drop table if exists cosecha_lineas;

-- ---------------------------------------------------------------------
-- La vista suma igual que antes: el total de pilas de todas las cargas
-- ---------------------------------------------------------------------
create view v_cosechas as
select
  c.id,
  c.fecha,
  c.estado,
  c.notas,
  c.lote_id,
  l.nombre as lote,
  c.venta_id,
  cl.nombre as comprador,
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
left join lotes l on l.id = c.lote_id
left join ventas v on v.id = c.venta_id
left join clientes cl on cl.id = v.cliente_id
left join (
  select
    cosecha_id,
    count(*) as cargas,
    sum(linea_hasta - linea_desde + 1) as lineas,
    sum(pilas) as pilas,
    max(linea_hasta) as ultima_linea
  from cosecha_cargas group by cosecha_id
) ca on ca.cosecha_id = c.id;

-- ---------------------------------------------------------------------
-- Mismas reglas de acceso que el resto
-- ---------------------------------------------------------------------
alter table cosecha_cargas enable row level security;
drop policy if exists miembros_all on cosecha_cargas;
create policy miembros_all on cosecha_cargas for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());
