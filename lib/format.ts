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
/**
 * Solo dia y mes: 03/09.
 *
 * Para las tablas que ya declaran el período arriba, donde el año es
 * ruido y además hacía que la fecha se cortara a media cifra ("03/09/2").
 */
export function fechaDM(iso: string | null | undefined) {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

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

/**
 * El lunes de la semana en la que cae esa fecha.
 *
 * La semana del campo arranca el lunes: el fin de semana es cuando se
 * entrega, no cuando se corta el período.
 */
export function lunesDeISO(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  // getUTCDay() devuelve 0 para el domingo, así que se corre uno.
  return sumarDiasISO(iso, -((d.getUTCDay() + 6) % 7));
}

/** El último día del mes en el que cae esa fecha. */
export function finDeMesISO(iso: string) {
  const [a, m] = iso.slice(0, 7).split("-").map(Number);
  const siguiente = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  return sumarDiasISO(siguiente, -1);
}

/**
 * El mismo tramo, corrido N meses para atrás.
 *
 * Sirve para comparar contra el período anterior sin que se desarme por
 * los meses de distinto largo: el 31 de marzo comparado con febrero cae
 * en el 28, no se pasa al 3 de marzo.
 */
export function mesesAtrasISO(iso: string, meses: number) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const total = a * 12 + (m - 1) - meses;
  const anioDestino = Math.floor(total / 12);
  const mesDestino = (total % 12) + 1;
  const primero = `${anioDestino}-${String(mesDestino).padStart(2, "0")}-01`;
  const ultimoDia = Number(finDeMesISO(primero).slice(8, 10));
  return `${primero.slice(0, 8)}${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
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
