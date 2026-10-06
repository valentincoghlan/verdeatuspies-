import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Dato } from "@/components/dato";
import { FiltroPeriodo, resolverPeriodo } from "@/components/filtro-periodo";
import { fechaBreve, fechaLarga, m2, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * El detalle de un cliente: todo lo que te compró y todo lo que te pagó.
 *
 * Se llega tocando su fila en la cuenta corriente. La tabla de arriba
 * solo dice cuánto debe; acá está de dónde sale ese número, que es lo
 * que uno quiere ver cuando lo llama.
 *
 * Las dos tablas van una al lado de la otra a propósito: el reclamo se
 * hace mirando las dos juntas —"te entregué esto, me pagaste aquello"—, y
 * con el filtro de fechas puesto, lo que queda en pantalla es el resumen
 * de cuenta de ese período, listo para pasárselo.
 */

/**
 * Los estados que cuentan como plata.
 *
 * Es el mismo criterio de `v_cuenta_clientes`: un pedido o un presupuesto
 * todavía no es deuda. Siguen apareciendo en la tabla —sirve verlos— pero
 * no suman al resumen.
 */
const CUENTAN = new Set(["cosechada", "confirmada", "entregada"]);

const COLUMNAS_PAGO =
  "id, fecha, monto, moneda, detalle, cuenta, venta_id, cliente_id";

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; mes?: string; s?: string; p?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // Sin nada en la URL se muestra todo, que es como venía esta pantalla.
  // El resto de los reportes arranca en el mes en curso; acá no, porque lo
  // primero que se busca es el historial completo del cliente.
  const sinFiltro = !sp.a && !sp.mes && !sp.s && !sp.p;
  const periodo = resolverPeriodo(sinFiltro ? { p: "todo" } : sp);

  const supabase = await createClient();

  const [{ data: cliente }, { data: ventas }, { data: cuenta }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("ventas")
      .select("id, fecha, fecha_entrega, m2, precio_m2, total, estado")
      .eq("cliente_id", id)
      .neq("estado", "anulada")
      .order("fecha_entrega", { ascending: false, nullsFirst: false })
      .order("fecha", { ascending: false }),
    supabase.from("v_cuenta_clientes").select("*").eq("cliente_id", id).maybeSingle(),
  ]);

  if (!cliente) notFound();

  const compras = (ventas ?? []) as any[];

  /*
   * Los cobros de este cliente llegan por dos caminos: anotados a su
   * nombre, o colgados de una venta suya. Es el mismo `coalesce` que hace
   * `v_cuenta_clientes`, pero PostgREST no sabe hacer un OR entre una
   * columna propia y una de la tabla de al lado, así que van dos consultas
   * y se juntan acá. El `Map` saca los repetidos: un cobro puede traer las
   * dos cosas.
   */
  const ventaIds = compras.map((v) => v.id);

  const [{ data: aSuNombre }, { data: contraVentas }] = await Promise.all([
    supabase
      .from("v_movimientos")
      .select(COLUMNAS_PAGO)
      .eq("tipo", "I")
      .eq("cliente_id", id),
    ventaIds.length > 0
      ? supabase
          .from("v_movimientos")
          .select(COLUMNAS_PAGO)
          .eq("tipo", "I")
          .in("venta_id", ventaIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const pagos = [
    ...new Map(
      [...(aSuNombre ?? []), ...(contraVentas ?? [])].map((p: any) => [p.id, p]),
    ).values(),
  ].sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)));

  // La fecha con la que se mira una venta es la de entrega: es la que el
  // cliente reconoce. Recién si todavía no se entregó vale la del pedido.
  const fechaDe = (v: any) => (v.fecha_entrega ?? v.fecha) as string;
  const enPeriodo = (f: string) => f >= periodo.desde && f <= periodo.hasta;
  const antesDelPeriodo = (f: string) => f < periodo.desde;

  const comprasPeriodo = compras.filter((v) => enPeriodo(fechaDe(v)));
  const pagosPeriodo = pagos.filter((p: any) => enPeriodo(p.fecha));

  const suma = (xs: any[], valor: (x: any) => any) =>
    xs.reduce((a, x) => a + Number(valor(x) ?? 0), 0);

  const facturables = (xs: any[]) => xs.filter((v) => CUENTAN.has(v.estado));

  const entregas = facturables(comprasPeriodo);
  const entregado = suma(entregas, (v) => v.total);
  const metrosPeriodo = suma(entregas, (v) => v.m2);
  const cobrado = suma(pagosPeriodo, (p) => p.monto);

  // Lo que ya debía antes de que arrancara el período. Con el filtro en
  // "Todo" da cero, porque no hay nada antes de todo.
  const saldoAnterior =
    suma(facturables(compras.filter((v) => antesDelPeriodo(fechaDe(v)))), (v) => v.total) -
    suma(pagos.filter((p: any) => antesDelPeriodo(p.fecha)), (p) => p.monto);

  const saldoCierre = saldoAnterior + entregado - cobrado;

  const c: any = cuenta ?? {};
  const saldo = Number(c.saldo ?? 0);
  const todo = periodo.atajo === "todo";

  const tono = (e: string) =>
    e === "entregada" ? "verde" : e === "pedido" ? "ambar" : e === "confirmada" ? "azul" : "neutro";

  return (
    <>
      <PageHeader
        titulo={cliente.nombre}
        bajada={cliente.canal === "distribuidor" ? "Distribuidor" : "Cliente final"}
        accion={
          <Link href="/ventas/clientes" className="btn-ghost">
            Volver
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="Facturado" valor={pesos(Number(c.total_vendido ?? 0))} destacado />
        <Stat
          label="Saldo"
          valor={pesos(saldo)}
          tono={saldo > 0 ? "ambar" : "neutro"}
          detalle={saldo > 0 ? "Te debe" : saldo < 0 ? "Pagó de más" : "Al día"}
        />
        <Stat label="m² facturados" valor={m2(Number(c.m2_vendidos ?? 0))} />
        <Stat
          label="Teléfono"
          valor={cliente.telefono ?? "—"}
          detalle={`${compras.length} ${compras.length === 1 ? "compra" : "compras"}`}
        />
      </div>

      <div className="mt-3">
        <FiltroPeriodo base={`/ventas/clientes/${id}`} periodo={periodo} conTodo />
      </div>

      {/* El resumen de cuenta del período: es lo que se le pasa al cliente.
          Arranca en lo que ya debía, suma lo entregado, resta lo cobrado. */}
      <div className="mt-3">
        <Card
          titulo={`Resumen · ${periodo.etiqueta}`}
          accion={
            !todo && (
              <span className="text-xs text-tinta-3">
                del {fechaLarga(periodo.desde)} al {fechaLarga(periodo.hasta)}
              </span>
            )
          }
        >
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <Stat
              label={todo ? "Antes" : "Saldo anterior"}
              valor={pesos(saldoAnterior)}
              detalle={todo ? "Nada antes de todo" : `Al ${fechaBreve(periodo.desde)}`}
            />
            <Stat
              label="Entregado"
              valor={pesos(entregado)}
              detalle={`${numero(metrosPeriodo)} m² · ${entregas.length} ${
                entregas.length === 1 ? "entrega" : "entregas"
              }`}
            />
            <Stat
              label="Cobrado"
              valor={pesos(cobrado)}
              tono={cobrado > 0 ? "verde" : "neutro"}
              detalle={`${pagosPeriodo.length} ${pagosPeriodo.length === 1 ? "pago" : "pagos"}`}
            />
            <Stat
              label="Saldo al cierre"
              valor={pesos(saldoCierre)}
              tono={saldoCierre > 0 ? "ambar" : "neutro"}
              detalle={
                saldoCierre > 0 ? "Te debe" : saldoCierre < 0 ? "Pagó de más" : "Al día"
              }
              destacado
            />
          </div>
        </Card>
      </div>

      {/* Las dos caras de la cuenta, una al lado de la otra. En el celular
          se apilan: compras arriba, pagos abajo. */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card titulo="Sus compras">
          <Tabla
            columnas={[{ titulo: "Entrega" }, { titulo: "Valor" }, { titulo: "Estado" }]}
            vacio={
              todo
                ? "Todavía no compró nada."
                : "No hubo entregas en este período."
            }
          >
            {comprasPeriodo.map((v) => (
              <tr key={v.id}>
                <td className="td whitespace-nowrap font-medium">
                  {fechaBreve(fechaDe(v))}
                </td>
                <td className="td tabular-nums font-semibold">
                  <Dato
                    principal={pesos(Number(v.total))}
                    secundario={`${numero(v.m2)} m²`}
                  />
                </td>
                <td className="td">
                  <Chip tono={tono(v.estado) as any}>{v.estado}</Chip>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Pagos recibidos">
          <Tabla
            columnas={[{ titulo: "Fecha" }, { titulo: "Monto" }, { titulo: "Medio" }]}
            vacio={
              todo ? "Todavía no pagó nada." : "No hubo pagos en este período."
            }
          >
            {pagosPeriodo.map((p: any) => (
              <tr key={p.id}>
                <td className="td whitespace-nowrap font-medium">
                  {fechaBreve(p.fecha)}
                </td>
                <td className="td tabular-nums font-semibold">
                  <Dato
                    principal={pesos(Number(p.monto))}
                    secundario={p.moneda === "USD" ? "en dólares" : undefined}
                  />
                </td>
                <td className="td text-sm text-tinta-2">
                  {p.cuenta ?? p.detalle ?? "—"}
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
