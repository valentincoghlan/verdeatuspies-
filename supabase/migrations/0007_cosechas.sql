-- =====================================================================
-- 0007 — Contador de cosecha
--
-- Se cosecha por líneas. En cada línea se van cortando panes de pasto y
-- se apilan de a dos. Contando pilas se sabe cuántos m² van cortados.
--
--   panes necesarios = objetivo m² / (largo x ancho del pan)
--   pilas necesarias = panes / panes por pila
--
-- Las medidas del pan se guardan EN CADA cosecha, no solo en Ajustes:
-- si cambia la máquina o el corte, las cosechas viejas siguen bien
-- calculadas con la medida que tenían ese día.
-- =====================================================================

create table if not exists cosechas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  lote_id uuid references lotes(id) on delete set null,
  venta_id uuid references ventas(id) on delete set null,
  objetivo_m2 numeric(12,2) not null,
  pan_largo_m numeric(5,3) not null default 0.62,
  pan_ancho_m numeric(5,3) not null default 0.40,
  panes_por_pila int not null default 2 check (panes_por_pila > 0),
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cosechas_fecha_idx on cosechas (fecha desc);
create index if not exists cosechas_estado_idx on cosechas (estado);

create table if not exists cosecha_lineas (
  id uuid primary key default gen_random_uuid(),
  cosecha_id uuid not null references cosechas(id) on delete cascade,
  numero int not null,
  pilas int not null default 0 check (pilas >= 0),
  notas text,
  created_at timestamptz not null default now(),
  unique (cosecha_id, numero)
);
create index if not exists cosecha_lineas_idx on cosecha_lineas (cosecha_id, numero);

-- ---------------------------------------------------------------------
-- Avance de cada cosecha: lo que falta y lo que ya se cortó
-- ---------------------------------------------------------------------
create or replace view v_cosechas as
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
  coalesce(li.lineas, 0)::int as lineas,
  coalesce(li.pilas, 0)::int as pilas_cargadas,
  (coalesce(li.pilas, 0) * c.panes_por_pila)::int as panes_cargados,
  round(coalesce(li.pilas, 0) * c.panes_por_pila * c.pan_largo_m * c.pan_ancho_m, 2) as m2_cosechados
from cosechas c
left join lotes l on l.id = c.lote_id
left join ventas v on v.id = c.venta_id
left join clientes cl on cl.id = v.cliente_id
left join (
  select cosecha_id, count(*) as lineas, sum(pilas) as pilas
  from cosecha_lineas group by cosecha_id
) li on li.cosecha_id = c.id;

-- ---------------------------------------------------------------------
-- Las dos tablas nuevas juegan con las mismas reglas que el resto
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['cosechas', 'cosecha_lineas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists miembros_all on %I', t);
    execute format(
      'create policy miembros_all on %I for all to authenticated using (public.es_miembro()) with check (public.es_miembro())',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Medida por defecto del pan, editable en Ajustes
-- ---------------------------------------------------------------------
insert into config (clave, valor) values
  ('pan_largo_m', '0.62'::jsonb),
  ('pan_ancho_m', '0.40'::jsonb),
  ('panes_por_pila', '2'::jsonb)
on conflict (clave) do nothing;
