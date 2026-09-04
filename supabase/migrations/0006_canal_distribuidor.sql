-- =====================================================================
-- 0006 — "masiva" pasa a llamarse "distribuidor"
--
-- Es la palabra que usa Valentín para ese canal. La base guarda el mismo
-- nombre que se lee en pantalla, para que no haya que traducir nada.
-- =====================================================================

alter table ventas drop constraint if exists ventas_canal_check;

update ventas set canal = 'distribuidor' where canal = 'masiva';

alter table ventas add constraint ventas_canal_check
  check (canal in ('directa', 'distribuidor'));
