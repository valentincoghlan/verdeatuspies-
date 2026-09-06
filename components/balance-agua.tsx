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
  /** Cuántos riegos hubo ese día. */
  riegos: number;
  /** Lo que el controlador tiene agendado para ese día, todavía sin regar. */
  planMin: number;
  planMm: number;
  planZonas: number;
  et0: number;
};

/**
 * El agua del campo, día por día.
 *
 * La tabla se lee de izquierda a derecha: primero lo que puso el cielo,
 * después lo que pusimos nosotros, y recién ahí el total contra lo que el
 * campo perdió. Las dos mitades van con fondo distinto para que se vea de
 * un vistazo de dónde vino cada milímetro.
 *
 * Los días que todavía no pasaron muestran lo previsto en gris: el
 * pronóstico de lluvia y el riego que el controlador tiene agendado. Así
 * el balance de mañana se lee hoy, que es cuando sirve para decidir.
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
      <table className="w-full border-collapse overflow-hidden rounded-xl sm:min-w-[620px]">
        <thead>
          <tr className="hidden sm:table-row">
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
            <th className="th hidden text-right sm:table-cell">Total</th>
            <th className="th hidden text-right sm:table-cell">Perdió (ET₀)</th>
            <th className="th hidden text-right sm:table-cell">Queda</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-beige">
          {dias.map((d) => {
            // En los días que ya pasaron manda lo que ocurrió; en los que
            // vienen, lo previsto.
            const lluviaCuenta = d.lluviaMm || (d.esPronostico ? d.pronosticoMm : 0);
            const riegoCuenta = d.riegoMm || d.planMm;
            const total = lluviaCuenta + riegoCuenta;
            const balance = total - d.et0;
            const previsto = !d.lluviaMm && !d.riegoMm && (d.pronosticoMm > 0 || d.planMin > 0);
            const hayDatos = total > 0 || d.et0 > 0;

            return (
              <tr key={d.fecha} className={d.fecha === hoy ? "bg-beige/60" : ""}>
                <td className="td whitespace-nowrap font-medium">
                  <span className="hidden sm:inline">{fechaLarga(d.fecha)}</span>
                  <span className="sm:hidden">{d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}</span>
                  {d.esPronostico && (
                    <span className="ml-1.5">
                      <Chip tono="azul">
                        <span className="sm:hidden">pr</span>
                        <span className="hidden sm:inline">pronóstico</span>
                      </Chip>
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
                  {d.riegoMin ? (
                    `${numero(d.riegoMin)} min`
                  ) : d.planMin ? (
                    <span title={`${d.planZonas} zonas agendadas`}>{numero(d.planMin)} min</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`td text-right tabular-nums ${riego}`}>
                  {d.riegos > 0 || d.planZonas > 0 ? (
                    <>
                      <span className="block text-[11px] text-tinta-3">
                        {d.riegos || d.planZonas} riego{(d.riegos || d.planZonas) === 1 ? "" : "s"}
                      </span>
                      {d.riegoMm || d.planMm ? (
                        <span
                          className={
                            "block " + (d.riegoMm ? "font-semibold text-tinta" : "text-tinta-3")
                          }
                        >
                          {mm(d.riegoMm || d.planMm)}
                        </span>
                      ) : (
                        <span
                          className="block text-[11px] text-atencion-tx"
                          title="Falta cargar el caudal de la zona para saber cuántos mm dio"
                        >
                          falta caudal
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>

                {/* La cuenta */}
                <td
                  className={
                    "td hidden text-right tabular-nums sm:table-cell " +
                    (previsto ? "text-tinta-3" : "font-semibold")
                  }
                >
                  {total ? mm(total) : "—"}
                </td>
                <td className="td hidden text-right tabular-nums text-tinta-2 sm:table-cell">
                  {d.et0 ? mm(d.et0) : "—"}
                </td>
                <td
                  className={
                    "td hidden text-right tabular-nums sm:table-cell " +
                    (!hayDatos
                      ? "text-tinta-3"
                      : previsto
                        ? balance < 0
                          ? "font-semibold text-atencion-tx/70"
                          : "font-semibold text-pasto/70"
                        : balance < 0
                          ? "font-bold text-atencion-tx"
                          : "font-bold text-pasto")
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
