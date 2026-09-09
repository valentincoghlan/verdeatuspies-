"use client";

import { useRef, type ReactNode } from "react";

/**
 * Una alerta de Inicio, con la forma de leerla y sacarla de la lista.
 *
 * Antes eran de solo mirar: no se marcaban como leídas, no desaparecían
 * y el contador del header seguía igual todos los días. Ahora la tarjeta
 * se toca y abre el detalle, y al cerrarlo queda resuelta.
 *
 * Las que piden hacer algo —confirmar una entrega, cargar los mm de una
 * lluvia— NO se resuelven al cerrar: las cierra la acción. Si no, con un
 * roce se te iba un pedido pendiente de la lista sin haberlo entregado.
 */
export function Alerta({
  titulo,
  mensaje,
  fecha,
  severidad,
  requiereAccion,
  resolver,
  id,
  children,
}: {
  titulo: string;
  mensaje?: string | null;
  fecha?: string | null;
  severidad: string;
  /** Si pide una acción, cerrar el detalle no la resuelve. */
  requiereAccion: boolean;
  resolver: (fd: FormData) => Promise<void>;
  id: string;
  /** El formulario propio de la alerta, si tiene. */
  children?: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const marcar = useRef<HTMLFormElement>(null);

  const franja =
    severidad === "urgente"
      ? "bg-urgente-bg text-urgente-tx"
      : severidad === "aviso"
        ? "bg-atencion-bg text-atencion-tx"
        : "bg-info-bg text-info-tx";

  const cerrar = () => {
    dialogo.current?.close();
    // Leerla alcanza para sacarla de la lista, salvo que pida acción.
    if (!requiereAccion) marcar.current?.requestSubmit();
  };

  return (
    <li className="overflow-hidden rounded-2xl border border-borde bg-white shadow-[0_1px_2px_rgba(26,29,24,.05)]">
      <div className="flex flex-col gap-2.5 p-3.5">
        <button
          type="button"
          onClick={() => dialogo.current?.showModal()}
          className="min-w-0 text-left"
        >
          <span className="flex items-center justify-between gap-2">
            <span
              className={
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.08em] " +
                franja
              }
            >
              {severidad}
            </span>
            {fecha && <span className="text-[11.5px] font-semibold text-tinta-3">{fecha}</span>}
          </span>
          <span className="mt-1.5 block text-[16px] font-bold leading-snug text-pasto-oscuro">
            {titulo}
          </span>
          {mensaje && (
            <span className="mt-0.5 block text-[13px] leading-snug text-tinta-2">{mensaje}</span>
          )}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {children}

          <form action={resolver} ref={marcar} className={children ? "ml-auto" : ""}>
            <input type="hidden" name="id" value={id} />
            <button className="flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-xs font-bold text-tinta-3 transition hover:bg-beige hover:text-tinta active:bg-beige sm:min-h-9">
              Listo
            </button>
          </form>
        </div>
      </div>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        onCancel={(e) => {
          e.preventDefault();
          cerrar();
        }}
        className="m-auto max-h-[85vh] w-[21rem] overflow-y-auto rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-[26rem]"
      >
        <div className="p-5">
          <span
            className={
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.08em] " +
              franja
            }
          >
            {severidad}
          </span>
          <p className="mt-2 text-base font-bold text-pasto-oscuro">{titulo}</p>
          {mensaje && <p className="mt-1 text-sm text-tinta-2">{mensaje}</p>}
          {fecha && <p className="mt-1 text-xs text-tinta-3">{fecha}</p>}

          {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}

          <button
            type="button"
            onClick={cerrar}
            className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema"
          >
            {requiereAccion ? "Cerrar" : "Listo, ya la leí"}
          </button>
          {requiereAccion && (
            <p className="mt-2 text-center text-xs text-tinta-3">
              Esta queda en la lista hasta que la resuelvas.
            </p>
          )}
        </div>
      </dialog>
    </li>
  );
}
