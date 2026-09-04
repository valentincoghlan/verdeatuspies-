"use client";

import { useRef, useState } from "react";

export type ZonaProgramada = {
  id: string;
  nombre: string;
  loteId: string | null;
  lote: string | null;
  proximo: string | null; // ISO
  minutos: number | null;
  mmPorHora: number | null;
  suspendidaHasta: string | null; // ISO
};

const FMT = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const cuando = (iso: string | null) => (iso ? FMT.format(new Date(iso)) : null);
const mmDe = (minutos: number | null, mmPorHora: number | null) =>
  minutos && mmPorHora ? (minutos / 60) * Number(mmPorHora) : null;

/**
 * Lo que el controlador tiene programado, y el botón para cancelarlo.
 *
 * Los programas se cargan en Hydrawise; acá se ven y se pueden frenar.
 * Cancelar no borra nada: le dice al controlador que no riegue hasta el
 * momento que elijas, y después sigue como estaba.
 */
export function RiegosProgramados({
  zonas,
  suspender,
}: {
  zonas: ZonaProgramada[];
  suspender: (fd: FormData) => Promise<void>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [zona, setZona] = useState<ZonaProgramada | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const conPrograma = zonas.filter((z) => z.proximo);
  const suspendidas = zonas.filter((z) => z.suspendidaHasta);

  const abrir = (z: ZonaProgramada) => {
    setZona(z);
    dialogo.current?.showModal();
  };

  return (
    <>
      {conPrograma.length === 0 && suspendidas.length === 0 ? (
        <p className="rounded-xl bg-crema px-3 py-6 text-center text-sm text-tinta-2">
          El controlador no tiene ningún riego programado. Los programas se cargan en la app de
          Hydrawise; acá vas a ver cuándo riega cada zona y cuánta agua va a dar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {zonas
            .filter((z) => z.proximo || z.suspendidaHasta)
            // En orden de riego: es una agenda, no un listado de zonas.
            .sort((a, b) => (a.proximo ?? "9").localeCompare(b.proximo ?? "9"))
            .map((z) => {
              const mm = mmDe(z.minutos, z.mmPorHora);
              const frenada = Boolean(z.suspendidaHasta);
              return (
                <li
                  key={z.id}
                  className={
                    "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 " +
                    (frenada ? "border-atencion-tx/30 bg-atencion-bg" : "border-borde bg-crema")
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-tinta">
                      {z.nombre}
                      <span className="ml-2 text-xs font-normal text-tinta-3">{z.lote}</span>
                    </span>
                    <span className="block truncate text-xs text-tinta-2">
                      {frenada
                        ? `Cancelada hasta ${cuando(z.suspendidaHasta)}`
                        : `${cuando(z.proximo)} · ${z.minutos ?? "?"} min`}
                    </span>
                  </span>

                  {!frenada && (
                    <span className="text-sm font-bold tabular-nums text-pasto">
                      {mm
                        ? `${mm.toFixed(1).replace(".", ",")} mm`
                        : z.minutos
                          ? "sin caudal"
                          : ""}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => abrir(z)}
                    className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-borde bg-white px-3 text-xs font-bold text-tinta-2 sm:min-h-8"
                  >
                    {frenada ? "Cambiar" : "Cancelar"}
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-96"
      >
        <div className="p-5">
          <p className="text-base font-bold">Cancelar esta zona</p>
          <p className="mt-1 text-sm text-tinta-2">
            No se borra nada del controlador:{" "}
            <strong className="text-tinta">{zona?.nombre}</strong> no va a regar hasta el momento
            que elijas, y después sigue con su programa.
          </p>

          <form action={suspender} className="mt-4" onSubmit={() => dialogo.current?.close()}>
            <input type="hidden" name="zona_id" value={zona?.id ?? ""} />

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
                Cancelar
              </button>
              <button className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema">
                Frenar riegos
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
