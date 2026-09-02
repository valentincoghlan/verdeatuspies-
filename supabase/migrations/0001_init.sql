-- =====================================================================
-- Verde A Tus Pies — esquema inicial
-- Ejecutar en Supabase (SQL Editor) una sola vez.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Usuarios y permisos
-- ---------------------------------------------------------------------

-- Mails habilitados a entrar. Cargá acá los 3 mails del equipo ANTES
-- de que se registren (o después: al primer login se activan solos).
create table if not exists miembros_habilitados (
  email text primary key,
  nombre text,
  rol text not null default 'operador' check (rol in ('admin', 'operador')),
  created_at timestamptz not null default now()
);

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  rol text not null default 'operador' check (rol in ('admin', 'operador')),
  activo boolean not null default false,
  notificar_mail boolean not null default true,
  created_at timestamptz not null default now()
);

-- Al crearse un usuario en auth, se genera su perfil. Queda activo solo
-- si su mail está en miembros_habilitados.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  m record;
begin
  select * into m from miembros_habilitados where lower(email) = lower(new.email);

  insert into perfiles (id, email, nombre, rol, activo)
  values (
    new.id,
    new.email,
    coalesce(m.nombre, split_part(new.email, '@', 1)),
    coalesce(m.rol, 'operador'),
    m.email is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿El que consulta es miembro activo?
create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and activo
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and activo and rol = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Configuración general (clave/valor)
-- ---------------------------------------------------------------------
create table if not exists config (
  clave text primary key,
  valor jsonb not null,
  actualizado_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Campo: lotes y zonas de riego
-- ---------------------------------------------------------------------
create table if not exists lotes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  superficie_m2 numeric(12,2),
  notas text,
  activo boolean not null default true,
  dias_objetivo_corte int not null default 14,
  created_at timestamptz not null default now()
);

create table if not exists riego_zonas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid references lotes(id) on delete set null,
  nombre text not null,
  hydrawise_relay_id text,
  hydrawise_controller_id text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hydrawise_controller_id, hydrawise_relay_id)
);

-- ---------------------------------------------------------------------
-- Mantenimiento: riego
-- ---------------------------------------------------------------------
create table if not exists riegos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid references lotes(id) on delete set null,
  zona_id uuid references riego_zonas(id) on delete set null,
  fecha date not null,
  hora time,
  minutos int,
  mm numeric(6,2),
  origen text not null default 'manual' check (origen in ('manual', 'hydrawise')),
  hydrawise_key text unique,
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists riegos_fecha_idx on riegos (fecha desc);

-- Snapshots crudos de Hydrawise, para auditar el sync
create table if not exists hydrawise_snapshots (
  id bigserial primary key,
  payload jsonb not null,
  creados int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Mantenimiento: cortes de pasto
-- ---------------------------------------------------------------------
create table if not exists cortes (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes(id) on delete cascade,
  fecha date not null,
  altura_mm int,
  superficie_m2 numeric(12,2),
  horas_maquina numeric(6,2),
  responsable_id uuid references perfiles(id) on delete set null,
  responsable_texto text,
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cortes_fecha_idx on cortes (fecha desc);

-- ---------------------------------------------------------------------
-- Mantenimiento: fertilizantes y fertilizaciones
-- ---------------------------------------------------------------------
create table if not exists fertilizantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text,
  unidad text not null default 'kg',
  dosis_por_ha numeric(10,2),
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists fertilizaciones (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references lotes(id) on delete cascade,
  fertilizante_id uuid references fertilizantes(id) on delete set null,
  fecha_programada date not null,
  fecha_aplicada date,
  dosis numeric(10,2),
  unidad text default 'kg',
  superficie_m2 numeric(12,2),
  costo numeric(14,2),
  estado text not null default 'programada' check (estado in ('programada', 'aplicada', 'cancelada')),
  responsable_id uuid references perfiles(id) on delete set null,
  notas text,
  aviso_mail_enviado_at timestamptz,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fertilizaciones_prog_idx on fertilizaciones (fecha_programada);

-- ---------------------------------------------------------------------
-- Mantenimiento: lluvias y clima
-- ---------------------------------------------------------------------
create table if not exists lluvias (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  mm numeric(6,2) not null,
  lote_id uuid references lotes(id) on delete set null,
  origen text not null default 'manual' check (origen in ('manual', 'confirmada_alerta')),
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (fecha, lote_id)
);
create index if not exists lluvias_fecha_idx on lluvias (fecha desc);

-- Cache diario de Open-Meteo para Cardales
create table if not exists clima_dias (
  fecha date primary key,
  precipitacion_mm numeric(6,2),
  prob_precipitacion int,
  temp_max numeric(5,2),
  temp_min numeric(5,2),
  et0_mm numeric(6,2),
  viento_max numeric(6,2),
  es_pronostico boolean not null default true,
  actualizado_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'particular' check (tipo in ('particular', 'empresa', 'paisajista', 'vivero', 'otro')),
  telefono text,
  email text,
  direccion text,
  localidad text,
  cuit text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists clientes_nombre_idx on clientes (lower(nombre));

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  lote_id uuid references lotes(id) on delete set null,
  fecha date not null,
  fecha_entrega date,
  m2 numeric(12,2) not null,
  precio_m2 numeric(12,2) not null,
  flete numeric(14,2) not null default 0,
  total numeric(16,2) generated always as (round(m2 * precio_m2 + flete, 2)) stored,
  estado text not null default 'confirmada' check (estado in ('presupuesto', 'confirmada', 'entregada', 'anulada')),
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ventas_fecha_idx on ventas (fecha desc);
create index if not exists ventas_cliente_idx on ventas (cliente_id);

-- ---------------------------------------------------------------------
-- Administración: cobros y pagos
-- ---------------------------------------------------------------------
create table if not exists cobros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  venta_id uuid references ventas(id) on delete set null,
  fecha date not null,
  monto numeric(14,2) not null,
  medio text not null default 'transferencia' check (medio in ('efectivo', 'transferencia', 'cheque', 'mercadopago', 'otro')),
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cobros_fecha_idx on cobros (fecha desc);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  monto numeric(14,2) not null,
  categoria text not null default 'otro' check (categoria in ('insumos', 'fertilizante', 'combustible', 'mano_de_obra', 'maquinaria', 'flete', 'impuestos', 'servicios', 'otro')),
  proveedor text,
  medio text not null default 'transferencia' check (medio in ('efectivo', 'transferencia', 'cheque', 'mercadopago', 'otro')),
  lote_id uuid references lotes(id) on delete set null,
  fertilizacion_id uuid references fertilizaciones(id) on delete set null,
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pagos_fecha_idx on pagos (fecha desc);

-- ---------------------------------------------------------------------
-- Notificaciones / alertas in-app
-- ---------------------------------------------------------------------
create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  mensaje text,
  severidad text not null default 'info' check (severidad in ('info', 'aviso', 'urgente')),
  entidad_tipo text,
  entidad_id uuid,
  fecha_referencia date,
  requiere_accion boolean not null default false,
  accion_url text,
  resuelta boolean not null default false,
  resuelta_por uuid references perfiles(id) on delete set null,
  resuelta_at timestamptz,
  clave_unica text unique,
  mail_enviado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notificaciones_abiertas_idx on notificaciones (resuelta, created_at desc);

-- ---------------------------------------------------------------------
-- Vistas de reporte
-- ---------------------------------------------------------------------
create or replace view v_cuenta_clientes as
select
  c.id as cliente_id,
  c.nombre,
  coalesce(v.total_vendido, 0) as total_vendido,
  coalesce(v.m2_vendidos, 0) as m2_vendidos,
  coalesce(co.total_cobrado, 0) as total_cobrado,
  coalesce(v.total_vendido, 0) - coalesce(co.total_cobrado, 0) as saldo,
  v.ultima_venta
from clientes c
left join (
  select cliente_id, sum(total) as total_vendido, sum(m2) as m2_vendidos, max(fecha) as ultima_venta
  from ventas where estado <> 'anulada' group by cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total_cobrado from cobros group by cliente_id
) co on co.cliente_id = c.id;

create or replace view v_ventas_por_mes as
select
  date_trunc('month', fecha)::date as mes,
  sum(m2) as m2,
  sum(total) as total,
  count(*) as operaciones
from ventas
where estado <> 'anulada'
group by 1
order by 1;

create or replace view v_estado_lotes as
select
  l.id as lote_id,
  l.nombre,
  l.superficie_m2,
  l.dias_objetivo_corte,
  (select max(fecha) from cortes c where c.lote_id = l.id) as ultimo_corte,
  (select max(fecha) from riegos r where r.lote_id = l.id) as ultimo_riego,
  (select max(fecha_aplicada) from fertilizaciones f where f.lote_id = l.id and f.estado = 'aplicada') as ultima_fertilizacion,
  (select min(fecha_programada) from fertilizaciones f where f.lote_id = l.id and f.estado = 'programada' and f.fecha_programada >= current_date) as proxima_fertilizacion
from lotes l
where l.activo;

-- ---------------------------------------------------------------------
-- RLS: solo miembros activos, acceso completo a todo
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tablas text[] := array[
    'config', 'lotes', 'riego_zonas', 'riegos', 'hydrawise_snapshots',
    'cortes', 'fertilizantes', 'fertilizaciones', 'lluvias', 'clima_dias',
    'clientes', 'ventas', 'cobros', 'pagos', 'notificaciones'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists miembros_all on %I', t);
    execute format(
      'create policy miembros_all on %I for all to authenticated using (public.es_miembro()) with check (public.es_miembro())',
      t
    );
  end loop;
end $$;

alter table perfiles enable row level security;
drop policy if exists perfiles_select on perfiles;
create policy perfiles_select on perfiles for select to authenticated using (public.es_miembro() or id = auth.uid());
drop policy if exists perfiles_update_propio on perfiles;
create policy perfiles_update_propio on perfiles for update to authenticated using (id = auth.uid() or public.es_admin()) with check (id = auth.uid() or public.es_admin());

alter table miembros_habilitados enable row level security;
drop policy if exists miembros_hab_admin on miembros_habilitados;
create policy miembros_hab_admin on miembros_habilitados for all to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists miembros_hab_read on miembros_habilitados;
create policy miembros_hab_read on miembros_habilitados for select to authenticated using (public.es_miembro());
