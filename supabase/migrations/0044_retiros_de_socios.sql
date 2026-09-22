-- ---------------------------------------------------------------------
-- 0044 · "Cobros" pasa a llamarse "Retiros de socios"
--
-- El rubro siempre fue plata que SALE hacia los socios, pero se llamaba
-- "Cobros", que suena a plata que entra. Cada vez que había que cargar un
-- dividendo se perdían buscándolo. El nombre pasa a decir lo que es.
--
-- Nada cambia de fondo: sigue siendo tipo 'E' y tipo_plata 'financiero',
-- así que no entra en el resultado del período —repartir la ganancia no
-- es un costo de producir— y sí baja el saldo de la cuenta.
--
-- OJO, LA PARTE QUE IMPORTA: la vista `v_aportes` buscaba los dividendos
-- por el NOMBRE del rubro padre (`p.nombre = 'Cobros'`). Con el renombre
-- solo, la columna "recuperó" de Disponibilidades se habría ido a cero
-- para los tres socios, sin ningún error a la vista. Por eso la vista se
-- rehace acá mismo, y de paso se le saca esa dependencia: pasa a mirar
-- solo la subcategoría "Dividendos", que es única en todo el catálogo.
-- ---------------------------------------------------------------------

update categorias
   set nombre = 'Retiros de socios'
 where padre_id is null
   and nombre = 'Cobros';

-- ---------------------------------------------------------------------
-- La vista, sin atarse al nombre del rubro padre
-- ---------------------------------------------------------------------
create or replace view v_aportes as
with puesto as (
  select
    c.persona_id,
    sum(case when m.tipo = 'E' then coalesce(m.monto_usd, 0) else -coalesce(m.monto_usd, 0) end) as aportado,
    count(*) as movimientos,
    count(*) filter (where m.monto_usd is null) as sin_cotizacion
  from movimientos m
  join cuentas c on c.id = m.cuenta_id
  where c.tipo = 'socio' and c.persona_id is not null
  group by c.persona_id
),
cobrado as (
  -- Antes pedía además que el padre se llamara 'Cobros'. Ahora alcanza con
  -- la subcategoría: "Dividendos" existe una sola vez, y así el día que
  -- alguien vuelva a renombrar el rubro esto no se rompe en silencio.
  select m.persona_id, sum(coalesce(m.monto_usd, 0)) as devuelto
  from movimientos m
  join categorias h on h.id = m.categoria_id
  where m.tipo = 'E'
    and h.nombre = 'Dividendos'
    and h.padre_id is not null
    and m.persona_id is not null
  group by m.persona_id
)
select
  pe.id as persona_id,
  pe.nombre as socio,
  coalesce(pu.aportado, 0) as aportado_usd,
  coalesce(co.devuelto, 0) as devuelto_usd,
  coalesce(pu.aportado, 0) - coalesce(co.devuelto, 0) as pendiente_usd,
  coalesce(pu.movimientos, 0) as movimientos,
  coalesce(pu.sin_cotizacion, 0) as sin_cotizacion
from personas pe
left join puesto pu on pu.persona_id = pe.id
left join cobrado co on co.persona_id = pe.id
where pe.tipo = 'socio'
order by coalesce(pu.aportado, 0) desc;
