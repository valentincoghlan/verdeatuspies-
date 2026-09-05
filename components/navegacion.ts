/** Un solo lugar donde vive el mapa de pantallas de la app. */

export type Link = { href: string; label: string };
export type Seccion = { label: string; items: Link[] };

/**
 * Lo que se toca todo el día desde el campo: va en la barra de abajo.
 *
 * Inicio va al medio y no primero: es el lugar que el pulgar alcanza sin
 * estirarse, y es la pantalla a la que más se vuelve.
 */
export const ATAJOS: Link[] = [
  { href: "/ventas/pedidos", label: "Pedidos" },
  { href: "/mantenimiento/cosecha", label: "Cosecha" },
  { href: "/", label: "Inicio" },
  { href: "/mantenimiento/riego", label: "Riego" },
];

export const SECCIONES: Seccion[] = [
  {
    label: "Mantenimiento",
    items: [
      { href: "/mantenimiento/cosecha", label: "Cosecha" },
      { href: "/mantenimiento/riego", label: "Riego y lluvias" },
      { href: "/mantenimiento/cortes", label: "Cortes" },
      { href: "/mantenimiento/fertilizaciones", label: "Fertilización" },
    ],
  },
  {
    label: "Ventas",
    items: [
      { href: "/ventas/pedidos", label: "Pedidos" },
      { href: "/ventas", label: "Ventas" },
      { href: "/ventas/clientes", label: "Clientes" },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/administracion", label: "Movimientos" },
      { href: "/administracion/disponibilidades", label: "Disponibilidades" },
      { href: "/reportes", label: "Reportes" },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { href: "/config", label: "General" },
      { href: "/config/datos", label: "Datos" },
      { href: "/config/lotes", label: "Lotes y zonas" },
      { href: "/config/integraciones", label: "Integraciones" },
      { href: "/config/equipo", label: "Equipo" },
      { href: "/config/cuenta", label: "Mi cuenta" },
    ],
  },
];

/** Todas las rutas, de la más específica a la más general. */
export const TODAS: Link[] = [
  { href: "/", label: "Inicio" },
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
