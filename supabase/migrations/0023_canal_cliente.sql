-- =====================================================================
-- 0023 — El canal del cliente
--
-- Antes cada cliente tenía un "tipo" con cinco opciones (particular,
-- empresa, paisajista, vivero, otro) que en la práctica no se usaban.
-- Lo único que importa es cómo nos compra:
--
--   directa      -> es el que va a usar el pasto
--   distribuidor -> revende
--
-- Es la misma división que ya usan las ventas, así que ahora los dos
-- lados hablan el mismo idioma.
-- =====================================================================

alter table clientes
  add column if not exists canal text not null default 'directa';

alter table clientes drop constraint if exists clientes_canal_check;
alter table clientes add constraint clientes_canal_check
  check (canal in ('directa', 'distribuidor'));

-- Los que marcamos al traerlos desde los movimientos de Ventas
update clientes set canal = 'distribuidor'
where notas = 'Distribuidor' or nombre in ('Cesped Foresto', 'Federico Block');
