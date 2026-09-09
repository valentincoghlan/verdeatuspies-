"use client";

import { useRef } from "react";

/**
 * Un texto que no puede estirar la fila.
 *
 * El caso que lo pide es el error de Hydrawise en Integraciones: son
 * cuatro renglones de jerga que estiraban la fila a ocho y no se leían
 * igual. Acá se muestra el principio y el resto se abre al tocarlo.
 */
export function TextoLargo({ texto, titulo = "Detalle" }: { texto: string; titulo?: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  // Si entra en una línea no hace falta ningún adorno.
  if (texto.length <= 60) return <span className="text-xs text-tinta-2">{texto}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        title={texto}
        className="flex min-h-11 w-full items-center gap-1 overflow-hidden text-left text-xs text-tinta-2 sm:min-h-0"
      >
        <span className="truncate">{texto}</span>
        <span aria-hidden className="shrink-0 font-bold text-pasto">
          ver
        </span>
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[21rem] rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-[32rem]"
      >
        <div className="p-5">
          <p className="text-base font-bold">{titulo}</p>
          <p className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-sm text-tinta-2">
            {texto}
          </p>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
          >
            Cerrar
          </button>
        </div>
      </dialog>
    </>
  );
}
