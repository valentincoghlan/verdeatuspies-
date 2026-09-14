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
