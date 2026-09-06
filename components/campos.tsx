import type { ReactNode } from "react";
import { Elegir } from "@/components/elegir";

export function Campo({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  step,
  decimal,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  step?: string;
  /** Números con coma, como se escriben acá. */
  decimal?: boolean;
  className?: string;
}) {
  // Un input de tipo número obliga al punto decimal y muestra "0.62"
  // donde el resto de la app dice "0,62". Para esos casos va como texto
  // con teclado numérico: `dec()` en el server entiende las dos formas.
  const valor =
    decimal && (typeof defaultValue === "number" || typeof defaultValue === "string")
      ? String(defaultValue).replace(".", ",")
      : (defaultValue ?? undefined);

  return (
    <div className={"min-w-0 " + (className ?? "")}>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={decimal ? "text" : type}
        inputMode={decimal ? "decimal" : undefined}
        step={decimal ? undefined : step}
        required={required}
        defaultValue={valor}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

/**
 * Desplegable estándar de la app.
 *
 * Por fuera se usa igual que siempre, pero por dentro ya no es un
 * <select>: la lista la dibujaba Windows y no había forma de que se
 * pareciera al resto. Ahora la dibujamos nosotros, con buscador.
 */
export function Selector({
  label,
  name,
  opciones,
  required,
  defaultValue,
  vacio,
  className,
}: {
  label: string;
  name: string;
  opciones: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string | null;
  vacio?: string;
  className?: string;
}) {
  return (
    <Elegir
      label={label}
      name={name}
      opciones={opciones}
      required={required}
      defaultValue={defaultValue ?? (vacio === undefined ? opciones[0]?.value : "")}
      vacio={vacio ?? "Elegí una opción"}
      opcional={vacio !== undefined && !required}
      className={className}
    />
  );
}

export function Nota({
  label = "Notas",
  name = "notas",
  defaultValue,
  className,
}: {
  label?: string;
  name?: string;
  defaultValue?: string | null;
  className?: string;
}) {
  return (
    <div className={"min-w-0 " + (className ?? "")}>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={defaultValue ?? undefined}
        className="input"
      />
    </div>
  );
}

/**
 * Opciones como botones, en vez de un desplegable.
 *
 * La lista que abre un <select> la dibuja el sistema operativo: no se
 * puede redondear ni sacarle el azul. Para listas cortas —el lote, el
 * canal, si entra o sale— conviene mostrarlas como botones: se ven como
 * el resto de la app y se tocan de una, sin abrir nada.
 *
 * Son radios de verdad, así que el formulario los manda igual que antes.
 */
export function Opciones({
  label,
  name,
  opciones,
  defaultValue,
  ocultarLabel,
  className,
}: {
  label: string;
  name: string;
  opciones: { value: string; label: string }[];
  defaultValue?: string | null;
  /** Cuando las opciones ya se explican solas ("Sale" / "Entra"). */
  ocultarLabel?: boolean;
  className?: string;
}) {
  const elegido = defaultValue ?? opciones[0]?.value;

  return (
    <div className={"min-w-0 " + (className ?? "")}>
      {/* Aunque no se lea, el renglón queda: si no, la fila se desalinea. */}
      <span className={"label" + (ocultarLabel ? " invisible" : "")} aria-hidden={ocultarLabel}>
        {label}
      </span>
      {/* Todas del mismo ancho: si no, "Sale" queda más chico que "Entra". */}
      <div role="group" aria-label={label} className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
        {opciones.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === elegido}
              className="peer sr-only"
            />
            <span className="flex min-h-[52px] items-center justify-center rounded-[16px] border-[1.5px] border-borde bg-crema px-4 text-base font-semibold text-tinta-2 sm:min-h-9 sm:rounded-xl sm:px-3 sm:text-sm transition peer-checked:border-pasto peer-checked:bg-hecho-bg peer-checked:text-pasto-oscuro peer-focus-visible:ring-4 peer-focus-visible:ring-pasto/15">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function Grilla({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

export function BorrarBtn({
  action,
  id,
  label = "Borrar",
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
        {label}
      </button>
    </form>
  );
}
