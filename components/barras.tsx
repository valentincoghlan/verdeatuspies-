/**
 * Barras horizontales de una sola serie. Sin librerías.
 *
 * Un solo verde por gráfico: el último dato (el mes en curso) va en el verde
 * medio para distinguirlo sin cambiar de color.
 */
export default function Barras({
  datos,
  formato,
  vacio = "Sin datos todavía.",
  destacarUltimo = true,
  compacto,
}: {
  datos: { label: string; valor: number }[];
  formato: (n: number) => string;
  vacio?: string;
  destacarUltimo?: boolean;
  /** Para los gráficos que van de a dos por fila: ocupan la mitad de alto. */
  compacto?: boolean;
}) {
  if (datos.length === 0) {
    return (
      <p className="rounded-[16px] bg-crema py-8 text-center text-[15px] text-tinta-2">{vacio}</p>
    );
  }

  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <ul className={"flex flex-col " + (compacto ? "gap-1.5" : "gap-3")}>
      {datos.map((d, i) => {
        const pct = Math.max(2, (d.valor / max) * 100);
        const enCurso = destacarUltimo && i === datos.length - 1;
        return (
          <li key={d.label}>
            <div className={"flex justify-between " + (compacto ? "mb-0.5 text-[13px]" : "mb-1.5 text-[14.5px]")}>
              <span className="font-semibold text-tinta">{d.label}</span>
              <span className="tabular-nums text-tinta-fuerte">{formato(d.valor)}</span>
            </div>
            <div className={"overflow-hidden rounded-full bg-beige " + (compacto ? "h-2" : "h-3.5")}>
              <div
                className={`h-full rounded-full ${enCurso ? "bg-pasto-medio" : "bg-pasto"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
