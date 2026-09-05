import Image from "next/image";
import Link from "next/link";
import { Refrescar } from "@/components/refrescar";
import { createClient } from "@/lib/supabase/server";
import BarraLateral from "./barra-lateral";
import MenuCompleto from "./menu-completo";
import BarraInferior from "./barra-inferior";

/** "Valentín Coghlan" -> "Valentín". El saludo va con el nombre de pila. */
function nombrePila(nombre: string) {
  return nombre.trim().split(/\s+/)[0];
}

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

  const nombre = nombrePila(perfil?.nombre ?? user.email ?? "");
  const email = user.email ?? "";
  const abiertas = pendientes ?? 0;

  return (
    <>
      {/* Compu: menú fijo a la izquierda */}
      <BarraLateral nombre={nombre} email={email} pendientes={abiertas} />

      {/* Celular: barra arriba con el saludo, y accesos abajo */}
      <header className="sticky top-0 z-20 bg-pasto-oscuro sm:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-circulo.png"
              alt=""
              width={256}
              height={256}
              className="size-9 rounded-full bg-crema object-cover"
            />
            <span className="text-[17px] font-bold leading-tight text-crema">Hola {nombre},</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {abiertas > 0 && (
              <Link href="/#alertas" className="chip bg-atencion-bg text-atencion-tx">
                {abiertas} pendiente{abiertas === 1 ? "" : "s"}
              </Link>
            )}
            <Refrescar sobreVerde />
          </div>
        </div>
      </header>

      <BarraInferior>
        <MenuCompleto nombre={nombre} email={email} variante="barra" />
      </BarraInferior>
    </>
  );
}
