/**
 * Repartir una plata entre varios destinos.
 *
 * Sale de la cosecha: un día de trabajo abastece tres pedidos, y lo que
 * costó ese día es de los tres. La parte que le toca a cada uno va por
 * los metros: el pedido de 600 m² carga más que el de 400.
 *
 * Vive acá y no adentro del formulario porque lo usan los dos lados: la
 * pantalla para mostrar el reparto antes de guardar, y el server action
 * para guardarlo. Si cada uno hiciera su cuenta, lo que viste y lo que
 * quedó grabado podrían no ser lo mismo.
 */

export type Destino = { id: string; peso: number };

export type Parte = { id: string; monto: number };

const dosDecimales = (v: number) => Math.round(v * 100) / 100;

/**
 * Parte un monto entre los destinos, proporcional al peso de cada uno.
 *
 * El último se lleva la diferencia del redondeo. Sin eso, repartir
 * $100 entre tres daría tres veces $33,33 y se perdería un centavo:
 * poco, pero el gasto total dejaría de coincidir con la suma de las
 * partes y eso después no cierra en ningún lado.
 *
 * Si ningún destino tiene peso —pedidos sin metros cargados— se reparte
 * en partes iguales, que es lo único razonable que se puede hacer.
 */
export function repartirProporcional(total: number, destinos: Destino[]): Parte[] {
  if (destinos.length === 0) return [];
  if (destinos.length === 1) return [{ id: destinos[0].id, monto: dosDecimales(total) }];

  const suma = destinos.reduce((a, d) => a + Math.max(0, d.peso), 0);
  const parejo = suma <= 0;

  const partes: Parte[] = [];
  let repartido = 0;

  destinos.forEach((d, i) => {
    const ultimo = i === destinos.length - 1;
    const monto = ultimo
      ? dosDecimales(total - repartido)
      : dosDecimales(total * (parejo ? 1 / destinos.length : Math.max(0, d.peso) / suma));
    repartido = dosDecimales(repartido + monto);
    partes.push({ id: d.id, monto });
  });

  return partes.filter((p) => p.monto !== 0);
}

/* ═══════════════════════════════════════════════════════════════════
   Cobros: cancelar de la más vieja en adelante
   ═══════════════════════════════════════════════════════════════════ */

/** Un renglón de plata que entró: su cuenta ya la sabe quien lo creó. */
export type Pago = { id: string; monto: number };

/** Una venta con saldo. `fecha` es la de entrega, que es la que manda. */
export type Deuda = { id: string; debe: number; fecha: string };

/** Qué parte de qué pago tapa qué venta. Sin venta, entró a cuenta. */
export type Cruce = { pago: string; venta: string | null; monto: number };

/**
 * Reparte lo cobrado cancelando el máximo posible de cada venta,
 * empezando por la más vieja.
 *
 * Es lo contrario de lo que se hace con un gasto. Un gasto es de todos
 * los pedidos que abasteció esa cosecha, así que se parte proporcional.
 * Un cobro no: es plata que salda una cuenta corriente, y una cuenta
 * corriente se cancela por antigüedad. Repartir un cobro proporcional
 * deja todas las ventas pagas a medias y la deuda envejeciendo, cuando
 * lo que se quiere es lo contrario: que lo que queda debiendo sea
 * siempre lo último que se entregó.
 *
 * Los pagos se consumen en cascada y en el orden en que se cargaron: si
 * el efectivo tapa la primera venta y le sobra, lo que sobra sigue en la
 * segunda. Por eso un pago puede quedar partido entre dos ventas y una
 * venta juntar dos pagos — que es lo que pasa de verdad cuando alguien
 * te da una parte en mano y el resto por transferencia.
 *
 * Lo que sobra después de cancelar todo queda sin venta: entra igual,
 * a cuenta del cliente. No se fuerza contra la última venta porque eso
 * la dejaría con saldo a favor y el número dejaría de querer decir algo.
 *
 * Las cuentas van en centavos enteros: sumar y restar pesos con decimales
 * arrastra diferencias de un centavo que después no cierran con el total.
 */
export function cancelarDeLaMasVieja(
  pagos: Pago[],
  deudas: Deuda[],
): { cruces: Cruce[]; sobra: number } {
  const cent = (v: number) => Math.round(v * 100);

  // La antigüedad manda, y el id desempata: la pantalla y el server
  // tienen que ordenar igual o lo que se vio no es lo que se guardó.
  const orden = [...deudas].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
  );

  const restan = pagos.map((p) => ({ id: p.id, queda: Math.max(0, cent(p.monto)) }));
  const cruces: Cruce[] = [];
  let i = 0;

  for (const d of orden) {
    let falta = Math.max(0, cent(d.debe));
    while (falta > 0 && i < restan.length) {
      const p = restan[i];
      if (p.queda <= 0) {
        i++;
        continue;
      }
      const toca = Math.min(p.queda, falta);
      cruces.push({ pago: p.id, venta: d.id, monto: toca / 100 });
      p.queda -= toca;
      falta -= toca;
    }
    if (i >= restan.length) break;
  }

  let sobra = 0;
  for (const p of restan) {
    if (p.queda <= 0) continue;
    cruces.push({ pago: p.id, venta: null, monto: p.queda / 100 });
    sobra += p.queda;
    p.queda = 0;
  }

  return { cruces, sobra: sobra / 100 };
}
