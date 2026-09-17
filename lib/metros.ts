/**
 * El diccionario de m².
 *
 * "m²" no es una magnitud: son cinco, y en el camino de un pedido a la
 * plata cobrada cada una vale distinto. Un número que dice "m²" a secas
 * no se puede usar para decidir nada, porque no se sabe cuál de las
 * cinco es.
 *
 * Los nombres viven acá y en ningún otro lado. Ninguna pantalla puede
 * inventar uno nuevo ni decir "m²" pelado: se usa METROS[x].nombre.
 *
 * Las cinco, en el orden en que pasan:
 *
 *   comprometidos → cosechados → entregados → facturados → cobrados
 *
 * Y entre cada par hay una pérdida con nombre propio, que es lo que
 * el embudo deja ver de un vistazo.
 */

export type Magnitud = "comprometidos" | "cosechados" | "entregados" | "facturados" | "cobrados";

export const METROS: Record<Magnitud, { nombre: string; corto: string; que: string }> = {
  comprometidos: {
    nombre: "m² comprometidos",
    corto: "Comprometidos",
    que: "Pedidos tomados que todavía no salieron del campo.",
  },
  cosechados: {
    nombre: "m² cosechados",
    corto: "Cosechados",
    que: "Lo que se levantó del lote, contado por pilas.",
  },
  entregados: {
    nombre: "m² entregados",
    corto: "Entregados",
    que: "Lo que salió del campo: lo facturado más la cortesía.",
  },
  facturados: {
    nombre: "m² facturados",
    corto: "Facturados",
    que: "Los que se cobran. Es el denominador del precio y del margen.",
  },
  cobrados: {
    nombre: "m² cobrados",
    corto: "Cobrados",
    que: "La parte de lo facturado cuya plata ya entró.",
  },
};

/** Los estados de una venta que todavía no salió del campo. */
const SIN_SALIR = ["pedido", "cosechada", "confirmada"];

export type VentaParaEmbudo = {
  estado: string;
  /** Lo que se factura. */
  m2: number | string | null;
  m2_cortesia?: number | string | null;
  /** Lo que salió de verdad. Sin esto se usa m2 + cortesía. */
  m2_entregados?: number | string | null;
  /**
   * Lo facturado de esa venta. La tabla `ventas` lo llama `total` y la
   * vista `v_margen_ventas` lo llama `facturado`, y las dos alimentan
   * este embudo: se acepta cualquiera de los dos nombres. Sin esto, las
   * ventas que vienen de la vista quedaban con facturado en cero y todas
   * daban por cobradas.
   */
  total?: number | string | null;
  facturado?: number | string | null;
  cobrado?: number | string | null;
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export type Embudo = Record<Magnitud, number>;

/**
 * Las cinco magnitudes de un período.
 *
 * Los cosechados vienen aparte porque no salen de las ventas: salen de
 * las cosechas, que son un registro propio. Una cosecha puede abastecer
 * tres pedidos y un pedido puede necesitar dos cosechas, así que sumarlos
 * desde la venta daría cualquier cosa.
 */
export function embudoDe(ventas: VentaParaEmbudo[], m2Cosechados: number): Embudo {
  const salidas = ventas.filter((v) => v.estado === "entregada");

  const facturados = salidas.reduce((a, v) => a + n(v.m2), 0);

  const entregados = salidas.reduce(
    (a, v) => a + (v.m2_entregados != null ? n(v.m2_entregados) : n(v.m2) + n(v.m2_cortesia)),
    0,
  );

  // Proporcional: si de una entrega de 300 m² entró la mitad de la
  // plata, hay 150 m² cobrados. No es exacto al metro —nadie cobra por
  // metro— pero es la única lectura honesta de "cuánto de esto ya se
  // cobró" en la misma unidad que el resto del embudo.
  const cobrados = salidas.reduce((a, v) => {
    const total = v.facturado != null ? n(v.facturado) : n(v.total);
    if (total <= 0) return a + n(v.m2);
    const parte = Math.min(1, Math.max(0, n(v.cobrado) / total));
    return a + n(v.m2) * parte;
  }, 0);

  return {
    comprometidos: ventas.filter((v) => SIN_SALIR.includes(v.estado)).reduce((a, v) => a + n(v.m2), 0),
    cosechados: m2Cosechados,
    entregados,
    facturados,
    cobrados,
  };
}

export type Perdida = {
  /** Entre qué dos escalones. */
  desde: Magnitud;
  hasta: Magnitud;
  nombre: string;
  m2: number;
  /** Sobre el escalón de arriba. */
  pct: number;
  /** Cuando no es una pérdida de verdad, no se pinta como problema. */
  esFalta?: boolean;
};

/**
 * Qué se pierde entre un escalón y el siguiente, con nombre.
 *
 * El número solo no dice nada: que falten 330 m² entre facturado y
 * cobrado es una cobranza pendiente, y que falten 100 entre entregado y
 * facturado es pasto regalado. Son dos problemas distintos y se arreglan
 * de maneras distintas.
 */
export function perdidasDe(e: Embudo): Perdida[] {
  const paso = (desde: Magnitud, hasta: Magnitud, nombre: string): Perdida | null => {
    const arriba = e[desde];
    const abajo = e[hasta];
    // Si creció, no hay pérdida: se cosechó de más, o se entregó algo
    // comprometido en otro período.
    if (arriba <= 0 || abajo >= arriba) return null;
    const m2 = Math.round((arriba - abajo) * 10) / 10;
    return { desde, hasta, nombre, m2, pct: (m2 / arriba) * 100 };
  };

  return [
    paso("cosechados", "entregados", "quedó en el campo"),
    paso("entregados", "facturados", "de cortesía"),
    paso("facturados", "cobrados", "sin cobrar"),
  ].filter((p): p is Perdida => p !== null);
}
