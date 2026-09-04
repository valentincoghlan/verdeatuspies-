"use client";

import { useRef } from "react";

/**
 * Botón destructivo con confirmación en un modal.
 *
 * Usa <dialog> nativo: se abre por encima de todo con fondo oscurecido,
 * se cierra con Escape o tocando afuera, y lo dibujamos nosotros — no es
 * el cartel gris del navegador, que de tan visto se aprieta sin leer.
 */
export function Confirmar({
  action,
  campos,
  etiqueta = "Borrar",
  pregunta,
  detalle,
  confirmar = "Sí, borrar",
  compacto,
}: {
  action: (fd: FormData) => Promise<void>;
  campos: Record<string, string>;
  etiqueta?: string;
  pregunta: string;
  detalle?: string;
  confirmar?: string;
  compacto?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={
          "font-semibold text-tinta-3 transition hover:text-urgente-tx " +
          (compacto ? "text-xs" : "text-sm")
        }
      >
        {etiqueta}
      </button>

      <dialog
        ref={dialogo}
        // Tocar el fondo cierra: el click cae sobre el <dialog>, no sobre
        // la caja de adentro.
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] sm:w-96 border border-borde bg-white p-0 text-tinta shadow-[0_18px_40px_-20px_rgba(20,60,34,.35)] backdrop:bg-tinta/40"
      >
        <div className="p-5">
          <p className="text-[19px] font-bold leading-tight text-pasto-oscuro">{pregunta}</p>
          {detalle && <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">{detalle}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            <form action={action} className="flex-1">
              {Object.entries(campos).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-urgente-tx px-5 text-base font-semibold text-crema transition hover:opacity-90">
                {confirmar}
              </button>
            </form>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde-boton bg-white px-5 text-base font-semibold text-tinta-2 transition hover:bg-beige"
            >
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
