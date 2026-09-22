/**
 * El recorrido de un pedido, con nombre propio en cada escalón.
 *
 * Un pedido no tiene "estados" sueltos repartidos en tres pantallas:
 * tiene UN camino, y en cada momento está parado en un escalón de ese
 * camino. De acá salen el nombre, el color y —lo importante— cuál es el
 * botón que sigue, así que ninguna pantalla lo inventa por su cuenta.
 *
 * La etapa la calcula la base (`v_flujo_pedidos`) a partir de lo que ya
 * existe: el estado de la venta, si hay una cosecha abierta encima y
 * cuánta plata entró. Nadie la mueve a mano, así que no puede quedar
 * desfasada de la realidad.
 */

export type Etapa =
  | "pedido"
  | "en_cosecha"
  | "cosechado"
  | "entregado"
  | "cobrado"
  | "presupuesto"
  | "anulado";

/** Los cinco escalones del camino, en orden. Los otros dos están afuera. */
export const CAMINO: Etapa[] = ["pedido", "en_cosecha", "cosechado", "entregado", "cobrado"];

export type FichaEtapa = {
  /** Como se lee en un chip. */
  nombre: string;
  /** Una palabra para el paso del recorrido, arriba de la barrita. */
  corto: string;
  /** Qué significa, en criollo. */
  que: string;
  /** Qué falta hacer. Vacío cuando el recorrido terminó. */
  falta: string;
  tono: "neutro" | "ambar" | "azul" | "verde" | "rojo";
};

export const ETAPAS: Record<Etapa, FichaEtapa> = {
  pedido: {
    nombre: "Pedido",
    corto: "Pedido",
    que: "Tomado y con precio cerrado. Nadie cortó nada todavía.",
    falta: "Falta cosechar",
    tono: "ambar",
  },
  en_cosecha: {
    nombre: "En cosecha",
    corto: "Cosecha",
    que: "Se está cortando: hay un contador abierto para este pedido.",
    falta: "Falta cerrar la cosecha",
    tono: "ambar",
  },
  cosechado: {
    nombre: "Cosechado",
    corto: "Cosechado",
    que: "El pasto está cortado y apilado. Falta llevarlo.",
    falta: "Falta entregar",
    tono: "azul",
  },
  entregado: {
    nombre: "Entregado",
    corto: "Entregado",
    que: "Salió del campo y quedó facturado. Falta que entre la plata.",
    falta: "Falta cobrar",
    tono: "azul",
  },
  cobrado: {
    nombre: "Cobrado",
    corto: "Cobrado",
    que: "Entregado y pago. El recorrido terminó.",
    falta: "",
    tono: "verde",
  },
  presupuesto: {
    nombre: "Presupuesto",
    corto: "Presupuesto",
    que: "Un precio pasado. Todavía no es un pedido.",
    falta: "Falta que lo confirmen",
    tono: "neutro",
  },
  anulado: {
    nombre: "Se cayó",
    corto: "Anulado",
    que: "El pedido no va. No genera ni pasto ni deuda.",
    falta: "",
    tono: "rojo",
  },
};

/** Los que todavía tienen algo pendiente: son los que van arriba de todo. */
export const EN_CURSO: Etapa[] = ["pedido", "en_cosecha", "cosechado", "entregado"];

export const esEtapa = (x: string): x is Etapa => x in ETAPAS;

/** En qué escalón del camino está, de 0 a 4. -1 si está afuera. */
export const pasoDe = (e: Etapa) => CAMINO.indexOf(e);

/**
 * Los filtros de la pantalla, que no son las etapas una por una.
 *
 * "Por cosechar" junta al que no arrancó con el que quedó a medio
 * contar: los dos necesitan lo mismo, que alguien vaya a cortar. Meterlos
 * en dos solapas distintas obligaría a mirar las dos para saber qué
 * queda por hacer hoy.
 */
export const FILTROS: { clave: string; label: string; etapas: Etapa[] }[] = [
  { clave: "curso", label: "En curso", etapas: EN_CURSO },
  { clave: "cosechar", label: "Por cosechar", etapas: ["pedido", "en_cosecha"] },
  { clave: "entregar", label: "Por entregar", etapas: ["cosechado"] },
  { clave: "cobrar", label: "Por cobrar", etapas: ["entregado"] },
  { clave: "cerrados", label: "Cerrados", etapas: ["cobrado", "anulado"] },
];
