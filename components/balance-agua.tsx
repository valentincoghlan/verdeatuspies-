import { Chip } from "@/components/ui";
import { fechaLarga, mm, numero } from "@/lib/format";

export type DiaAgua = {
  fecha: string;
  esPronostico: boolean;
  pronosticoMm: number;
  probabilidad: number | null;
  lluviaMm: number;
  riegoMin: number;
  riegoMm: number;
  et0: number;
};

/**
 * El agua del campo, día por día.
 *
 * La tabla se lee de izquierda a derecha: primero lo que puso el cielo,
 * después lo que pusimos nosotros, y recién ahí el total contra lo que el
 * campo perdió. Las dos mitades van con fondo distinto para que se vea de
 * un vistazo de dónde vino cada milímetro.
 */
export function BalanceAgua({ dias, hoy }: { dias: DiaAgua[]; hoy: string }) {
  if (dias.length === 0) {
    return (
      <p className="rounded-xl bg-crema py-6 text-center text-sm text-tinta-2">
        Todavía no hay datos de clima. Tocá Actualizar.
      </p>
    );
  }

  const lluvia = "bg-info-bg/60";
  const riego = "bg-hecho-bg/60";

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[620px] border-collapse overflow-hidden rounded-xl">
        <thead>
          <tr>
            <th className="th" />
            <th className={`th text-center ${lluvia}`} colSpan={2}>
              Lluvia
            </th>
            <th className={`th text-center ${riego}`} colSpan={2}>
              Riego
            </th>
            <th className="th text-right" colSpan={3}>
              Balance del día
            </th>
          </tr>
          <tr>
            <th className="th">Día</th>
            <th className={`th hidden text-right sm:table-cell ${lluvia}`}>Pronóstico</th>
            <th className={`th text-right ${lluvia}`}>Cayó</th>
            <th className={`th hidden text-right sm:table-cell ${riego}`}>Minutos</th>
            <th className={`th text-right ${riego}`}>Regamos</th>
            <th className="th text-right">Total</th>
            <th className="th text-right">Perdió (ET₀)</th>
            <th className="th text-right">Queda</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-beige">
          {dias.map((d) => {
            const total = d.lluviaMm + d.riegoMm;
            const balance = total - d.et0;
            const hayDatos = total > 0 || d.et0 > 0;

            return (
              <tr key={d.fecha} className={d.fecha === hoy ? "bg-beige/60" : ""}>
                <td className="td whitespace-nowrap font-medium">
                  {fechaLarga(d.fecha)}
                  {d.esPronostico && (
                    <span className="ml-2">
                      <Chip tono="azul">pronóstico</Chip>
                    </span>
                  )}
                </td>

                {/* Lo que puso el cielo */}
                <td className={`td hidden text-right tabular-nums text-tinta-3 sm:table-cell ${lluvia}`}>
                  {d.pronosticoMm ? (
                    <>
                      {mm(d.pronosticoMm)}
                      {d.probabilidad !== null && (
                        <span className="ml-1 text-xs">{d.probabilidad}%</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`td text-right tabular-nums ${lluvia}`}>
                  {d.lluviaMm ? <span className="font-semibold">{mm(d.lluviaMm)}</span> : "—"}
                </td>

                {/* Lo que pusimos nosotros */}
                <td className={`td hidden text-right tabular-nums text-tinta-3 sm:table-cell ${riego}`}>
                  {d.riegoMin ? `${numero(d.riegoMin)} min` : "—"}
                </td>
                <td className={`td text-right tabular-nums ${riego}`}>
                  {d.riegoMm ? (
                    <span className="font-semibold">{mm(d.riegoMm)}</span>
                  ) : d.riegoMin ? (
                    <span className="text-xs text-atencion-tx">sin mm</span>
                  ) : (
                    "—"
                  )}
                </td>

                {/* La cuenta */}
                <td className="td text-right font-semibold tabular-nums">
                  {total ? mm(total) : "—"}
                </td>
                <td className="td text-right tabular-nums text-tinta-2">
                  {d.et0 ? mm(d.et0) : "—"}
                </td>
                <td
                  className={
                    "td text-right font-bold tabular-nums " +
                    (!hayDatos ? "text-tinta-3" : balance < 0 ? "text-atencion-tx" : "text-pasto")
                  }
                >
                  {hayDatos ? `${balance > 0 ? "+" : ""}${mm(balance)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
