import { Chip } from "@/components/ui";
import { fechaDM, numero } from "@/lib/format";

/**
 * El desglose de la plata que entró o salió, abriéndose de a un nivel:
 * categoría → subcategoría → los movimientos de verdad.
 *
 * Son `<details>` anidados y no estado de React a propósito: la pantalla
 * sigue siendo un Server Component, se abre sin JavaScript y el navegador
 * se acuerda de lo que tenías abierto al volver de otra página.
 *
 * En el celular quedan el nombre, el porcentaje y el monto. Las columnas
 * de apoyo —cuántos movimientos, la barra de proporción, la cuenta y el
 * lote de cada línea— aparecen recién en la compu, donde sobra el ancho.
 */

export type LineaMov = {
  id: string;
  fecha: string;
  monto: number;
  detalle: string | null;
  cuenta: string | null;
  persona: string | null;
  cliente: string | null;
  lote: string | null;
  categoria: string | null;
  subcategoria: string | null;
  tipo_plata: string | null;
  origen: string | null;
};

export type Rama = {
  nombre: string;
  total: number;
  tipoPlata: string;
  subs: { nombre: string; total: number; lineas: LineaMov[] }[];
  cantidad: number;
};

/** Cómo se llama cada clase de plata cuando no es la normal de ese lado. */
const ETIQUETA_PLATA: Record<string, string> = {
  operativo: "operativo",
  inversion: "inversión",
  financiero: "financiero",
  cobranza: "cobranza",
};

/** Qué decir de un movimiento cuando no tiene detalle escrito. */
function concepto(l: LineaMov) {
  return l.detalle?.trim() || l.persona || l.cliente || l.subcategoria || l.categoria || "Sin detalle";
}

/** Lo que acompaña abajo, en chico: de qué cuenta salió y a qué lote fue. */
function contexto(l: LineaMov) {
  const partes = [l.cuenta, l.lote, l.detalle?.trim() ? l.persona : null].filter(Boolean);
  return partes.join(" · ");
}

function Flecha() {
  return (
    <span
      aria-hidden
      className="flecha shrink-0 text-[10px] leading-none text-tinta-3 transition"
    >
      ▶
    </span>
  );
}

export function Desglose({
  ramas,
  total,
  tono,
  plata,
  vacio,
  normal,
}: {
  ramas: Rama[];
  total: number;
  /** Verde para lo que entra, ámbar para lo que sale. */
  tono: "verde" | "ambar";
  plata: (n: number) => string;
  vacio: string;
  /**
   * Qué clase de plata es la esperable de este lado: cobranza en lo que
   * entra, operativo en lo que sale. Solo se marca con chip lo que se
   * sale de eso; si no, el cartelito aparece en todas las filas y deja
   * de avisar nada.
   */
  normal: string;
}) {
  if (ramas.length === 0) {
    return (
      <p className="rounded-xl bg-crema py-6 text-center text-sm text-tinta-2">{vacio}</p>
    );
  }

  const color = tono === "verde" ? "text-pasto" : "text-atencion-tx";
  const relleno = tono === "verde" ? "bg-pasto" : "bg-atencion-tx";

  return (
    <div className="divide-y divide-beige">
      {ramas.map((cat) => {
        const pct = total > 0 ? (cat.total / total) * 100 : 0;
        return (
          <details key={cat.nombre} className="group/cat">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 py-1 pr-1 group-open/cat:[&_.flecha]:rotate-90">
              <Flecha />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
                {cat.nombre}
                {cat.tipoPlata !== normal && (
                  <span className="ml-1.5 align-middle">
                    <Chip tono="neutro">{ETIQUETA_PLATA[cat.tipoPlata] ?? cat.tipoPlata}</Chip>
                  </span>
                )}
              </span>

              <span className="hidden w-20 shrink-0 text-right text-xs text-tinta-3 sm:block">
                {numero(cat.cantidad)} {cat.cantidad === 1 ? "mov." : "movs."}
              </span>

              {/* La barra de proporción: un solo tono, como el resto de la app. */}
              <span className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-borde-riel sm:block">
                <span
                  className={`block h-full rounded-full ${relleno}`}
                  style={{ width: `${Math.max(pct, 1.5)}%` }}
                />
              </span>

              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-tinta-3">
                {numero(pct, 0)}%
              </span>
              <span
                className={`w-28 shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums sm:w-32 ${color}`}
              >
                {plata(cat.total)}
              </span>
            </summary>

            <div className="mb-2 ml-3 border-l border-beige pl-3 sm:ml-4 sm:pl-4">
              {cat.subs.map((sub) => (
                <details key={sub.nombre} className="group/sub border-b border-beige last:border-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 py-1 pr-1 group-open/sub:[&_.flecha]:rotate-90">
                    <Flecha />
                    <span className="min-w-0 flex-1 truncate text-sm text-tinta-2">
                      {sub.nombre}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right text-xs text-tinta-3 sm:block">
                      {numero(sub.lineas.length)} {sub.lineas.length === 1 ? "mov." : "movs."}
                    </span>
                    <span className="w-28 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-tinta sm:w-32">
                      {plata(sub.total)}
                    </span>
                  </summary>

                  <ul className="mb-1.5 ml-3 border-l border-beige pl-3 sm:ml-4 sm:pl-4">
                    {sub.lineas.map((l) => {
                      const ctx = contexto(l);
                      return (
                        <li
                          key={l.id}
                          className="flex min-h-10 items-center gap-2.5 border-b border-beige py-1 last:border-0"
                        >
                          <span className="w-11 shrink-0 text-xs tabular-nums text-tinta-3">
                            {fechaDM(l.fecha)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-tinta">
                              {concepto(l)}
                            </span>
                            {ctx && (
                              <span className="block truncate text-[11px] text-tinta-3">{ctx}</span>
                            )}
                          </span>
                          <span className="w-28 shrink-0 whitespace-nowrap text-right text-[13px] tabular-nums text-tinta sm:w-32">
                            {plata(l.monto)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </details>
        );
      })}

      <div className="flex min-h-12 items-center gap-2.5 pr-1">
        <span className="w-3 shrink-0" />
        <span className="min-w-0 flex-1 text-sm font-bold text-tinta">Total</span>
        <span className="hidden w-20 shrink-0 sm:block" />
        <span className="hidden w-24 shrink-0 sm:block" />
        <span className="w-10 shrink-0" />
        <span
          className={`w-28 shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums sm:w-32 ${color}`}
        >
          {plata(total)}
        </span>
      </div>
    </div>
  );
}

/**
 * Arma el árbol categoría → subcategoría → líneas, ordenando todo de
 * mayor a menor: lo que más pesa se lee primero, que es como se mira un
 * reporte de plata.
 */
export function armarRamas(lineas: LineaMov[], monto: (l: LineaMov) => number): Rama[] {
  const cats = new Map<string, Rama>();

  for (const l of lineas) {
    const nombreCat = l.categoria ?? "Sin categoría";
    const nombreSub = l.subcategoria ?? "Sin subcategoría";

    let cat = cats.get(nombreCat);
    if (!cat) {
      cat = {
        nombre: nombreCat,
        total: 0,
        tipoPlata: l.tipo_plata ?? "operativo",
        subs: [],
        cantidad: 0,
      };
      cats.set(nombreCat, cat);
    }

    let sub = cat.subs.find((s) => s.nombre === nombreSub);
    if (!sub) {
      sub = { nombre: nombreSub, total: 0, lineas: [] };
      cat.subs.push(sub);
    }

    const m = monto(l);
    cat.total += m;
    cat.cantidad += 1;
    sub.total += m;
    sub.lineas.push(l);
  }

  const ramas = [...cats.values()];
  for (const cat of ramas) {
    cat.subs.sort((a, b) => b.total - a.total);
    for (const sub of cat.subs) sub.lineas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }
  return ramas.sort((a, b) => b.total - a.total);
}
