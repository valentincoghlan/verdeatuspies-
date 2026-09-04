"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ATAJOS, rutaActiva } from "./navegacion";

/** Íconos simples, del mismo trazo. Sin librerías. */
const ICONOS: Record<string, ReactNode> = {
  "/": (
    <path
      d="M3 9.5L11 3l8 6.5V19a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1V9.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  ),
  "/ventas/pedidos": (
    <>
      <path
        d="M4 6h14l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 6V4.5a3 3 0 0 1 6 0V6" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  "/mantenimiento/riego": (
    <path
      d="M11 3s5.5 6 5.5 9.5a5.5 5.5 0 1 1-11 0C5.5 9 11 3 11 3Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  ),
  "/mantenimiento/cosecha": (
    <>
      <rect x="3" y="7" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 7V4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
};

export default function BarraInferior({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activa = rutaActiva(pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex items-stretch">
        {ATAJOS.map((a) => {
          const esta = a.href === activa;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition " +
                (esta ? "text-pasto" : "text-tinta-2")
              }
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
                {ICONOS[a.href]}
              </svg>
              {a.label}
            </Link>
          );
        })}
        {children}
      </div>
    </nav>
  );
}
