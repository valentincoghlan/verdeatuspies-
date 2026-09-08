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

  // Una temporada es el año calendario. La del año en curso corta en hoy:
  // no tiene sentido dividir por meses que todavía no pasaron.
  const temporada = sp.p?.match(/^t(\d{4})$/);
  if (temporada) {
    const anio = temporada[1];
    const enCurso = anio === hoy.slice(0, 4);
    return {
      desde: `${anio}-01-01`,
      hasta: enCurso ? hoy : `${anio}-12-31`,
      etiqueta: `Temporada ${anio}`,
    };
  }

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
    default:
      return { desde: primeroDeEsteMes, hasta: hoy, etiqueta: "Este mes" };
  }
}

/** Desde cuándo hay datos cargados. 2023 es el año en que se armó el campo. */
const PRIMERA_TEMPORADA = 2023;

function atajos(hoy: string) {
  const esteAnio = Number(hoy.slice(0, 4));
  const temporadas: { p: string; label: string }[] = [];
  for (let a = esteAnio; a >= PRIMERA_TEMPORADA; a--) {
    temporadas.push({ p: `t${a}`, label: `Temporada ${a}` });
  }
  // "Este año" no está: es la temporada del año en curso.
  return [{ p: "mes", label: "Este mes" }, { p: "anterior", label: "Mes pasado" }, ...temporadas];
}

export function FiltroFechas({
  base,
  activo,
  rango,
  moneda,
}: {
  base: string;
  activo?: string;
  rango: Rango;
  /** Si va, aparece el interruptor de pesos/dólares. */
  moneda?: "ARS" | "USD";
}) {
  const actual = activo ?? "mes";
  const ATAJOS = atajos(hoyISO());
  // El período viaja en el link para que cambiar de moneda no te devuelva
  // al mes en curso.
  const conMoneda = (m: string) => `${base}?p=${actual}${m === "USD" ? "&m=usd" : ""}`;

  return (
    <div className="card">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
        Período
      </p>

      <div className="flex flex-wrap gap-2">
        {ATAJOS.map((a) => (
          <Link
            key={a.p}
            href={`${base}?p=${a.p}${moneda === "USD" ? "&m=usd" : ""}`}
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

      {moneda && (
        <div className="mt-3 flex items-center gap-2 border-t border-beige pt-3">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
            Moneda
          </span>
          <div className="flex gap-1.5">
            {(["ARS", "USD"] as const).map((m) => (
              <Link
                key={m}
                href={conMoneda(m)}
                className={
                  "inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-bold transition " +
                  (moneda === m ? "bg-pasto text-crema" : "bg-beige text-tinta-2 hover:bg-borde")
                }
              >
                {m === "ARS" ? "Pesos" : "Dólares"}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* El rango a medida se pliega: casi siempre alcanza con los atajos. */}
      <details className="mt-3 border-t border-beige pt-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-pasto">
          Otro rango de fechas
        </summary>
        <form action={base} method="get" className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
          {moneda === "USD" && <input type="hidden" name="m" value="usd" />}
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
