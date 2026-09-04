-- =====================================================================
-- 0004 — Reactivar perfiles habilitados después del alta
--
-- El disparador handle_new_user() marca el perfil como activo solo si el
-- mail ya estaba en miembros_habilitados cuando la persona entró por
-- primera vez. Si intentó entrar antes de que la dieras de alta, el
-- perfil queda inactivo para siempre: es_miembro() da falso y la app le
-- abre vacía, sin ningún mensaje que explique por qué.
--
-- Esto pone al día los perfiles que ya están habilitados. La causa de
-- fondo se corrige en agregarMiembro() (lib/actions.ts), que ahora
-- reactiva el perfil al dar de alta el mail.
-- =====================================================================

update perfiles p
set activo = true,
    rol = m.rol
from miembros_habilitados m
where lower(p.email) = lower(m.email)
  and (p.activo is distinct from true or p.rol is distinct from m.rol);
