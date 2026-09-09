import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Tabla } from "@/components/ui";
import { Dato } from "@/components/dato";
import { Acciones } from "@/components/acciones";
import { Campo, Nota, Selector } from "@/components/campos";
import { borrarCorte, crearCorte } from "@/lib/actions";
import { diasDesde, fechaBreve, fechaDM, fechaLarga, hoyISO, numero } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CortesPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const [{ data: lotes }, { data: estado }, { data: cortes }] =
    await Promise.all([
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("v_estado_lotes").select("*").order("nombre"),
      supabase
        .from("cortes")
        .select("*, lotes(nombre)")
        .order("fecha", { ascending: false })
        .limit(60),
    ]);

  return (
    <>
      <PageHeader
        titulo="Cortes de pasto"
        bajada="Cada corte por lote, con altura y horas de máquina. La app avisa cuando se pasa el objetivo de días."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3">
        {(estado ?? []).map((l: any) => {
          const d = diasDesde(l.ultimo_corte);
          const objetivo = Number(l.dias_objetivo_corte ?? 14);
          const atrasado = d !== null && d >= objetivo;
          return (
            <Stat
              key={l.lote_id}
              label={l.nombre}
              valor={d === null ? "Sin cortes" : `hace ${d} días`}
              tono={atrasado ? "ambar" : "verde"}
              detalle={`Objetivo: cada ${objetivo} días`}
            />
          );
        })}
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Cargar un corte">
          <form action={crearCorte} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Selector
              label="Lote"
              name="lote_id"
              required
              vacio="Elegí un lote"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
            />
            <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
            <Campo label="Altura (mm)" name="altura_mm" type="number" placeholder="35" />
            <Campo label="Superficie cortada (m²)" name="superficie_m2" type="number" />
            <Campo label="Horas de máquina" name="horas_maquina" type="number" step="0.5" />
            <Campo label="Quién cortó" name="responsable_texto" placeholder="Nombre" />
            <Nota className="col-span-2" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Guardar corte</button>
            </div>
          </form>
        </Card>

        <Card titulo="Historial de cortes">
          <Tabla
            columnas={[
              { titulo: "Fecha", ancho: "w-[3.4rem] sm:w-auto" },
              { titulo: "Lote" },
              { titulo: "Altura", align: "right" },
              { titulo: "Superficie", desde: "sm" },
              { titulo: "Horas", desde: "sm" },
              { titulo: "Quién", desde: "sm" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="Todavía no cargaste cortes."
          >
            {(cortes ?? []).map((c: any) => (
              <tr key={c.id}>
                <td className="td whitespace-nowrap">
                  <span className="sm:hidden">{fechaDM(c.fecha)}</span>
                  <span className="hidden sm:inline">{fechaBreve(c.fecha)}</span>
                </td>
                <td className="td font-medium">
                  <Dato
                    principal={c.lotes?.nombre ?? "—"}
                    secundario={
                      c.responsable_texto ? (
                        <span className="sm:hidden">{c.responsable_texto}</span>
                      ) : null
                    }
                  />
                </td>
                <td className="td text-right tabular-nums sm:text-left">
                  {c.altura_mm ? `${c.altura_mm} mm` : "—"}
                </td>
                <td className="td hidden tabular-nums sm:table-cell">{numero(c.superficie_m2)}</td>
                <td className="td hidden tabular-nums sm:table-cell">
                  {numero(c.horas_maquina, 1)}
                </td>
                <td className="td hidden sm:table-cell">{c.responsable_texto ?? "—"}</td>
                <td className="td text-right">
                  <Acciones titulo={`Corte del ${fechaBreve(c.fecha)}`}>
                    <form action={borrarCorte}>
                      <input type="hidden" name="id" value={c.id} />
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
