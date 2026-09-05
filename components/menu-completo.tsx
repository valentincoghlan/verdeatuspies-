"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SECCIONES, rutaActiva } from "./navegacion";

/**
 * Menú completo: hoja que ocupa toda la pantalla.
 *
 * Reemplaza a los desplegables que se superponían a medias sobre el
 * contenido. Se abre desde "Más" en la barra de abajo (celular) o desde la
 * hamburguesa de arriba (escritorio), y lista todo: las secciones con sus
 * subsecciones, y abajo cerrar sesión.
 */
export default function MenuCompleto({
  nombre,
  email,
  variante,
}: {
  nombre: string;
  email: string;
  variante: "barra" | "hamburguesa";
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activa = rutaActiva(pathname);

  useEffect(() => setAbierto(false), [pathname]);

  useEffect(() => {
    if (!abierto) return;
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", escape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  const disparador =
    variante === "barra" ? (
      <button
        type="button"
        aria-label="Más"
        aria-expanded={abierto}
        onClick={() => setAbierto(true)}
        className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-tinta-2"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path
            d="M3 6h16M3 11h16M3 16h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Más
      </button>
    ) : (
      <button
        type="button"
        aria-label="Menú"
        aria-expanded={abierto}
        onClick={() => setAbierto(true)}
        className="flex h-12 w-12 items-center justify-center rounded-full text-pasto-nav transition hover:bg-pasto-medio hover:text-crema"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M2 4.5h14M2 9h14M2 13.5h14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    );

  return (
    <>
      {disparador}

      {abierto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-crema">
          {/* M5: era una portada de 360px de alto. Es un menú: el
              nombre y el mail alcanzan con un bloque de 88. */}
          <div className="flex items-center justify-between gap-4 bg-pasto-oscuro px-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-crema">{nombre}</p>
              <p className="truncate text-xs text-pasto-claro">{email}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setAbierto(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-pasto-nav transition hover:bg-pasto-medio hover:text-crema"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <div className="mx-auto w-full max-w-lg">
              <Link
                href="/"
                className={
                  "flex h-12 items-center rounded-xl px-4 text-base font-medium transition " +
                  (activa === "/" ? "bg-hecho-bg text-pasto-oscuro" : "text-tinta hover:bg-beige")
                }
              >
                Inicio
              </Link>

              {SECCIONES.map((s) => (
                <div key={s.label} className="mt-6">
                  {/* M2: 24px arriba del título y 8 abajo, contra 2px
                      entre ítems. Así el ojo arma los grupos solo. */}
                  <p className="mb-2 px-4 text-xs font-bold uppercase tracking-[.08em] text-tinta-3">
                    {s.label}
                  </p>
                  <ul className="space-y-0.5">
                    {s.items.map((i) => (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          className={
                            "flex h-12 items-center rounded-xl px-4 text-base font-medium transition " +
                            (i.href === activa
                              ? "bg-hecho-bg text-pasto-oscuro"
                              : "text-tinta hover:bg-beige")
                          }
                        >
                          {i.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <form action="/auth/signout" method="post" className="mt-6 border-t border-borde pt-3">
                <button className="flex h-12 w-full items-center rounded-xl px-4 text-left text-base font-medium text-urgente-tx transition hover:bg-urgente-bg">
                  Cerrar sesión
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
