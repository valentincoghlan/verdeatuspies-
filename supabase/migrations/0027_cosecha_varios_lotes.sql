-- ---------------------------------------------------------------------
-- 0027 · Una cosecha puede salir de los dos lotes
--
-- Hasta hoy cada cosecha guardaba un solo lote, más una opción "Sin
-- definir" que se usaba justamente cuando se cortaba de los dos. Eso
-- perdía el dato: la cosecha existía pero no se sabía de dónde salió.
--
-- Ahora los lotes de una cosecha van en su propia tabla, uno por fila.
-- Con eso una cosecha puede tener uno, dos o los que vengan, y "Sin
-- definir" desaparece: el lote pasa a ser obligatorio.
--
-- `cosechas.lote_id` se deja donde está y se sigue escribiendo con el
-- primer lote elegido. No lo lee nadie más que esta vista, pero sacarlo
-- obligaría a tocar la tabla y no gana nada.
-- ---------------------------------------------------------------------

create table if not exists cosechas_lotes (
  cosecha_id uuid not null references cosechas(id) on delete cascade,
  lote_id uuid not null references lotes(id) on delete cascade,
  primary key (cosecha_id, lote_id)
);
create index if not exists cosechas_lotes_lote_idx on cosechas_lotes (lote_id);

-- Lo que ya estaba cargado pasa a la tabla nueva tal cual.
insert into cosechas_lotes (cosecha_id, lote_id)
select id, lote_id from cosechas where lote_id is not null
on conflict do nothing;

alter table cosechas_lotes enable row level security;
drop policy if exists miembros_all on cosechas_lotes;
create policy miembros_all on cosechas_lotes
  for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

-- ---------------------------------------------------------------------
-- La vista arma el nombre de los lotes: "20 de Junio + Yapeyú"
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
left join (
  select
    cxl.cosecha_id,
    string_agg(l.nombre, ' + ' order by l.nombre) as nombres,
    count(*)::int as cuantos
  from cosechas_lotes cxl
  join lotes l on l.id = cxl.lote_id
  group by cxl.cosecha_id
) lo on lo.cosecha_id = c.id
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
