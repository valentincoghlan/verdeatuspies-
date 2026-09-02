import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NavLinks from "./nav-links";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: perfil }, { count: pendientes }] = await Promise.all([
    supabase.from("perfiles").select("nombre, rol, activo").eq("id", user.id).single(),
    supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("resuelta", false),
  ]);

  return (
    <header className="sticky top-0 z-20 border-b border-tierra-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-hoja-600 text-sm font-bold text-white">
            V
          </span>
          <span className="text-sm font-bold leading-tight">
            Verde A Tus Pies
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {(pendientes ?? 0) > 0 && (
            <Link
              href="/#alertas"
              className="chip bg-amber-100 text-amber-800"
              title="Alertas pendientes"
            >
              {pendientes} pendiente{(pendientes ?? 0) === 1 ? "" : "s"}
            </Link>
          )}
          <span className="hidden text-xs text-tierra-600 sm:inline">
            {perfil?.nombre ?? user.email}
          </span>
          <form action="/auth/signout" method="post">
            <button className="text-xs font-semibold text-tierra-600 hover:text-tierra-900">
              Salir
            </button>
          </form>
        </div>
      </div>
      <NavLinks />
    </header>
  );
}
