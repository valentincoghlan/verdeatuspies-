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

/**
 * Pesos abreviados en millones, para las tablas angostas.
 *
 * "$ 9.007.500" no entra en una columna de telefono y rompe en cuatro
 * renglones. "$ 9,0 MM" dice lo mismo y entra. Se abrevia recien desde
 * el millon: abajo de eso el numero completo entra igual y es mas util.
 */
export function pesosCortos(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs < 1_000_000) return pesos(n);
  const mm = n / 1_000_000;
  return `$${NBSP}${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(mm)}${NBSP}MM`;
}

/**
 * Dólares abreviados en miles, para las tablas angostas. Mismo criterio
 * que pesosCortos, pero el corte va en mil: en dólares los números del
 * campo son mil veces más chicos.
 */
export function dolaresCortos(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs < 100_000) return dolares(n);
  return `US$${NBSP}${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 1000)}${NBSP}k`;
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

/**
 * dd/mm/aa, igual que fechaBreve.
 *
 * Se llamaba "larga" cuando mostraba el año entero. Toda la app usa dos
 * dígitos, así que se dejaron iguales en vez de tener dos formatos
 * conviviendo en la misma pantalla.
 */
export function fechaLarga(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
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
