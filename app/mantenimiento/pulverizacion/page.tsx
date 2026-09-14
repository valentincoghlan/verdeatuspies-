import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Tabla } from "@/components/ui";
import { Dato } from "@/components/dato";
import { Acciones } from "@/components/acciones";
import { CalculadoraPulverizacion } from "@/components/calculadora-pulverizacion";
import { borrarPulverizacion } from "@/lib/actions";
import { fechaBreve, fechaDM, hoyISO, numero } from "@/lib/format";

/** "3 l/ha", "1,5 l/ha": los decimales solo aparecen si los hay. */
const dosisTexto = (dosis: unknown, unidad: string | null) => {
  const v = Number(dosis);
  if (!Number.isFinite(v) || v === 0) return "—";
  return `${numero(v, Number.isInteger(v) ? 0 : 2)} ${unidad ?? ""}`.trim();
};

export const dynamic = "force-dynamic";

/**
 * Pulverización: la cuenta y el cuaderno.
 *
 * Arriba, cuánto producto va en el tanque; abajo, lo que se pulverizó.
 * Son la misma tarea partida en dos momentos, y por eso viven en la
 * misma pantalla: se calcula antes de cargar y se anota al bajar del
 * tractor, sin volver a escribir el producto ni la dosis.
 */
export default async function PulverizacionPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const [{ data: lotes }, { data: historial }] = await Promise.all([
    supabase.from("lotes").select("id, nombre, superficie_m2").eq("activo", true).order("nombre"),
    supabase
      .from("pulverizaciones")
      .select("*, lotes(nombre)")
      .order("fecha", { ascending: false })
      .limit(60),
  ]);

  const filas = historial ?? [];
  const anio = hoy.slice(0, 4);
  const esteAnio = filas.filter((p: any) => (p.fecha ?? "").startsWith(anio));
  const ultima = filas[0];

  // El desplegable de productos: los que ya se usaron, del más reciente
  // al más viejo y sin repetir.
  const productosUsados = [...new Set(filas.map((p: any) => p.producto).filter(Boolean))] as string[];

  return (
    <>
      <PageHeader
        titulo="Pulverización"
        bajada="Cargá la máquina y la dosis de la etiqueta, y te digo cuánto producto va en el tanque."
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:gap-3">
        <Stat label={`Pulverizaciones ${anio}`} valor={numero(esteAnio.length)} />
        <Stat
          label="Última"
          valor={ultima ? fechaBreve(ultima.fecha) : "—"}
          detalle={ultima ? `${ultima.producto} · ${ultima.lotes?.nombre ?? ""}` : "Todavía ninguna"}
        />
      </div>

      <CalculadoraPulverizacion lotes={lotes ?? []} hoy={hoy} productosUsados={productosUsados} />

      <div className="mt-3">
        <Card titulo="Historial">
          <Tabla
            columnas={[
              { titulo: "Fecha", ancho: "w-[3.4rem] sm:w-auto" },
              { titulo: "Lote" },
              { titulo: "Producto" },
              { titulo: "Dosis", desde: "sm" },
              { titulo: "Superficie", desde: "sm" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="Todavía no anotaste ninguna pulverización."
          >
            {filas.map((p: any) => (
              <tr key={p.id}>
                <td className="td whitespace-nowrap">
                  <span className="sm:hidden">{fechaDM(p.fecha)}</span>
                  <span className="hidden sm:inline">{fechaBreve(p.fecha)}</span>
                </td>
                <td className="td font-medium">{p.lotes?.nombre}</td>
                {/* En el celular la dosis baja debajo del producto: no
                    alcanza el ancho para una columna propia. */}
                <td className="td">
                  <Dato
                    principal={p.producto}
                    secundario={
                      p.dosis ? (
                        <span className="sm:hidden">{dosisTexto(p.dosis, p.unidad)}</span>
                      ) : null
                    }
                  />
                </td>
                <td className="td hidden tabular-nums sm:table-cell">
                  {dosisTexto(p.dosis, p.unidad)}
                </td>
                <td className="td hidden tabular-nums sm:table-cell">
                  {p.superficie_ha ? `${numero(Number(p.superficie_ha), 2)} ha` : "—"}
                </td>
                <td className="td text-right">
                  <Acciones titulo={`${p.producto} en ${p.lotes?.nombre ?? "el lote"}`}>
                    <form action={borrarPulverizacion}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="whitespace-nowrap text-xs font-semibold text-tinta-3 hover:text-urgente-tx">
                        Borrar
                      </button>
                    </form>
                  </Acciones>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
