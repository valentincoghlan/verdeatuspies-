import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CalculadoraPulverizacion } from "@/components/calculadora-pulverizacion";

export const dynamic = "force-dynamic";

/**
 * La calculadora de pulverización.
 *
 * No guarda nada: es una cuenta que se hace parado al lado de la máquina,
 * antes de cargar el tanque. Lo único que sale de la base son los lotes,
 * para poder poner la superficie de un toque en vez de acordarse.
 */
export default async function PulverizacionPage() {
  const supabase = await createClient();
  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, nombre, superficie_m2")
    .eq("activo", true)
    .order("nombre");

  return (
    <>
      <PageHeader
        titulo="Pulverización"
        bajada="Cargá la máquina y la dosis de la etiqueta, y te digo cuánto producto va en el tanque."
      />
      <CalculadoraPulverizacion lotes={lotes ?? []} />
    </>
  );
}
