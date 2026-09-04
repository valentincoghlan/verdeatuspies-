-- =====================================================================
-- 0021 — Los riegos programados vuelven a Hydrawise
--
-- Los programas se cargan en el controlador, que es hardware y no
-- depende de que nadie lo despierte. La app deja de intentar hacer de
-- reloj y pasa a hacer lo que sí puede hacer bien:
--
--   · mostrar qué va a regar cada zona y cuándo,
--   · traducir esos minutos a milímetros con el caudal de la zona,
--   · cancelar los riegos hasta el día y la hora que se le diga.
--
-- Los tres datos los trae la corrida de sincronización y quedan guardados
-- acá, para no consultarle a Hunter en cada carga de página.
-- =====================================================================

alter table riego_zonas
  add column if not exists proximo_riego_at timestamptz,
  add column if not exists proximo_minutos int,
  add column if not exists suspendida_hasta timestamptz;

comment on column riego_zonas.proximo_riego_at is
  'Cuándo riega esta zona la próxima vez, según el programa del controlador.';
comment on column riego_zonas.suspendida_hasta is
  'Hasta cuándo están cancelados los riegos programados de esta zona.';

-- ---------------------------------------------------------------------
-- Se van los programas propios
--
-- Fueron un intento de programar desde la app. Necesitaban un disparador
-- externo cada pocos minutos y, si ese disparador fallaba, se perdían
-- riegos. El controlador hace lo mismo sin depender de nada.
-- ---------------------------------------------------------------------
drop table if exists riego_programas;
