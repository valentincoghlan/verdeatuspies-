import { fechaBreve, numero, pesos } from "./format";

/**
 * El resumen de cuenta de un cliente, dibujado como imagen.
 *
 * No saca una foto de la pantalla: arma la imagen desde cero en un
 * `<canvas>`. Es a propósito y por dos razones. Una, que no hace falta
 * ninguna librería (las que capturan el DOM pesan y se marean con los
 * colores de Tailwind v4). La otra, que lo que se le manda al cliente no
 * tiene por qué ser lo mismo que ve el administrador: acá no van los
 * chips de estado ni el teléfono, va la cuenta y nada más.
 *
 * Vive afuera del componente porque no tiene nada de React, y así se
 * puede abrir en una página suelta para mirar cómo queda.
 */

type Compra = { fecha: string; total: number; m2: number };
type Pago = { fecha: string; monto: number; medio: string | null };

export type ResumenParaImagen = {
  cliente: string;
  periodo: string;
  desde: string;
  hasta: string;
  todo: boolean;
  saldoAnterior: number;
  entregado: number;
  metros: number;
  cobrado: number;
  saldoCierre: number;
  compras: Compra[];
  pagos: Pago[];
};

// La paleta de `globals.css`. El canvas no lee variables CSS, así que los
// hex van acá; si cambian allá, cambian acá.
const VERDE = "#143c22";
const VERDE_CLARO = "#a9c4b0";
const CREMA = "#fbf8f1";
const BEIGE = "#f2ede2";
const BORDE = "#e7e0d2";
const TINTA = "#1a1d18";
const TINTA_2 = "#5a6154";
const TINTA_3 = "#6b7264";
const AMBAR = "#8a5200";

const ANCHO = 1000;
const MARGEN = 40;
const ALTO_FILA = 34;

/** Cuántas filas de cada tabla entran antes de resumir el resto. */
const TOPE_FILAS = 14;

function texto(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opciones: { tam?: number; peso?: number; color?: string; der?: boolean } = {},
) {
  const { tam = 15, peso = 400, color = TINTA, der = false } = opciones;
  ctx.font = `${peso} ${tam}px Figtree, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = der ? "right" : "left";
  ctx.fillText(s, x, y);
}

function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  relleno: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = relleno;
  ctx.fill();
}

/**
 * Dibuja el resumen y devuelve el canvas.
 *
 * El alto se calcula antes de arrancar: la tabla más larga de las dos
 * manda, así las dos columnas terminan parejas.
 */
export function dibujar(d: ResumenParaImagen): HTMLCanvasElement {
  const filas = Math.max(
    Math.min(d.compras.length, TOPE_FILAS),
    Math.min(d.pagos.length, TOPE_FILAS),
  );
  const hayResto =
    d.compras.length > TOPE_FILAS || d.pagos.length > TOPE_FILAS ? 1 : 0;

  // Aunque no haya ninguna fila se reserva un renglón: ahí va el "sin
  // movimientos", y sin ese lugar el total le caía encima.
  const filasAlto = Math.max(filas, 1);
  const yTablas = 330;
  const alto = yTablas + 54 + filasAlto * ALTO_FILA + hayResto * 26 + 56;

  const canvas = document.createElement("canvas");
  // El doble de pixeles: en el celular una imagen a 1x se ve masticada.
  const escala = 2;
  canvas.width = ANCHO * escala;
  canvas.height = alto * escala;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(escala, escala);
  ctx.textBaseline = "alphabetic";

  // ------------------------------------------------------------ fondo
  ctx.fillStyle = CREMA;
  ctx.fillRect(0, 0, ANCHO, alto);

  // ----------------------------------------------------------- cabecera
  redondeado(ctx, 0, 0, ANCHO, 108, 0, VERDE);
  texto(ctx, d.cliente, MARGEN, 50, { tam: 30, peso: 700, color: "#ffffff" });
  texto(ctx, "Resumen de cuenta", MARGEN, 78, { tam: 15, color: VERDE_CLARO });
  texto(
    ctx,
    d.todo ? "Todo el historial" : `Del ${fechaBreve(d.desde)} al ${fechaBreve(d.hasta)}`,
    ANCHO - MARGEN,
    78,
    { tam: 15, color: VERDE_CLARO, der: true },
  );
  texto(ctx, d.periodo, ANCHO - MARGEN, 50, {
    tam: 20,
    peso: 600,
    color: "#ffffff",
    der: true,
  });

  // ------------------------------------------------------- los 4 números
  const anchoCaja = (ANCHO - MARGEN * 2 - 3 * 12) / 4;
  const cajas = [
    { rotulo: "Saldo anterior", valor: pesos(d.saldoAnterior), pie: d.todo ? "" : `Al ${fechaBreve(d.desde)}` },
    {
      rotulo: "Entregado",
      valor: pesos(d.entregado),
      pie: `${numero(d.metros)} m²`,
    },
    { rotulo: "Cobrado", valor: pesos(d.cobrado), pie: `${d.pagos.length} ${d.pagos.length === 1 ? "pago" : "pagos"}` },
    { rotulo: "Saldo al cierre", valor: pesos(d.saldoCierre), pie: d.saldoCierre > 0 ? "Te debe" : d.saldoCierre < 0 ? "Pagó de más" : "Al día", destacada: true },
  ];

  cajas.forEach((c, i) => {
    const x = MARGEN + i * (anchoCaja + 12);
    const destacada = Boolean(c.destacada);
    redondeado(ctx, x, 142, anchoCaja, 118, 16, destacada ? VERDE : "#ffffff");
    if (!destacada) {
      ctx.strokeStyle = BORDE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, 142.5, anchoCaja - 1, 117, 16);
      ctx.stroke();
    }

    texto(ctx, c.rotulo.toUpperCase(), x + 18, 172, {
      tam: 11,
      peso: 700,
      color: destacada ? VERDE_CLARO : TINTA_3,
    });
    texto(ctx, c.valor, x + 18, 212, {
      tam: 26,
      peso: 700,
      color: destacada ? "#ffffff" : c.rotulo === "Saldo al cierre" ? AMBAR : TINTA,
    });
    if (c.pie) {
      texto(ctx, c.pie, x + 18, 238, {
        tam: 13,
        color: destacada ? VERDE_CLARO : TINTA_3,
      });
    }
  });

  // ------------------------------------------------- las dos columnas
  const anchoCol = (ANCHO - MARGEN * 2 - 24) / 2;

  const columna = (
    x: number,
    titulo: string,
    cabeceras: [string, string],
    filasTexto: [string, string, string][],
    total: number,
  ) => {
    texto(ctx, titulo.toUpperCase(), x, yTablas, { tam: 12, peso: 700, color: TINTA_3 });

    redondeado(ctx, x, yTablas + 14, anchoCol, 28, 8, BEIGE);
    texto(ctx, cabeceras[0], x + 12, yTablas + 33, { tam: 12, peso: 600, color: TINTA_2 });
    texto(ctx, cabeceras[1], x + anchoCol - 12, yTablas + 33, {
      tam: 12,
      peso: 600,
      color: TINTA_2,
      der: true,
    });

    let y = yTablas + 54;
    for (const [izq, der, pie] of filasTexto.slice(0, TOPE_FILAS)) {
      texto(ctx, izq, x + 12, y + 16, { tam: 14, peso: 600 });
      texto(ctx, der, x + anchoCol - 12, y + 16, { tam: 14, peso: 700, der: true });
      if (pie) {
        texto(ctx, pie, x + anchoCol - 12, y + 29, { tam: 11, color: TINTA_3, der: true });
      }
      ctx.strokeStyle = BORDE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + ALTO_FILA - 0.5);
      ctx.lineTo(x + anchoCol, y + ALTO_FILA - 0.5);
      ctx.stroke();
      y += ALTO_FILA;
    }

    if (filasTexto.length === 0) {
      texto(ctx, "Sin movimientos en el período", x + 12, y + 16, {
        tam: 14,
        color: TINTA_3,
      });
    }

    if (filasTexto.length > TOPE_FILAS) {
      texto(ctx, `y ${filasTexto.length - TOPE_FILAS} más`, x + 12, y + 18, {
        tam: 13,
        color: TINTA_3,
      });
    }

    // El total de la columna, pegado abajo de todo.
    const yTotal = yTablas + 54 + filasAlto * ALTO_FILA + hayResto * 26 + 22;
    texto(ctx, "Total", x + 12, yTotal, { tam: 13, peso: 600, color: TINTA_2 });
    texto(ctx, pesos(total), x + anchoCol - 12, yTotal, {
      tam: 16,
      peso: 700,
      der: true,
    });
  };

  columna(
    MARGEN,
    "Entregas",
    ["Fecha", "Valor"],
    d.compras.map((c) => [
      fechaBreve(c.fecha),
      pesos(c.total),
      `${numero(c.m2)} m²`,
    ]),
    d.entregado,
  );

  columna(
    MARGEN + anchoCol + 24,
    "Pagos recibidos",
    ["Fecha", "Monto"],
    d.pagos.map((p) => [fechaBreve(p.fecha), pesos(p.monto), p.medio ?? ""]),
    d.cobrado,
  );

  return canvas;
}
