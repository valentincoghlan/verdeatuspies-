-- =====================================================================
-- 0025 — Qué avisos quiere recibir cada uno
--
-- Los avisos llegan al celular de cada persona, así que la decisión es
-- de cada una: a Valentín le puede interesar que le avisen cuando
-- arranca un riego y a Miguel no.
--
-- Se guarda lo APAGADO y no lo prendido: así, cuando sumemos un aviso
-- nuevo, empieza encendido para todos sin tener que tocar nada.
-- =====================================================================

alter table perfiles
  add column if not exists avisos_apagados text[] not null default '{}';

comment on column perfiles.avisos_apagados is
  'Tipos de aviso que esta persona NO quiere recibir en el celular.';
