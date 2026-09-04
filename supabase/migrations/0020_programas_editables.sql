-- =====================================================================
-- 0020 — Los programas se crean, se editan y se borran
--
-- Los ocho primeros salieron de un molde (15/25/30/45 por lote), pero
-- son programas como cualquier otro: hay que poder cambiarles la
-- duración, ponerles nombre, sumar otros y borrar los que no van.
--
-- Se cae la restricción de "una sola duración por lote": tiene sentido
-- tener dos programas de 25 minutos en el mismo lote, uno para los días
-- de semana temprano y otro para el fin de semana.
-- =====================================================================

alter table riego_programas
  drop constraint if exists riego_programas_lote_id_minutos_key;

alter table riego_programas
  add column if not exists nombre text;

-- Los que ya están se nombran solos, para que la lista se lea igual.
update riego_programas
set nombre = minutos || ' min por zona'
where nombre is null;
