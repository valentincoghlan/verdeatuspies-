import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { diasDesde, fechaCorta, hoyISO, m2, mm, numero, pesos, sumarDiasISO } from "@/lib/format";
import {
  descartarAlertaLluvia,
  registrarLluvia,
  resolverNotificacion,
  sincronizarAhora,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [
    { data: notis },
    { data: lotes },
    { data: clima },
    { data: ventasMes },
    { data: cobrosMes },
    { data: pagosMes },
    { data: cuentas },
    { data: fertProx },
  ] = await Promise.all([
    supabase
      .from("notificaciones")
      .select("*")
      .eq("resuelta", false)
      .order("severidad")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("v_estado_lotes").select("*").order("nombre"),
    supabase
      .from("clima_dias")
      .select("*")
      .gte("fecha", hoy)
      .lte("fecha", sumarDiasISO(hoy, 5))
      .order("fecha"),
    supabase.from("ventas").select("m2, total, estado").gte("fecha", inicioMes).neq("estado", "anulada"),
    supabase.from("cobros").select("monto").gte("fecha", inicioMes),
    supabase.from("pagos").select("monto").gte("fecha", inicioMes),
    supabase.from("v_cuenta_clientes").select("saldo"),
    supabase
      .from("fertilizaciones")
      .select("id, fecha_programada, dosis, unidad, lotes(nombre), fertilizantes(nombre)")
      .eq("estado", "programada")
      .order("fecha_programada")
      .limit(5),
  ]);

  const m2Mes = (ventasMes ?? []).reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const facturadoMes = (ventasMes ?? []).reduce((a, v: any) => a + Number(v.total ?? 0), 0);
  const cobradoMes = (cobrosMes ?? []).reduce((a, c: any) => a + Number(c.monto ?? 0), 0);
  const pagadoMes = (pagosMes ?? []).reduce((a, p: any) => a + Number(p.monto ?? 0), 0);
  const porCobrar = (cuentas ?? []).reduce(
    (a, c: any) => a + Math.max(0, Number(c.saldo ?? 0)),
    0,
  );

  const tono = (s: string) => (s === "urgente" ? "rojo" : s === "aviso" ? "ambar" : "azul");

  return (
    <>
      <PageHeader
        titulo="Inicio"
        bajada="Todo el campo en una pantalla: pendientes, estado de los lotes y plata del mes."
        accion={
          <form action={sincronizarAhora}>
            <button className="btn-ghost">Sincronizar ahora</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="m² vendidos este mes" valor={m2(m2Mes)} detalle={`${(ventasMes ?? []).length} operaciones`} />
        <Stat label="Facturado este mes" valor={pesos(facturadoMes)} tono="verde" />
        <Stat label="Cobrado este mes" valor={pesos(cobradoMes)} detalle={`Pagos: ${pesos(pagadoMes)}`} />
        <Stat
          label="Por cobrar"
          valor={pesos(porCobrar)}
          tono={porCobrar > 0 ? "ambar" : "neutro"}
          detalle="Saldo de todos los clientes"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card titulo="Pendientes y alertas" id="alertas">
            {(notis ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-tierra-400">
                No hay nada pendiente. Todo al día.
              </p>
            ) : (
              <ul className="divide-y divide-tierra-100">
                {(notis ?? []).map((n: any) => (
                  <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Chip tono={tono(n.severidad) as any}>{n.severidad}</Chip>
                          <span className="text-sm font-semibold">{n.titulo}</span>
                        </div>
                        {n.mensaje && (
                          <p className="mt-1 text-sm text-tierra-600">{n.mensaje}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {n.accion_url && (
                          <Link
                            href={n.accion_url}
                            className="text-xs font-semibold text-hoja-700 hover:underline"
                          >
                            Ir
                          </Link>
                        )}
                        {n.tipo !== "confirmar_lluvia" && (
                          <form action={resolverNotificacion}>
                            <input type="hidden" name="id" value={n.id} />
                            <button className="text-xs font-semibold text-tierra-400 hover:text-tierra-900">
                              Listo
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    {n.tipo === "confirmar_lluvia" && (
                      <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-hoja-50 p-3">
                        <form action={registrarLluvia} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="notificacion_id" value={n.id} />
                          <input type="hidden" name="fecha" value={n.fecha_referencia ?? hoy} />
                          <div>
                            <label className="label">mm del pluviómetro</label>
                            <input
                              name="mm"
                              type="number"
                              step="0.5"
                              min="0"
                              required
                              className="input w-36"
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
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card titulo="Estado de los lotes">
            <Tabla cabeceras={["Lote", "Último corte", "Último riego", "Última fertilización", "Próxima fert."]}>
              {(lotes ?? []).map((l: any) => {
                const d = diasDesde(l.ultimo_corte);
                const atrasado = d !== null && d >= Number(l.dias_objetivo_corte ?? 14);
                return (
                  <tr key={l.lote_id}>
                    <td className="td font-semibold">
                      {l.nombre}
                      {l.superficie_m2 && (
                        <span className="ml-2 text-xs font-normal text-tierra-400">
                          {m2(Number(l.superficie_m2))}
                        </span>
                      )}
                    </td>
                    <td className="td">
                      {l.ultimo_corte ? (
                        <span className={atrasado ? "font-semibold text-amber-700" : ""}>
                          {fechaCorta(l.ultimo_corte)} · hace {d}d
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="td">
                      {l.ultimo_riego ? `${fechaCorta(l.ultimo_riego)} · hace ${diasDesde(l.ultimo_riego)}d` : "—"}
                    </td>
                    <td className="td">{fechaCorta(l.ultima_fertilizacion)}</td>
                    <td className="td">
                      {l.proxima_fertilizacion ? (
                        <Chip tono="verde">{fechaCorta(l.proxima_fertilizacion)}</Chip>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Clima en Cardales">
            {(clima ?? []).length === 0 ? (
              <p className="py-4 text-sm text-tierra-400">
                Todavía sin datos. Tocá “Sincronizar ahora”.
              </p>
            ) : (
              <ul className="space-y-2">
                {(clima ?? []).map((d: any) => {
                  const mmDia = Number(d.precipitacion_mm ?? 0);
                  return (
                    <li
                      key={d.fecha}
                      className="flex items-center justify-between gap-2 rounded-xl bg-tierra-50 px-3 py-2"
                    >
                      <span className="text-sm font-medium">
                        {d.fecha === hoy ? "Hoy" : fechaCorta(d.fecha)}
                      </span>
                      <span className="text-xs text-tierra-600">
                        {numero(d.temp_min, 0)}° / {numero(d.temp_max, 0)}°
                      </span>
                      <span
                        className={
                          "text-sm font-semibold tabular-nums " +
                          (mmDia >= 2 ? "text-blue-700" : "text-tierra-400")
                        }
                      >
                        {mm(mmDia)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card titulo="Próximas fertilizaciones">
            {(fertProx ?? []).length === 0 ? (
              <p className="py-4 text-sm text-tierra-400">Nada agendado.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(fertProx ?? []).map((f: any) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span>
                      <strong>{fechaCorta(f.fecha_programada)}</strong> ·{" "}
                      {f.fertilizantes?.nombre ?? "Fertilizante"}
                    </span>
                    <span className="text-xs text-tierra-600">{f.lotes?.nombre}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/mantenimiento/fertilizaciones"
              className="mt-3 inline-block text-xs font-semibold text-hoja-700 hover:underline"
            >
              Agendar una fertilización →
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
