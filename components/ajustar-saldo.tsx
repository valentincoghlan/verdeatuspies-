"use client";

import { useRef, useState } from "react";

export type CuentaAjustable = { id: string; nombre: string; saldo: number };

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Poner una cuenta en su saldo real.
 *
 * No corrige la historia: declarás cuánto hay de verdad hoy y la app
 * asienta la diferencia como un movimiento con fecha de hoy. Antes de
 * confirmar se ve exactamente qué se va a escribir, porque esto mueve la
 * plata de los libros.
 */
export function AjustarSaldo({
  cuenta,
  accion,
}: {
  cuenta: CuentaAjustable;
  accion: (fd: FormData) => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [real, setReal] = useState("");

  const valor = Number(real.replace(/\./g, "").replace(",", "."));
  const hayValor = real.trim() !== "" && Number.isFinite(valor);
  const diferencia = hayValor ? valor - cuenta.saldo : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReal("");
          dialogo.current?.showModal();
        }}
        className="text-xs font-semibold text-pasto hover:underline"
      >
        Ajustar
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-96"
      >
        <div className="p-5">
          <p className="text-base font-bold">Ajustar {cuenta.nombre}</p>
          <p className="mt-1 text-sm text-tinta-2">
            La app viene arrastrando <strong className="text-tinta">{pesos(cuenta.saldo)}</strong>.
            Poné cuánto hay de verdad hoy.
          </p>

          <form action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="cuenta_id" value={cuenta.id} />

            <label className="label" htmlFor={`real-${cuenta.id}`}>
              Saldo real de hoy
            </label>
            <input
              id={`real-${cuenta.id}`}
              name="saldo_real"
              type="text"
              inputMode="decimal"
              required
              value={real}
              onChange={(e) => setReal(e.target.value)}
              placeholder="0"
              className="input"
            />

            {hayValor && Math.abs(diferencia) >= 1 && (
              <p className="mt-3 rounded-xl bg-crema p-3 text-sm text-tinta-2">
                Se va a asentar {diferencia > 0 ? "un ingreso" : "un egreso"} de{" "}
                <strong className={diferencia > 0 ? "text-pasto" : "text-atencion-tx"}>
                  {pesos(Math.abs(diferencia))}
                </strong>{" "}
                con fecha de hoy, en la categoría Ajustes. Los movimientos viejos no se tocan.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
              >
                Cancelar
              </button>
              <button
                disabled={!hayValor || Math.abs(diferencia) < 1}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema disabled:bg-borde disabled:text-tinta-3"
              >
                Asentar
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
