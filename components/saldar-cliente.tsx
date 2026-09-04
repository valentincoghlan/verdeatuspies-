"use client";

import { useRef } from "react";

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

/**
 * Dar por cobrado lo que figura pendiente.
 *
 * Es para las ventas viejas cuyo cobro nunca llegó a la planilla. No
 * pregunta a qué cuenta entró porque esa plata no está hoy en ninguna:
 * si estuviera, el movimiento existiría. El asiento queda sin cuenta,
 * cierra la cuenta corriente del cliente y no toca las disponibilidades.
 */
export function SaldarCliente({
  cliente,
  accion,
}: {
  cliente: { id: string; nombre: string; saldo: number };
  accion: (fd: FormData) => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="whitespace-nowrap text-xs font-semibold text-pasto hover:underline"
      >
        Dar por cobrado
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-96"
      >
        <div className="p-5">
          <p className="text-base font-bold">Dar por cobrado</p>
          <p className="mt-1 text-sm text-tinta-2">
            <strong className="text-tinta">{cliente.nombre}</strong> figura con{" "}
            <strong className="text-atencion-tx">{pesos(cliente.saldo)}</strong> pendientes. Se va a
            asentar ese ingreso con fecha de hoy y su cuenta queda en cero.
          </p>

          <form action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="cliente_id" value={cliente.id} />

            <p className="rounded-xl bg-crema p-3 text-xs text-tinta-2">
              No pregunta a qué cuenta entró porque esa plata no está hoy en ninguna: si estuviera,
              el movimiento ya existiría. El asiento queda con la cuenta en blanco, así que{" "}
              <strong className="text-tinta">no toca ningún saldo</strong>.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
              >
                Cancelar
              </button>
              <button className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema">
                Asentar
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
