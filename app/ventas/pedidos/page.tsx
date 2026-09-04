import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Opciones, Selector } from "@/components/campos";
import { CanalYComprador } from "@/components/comprador";
import {
  anularPedido,
  confirmarEntrega,
  crearCobro,
  crearGastoVenta,
  crearPedido,
  reprogramarPedido,
} from "@/lib/actions";
import { diasEntre, fechaBreve, fechaCorta, fechaLarga, hoyISO, m2, mm, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";



/** Cuántos días faltan, en criollo. */
function cuandoFalta(dias: number) {
  if (dias < -1) return `atrasado ${Math.abs(dias)} días`;
  if (dias === -1) return "era ayer";
  if (dias === 0) return "es hoy";
  if (dias === 1) return "es mañana";
  return `faltan ${dias} días`;
}

export default async function PedidosPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const [
    { data: clientes },
    { data: lotes },
    { data: pedidos },
    { data: margenes },
    { data: config },
    { data: cuentas },
    { data: categorias },
    { data: personas },
  ] = await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("v_pedidos_pendientes")
        .select("*")
        .order("fecha_entrega", { ascending: true, nullsFirst: false }),
      supabase.from("v_margen_ventas").select("*").order("fecha", { ascending: false }).limit(40),
      supabase
        .from("config")
        .select("clave, valor")
        .in("clave", ["umbral_lluvia_mm", "precio_m2_default"]),
      supabase.from("cuentas").select("id, nombre").eq("activa", true).order("orden"),
      supabase.from("categorias").select("*").eq("activa", true).order("orden"),
      supabase.from("personas").select("id, nombre").eq("activa", true).order("nombre"),
    ]);

  const cfg = new Map((config ?? []).map((c: any) => [c.clave, c.valor]));
  const umbral = Number(cfg.get("umbral_lluvia_mm") ?? 2);
  const precioDefault = Number(cfg.get("precio_m2_default") ?? 0) || undefined;

  const lista = (pedidos ?? []) as any[];
  const m2Comprometidos = lista.reduce((a, p) => a + Number(p.m2 ?? 0), 0);
  const aFacturar = lista.reduce((a, p) => a + Number(p.total ?? 0), 0);
  const proxima = lista.find((p) => p.fecha_entrega);
  const enRiesgo = lista.filter(
    (p) => p.precipitacion_mm !== null && Number(p.precipitacion_mm) >= umbral,
  ).length;

  const entregadas = (margenes ?? []).filter((v: any) => v.estado === "entregada");
  const clientesOpc = (clientes ?? []).map((c: any) => ({ value: c.id, label: c.nombre }));
  const clientesPorCanal = (clientes ?? []).map((c: any) => ({
    nombre: c.nombre as string,
    canal: (c.canal ?? "directa") as string,
  }));
  const lotesOpc = (lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }));
  const cuentasOpc = (cuentas ?? []).map((c: any) => ({ value: c.id, label: c.nombre }));
  const personasOpc = (personas ?? []).map((p: any) => ({ value: p.id, label: p.nombre }));

  // "Categoría · Subcategoría" en un solo desplegable.
  const padres = (categorias ?? []).filter((c: any) => !c.padre_id);
  const categoriasOpc = padres.flatMap((p: any) => {
    const hijos = (categorias ?? []).filter((c: any) => c.padre_id === p.id);
    if (hijos.length === 0) return [{ value: p.id, label: p.nombre }];
    return hijos.map((h: any) => ({ value: h.id, label: `${p.nombre} · ${h.nombre}` }));
  });

  return (
    <>
      <PageHeader
        titulo="Pedidos"
        bajada="Pasto vendido que todavía no se entregó. Recién con la entrega nace la deuda."
        accion={
          <Link href="/ventas" className="btn-ghost">
            Ventas
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="m² comprometidos"
          valor={m2(m2Comprometidos)}
          tono="verde"
          detalle={`${lista.length} pedidos pendientes`}
        />
        <Stat label="A facturar" valor={pesos(aFacturar)} detalle="Cuando se entregue" />
        <Stat
          label="Próxima entrega"
          valor={proxima ? fechaCorta(proxima.fecha_entrega) : "—"}
          detalle={proxima ? proxima.comprador : "Nada agendado"}
        />
        <Stat
          label="En riesgo por lluvia"
          valor={String(enRiesgo)}
          tono={enRiesgo > 0 ? "rojo" : "neutro"}
          detalle={`Pronóstico sobre ${umbral} mm`}
        />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Nuevo pedido">
          <form action={crearPedido} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Primero cuándo se entrega, que es lo que define todo lo demás. */}
            <Campo label="Entrega" name="fecha_entrega" type="date" required />
            <CanalYComprador clientes={clientesPorCanal} />
            <Selector
              label="Lote"
              name="lote_id"
              vacio="Sin definir"
              opciones={lotesOpc}
            />

            <Campo label="m²" name="m2" type="number" step="0.5" required placeholder="200" />
            <Campo
              label="Precio por m²"
              name="precio_m2"
              type="number"
              required
              defaultValue={precioDefault}
            />
            <Campo label="Flete" name="flete" type="number" defaultValue={0} />
            <Campo
              label="Notas"
              name="notas"
              placeholder="Opcional"
              className="col-span-2 sm:col-span-1"
            />

            <div className="col-span-2 sm:col-span-4">
              <button className="btn btn-alto">Guardar pedido</button>
            </div>
          </form>
          {clientesOpc.length === 0 && (
            <p className="mt-3 text-xs text-amber-700">
              Primero cargá un comprador en{" "}
              <Link href="/ventas/clientes" className="font-semibold underline">
                Clientes
              </Link>
              .
            </p>
          )}
        </Card>

        <Card titulo="Pedidos pendientes">
          {lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-tierra-400">No hay pedidos pendientes.</p>
          ) : (
            <ul className="space-y-3">
              {lista.map((p) => {
                const dias = p.fecha_entrega ? diasEntre(hoy, p.fecha_entrega) : null;
                const lluvia = p.precipitacion_mm !== null && Number(p.precipitacion_mm) >= umbral;
                const sena = Number(p.senado ?? 0);

                return (
                  <li
                    key={p.id}
                    className={
                      "rounded-xl border p-3 " +
                      (lluvia
                        ? "border-red-200 bg-red-50/50"
                        : dias !== null && dias <= 0
                          ? "border-hoja-200 bg-hoja-50/50"
                          : "border-tierra-200")
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{fechaLarga(p.fecha_entrega)}</span>
                          {dias !== null && (
                            <Chip tono={dias < 0 ? "rojo" : dias === 0 ? "verde" : "neutro"}>
                              {cuandoFalta(dias)}
                            </Chip>
                          )}
                          {p.precipitacion_mm === null ? (
                            <Chip>sin pronóstico</Chip>
                          ) : (
                            <Chip tono={lluvia ? "rojo" : "verde"}>
                              {mm(Number(p.precipitacion_mm))}
                              {p.prob_precipitacion !== null ? ` · ${p.prob_precipitacion}%` : ""}
                              {lluvia ? " — conviene reprogramar" : ""}
                            </Chip>
                          )}
                        </div>
                        <p className="mt-1 text-sm">
                          <span className="font-semibold">{m2(Number(p.m2))}</span> para{" "}
                          <span className="font-semibold">{p.comprador}</span>
                          {p.lote ? ` · desde ${p.lote}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-tierra-600">
                          {p.canal === "distribuidor" ? "Venta por distribuidor" : "Venta directa"}
                          {p.vinculante ? ` · ${p.vinculante}` : ""}
                          {p.cliente_final ? ` · entrega a ${p.cliente_final}` : ""}
                        </p>
                        {p.notas && <p className="mt-1 text-xs italic text-tierra-600">{p.notas}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">{pesos(Number(p.total))}</p>
                        <p className="text-xs text-tierra-600">
                          {pesos(Number(p.precio_m2))}/m²
                          {Number(p.flete) > 0 ? ` + flete ${pesos(Number(p.flete))}` : ""}
                        </p>
                        {sena > 0 && (
                          <p className="mt-1 text-xs font-semibold text-blue-700">
                            Seña: {pesos(sena)}
                          </p>
                        )}
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-hoja-700">
                        Resolver la entrega
                      </summary>
                      <div className="mt-2 space-y-2 rounded-lg bg-white p-3">
                        <form action={confirmarEntrega} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <div>
                            <label className="label">m² facturados</label>
                            <input
                              name="m2"
                              type="number"
                              step="0.5"
                              min="0"
                              required
                              defaultValue={Number(p.m2)}
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
                              defaultValue={p.fecha_entrega ?? hoy}
                              className="input w-40"
                            />
                          </div>
                          <button className="btn">Se entregó</button>
                        </form>

                        <div className="flex flex-wrap items-end gap-2 border-t border-tierra-100 pt-2">
                          <form action={reprogramarPedido} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={p.id} />
                            <div>
                              <label className="label">Fecha nueva</label>
                              <input name="fecha_entrega" type="date" required className="input w-40" />
                            </div>
                            <button className="btn-ghost">Reprogramar</button>
                          </form>
                          <form action={anularPedido}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                              Se cayó
                            </button>
                          </form>
                        </div>
                      </div>
                    </details>

                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-semibold text-tierra-600">
                        Registrar seña
                      </summary>
                      <form
                        action={crearCobro}
                        className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-white p-3"
                      >
                        <input type="hidden" name="cliente_id" value={p.cliente_id} />
                        <input type="hidden" name="venta_id" value={p.id} />
                        <div>
                          <label className="label">Monto</label>
                          <input name="monto" type="number" required className="input w-32" placeholder="0" />
                        </div>
                        <div>
                          <label className="label">Fecha</label>
                          <input name="fecha" type="date" defaultValue={hoy} className="input w-40" />
                        </div>
                        <div>
                          <label className="label">Cuenta</label>
                          <select name="cuenta_id" required className="input w-40">
                            {cuentasOpc.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button className="btn-ghost">Guardar seña</button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card titulo="Margen por operación">
          <Tabla
            cabeceras={[
              "Entrega",
              "Comprador",
              "m² fact.",
              "Cortesía",
              "Facturado",
              "Gastos",
              "Margen",
              "Pendiente",
            ]}
            vacio="Todavía no hay entregas confirmadas."
          >
            {entregadas.map((v: any) => {
              const facturado = Number(v.facturado ?? 0);
              const margen = Number(v.margen ?? 0);
              const pct = facturado > 0 ? (margen / facturado) * 100 : 0;
              return (
                <tr key={v.venta_id}>
                  <td className="td whitespace-nowrap">{fechaBreve(v.fecha_entrega)}</td>
                  <td className="td font-medium">
                    {v.comprador}
                    {v.vinculante && (
                      <span className="block text-xs font-normal text-tierra-400">
                        vía {v.vinculante}
                      </span>
                    )}
                  </td>
                  <td className="td tabular-nums">{numero(Number(v.m2))}</td>
                  <td className="td tabular-nums text-tierra-600">
                    {Number(v.m2_cortesia) > 0 ? numero(Number(v.m2_cortesia)) : "—"}
                  </td>
                  <td className="td tabular-nums font-semibold">{pesos(facturado)}</td>
                  <td className="td tabular-nums text-amber-700">
                    {Number(v.gastos) > 0 ? pesos(Number(v.gastos)) : "—"}
                  </td>
                  <td className="td tabular-nums font-semibold text-hoja-700">
                    {pesos(margen)}
                    <span className="ml-1 text-xs font-normal text-tierra-400">{numero(pct)}%</span>
                  </td>
                  <td
                    className={
                      "td tabular-nums " +
                      (Number(v.pendiente) > 0
                        ? "font-semibold text-amber-700"
                        : "text-tierra-400")
                    }
                  >
                    {pesos(Number(v.pendiente))}
                  </td>
                </tr>
              );
            })}
          </Tabla>
        </Card>

      </div>
    </>
  );
}
