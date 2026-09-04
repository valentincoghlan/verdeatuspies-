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

const HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DIA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const DIA_HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const mmDe = (minutos: number | null, mmPorHora: number | null) =>
  minutos && mmPorHora ? (minutos / 60) * Number(mmPorHora) : null;

/** ¿Cae dentro de las próximas 24 horas? */
const esInminente = (iso: string | null) => {
  if (!iso) return false;
  const falta = new Date(iso).getTime() - Date.now();
  return falta > -3600_000 && falta < 24 * 3600_000;
};

/**
 * Lo que el controlador tiene programado, y el botón para frenarlo.
 *
 * Muestra solo las próximas 24 horas: más allá de eso la API no sabe
 * nada —devuelve el próximo riego de cada zona, no el patrón de
 * repetición— y una lista larga de fechas sueltas confunde más de lo que
 * aporta.
 *
 * Cada lote va en su propio bloque plegable, uno al lado del otro en la
 * compu: son dos agendas distintas que no se mezclan.
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

  const relevantes = zonas.filter((z) => esInminente(z.proximo) || z.suspendidaHasta);
  const masAdelante = zonas.filter((z) => z.proximo && !esInminente(z.proximo) && !z.suspendidaHasta);

  const porLote = new Map<string, ZonaProgramada[]>();
  for (const z of relevantes) {
    const k = z.lote ?? "Sin lote asignado";
    if (!porLote.has(k)) porLote.set(k, []);
    porLote.get(k)!.push(z);
  }
  for (const lista of porLote.values()) {
    lista.sort((a, b) => (a.proximo ?? "9").localeCompare(b.proximo ?? "9"));
  }

  const abrir = (z: ZonaProgramada) => {
    setZona(z);
    dialogo.current?.showModal();
  };

  return (
    <>
      {porLote.size === 0 ? (
        <p className="rounded-xl bg-crema px-3 py-6 text-center text-sm text-tinta-2">
          No hay riegos agendados para las próximas 24 horas. Los programas se cargan en la app de
          Hydrawise; acá vas a ver cuándo riega cada zona y cuánta agua va a dar.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {[...porLote.entries()].map(([lote, delLote]) => {
            const frenadas = delLote.filter((z) => z.suspendidaHasta).length;
            const mmTotal = delLote
              .filter((z) => !z.suspendidaHasta)
              .reduce((a, z) => a + (mmDe(z.minutos, z.mmPorHora) ?? 0), 0);
            const minutosTotal = delLote
              .filter((z) => !z.suspendidaHasta)
              .reduce((a, z) => a + (z.minutos ?? 0), 0);

            return (
              <details key={lote} open className="group rounded-2xl border border-borde bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-tinta">{lote}</span>
                    <span className="block truncate text-xs text-tinta-3">
                      {frenadas === delLote.length
                        ? `${frenadas} zonas frenadas`
                        : `${delLote.length - frenadas} zonas · ${minutosTotal} min` +
                          (mmTotal > 0 ? ` · ${mmTotal.toFixed(1).replace(".", ",")} mm` : "")}
                    </span>
                  </span>
                  <span aria-hidden className="text-xs text-tinta-3 transition group-open:rotate-180">
                    ▾
                  </span>
                </summary>

                <ul className="divide-y divide-beige border-t border-beige">
                  {delLote.map((z) => {
                    const mmZona = mmDe(z.minutos, z.mmPorHora);
                    const frenada = Boolean(z.suspendidaHasta);
                    return (
                      <li
                        key={z.id}
                        className={
                          "flex items-center gap-2 px-3 py-2 " + (frenada ? "bg-atencion-bg" : "")
                        }
                      >
                        <span className="w-20 shrink-0">
                          {frenada ? (
                            <span className="text-sm font-bold text-tinta">—</span>
                          ) : (
                            <>
                              <span className="block text-sm font-bold tabular-nums text-tinta">
                                {HORA.format(new Date(z.proximo!))}
                              </span>
                              <span className="block text-[11px] text-tinta-3">
                                {DIA.format(new Date(z.proximo!))}
                              </span>
                            </>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-tinta">{z.nombre}</span>
                          {frenada && (
                            <span className="block truncate text-xs text-atencion-tx">
                              frenada hasta {DIA_HORA.format(new Date(z.suspendidaHasta!))}
                            </span>
                          )}
                        </span>
                        {!frenada && (
                          <span className="shrink-0 text-right text-xs tabular-nums text-tinta-2">
                            <span className="block">{z.minutos ?? "?"} min</span>
                            <span
                              className={
                                "block font-bold " + (mmZona ? "text-pasto" : "text-atencion-tx")
                              }
                            >
                              {mmZona ? `${mmZona.toFixed(1).replace(".", ",")} mm` : "sin mm"}
                            </span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => abrir(z)}
                          className="shrink-0 rounded-full border-[1.5px] border-borde bg-white px-2.5 py-2 text-xs font-bold text-tinta-2 sm:py-1"
                        >
                          {frenada ? "Cambiar" : "Frenar"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      {masAdelante.length > 0 && (
        <p className="mt-3 text-xs text-tinta-3">
          Otras {masAdelante.length} zonas tienen riego más adelante, la primera el{" "}
          {DIA_HORA.format(
            new Date(masAdelante.sort((a, b) => a.proximo!.localeCompare(b.proximo!))[0].proximo!),
          )}
          .
        </p>
      )}

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-96"
      >
        <div className="p-5">
          <p className="text-base font-bold">Frenar esta zona</p>
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
                Frenar
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
