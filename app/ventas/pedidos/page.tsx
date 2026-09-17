import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Opciones, Selector } from "@/components/campos";
import { CanalYComprador } from "@/components/comprador";
import { Dato } from "@/components/dato";
import { ConfirmarEntrega } from "@/components/confirmar-entrega";
import { EditarVenta } from "@/components/editar-venta";
import {
  anularPedido,
  borrarVenta,
  confirmarEntrega,
  crearCobro,
  crearGastoVenta,
  crearPedido,
  deshacerEntrega,
  editarVenta,
  reprogramarPedido,
} from "@/lib/actions";
import { diasEntre, fechaBreve, fechaCorta, fechaLarga, hoyISO, m2, mm, numero, pesos } from "@/lib/format";
import { Formulario, Guardar } from "@/components/guardar";

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
    { data: estados },
    { data: pedidos },
    { data: margenes },
    { data: config },
    { data: cuentas },
    { data: categorias },
    { data: personas },
    { data: entregas },
  ] = await Promise.all([
      // El canal hace falta acá: sin él, el buscador no sabe quién es
      // distribuidor y ofrece crear un cliente que ya existe.
      supabase.from("clientes").select("id, nombre, canal").eq("activo", true).order("nombre"),
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      // v_pedidos_pendientes no trae el estado y EditarVenta lo necesita
      // para no pisarlo al guardar. Son dos o tres filas: sale barato.
      supabase.from("ventas").select("id, estado").in("estado", ["pedido", "cosechada"]),
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
      // Quién estuvo de cada lado no está en v_margen_ventas y el modal
      // de corregir lo tiene que mostrar ya cargado: si no, arreglar los
      // metros borraría de paso el nombre del que entregó.
      supabase
        .from("ventas")
        .select("id, quien_entrega, quien_retira")
        .eq("estado", "entregada")
        .order("fecha_entrega", { ascending: false })
        .limit(60),
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
  const cuentasOpc = (cuentas ?? []).map((c: any) => ({ value: c.id, label: c.nombre }));
  const personasOpc = (personas ?? []).map((p: any) => ({ value: p.id, label: p.nombre }));

  // "Categoría · Subcategoría" en un solo desplegable.
  const padres = (categorias ?? []).filter((c: any) => !c.padre_id);
  const categoriasOpc = padres.flatMap((p: any) => {
    const hijos = (categorias ?? []).filter((c: any) => c.padre_id === p.id);
    if (hijos.length === 0) return [{ value: p.id, label: p.nombre }];
    return hijos.map((h: any) => ({ value: h.id, label: `${p.nombre} · ${h.nombre}` }));
  });

  const quienDe = new Map(
    ((entregas ?? []) as any[]).map((x) => [
      x.id as string,
      { entrega: x.quien_entrega as string | null, retira: x.quien_retira as string | null },
    ]),
  );

  const estadoDe = new Map(
    ((estados ?? []) as any[]).map((x) => [x.id as string, x.estado as string]),
  );

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
          label="m² por entregar"
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
          <Formulario action={crearPedido} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Primero cuándo se entrega, que es lo que define todo lo demás. */}
            <Campo label="Entrega" name="fecha_entrega" type="date" required />
            <CanalYComprador clientes={clientesPorCanal} />
            <Campo label="m²" name="m2" type="number" step="0.5" required placeholder="200" />
            <Campo
              label="Precio por m²"
              name="precio_m2"
              type="number"
              required
              defaultValue={precioDefault}
            />
            <Campo
              label="Notas"
              name="notas"
              placeholder="Opcional"
              className="col-span-2"
            />

            <div className="col-span-2 sm:col-span-4">
              <Guardar className="btn btn-alto">Guardar pedido</Guardar>
            </div>
          </Formulario>
          {clientesOpc.length === 0 && (
            <p className="mt-3 text-xs text-atencion-tx">
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
            <p className="py-6 text-center text-sm text-tinta-3">No hay pedidos pendientes.</p>
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
                        ? "border-urgente-tx/30 bg-urgente-bg"
                        : dias !== null && dias <= 0
                          ? "border-pasto/30 bg-hecho-bg"
                          : "border-borde")
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
                        <p className="mt-0.5 text-xs text-tinta-2">
                          {p.canal === "distribuidor" ? "Venta por distribuidor" : "Venta directa"}
                          {p.vinculante ? ` · ${p.vinculante}` : ""}
                          {p.cliente_final ? ` · entrega a ${p.cliente_final}` : ""}
                        </p>
                        {p.notas && <p className="mt-1 text-xs italic text-tinta-2">{p.notas}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">{pesos(Number(p.total))}</p>
                        <p className="text-xs text-tinta-2">
                          {pesos(Number(p.precio_m2))}/m²
                          {Number(p.flete) > 0 ? ` + flete ${pesos(Number(p.flete))}` : ""}
                        </p>
                        {sena > 0 && (
                          <p className="mt-1 text-xs font-semibold text-info-tx">
                            Seña: {pesos(sena)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* El mismo modal que en Inicio y en Cosecha: la
                        entrega se resuelve igual desde donde estés. */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <ConfirmarEntrega
                        pedidoId={p.id}
                        comprador={p.comprador ?? "Sin comprador"}
                        m2={Number(p.m2 ?? 0)}
                        fecha={p.fecha_entrega ?? hoy}
                        etiqueta="Resolver la entrega"
                        confirmar={confirmarEntrega}
                        reprogramar={reprogramarPedido}
                        anular={anularPedido}
                      />
                      {/* Un pedido cambia antes de salir: piden más metros,
                          se corre la fecha, se negocia el precio. Hasta hoy
                          había que ir a Ventas a buscarlo. */}
                      <EditarVenta
                        venta={{
                          id: p.id,
                          comprador: p.comprador ?? "Sin comprador",
                          fecha: p.fecha,
                          fecha_entrega: p.fecha_entrega,
                          m2: Number(p.m2 ?? 0),
                          precio_m2: Number(p.precio_m2 ?? 0),
                          flete: Number(p.flete ?? 0),
                          estado: estadoDe.get(p.id) ?? "pedido",
                          lote_id: p.lote_id,
                          notas: p.notas,
                        }}
                        lotes={(lotes ?? []) as any[]}
                        accion={editarVenta}
                        borrar={borrarVenta}
                      />
                    </div>

                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-semibold text-tinta-2">
                        Registrar seña
                      </summary>
                      <Formulario
                        action={crearCobro}
                        className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-white p-3"
                      >
                        <input type="hidden" name="cliente_id" value={p.cliente_id} />
                        <input type="hidden" name="venta_id" value={p.id} />

                        <div className="min-w-0">
                          <label className="label">Monto</label>
                          <input
                            name="monto"
                            type="number"
                            required
                            className="input"
                            placeholder="0"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="label">Fecha</label>
                          <input name="fecha" type="date" defaultValue={hoy} className="input" />
                        </div>

                        <div className="min-w-0">
                          <label className="label">Cuenta</label>
                          <select name="cuenta_id" required className="input">
                            {cuentasOpc.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <Guardar className="btn-ghost w-full">Guardar seña</Guardar>
                        </div>
                      </Formulario>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card titulo="Margen por operación">
          <Tabla
            columnas={[
              // La fecha entera, con año: "14/09" solo no alcanza cuando
              // la tabla arranca en septiembre y termina en enero.
              { titulo: "Entrega", ancho: "w-[4.7rem] sm:w-auto" },
              { titulo: "Comprador" },
              { titulo: "m²", desde: "sm" },
              { titulo: "Cortesía", desde: "sm" },
              { titulo: "Facturado", align: "right" },
              { titulo: "Gastos", desde: "sm" },
              { titulo: "Margen", desde: "sm" },
              { titulo: "Pendiente", desde: "sm" },
              { titulo: "", ancho: "w-[5.5rem] sm:w-auto" },
            ]}
            vacio="Todavía no hay entregas confirmadas."
          >
            {entregadas.map((v: any) => {
              const facturado = Number(v.facturado ?? 0);
              const margen = Number(v.margen ?? 0);
              const pct = facturado > 0 ? (margen / facturado) * 100 : 0;
              return (
                <tr key={v.venta_id}>
                  <td className="td whitespace-nowrap text-xs sm:text-sm">
                    {fechaBreve(v.fecha_entrega)}
                  </td>
                  <td className="td font-medium">
                    <span className="block truncate">{v.comprador}</span>
                    {v.vinculante && (
                      <span className="block truncate text-xs font-normal text-tinta-3">
                        vía {v.vinculante}
                      </span>
                    )}
                  </td>
                  <td className="td hidden tabular-nums sm:table-cell">{numero(Number(v.m2))}</td>
                  <td className="td hidden tabular-nums text-tinta-2 sm:table-cell">
                    {Number(v.m2_cortesia) > 0 ? numero(Number(v.m2_cortesia)) : "—"}
                  </td>
                  <td className="td text-right tabular-nums font-semibold">
                    <Dato
                      principal={pesos(facturado)}
                      secundario={<span className="sm:hidden">{numero(Number(v.m2))} m&sup2;</span>}
                    />
                  </td>
                  <td className="td hidden tabular-nums text-atencion-tx sm:table-cell">
                    {Number(v.gastos) > 0 ? pesos(Number(v.gastos)) : "—"}
                  </td>
                  <td className="td hidden tabular-nums font-semibold text-pasto sm:table-cell">
                    {pesos(margen)}
                    <span className="ml-1 whitespace-nowrap text-xs font-normal text-tinta-3">{numero(pct)}%</span>
                  </td>
                  <td
                    className={
                      "td hidden tabular-nums sm:table-cell " +
                      (Number(v.pendiente) > 0
                        ? "font-semibold text-atencion-tx"
                        : "text-tinta-3")
                    }
                  >
                    {pesos(Number(v.pendiente))}
                  </td>
                  <td className="td text-right">
                    {/* El mismo modal que confirma la entrega, pero con
                        todo ya cargado. Adentro está el "no salió este
                        pedido", que es lo que se busca cuando se dio por
                        entregado el de al lado. */}
                    <ConfirmarEntrega
                      pedidoId={String(v.venta_id)}
                      comprador={v.comprador ?? "Sin comprador"}
                      m2={Number(v.m2 ?? 0)}
                      fecha={String(v.fecha_entrega ?? v.fecha)}
                      nota={`Entregado el ${fechaLarga(String(v.fecha_entrega ?? v.fecha))}. Arreglá lo que haya quedado mal.`}
                      etiqueta="Corregir"
                      variante="sutil"
                      corrigiendo
                      m2Facturados={Number(v.m2 ?? 0)}
                      m2Cortesia={Number(v.m2_cortesia ?? 0)}
                      quienEntrega={quienDe.get(String(v.venta_id))?.entrega ?? null}
                      quienRetira={quienDe.get(String(v.venta_id))?.retira ?? null}
                      confirmar={confirmarEntrega}
                      reprogramar={reprogramarPedido}
                      anular={anularPedido}
                      deshacer={deshacerEntrega}
                    />
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <p className="mt-3 text-xs text-tinta-3">
            Si una entrega quedó mal dada —salió otro pedido, o los metros no eran esos—, se
            arregla desde acá sin ir a buscar la venta.
          </p>
        </Card>

      </div>
    </>
  );
}
