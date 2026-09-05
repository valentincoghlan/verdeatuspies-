"use client";

import { useState } from "react";

/**
 * Lista de checks dentro de un desplegable.
 *
 * Sirve para elegir varios de una —dos lotes, tres productos— y el
 * campo cerrado muestra lo que elegiste: antes decía siempre "Elegí uno
 * o los dos", así que había que abrirlo de nuevo para acordarte.
 *
 * Los checkboxes comparten el `name`, que el server action lee con
 * fd.getAll(): el formulario los manda igual que siempre.
 */
export function Checks({
  label,
  name,
  opciones,
  resumenVacio = "Elegí uno o más",
  className,
}: {
  label: string;
  name: string;
  opciones: { value: string; label: string }[];
  resumenVacio?: string;
  className?: string;
}) {
  const [elegidos, setElegidos] = useState<string[]>([]);

  const alternar = (v: string) =>
    setElegidos((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]));

  const nombres = opciones.filter((o) => elegidos.includes(o.value)).map((o) => o.label);

  // Con uno o dos entran los nombres; con más, la cuenta se lee mejor
  // que una tira de texto cortada.
  const resumen =
    nombres.length === 0
      ? resumenVacio
      : nombres.length <= 2
        ? nombres.join(" + ")
        : `${nombres.length} elegidos`;

  return (
    <div className={className}>
      <span className="label">{label}</span>
      <details className="group relative">
        <summary className="input flex cursor-pointer list-none items-center justify-between">
          <span className={"truncate " + (nombres.length ? "text-tinta" : "text-tinta-3")}>
            {resumen}
          </span>
          <span aria-hidden className="ml-2 text-[10px] text-tinta-3 group-open:rotate-180">
            ▾
          </span>
        </summary>

        <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-borde bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(20,60,34,.35)]">
          {opciones.length === 0 ? (
            <p className="px-3 py-2 text-xs text-tinta-3">No hay opciones cargadas.</p>
          ) : (
            opciones.map((o) => (
              <label
                key={o.value}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-tinta transition hover:bg-beige"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={o.value}
                  checked={elegidos.includes(o.value)}
                  onChange={() => alternar(o.value)}
                  className="size-5 shrink-0 accent-pasto"
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
