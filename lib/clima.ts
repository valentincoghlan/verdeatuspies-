/**
 * Clima de Cardales vía Open-Meteo (gratis, sin API key).
 * Trae 7 días para atrás (observado) y 7 para adelante (pronóstico).
 */

export type DiaClima = {
  fecha: string;
  precipitacion_mm: number | null;
  prob_precipitacion: number | null;
  temp_max: number | null;
  temp_min: number | null;
  et0_mm: number | null;
  viento_max: number | null;
  es_pronostico: boolean;
};

export async function traerClima(
  lat: number,
  lon: number,
  { pasados = 7, futuros = 7 } = {},
): Promise<DiaClima[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    [
      "precipitation_sum",
      "precipitation_probability_max",
      "temperature_2m_max",
      "temperature_2m_min",
      "et0_fao_evapotranspiration",
      "wind_speed_10m_max",
    ].join(","),
  );
  url.searchParams.set("timezone", "America/Argentina/Buenos_Aires");
  url.searchParams.set("past_days", String(pasados));
  url.searchParams.set("forecast_days", String(futuros));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);

  const json = (await res.json()) as {
    daily?: {
      time?: string[];
      precipitation_sum?: (number | null)[];
      precipitation_probability_max?: (number | null)[];
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      et0_fao_evapotranspiration?: (number | null)[];
      wind_speed_10m_max?: (number | null)[];
    };
  };

  const d = json.daily;
  if (!d?.time) return [];

  const hoy = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .slice(0, 10);

  return d.time.map((fecha, i) => ({
    fecha,
    precipitacion_mm: d.precipitation_sum?.[i] ?? null,
    prob_precipitacion: d.precipitation_probability_max?.[i] ?? null,
    temp_max: d.temperature_2m_max?.[i] ?? null,
    temp_min: d.temperature_2m_min?.[i] ?? null,
    et0_mm: d.et0_fao_evapotranspiration?.[i] ?? null,
    viento_max: d.wind_speed_10m_max?.[i] ?? null,
    es_pronostico: fecha >= hoy,
  }));
}
