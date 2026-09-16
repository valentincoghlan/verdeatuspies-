"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * La cara que pone la app cuando algo se rompe.
 *
 * Una pantalla en blanco con una línea en rojo asusta, no dice qué pasó
 * y no dice qué hacer. Acá va el logo, una frase en criollo y los dos
 * botones que de verdad sirven: reintentar y volver al inicio.
 *
 * El detalle técnico va abajo y plegado. No le sirve a nadie parado en
 * el campo, pero es lo único que sirve para arreglarlo, así que queda a
 * mano y se puede copiar en vez de perderse.
 */
export function PantallaError({
  titulo,
  mensaje,
  detalle,
  reintentar,
}: {
  titulo: string;
  mensaje: string;
  /** El error de verdad, para poder pasarlo. */
  detalle?: string | null;
  /** Sin esto no se muestra el botón: en un 404 no hay nada que reintentar. */
  reintentar?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10 text-center sm:py-16">
      <Image
        src="/logo.png"
        alt="Verde A Tus Pies"
        width={512}
        height={512}
        priority
        className="size-28 rounded-full object-cover sm:size-32"
      />

      <h1 className="mt-5 text-xl font-bold text-tinta">{titulo}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">{mensaje}</p>

      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {reintentar && (
          <button
            type="button"
            onClick={reintentar}
            className="flex min-h-12 items-center justify-center rounded-full bg-pasto px-6 text-sm font-bold text-crema transition active:scale-[.98]"
          >
            Probar de nuevo
          </button>
        )}
        <Link
          href="/"
          className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-borde bg-white px-6 text-sm font-bold text-tinta-2"
        >
          Ir al inicio
        </Link>
      </div>

      {detalle && (
        <details className="mt-8 w-full text-left">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold text-tinta-3">
            Ver el detalle técnico
          </summary>
          {/* Seleccionable y con los saltos de línea puestos: la idea es
              que se pueda copiar y mandar tal cual. */}
          <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-crema p-3 text-xs text-tinta-2">
            {detalle}
          </p>
          <p className="mt-2 text-xs text-tinta-3">
            Si vuelve a pasar, mandá esta pantalla y se arregla.
          </p>
        </details>
      )}
    </div>
  );
}
