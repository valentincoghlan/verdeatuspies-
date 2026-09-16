import Link from "next/link";
import { hoyISO, sumarDiasISO } from "@/lib/format";

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
export function resolverPeriodo(sp: { a?: string; mes?: string; s?: string }): Periodo {
  const hoy = hoyISO();
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
    };
  }

  const semanas = semanasDelMes(anio, mes);
  const s = Number(sp.s);
  if (s >= 1 && s <= semanas.length) {
    const sem = semanas[s - 1];
    return {
      desde: sem.desde,
      hasta: sem.hasta,
      etiqueta: `${sem.label} de ${MESES_CORTOS[mes - 1]}`,
      anio,
      mes,
      semana: s,
    };
  }

  return {
    desde: primerDiaDelMes(anio, mes),
    hasta: ultimoDiaDelMes(anio, mes),
    etiqueta: `${MESES[mes - 1]} ${anio}`,
    anio,
    mes,
  };
}

function Chip({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold transition sm:min-h-9 " +
        (activo ? "bg-pasto text-crema" : "bg-beige text-tinta-2 hover:bg-borde")
      }
    >
      {children}
    </Link>
  );
}

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-beige pt-3 first:border-0 first:pt-0">
      <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
        {titulo}
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
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

  const semanas = periodo.mes ? semanasDelMes(periodo.anio, periodo.mes) : [];

  return (
    <div className="card space-y-3">
      <Fila titulo="Año">
        {anios.map((a) => (
          <Chip
            key={a}
            href={link({ a, mes: periodo.mes })}
            activo={a === periodo.anio}
          >
            {a}
          </Chip>
        ))}
        <Chip href={link({ a: periodo.anio })} activo={!periodo.mes}>
          Todo el año
        </Chip>
      </Fila>

      <Fila titulo="Mes">
        {MESES.map((m, i) => (
          <Chip
            key={m}
            href={link({ a: periodo.anio, mes: i + 1 })}
            activo={periodo.mes === i + 1}
          >
            {/* En el celular entran los doce con tres letras; en la compu, enteros. */}
            <span className="sm:hidden">{MESES_CORTOS[i]}</span>
            <span className="hidden sm:inline">{m}</span>
          </Chip>
        ))}
      </Fila>

      {periodo.mes && (
        <Fila titulo="Semana">
          <Chip href={link({ a: periodo.anio, mes: periodo.mes })} activo={!periodo.semana}>
            Todo el mes
          </Chip>
          {semanas.map((s, i) => (
            <Chip
              key={s.desde}
              href={link({ a: periodo.anio, mes: periodo.mes, s: i + 1 })}
              activo={periodo.semana === i + 1}
            >
              {s.label}
            </Chip>
          ))}
        </Fila>
      )}

      {moneda && (
        <Fila titulo="Moneda">
          {(["ARS", "USD"] as const).map((m) => (
            <Link
              key={m}
              href={
                `${base}?a=${periodo.anio}` +
                (periodo.mes ? `&mes=${periodo.mes}` : "") +
                (periodo.semana ? `&s=${periodo.semana}` : "") +
                (m === "USD" ? "&m=usd" : "")
              }
              className={
                "inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-bold transition " +
                (moneda === m ? "bg-pasto text-crema" : "bg-beige text-tinta-2 hover:bg-borde")
              }
            >
              {m === "ARS" ? "Pesos" : "Dólares"}
            </Link>
          ))}
        </Fila>
      )}
    </div>
  );
}
