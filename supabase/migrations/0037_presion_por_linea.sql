-- =====================================================================
-- 0037 · La presión de cada línea
--
-- Hasta acá las veinte zonas decían trabajar a 4,5 bar, que era el valor
-- por defecto de la 0034 y no un dato: nadie lo midió. Y la presión pesa
-- —un PGP rojo 12 tira 2.510 l/h a 3 bar y 3.220 a 5— así que un número
-- inventado se va derecho al balance de agua.
--
-- La bomba da entre 4 y 5 bar según la línea. Lo que hace que una línea
-- esté más cerca de 4 que de 5 es cuánta agua le está pidiendo: más
-- aspersores y picos más grandes significan más caudal por el caño, más
-- fricción y menos presión en la punta. Así que se reparte:
--
--   · la línea que MENOS pide de cada lote queda en 5,0 bar,
--   · la que MÁS pide queda en 4,0,
--   · las del medio, en proporción.
--
-- La proporción no es derecha: la pérdida de carga crece con el caudal
-- elevado a 1,85 (Hazen-Williams), o sea que las líneas grandes pierden
-- mucho más de lo que diría una regla de tres. Esa es la cuenta que va
-- abajo.
--
-- Se reparte lote por lote porque cada uno tiene su bomba y su línea
-- madre: no tiene sentido comparar una línea de Yapeyú contra una de
-- 20 de Junio.
--
-- ESTO ES UNA ESTIMACIÓN Y LA APP LO DICE. Cada zona tiene ahora su
-- presión editable y una marca de "medida", para el día que se recorra
-- el campo con un manómetro. Lo que se mida gana y no lo pisa nadie.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La ficha, leída a cualquier presión
--
-- La tabla de Hunter tiene una fila cada media atmósfera: 4,0 y 4,5 y
-- 5,0, nada en el medio. Con la presión estimada de acá abajo eso no
-- alcanza: una línea puede quedar en 4,3 y, buscando fila exacta, esa
-- zona se quedaba sin caudal y sin milímetros, en silencio.
--
-- Estas dos funciones leen la ficha entre renglones: agarran el de abajo
-- y el de arriba y sacan el proporcional. Fuera de rango devuelven el
-- extremo, sin inventar. Ojo con eso último: los picos 1 a 9 de la serie
-- roja llegan hasta 4,5 bar en la ficha, así que una línea estimada en
-- 5,0 los calcula a 4,5. Queda un poco por debajo de lo real, que es el
-- lado seguro para equivocarse.
-- ---------------------------------------------------------------------
create or replace function public.litros_hora_boquilla(
  p_modelo text,
  p_numero text,
  p_bar numeric
) returns numeric
language sql
stable
set search_path = public
as $fn$
  with filas as (
    select bar, litros_hora from boquillas
    where modelo = p_modelo and numero = p_numero
  ),
  abajo as (select * from filas where bar <= p_bar order by bar desc limit 1),
  arriba as (select * from filas where bar >= p_bar order by bar asc limit 1)
  select case
    when not exists (select 1 from abajo) then (select litros_hora from arriba)
    when not exists (select 1 from arriba) then (select litros_hora from abajo)
    when (select bar from abajo) = (select bar from arriba) then (select litros_hora from abajo)
    else (
      select round(
        a.litros_hora + (b.litros_hora - a.litros_hora) * (p_bar - a.bar) / (b.bar - a.bar),
        1
      )
      from abajo a, arriba b
    )
  end;
$fn$;

comment on function public.litros_hora_boquilla(text, text, numeric) is
  'Litros por hora de un pico a la presión que se le pida, interpolando la ficha.';

create or replace function public.radio_boquilla(
  p_modelo text,
  p_numero text,
  p_bar numeric
) returns numeric
language sql
stable
set search_path = public
as $fn$
  with filas as (
    select bar, radio_m from boquillas
    where modelo = p_modelo and numero = p_numero and radio_m is not null
  ),
  abajo as (select * from filas where bar <= p_bar order by bar desc limit 1),
  arriba as (select * from filas where bar >= p_bar order by bar asc limit 1)
  select case
    when not exists (select 1 from abajo) then (select radio_m from arriba)
    when not exists (select 1 from arriba) then (select radio_m from abajo)
    when (select bar from abajo) = (select bar from arriba) then (select radio_m from abajo)
    else (
      select round(a.radio_m + (b.radio_m - a.radio_m) * (p_bar - a.bar) / (b.bar - a.bar), 1)
      from abajo a, arriba b
    )
  end;
$fn$;

comment on function public.radio_boquilla(text, text, numeric) is
  'Alcance de un pico a la presión que se le pida, interpolando la ficha.';

-- ---------------------------------------------------------------------
-- 2. Estimada o medida
-- ---------------------------------------------------------------------
alter table riego_zonas
  add column if not exists presion_medida boolean not null default false;

comment on column riego_zonas.presion_medida is
  'true = la midió alguien con manómetro. false = la estimó la app por el caudal de la línea.';

comment on column riego_zonas.presion_bar is
  'A cuántos bar trabaja esta línea. Define qué parte de la ficha se usa.';

-- ---------------------------------------------------------------------
-- 3. La presión estimada de cada línea
--
-- Solo toca las que nadie midió. La demanda de cada línea se mide contra
-- la ficha a 4,5 bar —el valor nominal— para tener a todas en la misma
-- vara; si se usara la presión de cada una, la cuenta se mordería la
-- cola.
--
-- Una línea sola en su lote no tiene contra qué compararse: queda en
-- 4,5, que es el medio del rango.
-- ---------------------------------------------------------------------
with demanda as (
  select
    z.id as zona_id,
    z.lote_id,
    sum(za.cantidad * b.litros_hora) as litros_hora
  from riego_zonas z
  join zona_aspersores za on za.zona_id = z.id and za.cantidad > 0
  join boquillas b
    on b.modelo = za.modelo and b.numero = za.numero and b.bar = 4.5
  where z.lote_id is not null
  group by z.id, z.lote_id
),
rango as (
  select
    zona_id,
    litros_hora,
    min(litros_hora) over (partition by lote_id) as menor,
    max(litros_hora) over (partition by lote_id) as mayor
  from demanda
)
update riego_zonas z
set presion_bar = case
  -- Sin rango (una sola línea en el lote, o todas iguales): el medio.
  when r.mayor = r.menor then 4.5
  else round(
    (
      5.0 - (
        (power(r.litros_hora, 1.85) - power(r.menor, 1.85))
        / (power(r.mayor, 1.85) - power(r.menor, 1.85))
      )
    )::numeric,
    1
  )
end
from rango r
where r.zona_id = z.id
  and z.presion_medida = false;

-- ---------------------------------------------------------------------
-- 4. El caudal, ahora leyendo la ficha entre renglones
--
-- Igual que en la 0034, salvo por dos cosas: los litros salen de la
-- función y no de un join exacto por presión, y la vista dice si la
-- presión que usó es medida o estimada.
--
-- Va borrada y hecha de nuevo, no reemplazada: la columna nueva entra en
-- el medio y Postgres solo deja agregar columnas al final de una vista
-- que ya existe.
-- ---------------------------------------------------------------------
drop view if exists v_caudal_zonas;

create view v_caudal_zonas as
with reparto as (
  select
    z.id as zona_id,
    l.superficie_m2 as lote_m2,
    sum(za.cantidad) over (partition by z.id) as asp_zona,
    sum(za.cantidad) over (partition by z.lote_id) as asp_lote
  from riego_zonas z
  join zona_aspersores za on za.zona_id = z.id
  left join lotes l on l.id = z.lote_id
),
areas as (
  select
    zona_id,
    case
      when lote_m2 is null or asp_lote is null or asp_lote = 0 then null
      else round((lote_m2 * asp_zona / asp_lote)::numeric, 1)
    end as m2_repartidos
  from reparto
  group by zona_id, lote_m2, asp_zona, asp_lote
),
caudal as (
  select
    za.zona_id,
    sum(za.cantidad)::int as aspersores,
    sum(za.cantidad * pico.litros) as litros_hora,
    max(pico.radio) as radio_max,
    count(*) filter (where pico.litros is null) as sin_ficha
  from zona_aspersores za
  join riego_zonas rz on rz.id = za.zona_id
  left join lateral (
    select
      public.litros_hora_boquilla(za.modelo, za.numero, coalesce(rz.presion_bar, 4.5)) as litros,
      public.radio_boquilla(za.modelo, za.numero, coalesce(rz.presion_bar, 4.5)) as radio
  ) pico on true
  where za.cantidad > 0
  group by za.zona_id
)
select
  z.id as zona_id,
  z.nombre,
  z.lote_id,
  coalesce(z.presion_bar, 4.5) as presion_bar,
  z.presion_medida,
  coalesce(z.superficie_m2, a.m2_repartidos) as superficie_m2,
  z.superficie_m2 is not null as superficie_medida,
  coalesce(c.aspersores, 0)::int as aspersores,
  c.litros_hora,
  c.radio_max,
  coalesce(c.sin_ficha, 0)::int as picos_sin_ficha,
  case
    when c.sin_ficha > 0 or c.litros_hora is null then null
    when coalesce(z.superficie_m2, a.m2_repartidos) is null then null
    when coalesce(z.superficie_m2, a.m2_repartidos) <= 0 then null
    else round((c.litros_hora / coalesce(z.superficie_m2, a.m2_repartidos))::numeric, 2)
  end as mm_por_hora_calculado,
  z.mm_por_hora as mm_por_hora_manual
from riego_zonas z
left join caudal c on c.zona_id = z.id
left join areas a on a.zona_id = z.id;

comment on view v_caudal_zonas is
  'El mm/hora de cada zona, salido de sus aspersores, su presión y su parte del lote.';
