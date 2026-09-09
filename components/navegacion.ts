/** Un solo lugar donde vive el mapa de pantallas de la app. */

export type Link = { href: string; label: string; icono?: string };
export type Seccion = { label: string; items: Link[] };

/**
 * Lo que se toca todo el día desde el campo: va en la barra de abajo.
 *
 * Inicio va al medio y no primero: es el lugar que el pulgar alcanza sin
 * estirarse, y es la pantalla a la que más se vuelve.
 */
export const ATAJOS: Link[] = [
  { href: "/ventas/pedidos", label: "Pedidos", icono: "pedidos" },
  { href: "/mantenimiento/cosecha", label: "Cosecha", icono: "cosecha" },
  { href: "/", label: "Inicio", icono: "inicio" },
  { href: "/mantenimiento/riego", label: "Riego" },
];

export const SECCIONES: Seccion[] = [
  {
    label: "Mantenimiento",
    items: [
      { href: "/mantenimiento/cosecha", label: "Cosecha", icono: "cosecha" },
      { href: "/mantenimiento/riego", label: "Riego y lluvias", icono: "riego" },
      { href: "/mantenimiento/cortes", label: "Cortes", icono: "cortes" },
      { href: "/mantenimiento/fertilizaciones", label: "Fertilización", icono: "fertilizacion" },
    ],
  },
  {
    label: "Ventas",
    items: [
      { href: "/ventas/pedidos", label: "Pedidos", icono: "pedidos" },
      { href: "/ventas", label: "Ventas", icono: "ventas" },
      { href: "/ventas/clientes", label: "Clientes", icono: "clientes" },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/administracion", label: "Movimientos", icono: "movimientos" },
      { href: "/administracion/disponibilidades", label: "Disponibilidades", icono: "disponibilidades" },
      { href: "/reportes", label: "Reportes", icono: "reportes" },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { href: "/config", label: "General", icono: "general" },
      { href: "/config/datos", label: "Datos", icono: "datos" },
      { href: "/config/lotes", label: "Lotes y zonas", icono: "lotes" },
      { href: "/config/integraciones", label: "Integraciones", icono: "integraciones" },
      { href: "/config/equipo", label: "Equipo", icono: "equipo" },
      { href: "/config/cuenta", label: "Mi cuenta", icono: "cuenta" },
    ],
  },
];

/** Todas las rutas, de la más específica a la más general. */
export const TODAS: Link[] = [
  { href: "/", label: "Inicio", icono: "inicio" },
  ...SECCIONES.flatMap((s) => s.items),
];

/**
 * Cuál de las rutas está abierta. Gana la más específica: en
 * /ventas/pedidos se prende Pedidos, no Ventas.
 */
export function rutaActiva(pathname: string) {
  return TODAS.map((l) => l.href)
    .filter((href) =>
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"),
    )
    .sort((a, b) => b.length - a.length)[0];
}
