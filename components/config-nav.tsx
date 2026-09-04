"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/config", label: "General" },
  { href: "/config/datos", label: "Datos" },
  { href: "/config/lotes", label: "Lotes y zonas" },
  { href: "/config/integraciones", label: "Integraciones" },
  { href: "/config/equipo", label: "Equipo" },
  { href: "/config/cuenta", label: "Mi cuenta" },
];

export default function ConfigNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4">
      <ul className="flex flex-wrap gap-1">
        {SECCIONES.map((s) => {
          const activa = pathname === s.href;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                className={
                  "inline-block rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (activa
                    ? "bg-hoja-100 text-hoja-800"
                    : "text-tierra-600 hover:bg-tierra-100 hover:text-tierra-900")
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
