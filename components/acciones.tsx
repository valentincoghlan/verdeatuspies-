"use client";

import { useRef, type ReactNode } from "react";

/**
 * Las acciones de una fila, sin que se partan.
 *
 * Antes cada tabla metía dos o tres botones de texto en la última celda
 * y en el celular salían destrozados: "Cancelar" y "Borrar" partidos por
 * la mitad, "Gu/ard/ar" en tres renglones. El problema es que no hay
 * ancho para tres palabras al final de una fila.
 *
 * Acá van detrás de un botón de tres puntos con 44px de área de toque,
 * que abre una hoja al pie con las acciones a ancho completo. En la
 * compu, donde sí hay lugar, se muestran en línea como siempre.
 */
export function Acciones({
  children,
  titulo,
}: {
  /** Los botones o formularios. Uno por acción. */
  children: ReactNode;
  /** Encabezado de la hoja en el celular. Ej. el nombre de la fila. */
  titulo?: string;
}) {
  const hoja = useRef<HTMLDialogElement>(null);

  return (
    <>
      {/* Compu: en línea, que es donde entran. */}
      <div className="hidden items-center justify-end gap-3 sm:flex">{children}</div>

      {/* Celular: detrás de los tres puntos. */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => hoja.current?.showModal()}
          aria-label={titulo ? `Acciones de ${titulo}` : "Acciones"}
          className="flex size-11 items-center justify-center rounded-full text-tinta-3 transition active:bg-beige"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>

        <dialog
          ref={hoja}
          onClick={(e) => {
            if (e.target === hoja.current) hoja.current?.close();
          }}
          className="m-0 mt-auto w-full max-w-none rounded-t-[20px] border-t border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
        >
          <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {titulo && (
              <p className="mb-3 truncate text-sm font-bold text-tinta">{titulo}</p>
            )}
            <div
              className="flex flex-col gap-1 [&_button]:min-h-12 [&_button]:w-full [&_button]:justify-start [&_button]:rounded-xl [&_button]:px-3 [&_button]:text-left [&_button]:text-[15px] [&_button]:font-semibold [&_button]:text-tinta [&_button:active]:bg-beige"
              onClick={() => hoja.current?.close()}
            >
              {children}
            </div>
            <button
              type="button"
              onClick={() => hoja.current?.close()}
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
            >
              Cerrar
            </button>
          </div>
        </dialog>
      </div>
    </>
  );
}
