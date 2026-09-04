const NBSP = " ";

export function pesos(n: number | null | undefined, decimales = 0) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

export function dolares(n: number | null | undefined, decimales = 0) {
  if (n === null || n === undefined) return "—";
  return `US$${NBSP}${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n)}`;
}

export function numero(n: number | null | undefined, decimales = 0) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

export function m2(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `${numero(n)}${NBSP}m²`;
}

export function mm(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `${numero(n, 1)}${NBSP}mm`;
}

/** Fecha ISO (yyyy-mm-dd) a dd/mm. Sin líos de timezone. */
export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** Fecha ISO a dd/mm/aa. Para tablas, donde el espacio manda. */
export function fechaBreve(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function fechaLarga(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Hoy en Argentina, como yyyy-mm-dd. */
export function hoyISO() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .slice(0, 10);
}

export function sumarDiasISO(iso: string, dias: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días enteros entre dos fechas ISO (b - a). */
export function diasEntre(a: string, b: string = hoyISO()) {
  const da = new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

export function diasDesde(iso: string | null | undefined) {
  if (!iso) return null;
  return diasEntre(iso);
}
