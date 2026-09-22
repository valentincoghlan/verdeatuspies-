import { numero, pesos } from "@/lib/format";

/**
 * El desarmado de un pago que abasteció a varios pedidos.
 *
 * Arriba, en la fila, se ve lo que pasó de verdad: salieron $ 300.000 de
 * Efectivo para Pedro. Acá abajo, si se toca, se ve a dónde fue esa
 * plata: una línea por pedido, con los metros que cargó y la parte que le
 * tocó.
 *
 * Es un `<details>` y no estado de React porque la pantalla es un Server
 * Component: se abre sin JavaScript y el navegador se acuerda de lo que
 * tenías abierto al volver de otra página.
 */

export type Parte = {
  id: string;
  /** El comprador del pedido, o "Sin pedido" si esa parte quedó suelta. */
  quien: string;
  /** Los metros de ese pedido: son los que definieron el reparto. */
  m2: number;
  monto: number;
};

export function PagoRepartido({ partes }: { partes: Parte[] }) {
  return (
    <details className="group/rep mt-0.5">
      <summary className="flex cursor-pointer list-none items-center gap-1 py-0.5 text-[11px] leading-tight text-tinta-2 group-open/rep:[&_.flecha]:rotate-90">
        <span aria-hidden className="flecha text-[8px] leading-none transition">
          ▶
        </span>
        repartido entre {partes.length} pedidos
      </summary>

      <ul className="mt-1 border-l border-beige pl-2">
        {partes.map((p) => (
          <li key={p.id} className="flex items-baseline gap-2 py-0.5 text-[11px] leading-tight">
            <span className="min-w-0 flex-1 truncate text-tinta-2">
              {p.quien}
              {p.m2 > 0 && <span className="text-tinta-3"> · {numero(p.m2)} m²</span>}
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-tinta-3">
              {pesos(p.monto)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
