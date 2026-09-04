-- =====================================================================
-- 0019 — Programas de riego
--
-- Hydrawise no deja crear ni editar programas desde afuera: su API solo
-- permite abrir y cortar una zona. Así que los programas viven acá.
--
-- Un programa es por lote y por duración: "Yapeyú, 25 minutos". Cuando
-- lo activás elegís los días de la semana y la hora de arranque, y la
-- corrida automática se encarga de ir abriendo las zonas de ese lote,
-- una atrás de la otra, ese rato cada una.
--
-- Van de a una y no todas juntas porque la bomba no da para alimentar
-- once zonas al mismo tiempo: es como trabaja cualquier controlador.
-- =====================================================================

create table if not exists riego_programas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes(id) on delete cascade,
  minutos int not null,

  activo boolean not null default false,
  -- 0 = domingo … 6 = sábado
  dias smallint[] not null default '{}',
  hora time,

  -- Para no repetir la misma zona si la corrida pasa dos veces seguidas
  ultima_fecha date,
  ultimo_indice int,

  created_at timestamptz not null default now(),
  unique (lote_id, minutos)
);

create index if not exists riego_programas_activo_idx on riego_programas (activo);

alter table riego_programas enable row level security;
drop policy if exists miembros_all on riego_programas;
create policy miembros_all on riego_programas for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

-- ---------------------------------------------------------------------
-- Los cuatro programas de cada lote, apagados
-- ---------------------------------------------------------------------
insert into riego_programas (lote_id, minutos)
select l.id, m.minutos
from lotes l
cross join (values (15), (25), (30), (45)) as m(minutos)
where l.activo
on conflict (lote_id, minutos) do nothing;
