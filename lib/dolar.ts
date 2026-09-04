/**
 * Dólar MEP, de dolarapi.com.
 *
 * Es el valor con el que se dolariza todo lo que se carga de acá en
 * adelante. El histórico ya viene valorizado con la cotización que estaba
 * en la planilla, así que eso no se toca.
 *
 * La API es pública y gratuita, no hace falta clave.
 */

const URL_MEP = "https://dolarapi.com/v1/dolares/bolsa";

export type Mep = { valor: number; actualizado: string };

export async function traerMep(): Promise<Mep | null> {
  try {
    const r = await fetch(URL_MEP, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return null;

    const j = (await r.json()) as {
      compra?: number;
      venta?: number;
      fechaActualizacion?: string;
    };

    // Se usa la venta: es lo que te cuesta comprar un dólar.
    const valor = Number(j.venta ?? j.compra);
    if (!Number.isFinite(valor) || valor <= 0) return null;

    return { valor, actualizado: j.fechaActualizacion ?? new Date().toISOString() };
  } catch {
    // Si la API no responde, la corrida sigue: el resto no depende de esto.
    return null;
  }
}
