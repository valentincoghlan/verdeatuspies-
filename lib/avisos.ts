/**
 * El catálogo de avisos.
 *
 * Es la única lista: la usa la pantalla de Ajustes para mostrar los
 * interruptores y la usan los avisos para saber cómo se llama cada uno.
 * Si mañana sumamos uno nuevo, se agrega acá y aparece solo, encendido.
 */
export const AVISOS = [
  {
    tipo: "pronostico_lluvia",
    titulo: "Va a llover",
    detalle: "Cuando el pronóstico marca lluvia sobre el umbral en los próximos dos días.",
    grupo: "Clima",
  },
  {
    tipo: "confirmar_lluvia",
    titulo: "Confirmá cuánto llovió",
    detalle: "Al otro día de una lluvia pronosticada, para que cargues los mm del pluviómetro.",
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
    titulo: "Riegos frenados o reanudados",
    detalle: "Cuando alguien cancela los riegos programados, o los vuelve a habilitar.",
    grupo: "Riego",
  },
  {
    tipo: "sin_agua",
    titulo: "El campo lleva días sin agua",
    detalle: "Cuatro días o más sin lluvia ni riego registrados.",
    grupo: "Riego",
  },
  {
    tipo: "pedido_nuevo",
    titulo: "Pedido nuevo",
    detalle: "Cuando se carga un pedido, con los m² y para cuándo hay que cosechar.",
    grupo: "Ventas",
  },
  {
    tipo: "entrega_proxima",
    titulo: "Entrega en puerta",
    detalle: "Dos días antes y el día de la entrega, avisando si el pronóstico la complica.",
    grupo: "Ventas",
  },
  {
    tipo: "confirmar_entrega",
    titulo: "Confirmá la entrega",
    detalle: "Cuando pasó la fecha de entrega y el pedido sigue abierto.",
    grupo: "Ventas",
  },
  {
    tipo: "entrega_confirmada",
    titulo: "Entrega confirmada",
    detalle: "Cuando se cierra una operación: quién, cuántos m² y por cuánta plata.",
    grupo: "Ventas",
  },
  {
    tipo: "fertilizacion",
    titulo: "Fertilización agendada o atrasada",
    detalle: "Unos días antes de la fecha, y de nuevo si se pasó y sigue sin aplicar.",
    grupo: "Mantenimiento",
  },
  {
    tipo: "corte_atrasado",
    titulo: "Corte atrasado",
    detalle: "Cuando un lote se pasó de los días que definiste como objetivo.",
    grupo: "Mantenimiento",
  },
] as const;

export const GRUPOS = ["Clima", "Riego", "Ventas", "Mantenimiento"] as const;
