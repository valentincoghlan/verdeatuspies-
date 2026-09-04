-- =====================================================================
-- 0022 — Avisos al celular
--
-- Cada teléfono que acepta recibir avisos deja acá su "dirección": una
-- URL que el navegador genera y dos claves para cifrar el mensaje. Sin
-- eso no hay a dónde mandar la notificación.
--
-- Una persona puede tener varios teléfonos, y un teléfono deja de servir
-- cuando se desinstala la app o se revoca el permiso: por eso el
-- endpoint es único y las que fallan se borran solas.
-- =====================================================================

create table if not exists push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references perfiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparato text,
  created_at timestamptz not null default now()
);

alter table push_suscripciones enable row level security;
drop policy if exists miembros_all on push_suscripciones;
create policy miembros_all on push_suscripciones for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());
