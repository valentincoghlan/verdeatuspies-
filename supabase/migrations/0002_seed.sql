-- =====================================================================
-- Datos iniciales. Editá los mails del equipo antes de correrlo.
-- =====================================================================

insert into miembros_habilitados (email, nombre, rol) values
  ('valentin@sens.lat', 'Valentín', 'admin')
  -- ('socio2@mail.com', 'Socio 2', 'admin'),
  -- ('socio3@mail.com', 'Socio 3', 'operador')
on conflict (email) do nothing;

insert into lotes (nombre, superficie_m2, dias_objetivo_corte) values
  ('20 de Junio', null, 14),
  ('Yapeyú', null, 14)
on conflict (nombre) do nothing;

insert into fertilizantes (nombre, tipo, unidad, dosis_por_ha) values
  ('Urea 46%', 'nitrogenado', 'kg', 150),
  ('Fosfato diamónico (DAP)', 'fosforado', 'kg', 120),
  ('Sulfato de amonio', 'nitrogenado azufrado', 'kg', 200),
  ('NPK 15-15-15', 'completo', 'kg', 250),
  ('Nitrato de calcio', 'nitrogenado cálcico', 'kg', 100)
on conflict (nombre) do nothing;

insert into config (clave, valor) values
  ('ubicacion', '{"nombre": "Cardales", "lat": -34.3167, "lon": -58.9667}'::jsonb),
  ('umbral_lluvia_mm', '2'::jsonb),
  ('aviso_fertilizacion_dias', '3'::jsonb),
  ('hydrawise_api_key', '""'::jsonb),
  ('precio_m2_default', '0'::jsonb)
on conflict (clave) do nothing;
