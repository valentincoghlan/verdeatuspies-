import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import { borrarCorte, crearCorte } from "@/lib/actions";
import { diasDesde, fechaBreve, fechaLarga, hoyISO, numero } from "@/lib/format";

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
              { titulo: "Fecha" },
              { titulo: "Lote" },
              { titulo: "Altura" },
              { titulo: "Superficie", desde: "sm" },
              { titulo: "Horas", desde: "sm" },
              { titulo: "Quién", desde: "sm" },
              { titulo: "" },
            ]}
            vacio="Todavía no cargaste cortes."
          >
            {(cortes ?? []).map((c: any) => (
              <tr key={c.id}>
                <td className="td whitespace-nowrap">{fechaBreve(c.fecha)}</td>
                <td className="td font-medium">{c.lotes?.nombre ?? "—"}</td>
                <td className="td tabular-nums">{c.altura_mm ? `${c.altura_mm} mm` : "—"}</td>
                <td className="td tabular-nums">{numero(c.superficie_m2)}</td>
                <td className="td tabular-nums">{numero(c.horas_maquina, 1)}</td>
                <td className="td">{c.responsable_texto ?? "—"}</td>
                <td className="td text-right">
                  <form action={borrarCorte}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
