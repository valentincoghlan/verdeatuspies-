import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Confirmar } from "@/components/confirmar";
import { EditarVenta } from "@/components/editar-venta";
import { Cobrar } from "@/components/cobrar";
import {
  borrarMovimiento,
  borrarVenta,
  cobrarVentas,
  crearGastoVenta,
  editarVenta,
} from "@/lib/actions";
import { fechaBreve, fechaLarga, m2, numero, pesos } from "@/lib/format";
import { esAdmin } from "@/lib/rol";

export const dynamic = "force-dynamic";

/**
 * El detalle de una venta: la plata que entró y la que salió por ella.
 *
 * Una venta no es solo lo facturado. Tiene cobros —a veces varios, a
 * veces parciales— y gastos que le pertenecen: el flete de ese camión,
 * la mano de obra de esa cosecha. Acá se ven juntos, y de la resta sale
 * el margen de verdad de esa operación.
 */
export default async function VentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: v }, { data: movs }, { data: lotes }, { data: cuentas }, { data: deLote }, admin] =
    await Promise.all([
      supabase.from("v_margen_ventas").select("*").eq("venta_id", id).maybeSingle(),
      supabase
        .from("v_movimientos")
        .select("id, fecha, tipo, monto, categoria, subcategoria, detalle, cuenta, persona")
        .eq("venta_id", id)
        .order("fecha", { ascending: false }),
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("cuentas").select("id, nombre").eq("activa", true).order("orden"),
      supabase.from("v_lotes_por_venta").select("lotes, cuantos_lotes").eq("venta_id", id).maybeSingle(),
      esAdmin(),
    ]);

  if (!v) notFound();

  const { data: cruda } = await supabase.from("ventas").select("*").eq("id", id).maybeSingle();

  const facturado = Number(v.facturado ?? 0);
  const cobrado = Number(v.cobrado ?? 0);
  const pendiente = Number(v.pendiente ?? 0);
  const gastos = Number(v.gastos ?? 0);
  const margen = facturado - gastos;
  const pct = facturado > 0 ? (margen / facturado) * 100 : 0;

  const lista = (movs ?? []) as any[];
  const ingresos = lista.filter((m) => m.tipo === "I");
  const egresos = lista.filter((m) => m.tipo === "E");

  const cuentasOpc = ((cuentas ?? []) as any[]).map((c) => ({ id: c.id, nombre: c.nombre }));
  const entregada = v.estado === "entregada";

  return (
    <>
      <PageHeader
        titulo={v.comprador ?? "Venta"}
        bajada={`Entrega del ${fechaLarga(v.fecha_entrega ?? v.fecha)} · ${m2(Number(v.m2 ?? 0))}`}
        accion={
          <Link href="/ventas" className="btn-ghost">
            Volver
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="Facturado" valor={pesos(facturado)} destacado detalle={`${numero(v.m2)} m²`} />
        <Stat
          label="Cobrado"
          valor={pesos(cobrado)}
          tono={cobrado > 0 ? "verde" : "neutro"}
          detalle={`${ingresos.length} ${ingresos.length === 1 ? "cobro" : "cobros"}`}
        />
        <Stat
          label="Le falta pagar"
          valor={pesos(pendiente)}
          tono={pendiente > 0 ? "ambar" : "neutro"}
          detalle={pendiente > 0 ? "Sin cobrar" : "Saldada"}
        />
        <Stat
          label="Margen"
          valor={pesos(margen)}
          tono={margen < 0 ? "rojo" : "neutro"}
          detalle={`${numero(pct)}% · gastos ${pesos(gastos)}`}
        />
      </div>

      <div className="mt-3 space-y-3">
        <Card
          titulo="La venta"
          accion={
            <EditarVenta
              venta={{
                id: String(v.venta_id),
                comprador: v.comprador ?? "Sin comprador",
                fecha: String(cruda?.fecha ?? v.fecha),
                fecha_entrega: (cruda?.fecha_entrega ?? null) as string | null,
                m2: Number(cruda?.m2 ?? 0),
                precio_m2: Number(cruda?.precio_m2 ?? 0),
                flete: Number(cruda?.flete ?? 0),
                estado: String(cruda?.estado ?? "confirmada"),
                lote_id: (cruda?.lote_id ?? null) as string | null,
                notas: (cruda?.notas ?? null) as string | null,
              }}
              lotes={(lotes ?? []) as any[]}
              accion={editarVenta}
              borrar={borrarVenta}
            />
          }
        >
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="label">Estado</dt>
              <dd>
                <Chip tono={entregada ? "verde" : "ambar"}>{v.estado}</Chip>
              </dd>
            </div>
            <div>
              <dt className="label">Precio por m²</dt>
              <dd className="tabular-nums">{pesos(Number(v.precio_m2 ?? 0))}</dd>
            </div>
            <div>
              <dt className="label">Canal</dt>
              <dd>{v.canal === "distribuidor" ? "Distribuidor" : "Cliente final"}</dd>
            </div>
            <div>
              <dt className="label">De qué lote</dt>
              <dd>{deLote?.lotes ?? "Sin definir"}</dd>
            </div>
            {Number(v.m2_cortesia) > 0 && (
              <div>
                <dt className="label">De cortesía</dt>
                <dd className="tabular-nums">{m2(Number(v.m2_cortesia))}</dd>
              </div>
            )}
            {v.cliente_final && (
              <div>
                <dt className="label">Recibe</dt>
                <dd>{v.cliente_final}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card
          titulo="Plata de esta venta"
          accion={
            pendiente > 0 && entregada ? (
              <Cobrar
                ventas={[
                  {
                    id: String(v.venta_id),
                    comprador: v.comprador ?? "Sin comprador",
                    clienteId: String(v.cliente_id),
                    fecha: String(v.fecha_entrega ?? v.fecha),
                    facturado,
                    pendiente,
                  },
                ]}
                cuentas={cuentasOpc}
                accion={cobrarVentas}
                etiqueta="Registrar cobro"
              />
            ) : undefined
          }
        >
          <Tabla
            columnas={[
              { titulo: "Fecha", ancho: "w-[3.4rem] sm:w-auto" },
              { titulo: "Concepto" },
              { titulo: "Cuenta", desde: "sm" },
              { titulo: "Monto", align: "right" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="Todavía no hay ningún movimiento colgado de esta venta."
          >
            {lista.map((m) => (
              <tr key={m.id}>
                <td className="td whitespace-nowrap">{fechaBreve(m.fecha)}</td>
                <td className="td max-w-0">
                  <span className="block truncate font-medium">
                    {m.categoria ?? "—"}
                    {m.subcategoria ? ` · ${m.subcategoria}` : ""}
                  </span>
                  {m.detalle && (
                    <span className="block truncate text-xs text-tinta-3">{m.detalle}</span>
                  )}
                </td>
                <td className="td hidden text-tinta-2 sm:table-cell">{m.cuenta ?? "—"}</td>
                <td
                  className={
                    "td whitespace-nowrap text-right tabular-nums font-semibold sm:text-left " +
                    (m.tipo === "I" ? "text-pasto" : "text-atencion-tx")
                  }
                >
                  {m.tipo === "I" ? "+" : "−"} {pesos(Number(m.monto))}
                </td>
                <td className="td text-right">
                  {admin && (
                    <Confirmar
                      action={borrarMovimiento}
                      campos={{ id: m.id }}
                      etiqueta="×"
                      pregunta="¿Sacar este movimiento de la venta? Se borra del libro."
                      compacto
                    />
                  )}
                </td>
              </tr>
            ))}
          </Tabla>

          {lista.length > 0 && (
            <p className="mt-3 text-sm text-tinta-2">
              {ingresos.length} cobro{ingresos.length === 1 ? "" : "s"} por{" "}
              <strong className="text-pasto">{pesos(cobrado)}</strong> y {egresos.length} gasto
              {egresos.length === 1 ? "" : "s"} por{" "}
              <strong className="text-atencion-tx">{pesos(gastos)}</strong>.
            </p>
          )}
        </Card>

        <Card titulo="Cargarle un gasto">
          <p className="mb-3 text-sm text-tinta-2">
            Lo que se gastó por esta venta en particular: el flete de ese camión, la mano de obra de
            esa cosecha. Sale del margen de esta operación y no del gasto general.
          </p>
          <form action={crearGastoVenta} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input type="hidden" name="venta_id" value={String(v.venta_id)} />
            <input type="hidden" name="tipo" value="E" />
            <div className="min-w-0">
              <label className="label" htmlFor="g-monto">
                Cuánto
              </label>
              <input
                id="g-monto"
                name="monto"
                type="text"
                inputMode="decimal"
                required
                placeholder="0"
                className="input"
              />
            </div>
            <div className="min-w-0">
              <label className="label" htmlFor="g-fecha">
                Cuándo
              </label>
              <input
                id="g-fecha"
                name="fecha"
                type="date"
                required
                defaultValue={String(v.fecha_entrega ?? v.fecha)}
                className="input"
              />
            </div>
            <div className="min-w-0">
              <label className="label" htmlFor="g-cuenta">
                De qué cuenta
              </label>
              <select id="g-cuenta" name="cuenta_id" className="input" required>
                {cuentasOpc.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="label" htmlFor="g-detalle">
                Qué fue
              </label>
              <input
                id="g-detalle"
                name="detalle"
                placeholder="Flete a Derqui"
                className="input"
              />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <button className="btn btn-alto sm:w-auto">Cargar el gasto</button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
