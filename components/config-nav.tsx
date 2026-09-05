"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Las secciones de Ajustes.
 *
 * Van en grilla de columnas iguales y no en una fila que envuelve como
 * puede: así las dos filas arrancan en el mismo margen y las columnas
 * quedan alineadas. Todos los ítems tienen la misma caja —lo único que
 * cambia entre el activo y el resto es el fondo—, porque cuando solo el
 * activo tenía caja el bloque entero se veía torcido.
 */
const SECCIONES = [
  { href: "/config", label: "General", soloEnCompu: false },
  { href: "/config/datos", label: "Datos", soloEnCompu: true },
  { href: "/config/lotes", label: "Lotes y zonas", soloEnCompu: false },
  { href: "/config/integraciones", label: "Integraciones", soloEnCompu: false },
  { href: "/config/equipo", label: "Equipo", soloEnCompu: false },
  { href: "/config/cuenta", label: "Mi cuenta", soloEnCompu: false },
];

export default function ConfigNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {SECCIONES.map((s) => {
          const activa = pathname === s.href;
          return (
            <li key={s.href} className={s.soloEnCompu ? "hidden sm:block" : ""}>
              <Link
                href={s.href}
                className={
                  "flex h-10 w-full items-center justify-center rounded-xl px-3 text-center text-sm transition " +
                  (activa
                    ? "bg-pasto font-bold text-crema"
                    : "bg-beige font-semibold text-tinta-2 hover:bg-borde")
                }
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
