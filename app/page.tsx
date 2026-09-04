import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { diasDesde, fechaCorta, fechaLarga, hoyISO, m2, mm, numero, pesos, sumarDiasISO } from "@/lib/format";
import {
  anularPedido,
  confirmarEntrega,
  descartarAlertaLluvia,
  registrarLluvia,
  reprogramarPedido,
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
    { data: fertProx },
    { data: pedidosPend },
    { data: dolar },
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
    supabase
      .from("ventas")
      .select("m2, total, estado")
      .gte("fecha", inicioMes)
      .in("estado", ["confirmada", "entregada"]),
    supabase.from("movimientos").select("monto").eq("tipo", "I").gte("fecha", inicioMes),
    supabase.from("movimientos").select("monto").eq("tipo", "E").gte("fecha", inicioMes),
    supabase
      .from("fertilizaciones")
      .select("id, fecha_programada, dosis, unidad, lotes(nombre), fertilizantes(nombre)")
      .eq("estado", "programada")
      .order("fecha_programada")
      .limit(5),
    supabase.from("v_pedidos_pendientes").select("*").order("fecha_entrega"),
    supabase
      .from("cotizaciones")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const m2Mes = (ventasMes ?? []).reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const m2Comprometidos = (pedidosPend ?? []).reduce((a, p: any) => a + Number(p.m2 ?? 0), 0);
  const vendidoMes = (ventasMes ?? []).reduce((a, v: any) => a + Number(v.total ?? 0), 0);
  const cobradoMes = (cobrosMes ?? []).reduce((a, c: any) => a + Number(c.monto ?? 0), 0);
  const pagadoMes = (pagosMes ?? []).reduce((a, p: any) => a + Number(p.monto ?? 0), 0);

  const franja = (s: string) =>
    s === "urgente"
      ? "bg-urgente-bg text-urgente-tx"
      : s === "aviso"
        ? "bg-atencion-bg text-atencion-tx"
        : "bg-info-bg text-info-tx";

  // Para prellenar el formulario de "se entregó" con los datos del pedido.
  const pedidoPorId = new Map((pedidosPend ?? []).map((p: any) => [p.id, p]));

  // Alertas que se resuelven con su propio formulario, no con el botón "Listo".
  const CON_FORMULARIO = ["confirmar_lluvia", "confirmar_entrega"];

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

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Stat
          label="m² vendidos este mes"
          valor={m2(m2Mes)}
          tono="verde"
          detalle={`${(ventasMes ?? []).length} operaciones`}
        />
        <Stat
          label="m² pedidos a entregar"
          valor={m2(m2Comprometidos)}
          tono={m2Comprometidos > 0 ? "ambar" : "neutro"}
          detalle={`${(pedidosPend ?? []).length} pedidos pendientes`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <Stat
          label="Dólar MEP"
          valor={dolar ? pesos(Number(dolar.mep), 2) : "—"}
          detalle={
            dolar
              ? `Al ${fechaLarga(dolar.fecha)}${dolar.fecha === hoy ? "" : " · sincronizá para actualizar"}`
              : "Tocá Sincronizar ahora"
          }
        />
        <Stat label="Vendido este mes" valor={pesos(vendidoMes)} tono="verde" />
        <Stat label="Cobrado este mes" valor={pesos(cobradoMes)} detalle={`Pagos: ${pesos(pagadoMes)}`} />
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-4">
          <Card titulo="Pendientes y alertas" id="alertas">
            {(notis ?? []).length === 0 ? (
              <p className="rounded-[16px] bg-crema py-8 text-center text-[15px] text-tinta-2">
                No hay nada pendiente. Todo al día.
              </p>
            ) : (
              <ul className="space-y-3">
                {(notis ?? []).map((n: any) => (
                  <li
                    key={n.id}
                    className="overflow-hidden rounded-[20px] border border-borde bg-white shadow-[0_1px_2px_rgba(26,29,24,.05)]"
                  >
                    {/* La urgencia vive en la franja de arriba, no en un borde
                        de costado: el cuerpo queda blanco y los campos se leen. */}
                    <div
                      className={
                        "flex items-center justify-between gap-2 px-[18px] py-3 " + franja(n.severidad)
                      }
                    >
                      <span className="text-xs font-extrabold uppercase tracking-[.08em]">
                        {n.severidad}
                      </span>
                      {n.fecha_referencia && (
                        <span className="text-[12.5px] font-semibold">
                          {fechaCorta(n.fecha_referencia)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-4 p-[18px]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[19px] font-bold leading-tight text-pasto-oscuro">
                            {n.titulo}
                          </p>
                          {n.mensaje && (
                            <p className="mt-1.5 text-[15px] leading-relaxed text-tinta-2">
                              {n.mensaje}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {n.accion_url && (
                            <Link
                              href={n.accion_url}
                              className="text-sm font-semibold text-pasto hover:underline"
                            >
                              Ir
                            </Link>
                          )}
                          {!CON_FORMULARIO.includes(n.tipo) && (
                            <form action={resolverNotificacion}>
                              <input type="hidden" name="id" value={n.id} />
                              <button className="text-sm font-semibold text-tinta-3 hover:text-tinta">
                                Listo
                              </button>
                            </form>
                          )}
                        </div>
                      </div>

                    {n.tipo === "confirmar_lluvia" && (
                      <div className="flex flex-wrap items-end gap-2">
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

                    {n.tipo === "confirmar_entrega" && (
                      <div className="space-y-3">
                        <form
                          action={confirmarEntrega}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="id" value={n.entidad_id} />
                          <div>
                            <label className="label">m² facturados</label>
                            <input
                              name="m2"
                              type="number"
                              step="0.5"
                              min="0"
                              required
                              defaultValue={Number(pedidoPorId.get(n.entidad_id)?.m2 ?? 0)}
                              className="input w-28"
                            />
                          </div>
                          <div>
                            <label className="label">m² de cortesía</label>
                            <input
                              name="m2_cortesia"
                              type="number"
                              step="0.5"
                              min="0"
                              defaultValue={0}
                              className="input w-28"
                            />
                          </div>
                          <div>
                            <label className="label">Fecha</label>
                            <input
                              name="fecha_entrega"
                              type="date"
                              defaultValue={n.fecha_referencia ?? hoy}
                              className="input w-40"
                            />
                          </div>
                          <button className="btn">Se entregó</button>
                        </form>

                        <div className="flex flex-wrap items-end gap-2 border-t border-beige pt-3">
                          <form
                            action={reprogramarPedido}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input type="hidden" name="id" value={n.entidad_id} />
                            <div>
                              <label className="label">Fecha nueva</label>
                              <input
                                name="fecha_entrega"
                                type="date"
                                required
                                className="input w-40"
                              />
                            </div>
                            <button className="btn-ghost">Reprogramar</button>
                          </form>
                          <form action={anularPedido}>
                            <input type="hidden" name="id" value={n.entidad_id} />
                            <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                              Se cayó
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                    </div>
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

        <div className="min-w-0 space-y-4">
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
