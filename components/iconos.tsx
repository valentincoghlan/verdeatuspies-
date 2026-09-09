/**
 * Los íconos del menú.
 *
 * Son de línea y de 20px, del mismo grosor, para que la columna se lea
 * pareja. Con nueve ítems solo-texto cuesta encontrar el que buscás: el
 * ícono da un punto de anclaje que el ojo agarra antes que la palabra.
 *
 * Van todos acá y no en archivos sueltos porque son cuatro trazos cada
 * uno; una carpeta de diecisiete archivos sería peor.
 */
const TRAZOS: Record<string, string> = {
  inicio: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  cosecha: "M4 20h16M6 20V10m4 10V7m4 13v-6m4 6V4",
  riego: "M12 3s5.5 6 5.5 9.5a5.5 5.5 0 1 1-11 0C6.5 9 12 3 12 3Z",
  cortes: "M6 4v6m12-6v6M4 12h16M7 12v8m10-8v8",
  fertilizacion: "M12 21c0-5 3-9 8-10-1 6-4 9-8 10ZM12 21c0-5-3-9-8-10 1 6 4 9 8 10ZM12 21v-6",
  pedidos: "M4 7h16l-1.5 12h-13Zm4 0V5a4 4 0 0 1 8 0v2",
  ventas: "M4 19 10 12l3.5 3.5L20 8m0 0h-5m5 0v5",
  clientes: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5",
  movimientos: "M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3",
  disponibilidades: "M3 8h18v11H3ZM3 8l3-4h12l3 4M12 12v3m-2-1.5h4",
  reportes: "M4 20h16M7 20V9m5 11V4m5 16v-7",
  general: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-1.6-.6a6.6 6.6 0 0 0-.7-1.7l.7-1.6-1.5-1.5-1.6.7a6.6 6.6 0 0 0-1.7-.7L12.6 4h-2.2l-.6 1.6a6.6 6.6 0 0 0-1.7.7l-1.6-.7L5 7.1l.7 1.6a6.6 6.6 0 0 0-.7 1.7L3.4 11v2.2l1.6.6c.2.6.4 1.2.7 1.7l-.7 1.6 1.5 1.5 1.6-.7c.5.3 1.1.5 1.7.7l.6 1.6h2.2l.6-1.6c.6-.2 1.2-.4 1.7-.7l1.6.7 1.5-1.5-.7-1.6c.3-.5.5-1.1.7-1.7l1.6-.6Z",
  datos: "M4 6c0-1.4 3.6-2.5 8-2.5S20 4.6 20 6s-3.6 2.5-8 2.5S4 7.4 4 6Zm0 0v12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V6M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5",
  lotes: "M4 5h7v6H4Zm9 0h7v6h-7ZM4 13h7v6H4Zm9 0h7v6h-7Z",
  integraciones: "M9 7V5a2 2 0 0 1 4 0v2m-7 0h10l-.8 12H6.8ZM15 12l3 3-3 3",
  equipo: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5m1-4.3c2.4.4 4 1.9 4 4.3",
  cuenta: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5",
};

export function Icono({ nombre, className = "size-5" }: { nombre?: string; className?: string }) {
  const d = nombre ? TRAZOS[nombre] : undefined;
  if (!d) return <span className={className + " shrink-0"} aria-hidden />;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className + " shrink-0"}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
