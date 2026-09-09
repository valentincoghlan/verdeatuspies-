"use client";

import { useRef, useState } from "react";

export type PedidoDelReparto = {
  id: string;
  comprador: string;
  fechaEntrega: string | null;
  m2Pedido: number;
  precioM2: number;
  /** Lo que ya tenía asignado de esta cosecha, si se está reabriendo. */
  asignado: number;
};

export type LoteCosechado = { lote: string; m2: number; panes: number };

const n = (s: string) => {
  const v = Number(String(s).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const m2 = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} m²`;
const pesos = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * El cierre de una cosecha: a quién le va lo que cortaste.
 *
 * Una cosecha de 100 m² puede abastecer tres pedidos, así que cerrarla no
 * es apretar un botón: es repartir. Viene precargado en orden de entrega
 * —primero el pedido que sale antes, hasta completarlo, después el
 * siguiente— porque la mayoría de las veces cosechás para el que sale
 * mañana.
 *
 * Siempre pregunta antes de cerrar, incluso cuando llegaste al objetivo,
 * y muestra el resumen de lo hecho: cuánto se factura, cuánto queda sin
 * asignar y de qué lote salió cada metro.
 */
export function CerrarCosecha({
  cosechaId,
  cosechado,
  objetivo,
  pedidos,
  porLote,
  accion,
  yaCerrada,
}: {
  cosechaId: string;
  cosechado: number;
  objetivo: number;
  pedidos: PedidoDelReparto[];
  porLote: LoteCosechado[];
  accion: (fd: FormData) => Promise<void>;
  yaCerrada: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  // El reparto arranca en orden de entrega: se llena el primero hasta
  // completarlo, después el siguiente.
  const inicial = () => {
    let queda = cosechado;
    const out: Record<string, string> = {};
    for (const p of pedidos) {
      const toca = Math.min(queda, p.asignado > 0 ? p.asignado : p.m2Pedido);
      out[p.id] = toca > 0 ? String(toca) : "";
      queda -= toca;
    }
    return out;
  };

  const [reparto, setReparto] = useState<Record<string, string>>(inicial);

  const asignado = pedidos.reduce((a, p) => a + n(reparto[p.id] ?? ""), 0);
  const sobra = Math.max(0, Math.round((cosechado - asignado) * 10) / 10);
  const facturado = pedidos.reduce((a, p) => a + n(reparto[p.id] ?? "") * p.precioM2, 0);
  const sePasa = asignado > cosechado + 0.01;

  const facturarElResto = () => {
    if (!pedidos.length || sobra <= 0) return;
    const primero = pedidos[0];
    setReparto((r) => ({ ...r, [primero.id]: String(n(r[primero.id] ?? "") + sobra) }));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="whitespace-nowrap text-sm font-bold text-pasto hover:underline"
      >
        {yaCerrada ? "Reabrir" : "Cerrar cosecha"}
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto max-h-[88vh] w-[22rem] overflow-y-auto rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-[30rem]"
      >
        <div className="p-5">
          <p className="text-base font-bold">
            {yaCerrada ? "Reabrir la cosecha" : "¿Cerramos la cosecha?"}
          </p>

          {/* El resumen de lo hecho, antes de decidir. */}
          <div className="mt-3 rounded-2xl bg-crema p-3 text-sm">
            <p className="text-tinta">
              Cortaste <strong>{m2(cosechado)}</strong>
              {objetivo > 0 && (
                <span className="text-tinta-2">
                  {" "}
                  sobre un objetivo de {m2(objetivo)}
                  {cosechado > objetivo
                    ? ` — ${m2(cosechado - objetivo)} de más`
                    : cosechado < objetivo
                      ? ` — faltan ${m2(objetivo - cosechado)}`
                      : ", justo"}
                </span>
              )}
            </p>
            {porLote.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-tinta-2">
                {porLote.map((l) => (
                  <li key={l.lote} className="flex justify-between gap-2">
                    <span>{l.lote}</span>
                    <span className="tabular-nums">
                      {l.panes} panes · {m2(l.m2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="id" value={cosechaId} />

            {pedidos.length === 0 ? (
              <p className="text-sm text-tinta-2">
                No hay pedidos pendientes. Lo cosechado queda como stock sin asignar.
              </p>
            ) : (
              <>
                <p className="label">Para qué pedidos</p>
                <ul className="space-y-2">
                  {pedidos.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.comprador}</span>
                        <span className="block text-xs text-tinta-3">
                          {p.fechaEntrega
                            ? `entrega ${p.fechaEntrega.slice(8, 10)}/${p.fechaEntrega.slice(5, 7)} · `
                            : ""}
                          pidió {m2(p.m2Pedido)}
                        </span>
                      </span>
                      <input
                        name={`m2_${p.id}`}
                        type="number"
                        step="0.5"
                        min="0"
                        inputMode="decimal"
                        aria-label={`m² para ${p.comprador}`}
                        value={reparto[p.id] ?? ""}
                        onChange={(e) =>
                          setReparto((r) => ({ ...r, [p.id]: e.target.value }))
                        }
                        placeholder="0"
                        className="input w-24 shrink-0 text-center"
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-3 border-t border-beige pt-3 text-sm">
              <p className="flex justify-between gap-2">
                <span className="text-tinta-2">Se factura</span>
                <span className="font-bold tabular-nums text-pasto">{pesos(facturado)}</span>
              </p>
              <p className="mt-1 flex justify-between gap-2">
                <span className="text-tinta-2">Sin asignar</span>
                <span
                  className={
                    "font-semibold tabular-nums " + (sobra > 0 ? "text-atencion-tx" : "text-tinta-3")
                  }
                >
                  {m2(sobra)}
                </span>
              </p>

              {/* El excedente va de cortesía salvo que lo mandes a
                  facturar acá mismo, antes de cerrar. */}
              {sobra > 0 && pedidos.length > 0 && (
                <div className="mt-2 rounded-xl bg-crema p-2.5">
                  <p className="text-xs text-tinta-2">
                    Esos {m2(sobra)} quedan de cortesía. Si los vas a cobrar, sumalos al pedido.
                  </p>
                  <button
                    type="button"
                    onClick={facturarElResto}
                    className="mt-1.5 flex min-h-11 items-center text-xs font-bold text-pasto hover:underline sm:min-h-9"
                  >
                    Facturar los {m2(sobra)} a {pedidos[0].comprador}
                  </button>
                </div>
              )}

              {sePasa && (
                <p className="mt-2 rounded-xl bg-urgente-bg p-2.5 text-xs font-semibold text-urgente-tx">
                  Estás repartiendo {m2(asignado)} y cortaste {m2(cosechado)}. Bajá alguno.
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              {/* C5 - se puede postergar: el reparto se guarda y el pedido
                  queda pendiente para confirmarlo cuando lo retiren. */}
              <button
                name="cerrar"
                value="0"
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
              >
                Dejar pendiente
              </button>
              <button
                name="cerrar"
                value="1"
                disabled={sePasa}
                className="flex min-h-12 flex-[1.3] items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema disabled:opacity-40"
              >
                Confirmar cierre
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="mt-2 flex min-h-11 w-full items-center justify-center text-xs font-semibold text-tinta-3"
          >
            Volver sin guardar
          </button>
        </div>
      </dialog>
    </>
  );
}
