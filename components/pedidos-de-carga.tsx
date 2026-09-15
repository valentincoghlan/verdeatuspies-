"use client";

import { Checks } from "@/components/checks";
import { useCarga } from "@/components/carga";

export type PedidoElegible = {
  id: string;
  comprador: string;
  m2: number;
  /** Lo que todavía se le debe. */
  pendiente: number;
  /** El día de la cosecha que lo abasteció. Sin cosecha, el de entrega. */
  fechaCosecha: string | null;
  fecha: string;
};

/** Cuántos días hay de un día al otro, con fechas ISO. */
const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** La ventana de un gasto: después de esto la cosecha ya está cerrada. */
export const DIAS_DE_GASTO = 5;

const pesos = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Elegir a qué pedidos se le cuelga un movimiento.
 *
 * La lista no es la misma según lo que estés cargando, y no es un
 * capricho de pantalla: son dos cosas distintas.
 *
 * Un COBRO va contra lo que se debe. Empieza antes de cosechar —una
 * seña entra con el pedido recién tomado— y no termina hasta que el
 * saldo queda en cero, tenga la antigüedad que tenga. Un mismo pago
 * puede tapar varias del mismo comprador. Por eso acá aparecen todas
 * las que deben algo, sin límite de fecha y sin importar en qué punto
 * del camino estén.
 *
 * Un GASTO pertenece a la cosecha que lo generó. La mano de obra de un
 * jueves es de lo que se cortó ese jueves, no de lo que se corte el mes
 * que viene. Por eso solo aparecen los pedidos cosechados dentro de los
 * cinco días de la fecha del movimiento: pasada esa ventana, el gasto
 * es general y no de una venta.
 */
export function PedidosDeCarga({
  pedidos,
  hoy,
  multiple = false,
  className = "",
}: {
  pedidos: PedidoElegible[];
  hoy: string;
  /** Varios a la vez, para repartir entre ellos. */
  multiple?: boolean;
  className?: string;
}) {
  const carga = useCarga();
  const lado = carga?.lado ?? "E";
  const fecha = carga?.fecha ?? hoy;
  const esCobro = lado === "I";

  const elegibles = pedidos.filter((p) => {
    if (esCobro) return p.pendiente > 0.5;
    const ref = p.fechaCosecha ?? p.fecha;
    const d = diasEntre(ref, fecha);
    // Antes de cosechar tampoco: el gasto sería de otra cosa.
    return d >= 0 && d <= DIAS_DE_GASTO;
  });

  const etiqueta = (p: PedidoElegible) =>
    esCobro
      ? `${p.comprador} · ${dm(p.fecha)} · debe ${pesos(p.pendiente)}`
      : `${p.comprador} · cosechado ${dm(p.fechaCosecha ?? p.fecha)} · ${Math.round(p.m2)} m²`;

  const titulo = esCobro ? "¿A qué ventas se le imputa?" : "¿A qué cosechas va?";

  const ayuda = esCobro
    ? "Aparecen todas las que deben algo, incluso sin cosechar todavía."
    : `Aparecen las cosechas de hasta ${DIAS_DE_GASTO} días antes del ${dm(fecha)}.`;

  if (elegibles.length === 0) {
    return (
      <div className={"min-w-0 " + className}>
        <span className="label">{titulo}</span>
        <p className="rounded-xl bg-crema px-3 py-3 text-sm text-tinta-2">
          {esCobro
            ? "No hay ventas con saldo pendiente."
            : `Ninguna cosecha de los últimos ${DIAS_DE_GASTO} días. Este gasto queda general.`}
        </p>
      </div>
    );
  }

  if (!multiple) {
    return (
      <div className={"min-w-0 " + className}>
        <label className="label" htmlFor="carga-venta">
          {titulo}
        </label>
        <select
          key={lado}
          id="carga-venta"
          name="venta_id"
          className="input"
          onChange={(e) => carga?.setElegidos(e.target.value ? [e.target.value] : [])}
        >
          <option value="">No, es general</option>
          {elegibles.map((p) => (
            <option key={p.id} value={p.id}>
              {etiqueta(p)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-tinta-3">{ayuda}</p>
      </div>
    );
  }

  return (
    <div className={"min-w-0 " + className}>
      <Checks
        key={lado}
        label={titulo}
        name="venta_id"
        opciones={elegibles.map((p) => ({ value: p.id, label: etiqueta(p) }))}
        resumenVacio="A ninguno, es general"
        onChange={(xs) => carga?.setElegidos(xs)}
      />
      <p className="mt-1 text-xs text-tinta-3">{ayuda}</p>
    </div>
  );
}
