"use client";

import { useRef, useState } from "react";

export type ZonaControl = {
  id: string;
  nombre: string;
  lote: string | null;
  conectada: boolean;
  corriendo: number | null; // minutos que le quedan, si está regando
};

const MINUTOS = [10, 15, 30, 45];

/**
 * Abrir y cortar el riego desde la app.
 *
 * Es la única pantalla que hace algo físico en el campo, así que abre el
 * agua recién después de una confirmación: se elige la zona y los
 * minutos, y el cartel dice exactamente qué va a pasar.
 */
export function ControlRiego({
  zonas,
  accion,
}: {
  zonas: ZonaControl[];
  accion: (fd: FormData) => Promise<void>;
}) {
  const [zona, setZona] = useState<ZonaControl | null>(null);
  const [minutos, setMinutos] = useState(15);
  const [aMedida, setAMedida] = useState("");
  const dialogo = useRef<HTMLDialogElement>(null);

  // Lo que se escribe a mano manda por sobre las pastillas.
  const escritos = Number(aMedida);
  const finales = aMedida.trim() && escritos > 0 ? Math.min(escritos, 240) : minutos;

  const abrirCartel = (z: ZonaControl) => {
    setZona(z);
    setAMedida("");
    dialogo.current?.showModal();
  };

  // Veinte zonas sueltas son una pared. Agrupadas por lote se leen.
  const porLote = new Map<string, ZonaControl[]>();
  for (const z of zonas) {
    const k = z.lote ?? "Sin lote asignado";
    if (!porLote.has(k)) porLote.set(k, []);
    porLote.get(k)!.push(z);
  }
  // "Linea 10" va después de "Linea 9", no entre la 1 y la 2.
  const porNumero = new Intl.Collator("es", { numeric: true }).compare;
  for (const lista of porLote.values()) lista.sort((a, b) => porNumero(a.nombre, b.nombre));

  return (
    <>
      <div className="space-y-4">
        {[...porLote.entries()].map(([lote, delLote]) => (
          <div key={lote}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
              {lote}
              <span className="ml-2 font-normal normal-case tracking-normal">
                {delLote.length} zonas
              </span>
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {delLote.map((z) => (
          <li
            key={z.id}
            className={
              "flex items-center gap-2 rounded-xl border px-3 py-2 " +
              (z.corriendo ? "border-pasto bg-hecho-bg" : "border-borde bg-crema")
            }
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
              {z.nombre}
              {z.corriendo && (
                <span className="ml-2 text-xs font-normal text-pasto">
                  regando · {z.corriendo} min
                </span>
              )}
            </span>

            {z.corriendo ? (
              <form action={accion}>
                <input type="hidden" name="zona_id" value={z.id} />
                <input type="hidden" name="accion" value="stop" />
                <button className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-urgente-tx/30 bg-urgente-bg px-3 text-xs font-bold text-urgente-tx transition hover:bg-urgente-tx hover:text-white sm:min-h-8">
                  Cortar
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!z.conectada}
                onClick={() => abrirCartel(z)}
                className="inline-flex min-h-11 items-center rounded-full bg-pasto px-4 text-xs font-bold text-crema transition hover:bg-pasto-oscuro disabled:cursor-not-allowed disabled:bg-borde disabled:text-tinta-3 sm:min-h-8"
              >
                Regar
              </button>
            )}
          </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-80 rounded-[20px] border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40 sm:w-96"
      >
        <div className="p-5">
          <p className="text-base font-bold">Abrir el riego</p>
          <p className="mt-1 text-sm text-tinta-2">
            Se va a abrir <strong className="text-tinta">{zona?.nombre}</strong> en el campo,
            ahora mismo. Elegí cuánto.
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {MINUTOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMinutos(m);
                  setAMedida("");
                }}
                className={
                  "flex min-h-11 items-center justify-center rounded-xl border-[1.5px] text-sm font-semibold transition " +
                  (finales === m
                    ? "border-pasto bg-hecho-bg text-pasto-oscuro"
                    : "border-borde bg-crema text-tinta-2")
                }
              >
                {m}
              </button>
            ))}
          </div>

          <div className="mt-2">
            <label className="label" htmlFor="minutos-a-medida">
              O poné los minutos que quieras
            </label>
            <input
              id="minutos-a-medida"
              type="number"
              min="1"
              max="240"
              inputMode="numeric"
              value={aMedida}
              onChange={(e) => setAMedida(e.target.value)}
              placeholder="Ej. 25"
              className="input"
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta-2"
            >
              Cancelar
            </button>
            <form action={accion} className="flex-1" onSubmit={() => dialogo.current?.close()}>
              <input type="hidden" name="zona_id" value={zona?.id ?? ""} />
              <input type="hidden" name="accion" value="run" />
              <input type="hidden" name="minutos" value={finales} />
              <button className="flex min-h-12 w-full items-center justify-center rounded-full bg-pasto text-sm font-bold text-crema">
                Regar {finales} min
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
