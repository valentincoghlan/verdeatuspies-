/**
 * El catálogo de avisos.
 *
 * Es la única lista: la usa la pantalla de Ajustes para mostrar los
 * interruptores y la usan los avisos para saber cómo se llama cada uno.
 * Si mañana sumamos uno nuevo, se agrega acá y aparece solo, encendido.
 *
 * `mail` dice si ese aviso puede llegar además por correo. Los que salen
 * de la corrida diaria sí; los que dispara alguien usando la app —abrir
 * un riego, cerrar una entrega— son del momento y van solo al celular.
 */
export const AVISOS = [
  {
    tipo: "pronostico_lluvia",
    mail: true,
    titulo: "Va a llover",
    detalle: "Cuando el pronóstico marca lluvia sobre el umbral en los próximos dos días.",
    grupo: "Clima",
  },
  {
    tipo: "confirmar_lluvia",
    mail: true,
    titulo: "Confirmá cuánto llovió",
    detalle: "Al otro día de una lluvia pronosticada, para que cargues los mm del pluviómetro.",
    grupo: "Clima",
  },
  {
    tipo: "riego_empieza",
    mail: false,
    titulo: "Empezó a regar",
    detalle: "Cuando se abre una zona desde la app.",
    grupo: "Riego",
  },
  {
    tipo: "riego_cancelado",
    mail: false,
    titulo: "Riegos frenados o reanudados",
    detalle: "Cuando alguien cancela los riegos programados, o los vuelve a habilitar.",
    grupo: "Riego",
  },
  {
    tipo: "sin_agua",
    mail: true,
    titulo: "El campo lleva días sin agua",
    detalle: "Cuatro días o más sin lluvia ni riego registrados.",
    grupo: "Riego",
  },
  {
    tipo: "pedido_nuevo",
    mail: false,
    titulo: "Pedido nuevo",
    detalle: "Cuando se carga un pedido, con los m² y para cuándo hay que cosechar.",
    grupo: "Ventas",
  },
  {
    tipo: "entrega_proxima",
    mail: true,
    titulo: "Entrega en puerta",
    detalle: "Dos días antes y el día de la entrega, avisando si el pronóstico la complica.",
    grupo: "Ventas",
  },
  {
    tipo: "confirmar_entrega",
    mail: true,
    titulo: "Confirmá la entrega",
    detalle: "Cuando pasó la fecha de entrega y el pedido sigue abierto.",
    grupo: "Ventas",
  },
  {
    tipo: "entrega_confirmada",
    mail: false,
    titulo: "Entrega confirmada",
    detalle: "Cuando se cierra una operación: quién, cuántos m² y por cuánta plata.",
    grupo: "Ventas",
  },
  {
    tipo: "fertilizacion",
    mail: true,
    titulo: "Fertilización agendada o atrasada",
    detalle: "Unos días antes de la fecha, y de nuevo si se pasó y sigue sin aplicar.",
    grupo: "Mantenimiento",
  },
  {
    tipo: "corte_atrasado",
    mail: true,
    titulo: "Corte atrasado",
    detalle: "Cuando un lote se pasó de los días que definiste como objetivo.",
    grupo: "Mantenimiento",
  },
] as const;

export const GRUPOS = ["Clima", "Riego", "Ventas", "Mantenimiento"] as const;
