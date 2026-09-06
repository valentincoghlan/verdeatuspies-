-- ---------------------------------------------------------------------
-- 0026 · Qué puede hacer cada rol
--
-- Entran dos personas más al equipo. Hasta hoy cualquiera que entrara
-- podía hacer todo salvo ajustar saldos: alcanzaba con estar en la
-- allowlist. Ahora hay una línea clara.
--
-- Operador: todo el día a día — campo, cosecha, pedidos, ventas,
-- clientes y la carga de movimientos.
-- Admin: además, lo que toca la estructura o deshace plata — borrar un
-- movimiento, crear cuentas, saldar y ajustar saldos, la configuración,
-- las categorías y el equipo.
--
-- El chequeo también está en las server actions. Esto es la red de
-- abajo: aunque alguien le pegue a la base por afuera de la app, la
-- regla sigue valiendo.
-- ---------------------------------------------------------------------

-- Config, categorías y cuentas: todos las leen, solo el admin las toca.
do $$
declare
  t text;
begin
  foreach t in array array['config', 'categorias', 'cuentas'] loop
    execute format('drop policy if exists miembros_all on %I', t);

    execute format('drop policy if exists %I on %I', t || '_leer', t);
    execute format(
      'create policy %I on %I for select to authenticated using (public.es_miembro())',
      t || '_leer', t
    );

    execute format('drop policy if exists %I on %I', t || '_alta', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (public.es_admin())',
      t || '_alta', t
    );

    execute format('drop policy if exists %I on %I', t || '_cambio', t);
    execute format(
      'create policy %I on %I for update to authenticated using (public.es_admin()) with check (public.es_admin())',
      t || '_cambio', t
    );

    execute format('drop policy if exists %I on %I', t || '_baja', t);
    execute format(
      'create policy %I on %I for delete to authenticated using (public.es_admin())',
      t || '_baja', t
    );
  end loop;
end $$;

-- Movimientos: los carga cualquiera, los borra solo el admin. Un
-- movimiento borrado le cambia el saldo a todos y no queda rastro.
drop policy if exists miembros_all on movimientos;

drop policy if exists movimientos_leer on movimientos;
create policy movimientos_leer on movimientos
  for select to authenticated using (public.es_miembro());

drop policy if exists movimientos_alta on movimientos;
create policy movimientos_alta on movimientos
  for insert to authenticated with check (public.es_miembro());

drop policy if exists movimientos_cambio on movimientos;
create policy movimientos_cambio on movimientos
  for update to authenticated using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists movimientos_baja on movimientos;
create policy movimientos_baja on movimientos
  for delete to authenticated using (public.es_admin());
