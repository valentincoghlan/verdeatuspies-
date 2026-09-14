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
