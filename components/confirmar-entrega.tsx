"use client";

import { useRef } from "react";
import { Elegir } from "@/components/elegir";
import { Formulario, Guardar } from "@/components/guardar";

/**
 * Quiénes pueden entregar.
 *
 * Es el equipo, y es corto: se elige de la lista en vez de escribirlo,
 * que es como se evita tener "Salvador" y "salvador" contados aparte.
 * Igual admite uno nuevo por si algún día entrega otro.
 */
const ENTREGAN = ["Pedro", "Valentín", "Salvador", "Miguel"];

/**
 * El "¿se entregó?" de un pedido, en un modal.
 *
 * Antes el formulario estaba embebido en la tarjeta de Inicio: tres
 * campos, un botón y un bloque de reprogramar, todo por cada pedido
 * pendiente. Con dos pedidos no entraba nada más en la pantalla.
 *
 * Ahora la tarjeta dice una línea —cuándo y a quién— y el formulario se
 * abre cuando lo vas a usar. El modal scrollea por dentro, así el
 * teclado del celular no tapa el botón de confirmar.
 */
export function ConfirmarEntrega({
  pedidoId,
  comprador,
  m2,
  fecha,
  confirmar,
  reprogramar,
  anular,
  m2Facturados,
  m2Cortesia,
  etiqueta = "¿Se entregó?",
  nota,
  quienEntrega,
  quienRetira,
}: {
  pedidoId: string;
  comprador: string;
  m2: number;
  fecha: string;
  confirmar: (fd: FormData) => Promise<void>;
  reprogramar: (fd: FormData) => Promise<void>;
  anular: (fd: FormData) => Promise<void>;
  /** Prellenado desde la cosecha. Si no va, se usan los m² del pedido. */
  m2Facturados?: number;
  m2Cortesia?: number;
  etiqueta?: string;
  /** Una línea de contexto arriba de los campos. */
  nota?: string;
  /** Lo que ya estaba anotado, si se está corrigiendo una entrega. */
  quienEntrega?: string | null;
  quienRetira?: string | null;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="flex min-h-11 w-full items-center justify-center rounded-full bg-pasto px-4 text-sm font-bold text-crema transition active:scale-[.98] sm:min-h-10 sm:w-auto"
      >
        {etiqueta}
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto max-h-[85vh] w-[21rem] overflow-y-auto rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-[26rem]"
      >
        <div className="p-5">
          <p className="text-base font-bold">{comprador}</p>
          <p className="mt-0.5 text-sm text-tinta-2">
            {nota ??
              `${m2.toLocaleString("es-AR")} m² agendados para el ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}.`}
          </p>

          <Formulario action={confirmar} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="id" value={pedidoId} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor={`m2-${pedidoId}`}>
                  m² facturados
                </label>
                <input
                  id={`m2-${pedidoId}`}
                  name="m2"
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  defaultValue={m2Facturados ?? m2}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`cort-${pedidoId}`}>
                  m² de cortesía
                </label>
                <input
                  id={`cort-${pedidoId}`}
                  name="m2_cortesia"
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={m2Cortesia ?? 0}
                  className="input"
                />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor={`fecha-${pedidoId}`}>
                  Fecha de entrega
                </label>
                <input
                  id={`fecha-${pedidoId}`}
                  name="fecha_entrega"
                  type="date"
                  defaultValue={fecha}
                  className="input"
                />
              </div>

              {/* Quién estuvo de cada lado. Es lo primero que se pregunta
                  cuando algo no cierra, y hasta ahora vivía en la memoria
                  del que estuvo ahí. */}
              <Elegir
                label="Quién entrega"
                name="quien_entrega"
                opciones={ENTREGAN.map((n) => ({ value: n, label: n }))}
                defaultValue={quienEntrega ?? ""}
                vacio="Elegí quién"
                opcional
                permiteNuevo
                className="col-span-2"
              />

              <div className="col-span-2">
                <label className="label" htmlFor={`retira-${pedidoId}`}>
                  Quién retira
                </label>
                <input
                  id={`retira-${pedidoId}`}
                  name="quien_retira"
                  defaultValue={quienRetira ?? ""}
                  placeholder="El cliente, un fletero, el de la obra…"
                  autoComplete="off"
                  className="input"
                />
                <p className="mt-1 text-xs text-tinta-3">
                  Opcional: muchas veces se deja en el campo y no hay nadie.
                </p>
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
              <Guardar className="flex min-h-12 flex-[1.4] items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema">
                Se entregó
              </Guardar>
            </div>
          </Formulario>

          <details className="group mt-3 border-t border-beige pt-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-tinta-3">
              No se entregó
              <span aria-hidden className="text-[9px] group-open:rotate-180">
                ▾
              </span>
            </summary>

            <Formulario
              action={reprogramar}
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={() => dialogo.current?.close()}
            >
              <input type="hidden" name="id" value={pedidoId} />
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor={`nueva-${pedidoId}`}>
                  Va para el
                </label>
                <input
                  id={`nueva-${pedidoId}`}
                  name="fecha_entrega"
                  type="date"
                  required
                  className="input"
                />
              </div>
              <Guardar className="btn-ghost">Reprogramar</Guardar>
            </Formulario>

            <Formulario
              action={anular}
              className="mt-2"
              onSubmit={(e) => {
                if (!confirm(`¿El pedido de ${comprador} se cayó? Se anula.`)) {
                  e.preventDefault();
                  return;
                }
                dialogo.current?.close();
              }}
            >
              <input type="hidden" name="id" value={pedidoId} />
              <Guardar
                esperando=""
                velo="Anotando…"
                className="flex min-h-11 w-full items-center justify-center rounded-full text-xs font-bold text-tinta-3 transition hover:bg-urgente-bg hover:text-urgente-tx"
              >
                Se cayó
              </Guardar>
            </Formulario>
          </details>
        </div>
      </dialog>
    </>
  );
}
