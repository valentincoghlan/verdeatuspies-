import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import { borrarRiego, crearRiego, sincronizarAhora } from "@/lib/actions";
import { fechaLarga, hoyISO, mm, numero, sumarDiasISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RiegoPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const [{ data: lotes }, { data: zonas }, { data: riegos }, { data: ultimos30 }] =
    await Promise.all([
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("riego_zonas")
        .select("id, nombre, lote_id, hydrawise_relay_id, lotes(nombre)")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("riegos")
        .select("*, lotes(nombre), riego_zonas(nombre)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("riegos").select("minutos, fecha").gte("fecha", sumarDiasISO(hoy, -30)),
    ]);

  const minutos30 = (ultimos30 ?? []).reduce((a, r: any) => a + Number(r.minutos ?? 0), 0);
  const eventos30 = (ultimos30 ?? []).length;
  const zonasHydrawise = (zonas ?? []).filter((z: any) => z.hydrawise_relay_id).length;

  return (
    <>
      <PageHeader
        titulo="Riego"
        bajada="Registro manual y lo que trae Hydrawise. Cada riego queda atado a un lote."
        accion={
          <form action={sincronizarAhora}>
            <button className="btn-ghost">Traer de Hydrawise</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Riegos últimos 30 días" valor={numero(eventos30)} />
        <Stat label="Minutos últimos 30 días" valor={numero(minutos30)} tono="verde" />
        <Stat
          label="Zonas conectadas"
          valor={`${zonasHydrawise} / ${(zonas ?? []).length}`}
          detalle="Zonas con relay de Hydrawise"
        />
      </div>

      <div className="mt-4 space-y-4">
        <Card titulo="Cargar un riego">
          <form action={crearRiego} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Selector
              label="Lote"
              name="lote_id"
              required
              vacio="Elegí un lote"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
            />
            <Selector
              label="Zona (opcional)"
              name="zona_id"
              vacio="Todo el lote"
              opciones={(zonas ?? []).map((z: any) => ({
                value: z.id,
                label: z.lotes?.nombre ? `${z.nombre} · ${z.lotes.nombre}` : z.nombre,
              }))}
            />
            <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
            <Campo label="Hora" name="hora" type="time" />
            <Campo label="Minutos" name="minutos" type="number" placeholder="45" />
            <Campo label="mm aplicados" name="mm" type="number" step="0.5" placeholder="8" />
            <Nota className="col-span-2 sm:col-span-2" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Guardar riego</button>
            </div>
          </form>
        </Card>

        <Card titulo="Últimos riegos">
          <Tabla
            cabeceras={["Fecha", "Lote", "Zona", "Minutos", "mm", "Origen", ""]}
            vacio="Todavía no cargaste riegos."
          >
            {(riegos ?? []).map((r: any) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap">
                  {fechaLarga(r.fecha)}
                  {r.hora && <span className="ml-1 text-xs text-tierra-400">{r.hora.slice(0, 5)}</span>}
                </td>
                <td className="td">{r.lotes?.nombre ?? "—"}</td>
                <td className="td">{r.riego_zonas?.nombre ?? "Todo el lote"}</td>
                <td className="td tabular-nums">{numero(r.minutos)}</td>
                <td className="td tabular-nums">{r.mm ? mm(Number(r.mm)) : "—"}</td>
                <td className="td">
                  <Chip tono={r.origen === "hydrawise" ? "azul" : "neutro"}>
                    {r.origen === "hydrawise" ? "Hydrawise" : "Manual"}
                  </Chip>
                </td>
                <td className="td text-right">
                  <form action={borrarRiego}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Zonas de riego">
          <Tabla cabeceras={["Zona", "Lote", "Relay Hydrawise"]} vacio="Sin zonas todavía. Se crean solas al sincronizar Hydrawise, o a mano en Config.">
            {(zonas ?? []).map((z: any) => (
              <tr key={z.id}>
                <td className="td font-medium">{z.nombre}</td>
                <td className="td">
                  {z.lotes?.nombre ?? <Chip tono="ambar">Sin asignar</Chip>}
                </td>
                <td className="td text-tierra-600">{z.hydrawise_relay_id ?? "—"}</td>
              </tr>
            ))}
          </Tabla>
          <p className="mt-3 text-xs text-tierra-400">
            Asigná cada zona a su lote desde Config para que los riegos de Hydrawise caigan en
            el lote correcto.
          </p>
        </Card>
      </div>
    </>
  );
}
