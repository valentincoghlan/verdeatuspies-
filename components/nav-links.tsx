"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/mantenimiento/riego", label: "Riego" },
  { href: "/mantenimiento/cortes", label: "Cortes" },
  { href: "/mantenimiento/fertilizaciones", label: "Fertilización" },
  { href: "/mantenimiento/lluvias", label: "Lluvias" },
  { href: "/ventas", label: "Ventas" },
  { href: "/ventas/clientes", label: "Clientes" },
  { href: "/administracion", label: "Administración" },
  { href: "/config", label: "Config" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto w-full max-w-6xl overflow-x-auto px-4 pb-2">
      <ul className="flex gap-1 whitespace-nowrap">
        {LINKS.map((l) => {
          const activo = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={
                  "inline-block rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (activo
                    ? "bg-hoja-100 text-hoja-800"
                    : "text-tierra-600 hover:bg-tierra-100 hover:text-tierra-900")
                }
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
