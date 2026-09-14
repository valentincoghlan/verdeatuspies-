-- ---------------------------------------------------------------------
-- 0034 · La ficha de boquillas, ahora sí
--
-- La 0032 quedó escrita en el repo pero nunca llegó a correr: en la base
-- había una versión anterior y más simple, con otro diseño. Las dos
-- tablas se llamaban igual y por eso el `create table if not exists` de
-- la 0032 no hizo nada.
--
-- Lo que había:
--   · boquillas(id, modelo, numero, litros_hora, notas) — 7 filas, y las
--     siete con litros_hora en null.
--   · zona_aspersores(zona_id, boquilla_id, cantidad).
--   · riego_zonas sin presion_bar.
--
-- Con litros_hora vacío ninguna zona podía calcular su caudal: el
-- inventario estaba bien cargado —120 aspersores, los mismos que acá—
-- pero no había con qué convertirlo en agua.
--
-- Lo que falta es la presión. Un PGP rojo 12 tira 2.510 l/h a 3 bar y
-- 3.220 a 5 bar: un 28% de diferencia que se va derecho al balance de
-- agua. Por eso la ficha va con una fila por pico Y por presión, y cada
-- zona declara a cuántos bar trabaja su línea.
--
-- Se borra lo viejo y se rehace. No se pierde nada: el inventario de los
-- 120 aspersores se vuelve a cargar más abajo, y las boquillas viejas no
-- tenían ningún dato adentro.
-- ---------------------------------------------------------------------

drop view if exists v_caudal_zonas;
drop table if exists zona_aspersores;
drop table if exists boquillas;

-- ---------------------------------------------------------------------
-- 1. La ficha del fabricante
--
-- Hunter PGP. Son dos series distintas y en el campo hay de las dos:
-- las ROJAS van numeradas 1 a 12 y son casi todas; la AZUL va de 1.5 a
-- 8.0 y hay una sola, la del PGP Ultra de la Zona 9. No son
-- intercambiables: el azul 8.0 tira 2.220 l/h y el rojo 8, 1.050.
--
-- Va la tabla entera, con una fila por pico y por presión, porque la
-- bomba no da lo mismo en todas las líneas: entre 4 y 5 bar según cuál.
--
-- Fuente: Hunter PGP Blue vs Red Nozzle Performance Chart, LIT-408,
-- datos métricos. Es editable: si algún día se mide distinto, se corrige.
-- ---------------------------------------------------------------------
create table if not exists boquillas (
  id uuid primary key default gen_random_uuid(),
  modelo text not null default 'PGP rojo',
  numero text not null,
  bar numeric(3,1) not null,
  litros_hora numeric(8,1) not null,
  radio_m numeric(4,1),
  unique (modelo, numero, bar)
);

comment on table boquillas is
  'Ficha del fabricante: litros por hora de cada pico a cada presión.';

alter table boquillas enable row level security;
drop policy if exists miembros_all on boquillas;
create policy miembros_all on boquillas for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

insert into boquillas (modelo, numero, bar, litros_hora, radio_m) values
  ('PGP rojo','1',1.7,100,8.2),('PGP rojo','1',2.0,110,8.5),('PGP rojo','1',2.5,130,8.5),
  ('PGP rojo','1',3.0,150,8.8),('PGP rojo','1',3.5,160,8.8),('PGP rojo','1',4.0,180,9.1),
  ('PGP rojo','1',4.5,190,9.1),
  ('PGP rojo','2',1.7,140,8.5),('PGP rojo','2',2.0,160,8.8),('PGP rojo','2',2.5,170,8.8),
  ('PGP rojo','2',3.0,190,9.1),('PGP rojo','2',3.5,210,9.1),('PGP rojo','2',4.0,220,9.4),
  ('PGP rojo','2',4.5,230,9.4),
  ('PGP rojo','3',1.7,180,8.8),('PGP rojo','3',2.0,200,9.1),('PGP rojo','3',2.5,220,9.1),
  ('PGP rojo','3',3.0,250,9.4),('PGP rojo','3',3.5,270,9.4),('PGP rojo','3',4.0,290,9.8),
  ('PGP rojo','3',4.5,310,9.8),
  ('PGP rojo','4',1.7,240,9.4),('PGP rojo','4',2.0,270,9.8),('PGP rojo','4',2.5,300,9.8),
  ('PGP rojo','4',3.0,340,10.1),('PGP rojo','4',3.5,370,10.1),('PGP rojo','4',4.0,400,10.4),
  ('PGP rojo','4',4.5,430,10.4),
  ('PGP rojo','5',1.7,330,10.1),('PGP rojo','5',2.0,360,10.4),('PGP rojo','5',2.5,390,10.4),
  ('PGP rojo','5',3.0,430,11.0),('PGP rojo','5',3.5,460,11.6),('PGP rojo','5',4.0,490,11.6),
  ('PGP rojo','5',4.5,510,11.6),
  ('PGP rojo','6',1.7,420,10.1),('PGP rojo','6',2.0,450,10.4),('PGP rojo','6',2.5,510,10.7),
  ('PGP rojo','6',3.0,570,11.0),('PGP rojo','6',3.5,610,11.6),('PGP rojo','6',4.0,660,11.6),
  ('PGP rojo','6',4.5,700,11.9),
  ('PGP rojo','7',1.7,540,10.1),('PGP rojo','7',2.0,580,10.4),('PGP rojo','7',2.5,650,11.0),
  ('PGP rojo','7',3.0,720,11.6),('PGP rojo','7',3.5,780,12.2),('PGP rojo','7',4.0,830,12.2),
  ('PGP rojo','7',4.5,880,12.2),
  ('PGP rojo','8',1.7,660,11.0),('PGP rojo','8',2.0,710,11.3),('PGP rojo','8',2.5,790,11.6),
  ('PGP rojo','8',3.0,870,11.9),('PGP rojo','8',3.5,940,12.5),('PGP rojo','8',4.0,1000,12.5),
  ('PGP rojo','8',4.5,1050,12.8),
  ('PGP rojo','9',1.7,730,11.3),('PGP rojo','9',2.0,800,11.6),('PGP rojo','9',2.5,920,11.6),
  ('PGP rojo','9',3.0,1050,12.5),('PGP rojo','9',3.5,1150,13.4),('PGP rojo','9',4.0,1250,13.4),
  ('PGP rojo','9',4.5,1350,13.7),
  ('PGP rojo','10',2.0,1140,12.2),('PGP rojo','10',2.5,1290,12.8),('PGP rojo','10',3.0,1440,13.4),
  ('PGP rojo','10',3.5,1560,14.0),('PGP rojo','10',4.0,1680,14.3),('PGP rojo','10',4.5,1790,14.3),
  ('PGP rojo','10',5.0,1900,14.6),
  ('PGP rojo','11',2.0,1550,12.8),('PGP rojo','11',2.5,1730,13.7),('PGP rojo','11',3.0,1900,14.0),
  ('PGP rojo','11',3.5,2050,14.6),('PGP rojo','11',4.0,2180,14.9),('PGP rojo','11',4.5,2300,15.2),
  ('PGP rojo','11',5.0,2420,15.5),
  ('PGP rojo','12',2.0,2030,12.8),('PGP rojo','12',2.5,2260,13.4),('PGP rojo','12',3.0,2510,14.3),
  ('PGP rojo','12',3.5,2700,14.6),('PGP rojo','12',4.0,2880,14.9),('PGP rojo','12',4.5,3060,15.2),
  ('PGP rojo','12',5.0,3220,15.8)
on conflict (modelo, numero, bar) do nothing;

-- La serie azul. En el campo hay una sola —el PGP Ultra de la Zona 9—
-- pero va completa por si mañana se cambia alguna.
insert into boquillas (modelo, numero, bar, litros_hora, radio_m) values
  ('PGP azul','1.5',1.7,270,8.8),('PGP azul','1.5',2.0,290,9.1),('PGP azul','1.5',2.5,320,9.4),
  ('PGP azul','1.5',3.0,350,9.8),('PGP azul','1.5',3.5,380,9.8),('PGP azul','1.5',4.0,410,9.8),
  ('PGP azul','1.5',4.5,430,9.4),
  ('PGP azul','2.0',1.7,320,10.1),('PGP azul','2.0',2.0,350,10.1),('PGP azul','2.0',2.5,390,10.1),
  ('PGP azul','2.0',3.0,430,10.4),('PGP azul','2.0',3.5,470,10.4),('PGP azul','2.0',4.0,500,10.4),
  ('PGP azul','2.0',4.5,530,10.4),
  ('PGP azul','2.5',1.7,390,10.1),('PGP azul','2.5',2.0,430,10.4),('PGP azul','2.5',2.5,480,10.7),
  ('PGP azul','2.5',3.0,540,10.7),('PGP azul','2.5',3.5,580,10.7),('PGP azul','2.5',4.0,620,10.7),
  ('PGP azul','2.5',4.5,660,10.7),
  ('PGP azul','3.0',1.7,500,10.7),('PGP azul','3.0',2.0,540,10.7),('PGP azul','3.0',2.5,610,11.0),
  ('PGP azul','3.0',3.0,680,11.6),('PGP azul','3.0',3.5,740,11.9),('PGP azul','3.0',4.0,790,11.9),
  ('PGP azul','3.0',4.5,840,11.9),
  ('PGP azul','4.0',1.7,680,11.3),('PGP azul','4.0',2.0,730,11.6),('PGP azul','4.0',2.5,810,11.9),
  ('PGP azul','4.0',3.0,900,12.2),('PGP azul','4.0',3.5,970,12.2),('PGP azul','4.0',4.0,1040,12.5),
  ('PGP azul','4.0',4.5,1100,12.5),
  ('PGP azul','5.0',1.7,840,11.3),('PGP azul','5.0',2.0,910,11.6),('PGP azul','5.0',2.5,1020,11.9),
  ('PGP azul','5.0',3.0,1140,12.8),('PGP azul','5.0',3.5,1240,12.8),('PGP azul','5.0',4.0,1320,12.8),
  ('PGP azul','5.0',4.5,1410,12.8),
  ('PGP azul','6.0',1.7,1010,11.6),('PGP azul','6.0',2.0,1090,11.9),('PGP azul','6.0',2.5,1220,12.2),
  ('PGP azul','6.0',3.0,1360,13.1),('PGP azul','6.0',3.5,1470,13.1),('PGP azul','6.0',4.0,1570,13.4),
  ('PGP azul','6.0',4.5,1670,13.4),
  ('PGP azul','8.0',1.7,1350,11.3),('PGP azul','8.0',2.0,1460,11.9),('PGP azul','8.0',2.5,1630,12.5),
  ('PGP azul','8.0',3.0,1810,13.4),('PGP azul','8.0',3.5,1950,13.7),('PGP azul','8.0',4.0,2090,14.0),
  ('PGP azul','8.0',4.5,2220,14.0)
on conflict (modelo, numero, bar) do nothing;

-- ---------------------------------------------------------------------
-- 2. De qué está hecha cada zona, y a qué presión trabaja
-- ---------------------------------------------------------------------
create table if not exists zona_aspersores (
  zona_id uuid not null references riego_zonas(id) on delete cascade,
  modelo text not null default 'PGP rojo',
  numero text not null,
  cantidad int not null default 0 check (cantidad >= 0),
  primary key (zona_id, modelo, numero)
);
create index if not exists zona_aspersores_zona_idx on zona_aspersores (zona_id);

alter table zona_aspersores enable row level security;
drop policy if exists miembros_all on zona_aspersores;
create policy miembros_all on zona_aspersores for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

alter table riego_zonas
  add column if not exists presion_bar numeric(3,1) default 4.5,
  add column if not exists superficie_m2 numeric(10,2);

comment on column riego_zonas.presion_bar is
  'A cuántos bar trabaja esta línea. Define qué fila de la ficha se usa.';
comment on column riego_zonas.superficie_m2 is
  'Superficie que moja la zona. Marco entre aspersores × cuántos hay.';
comment on column riego_zonas.mm_por_hora is
  'Caudal a mano. Si la zona tiene aspersores cargados, gana el calculado.';

-- ---------------------------------------------------------------------
-- 3. El inventario relevado en septiembre de 2026
--
-- Yapeyú: 11 líneas, 67 aspersores. 20 de Junio: 9 líneas, 53.
-- ---------------------------------------------------------------------
do $$
declare
  zona uuid;
  datos text[][] := array[
    ['Linea 1','11','6'],
    ['Linea 2','10','2'], ['Linea 2','11','3'], ['Linea 2','12','1'],
    ['Linea 3','12','4'],
    ['Linea 4','11','3'], ['Linea 4','12','2'],
    ['Linea 5','9','1'], ['Linea 5','10','1'], ['Linea 5','11','2'], ['Linea 5','12','2'],
    ['Linea 6','7','1'], ['Linea 6','8','1'], ['Linea 6','9','3'], ['Linea 6','10','1'], ['Linea 6','11','1'],
    ['Linea 7','7','1'], ['Linea 7','8','1'], ['Linea 7','9','3'], ['Linea 7','10','1'], ['Linea 7','11','1'],
    ['Linea 8','7','1'], ['Linea 8','8','1'], ['Linea 8','9','3'], ['Linea 8','10','1'], ['Linea 8','11','1'],
    ['Linea 9','7','1'], ['Linea 9','8','1'], ['Linea 9','9','3'], ['Linea 9','10','1'], ['Linea 9','11','1'],
    ['Linea 10','8','1'], ['Linea 10','9','1'], ['Linea 10','10','2'], ['Linea 10','11','2'],
    ['Linea 11','11','3'], ['Linea 11','12','3'],
    ['Zona 1','11','1'], ['Zona 1','12','5'],
    ['Zona 2','8','1'], ['Zona 2','11','2'], ['Zona 2','12','3'],
    ['Zona 3','8','1'], ['Zona 3','12','5'],
    ['Zona 4','8','2'], ['Zona 4','12','4'],
    ['Zona 5','8','1'], ['Zona 5','12','5'],
    ['Zona 6','11','1'], ['Zona 6','12','5'],
    ['Zona 7','9','1'], ['Zona 7','10','5'], ['Zona 7','12','1'],
    ['Zona 8','12','5'],
    ['Zona 9','12','4']
  ];
  i int;
begin
  for i in 1 .. array_length(datos, 1) loop
    select id into zona from riego_zonas where nombre = datos[i][1] limit 1;
    if zona is not null then
      insert into zona_aspersores (zona_id, modelo, numero, cantidad)
      values (zona, 'PGP rojo', datos[i][2], datos[i][3]::int)
      on conflict (zona_id, modelo, numero) do update set cantidad = excluded.cantidad;
    end if;
  end loop;

  -- El único PGP Ultra del campo, en la Zona 9, lleva pico AZUL 8.0.
  -- No es lo mismo que un rojo 8: tira 2.220 l/h contra 1.050.
  select id into zona from riego_zonas where nombre = 'Zona 9' limit 1;
  if zona is not null then
    insert into zona_aspersores (zona_id, modelo, numero, cantidad)
    values (zona, 'PGP azul', '8.0', 1)
    on conflict (zona_id, modelo, numero) do update set cantidad = excluded.cantidad;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. El caudal de cada zona, calculado
--
-- Falta un dato para cerrar la cuenta: los m² que moja cada zona. El
-- marco entre aspersores no se sabe exacto —los lotes no son cuadrados y
-- las líneas siguen el borde— pero no hace falta medirlo: la superficie
-- del lote se reparte entre sus aspersores, y a cada zona le tocan los
-- suyos.
--
-- Yapeyú son 14.500 m² entre 67 aspersores: 216 m² cada uno, que es un
-- marco equivalente de unos 14,7 m. 20 de Junio, 13.500 entre 53: 255 m²,
-- unos 16 m. Los dos caen justo en el rango de un PGP a 4,5 bar, que
-- alcanza entre 12 y 15 m según el pico. La cuenta cierra sola y, mejor
-- todavía, la suma de las zonas da exactamente la superficie del lote:
-- no queda campo sin regar ni regado dos veces.
--
-- Si algún día se mide una zona en serio, se carga en
-- riego_zonas.superficie_m2 y esa gana.
-- ---------------------------------------------------------------------
create or replace view v_caudal_zonas as
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
    sum(za.cantidad * b.litros_hora) as litros_hora,
    max(b.radio_m) as radio_max,
    count(*) filter (where b.litros_hora is null) as sin_ficha
  from zona_aspersores za
  join riego_zonas rz on rz.id = za.zona_id
  left join boquillas b
    on b.modelo = za.modelo
   and b.numero = za.numero
   and b.bar = coalesce(rz.presion_bar, 4.5)
  where za.cantidad > 0
  group by za.zona_id
)
select
  z.id as zona_id,
  z.nombre,
  z.lote_id,
  coalesce(z.presion_bar, 4.5) as presion_bar,
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
  'El mm/hora de cada zona, salido de sus aspersores y de su parte del lote.';
