"use client";

import { useRef, useState } from "react";
import { Formulario, Guardar } from "@/components/guardar";

export type LoteOpcion = { id: string; nombre: string };

const n = (s: string) => {
  const v = Number(String(s).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const m2 = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} m²`;

/**
 * Cosechar un pedido, en el mismo lugar donde está el pedido.
 *
 * Hay dos maneras de cortar y hasta hoy la app solo sabía una: abrir el
 * contador, elegir el pedido de una lista, contar pila por pila y
 * después repartir. Eso está bien cuando se corta ahora y se va
 * contando, y es la mitad de las veces.
 *
 * La otra mitad el pasto ya está cortado —o se corta y se carga al
 * final del día— y lo único que hace falta es anotar tres cosas: cuándo,
 * cuántos metros y de qué lote. Eso es lo que hace este modal de una,
 * sin escribir una sola línea de conteo y sin salir de la pantalla.
 *
 * Los dos caminos terminan en el mismo lado: una cosecha enganchada al
 * pedido. El directo la deja cerrada y el pedido pasa a "cosechado" en
 * el acto; el de contar la deja abierta y te lleva al contador.
 */
export function Cosechar({
  pedidoId,
  comprador,
  m2Pedido,
  m2Cosechado,
  lotes,
  hoy,
  panLargo,
  panAncho,
  panesPorPila,
  accion,
  etiqueta = "Cosechar",
  variante = "principal",
}: {
  pedidoId: string;
  comprador: string;
  m2Pedido: number;
  /** Lo que otras cosechas ya le cubrieron. Lo que falta sale de restar. */
  m2Cosechado: number;
  lotes: LoteOpcion[];
  /** El hoy de Argentina, que lo sabe el servidor. */
  hoy: string;
  panLargo: number;
  panAncho: number;
  panesPorPila: number;
  accion: (fd: FormData) => Promise<void>;
  etiqueta?: string;
  variante?: "principal" | "sutil";
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState<"directo" | "conteo">("directo");

  const falta = Math.max(0, Math.round((m2Pedido - m2Cosechado) * 100) / 100);

  // Arranca con un renglón y el primer lote puesto: casi siempre se corta
  // de uno solo y así no hay que tocar nada.
  const [filas, setFilas] = useState<{ lote: string; metros: string }[]>(() => [
    { lote: lotes[0]?.id ?? "", metros: falta > 0 ? String(falta) : "" },
  ]);

  const cortado = filas.reduce((a, f) => a + n(f.metros), 0);
  const cambiar = (i: number, patch: Partial<{ lote: string; metros: string }>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  // Un lote no puede ir dos veces: la tabla los guarda de a uno por
  // cosecha y el segundo choca contra la clave.
  const libres = lotes.filter((l) => !filas.some((f) => f.lote === l.id));

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={
          variante === "sutil"
            ? "flex min-h-11 items-center justify-center whitespace-nowrap rounded-full " +
              "border border-borde-boton px-3 text-xs font-bold text-tinta-2 transition " +
              "hover:border-pasto hover:text-pasto active:bg-beige sm:min-h-9"
            : "flex min-h-11 w-full items-center justify-center rounded-full bg-pasto px-4 " +
              "text-sm font-bold text-crema transition active:scale-[.98] sm:min-h-10 sm:w-auto"
        }
      >
        {etiqueta}
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-[28rem] overflow-y-auto overflow-x-hidden rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
      >
        <div className="p-5">
          <p className="text-base font-bold">{comprador}</p>
          <p className="mt-0.5 text-sm text-tinta-2">
            Pidió {m2(m2Pedido)}
            {m2Cosechado > 0 ? ` · ya tiene ${m2(m2Cosechado)} cortados` : ""}
            {falta > 0 ? ` · faltan ${m2(falta)}` : " · está cubierto"}
          </p>

          {/* Las dos maneras de cosechar, en un interruptor. La de todos
              los días viene puesta. */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-crema p-1">
            {(
              [
                ["directo", "Cargar metros"],
                ["conteo", "Contar pilas"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setModo(v)}
                aria-pressed={modo === v}
                className={
                  "flex min-h-11 items-center justify-center rounded-full text-sm font-bold transition " +
                  (modo === v ? "bg-pasto text-crema" : "text-tinta-2")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-tinta-3">
            {modo === "directo"
              ? "El pasto ya está cortado: anotás cuánto salió y de dónde, y el pedido queda cosechado."
              : "Se corta ahora y se cuenta por tramo de líneas. Abre el contador y te lleva ahí."}
          </p>

          <Formulario action={accion} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="venta_id" value={pedidoId} />
            <input type="hidden" name="modo" value={modo} />

            <div>
              <label className="label" htmlFor={`fecha-cos-${pedidoId}`}>
                {modo === "directo" ? "Cuándo se cosechó" : "Fecha de la cosecha"}
              </label>
              <input
                id={`fecha-cos-${pedidoId}`}
                name="fecha"
                type="date"
                defaultValue={hoy}
                className="input"
              />
            </div>

            <p className="label mt-3">De dónde salió</p>
            <ul className="space-y-2">
              {filas.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <select
                    name="lote_id"
                    required
                    value={f.lote}
                    onChange={(e) => cambiar(i, { lote: e.target.value })}
                    aria-label="Lote"
                    className="input min-w-0 flex-1"
                  >
                    <option value="">Elegí el lote</option>
                    {lotes.map((l) => (
                      <option
                        key={l.id}
                        value={l.id}
                        disabled={l.id !== f.lote && filas.some((x) => x.lote === l.id)}
                      >
                        {l.nombre}
                      </option>
                    ))}
                  </select>

                  {modo === "directo" && (
                    <input
                      name="m2_lote"
                      type="number"
                      step="any"
                      min="0"
                      required
                      inputMode="decimal"
                      aria-label="m² de este lote"
                      value={f.metros}
                      onChange={(e) => cambiar(i, { metros: e.target.value })}
                      placeholder="m²"
                      className="input input-medio shrink-0 text-right"
                    />
                  )}

                  {filas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
                      aria-label="Sacar este lote"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-tinta-3 hover:bg-beige"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {libres.length > 0 && (
              <button
                type="button"
                onClick={() => setFilas((fs) => [...fs, { lote: libres[0].id, metros: "" }])}
                className="mt-2 flex min-h-11 items-center text-sm font-bold text-pasto"
              >
                + Salió también de otro lote
              </button>
            )}

            {modo === "directo" ? (
              <div className="mt-3 flex justify-between gap-2 border-t border-beige pt-3 text-sm">
                <span className="text-tinta-2">Cortado</span>
                <span className="font-bold tabular-nums text-pasto">{m2(cortado)}</span>
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <label className="label" htmlFor={`obj-${pedidoId}`}>
                    Objetivo en m²
                  </label>
                  <input
                    id={`obj-${pedidoId}`}
                    name="objetivo_m2"
                    type="number"
                    step="any"
                    min="0"
                    required
                    defaultValue={falta > 0 ? falta : m2Pedido}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-tinta-3">
                    Tomado del pedido. Cambialo si cortás de más para tener stock.
                  </p>
                </div>

                {/* Las medidas del pan casi nunca cambian: vienen de
                    Ajustes y quedan escondidas hasta que hagan falta. */}
                <details className="mt-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-tinta-2">
                    Medidas del pan
                  </summary>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Largo</label>
                      <input
                        name="pan_largo_m"
                        type="number"
                        step="0.01"
                        defaultValue={panLargo}
                        className="input px-2 text-center"
                      />
                    </div>
                    <div>
                      <label className="label">Ancho</label>
                      <input
                        name="pan_ancho_m"
                        type="number"
                        step="0.01"
                        defaultValue={panAncho}
                        className="input px-2 text-center"
                      />
                    </div>
                    <div>
                      <label className="label">Por pila</label>
                      <input
                        name="panes_por_pila"
                        type="number"
                        defaultValue={panesPorPila}
                        className="input px-2 text-center"
                      />
                    </div>
                  </div>
                </details>
              </>
            )}

            <div className="mt-3">
              <label className="label" htmlFor={`nota-cos-${pedidoId}`}>
                Nota
              </label>
              <input
                id={`nota-cos-${pedidoId}`}
                name="notas"
                placeholder="Opcional"
                autoComplete="off"
                className="input"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
              >
                Cerrar
              </button>
              <Guardar
                disabled={modo === "directo" && cortado <= 0}
                className="flex min-h-12 flex-[1.4] items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema disabled:opacity-40"
              >
                {modo === "directo" ? "Cerrar cosecha" : "Abrir el contador"}
              </Guardar>
            </div>
          </Formulario>
        </div>
      </dialog>
    </>
  );
}
