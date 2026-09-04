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
}: {
  datos: { label: string; valor: number }[];
  formato: (n: number) => string;
  vacio?: string;
  destacarUltimo?: boolean;
}) {
  if (datos.length === 0) {
    return (
      <p className="rounded-[16px] bg-crema py-8 text-center text-[15px] text-tinta-2">{vacio}</p>
    );
  }

  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <ul className="flex flex-col gap-3">
      {datos.map((d, i) => {
        const pct = Math.max(2, (d.valor / max) * 100);
        const enCurso = destacarUltimo && i === datos.length - 1;
        return (
          <li key={d.label}>
            <div className="mb-1.5 flex justify-between text-[14.5px]">
              <span className="font-semibold text-tinta">{d.label}</span>
              <span className="tabular-nums text-tinta-fuerte">{formato(d.valor)}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-beige">
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
