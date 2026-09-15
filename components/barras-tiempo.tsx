"use client";

import { useState } from "react";
import Barras from "@/components/barras";
import { m2, pesos } from "@/lib/format";

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

type Punto = { mes: string; valor: number };
type Agrupacion = "mes" | "trimestre" | "anio";

const VISTAS: { v: Agrupacion; label: string }[] = [
  { v: "mes", label: "Mes" },
  { v: "trimestre", label: "Trimestre" },
  { v: "anio", label: "Año" },
];

/**
 * El gráfico de una serie de tiempo, con el zoom en la mano del que mira.
 *
 * Doce meses sueltos sirven para ver el mes que viene; agrupados por
 * trimestre se ve la temporada, que es lo que manda en el pasto. Se agrupa
 * en el navegador: los datos ya están todos, no hace falta volver a pedirlos.
 */
export function BarrasTiempo({
  datos,
  formato = "m2",
}: {
  /** Cada punto con su mes en ISO corto (`yyyy-mm`), del más viejo al más nuevo. */
  datos: Punto[];
  formato?: "m2" | "pesos";
}) {
  const [agrupacion, setAgrupacion] = useState<Agrupacion>("mes");

  const fmt = formato === "pesos" ? (n: number) => pesos(n) : (n: number) => m2(n);

  const etiqueta = (mes: string) => {
    const anio = mes.slice(2, 4);
    const n = Number(mes.slice(5, 7));
    if (agrupacion === "anio") return mes.slice(0, 4);
    if (agrupacion === "trimestre") return `T${Math.ceil(n / 3)} ${anio}`;
    return `${MESES[n - 1]} ${anio}`;
  };

  const agrupados: { label: string; valor: number }[] = [];
  for (const d of datos) {
    const label = etiqueta(d.mes);
    const ya = agrupados.find((x) => x.label === label);
    if (ya) ya.valor += d.valor;
    else agrupados.push({ label, valor: d.valor });
  }

  /*
   * Cuántas barras entran, según el zoom.
   *
   * El recorte va DESPUÉS de agrupar y no antes. Cuando se recortaba la
   * serie en el origen —los últimos doce meses— la vista por año quedaba
   * mentirosa: al año más viejo le faltaban los meses que se habían caído
   * por el camino, y 2024 mostraba 6.872 m² cuando habían sido 9.433.
   * Un año a medias no se ve a medias: se ve como un año malo.
   */
  const CUANTAS: Record<Agrupacion, number> = { mes: 12, trimestre: 8, anio: 6 };
  const visibles = agrupados.slice(-CUANTAS[agrupacion]);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {VISTAS.map((x) => (
          <button
            key={x.v}
            type="button"
            onClick={() => setAgrupacion(x.v)}
            className={
              "inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold transition " +
              (agrupacion === x.v
                ? "bg-pasto text-crema"
                : "bg-beige text-tinta-2 hover:bg-borde")
            }
          >
            {x.label}
          </button>
        ))}
      </div>

      <Barras datos={visibles} formato={fmt} vertical />
    </>
  );
}
