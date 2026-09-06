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
  required,
  todos,
}: {
  label: string;
  name: string;
  opciones: { value: string; label: string }[];
  resumenVacio?: string;
  className?: string;
  /** Frena el envío si no se eligió ninguno. */
  required?: boolean;
  /** Texto del atajo que marca todos de una. Si no va, no se muestra. */
  todos?: string;
}) {
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);

  const alternar = (v: string) =>
    setElegidos((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]));

  const estanTodos = opciones.length > 0 && elegidos.length === opciones.length;
  const alternarTodos = () => setElegidos(estanTodos ? [] : opciones.map((o) => o.value));

  const nombres = opciones.filter((o) => elegidos.includes(o.value)).map((o) => o.label);

  // Con uno o dos entran los nombres; con más, la cuenta se lee mejor
  // que una tira de texto cortada.
  const resumen =
    nombres.length === 0
      ? resumenVacio
      : todos && estanTodos && opciones.length > 2
        ? todos
        : nombres.length <= 2
          ? nombres.join(" + ")
          : `${nombres.length} elegidos`;

  return (
    <div className={"relative min-w-0 " + (className ?? "")}>
      <span className="label">{label}</span>

      {/*
        Igual que en Elegir: el valor viaja en un input de verdad para
        que el navegador frene el envío si el campo es obligatorio y no
        se eligió nada. Los ocultos quedan afuera de la validación.
      */}
      {required && (
        <input
          type="text"
          value={elegidos.join(",")}
          required
          tabIndex={-1}
          aria-hidden
          onChange={() => {}}
          onInvalid={() => setAbierto(true)}
          className="pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0"
        />
      )}

      <details
        className="group relative"
        open={abierto}
        onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}
      >
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
            <>
              {todos && opciones.length > 1 && (
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-b border-beige px-3 text-sm font-bold text-tinta transition hover:bg-beige">
                  <input
                    type="checkbox"
                    checked={estanTodos}
                    onChange={alternarTodos}
                    className="size-5 shrink-0 accent-pasto"
                  />
                  <span className="truncate">{todos}</span>
                </label>
              )}
              {opciones.map((o) => (
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
              ))}
            </>
          )}
        </div>
      </details>
    </div>
  );
}
