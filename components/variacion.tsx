import { numero } from "@/lib/format";

/**
 * Cuánto mejor o peor le fue a un número contra el mismo tramo anterior.
 *
 * Una flecha para arriba o para abajo, verde si es buena noticia y roja
 * si es mala, con la diferencia en chico al lado. Ojo con el color: en
 * lo que entra, subir está bien; en lo que sale, subir está mal. Por eso
 * la dirección de la flecha la manda el número y el color lo manda
 * `masEsMejor`, que no siempre coinciden.
 *
 * Va en el renglón de abajo de un <Stat>, así que se mantiene en una
 * sola línea corta: flecha, diferencia, porcentaje y contra qué.
 */
export function Variacion({
  actual,
  anterior,
  formato,
  contra,
  masEsMejor = true,
  sobreOscuro,
}: {
  actual: number;
  anterior: number;
  /** Cómo se escribe la diferencia: pesos, dólares, m². */
  formato: (n: number) => string;
  /** Qué período es el de comparación, para decirlo en el cartel. */
  contra: string;
  /** Si subir es buena noticia. En los egresos va en false. */
  masEsMejor?: boolean;
  /**
   * Para la tarjeta destacada, que va sobre verde oscuro. El verde y el
   * rojo de siempre son casi invisibles contra ese fondo, así que se
   * cambian por el brote y el rosa claro, que son los dos tonos de la
   * paleta pensados para ir encima del verde.
   */
  sobreOscuro?: boolean;
}) {
  // Sin nada cargado antes no hay con qué comparar, y un "+100%" contra
  // cero no dice nada: mejor decir que no hay con qué.
  const apagado = sobreOscuro ? "text-pasto-claro" : "text-tinta-3";

  if (!Number.isFinite(anterior) || anterior === 0) {
    return <span className={apagado}>Sin {contra} para comparar</span>;
  }

  const dif = actual - anterior;
  const pct = (dif / Math.abs(anterior)) * 100;

  if (Math.abs(pct) < 0.5) {
    return <span className={apagado}>Igual que {contra}</span>;
  }

  const subio = dif > 0;
  const bien = subio === masEsMejor;
  const color = sobreOscuro
    ? bien
      ? "text-brote"
      : "text-urgente-bg"
    : bien
      ? "text-pasto"
      : "text-urgente-tx";

  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <span aria-hidden className="text-[9px] leading-none">
        {subio ? "▲" : "▼"}
      </span>
      <span className="font-semibold tabular-nums">
        {formato(Math.abs(dif))}
      </span>
      <span className="tabular-nums opacity-80">
        {numero(Math.abs(pct), 0)}%
      </span>
      <span className={apagado}>vs {contra}</span>
    </span>
  );
}
