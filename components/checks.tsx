/**
 * Lista de checks dentro de un desplegable.
 *
 * Sirve para elegir varios de una (dos lotes, tres productos) sin sumar
 * estado ni librerías: es un <details> nativo con checkboxes del mismo
 * name, que el server action lee con fd.getAll().
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
  return (
    <div className={className}>
      <span className="label">{label}</span>
      <details className="group relative">
        <summary className="input flex cursor-pointer list-none items-center justify-between">
          <span className="truncate text-tierra-600">{resumenVacio}</span>
          <span aria-hidden className="ml-2 text-[10px] text-tierra-400 group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-tierra-200 bg-white p-1 shadow-lg">
          {opciones.length === 0 ? (
            <p className="px-3 py-2 text-xs text-tierra-400">No hay opciones cargadas.</p>
          ) : (
            opciones.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-tierra-100"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={o.value}
                  className="h-4 w-4 rounded border-tierra-200"
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
