-- ---------------------------------------------------------------------
-- 0040 · Seis pagos de mano de obra vuelven a Plantación
--
-- Estaban colgados de "Maquinas y Herramientas → Mano de obra" desde la
-- importación de la planilla vieja, sin detalle ni notas. No era mano de
-- obra sobre máquinas: era la gente trabajando en la preparación del
-- terreno y la plantación, así que van a "Plantación → Mano de obra".
--
-- El resultado de ningún período cambia: los dos rubros son inversión.
-- Lo que cambia es que el archivo queda contando la verdad, y que dentro
-- de un año no hay que volver a adivinar de qué eran.
--
-- De paso se corrigen dos montos del 28/12/2025 que habían entrado mal en
-- la importación: Mario iba con 80.000 y Salvador con 50.000, cuando los
-- dos cobraron 65.000. El total del día no se mueve: sigue siendo 330.000.
-- Como el monto cambia, se recalculan los dólares con la cotización que
-- ya tenía guardada cada movimiento.
-- ---------------------------------------------------------------------

do $$
declare
  cat_origen  uuid;
  cat_destino uuid;
  movidos int;
begin
  select c.id into cat_origen
    from categorias c
    join categorias p on p.id = c.padre_id
   where p.padre_id is null
     and p.nombre = 'Maquinas y Herramientas'
     and c.nombre = 'Mano de obra';

  select c.id into cat_destino
    from categorias c
    join categorias p on p.id = c.padre_id
   where p.padre_id is null
     and p.nombre = 'Plantación'
     and c.nombre = 'Mano de obra';

  if cat_origen is null or cat_destino is null then
    raise notice '0040: no estan las dos categorias, no se toca nada';
    return;
  end if;

  -- 1. Los dos montos corregidos del 28/12/2025, con sus dólares al día.
  update movimientos m
     set monto = 65000,
         monto_usd = case
           when m.cotizacion is null or m.cotizacion = 0 then m.monto_usd
           else round((65000 / m.cotizacion)::numeric, 2)
         end
    from personas pe
   where pe.id = m.persona_id
     and m.categoria_id = cat_origen
     and m.fecha = date '2025-12-28'
     and pe.nombre in ('Mario Martinez', 'Salvador');

  -- 2. Los seis se mudan a Plantación, y quedan con su detalle escrito
  --    para que el registro se explique solo.
  update movimientos
     set categoria_id = cat_destino,
         detalle = coalesce(nullif(trim(detalle), ''), 'Mano de obra de preparación y plantación')
   where categoria_id = cat_origen;

  get diagnostics movidos = row_count;
  raise notice '0040: % movimientos pasaron a Plantacion -> Mano de obra', movidos;
end $$;
