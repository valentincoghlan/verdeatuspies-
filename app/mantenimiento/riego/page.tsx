import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Plegable, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import {
  borrarLluvia,
  borrarRiego,
  crearRiego,
  descartarAlertaLluvia,
  regarZona,
  registrarLluvia,
  sincronizarAhora,
  suspenderRiego,
} from "@/lib/actions";
import { ControlRiego } from "@/components/control-riego";
import { BalanceAgua } from "@/components/balance-agua";
import { RiegosProgramados } from "@/components/riegos-programados";
import { CancelarRiegos } from "@/components/cancelar-riegos";
import { fechaBreve, fechaCorta, fechaLarga, hoyISO, mm, numero, sumarDiasISO } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Riego y lluvias, en una sola pantalla.
 *
 * Van juntas porque se leen juntas: cuánto hay que regar depende de
 * cuánto llovió y de cuánta agua perdió el campo. Separadas obligaban a
 * ir y venir entre dos páginas para tomar una sola decisión.
 */
export default async function AguaPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const supabase = await createClient();
  const hoy = hoyISO();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [
    { data: lotes },
    { data: zonas },
    { data: riegos },
    { data: lluvias },
    { data: pendientes },
    { data: clima },
    { data: ultimoSync },
  ] = await Promise.all([
    supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("riego_zonas")
      .select(
        "id, nombre, lote_id, hydrawise_relay_id, mm_por_hora, proximo_riego_at, proximo_minutos, suspendida_hasta, lotes(nombre)",
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("riegos")
      .select("*, lotes(nombre), riego_zonas(nombre)")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
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
    supabase
      .from("hydrawise_snapshots")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const listaRiegos = (riegos ?? []) as any[];
  const listaLluvias = (lluvias ?? []) as any[];

  const mmMes = listaLluvias
    .filter((l) => l.fecha >= inicioMes)
    .reduce((a, l) => a + Number(l.mm ?? 0), 0);
  const ultima = listaLluvias[0];
  const desde30 = sumarDiasISO(hoy, -30);
  const riegos30 = listaRiegos.filter((r) => r.fecha >= desde30);
  const zonasHydrawise = (zonas ?? []).filter((z: any) => z.hydrawise_relay_id).length;

  const opcionesLote = (lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }));

  // Qué zonas están regando ahora mismo. Se saca de lo que ordenó la app
  // y no de Hydrawise: preguntarle en cada carga de página nos comería el
  // límite de consultas de la API.
  const ahora = Date.now();
  const control = (zonas ?? []).map((z: any) => {
    const abierto = listaRiegos.find(
      (r) => r.zona_id === z.id && r.origen === "app" && r.minutos,
    );
    const restante = abierto
      ? Number(abierto.minutos) -
        Math.floor((ahora - new Date(abierto.created_at).getTime()) / 60000)
      : 0;
    return {
      id: z.id as string,
      nombre: z.nombre as string,
      lote: (z.lotes?.nombre ?? null) as string | null,
      conectada: Boolean(z.hydrawise_relay_id),
      corriendo: restante > 0 ? restante : null,
    };
  });
  const regando = control.filter((z) => z.corriendo).length;

  const programadas = (zonas ?? []).map((z: any) => ({
    id: z.id as string,
    nombre: z.nombre as string,
    loteId: (z.lote_id ?? null) as string | null,
    lote: (z.lotes?.nombre ?? null) as string | null,
    proximo: (z.proximo_riego_at ?? null) as string | null,
    minutos: (z.proximo_minutos ?? null) as number | null,
    mmPorHora: (z.mm_por_hora ?? null) as number | null,
    suspendidaHasta: (z.suspendida_hasta ?? null) as string | null,
  }));
  const conRiegoProgramado = programadas.filter((z) => z.proximo).length;
  // El encabezado habla de lo mismo que muestra la lista: 24 horas.
  const proximas24 = programadas.filter((z) => {
    if (!z.proximo || z.suspendidaHasta) return false;
    const falta = new Date(z.proximo).getTime() - Date.now();
    return falta > -3600_000 && falta < 24 * 3600_000;
  }).length;

  // Los programas los cambiás en Hydrawise, no acá: si el dato quedó
  // viejo, la agenda que ves no es la que va a correr.
  const sincronizado = ultimoSync?.created_at ? new Date(ultimoSync.created_at) : null;
  const horasDesdeSync = sincronizado
    ? Math.floor((Date.now() - sincronizado.getTime()) / 3600000)
    : -1;
  const frenadas = programadas.filter((z) => z.suspendidaHasta).length;
  const opcionesLoteSimple = (lotes ?? []).map((l: any) => ({
    id: l.id as string,
    nombre: l.nombre as string,
  }));

  // Qué día cae cada riego programado, para poder mostrarlo en la tabla
  // del agua. Solo conocemos el PRÓXIMO de cada zona: la API no dice si
  // el programa se repite martes y viernes.
  const fechaAR = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

  const planPorDia = new Map<string, { minutos: number; mm: number; zonas: number }>();
  for (const z of programadas) {
    if (!z.proximo || z.suspendidaHasta) continue;
    const dia = fechaAR(z.proximo);
    const acum = planPorDia.get(dia) ?? { minutos: 0, mm: 0, zonas: 0 };
    acum.minutos += z.minutos ?? 0;
    acum.mm += z.minutos && z.mmPorHora ? (z.minutos / 60) * Number(z.mmPorHora) : 0;
    acum.zonas += 1;
    planPorDia.set(dia, acum);
  }

  const diasAgua = (clima ?? []).map((d: any) => {
    const delDia = <T extends { fecha: string }>(xs: T[]) => xs.filter((x) => x.fecha === d.fecha);
    const riegosDia = delDia(listaRiegos);
    const plan = planPorDia.get(d.fecha);
    return {
      fecha: d.fecha as string,
      esPronostico: Boolean(d.es_pronostico),
      pronosticoMm: Number(d.precipitacion_mm ?? 0),
      probabilidad: d.prob_precipitacion ?? null,
      lluviaMm: delDia(listaLluvias).reduce((a, l) => a + Number(l.mm ?? 0), 0),
      riegoMin: riegosDia.reduce((a, r) => a + Number(r.minutos ?? 0), 0),
      riegoMm: riegosDia.reduce((a, r) => a + Number(r.mm ?? 0), 0),
      planMin: plan?.minutos ?? 0,
      planMm: plan?.mm ?? 0,
      planZonas: plan?.zonas ?? 0,
      et0: Number(d.et0_mm ?? 0),
    };
  });

  return (
    <>
      <PageHeader
        titulo="Riego y lluvias"
        bajada="Lo que cayó del cielo y lo que pusimos nosotros. Se miran juntos: cuánto regar depende de cuánto llovió."
        accion={
          <div className="flex flex-wrap gap-2">
            <CancelarRiegos
              lotes={opcionesLoteSimple}
              hayFrenadas={frenadas > 0}
              accion={suspenderRiego}
            />
            <form action={sincronizarAhora}>
              <button className="btn-ghost">Actualizar</button>
            </form>
          </div>
        }
      />

      {aviso && (
        <div className="mb-3 rounded-2xl border border-atencion-tx/30 bg-atencion-bg p-3 text-sm text-atencion-tx">
          {aviso}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="Llovió este mes" valor={mm(mmMes)} destacado />
        <Stat
          label="Última lluvia"
          valor={ultima ? fechaCorta(ultima.fecha) : "—"}
          detalle={ultima ? mm(Number(ultima.mm)) : "Sin registros"}
        />
        <Stat
          label="Riegos 30 días"
          valor={numero(riegos30.length)}
          tono="verde"
          detalle={regando ? `${regando} zona(s) regando ahora` : undefined}
        />
        <Stat
          label="Zonas conectadas"
          valor={`${zonasHydrawise} / ${(zonas ?? []).length}`}
          detalle="Con relay de Hydrawise"
        />
      </div>

      {(pendientes ?? []).length > 0 && (
        <div className="mt-3">
          <Card titulo="Confirmá si llovió">
            <ul className="space-y-3">
              {(pendientes ?? []).map((n: any) => (
                <li key={n.id} className="rounded-xl bg-hecho-bg p-3">
                  <p className="text-sm font-semibold text-tinta">{n.titulo}</p>
                  {n.mensaje && <p className="mt-1 text-xs text-tinta-2">{n.mensaje}</p>}
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

      <div className="mt-3 space-y-3">
        {/* El balance: lo que entró de agua contra lo que el campo perdió. */}
        <Card titulo="El agua, día por día">
          <BalanceAgua dias={diasAgua} hoy={hoy} />
          <p className="mt-3 text-xs text-tinta-2">
            <strong>ET₀</strong> es cuántos milímetros de agua pierde el campo por día, entre lo
            que se evapora del suelo y lo que transpira la planta. <strong>Queda</strong> es el
            total que entró menos eso: si está en rojo, ese día el pasto quedó debiendo agua.
          </p>
        </Card>

        <Plegable
          titulo="Riegos programados"
          detalle={
            frenadas
              ? `${frenadas} frenada${frenadas === 1 ? "" : "s"}`
              : proximas24
                ? `${proximas24} zonas en las próximas 24 h`
                : "nada en las próximas 24 h"
          }
          abierta={frenadas > 0 || proximas24 > 0}
        >
          <p className="mb-2 text-sm text-tinta-2">
            Los programas se cargan en la app de Hydrawise, que es hardware y no depende de nada
            para funcionar. Acá ves <strong>las próximas 24 horas</strong>, con los milímetros que
            va a dar cada riego, y podés frenarlos hasta el día y la hora que quieras.
          </p>
          <p
            className={
              "mb-3 text-xs " +
              (horasDesdeSync >= 24 ? "text-atencion-tx" : "text-tinta-3")
            }
          >
            {sincronizado === null
              ? "Nunca se consultó al controlador. Tocá Actualizar."
              : horasDesdeSync === 0
                ? "Datos del controlador traídos recién."
                : horasDesdeSync < 24
                  ? `Datos del controlador de hace ${horasDesdeSync} h.`
                  : `Datos del controlador de hace ${Math.floor(horasDesdeSync / 24)} día(s). Si cambiaste un programa en Hydrawise, tocá Actualizar.`}
          </p>
          <RiegosProgramados zonas={programadas} suspender={suspenderRiego} />
        </Plegable>

        <Plegable
          titulo="Abrir el riego"
          detalle={regando ? `${regando} regando ahora` : `${zonasHydrawise} zonas`}
          abierta={regando > 0}
        >
          <p className="mb-3 text-sm text-tinta-2">
            Esto abre el agua de verdad, ahora. Cada riego que se ordena desde acá queda
            registrado con los minutos exactos: es la única forma de tener el historial fiel,
            porque Hydrawise no lo guarda.
          </p>
          <ControlRiego zonas={control} accion={regarZona} />
        </Plegable>

        <Plegable titulo="Cargar a mano" detalle="un riego viejo o una lluvia">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card titulo="Cargar un riego">
            <form action={crearRiego} className="grid grid-cols-2 gap-3">
              <Selector
                label="Lote"
                name="lote_id"
                required
                vacio="Elegí un lote"
                opciones={opcionesLote}
                className="col-span-2 sm:col-span-1"
              />
              <Selector
                label="Zona"
                name="zona_id"
                vacio="Todo el lote"
                opciones={(zonas ?? []).map((z: any) => ({
                  value: z.id,
                  label: z.lotes?.nombre ? `${z.nombre} · ${z.lotes.nombre}` : z.nombre,
                }))}
                className="col-span-2 sm:col-span-1"
              />
              <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
              <Campo label="Hora" name="hora" type="time" />
              <Campo label="Minutos" name="minutos" type="number" placeholder="45" />
              <Campo label="mm aplicados" name="mm" type="number" step="0.5" placeholder="8" />
              <Nota className="col-span-2" />
              <div className="col-span-2">
                <button className="btn btn-alto">Guardar riego</button>
              </div>
            </form>
          </Card>

          <Card titulo="Cargar una lluvia">
            <form action={registrarLluvia} className="grid grid-cols-2 gap-3">
              <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
              <Campo label="mm" name="mm" type="number" step="0.5" required placeholder="12,5" />
              <Selector
                label="Lote"
                name="lote_id"
                vacio="Todo el campo"
                opciones={opcionesLote}
                className="col-span-2"
              />
              <Nota className="col-span-2" />
              <div className="col-span-2">
                <button className="btn btn-alto">Guardar lluvia</button>
              </div>
            </form>
          </Card>
        </div>
        </Plegable>

        <Plegable titulo="Últimos riegos" detalle={`${listaRiegos.length} registros`}>
          <Tabla
            cabeceras={["Fecha", "Lote", "Zona", "Minutos", "mm", "Origen", ""]}
            soloEnCompu={[2]}
            vacio="Todavía no hay riegos cargados."
          >
            {listaRiegos.map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap">
                  {fechaBreve(r.fecha)}
                  {r.hora && <span className="ml-1 text-xs text-tinta-3">{r.hora.slice(0, 5)}</span>}
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
                    <button className="text-xs font-semibold text-tinta-3 hover:text-urgente-tx">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Plegable>

        <Plegable titulo="Historial de lluvias" detalle={`${listaLluvias.length} registros`}>
          <Tabla
            cabeceras={["Fecha", "mm", "Lote", "Origen", ""]}
            vacio="Todavía no cargaste lluvias."
          >
            {listaLluvias.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap">{fechaBreve(l.fecha)}</td>
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
                    <button className="text-xs font-semibold text-tinta-3 hover:text-urgente-tx">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Plegable>
      </div>
    </>
  );
}
