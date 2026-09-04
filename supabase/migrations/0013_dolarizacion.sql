-- =====================================================================
-- 0013 — Todo valorizado en pesos Y en dólares
--
-- El negocio se mide en dólares. Cada movimiento tiene que tener las dos
-- cifras: lo que se pagó en pesos y su equivalente en dólares al día de
-- la operación.
--
--   monto      -> SIEMPRE en pesos
--   monto_usd  -> SIEMPRE en dólares
--   cotizacion -> el dólar de ese día
--   moneda     -> solo recuerda en qué moneda se cargó originalmente
--
-- En la importación, los movimientos que en la planilla tenían la celda
-- de pesos vacía quedaron guardados con el monto en dólares dentro del
-- campo de pesos. Por eso el saldo en dólares de la cuenta USD no daba
-- cero cuando tenía que dar cero.
-- =====================================================================

-- Los que se cargaron en dólares: el monto en pesos se calcula con su
-- cotización, y el de dólares ya estaba bien.
update movimientos
set monto = round(monto_usd * cotizacion, 2),
    moneda = 'ARS'
where moneda = 'USD'
  and monto_usd is not null
  and cotizacion is not null
  and cotizacion > 0;

-- Los que no tenían el equivalente en dólares se valorizan con su cotización.
update movimientos
set monto_usd = round(monto / cotizacion, 2)
where monto_usd is null
  and cotizacion is not null
  and cotizacion > 0;

-- ---------------------------------------------------------------------
-- Los saldos suman las dos monedas siempre, no según cómo se cargó
-- ---------------------------------------------------------------------
drop view if exists v_saldos_cuentas;

create view v_saldos_cuentas as
select
  c.id as cuenta_id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.activa,
  c.orden,
  c.persona_id,
  coalesce(sum(case when m.tipo = 'I' then m.monto else -m.monto end), 0) as saldo_ars,
  coalesce(sum(case when m.tipo = 'I' then coalesce(m.monto_usd, 0) else -coalesce(m.monto_usd, 0) end), 0) as saldo_usd,
  count(m.id) as movimientos,
  count(m.id) filter (where m.monto_usd is null) as sin_cotizacion,
  max(m.fecha) as ultimo_movimiento
from cuentas c
left join movimientos m on m.cuenta_id = c.id
group by c.id, c.nombre, c.tipo, c.moneda, c.activa, c.orden, c.persona_id;

-- ---------------------------------------------------------------------
-- Dólar MEP del día
--
-- De acá en adelante, lo que se carga sin cotización a mano se valoriza
-- con el MEP del día, que trae la corrida diaria.
-- ---------------------------------------------------------------------
create table if not exists cotizaciones (
  fecha date primary key,
  mep numeric(12,2) not null,
  fuente text not null default 'dolarapi.com',
  actualizado_at timestamptz not null default now()
);

alter table cotizaciones enable row level security;
drop policy if exists miembros_all on cotizaciones;
create policy miembros_all on cotizaciones for all to authenticated
  using (public.es_miembro()) with check (public.es_miembro());
