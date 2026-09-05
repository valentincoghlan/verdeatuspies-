/**
 * El catálogo de avisos.
 *
 * Es la única lista: la usa la pantalla de Ajustes para mostrar los
 * interruptores y la usan los avisos para saber cómo se llama cada uno.
 * Si mañana sumamos uno nuevo, se agrega acá y aparece solo, encendido.
 *
 * Todos pueden llegar por los dos lados: al celular y por mail. Cuál de
 * los dos usa cada persona lo decide en Ajustes.
 */
export const AVISOS = [
  {
    tipo: "pronostico_lluvia",
    titulo: "Va a llover",
    detalle: "El pronóstico marca lluvia en los próximos dos días.",
    grupo: "Clima",
  },
  {
    tipo: "confirmar_lluvia",
    titulo: "Confirmá cuánto llovió",
    detalle: "Al otro día, para cargar los mm del pluviómetro.",
    grupo: "Clima",
  },
  {
    tipo: "riego_empieza",
    titulo: "Empezó a regar",
    detalle: "Cuando se abre una zona desde la app.",
    grupo: "Riego",
  },
  {
    tipo: "riego_cancelado",
    titulo: "Riegos frenados",
    detalle: "Cuando se frenan o se reanudan los riegos programados.",
    grupo: "Riego",
  },
  {
    tipo: "sin_agua",
    titulo: "Días sin agua",
    detalle: "Cuatro días o más sin lluvia ni riego.",
    grupo: "Riego",
  },
  {
    tipo: "pedido_nuevo",
    titulo: "Pedido nuevo",
    detalle: "Con los m² y para cuándo hay que cosechar.",
    grupo: "Ventas",
  },
  {
    tipo: "entrega_proxima",
    titulo: "Entrega en puerta",
    detalle: "Dos días antes y el día de la entrega.",
    grupo: "Ventas",
  },
  {
    tipo: "confirmar_entrega",
    titulo: "Confirmá la entrega",
    detalle: "Pasó la fecha y el pedido sigue abierto.",
    grupo: "Ventas",
  },
  {
    tipo: "entrega_confirmada",
    titulo: "Entrega confirmada",
    detalle: "Quién, cuántos m² y por cuánta plata.",
    grupo: "Ventas",
  },
  {
    tipo: "fertilizacion",
    titulo: "Fertilización",
    detalle: "Unos días antes, y de nuevo si se pasó la fecha.",
    grupo: "Mantenimiento",
  },
  {
    tipo: "corte_atrasado",
    titulo: "Corte atrasado",
    detalle: "Un lote se pasó de los días objetivo.",
    grupo: "Mantenimiento",
  },
] as const;

export const GRUPOS = ["Clima", "Riego", "Ventas", "Mantenimiento"] as const;
