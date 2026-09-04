import Link from "next/link";
import { hoyISO, sumarDiasISO } from "@/lib/format";

export type Rango = { desde: string; hasta: string; etiqueta: string };

/**
 * Resuelve el rango a partir de la URL.
 *
 * Los atajos se guardan como texto (`?p=90d`) para que el link se pueda
 * compartir y para que "últimos 90 días" siga siendo relativo a hoy.
 */
export function resolverRango(sp: { p?: string; desde?: string; hasta?: string }): Rango {
  const hoy = hoyISO();

  if (sp.desde || sp.hasta) {
    return {
      desde: sp.desde ?? "2000-01-01",
      hasta: sp.hasta ?? hoy,
      etiqueta: "a medida",
    };
  }

  const primeroDeEsteMes = `${hoy.slice(0, 7)}-01`;

  switch (sp.p) {
    case "anterior": {
      // El último día del mes pasado es el día antes del primero de este.
      const finAnterior = sumarDiasISO(primeroDeEsteMes, -1);
      return {
        desde: `${finAnterior.slice(0, 7)}-01`,
        hasta: finAnterior,
        etiqueta: "Mes pasado",
      };
    }
    case "anio":
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, etiqueta: "Este año" };
    default:
      return { desde: primeroDeEsteMes, hasta: hoy, etiqueta: "Este mes" };
  }
}

const ATAJOS = [
  { p: "mes", label: "Este mes" },
  { p: "anterior", label: "Mes pasado" },
  { p: "anio", label: "Este año" },
];

export function FiltroFechas({
  base,
  activo,
  rango,
}: {
  base: string;
  activo?: string;
  rango: Rango;
}) {
  const actual = activo ?? "mes";

  return (
    <div className="card">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
        Período
      </p>

      <div className="flex flex-wrap gap-2">
        {ATAJOS.map((a) => (
          <Link
            key={a.p}
            href={`${base}?p=${a.p}`}
            className={
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition sm:min-h-9 " +
              (rango.etiqueta !== "a medida" && a.p === actual
                ? "bg-pasto text-crema"
                : "bg-beige text-tinta-2 hover:bg-borde")
            }
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* El rango a medida se pliega: casi siempre alcanza con los atajos. */}
      <details className="mt-3 border-t border-beige pt-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-pasto">
          Otro rango de fechas
        </summary>
        <form action={base} method="get" className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
          <div>
            <label className="label" htmlFor="desde">
              Desde
            </label>
            <input id="desde" name="desde" type="date" defaultValue={rango.desde} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hasta">
              Hasta
            </label>
            <input id="hasta" name="hasta" type="date" defaultValue={rango.hasta} className="input" />
          </div>
          <div className="col-span-2">
            <button className="btn-ghost">Aplicar</button>
          </div>
        </form>
      </details>
    </div>
  );
}
