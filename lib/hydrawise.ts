/**
 * Integración con Hydrawise (API REST legacy v1.x de Hunter).
 *
 * Endpoints usados:
 *   GET https://api.hydrawise.com/api/v1/customerdetails.php?api_key=...&type=controllers
 *   GET https://api.hydrawise.com/api/v1/statusschedule.php?api_key=...&controller_id=...
 *
 * Límite real de la API: no expone el historial de riegos. Devuelve el
 * próximo riego de cada zona, las zonas corriendo en este momento y
 * (según firmware) cuándo fue el último riego en formato relativo
 * ("2 days ago"). Por eso el sync:
 *   1. mantiene actualizado el catálogo de zonas,
 *   2. registra un riego por zona y por día cuando detecta que la zona
 *      corrió, sumando minutos si el cron corre seguido,
 *   3. guarda el JSON crudo en hydrawise_snapshots para auditar.
 *
 * Cadencia elegida para este proyecto: un sync por día (cron de Vercel a
 * las 8:00 ART). Con eso queda registrado si cada zona regó ese día y los
 * minutos estimados del ciclo programado. No hace falta tiempo real; si
 * algún día se quisiera el detalle exacto de minutos, basta con pegarle al
 * mismo endpoint más seguido desde un scheduler externo.
 */

const BASE = "https://api.hydrawise.com/api/v1";

export type HydrawiseRelay = {
  relay_id?: number | string;
  relay?: number;
  name?: string;
  time?: number;
  run?: number | string;
  timestr?: string;
  lastwater?: string | number;
  nicetime?: string;
  suspended?: number;
};

export type HydrawiseStatus = {
  time?: number;
  nextpoll?: number;
  relays?: HydrawiseRelay[];
  running?: { relay_id?: number | string; time_left?: number | string; relay?: number }[];
  message?: string;
  error_msg?: string;
};

export type Controlador = {
  controller_id: number | string;
  name?: string;
  serial_number?: string;
  last_contact?: number;
};

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store" });
  // Hunter permite 10 órdenes cada 5 minutos en setzone.php.
  if (res.status === 429) {
    throw new Error(
      "Hydrawise no acepta más de 10 órdenes cada 5 minutos. Esperá un rato y probá de nuevo.",
    );
  }
  if (!res.ok) throw new Error(`Hydrawise ${path}: HTTP ${res.status}`);

  // Cuando corta por exceso de órdenes contesta texto plano con estado
  // 200, así que hay que mirar el cuerpo y no solo el código.
  const cuerpo = await res.text();
  if (/exceeded maximum number of requests/i.test(cuerpo)) {
    throw new Error(
      "Hydrawise no acepta más de 10 órdenes cada 5 minutos. Esperá un rato y probá de nuevo.",
    );
  }

  try {
    return JSON.parse(cuerpo) as T;
  } catch {
    throw new Error(`Hydrawise ${path}: respuesta inesperada — ${cuerpo.slice(0, 120)}`);
  }
}

export async function listarControladores(apiKey: string): Promise<Controlador[]> {
  const data = await get<{ controllers?: Controlador[]; controller_id?: number }>(
    "customerdetails.php",
    { api_key: apiKey, type: "controllers" },
  );
  if (data.controllers?.length) return data.controllers;
  if (data.controller_id) return [{ controller_id: data.controller_id, name: "Controlador" }];
  return [];
}

/**
 * Le da una orden al controlador. Es el único endpoint que ESCRIBE.
 *
 *   run        abre una zona; `custom` son los segundos
 *   stop       la corta
 *   suspend    cancela los riegos programados de esa zona hasta el
 *              momento que diga `custom` (fecha en formato unix)
 *   suspendall lo mismo, para todas las zonas del controlador
 *
 * Para levantar una suspensión se manda la misma orden con una fecha ya
 * pasada: Hunter contesta "Resuming scheduled watering".
 */
export async function mandarZona(
  apiKey: string,
  controllerId: string | number,
  relayId: string | number | null,
  accion: "run" | "stop" | "suspend" | "suspendall",
  valor?: number,
): Promise<{ message?: string; error_msg?: string }> {
  const params: Record<string, string> = {
    api_key: apiKey,
    controller_id: String(controllerId),
    action: accion,
    period_id: "999",
  };
  if (relayId !== null && accion !== "suspendall") params.relay_id = String(relayId);
  if (valor !== undefined) params.custom = String(valor);

  const r = await get<{ message?: string; error_msg?: string }>("setzone.php", params);
  if (r.error_msg) throw new Error(`Hydrawise: ${r.error_msg}`);
  return r;
}

/**
 * El "no hay nada programado" de Hunter.
 *
 * Cuando una zona no tiene próximo riego, la API no manda un vacío: manda
 * un número enorme de segundos (unos 50 años). Cualquier cosa a más de
 * cien días es eso.
 */
export const SIN_PROGRAMAR = 100 * 86400;

export async function estadoControlador(
  apiKey: string,
  controllerId: string | number,
): Promise<HydrawiseStatus> {
  return get<HydrawiseStatus>("statusschedule.php", {
    api_key: apiKey,
    controller_id: String(controllerId),
  });
}

/** "2 days ago" / "37 minutes ago" / 1720000000 -> Date | null */
export function parsearUltimoRiego(
  valor: string | number | undefined,
  ahora = new Date(),
): Date | null {
  if (valor === undefined || valor === null) return null;

  if (typeof valor === "number" && valor > 1_000_000_000) {
    return new Date(valor * 1000);
  }

  const s = String(valor).trim().toLowerCase();
  if (!s || s === "n/a" || s === "never") return null;
  if (s === "now" || s.includes("currently")) return new Date(ahora);

  const m = s.match(/(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour|hr|day|week|month)/);
  if (!m) return null;

  const n = Number(m[1]);
  const unidad = m[2];
  const segundos =
    unidad.startsWith("sec") ? n :
    unidad.startsWith("min") ? n * 60 :
    unidad.startsWith("h") ? n * 3600 :
    unidad.startsWith("day") ? n * 86400 :
    unidad.startsWith("week") ? n * 604800 :
    n * 2592000;

  return new Date(ahora.getTime() - segundos * 1000);
}

export function fechaArgentina(d: Date): string {
  return d
    .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .slice(0, 10);
}

export function horaArgentina(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}
