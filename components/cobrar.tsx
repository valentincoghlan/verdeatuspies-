"use client";

import { useMemo, useRef, useState } from "react";
import { montoDe, Renglon, Renglones, renglonVacio, totalDe } from "@/components/renglones";

export type VentaACobrar = {
  id: string;
  comprador: string;
  clienteId: string;
  fecha: string;
  facturado: number;
  pendiente: number;
};

const n = (s: string) => {
  const v = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const pesos = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/**
 * Registrar un cobro que puede tapar varias ventas.
 *
 * Un distribuidor no paga factura por factura: te manda una
 * transferencia por lo que le viene bien y eso salda tres ventas y deja
 * una por la mitad. Así que el cobro se carga como un monto y la app lo
 * reparte de la más vieja a la más nueva, que es como se cancela una
 * cuenta corriente. Lo repartido se puede corregir renglón por renglón.
 *
 * Y un mismo pago tampoco entra por un solo lado: una parte cae al banco
 * y el resto te lo dejan en mano. Por eso arriba va una lista de
 * entradas, cada una con su cuenta, y lo que se reparte entre las ventas
 * es la suma.
 *
 * Cada venta se guarda como un movimiento de entrada colgado de ella: de
 * ahí sale lo cobrado y lo que queda pendiente.
 */
export function Cobrar({
  ventas,
  cuentas,
  accion,
  etiqueta = "Registrar un cobro",
  clienteInicial = "",
  compacto,
}: {
  ventas: VentaACobrar[];
  cuentas: { id: string; nombre: string }[];
  accion: (fd: FormData) => Promise<void>;
  etiqueta?: string;
  /**
   * Arranca con este comprador puesto. Sirve para el botón de cada fila:
   * si ya sabés a qué venta le vas a cargar la plata, no tiene sentido
   * volver a elegir de quién es.
   */
  clienteInicial?: string;
  /** Como un link y no como un botón grande: para adentro de una tabla. */
  compacto?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [cliente, setCliente] = useState(clienteInicial);
  const [entradas, setEntradas] = useState<Renglon[]>(() => [renglonVacio(cuentas[0]?.id ?? "")]);
  const [reparto, setReparto] = useState<Record<string, string>>({});
  const [tocado, setTocado] = useState(false);

  const clientes = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; pendiente: number; cuantas: number }>();
    for (const v of ventas) {
      const x = m.get(v.clienteId) ?? {
        id: v.clienteId,
        nombre: v.comprador,
        pendiente: 0,
        cuantas: 0,
      };
      x.pendiente += v.pendiente;
      x.cuantas += 1;
      m.set(v.clienteId, x);
    }
    return [...m.values()].sort((a, b) => b.pendiente - a.pendiente);
  }, [ventas]);

  // De la más vieja a la más nueva: así se cancela una cuenta corriente.
  const suyas = useMemo(
    () =>
      ventas
        .filter((v) => v.clienteId === cliente)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [ventas, cliente],
  );

  /** Reparte el monto de la más vieja a la más nueva. */
  const repartirDesde = (total: number, lista: VentaACobrar[]) => {
    let queda = total;
    const out: Record<string, string> = {};
    for (const v of lista) {
      const toca = Math.min(queda, v.pendiente);
      out[v.id] = toca > 0 ? String(Math.round(toca * 100) / 100) : "";
      queda -= toca;
    }
    return out;
  };

  const cambiarCliente = (id: string) => {
    setCliente(id);
    setTocado(false);
    const lista = ventas
      .filter((v) => v.clienteId === id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    setReparto(repartirDesde(totalDe(entradas), lista));
  };

  // Mientras no toques el reparto a mano, sigue lo que entró.
  const cambiarEntradas = (rs: Renglon[]) => {
    setEntradas(rs);
    if (!tocado) setReparto(repartirDesde(totalDe(rs), suyas));
  };

  const asignado = suyas.reduce((a, v) => a + n(reparto[v.id] ?? ""), 0);
  const total = totalDe(entradas);
  const sinAsignar = Math.round((total - asignado) * 100) / 100;
  const sePasa = suyas.some((v) => n(reparto[v.id] ?? "") > v.pendiente + 0.01);
  // Plata sin cuenta no se puede guardar: el saldo tiene que ir a algún lado.
  const faltaCuenta = entradas.some((r) => montoDe(r) > 0 && !r.cuenta);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={
          compacto
            ? "inline-flex min-h-11 items-center whitespace-nowrap px-1 text-sm font-bold text-pasto hover:underline sm:min-h-9"
            : "inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-pasto px-4 text-sm font-bold text-crema transition active:scale-[.98] sm:min-h-9"
        }
      >
        {etiqueta}
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-[22rem] sm:max-w-[30rem] overflow-y-auto rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-[30rem]"
      >
        <div className="p-5">
          <p className="text-base font-bold">Registrar un cobro</p>
          <p className="mt-0.5 text-sm text-tinta-2">
            Poné cuánto te pagaron y se reparte de la venta más vieja a la más nueva. Corregí lo que
            haga falta.
          </p>

          <form action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 min-w-0">
                <label className="label" htmlFor="cob-cliente">
                  Quién pagó
                </label>
                <select
                  id="cob-cliente"
                  value={cliente}
                  onChange={(e) => cambiarCliente(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Elegí el comprador</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} — debe {pesos(c.pendiente)} en {c.cuantas}{" "}
                      {c.cuantas === 1 ? "venta" : "ventas"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 min-w-0">
                <label className="label" htmlFor="cob-fecha">
                  Cuándo
                </label>
                <input
                  id="cob-fecha"
                  name="fecha"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="input"
                  required
                />
              </div>

              {/* Un pago puede entrar por varios lados: parte al banco y
                  parte en mano. Lo que se reparte entre las ventas es la
                  suma de todo esto. */}
              <div className="col-span-2 min-w-0">
                <span className="label">Cuánto pagó y dónde entró</span>
                <Renglones
                  renglones={entradas}
                  onChange={cambiarEntradas}
                  cuentas={cuentas}
                />
              </div>
            </div>

            {cliente && (
              <div className="mt-4 border-t border-beige pt-3">
                <p className="label">A qué ventas va</p>
                <ul className="space-y-2">
                  {suyas.map((v) => (
                    <li key={v.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{dm(v.fecha)}</span>
                        <span className="block text-xs text-tinta-3">
                          debe {pesos(v.pendiente)} de {pesos(v.facturado)}
                        </span>
                      </span>
                      <input
                        name={`cobro_${v.id}`}
                        type="text"
                        inputMode="decimal"
                        aria-label={`Cuánto va a la venta del ${dm(v.fecha)}`}
                        value={reparto[v.id] ?? ""}
                        onChange={(e) => {
                          setTocado(true);
                          setReparto((r) => ({ ...r, [v.id]: e.target.value }));
                        }}
                        placeholder="0"
                        className="input input-medio shrink-0 text-right"
                      />
                    </li>
                  ))}
                </ul>

                <div className="mt-3 space-y-1 text-sm">
                  <p className="flex justify-between gap-2">
                    <span className="text-tinta-2">Repartido</span>
                    <span className="font-bold tabular-nums text-pasto">{pesos(asignado)}</span>
                  </p>
                  {Math.abs(sinAsignar) > 0.5 && (
                    <p className="flex justify-between gap-2">
                      <span className="text-tinta-2">
                        {sinAsignar > 0 ? "Sin asignar" : "Te pasaste por"}
                      </span>
                      <span className="font-semibold tabular-nums text-atencion-tx">
                        {pesos(Math.abs(sinAsignar))}
                      </span>
                    </p>
                  )}
                </div>

                {sinAsignar > 0.5 && (
                  <p className="mt-2 rounded-xl bg-crema p-2.5 text-xs text-tinta-2">
                    Esos {pesos(sinAsignar)} no se van a registrar. Si el comprador pagó de más,
                    cargalo aparte como un anticipo desde Movimientos.
                  </p>
                )}
                {sinAsignar < -0.5 && (
                  <p className="mt-2 rounded-xl bg-urgente-bg p-2.5 text-xs font-semibold text-urgente-tx">
                    Estás repartiendo {pesos(Math.abs(sinAsignar))} más de lo que entró. Subí lo
                    que pagó o bajá el reparto.
                  </p>
                )}
                {faltaCuenta && (
                  <p className="mt-2 rounded-xl bg-urgente-bg p-2.5 text-xs font-semibold text-urgente-tx">
                    Falta decir a qué cuenta entró uno de los pagos.
                  </p>
                )}
                {sePasa && (
                  <p className="mt-2 rounded-xl bg-urgente-bg p-2.5 text-xs font-semibold text-urgente-tx">
                    Le estás asignando a una venta más de lo que debe. Bajalo.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
              >
                Cerrar
              </button>
              <button
                disabled={!cliente || asignado <= 0 || sePasa || faltaCuenta || sinAsignar < -0.5}
                className="flex min-h-12 flex-[1.3] items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema disabled:opacity-40"
              >
                Guardar el cobro
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
