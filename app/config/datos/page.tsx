import { createClient } from "@/lib/supabase/server";
import { Card, Chip } from "@/components/ui";
import { Campo, Opciones, Selector } from "@/components/campos";
import { guardarCategoria } from "@/lib/actions";

export const dynamic = "force-dynamic";

const LADOS = [
  { value: "E", label: "Solo salidas" },
  { value: "I", label: "Solo entradas" },
  { value: "ambos", label: "Las dos" },
];

const CHIP = {
  E: { texto: "Sale", tono: "ambar" as const },
  I: { texto: "Entra", tono: "verde" as const },
  ambos: { texto: "Las dos", tono: "neutro" as const },
};

export default async function ConfigDatosPage() {
  const supabase = await createClient();
  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .order("orden");

  const todas = (categorias ?? []) as any[];
  const rubros = todas.filter((c) => !c.padre_id);

  return (
    <>
      <Card titulo="Categorías">
        <p className="mb-4 text-sm text-tinta-2">
          Cada categoría dice para qué lado sirve. Al cargar un movimiento, el desplegable trae
          solo las que corresponden: si marcás Entra, no te va a ofrecer &laquo;Cosecha ·
          Combustible&raquo;. Cuando cambiás un rubro a un solo lado, sus subcategorías lo siguen.
        </p>

        <form
          action={guardarCategoria}
          className="mb-6 grid grid-cols-2 gap-3 rounded-2xl bg-crema p-3 sm:grid-cols-4"
        >
          <Campo
            label="Categoría nueva"
            name="nombre"
            required
            placeholder="Nombre"
            className="col-span-2 sm:col-span-1"
          />
          <Selector
            label="Dentro de"
            name="padre_id"
            vacio="Es un rubro nuevo"
            opciones={rubros.map((r) => ({ value: r.id, label: r.nombre }))}
            className="col-span-2 sm:col-span-1"
          />
          <Opciones
            label="Sirve para"
            name="tipo"
            defaultValue="E"
            opciones={LADOS}
            className="col-span-2"
          />
          <div className="col-span-2 sm:col-span-4">
            <button className="btn-ghost">Agregar</button>
          </div>
        </form>

        <div className="space-y-4">
          {rubros.map((r) => {
            const hijos = todas.filter((c) => c.padre_id === r.id);
            return (
              <div key={r.id} className="rounded-2xl border border-borde">
                <div className="flex flex-wrap items-center gap-2 border-b border-beige bg-beige/50 px-3 py-2">
                  <span className="font-bold text-tinta">{r.nombre}</span>
                  <Chip tono={CHIP[(r.tipo ?? "ambos") as keyof typeof CHIP].tono}>
                    {CHIP[(r.tipo ?? "ambos") as keyof typeof CHIP].texto}
                  </Chip>
                  <form action={guardarCategoria} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select
                      name="tipo"
                      defaultValue={r.tipo ?? "ambos"}
                      className="h-9 rounded-lg border-[1.5px] border-borde bg-white px-2 text-sm text-tinta"
                    >
                      {LADOS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <button className="text-sm font-semibold text-pasto hover:underline">
                      Guardar
                    </button>
                  </form>
                </div>

                <ul className="divide-y divide-beige">
                  {hijos.length === 0 && (
                    <li className="px-3 py-2 text-sm text-tinta-3">
                      Este rubro no tiene subcategorías.
                    </li>
                  )}
                  {hijos.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="text-sm text-tinta">{h.nombre}</span>
                      <Chip tono={CHIP[(h.tipo ?? "ambos") as keyof typeof CHIP].tono}>
                        {CHIP[(h.tipo ?? "ambos") as keyof typeof CHIP].texto}
                      </Chip>
                      <form action={guardarCategoria} className="ml-auto flex items-center gap-2">
                        <input type="hidden" name="id" value={h.id} />
                        <input type="hidden" name="padre_id" value={r.id} />
                        <select
                          name="tipo"
                          defaultValue={h.tipo ?? "ambos"}
                          className="h-9 rounded-lg border-[1.5px] border-borde bg-white px-2 text-sm text-tinta"
                        >
                          {LADOS.map((l) => (
                            <option key={l.value} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                        <button className="text-sm font-semibold text-pasto hover:underline">
                          Guardar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
