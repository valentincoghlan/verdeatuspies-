import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Bloque, Modal, Renglon } from "@/components/modal";
import { Chip } from "@/components/ui";
import { fechaBreve, m2 as enM2, numero, pesos } from "@/lib/format";

/**
 * El detalle de una operación, en el medio de la pantalla.
 *
 * Es lo que hace que las tablas puedan tener menos columnas: el precio
 * por metro, el flete, la cortesía y cada gasto imputado dejan de pelear
 * un lugar en la fila y viven acá, a un click.
 *
 * La regla del margen: **siempre se calcula sobre lo facturado**, se haya
 * cobrado o no. Si a la venta le falta entrar plata, se dice aparte, en
 * su propio bloque. Mezclar las dos cosas era lo que hacía que una venta
 * entregada y no cobrada pareciera que no dejó nada.
 */

const TONO_ESTADO: Record<string, "verde" | "ambar" | "azul" | "neutro" | "rojo"> = {
  entregada: "verde",
  confirmada: "verde",
  cosechada: "azul",
  pedido: "ambar",
  presupuesto: "neutro",
  anulada: "rojo",
};

export async function DetalleVenta({
  ventaId,
  cerrar,
  editar,
}: {
  ventaId: string;
  /** La misma URL sin el parámetro que abre el modal. */
  cerrar: string;
  /** Si va, aparece el botón de editar en el pie. */
  editar?: React.ReactNode;
}) {
  const supabase = await createClient();

  // Se mira la tabla y no `v_margen_ventas` porque esa vista deja afuera
  // los presupuestos y los pedidos, que también se pueden abrir desde la
  // lista de operaciones.
  const [{ data: v }, { data: movs }] = await Promise.all([
    supabase
      .from("ventas")
      .select(
        "id, fecha, fecha_entrega, estado, canal, m2, m2_pedido, m2_entregados, m2_cortesia, " +
          "precio_m2, flete, total, costo_cosecha, costo_envio, cliente_final, notas, " +
          "comprador:clientes!cliente_id(nombre), lotes(nombre)",
      )
      .eq("id", ventaId)
      .maybeSingle(),
    supabase
      .from("v_movimientos")
      .select("id, fecha, tipo, monto, detalle, persona, categoria, subcategoria, cuenta")
      .eq("venta_id", ventaId)
      .order("fecha"),
  ]);

  if (!v) return null;

  const venta = v as any;
  const comprador = venta.comprador?.nombre ?? "Sin comprador";
  const lineas = (movs ?? []) as any[];

  const salidas = lineas.filter((l) => l.tipo === "E");
  const entradas = lineas.filter((l) => l.tipo === "I");

  const facturado = Number(venta.total ?? 0);
  const costoCosecha = Number(venta.costo_cosecha ?? 0);
  const costoEnvio = Number(venta.costo_envio ?? 0);
  const imputados = salidas.reduce((a, l) => a + Number(l.monto ?? 0), 0);
  const costos = costoCosecha + costoEnvio + imputados;

  // Sobre lo facturado, siempre. La cobranza no entra en esta cuenta.
  const margen = facturado - costos;
  const pctMargen = facturado > 0 ? (margen / facturado) * 100 : 0;

  const cobrado = entradas.reduce((a, l) => a + Number(l.monto ?? 0), 0);
  const pendiente = facturado - cobrado;

  const concepto = (l: any) =>
    l.detalle?.trim() || l.persona || l.subcategoria || l.categoria || "Sin detalle";

  return (
    <Modal
      titulo={comprador}
      bajada={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Chip tono={TONO_ESTADO[venta.estado] ?? "neutro"}>{venta.estado}</Chip>
          <span>
            {venta.fecha_entrega
              ? `Entrega ${fechaBreve(venta.fecha_entrega)}`
              : `Cargada ${fechaBreve(venta.fecha)}`}
          </span>
          {venta.canal === "distribuidor" && <span>· distribuidor</span>}
          {venta.lotes?.nombre && <span>· {venta.lotes.nombre}</span>}
          {venta.cliente_final && <span>· entrega a {venta.cliente_final}</span>}
        </span>
      }
      cerrar={cerrar}
      pie={
        <>
          {editar}
          <Link href={`/ventas/${venta.id}`} className="btn-ghost">
            Ver la venta completa
          </Link>
        </>
      }
    >
      <Bloque titulo="Lo que se vendió">
        <Renglon rotulo="Metros" valor={enM2(Number(venta.m2 ?? 0))} />
        {Number(venta.m2_cortesia ?? 0) > 0 && (
          <Renglon
            rotulo="De cortesía"
            detalle="Salieron del campo pero no se cobran"
            valor={enM2(Number(venta.m2_cortesia))}
          />
        )}
        <Renglon rotulo="Precio por metro" valor={`${pesos(Number(venta.precio_m2 ?? 0))} / m²`} />
        {Number(venta.flete ?? 0) > 0 && (
          <Renglon rotulo="Flete" valor={pesos(Number(venta.flete))} />
        )}
        <Renglon rotulo="Facturado" valor={pesos(facturado)} fuerte tono="verde" />
      </Bloque>

      <Bloque titulo="Lo que costó">
        {costoCosecha > 0 && <Renglon rotulo="Costo de cosecha" valor={pesos(costoCosecha)} />}
        {costoEnvio > 0 && <Renglon rotulo="Costo de envío" valor={pesos(costoEnvio)} />}
        {salidas.map((l) => (
          <Renglon
            key={l.id}
            rotulo={concepto(l)}
            detalle={[fechaBreve(l.fecha), l.subcategoria ?? l.categoria, l.cuenta]
              .filter(Boolean)
              .join(" · ")}
            valor={pesos(Number(l.monto ?? 0))}
          />
        ))}
        {costos === 0 ? (
          <p className="py-2 text-sm text-tinta-2">
            Todavía no hay ningún gasto cargado contra esta operación, así que el margen figura
            entero.
          </p>
        ) : (
          <Renglon rotulo="Total de costos" valor={pesos(costos)} fuerte tono="ambar" />
        )}
      </Bloque>

      <Bloque titulo="Lo que dejó">
        <Renglon
          rotulo="Margen"
          detalle="Facturado menos costos, se haya cobrado o no"
          valor={
            <>
              {pesos(margen)}{" "}
              <span className="text-xs font-normal text-tinta-3">
                {numero(pctMargen, 0)}%
              </span>
            </>
          }
          fuerte
          tono={margen < 0 ? "ambar" : "verde"}
        />
      </Bloque>

      <Bloque titulo="La cobranza">
        {entradas.length === 0 ? (
          <p className="py-1.5 text-sm text-tinta-2">Todavía no entró nada de esta operación.</p>
        ) : (
          entradas.map((l) => (
            <Renglon
              key={l.id}
              rotulo={concepto(l)}
              detalle={[fechaBreve(l.fecha), l.cuenta].filter(Boolean).join(" · ")}
              valor={pesos(Number(l.monto ?? 0))}
            />
          ))
        )}
        <Renglon
          rotulo={pendiente > 0.5 ? "Falta cobrar" : "Cobrada"}
          detalle="No cambia el margen: es plata ganada que todavía no entró"
          valor={pesos(Math.max(pendiente, 0))}
          fuerte
          tono={pendiente > 0.5 ? "ambar" : "verde"}
        />
      </Bloque>

      {venta.notas && (
        <Bloque titulo="Notas">
          <p className="whitespace-pre-line text-sm text-tinta-2">{venta.notas}</p>
        </Bloque>
      )}
    </Modal>
  );
}
