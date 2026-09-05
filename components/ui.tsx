import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  bajada,
  accion,
}: {
  titulo: string;
  bajada?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-4 sm:items-end">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold leading-tight tracking-[-.015em] text-pasto-oscuro sm:text-2xl">
          {titulo}
        </h1>
        {bajada && <p className="mt-1 hidden text-sm text-tinta-2 sm:block">{bajada}</p>}
      </div>
      {accion}
    </div>
  );
}

/**
 * Número grande.
 *
 * `destacado` lo pinta sobre verde oscuro: va uno solo por pantalla, el dato
 * del día. Si hay dos, dejan de destacarse entre sí.
 */
export function Stat({
  label,
  valor,
  detalle,
  tono = "neutro",
  destacado,
}: {
  label: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: "neutro" | "verde" | "ambar" | "rojo";
  destacado?: boolean;
}) {
  const tonos = {
    neutro: "text-pasto-oscuro",
    verde: "text-pasto",
    ambar: "text-atencion-tx",
    rojo: "text-urgente-tx",
  } as const;

  // Los montos del histórico tienen muchos más dígitos que los del día a
  // día: si no achicamos, "-$ 59.790.594" se corta contra el borde.
  const largo = typeof valor === "string" ? valor.length : 0;
  const tam =
    largo > 13
      ? "text-lg sm:text-xl"
      : largo > 10
        ? "text-xl sm:text-2xl"
        : "text-2xl sm:text-[28px]";
  const tamDestacado =
    largo > 13
      ? "text-lg sm:text-2xl"
      : largo > 10
        ? "text-xl sm:text-[28px]"
        : "text-2xl sm:text-[32px]";

  if (destacado) {
    return (
      <div className="flex flex-col rounded-2xl bg-pasto-oscuro p-3.5 sm:p-4">
        <p className="mb-1.5 min-h-[2.1em] text-[10.5px] font-bold uppercase leading-[1.05] tracking-[.08em] text-pasto-claro">
          {label}
        </p>
        <p className={`font-bold leading-none tracking-[-.02em] tabular-nums text-crema ${tamDestacado}`}>
          {valor}
        </p>
        <p className="mt-1 min-h-[1.2em] text-xs text-pasto-claro">{detalle}</p>
      </div>
    );
  }

  return (
    // El label ocupa siempre dos renglones y el detalle deja su lugar
    // aunque esté vacío: sin eso, una tarjeta con título largo empuja su
    // número y toda la fila queda despareja.
    <div className="flex flex-col rounded-2xl border border-borde bg-white p-3.5 shadow-[0_1px_2px_rgba(26,29,24,.05)] sm:p-4">
      <p className="mb-1.5 min-h-[2.1em] text-[10.5px] font-bold uppercase leading-[1.05] tracking-[.08em] text-tinta-3">
        {label}
      </p>
      <p className={`font-bold leading-none tracking-[-.02em] tabular-nums ${tam} ${tonos[tono]}`}>
        {valor}
      </p>
      <p className="mt-1 min-h-[1.2em] text-xs text-tinta-2">{detalle}</p>
    </div>
  );
}

/**
 * Tarjeta que arranca cerrada.
 *
 * Para lo que está siempre pero casi nunca se mira: historiales, listas
 * largas, formularios de carga a mano. Deja la pantalla respirando sin
 * esconder nada.
 */
export function Plegable({
  titulo,
  detalle,
  abierta,
  children,
}: {
  titulo: string;
  detalle?: string;
  abierta?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={abierta} className="card group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">{titulo}</h2>
        {detalle && <span className="text-xs text-tinta-3">{detalle}</span>}
        <span
          aria-hidden
          className="ml-auto text-xs text-tinta-3 transition group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function Card({
  titulo,
  accion,
  children,
  id,
}: {
  titulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="card">
      {(titulo || accion) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titulo && (
            <h2 className="text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
              {titulo}
            </h2>
          )}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Tabla que nunca obliga a scrollear de costado en el celular.
 *
 * `soloEnCompu` esconde columnas en pantallas chicas; las que quedan se
 * reparten el ancho disponible y el texto largo se corta en vez de
 * empujar la fila.
 */
export function Tabla({
  cabeceras,
  children,
  vacio,
  soloEnCompu = [],
  anchos,
}: {
  cabeceras: string[];
  children: ReactNode;
  vacio?: string;
  /** Índices de columnas que se esconden en el celular. */
  soloEnCompu?: number[];
  /**
   * Ancho de cada columna en el celular, como clase de Tailwind.
   * Lo que quede vacío se reparte el resto del espacio.
   */
  anchos?: (string | undefined)[];
}) {
  const sinFilas = !children || (Array.isArray(children) && children.length === 0);

  if (sinFilas) {
    return (
      <p className="rounded-xl bg-crema py-6 text-center text-sm text-tinta-2">
        {vacio ?? "Todavía no hay registros."}
      </p>
    );
  }

  return (
    // En el celular la tabla ocupa exactamente el ancho disponible y se
    // recorta a las columnas que entran. El margen negativo —que la hace
    // sangrar hasta el borde de la tarjeta— y el ancho mínimo son solo
    // de la compu, donde hay un overflow que los contiene.
    <div className="w-full overflow-hidden sm:-mx-4 sm:w-auto sm:overflow-x-auto sm:px-4">
      <table
        className={
          "w-full table-fixed border-collapse overflow-hidden rounded-xl sm:table-auto " +
          (soloEnCompu.length ? "" : "sm:min-w-[520px]")
        }
      >
        <thead>
          <tr>
            {cabeceras.map((c, i) => (
              <th
                key={c}
                className={
                  "th " +
                  (soloEnCompu.includes(i) ? "hidden sm:table-cell " : "") +
                  (anchos?.[i] ?? "")
                }
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-beige">{children}</tbody>
      </table>
    </div>
  );
}

export function Chip({
  children,
  tono = "neutro",
}: {
  children: ReactNode;
  tono?: "neutro" | "verde" | "ambar" | "rojo" | "azul";
}) {
  const tonos = {
    neutro: "bg-neutro-bg text-neutro-tx",
    verde: "bg-hecho-bg text-hecho-tx",
    ambar: "bg-atencion-bg text-atencion-tx",
    rojo: "bg-urgente-bg text-urgente-tx",
    azul: "bg-info-bg text-info-tx",
  } as const;
  return <span className={`chip ${tonos[tono]}`}>{children}</span>;
}

export function LinkBtn({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn-ghost">
      {children}
    </Link>
  );
}
