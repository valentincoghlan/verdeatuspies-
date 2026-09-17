import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Una ventana en el medio de la pantalla, con el fondo desenfocado.
 *
 * Se abre y se cierra por la URL —`?ver=<id>`— y no con estado de React:
 * la pantalla sigue siendo un Server Component, el modal se puede
 * compartir por link, el botón de atrás del navegador lo cierra y no hace
 * falta una gota de JavaScript. `cerrar` es la misma URL sin ese
 * parámetro.
 *
 * El fondo entero es un link a `cerrar`, así que tocar afuera cierra. La
 * tarjeta va encima y no propaga el click porque es un hermano, no un
 * hijo del fondo.
 */
export function Modal({
  titulo,
  bajada,
  cerrar,
  ancho = "max-w-2xl",
  children,
  pie,
}: {
  titulo: string;
  bajada?: ReactNode;
  /** A dónde se vuelve al cerrar: la misma URL sin el parámetro. */
  cerrar: string;
  /** Para los detalles con tabla adentro, que piden más aire. */
  ancho?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <Link
        href={cerrar}
        aria-label="Cerrar"
        className="absolute inset-0 bg-tinta/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white " +
          "shadow-[0_12px_40px_rgba(26,29,24,.28)] sm:rounded-2xl " +
          ancho
        }
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-beige bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-pasto-oscuro sm:text-lg">
              {titulo}
            </h2>
            {bajada && <p className="mt-0.5 text-xs text-tinta-2">{bajada}</p>}
          </div>
          <Link
            href={cerrar}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-crema text-tinta-2 transition hover:bg-beige"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </Link>
        </div>

        <div className="px-4 py-4 sm:px-5">{children}</div>

        {pie && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-beige bg-white px-4 py-3 sm:px-5">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Un renglón del detalle: rótulo a la izquierda, número a la derecha.
 *
 * Es lo que reemplaza a las columnas que se sacaron de las tablas: el
 * dato no se pierde, se mira acá cuando hace falta.
 */
export function Renglon({
  rotulo,
  valor,
  detalle,
  fuerte,
  tono,
}: {
  rotulo: string;
  valor: ReactNode;
  detalle?: ReactNode;
  /** Para los totales, que cierran un bloque. */
  fuerte?: boolean;
  tono?: "verde" | "ambar" | "neutro";
}) {
  const color =
    tono === "verde" ? "text-pasto" : tono === "ambar" ? "text-atencion-tx" : "text-tinta";
  return (
    <div
      className={
        "flex items-baseline justify-between gap-4 py-1.5 " +
        (fuerte ? "border-t border-beige pt-2 font-bold" : "")
      }
    >
      <span className={"min-w-0 text-sm " + (fuerte ? "text-tinta" : "text-tinta-2")}>
        {rotulo}
        {detalle && <span className="block text-[11px] text-tinta-3">{detalle}</span>}
      </span>
      <span className={`shrink-0 whitespace-nowrap text-sm tabular-nums ${color}`}>{valor}</span>
    </div>
  );
}

/** El título chico que separa dos bloques dentro del modal. */
export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
