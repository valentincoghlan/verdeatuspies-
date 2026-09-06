/**
 * Barras de una sola serie. Sin librerías.
 *
 * Un solo verde por gráfico: el último dato (el mes en curso) va en el verde
 * medio para distinguirlo sin cambiar de color.
 *
 * Con `vertical` el gráfico se para en la compu, que es donde hay ancho para
 * que doce meses entren uno al lado del otro y se lea la curva del año. En el
 * celular sigue acostado: doce columnas de 25px no las lee nadie.
 */
export default function Barras({
  datos,
  formato,
  vacio = "Sin datos todavía.",
  destacarUltimo = true,
  compacto,
  vertical,
}: {
  datos: { label: string; valor: number }[];
  formato: (n: number) => string;
  vacio?: string;
  destacarUltimo?: boolean;
  /** Para los gráficos que van de a dos por fila: ocupan la mitad de alto. */
  compacto?: boolean;
  /** Columnas paradas en la compu. En el celular no cambia nada. */
  vertical?: boolean;
}) {
  if (datos.length === 0) {
    return (
      <p className="rounded-[16px] bg-crema py-8 text-center text-[15px] text-tinta-2">{vacio}</p>
    );
  }

  const max = Math.max(...datos.map((d) => d.valor), 1);
  const tono = (i: number) =>
    destacarUltimo && i === datos.length - 1 ? "bg-pasto-medio" : "bg-pasto";

  return (
    <>
      <ul
        className={
          "flex flex-col " +
          (compacto ? "gap-1.5 " : "gap-3 ") +
          (vertical ? "sm:hidden" : "")
        }
      >
        {datos.map((d, i) => {
          const pct = Math.max(2, (d.valor / max) * 100);
          return (
            <li key={d.label}>
              <div
                className={
                  "flex justify-between " +
                  (compacto ? "mb-0.5 text-[13px]" : "mb-1.5 text-[14.5px]")
                }
              >
                <span className="font-semibold text-tinta">{d.label}</span>
                <span className="tabular-nums text-tinta-fuerte">{formato(d.valor)}</span>
              </div>
              <div
                className={"overflow-hidden rounded-full bg-beige " + (compacto ? "h-2" : "h-3.5")}
              >
                <div className={`h-full rounded-full ${tono(i)}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      {vertical && (
        <ul className="hidden h-64 items-stretch gap-1.5 sm:flex">
          {datos.map((d, i) => {
            const pct = Math.max(2, (d.valor / max) * 100);
            return (
              <li key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="whitespace-nowrap text-[11.5px] tabular-nums text-tinta-fuerte">
                  {formato(d.valor)}
                </span>
                {/* La barra crece dentro de lo que sobra: así los números de
                    arriba y los meses de abajo quedan siempre alineados. */}
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-lg ${tono(i)}`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="w-full truncate text-center text-[11.5px] font-semibold text-tinta">
                  {d.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
