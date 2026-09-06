import { createClient } from "@/lib/supabase/server";

/**
 * Si el que está mirando es el dueño.
 *
 * Las pantallas lo usan para no mostrar botones que después van a
 * rebotar. La regla de verdad está en dos lugares más abajo: el chequeo
 * de cada server action y las políticas de la base (migración 0026).
 * Esconder el botón es cortesía, no seguridad.
 */
export async function esAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return data?.rol === "admin";
}

/** Lo que puede hacer cada rol, tal como se muestra en Ajustes → Equipo. */
export const PERMISOS: { tarea: string; admin: boolean }[] = [
  { tarea: "Cargar riegos, cortes, fertilizaciones y lluvias", admin: false },
  { tarea: "Prender una zona y frenar o reanudar los riegos", admin: false },
  { tarea: "Cosechar: abrir la cosecha, cargar pilas y cerrarla", admin: false },
  { tarea: "Pedidos: cargar, confirmar la entrega, reprogramar y anular", admin: false },
  { tarea: "Ventas: cargar, editar y borrar", admin: false },
  { tarea: "Clientes: cargar y editar", admin: false },
  { tarea: "Cargar movimientos de plata (cobros y pagos)", admin: false },
  { tarea: "Ver reportes, disponibilidades y aportes de los socios", admin: false },
  { tarea: "Sincronizar clima y riego a mano", admin: false },
  { tarea: "Borrar un movimiento", admin: true },
  { tarea: "Crear una cuenta nueva", admin: true },
  { tarea: "Saldar la cuenta corriente de un cliente", admin: true },
  { tarea: "Ajustar el saldo de una cuenta", admin: true },
  { tarea: "Cambiar la configuración general", admin: true },
  { tarea: "Editar las categorías de movimientos", admin: true },
  { tarea: "Sumar, sacar o cambiarle el rol a alguien del equipo", admin: true },
];
