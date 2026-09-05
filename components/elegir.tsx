"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Opcion = { value: string; label: string; detalle?: string };

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (s: string) => sinTildes(s.toLowerCase()).trim();

/**
 * Desplegable propio, con buscador.
 *
 * Reemplaza al <select> del navegador, cuya lista la dibuja el sistema
 * operativo y no se puede alinear con el diseño. Acá el panel es nuestro:
 * en la compu se abre debajo del campo, en el celular sube desde abajo
 * como una hoja, que deja lugar para el teclado.
 *
 * El valor viaja en un input oculto, así que el formulario lo manda igual
 * que antes. Con `permiteNuevo`, lo que escribís y no está en la lista se
 * manda tal cual: sirve para dar de alta una persona sin salir del form.
 */
export function Elegir({
  label,
  name,
  opciones,
  defaultValue = "",
  vacio = "Elegí una opción",
  required,
  opcional,
  permiteNuevo,
  ayuda,
  className,
  value,
  onChange,
  deshabilitado,
}: {
  label: string;
  name: string;
  opciones: Opcion[];
  defaultValue?: string;
  vacio?: string;
  required?: boolean;
  opcional?: boolean;
  permiteNuevo?: boolean;
  ayuda?: string;
  className?: string;
  /** Si viene `value`, manda el componente de afuera (campos encadenados). */
  value?: string;
  onChange?: (v: string) => void;
  deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [interno, setInterno] = useState(defaultValue);
  const valor = value !== undefined ? value : interno;
  const caja = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const elegida = opciones.find((o) => o.value === valor);
  const textoBoton = elegida?.label ?? (valor || vacio);

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return opciones;
    return opciones.filter((o) => normalizar(`${o.label} ${o.detalle ?? ""}`).includes(q));
  }, [opciones, busqueda]);

  const esNuevo =
    permiteNuevo &&
    busqueda.trim().length > 0 &&
    !opciones.some((o) => normalizar(o.label) === normalizar(busqueda));


  /**
   * El alto que le come el teclado a la pantalla.
   *
   * La hoja se apoya abajo, que es justo donde aparece el teclado: sin
   * esto, al escribir quedaba tapada. `visualViewport` es lo único que
   * dice cuánto se achicó la parte visible de verdad.
   */
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!abierto || !vv) return;

    const medir = () => setTeclado(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
      setTeclado(0);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    // El foco va al buscador para poder escribir de una.
    const t = setTimeout(() => buscador.current?.focus(), 30);
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const elegir = (v: string) => {
    if (onChange) onChange(v);
    else setInterno(v);
    setBusqueda("");
    setAbierto(false);
  };

  return (
    <div className={"relative " + (className ?? "")} ref={caja}>
      <span className="label">{label}</span>

      {/*
        El valor viaja en un input de verdad, no en uno `hidden`: los
        ocultos quedan afuera de la validación del navegador, así que un
        campo obligatorio se podría mandar vacío. Este no se ve ni se
        toca, pero si está vacío el navegador frena el envío y nosotros
        abrimos la lista.
      */}
      <input
        type="text"
        name={name}
        value={valor}
        required={required && !deshabilitado}
        disabled={deshabilitado}
        tabIndex={-1}
        aria-hidden
        onChange={() => {}}
        onInvalid={() => setAbierto(true)}
        className="pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0"
      />

      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => setAbierto((v) => !v)}
        className={
          "input flex items-center justify-between gap-2 text-left " +
          (valor ? "text-tinta" : "text-tinta-3") +
          (deshabilitado ? " cursor-not-allowed opacity-55" : "")
        }
      >
        <span className="truncate">{textoBoton}</span>
        <span aria-hidden className="shrink-0 text-[10px] text-tinta-3">
          ▾
        </span>
      </button>

      {abierto && !deshabilitado && (
        <>
          {/* En el celular oscurece el fondo; en la compu no hace falta. */}
          <div className="fixed inset-0 z-40 bg-tinta/30 sm:hidden" onClick={() => setAbierto(false)} />

          <div
            style={teclado > 0 ? { bottom: `calc(${teclado}px + 0.75rem)` } : undefined}
            className={
              "z-50 overflow-hidden rounded-2xl border border-borde bg-white shadow-[0_18px_40px_-20px_rgba(20,60,34,.35)] " +
              "fixed inset-x-3 bottom-3 max-h-[60vh] sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-1 sm:max-h-80 sm:w-full"
            }
          >
            <div className="border-b border-beige p-2">
              <input
                ref={buscador}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="input"
              />
            </div>

            <ul className="max-h-[50vh] overflow-y-auto p-1.5 sm:max-h-60">
              {/* Al buscar, la lista arranca por los resultados: nada arriba. */}
              {opcional && !busqueda.trim() && (
                <li>
                  <button
                    type="button"
                    onClick={() => elegir("")}
                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-tinta-3 transition hover:bg-beige"
                  >
                    {vacio}
                  </button>
                </li>
              )}

              {filtradas.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => elegir(o.value)}
                    className={
                      "flex min-h-11 w-full flex-col justify-center rounded-xl px-3 text-left text-sm font-semibold transition " +
                      (o.value === valor
                        ? "bg-hecho-bg text-pasto-oscuro"
                        : "text-tinta hover:bg-beige")
                    }
                  >
                    <span className="truncate">{o.label}</span>
                    {o.detalle && (
                      <span className="truncate text-xs font-normal text-tinta-3">{o.detalle}</span>
                    )}
                  </button>
                </li>
              ))}

              {filtradas.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-tinta-2">Nada con ese nombre.</li>
              )}
            </ul>

            {/* Agregar uno nuevo sin salir del formulario. */}
            {permiteNuevo && (
              <div className="border-t border-beige p-1.5">
                <button
                  type="button"
                  disabled={!esNuevo}
                  onClick={() => elegir(busqueda.trim())}
                  className={
                    "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition " +
                    (esNuevo
                      ? "bg-hecho-bg text-pasto-oscuro hover:bg-pasto hover:text-crema"
                      : "text-tinta-3")
                  }
                >
                  <span className="text-base leading-none">+</span>
                  {esNuevo ? `Agregar «${busqueda.trim()}»` : `Escribí arriba para agregar`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {ayuda && <p className="mt-1 text-xs text-tinta-3">{ayuda}</p>}
    </div>
  );
}
