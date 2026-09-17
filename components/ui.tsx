import Link from "next/link";
import { Children, isValidElement, type ReactNode } from "react";

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
  className,
}: {
  titulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={"card " + (className ?? "")}>
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
 * Una tarjeta que arranca cerrada.
 *
 * Para los formularios de carga: ocupan media pantalla y no se usan cada
 * vez que entrás. Cerrados, lo primero que ves es lo que ya cargaste.
 *
 * Es un <details> y no un estado de React a propósito: se abre sin
 * JavaScript y el navegador se acuerda de cuál estaba abierto al volver.
 */
export function CardPlegable({
  titulo,
  bajada,
  children,
  abierta,
  id,
}: {
  titulo: string;
  /** Una línea que explica para qué sirve, sin tener que abrirlo. */
  bajada?: string;
  children: ReactNode;
  abierta?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className="card p-0">
      <details className="group" open={abierta}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-tinta">{titulo}</span>
            {bajada && <span className="block truncate text-xs text-tinta-3">{bajada}</span>}
          </span>
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-crema text-xs text-tinta-2 transition group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="border-t border-beige p-4 sm:p-5">{children}</div>
      </details>
    </section>
  );
}

export type Columna = {
  titulo: string;
  /** Desde qué ancho se muestra. Sin esto, se ve siempre. */
  desde?: "sm";
  /** Ancho en el celular, como clase de Tailwind. */
  ancho?: string;
  align?: "left" | "right" | "center";
  /**
   * Columna de números: plata, metros, cantidades.
   *
   * Alinea el encabezado a la derecha igual que la celda, que es la única
   * forma de que se entienda qué título corresponde a qué columna cuando
   * los números van pegados al borde. La celda tiene que llevar `.td-num`.
   */
  num?: boolean;
};

/**
 * Cuántas celdas trae la primera fila. Sirve para avisar en desarrollo
 * cuando una tabla tiene más columnas de datos que encabezados, que es
 * la causa real de los headers corridos y del sombreado que corta a
 * mitad de tabla (G10). Solo mira la primera fila: alcanza, porque todas
 * salen del mismo map.
 */
function celdasDeLaPrimeraFila(children: ReactNode) {
  const filas = Children.toArray(children);
  const primera = filas[0];
  if (!isValidElement(primera)) return null;
  const celdas = Children.toArray((primera.props as any)?.children).filter((c) =>
    isValidElement(c),
  );
  return celdas.length || null;
}

/**
 * Una clave estable para el interruptor de cada tabla.
 *
 * Tiene que salir siempre igual en el servidor y en el navegador —si no,
 * React se queja de que el HTML no coincide—, así que no puede ser al
 * azar ni un contador. Sale del contenido de la tabla, que es lo único
 * que la distingue y no cambia entre una vuelta y la otra.
 */
function claveDeTabla(columnas: Columna[], extra: string) {
  const texto = columnas.map((c) => `${c.titulo}|${c.desde ?? ""}|${c.ancho ?? ""}`).join("~") + extra;
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
  return `tb${(h >>> 0).toString(36)}`;
}

/**
 * Tabla que nunca obliga a scrollear de costado. Ni en el celular ni en
 * la compu.
 *
 * Las columnas se declaran en una sola lista y no en tres arrays
 * paralelos: antes había que contar índices a mano para esconder una
 * columna o darle ancho, y ahí se colaban las columnas de datos sin
 * encabezado. `desde: "sm"` esconde la columna en pantallas chicas.
 *
 * Cuando el contenido no entra hay dos salidas y ninguna otra: sacar la
 * columna, o apilar el dato secundario debajo del principal con <Dato>.
 * Estirar la tabla no es una de ellas.
 */
export function Tabla({
  columnas,
  children,
  vacio,
  resumen,
  abierta,
}: {
  columnas: Columna[];
  children: ReactNode;
  vacio?: string;
  /** Qué dice el interruptor del celular. Por defecto, cuántas filas hay. */
  resumen?: string;
  /** Arranca desplegada también en el celular. Para tablas de dos filas. */
  abierta?: boolean;
}) {
  const sinFilas = !children || (Array.isArray(children) && children.length === 0);

  if (sinFilas) {
    return (
      <p className="rounded-xl bg-crema py-6 text-center text-sm text-tinta-2">
        {vacio ?? "Todavía no hay registros."}
      </p>
    );
  }

  if (process.env.NODE_ENV !== "production") {
    const celdas = celdasDeLaPrimeraFila(children);
    if (celdas && celdas !== columnas.length) {
      console.warn(
        `[Tabla] ${columnas.length} encabezados y ${celdas} celdas por fila ` +
          `(${columnas.map((c) => c.titulo || "«sin título»").join(" · ")}). ` +
          "Cada columna visible tiene que tener su encabezado.",
      );
    }
  }

  const alineado = (c: Columna) =>
    c.num || c.align === "right" ? "th-der" : c.align === "center" ? "th-centro" : "";

  const filas = Children.count(children);
  const clave = claveDeTabla(columnas, vacio ?? "");
  const titulo = resumen ?? `${filas} ${filas === 1 ? "fila" : "filas"}`;

  /*
   * El interruptor de plegado, con un default distinto en cada pantalla.
   *
   * En el celular la tabla arranca cerrada —tres tablas abiertas son cien
   * filas de scroll antes de llegar a lo que buscabas— y en la compu
   * arranca abierta, pero se puede cerrar para sacarla del medio.
   *
   * Un solo checkbox, sin marcar, quiere decir "nadie tocó nada": ahí la
   * tabla está cerrada en el celular y abierta en la compu. Marcado
   * quiere decir "lo tocaste", y entonces se da vuelta en las dos. Por eso
   * las clases son `peer-checked:block sm:block sm:peer-checked:hidden`.
   *
   * Va con checkbox y no con <details> porque a un <details> cerrado no se
   * le puede mostrar el contenido desde CSS: el navegador no lo dibuja.
   * Así no hace falta una gota de JavaScript.
   */
  return (
    <div className="w-full overflow-hidden">
      <input
        id={clave}
        type="checkbox"
        defaultChecked={abierta}
        className="peer sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <label
        htmlFor={clave}
        className={
          "mb-2 flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 " +
          "rounded-xl bg-crema px-3.5 text-sm font-semibold text-tinta-2 " +
          "peer-checked:[&_.flecha]:rotate-180 " +
          // En la compu es un renglón fino: la tabla ya está abierta y esto
          // es solo la manija para cerrarla.
          "sm:mb-1 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-0.5 sm:text-xs sm:text-tinta-3 " +
          "sm:[&_.flecha]:rotate-180 sm:peer-checked:[&_.flecha]:rotate-0"
        }
      >
        <span className="truncate">{titulo}</span>
        <span aria-hidden className="flecha shrink-0 text-[10px] text-tinta-3 transition">
          ▾
        </span>
      </label>

      <div className="hidden peer-checked:block sm:block sm:peer-checked:hidden">
      <table className="w-full table-fixed border-collapse overflow-hidden rounded-xl sm:table-auto">
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th
                key={`${c.titulo}-${i}`}
                className={
                  "th " +
                  (c.desde === "sm" ? "hidden sm:table-cell " : "") +
                  (c.ancho ? c.ancho + " " : "") +
                  alineado(c)
                }
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-beige">{children}</tbody>
      </table>
      </div>
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
