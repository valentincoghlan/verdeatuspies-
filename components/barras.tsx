/**
 * Barras horizontales de una sola serie (un solo tono, magnitud).
 * Sin librerías: los valores se leen en el eje derecho y en el tooltip.
 */
export default function Barras({
  datos,
  formato,
  vacio = "Sin datos todavía.",
}: {
  datos: { label: string; valor: number }[];
  formato: (n: number) => string;
  vacio?: string;
}) {
  if (datos.length === 0) {
    return <p className="py-6 text-center text-sm text-tierra-400">{vacio}</p>;
  }

  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <ul className="space-y-2">
      {datos.map((d) => {
        const pct = Math.max(2, (d.valor / max) * 100);
        return (
          <li key={d.label} className="flex items-center gap-3" title={`${d.label}: ${formato(d.valor)}`}>
            <span className="w-16 shrink-0 text-xs font-medium text-tierra-600">{d.label}</span>
            <span className="h-4 min-w-0 flex-1 rounded-full bg-tierra-100">
              <span
                className="block h-4 rounded-full bg-hoja-500"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-tierra-800">
              {formato(d.valor)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
