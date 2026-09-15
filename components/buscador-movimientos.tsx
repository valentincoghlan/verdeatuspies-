import { type Rango } from "@/components/filtro-fechas";

export type FiltrosMov = {
  q: string;
  categoria: string;
  cuenta: string;
  tipo: string;
};

/**
 * Lo que se escribió en la barra de búsqueda, ya limpio.
 *
 * El texto termina adentro de un `or()` de PostgREST, que separa las
 * condiciones con comas y las envuelve en paréntesis: si esos caracteres
 * pasan tal cual, la consulta se rompe. Se sacan y listo —nadie busca
 * una coma—, en vez de escaparlos y quedar con dos sintaxis que mantener.
 */
export function leerFiltros(sp: Record<string, string | undefined>): FiltrosMov {
  const limpio = (v?: string) => (v ?? "").replace(/[,()*\\"']/g, " ").trim().slice(0, 60);
  return {
    q: limpio(sp.q),
    categoria: (sp.cat ?? "").trim(),
    cuenta: (sp.cta ?? "").trim(),
    tipo: sp.t === "I" || sp.t === "E" ? sp.t : "",
  };
}

export const hayFiltros = (f: FiltrosMov) => Boolean(f.q || f.categoria || f.cuenta || f.tipo);

/**
 * Aplica los filtros a una consulta de v_movimientos.
 *
 * Va acá y no en la página porque la tabla y los totales son dos
 * consultas distintas sobre lo mismo: si cada una filtrara por su cuenta,
 * el resumen de arriba diría una cosa y las filas de abajo otra.
 */
export function aplicarFiltros<T>(consulta: T, f: FiltrosMov): T {
  let q = consulta as any;
  if (f.q) {
    const t = `*${f.q}*`;
    q = q.or(
      [
        `persona.ilike.${t}`,
        `categoria.ilike.${t}`,
        `subcategoria.ilike.${t}`,
        `detalle.ilike.${t}`,
        `cuenta.ilike.${t}`,
        `cliente.ilike.${t}`,
        `lote.ilike.${t}`,
      ].join(","),
    );
  }
  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.cuenta) q = q.eq("cuenta", f.cuenta);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  return q as T;
}

/**
 * La barra de búsqueda de los movimientos.
 *
 * Es un formulario GET y no un componente de cliente a propósito: lo que
 * buscaste queda en la URL, así que se puede compartir, marcar y volver
 * con el botón de atrás. Y anda sin JavaScript.
 *
 * El período viaja escondido para que buscar no te devuelva al mes en
 * curso, igual que pasa con la moneda en el filtro de fechas.
 */
export function BuscadorMovimientos({
  base,
  filtros,
  periodo,
  rango,
  categorias,
  cuentas,
  cuantos,
}: {
  base: string;
  filtros: FiltrosMov;
  periodo?: string;
  rango: Rango;
  categorias: string[];
  cuentas: string[];
  /** Cuántos quedaron después de filtrar, para decirlo. */
  cuantos: number;
}) {
  const conFiltros = hayFiltros(filtros);

  return (
    <form action={base} method="get" className="mb-3 border-b border-beige pb-3">
      {/* El período se conserva tal como vino: por atajo o a medida. */}
      {periodo ? (
        <input type="hidden" name="p" value={periodo} />
      ) : (
        <>
          <input type="hidden" name="desde" value={rango.desde} />
          <input type="hidden" name="hasta" value={rango.hasta} />
        </>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 min-w-0">
          <label className="label" htmlFor="q">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filtros.q}
            placeholder="Persona, detalle, categoría…"
            className="input"
          />
        </div>

        <div className="min-w-0">
          <label className="label" htmlFor="cat">
            Categoría
          </label>
          <select id="cat" name="cat" defaultValue={filtros.categoria} className="input">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="label" htmlFor="cta">
            Cuenta
          </label>
          <select id="cta" name="cta" defaultValue={filtros.cuenta} className="input">
            <option value="">Todas</option>
            {cuentas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label className="label" htmlFor="t">
            Entra o sale
          </label>
          <select id="t" name="t" defaultValue={filtros.tipo} className="input">
            <option value="">Las dos cosas</option>
            <option value="E">Solo lo que salió</option>
            <option value="I">Solo lo que entró</option>
          </select>
        </div>

        <div className="col-span-2 flex flex-wrap items-end gap-3 sm:col-span-3">
          <button className="btn-ghost">Buscar</button>
          {conFiltros && (
            <>
              <a
                href={periodo ? `${base}?p=${periodo}` : `${base}?desde=${rango.desde}&hasta=${rango.hasta}`}
                className="flex min-h-11 items-center text-sm font-semibold text-tinta-3 hover:text-urgente-tx sm:min-h-9"
              >
                Limpiar
              </a>
              <span className="text-sm text-tinta-2">
                {cuantos} {cuantos === 1 ? "movimiento" : "movimientos"}
              </span>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
