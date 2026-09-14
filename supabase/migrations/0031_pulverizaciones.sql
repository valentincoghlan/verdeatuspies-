-- ---------------------------------------------------------------------
-- 0031 · Lo que se pulverizó, anotado
--
-- La calculadora de pulverización decía cuánto producto cargar, pero no
-- dejaba rastro: una vez que bajabas del tractor, lo aplicado vivía en
-- la memoria. Sin historial no hay forma de saber cuándo fue la última
-- vez que se pasó un producto por un lote, que es justo el dato que
-- hace falta antes de repetirlo.
--
-- El producto va como texto y no como tabla aparte: son pocos y cambian
-- seguido, y una tabla de catálogo obliga a dar de alta cada bidón nuevo
-- antes de poder anotar la pasada. El formulario ofrece los que ya se
-- usaron, así el nombre no se escribe distinto cada vez.
--
-- La unidad se guarda escrita tal como se lee ('l/ha', 'cc/100L'): el
-- historial se muestra sin traducir nada.
-- ---------------------------------------------------------------------

create table if not exists pulverizaciones (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  lote_id uuid not null references lotes(id) on delete cascade,
  producto text not null,
  dosis numeric(12,3),
  unidad text not null default 'l/ha',
  superficie_ha numeric(10,2),
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pulverizaciones_fecha_idx on pulverizaciones (fecha desc);
create index if not exists pulverizaciones_lote_idx on pulverizaciones (lote_id, fecha desc);

-- ---------------------------------------------------------------------
-- La tabla nueva juega con las mismas reglas que el resto
-- ---------------------------------------------------------------------
alter table pulverizaciones enable row level security;
drop policy if exists miembros_all on pulverizaciones;
create policy miembros_all on pulverizaciones
  for all to authenticated
  using (public.es_miembro())
  with check (public.es_miembro());
