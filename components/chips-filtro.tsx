import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Las piezas de los dos filtros de período, en un solo lugar para que se
 * vean iguales y ocupen lo mismo.
 *
 * La regla acá es el alto: un filtro de cinco renglones empuja el reporte
 * abajo del pliegue y en el celular te obliga a scrollear antes de ver un
 * solo número. Por eso no hay rótulo al costado de cada fila —el chip
 * prendido ya dice qué está elegido— y cada grupo es una tira que en el
 * celular se corre de costado en vez de partirse en tres renglones.
 */

/** Una tira de chips: se corre de costado en el celular, se acomoda en la compu. */
export function TiraChips({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] " +
        "sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden " +
        className
      }
    >
      {children}
    </div>
  );
}

/** El pelito que separa dos grupos dentro de la misma tira. */
export function SepChips() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-borde" />;
}

/**
 * Un chip de filtro.
 *
 * En el celular mantiene el alto de dedo; en la compu baja a 32px, que es
 * donde se gana el espacio sin que deje de ser cómodo con el mouse.
 */
export function ChipFiltro({
  href,
  activo,
  children,
  titulo,
}: {
  href: string;
  activo: boolean;
  children: ReactNode;
  /** Para los chips abreviados, que el nombre entero viva en el tooltip. */
  titulo?: string;
}) {
  return (
    <Link
      href={href}
      title={titulo}
      className={
        "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 " +
        "text-[13px] font-semibold transition sm:min-h-8 " +
        (activo ? "bg-pasto text-crema" : "bg-beige text-tinta-2 hover:bg-borde")
      }
    >
      {children}
    </Link>
  );
}

/** El interruptor de pesos y dólares, que va al final de la primera tira. */
export function ChipsMoneda({
  moneda,
  link,
}: {
  moneda: "ARS" | "USD";
  /** Cómo se arma el link de cada moneda sin perder el período elegido. */
  link: (m: "ARS" | "USD") => string;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {(["ARS", "USD"] as const).map((m) => (
        <ChipFiltro
          key={m}
          href={link(m)}
          activo={moneda === m}
          titulo={m === "ARS" ? "Pesos" : "Dólares"}
        >
          {m === "ARS" ? "$" : "US$"}
        </ChipFiltro>
      ))}
    </div>
  );
}
