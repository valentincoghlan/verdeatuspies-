import type { ReactNode } from "react";

export function Campo({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  step,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  step?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

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
    <div className={className}>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="input"
      >
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
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
    <div className={className}>
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
