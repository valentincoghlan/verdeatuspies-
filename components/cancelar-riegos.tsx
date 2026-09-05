"use client";

import { useRef, useState } from "react";

export type LoteOpcion = { id: string; nombre: string };

/**
 * Frenar los riegos programados, desde el encabezado.
 *
 * Va arriba de todo porque es lo que se toca apurado: empezó a llover,
 * hay gente trabajando en el lote, se rompió un caño. Elegís hasta
 * cuándo y sobre qué, y el controlador no riega hasta entonces.
 */
export function CancelarRiegos({
  lotes,
  hayFrenadas,
  accion,
}: {
  lotes: LoteOpcion[];
  hayFrenadas: boolean;
  accion: (fd: FormData) => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [lote, setLote] = useState("");

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={
          "inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-bold transition sm:min-h-10 sm:flex-none " +
          (hayFrenadas
            ? "border-atencion-tx/40 bg-atencion-bg text-atencion-tx"
            : "border-borde-boton bg-white text-pasto hover:bg-hecho-bg")
        }
      >
        {hayFrenadas ? "Riegos frenados" : "Cancelar riego"}
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-96"
      >
        <div className="p-5">
          <p className="text-base font-bold">Cancelar riego</p>
          <p className="mt-1 text-sm text-tinta-2">
            No se borra nada del controlador: no riega hasta el momento que elijas y después sigue
            con su programa.
          </p>

          <form action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            {lote && <input type="hidden" name="lote_id" value={lote} />}

            <p className="label">Dónde</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {[{ id: "", nombre: "Todo el campo" }, ...lotes].map((l) => (
                <button
                  key={l.id || "todo"}
                  type="button"
                  onClick={() => setLote(l.id)}
                  className={
                    "flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition sm:min-h-9 " +
                    (lote === l.id
                      ? "border-pasto bg-hecho-bg text-pasto-oscuro"
                      : "border-borde bg-crema text-tinta-2")
                  }
                >
                  {l.nombre}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="hasta_fecha">
                  Hasta el día
                </label>
                <input
                  id="hasta_fecha"
                  name="hasta_fecha"
                  type="date"
                  required
                  min={hoy}
                  defaultValue={hoy}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="hasta_hora">
                  A las
                </label>
                <input
                  id="hasta_hora"
                  name="hasta_hora"
                  type="time"
                  required
                  defaultValue="23:59"
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
                Frenar riegos
              </button>
            </div>
          </form>

          {hayFrenadas && (
            <form action={accion} className="mt-3 border-t border-beige pt-3" onSubmit={() => dialogo.current?.close()}>
              <input type="hidden" name="reanudar" value="1" />
              <button className="flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-pasto bg-hecho-bg text-sm font-bold text-pasto-oscuro">
                Reanudar todo ahora
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
