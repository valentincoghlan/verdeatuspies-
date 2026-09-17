import { ChipFiltro, ChipsMoneda, SepChips, TiraChips } from "@/components/chips-filtro";
import { diasEntre, hoyISO, lunesDeISO, mesesAtrasISO, sumarDiasISO } from "@/lib/format";

export type Rango = {
  desde: string;
  hasta: string;
  etiqueta: string;
  /**
   * El mismo tramo, una vuelta para atrás: la semana anterior, el mes
   * anterior, la temporada anterior. Es contra lo que se compara en los
   * carteles. Va con su propia etiqueta para poder decir "vs ago" o "vs
   * la semana pasada" sin adivinarlo después.
   */
  anterior: { desde: string; hasta: string; etiqueta: string };
};

/** El mismo tramo corrido N días para atrás. Para los rangos a medida. */
function correr(desde: string, hasta: string, dias: number) {
  return { desde: sumarDiasISO(desde, -dias), hasta: sumarDiasISO(hasta, -dias) };
}

/**
 * Resuelve el rango a partir de la URL.
 *
 * Los atajos se guardan como texto (`?p=90d`) para que el link se pueda
 * compartir y para que "últimos 90 días" siga siendo relativo a hoy.
 */
export function resolverRango(sp: { p?: string; desde?: string; hasta?: string }): Rango {
  const hoy = hoyISO();

  if (sp.desde || sp.hasta) {
    const desde = sp.desde ?? "2000-01-01";
    const hasta = sp.hasta ?? hoy;
    // Un rango a medida no tiene "el anterior" natural, así que se corre
    // entero tantos días como dure.
    const largo = diasEntre(desde, hasta) + 1;
    return {
      desde,
      hasta,
      etiqueta: "a medida",
      anterior: { ...correr(desde, hasta, largo), etiqueta: "el tramo anterior" },
    };
  }

  const primeroDeEsteMes = `${hoy.slice(0, 7)}-01`;

  // Una temporada es el año calendario. La del año en curso corta en hoy:
  // no tiene sentido dividir por meses que todavía no pasaron.
  const temporada = sp.p?.match(/^t(\d{4})$/);
  if (temporada) {
    const anio = Number(temporada[1]);
    const enCurso = temporada[1] === hoy.slice(0, 4);
    return {
      desde: `${anio}-01-01`,
      hasta: enCurso ? hoy : `${anio}-12-31`,
      etiqueta: `Temporada ${anio}`,
      // La temporada se compara contra el mismo tramo del año anterior:
      // la que está en curso va hasta la misma fecha, no hasta diciembre.
      anterior: {
        desde: `${anio - 1}-01-01`,
        hasta: enCurso ? mesesAtrasISO(hoy, 12) : `${anio - 1}-12-31`,
        etiqueta: String(anio - 1),
      },
    };
  }

  switch (sp.p) {
    case "semana": {
      // De lunes a hoy: la semana que está corriendo.
      const lunes = lunesDeISO(hoy);
      return {
        desde: lunes,
        hasta: hoy,
        etiqueta: "Esta semana",
        anterior: { ...correr(lunes, hoy, 7), etiqueta: "la semana pasada" },
      };
    }
    case "semana-1": {
      const lunes = sumarDiasISO(lunesDeISO(hoy), -7);
      const domingo = sumarDiasISO(lunes, 6);
      return {
        desde: lunes,
        hasta: domingo,
        etiqueta: "Semana pasada",
        anterior: { ...correr(lunes, domingo, 7), etiqueta: "la anterior" },
      };
    }
    case "anterior": {
      // El último día del mes pasado es el día antes del primero de este.
      const finAnterior = sumarDiasISO(primeroDeEsteMes, -1);
      const primeroAnterior = `${finAnterior.slice(0, 7)}-01`;
      const finDeDosAtras = sumarDiasISO(primeroAnterior, -1);
      return {
        desde: primeroAnterior,
        hasta: finAnterior,
        etiqueta: "Mes pasado",
        anterior: {
          desde: `${finDeDosAtras.slice(0, 7)}-01`,
          hasta: finDeDosAtras,
          etiqueta: MESES_CORTOS[Number(finDeDosAtras.slice(5, 7)) - 1],
        },
      };
    }
    default:
      // El mes en curso va del 1 a hoy, así que el mes anterior se corta
      // en el mismo día: comparar quince días contra treinta no dice nada.
      return {
        desde: primeroDeEsteMes,
        hasta: hoy,
        etiqueta: "Este mes",
        anterior: {
          desde: mesesAtrasISO(primeroDeEsteMes, 1),
          hasta: mesesAtrasISO(hoy, 1),
          etiqueta: MESES_CORTOS[Number(mesesAtrasISO(hoy, 1).slice(5, 7)) - 1],
        },
      };
  }
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Desde cuándo hay datos cargados. 2023 es el año en que se armó el campo. */
const PRIMERA_TEMPORADA = 2023;

function atajos(hoy: string) {
  const esteAnio = Number(hoy.slice(0, 4));
  const temporadas: { p: string; label: string }[] = [];
  for (let a = esteAnio; a >= PRIMERA_TEMPORADA; a--) {
    // Solo el año: "Temporada 2026" ocupaba el doble para decir lo mismo.
    temporadas.push({ p: `t${a}`, label: String(a) });
  }
  // Van de lo más chico a lo más grande, que es como se mira: primero
  // cómo viene la semana, después el mes, después la temporada.
  // "Este año" no está: es la temporada del año en curso.
  return [
    { p: "semana", label: "Esta semana" },
    { p: "semana-1", label: "Semana pasada" },
    { p: "mes", label: "Este mes" },
    { p: "anterior", label: "Mes pasado" },
    ...temporadas,
  ];
}

export function FiltroFechas({
  base,
  activo,
  rango,
  moneda,
}: {
  base: string;
  activo?: string;
  rango: Rango;
  /** Si va, aparece el interruptor de pesos/dólares. */
  moneda?: "ARS" | "USD";
}) {
  const actual = activo ?? "mes";
  const ATAJOS = atajos(hoyISO());
  // El período viaja en el link para que cambiar de moneda no te devuelva
  // al mes en curso.
  const conMoneda = (m: string) => `${base}?p=${actual}${m === "USD" ? "&m=usd" : ""}`;

  return (
    <div className="card p-3 sm:p-3.5">
      {/* Un solo renglón: los atajos se corren de costado en el celular y
          la moneda queda clavada a la derecha. El rótulo "Período" salió:
          el chip prendido ya dice cuál está elegido. */}
      <TiraChips>
        {ATAJOS.map((a) => (
          <ChipFiltro
            key={a.p}
            href={`${base}?p=${a.p}${moneda === "USD" ? "&m=usd" : ""}`}
            activo={rango.etiqueta !== "a medida" && a.p === actual}
          >
            {a.label}
          </ChipFiltro>
        ))}
        {moneda && (
          <>
            <SepChips />
            <ChipsMoneda moneda={moneda} link={(m) => conMoneda(m)} />
          </>
        )}
      </TiraChips>

      {/* El rango a medida se pliega: casi siempre alcanza con los atajos. */}
      <details className="mt-1.5">
        <summary className="cursor-pointer list-none py-1 text-xs font-semibold text-pasto">
          Otro rango de fechas
        </summary>
        <form action={base} method="get" className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
          {moneda === "USD" && <input type="hidden" name="m" value="usd" />}
          <div>
            <label className="label" htmlFor="desde">
              Desde
            </label>
            <input id="desde" name="desde" type="date" defaultValue={rango.desde} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hasta">
              Hasta
            </label>
            <input id="hasta" name="hasta" type="date" defaultValue={rango.hasta} className="input" />
          </div>
          <div className="col-span-2">
            <button className="btn-ghost">Aplicar</button>
          </div>
        </form>
      </details>
    </div>
  );
}
