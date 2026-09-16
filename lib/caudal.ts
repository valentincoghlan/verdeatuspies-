import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuánta agua tira cada zona, en milímetros por hora.
 *
 * Hay dos fuentes y una sola regla: si la zona tiene sus aspersores
 * cargados, manda la cuenta que sale de la ficha del fabricante; si no,
 * manda el número escrito a mano en Ajustes.
 *
 * La regla vive acá y en ningún otro lado. Es el número con el que los
 * minutos de riego se convierten en milímetros, y de ahí pasa al balance
 * de agua al lado de la lluvia: si dos pantallas lo resolvieran distinto,
 * el mismo riego contaría dos cantidades según dónde lo mires.
 */

export type FilaCaudal = {
  zona_id: string;
  mm_por_hora_calculado: number | string | null;
  mm_por_hora_manual: number | string | null;
  aspersores?: number | null;
  picos_sin_ficha?: number | null;
  superficie_m2?: number | string | null;
};

const aNumero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** El que vale, de los dos. */
export function caudalDeZona(fila: Partial<FilaCaudal> | null | undefined) {
  if (!fila) return null;
  return aNumero(fila.mm_por_hora_calculado) ?? aNumero(fila.mm_por_hora_manual);
}

/** De dónde salió, para poder decírselo a quien mira la pantalla. */
export function origenDelCaudal(fila: Partial<FilaCaudal> | null | undefined) {
  if (aNumero(fila?.mm_por_hora_calculado)) return "aspersores" as const;
  if (aNumero(fila?.mm_por_hora_manual)) return "manual" as const;
  return "sin_dato" as const;
}

/**
 * El caudal de todas las zonas de una, listo para buscar por id.
 *
 * Se lee la vista y no las tablas sueltas: la suma de litros por hora y
 * la división por la superficie ya están resueltas en la base.
 */
export async function caudalesPorZona(supabase: SupabaseClient) {
  // Solo las tres columnas que importan: la vista cambió de forma más de
  // una vez y pedir de más la rompe entera.
  const { data } = await supabase
    .from("v_caudal_zonas")
    .select("zona_id, mm_por_hora_calculado, mm_por_hora_manual");

  const mapa = new Map<string, number | null>();
  for (const fila of (data ?? []) as FilaCaudal[]) {
    mapa.set(fila.zona_id, caudalDeZona(fila));
  }
  return mapa;
}

/** El caudal de una sola zona. */
export async function caudalDeUnaZona(supabase: SupabaseClient, zonaId: string) {
  const { data } = await supabase
    .from("v_caudal_zonas")
    .select("zona_id, mm_por_hora_calculado, mm_por_hora_manual")
    .eq("zona_id", zonaId)
    .maybeSingle();

  return caudalDeZona(data as FilaCaudal | null);
}

/**
 * Los litros por hora de un pico a la presión que se le pida.
 *
 * La ficha de Hunter tiene una fila cada media atmósfera y las líneas no
 * trabajan justo ahí: una puede estar en 4,3 bar. Entonces se lee entre
 * renglones — el de abajo y el de arriba, y el proporcional — y fuera de
 * rango se usa el extremo, sin inventar.
 *
 * Es la misma cuenta que hace la base en `litros_hora_boquilla`
 * (migración 0037). Vive en los dos lados porque la pantalla de
 * aspersores muestra el caudal mientras se cargan los picos, antes de
 * que nada se haya guardado: si las dos cuentas se separan, el número
 * que se ve al cargar no es el que queda.
 */
export function litrosDeBoquilla(
  ficha: { modelo: string; numero: string; bar: number | string; litros_hora: number | string }[],
  modelo: string,
  numero: string,
  bar: number,
): number | null {
  const filas = ficha
    .filter((b) => b.modelo === modelo && b.numero === numero)
    .map((b) => ({ bar: Number(b.bar), litros: Number(b.litros_hora) }))
    .filter((b) => Number.isFinite(b.bar) && Number.isFinite(b.litros))
    .sort((a, b) => a.bar - b.bar);

  if (filas.length === 0 || !Number.isFinite(bar)) return null;

  const abajo = [...filas].reverse().find((f) => f.bar <= bar);
  const arriba = filas.find((f) => f.bar >= bar);

  if (!abajo) return arriba!.litros;
  if (!arriba) return abajo.litros;
  if (abajo.bar === arriba.bar) return abajo.litros;

  const proporcion = (bar - abajo.bar) / (arriba.bar - abajo.bar);
  return abajo.litros + (arriba.litros - abajo.litros) * proporcion;
}
