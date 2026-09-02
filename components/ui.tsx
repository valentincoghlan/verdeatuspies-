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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {bajada && <p className="mt-1 text-sm text-tierra-600">{bajada}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Stat({
  label,
  valor,
  detalle,
  tono = "neutro",
}: {
  label: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: "neutro" | "verde" | "ambar" | "rojo";
}) {
  const tonos = {
    neutro: "text-tierra-900",
    verde: "text-hoja-700",
    ambar: "text-amber-700",
    rojo: "text-red-700",
  } as const;

  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-tierra-600">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tonos[tono]}`}>
        {valor}
      </p>
      {detalle && <p className="mt-1 text-xs text-tierra-600">{detalle}</p>}
    </div>
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
        <div className="mb-4 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-sm font-bold uppercase tracking-wide text-tierra-600">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabla({
  cabeceras,
  children,
  vacio,
}: {
  cabeceras: string[];
  children: ReactNode;
  vacio?: string;
}) {
  const sinFilas = !children || (Array.isArray(children) && children.length === 0);

  if (sinFilas) {
    return (
      <p className="py-6 text-center text-sm text-tierra-400">
        {vacio ?? "Todavía no hay registros."}
      </p>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-tierra-200">
            {cabeceras.map((c) => (
              <th key={c} className="th">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-tierra-100">{children}</tbody>
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
    neutro: "bg-tierra-100 text-tierra-800",
    verde: "bg-hoja-100 text-hoja-800",
    ambar: "bg-amber-100 text-amber-800",
    rojo: "bg-red-100 text-red-800",
    azul: "bg-blue-100 text-blue-800",
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
