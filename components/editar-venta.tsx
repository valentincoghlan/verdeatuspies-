"use client";

import { useRef } from "react";

export type VentaEditable = {
  id: string;
  comprador: string;
  fecha: string;
  fecha_entrega: string | null;
  m2: number;
  precio_m2: number;
  flete: number;
  estado: string;
  lote_id: string | null;
  notas: string | null;
};

const ESTADOS = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "pedido", label: "Pedido" },
  { value: "confirmada", label: "Confirmada" },
  { value: "entregada", label: "Entregada" },
  { value: "anulada", label: "Anulada" },
];

/**
 * El lápiz de la tabla de operaciones.
 *
 * Antes cada fila llevaba un desplegable de estado, un "Cambiar" y un
 * "Borrar": tres controles al lado de cada venta, que rompían la fila y
 * hacían que el dato se perdiera entre los botones. Ahora la fila muestra
 * solo datos y el lápiz abre el detalle completo, que es donde se corrige.
 */
export function EditarVenta({
  venta,
  lotes,
  accion,
  borrar,
}: {
  venta: VentaEditable;
  lotes: { id: string; nombre: string }[];
  accion: (fd: FormData) => Promise<void>;
  borrar: (fd: FormData) => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        title="Editar la venta"
        aria-label={`Editar la venta de ${venta.comprador}`}
        className="flex size-11 items-center justify-center rounded-full text-tinta-3 transition hover:bg-beige hover:text-pasto active:bg-beige sm:size-9"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[18px] sm:size-4"
          aria-hidden
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[22rem] rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-[28rem]"
      >
        <div className="p-5">
          <p className="text-base font-bold">{venta.comprador}</p>
          <p className="mt-0.5 text-sm text-tinta-2">
            Corregí lo que haga falta. El comprador no se cambia desde acá.
          </p>

          <form action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="id" value={venta.id} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor={`fecha-${venta.id}`}>
                  Fecha
                </label>
                <input
                  id={`fecha-${venta.id}`}
                  name="fecha"
                  type="date"
                  defaultValue={venta.fecha}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`entrega-${venta.id}`}>
                  Entrega
                </label>
                <input
                  id={`entrega-${venta.id}`}
                  name="fecha_entrega"
                  type="date"
                  defaultValue={venta.fecha_entrega ?? ""}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`m2-${venta.id}`}>
                  m²
                </label>
                <input
                  id={`m2-${venta.id}`}
                  name="m2"
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  defaultValue={venta.m2}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`precio-${venta.id}`}>
                  $ por m²
                </label>
                <input
                  id={`precio-${venta.id}`}
                  name="precio_m2"
                  type="number"
                  step="1"
                  min="0"
                  required
                  defaultValue={venta.precio_m2}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`flete-${venta.id}`}>
                  Flete
                </label>
                <input
                  id={`flete-${venta.id}`}
                  name="flete"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={venta.flete}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`estado-${venta.id}`}>
                  Estado
                </label>
                <select
                  id={`estado-${venta.id}`}
                  name="estado"
                  defaultValue={venta.estado}
                  className="input"
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor={`lote-${venta.id}`}>
                  Lote
                </label>
                <select
                  id={`lote-${venta.id}`}
                  name="lote_id"
                  defaultValue={venta.lote_id ?? ""}
                  className="input"
                >
                  <option value="">Sin definir</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor={`notas-${venta.id}`}>
                  Notas
                </label>
                <textarea
                  id={`notas-${venta.id}`}
                  name="notas"
                  rows={2}
                  defaultValue={venta.notas ?? ""}
                  className="input"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
              >
                Cerrar
              </button>
              <button className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema">
                Guardar
              </button>
            </div>
          </form>

          {/* Borrar queda adentro del detalle y pide confirmación del
              navegador: no es algo que se toque al pasar. */}
          <form
            action={borrar}
            className="mt-3 border-t border-beige pt-3"
            onSubmit={(e) => {
              if (!confirm(`¿Borrar la venta de ${venta.comprador}? No se puede deshacer.`)) {
                e.preventDefault();
                return;
              }
              dialogo.current?.close();
            }}
          >
            <input type="hidden" name="id" value={venta.id} />
            <button className="flex min-h-11 w-full items-center justify-center rounded-full text-sm font-bold text-tinta-3 transition hover:bg-urgente-bg hover:text-urgente-tx">
              Borrar esta venta
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
