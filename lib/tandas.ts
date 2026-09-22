/**
 * Juntar de nuevo lo que una tanda repartió.
 *
 * Cuando se paga un día de cosecha que abasteció diez pedidos, adentro
 * quedan diez movimientos: uno por pedido, con su parte proporcional a
 * los metros. Eso está bien y no se toca —es lo que hace que el costo de
 * cada cosecha cierre—, pero no es lo que pasó: salió UNA plata de UNA
 * cuenta, y recién después se repartió.
 *
 * Acá se vuelven a juntar para mostrarlas. El grupo es el pago de verdad:
 * la misma tanda, la misma cuenta y la misma persona. La cuenta y la
 * persona entran en la llave a propósito —una tanda puede tener a Pedro
 * cobrando en efectivo y a Juan por transferencia, y esos son dos pagos
 * distintos, no uno—.
 *
 * No hace cuentas de plata nuevas: la suma de las partes es el total, y
 * cada parte queda tal cual se guardó.
 */

export type FilaDeTanda = {
  id: string;
  tanda_id?: string | null;
  cuenta_id?: string | null;
  persona_id?: string | null;
};

export type Pago<T> = {
  /** La primera fila del grupo: de ahí salen fecha, categoría, cuenta y persona. */
  cabeza: T;
  /** Lo que salió de la cuenta, que es la suma de las partes. */
  total: number;
  /**
   * Una fila por pedido. Queda vacío cuando el pago no se repartió: ahí
   * `cabeza` ya es todo lo que hay para mostrar, y la fila se dibuja como
   * siempre.
   */
  partes: T[];
};

/**
 * Los pagos, en el mismo orden en que venían las filas.
 *
 * Un pago repartido aparece donde estaba su primera fila, así la lista no
 * se reordena sola al agrupar.
 */
export function agruparTandas<T extends FilaDeTanda>(
  filas: T[],
  monto: (f: T) => number,
): Pago<T>[] {
  const pagos: Pago<T>[] = [];
  const porLlave = new Map<string, Pago<T>>();

  for (const fila of filas) {
    // Sin tanda no hay nada que juntar: es una carga suelta.
    if (!fila.tanda_id) {
      pagos.push({ cabeza: fila, total: monto(fila), partes: [] });
      continue;
    }

    const llave = `${fila.tanda_id}|${fila.cuenta_id ?? ""}|${fila.persona_id ?? ""}`;
    const pago = porLlave.get(llave);

    if (!pago) {
      const nuevo: Pago<T> = { cabeza: fila, total: monto(fila), partes: [fila] };
      porLlave.set(llave, nuevo);
      pagos.push(nuevo);
      continue;
    }

    pago.total += monto(fila);
    pago.partes.push(fila);
  }

  // Un pago de una sola parte no se repartió: que se dibuje como una
  // fila normal y no como un grupo de uno.
  for (const pago of pagos) {
    if (pago.partes.length === 1) pago.partes = [];
  }

  return pagos;
}
