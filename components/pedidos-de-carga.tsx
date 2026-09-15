"use client";

import { useState } from "react";
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

/** La ventana de un gasto: lo de esta semana, que es lo que se carga. */
export const DIAS_DE_GASTO = 7;

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
 * que viene. Por eso de entrada aparece solo la semana: es lo que se
 * carga casi siempre, y una lista corta se lee de un vistazo.
 *
 * Pero la semana es un atajo, no una reja. Abajo queda "Buscar en todas"
 * y salen todas las cosechas de la más nueva a la más vieja, por si hay
 * que cargar algo atrasado.
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
  const [verTodas, setVerTodas] = useState(false);
  const lado = carga?.lado ?? "E";
  const fecha = carga?.fecha ?? hoy;
  const esCobro = lado === "I";

  const deLaSemana = (p: PedidoElegible) => {
    const ref = p.fechaCosecha ?? p.fecha;
    const d = diasEntre(ref, fecha);
    // Antes de cosechar tampoco: el gasto sería de otra cosa.
    return d >= 0 && d <= DIAS_DE_GASTO;
  };

  const elegibles = pedidos
    .filter((p) => (esCobro ? p.pendiente > 0.5 : verTodas || deLaSemana(p)))
    // De la más nueva a la más vieja: lo de recién es lo que se carga.
    .sort((a, b) => (b.fechaCosecha ?? b.fecha).localeCompare(a.fechaCosecha ?? a.fecha));

  // Cuántas quedan afuera de la semana, para poder ofrecerlas.
  const masViejas = esCobro ? 0 : pedidos.filter((p) => !deLaSemana(p)).length;

  const etiqueta = (p: PedidoElegible) =>
    esCobro
      ? `${p.comprador} · ${dm(p.fecha)} · debe ${pesos(p.pendiente)}`
      : `${p.comprador} · cosechado ${dm(p.fechaCosecha ?? p.fecha)} · ${Math.round(p.m2)} m²`;

  const titulo = esCobro ? "¿A qué ventas se le imputa?" : "¿A qué cosechas va?";

  const ayuda = esCobro
    ? "Aparecen todas las que deben algo, incluso sin cosechar todavía."
    : verTodas
      ? "Todas las cosechas, de la más nueva a la más vieja."
      : `Las cosechas de los últimos ${DIAS_DE_GASTO} días.`;

  /** El atajo para salir de la semana cuando hay que cargar algo viejo. */
  const buscarMas =
    esCobro || masViejas === 0 ? null : (
      <button
        type="button"
        onClick={() => setVerTodas((v) => !v)}
        className="mt-1 flex min-h-9 items-center text-xs font-bold text-pasto hover:underline"
      >
        {verTodas
          ? "Ver solo la última semana"
          : `Buscar en todas (${masViejas} cosecha${masViejas === 1 ? "" : "s"} más)`}
      </button>
    );

  if (elegibles.length === 0) {
    return (
      <div className={"min-w-0 " + className}>
        <span className="label">{titulo}</span>
        <p className="rounded-xl bg-crema px-3 py-3 text-sm text-tinta-2">
          {esCobro
            ? "No hay ventas con saldo pendiente."
            : `Ninguna cosecha de los últimos ${DIAS_DE_GASTO} días. Este gasto queda general.`}
        </p>
        {buscarMas}
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
          key={`${lado}-${verTodas}`}
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
        {buscarMas}
      </div>
    );
  }

  return (
    <div className={"min-w-0 " + className}>
      <Checks
        key={`${lado}-${verTodas}`}
        label={titulo}
        name="venta_id"
        opciones={elegibles.map((p) => ({ value: p.id, label: etiqueta(p) }))}
        resumenVacio="A ninguno, es general"
        onChange={(xs) => carga?.setElegidos(xs)}
      />
      <p className="mt-1 text-xs text-tinta-3">{ayuda}</p>
      {buscarMas}
    </div>
  );
}
