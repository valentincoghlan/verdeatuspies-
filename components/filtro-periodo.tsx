import {
  ChipFiltro,
  ChipsMoneda,
  SepChips,
  TiraChips,
} from "@/components/chips-filtro";
import { hoyISO, lunesDeISO, mesesAtrasISO, sumarDiasISO } from "@/lib/format";

/**
 * El período de un reporte, elegido de lo grande a lo chico: año, mes y
 * semana.
 *
 * Es distinto del `FiltroFechas` de Reportes, que trabaja con atajos
 * ("este mes", "temporada 2025"). Acá hace falta bajar hasta la semana y
 * que los subtotales cierren: las semanas tienen que sumar el mes y los
 * meses el año. Por eso las semanas se recortan contra los bordes del
 * mes en vez de desbordar hacia el mes de al lado.
 */

export type Periodo = {
  desde: string;
  hasta: string;
  etiqueta: string;
  anio: number;
  /** 1 a 12. Si no está, se mira el año entero. */
  mes?: number;
  /** 1 en adelante, según la lista que devuelve `semanasDelMes`. */
  semana?: number;
  /** El atajo elegido, si se entró por "esta semana" o "semana pasada". */
  atajo?: "semana" | "semana-1";
  /**
   * El mismo tramo una vuelta para atrás, contra el que se comparan los
   * carteles: la semana anterior, el mes anterior, el año anterior.
   */
  anterior: { desde: string; hasta: string; etiqueta: string };
};

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MESES_CORTOS = [
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

/** El primer año con datos cargados. Mismo criterio que el filtro de Reportes. */
const PRIMERA_TEMPORADA = 2023;

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** El lunes de la semana en la que cae esa fecha. */
function lunesDe(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  // getUTCDay() devuelve 0 para el domingo; acá la semana arranca el lunes.
  const diaDeLaSemana = (d.getUTCDay() + 6) % 7;
  return sumarDiasISO(iso, -diaDeLaSemana);
}

function primerDiaDelMes(anio: number, mes: number) {
  return `${anio}-${dosDigitos(mes)}-01`;
}

function ultimoDiaDelMes(anio: number, mes: number) {
  const siguiente = mes === 12 ? `${anio + 1}-01-01` : primerDiaDelMes(anio, mes + 1);
  return sumarDiasISO(siguiente, -1);
}

/**
 * Las semanas de un mes, de lunes a domingo, recortadas contra el mes.
 *
 * La primera y la última quedan cortas cuando el mes no arranca un lunes.
 * Es a propósito: así los totales de las semanas dan exactamente el total
 * del mes y el reporte cierra.
 */
export function semanasDelMes(anio: number, mes: number) {
  const primero = primerDiaDelMes(anio, mes);
  const ultimo = ultimoDiaDelMes(anio, mes);
  const semanas: { desde: string; hasta: string; label: string }[] = [];

  let cursor = lunesDe(primero);
  while (cursor <= ultimo) {
    const finDeSemana = sumarDiasISO(cursor, 6);
    const desde = cursor < primero ? primero : cursor;
    const hasta = finDeSemana > ultimo ? ultimo : finDeSemana;
    const d = Number(desde.slice(8, 10));
    const h = Number(hasta.slice(8, 10));
    semanas.push({ desde, hasta, label: d === h ? `${d}` : `${d} al ${h}` });
    cursor = sumarDiasISO(cursor, 7);
  }
  return semanas;
}

/**
 * Resuelve el período a partir de la URL: `?a=2026&mes=9&s=3`.
 *
 * Sin nada en la URL cae en el mes en curso, que es lo que se mira el
 * 90% de las veces.
 */
export function resolverPeriodo(sp: {
  a?: string;
  mes?: string;
  s?: string;
  p?: string;
}): Periodo {
  const hoy = hoyISO();

  // Los dos atajos de semana mandan sobre año/mes/semana: una semana
  // puede caer partida entre dos meses y no tiene sentido recortarla.
  if (sp.p === "semana" || sp.p === "semana-1") {
    const pasada = sp.p === "semana-1";
    const lunes = pasada ? sumarDiasISO(lunesDeISO(hoy), -7) : lunesDeISO(hoy);
    const hasta = pasada ? sumarDiasISO(lunes, 6) : hoy;
    return {
      desde: lunes,
      hasta,
      etiqueta: pasada ? "Semana pasada" : "Esta semana",
      anio: Number(lunes.slice(0, 4)),
      atajo: sp.p,
      anterior: {
        desde: sumarDiasISO(lunes, -7),
        hasta: sumarDiasISO(hasta, -7),
        etiqueta: pasada ? "la anterior" : "la semana pasada",
      },
    };
  }

  const anio = Number(sp.a) || Number(hoy.slice(0, 4));

  // Sin mes en la URL solo cuando se pidió el año entero a propósito: si
  // no vino ningún parámetro, el mes es el de hoy.
  const mesPedido = sp.mes === undefined && sp.a === undefined ? Number(hoy.slice(5, 7)) : Number(sp.mes);
  const mes = mesPedido >= 1 && mesPedido <= 12 ? mesPedido : undefined;

  if (!mes) {
    return {
      desde: `${anio}-01-01`,
      hasta: `${anio}-12-31`,
      etiqueta: `Año ${anio}`,
      anio,
      anterior: {
        desde: `${anio - 1}-01-01`,
        hasta: `${anio - 1}-12-31`,
        etiqueta: String(anio - 1),
      },
    };
  }

  const semanas = semanasDelMes(anio, mes);
  const s = Number(sp.s);
  if (s >= 1 && s <= semanas.length) {
    const sem = semanas[s - 1];
    // Una semana del mes se compara contra los siete días de antes,
    // aunque caigan en el mes anterior: es la semana real, no el casillero.
    return {
      desde: sem.desde,
      hasta: sem.hasta,
      etiqueta: `${sem.label} de ${MESES_CORTOS[mes - 1]}`,
      anio,
      mes,
      semana: s,
      anterior: {
        desde: sumarDiasISO(sem.desde, -7),
        hasta: sumarDiasISO(sem.hasta, -7),
        etiqueta: "los 7 días de antes",
      },
    };
  }

  const primero = primerDiaDelMes(anio, mes);
  const mesAtras = mesesAtrasISO(primero, 1);
  return {
    desde: primero,
    hasta: ultimoDiaDelMes(anio, mes),
    etiqueta: `${MESES[mes - 1]} ${anio}`,
    anio,
    mes,
    anterior: {
      desde: mesAtras,
      hasta: ultimoDiaDelMes(Number(mesAtras.slice(0, 4)), Number(mesAtras.slice(5, 7))),
      etiqueta: MESES_CORTOS[Number(mesAtras.slice(5, 7)) - 1],
    },
  };
}

export function FiltroPeriodo({
  base,
  periodo,
  moneda,
}: {
  base: string;
  periodo: Periodo;
  /** Si va, aparece el interruptor de pesos/dólares. */
  moneda?: "ARS" | "USD";
}) {
  const hoy = hoyISO();
  const esteAnio = Number(hoy.slice(0, 4));
  const anios: number[] = [];
  for (let a = esteAnio; a >= PRIMERA_TEMPORADA; a--) anios.push(a);

  const sufijoMoneda = moneda === "USD" ? "&m=usd" : "";
  const link = (p: { a: number; mes?: number; s?: number }) =>
    `${base}?a=${p.a}` +
    (p.mes ? `&mes=${p.mes}` : "") +
    (p.s ? `&s=${p.s}` : "") +
    sufijoMoneda;

  const linkAtajo = (p: string) => `${base}?p=${p}${sufijoMoneda}`;
  // Cambiar de moneda no te tiene que devolver al mes en curso.
  const linkMoneda = (m: "ARS" | "USD") =>
    (periodo.atajo ? `${base}?p=${periodo.atajo}` : `${base}?a=${periodo.anio}`) +
    (!periodo.atajo && periodo.mes ? `&mes=${periodo.mes}` : "") +
    (!periodo.atajo && periodo.semana ? `&s=${periodo.semana}` : "") +
    (m === "USD" ? "&m=usd" : "");

  // Con un atajo de semana puesto, ningún año ni mes queda elegido: la
  // semana manda y puede estar partida entre dos meses.
  const mesElegido = periodo.atajo ? undefined : periodo.mes;
  const semanas = mesElegido ? semanasDelMes(periodo.anio, mesElegido) : [];

  return (
    <div className="card space-y-1.5 p-3 sm:p-3.5">
      {/* Fila 1: los atajos, los años y la moneda. */}
      <TiraChips>
        <ChipFiltro href={linkAtajo("semana")} activo={periodo.atajo === "semana"}>
          Esta semana
        </ChipFiltro>
        <ChipFiltro href={linkAtajo("semana-1")} activo={periodo.atajo === "semana-1"}>
          Semana pasada
        </ChipFiltro>

        <SepChips />

        {anios.map((a) => (
          <ChipFiltro
            key={a}
            href={link({ a, mes: mesElegido })}
            activo={!periodo.atajo && a === periodo.anio}
          >
            {a}
          </ChipFiltro>
        ))}
        <ChipFiltro
          href={link({ a: periodo.anio })}
          activo={!periodo.atajo && !periodo.mes}
        >
          Todo el año
        </ChipFiltro>

        {moneda && (
          <>
            <SepChips />
            <ChipsMoneda moneda={moneda} link={linkMoneda} />
          </>
        )}
      </TiraChips>

      {/* Fila 2: los doce meses, siempre abreviados. Enteros no entran en
          un renglón y el filtro pasaba a ocupar media pantalla. */}
      <TiraChips>
        {MESES_CORTOS.map((m, i) => (
          <ChipFiltro
            key={m}
            href={link({ a: periodo.anio, mes: i + 1 })}
            activo={mesElegido === i + 1}
            titulo={MESES[i]}
          >
            {m}
          </ChipFiltro>
        ))}
      </TiraChips>

      {/* Fila 3: las semanas del mes elegido. Si no hay mes, no va. */}
      {mesElegido && (
        <TiraChips>
          <ChipFiltro
            href={link({ a: periodo.anio, mes: mesElegido })}
            activo={!periodo.semana}
          >
            Todo el mes
          </ChipFiltro>
          {semanas.map((s, i) => (
            <ChipFiltro
              key={s.desde}
              href={link({ a: periodo.anio, mes: mesElegido, s: i + 1 })}
              activo={periodo.semana === i + 1}
            >
              {s.label}
            </ChipFiltro>
          ))}
        </TiraChips>
      )}
    </div>
  );
}
