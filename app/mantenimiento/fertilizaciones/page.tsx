import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import { Checks } from "@/components/checks";
import {
  borrarFertilizacion,
  cancelarFertilizacion,
  crearFertilizacion,
  crearFertilizante,
  marcarFertilizacionAplicada,
} from "@/lib/actions";
import { fechaBreve, fechaLarga, hoyISO, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FertilizacionesPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const [{ data: lotes }, { data: fertilizantes }, { data: programadas }, { data: historial }] =
    await Promise.all([
      supabase.from("lotes").select("id, nombre, superficie_m2").eq("activo", true).order("nombre"),
      supabase.from("fertilizantes").select("*").eq("activo", true).order("nombre"),
      supabase
        .from("fertilizaciones")
        .select("*, lotes(nombre), fertilizantes(nombre, unidad)")
        .eq("estado", "programada")
        .order("fecha_programada"),
      supabase
        .from("fertilizaciones")
        .select("*, lotes(nombre), fertilizantes(nombre, unidad)")
        .neq("estado", "programada")
        .order("fecha_aplicada", { ascending: false, nullsFirst: false })
        .limit(40),
    ]);

  const aplicadas = (historial ?? []).filter((f: any) => f.estado === "aplicada");
  const costoAnio = aplicadas
    .filter((f: any) => (f.fecha_aplicada ?? "").startsWith(hoy.slice(0, 4)))
    .reduce((a: number, f: any) => a + Number(f.costo ?? 0), 0);
  const atrasadas = (programadas ?? []).filter((f: any) => f.fecha_programada < hoy).length;

  return (
    <>
      <PageHeader
        titulo="Fertilización"
        bajada="Agendá una fertilización y la app te manda un mail cuando se acerca la fecha."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3">
        <Stat label="Agendadas" valor={numero((programadas ?? []).length)} tono="verde" />
        <Stat
          label="Atrasadas"
          valor={numero(atrasadas)}
          tono={atrasadas > 0 ? "rojo" : "neutro"}
          detalle="Pasó la fecha y siguen sin aplicar"
        />
        <Stat label={`Costo ${hoy.slice(0, 4)}`} valor={pesos(costoAnio)} />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Agendar fertilización">
          <form action={crearFertilizacion} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Checks
              label="Lotes"
              name="lote_id"
              resumenVacio="Elegí uno o los dos"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
            />
            <Checks
              label="Fertilizantes"
              name="fertilizante_id"
              resumenVacio="Elegí uno o varios"
              opciones={(fertilizantes ?? []).map((f: any) => ({ value: f.id, label: f.nombre }))}
            />
            <Campo label="Fecha programada" name="fecha_programada" type="date" required defaultValue={hoy} />
            <Campo label="Dosis por lote" name="dosis" type="number" step="0.5" placeholder="150" />
            <Selector
              label="Unidad"
              name="unidad"
              defaultValue="kg"
              opciones={[
                { value: "kg", label: "kg" },
                { value: "kg/ha", label: "kg/ha" },
                { value: "lt", label: "litros" },
                { value: "bolsas", label: "bolsas" },
              ]}
            />
            <Campo label="Superficie (m²)" name="superficie_m2" type="number" />
            <Campo label="Costo estimado" name="costo" type="number" placeholder="0" />
            <Nota className="col-span-2 sm:col-span-4" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Agendar y avisar por mail</button>
            </div>
          </form>
          <p className="mt-3 text-xs text-tierra-400">
            Podés marcar varios lotes y varios productos: se agenda una fertilización por cada
            combinación, para aplicarlas o cancelarlas por separado. El aviso sale en la corrida
            diaria, con la anticipación que definís en Ajustes (por defecto 3 días), y se repite
            como urgente si pasa la fecha sin aplicar.
          </p>
        </Card>

        <Card titulo="Agendadas">
          <Tabla
            cabeceras={["Fecha", "Lote", "Producto", "Dosis", "Costo", "Acciones", ""]}
            soloEnCompu={[3, 4]}
            vacio="No hay fertilizaciones agendadas."
          >
            {(programadas ?? []).map((f: any) => (
              <tr key={f.id}>
                <td className="td whitespace-nowrap">
                  {fechaLarga(f.fecha_programada)}
                  {f.fecha_programada < hoy && (
                    <span className="ml-2">
                      <Chip tono="rojo">atrasada</Chip>
                    </span>
                  )}
                </td>
                <td className="td font-medium">{f.lotes?.nombre}</td>
                <td className="td">{f.fertilizantes?.nombre}</td>
                <td className="td tabular-nums">
                  {f.dosis ? `${numero(f.dosis, 1)} ${f.unidad ?? "kg"}` : "—"}
                </td>
                <td className="td tabular-nums">{f.costo ? pesos(Number(f.costo)) : "—"}</td>
                <td className="td">
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={marcarFertilizacionAplicada} className="flex items-end gap-1">
                      <input type="hidden" name="id" value={f.id} />
                      <input
                        name="fecha_aplicada"
                        type="date"
                        defaultValue={hoy}
                        className="input w-full min-w-0 sm:w-36"
                      />
                      <button className="btn px-3 py-1.5">Aplicada</button>
                    </form>
                    <form action={cancelarFertilizacion}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className="text-xs font-semibold text-tierra-400 hover:text-tierra-900">
                        Cancelar
                      </button>
                    </form>
                  </div>
                </td>
                <td className="td text-right">
                  <form action={borrarFertilizacion}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Historial">
          <Tabla
            cabeceras={["Aplicada", "Lote", "Producto", "Dosis", "Costo", "Estado"]}
            soloEnCompu={[3, 4]}
            vacio="Todavía no hay fertilizaciones aplicadas."
          >
            {(historial ?? []).map((f: any) => (
              <tr key={f.id}>
                <td className="td whitespace-nowrap">{fechaBreve(f.fecha_aplicada)}</td>
                <td className="td font-medium">{f.lotes?.nombre}</td>
                <td className="td">{f.fertilizantes?.nombre}</td>
                <td className="td tabular-nums">
                  {f.dosis ? `${numero(f.dosis, 1)} ${f.unidad ?? "kg"}` : "—"}
                </td>
                <td className="td tabular-nums">{f.costo ? pesos(Number(f.costo)) : "—"}</td>
                <td className="td">
                  <Chip tono={f.estado === "aplicada" ? "verde" : "neutro"}>{f.estado}</Chip>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Productos">
          <form action={crearFertilizante} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Nombre" name="nombre" required placeholder="Urea 46%" />
            <Campo label="Tipo" name="tipo" placeholder="nitrogenado" />
            <Campo label="Unidad" name="unidad" defaultValue="kg" />
            <Campo label="Dosis por ha" name="dosis_por_ha" type="number" step="0.5" />
            <div className="col-span-2 sm:col-span-4">
              <button className="btn-ghost">Agregar producto</button>
            </div>
          </form>
          <Tabla cabeceras={["Producto", "Tipo", "Dosis/ha", "Unidad"]} soloEnCompu={[1]}>
            {(fertilizantes ?? []).map((f: any) => (
              <tr key={f.id}>
                <td className="td font-medium">{f.nombre}</td>
                <td className="td">{f.tipo ?? "—"}</td>
                <td className="td tabular-nums">{numero(f.dosis_por_ha, 1)}</td>
                <td className="td">{f.unidad}</td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
