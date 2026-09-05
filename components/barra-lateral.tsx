"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SECCIONES, rutaActiva } from "./navegacion";

/**
 * Menú de escritorio, pegado a la izquierda.
 *
 * Las secciones vienen plegadas y se abre una por vez: con cinco áreas y
 * quince pantallas, la lista entera era demasiado larga para recorrerla.
 * La sección donde estás parado se abre sola.
 *
 * En el celular no se muestra: ahí la navegación va por la barra de abajo.
 */
export default function BarraLateral({
  nombre,
  email,
  pendientes,
}: {
  nombre: string;
  email: string;
  pendientes: number;
}) {
  const pathname = usePathname();
  const activa = rutaActiva(pathname);
  const seccionActiva = SECCIONES.find((s) => s.items.some((i) => i.href === activa))?.label ?? null;

  const [abierta, setAbierta] = useState<string | null>(seccionActiva);

  // Al navegar a otra área, se abre la que corresponde y se cierra el resto.
  useEffect(() => setAbierta(seccionActiva), [seccionActiva]);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-pasto-oscuro px-3 py-5 sm:flex">
      <Link href="/" className="mb-1 flex items-center gap-2.5 px-2">
        <Image
          src="/logo-boton.png"
          alt=""
          width={256}
          height={256}
          className="size-9 shrink-0 rounded-full object-cover"
        />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold leading-tight text-crema">
            Hola {nombre},
          </span>
          <span className="block truncate text-xs text-pasto-claro">{email}</span>
        </span>
      </Link>

      {pendientes > 0 && (
        <Link
          href="/#alertas"
          className="mx-2 mt-3 inline-flex items-center justify-center rounded-full bg-atencion-bg px-3 py-1.5 text-[13px] font-bold text-atencion-tx"
        >
          {pendientes} pendiente{pendientes === 1 ? "" : "s"}
        </Link>
      )}

      <nav className="mt-5 flex-1 space-y-1">
        <Link
          href="/"
          className={
            "flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition " +
            (activa === "/"
              ? "bg-crema text-pasto-oscuro"
              : "text-pasto-nav hover:bg-pasto-medio hover:text-crema")
          }
        >
          Inicio
        </Link>

        {SECCIONES.map((s) => {
          const estaAbierta = abierta === s.label;
          const tieneLaActiva = s.label === seccionActiva;

          return (
            <div key={s.label}>
              <button
                type="button"
                aria-expanded={estaAbierta}
                onClick={() => setAbierta(estaAbierta ? null : s.label)}
                className={
                  "flex min-h-11 w-full select-none items-center justify-between gap-2 rounded-full px-4 text-sm font-semibold transition " +
                  (tieneLaActiva && !estaAbierta
                    ? "bg-pasto-medio text-crema"
                    : "text-pasto-nav hover:bg-pasto-medio hover:text-crema")
                }
              >
                {s.label}
                <span
                  aria-hidden
                  className={"text-[10px] transition " + (estaAbierta ? "rotate-180" : "")}
                >
                  ▾
                </span>
              </button>

              {estaAbierta && (
                <ul className="mt-1 space-y-1 pl-3">
                  {s.items.map((i) => (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        className={
                          "flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition " +
                          (i.href === activa
                            ? "bg-crema text-pasto-oscuro"
                            : "text-pasto-nav hover:bg-pasto-medio hover:text-crema")
                        }
                      >
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <form action="/auth/signout" method="post" className="mt-5">
        <button className="flex min-h-11 w-full items-center rounded-full px-4 text-left text-sm font-semibold text-pasto-nav transition hover:bg-pasto-medio hover:text-crema">
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
