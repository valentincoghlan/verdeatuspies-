import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import {
  borrarLluvia,
  descartarAlertaLluvia,
  registrarLluvia,
  sincronizarAhora,
} from "@/lib/actions";
import { fechaCorta, fechaLarga, hoyISO, mm, numero, sumarDiasISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LluviasPage() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [{ data: lotes }, { data: lluvias }, { data: pendientes }, { data: clima }] =
    await Promise.all([
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("lluvias")
        .select("*, lotes(nombre)")
        .order("fecha", { ascending: false })
        .limit(60),
      supabase
        .from("notificaciones")
        .select("*")
        .eq("tipo", "confirmar_lluvia")
        .eq("resuelta", false)
        .order("fecha_referencia", { ascending: false }),
      supabase
        .from("clima_dias")
        .select("*")
        .gte("fecha", sumarDiasISO(hoy, -7))
        .lte("fecha", sumarDiasISO(hoy, 6))
        .order("fecha"),
    ]);

  const mmMes = (lluvias ?? [])
    .filter((l: any) => l.fecha >= inicioMes)
    .reduce((a: number, l: any) => a + Number(l.mm ?? 0), 0);
  const mmAnio = (lluvias ?? [])
    .filter((l: any) => l.fecha.startsWith(hoy.slice(0, 4)))
    .reduce((a: number, l: any) => a + Number(l.mm ?? 0), 0);
  const ultima = (lluvias ?? [])[0];

  return (
    <>
      <PageHeader
        titulo="Lluvias"
        bajada="Los mm reales del pluviómetro en Cardales, contra el pronóstico."
        accion={
          <form action={sincronizarAhora}>
            <button className="btn-ghost">Actualizar clima</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="mm este mes" valor={mm(mmMes)} tono="verde" />
        <Stat label={`mm ${hoy.slice(0, 4)}`} valor={mm(mmAnio)} />
        <Stat
          label="Última lluvia"
          valor={ultima ? fechaCorta(ultima.fecha) : "—"}
          detalle={ultima ? mm(Number(ultima.mm)) : undefined}
        />
      </div>

      {(pendientes ?? []).length > 0 && (
        <div className="mt-4">
          <Card titulo="Confirmá si llovió">
            <ul className="space-y-3">
              {(pendientes ?? []).map((n: any) => (
                <li key={n.id} className="rounded-xl bg-hoja-50 p-3">
                  <p className="text-sm font-semibold">{n.titulo}</p>
                  {n.mensaje && <p className="mt-1 text-xs text-tierra-600">{n.mensaje}</p>}
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <form action={registrarLluvia} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="notificacion_id" value={n.id} />
                      <input type="hidden" name="fecha" value={n.fecha_referencia ?? hoy} />
                      <div>
                        <label className="label">mm reales</label>
                        <input
                          name="mm"
                          type="number"
                          step="0.5"
                          min="0"
                          required
                          className="input w-32"
                          placeholder="12,5"
                        />
                      </div>
                      <button className="btn">Sí, llovió</button>
                    </form>
                    <form action={descartarAlertaLluvia}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="btn-ghost">No llovió</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <Card titulo="Cargar lluvia a mano">
          <form action={registrarLluvia} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
            <Campo label="mm" name="mm" type="number" step="0.5" required placeholder="12,5" />
            <Selector
              label="Lote (opcional)"
              name="lote_id"
              vacio="Todo el campo"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
            />
            <Nota className="col-span-2" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Guardar lluvia</button>
            </div>
          </form>
        </Card>

        <Card titulo="Pronóstico vs. registrado">
          <Tabla cabeceras={["Día", "Pronóstico", "Registrado", "Temp", "ET0"]}>
            {(clima ?? []).map((d: any) => {
              const registrado = (lluvias ?? []).find((l: any) => l.fecha === d.fecha);
              const mmPron = Number(d.precipitacion_mm ?? 0);
              return (
                <tr key={d.fecha} className={d.fecha === hoy ? "bg-hoja-50" : ""}>
                  <td className="td whitespace-nowrap font-medium">
                    {fechaLarga(d.fecha)}
                    {d.es_pronostico && (
                      <span className="ml-2">
                        <Chip tono="azul">pronóstico</Chip>
                      </span>
                    )}
                  </td>
                  <td className="td tabular-nums">
                    {mm(mmPron)}
                    {d.prob_precipitacion !== null && (
                      <span className="ml-1 text-xs text-tierra-400">
                        {d.prob_precipitacion}%
                      </span>
                    )}
                  </td>
                  <td className="td tabular-nums font-semibold">
                    {registrado ? mm(Number(registrado.mm)) : "—"}
                  </td>
                  <td className="td text-xs text-tierra-600">
                    {numero(d.temp_min, 0)}° / {numero(d.temp_max, 0)}°
                  </td>
                  <td className="td tabular-nums text-xs text-tierra-600">
                    {d.et0_mm ? mm(Number(d.et0_mm)) : "—"}
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <p className="mt-3 text-xs text-tierra-400">
            ET0 es la evapotranspiración estimada: cuántos mm pierde el suelo por día. Sirve para
            decidir cuánto reponer con riego.
          </p>
        </Card>

        <Card titulo="Historial de lluvias">
          <Tabla cabeceras={["Fecha", "mm", "Lote", "Origen", ""]} vacio="Todavía no cargaste lluvias.">
            {(lluvias ?? []).map((l: any) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap">{fechaLarga(l.fecha)}</td>
                <td className="td tabular-nums font-semibold">{mm(Number(l.mm))}</td>
                <td className="td">{l.lotes?.nombre ?? "Todo el campo"}</td>
                <td className="td">
                  <Chip tono={l.origen === "confirmada_alerta" ? "azul" : "neutro"}>
                    {l.origen === "confirmada_alerta" ? "Confirmada" : "Manual"}
                  </Chip>
                </td>
                <td className="td text-right">
                  <form action={borrarLluvia}>
                    <input type="hidden" name="id" value={l.id} />
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
