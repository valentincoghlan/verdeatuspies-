"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal, useFormStatus } from "react-dom";

/**
 * El botón de guardar de todos los formularios.
 *
 * El problema que resuelve: se carga desde el campo, con el celular y
 * señal mala. Entre que se aprieta "Guardar" y que la pantalla se
 * actualiza pueden pasar varios segundos en los que no cambiaba nada —
 * ni el botón ni la página— así que no había forma de saber si el
 * movimiento entró. La reacción natural es volver a apretar, y ahí se
 * duplica la carga.
 *
 * Mientras la acción viaja al servidor este botón hace tres cosas:
 *
 * 1. Se deshabilita (el segundo toque no hace nada).
 * 2. Muestra una rueda girando y cambia el texto a "Guardando…".
 * 3. Levanta un velo sobre toda la pantalla, para que se vea aunque el
 *    botón haya quedado fuera de la vista al scrollear, y para que no se
 *    pueda tocar ningún otro botón mientras tanto.
 *
 * El velo espera 250 ms antes de aparecer: si el guardado es rápido no
 * llega a verse y no queda un parpadeo gris en cada carga.
 *
 * De si está guardando o no se entera por el <Formulario> que tiene
 * arriba, así que **tiene que estar adentro de uno**. Eso también es lo
 * que deja que las páginas sigan siendo del servidor: los únicos pedazos
 * de cliente son el formulario y el botón.
 */
export function Guardar({
  children,
  className = "btn",
  esperando = "Guardando…",
  velo = true,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "type"> & {
  children: ReactNode;
  /** El texto mientras guarda. Vacío ("") deja solo la rueda, para los botones angostos. */
  esperando?: string;
  /**
   * El velo sobre la pantalla. `false` lo apaga (buscar, filtrar,
   * refrescar), y un texto cambia el que muestra el cartel — útil
   * cuando el botón es angosto y lleva `esperando=""`.
   */
  velo?: boolean | string;
}) {
  // El <Formulario> de arriba es la fuente buena. `useFormStatus` queda
  // de red por si algún día este botón cae en un <form> pelado.
  const delFormulario = useContext(Guardando);
  const { pending } = useFormStatus();
  const esperandoRespuesta = delFormulario || pending;

  return (
    <>
      <button
        {...props}
        type="submit"
        disabled={esperandoRespuesta || disabled}
        aria-busy={esperandoRespuesta || undefined}
        className={className}
      >
        {esperandoRespuesta ? (
          // El gap va acá y no en el botón porque cada botón trae sus
          // propias clases y no todos tienen separación entre hijos.
          <span className="inline-flex items-center gap-2">
            <Rueda />
            {esperando && <span>{esperando}</span>}
          </span>
        ) : (
          children
        )}
      </button>

      {velo && esperandoRespuesta && (
        <Velo texto={typeof velo === "string" ? velo : esperando || "Guardando…"} />
      )}
    </>
  );
}

/**
 * El <form> de todas las pantallas que guardan algo.
 *
 * Existe por una sola razón: avisar cuándo terminó de guardar, para que
 * el <Guardar> de adentro pueda mostrarlo. La forma de React para eso
 * —`useFormStatus`— no sirve acá: con una server action colgada del
 * <form>, marca "enviando" unos 300 ms y se apaga, aunque el guardado
 * siga viajando dos segundos más (probado con React 19.0 y 19.2 sobre
 * Next 15.5). El botón volvía a la normalidad cuando todavía no había
 * pasado nada, que es justo lo que queríamos evitar.
 *
 * Por qué el estado se prende en `onSubmit` y no adentro de la acción:
 * React corre la acción dentro de una transición, y los cambios de
 * estado de una transición recién se pintan cuando la transición
 * termina. Prendido ahí adentro, el "guardando" no llegaba nunca a
 * verse — se aplicaba junto con el apagado, al final. `onSubmit` es un
 * evento común, se pinta en el acto. El apagado sí va adentro, cuando
 * la promesa de la server action vuelve, que es lo que queremos medir.
 *
 * Todo lo demás funciona como un <form> común: se le pasa la server
 * action en `action`, React limpia solo los campos al terminar y el
 * resto de los atributos (id, className, ref, el propio onSubmit) pasan
 * derecho.
 */
export function Formulario({
  action,
  onSubmit,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: (datos: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [guardando, setGuardando] = useState(false);

  return (
    <Guardando.Provider value={guardando}>
      <form
        {...props}
        onSubmit={(e) => {
          setGuardando(true);
          onSubmit?.(e);
        }}
        action={async (datos) => {
          try {
            await action(datos);
          } finally {
            setGuardando(false);
          }
        }}
      >
        {children}
      </form>
    </Guardando.Provider>
  );
}

/** Si el <Formulario> de arriba está esperando respuesta del servidor. */
const Guardando = createContext(false);

/** La rueda que gira. Toma el color del botón que la contiene. */
export function Rueda({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg
      className={"shrink-0 animate-spin " + className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * El cartel de "Guardando…" sobre toda la pantalla.
 *
 * Va por un portal al <body> para que ningún contenedor con scroll,
 * `overflow-hidden` o `transform` lo recorte — adentro de un <dialog> o
 * de una tarjeta plegable, un `fixed` común se posiciona mal.
 */
function Velo({ texto }: { texto: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] grid place-items-center bg-tinta/40 p-6"
    >
      <div className="flex items-center gap-3 rounded-[20px] border border-borde bg-white px-6 py-5 text-tinta shadow-[0_18px_40px_-20px_rgba(20,60,34,.45)]">
        <Rueda className="size-6 text-pasto" />
        <span className="text-[17px] font-semibold">{texto}</span>
      </div>
    </div>,
    document.body,
  );
}
