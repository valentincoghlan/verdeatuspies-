-- ---------------------------------------------------------------------
-- 0033 · La lluvia se carga sola, y se confirma después
--
-- Hasta hoy la lluvia entraba solo a mano: llegaba una alerta que
-- preguntaba "¿llovió?" y había que escribir los milímetros. Si nadie
-- contestaba, ese día quedaba en cero para el balance de agua, aunque
-- hubieran caído treinta milímetros.
--
-- Ahora Open-Meteo la carga sola apenas pasa el día —el mismo dato que
-- ya se guardaba en clima_dias, pero anotado como lluvia de verdad— y
-- queda en estado "del pronóstico". Cuando mirás el pluviómetro la
-- confirmás o la corregís, y pasa a "confirmada".
--
-- Los dos estados importan: el pronóstico de Open-Meteo es una grilla de
-- varios kilómetros y el pluviómetro está en el campo. Sirve para no
-- tener el balance en cero, no para reemplazar la medición.
-- ---------------------------------------------------------------------

alter table lluvias
  add column if not exists confirmada boolean not null default true;

comment on column lluvias.confirmada is
  'true = alguien la miró. false = vino sola del pronóstico y falta confirmar.';

-- Lo que ya estaba cargado lo cargó una persona, así que va confirmado.
update lluvias set confirmada = true where confirmada is null;

-- El origen suma 'automatica': la que entra sola cuando pasa el día.
alter table lluvias drop constraint if exists lluvias_origen_check;
alter table lluvias add constraint lluvias_origen_check
  check (origen in ('manual', 'confirmada_alerta', 'automatica'));

-- Una lluvia automática que después se confirma cambia de mm: conviene
-- poder buscarlas rápido.
create index if not exists lluvias_sin_confirmar_idx
  on lluvias (confirmada, fecha desc)
  where confirmada = false;
