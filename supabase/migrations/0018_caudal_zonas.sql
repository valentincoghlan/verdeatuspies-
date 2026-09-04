-- =====================================================================
-- 0018 — Cuánta agua tira cada zona
--
-- Los riegos se registran en minutos, pero el balance del campo se mide
-- en milímetros: es la única unidad que se puede comparar con la lluvia
-- y con lo que el pasto pierde por día (ET₀).
--
-- Con el caudal de cada zona (mm por hora de riego) la app convierte
-- sola: 20 minutos a 12 mm/h son 4 mm. Mientras esté vacío, el riego
-- queda anotado en minutos y no suma al balance.
--
-- El número sale de la prueba del vaso: ponés varios recipientes rectos
-- en la zona, regás 15 minutos, medís los milímetros que juntó cada uno,
-- promediás y multiplicás por 4.
-- =====================================================================

alter table riego_zonas
  add column if not exists mm_por_hora numeric(6,2);

comment on column riego_zonas.mm_por_hora is
  'Milímetros de agua por hora de riego. Sirve para pasar minutos a mm.';
