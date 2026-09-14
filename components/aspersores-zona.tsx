"use client";

import { useState } from "react";
import { numero } from "@/lib/format";
import { guardarAspersoresZona } from "@/lib/actions";

/**
 * De qué está hecha cada zona de riego.
 *
 * En vez de escribir el mm/hora a mano, se carga cuántos aspersores de
 * cada pico tiene la zona y a qué presión trabaja. El caudal sale de la
 * ficha del fabricante:
 *
 *     mm/hora = litros por hora de todos los aspersores / m² que moja
 *
 * Un litro repartido sobre un metro cuadrado es un milímetro, igual que
 * la lluvia. Cambiás un pico y el número se corrige solo.
 *
 * Va en plural —todas las zonas en un componente— para mandar la ficha
 * del fabricante una sola vez: son ciento cincuenta filas y repetirlas
 * por cada una de las veinte zonas engordaba la página al pedo.
 */

export type Boquilla = {
  modelo: string;
  numero: string;
  bar: number | string;
  litros_hora: number | string;
};

export type ZonaConAspersores = {
  id: string;
  nombre: string;
  lote: string | null;
  presion_bar: number | string | null;
  superficie_m2: number | string | null;
  aspersores: { modelo: string; numero: string; cantidad: number }[];
};

const n = (s: string) => {
  const t = s.trim().replace(/\s/g, "");
  const limpio = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(limpio);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export function AspersoresZonas({ zonas, ficha }: { zonas: ZonaConAspersores[]; ficha: Boquilla[] }) {
  // Las presiones y los picos que existen en la ficha, calculados una vez
  // para todas las zonas.
  const presiones = [...new Set(ficha.map((b) => Number(b.bar)))].sort((a, b) => a - b);

  const picos = [...new Map(ficha.map((b) => [`${b.modelo}|${b.numero}`, b])).values()].sort(
    (a, b) =>
      a.modelo === b.modelo
        ? parseFloat(a.numero) - parseFloat(b.numero)
        : a.modelo.localeCompare(b.modelo),
  );

  if (zonas.length === 0) {
    return (
      <p className="text-sm text-tinta-2">
        Todavía no hay zonas. Se crean solas cuando sincronizás con Hydrawise.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {zonas.map((z) => (
        <FichaZona key={z.id} zona={z} ficha={ficha} presiones={presiones} picos={picos} />
      ))}
    </div>
  );
}

function FichaZona({
  zona,
  ficha,
  presiones,
  picos,
}: {
  zona: ZonaConAspersores;
  ficha: Boquilla[];
  presiones: number[];
  picos: Boquilla[];
}) {
  const [presion, setPresion] = useState(String(Number(zona.presion_bar ?? 4.5)));
  const [superficie, setSuperficie] = useState(texto(zona.superficie_m2));
  const [filas, setFilas] = useState(
    zona.aspersores.length > 0
      ? zona.aspersores.map((a) => ({
          pico: `${a.modelo}|${a.numero}`,
          cantidad: String(a.cantidad),
        }))
      : [{ pico: "", cantidad: "" }],
  );

  const cambiar = (i: number, campo: "pico" | "cantidad", valor: string) =>
    setFilas((xs) => xs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  const bar = Number(presion);
  const litrosDe = (pico: string) => {
    const [modelo, num] = pico.split("|");
    const b = ficha.find((x) => x.modelo === modelo && x.numero === num && Number(x.bar) === bar);
    return b ? Number(b.litros_hora) : null;
  };

  const cargadas = filas.filter((f) => f.pico && n(f.cantidad) > 0);
  const aspersores = cargadas.reduce((a, f) => a + n(f.cantidad), 0);
  const sinFicha = cargadas.filter((f) => litrosDe(f.pico) === null);
  const litrosHora = cargadas.reduce((a, f) => a + n(f.cantidad) * (litrosDe(f.pico) ?? 0), 0);
  const m2 = n(superficie);
  const mmHora = sinFicha.length === 0 && litrosHora && m2 ? litrosHora / m2 : 0;

  return (
    <details className="rounded-2xl border border-borde bg-crema">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 p-3">
        <span className="font-semibold text-tinta">{zona.nombre}</span>
        <span className="text-xs text-tinta-3">{zona.lote ?? "sin lote"}</span>
        <span className="ml-auto text-sm tabular-nums text-pasto-oscuro">
          {mmHora > 0 ? (
            <strong>{numero(mmHora, 1)} mm/h</strong>
          ) : (
            <span className="text-tinta-3">{aspersores > 0 ? "falta la superficie" : "sin cargar"}</span>
          )}
        </span>
      </summary>

      <form action={guardarAspersoresZona} className="border-t border-borde p-3">
        <input type="hidden" name="zona_id" value={zona.id} />

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="label" htmlFor={`pres-${zona.id}`}>
              Presión (bar)
            </label>
            <select
              id={`pres-${zona.id}`}
              name="presion_bar"
              value={presion}
              onChange={(e) => setPresion(e.target.value)}
              className="input h-11 sm:h-9"
            >
              {presiones.map((p) => (
                <option key={p} value={p}>
                  {numero(p, 1)} bar
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor={`sup-${zona.id}`}>
              Superficie que moja (m²)
            </label>
            {/* Vacía no es un hueco: la base reparte la del lote entre
                las zonas según cuántos aspersores tiene cada una. */}
            <input
              id={`sup-${zona.id}`}
              name="superficie_m2"
              type="text"
              inputMode="decimal"
              value={superficie}
              onChange={(e) => setSuperficie(e.target.value)}
              placeholder="Se reparte el lote"
              className="input"
            />
          </div>
        </div>

        <p className="mt-3 text-sm text-tinta-2">
          Un renglón por tipo de pico. Si la zona tiene cuatro del 12 y dos del 11, van en dos
          renglones.
        </p>

        <div className="mt-2 space-y-2">
          {filas.map((f, i) => (
            <div key={i} className="flex gap-2">
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor={`pico-${zona.id}-${i}`}>
                  {i === 0 ? "Pico" : <span className="invisible">Pico</span>}
                </label>
                <select
                  id={`pico-${zona.id}-${i}`}
                  name={`pico_${i}`}
                  value={f.pico}
                  onChange={(e) => cambiar(i, "pico", e.target.value)}
                  className="input h-11 sm:h-9"
                >
                  <option value="">Elegí</option>
                  {[...new Set(picos.map((p) => p.modelo))].map((modelo) => (
                    <optgroup key={modelo} label={modelo}>
                      {picos
                        .filter((p) => p.modelo === modelo)
                        .map((p) => (
                          <option key={`${p.modelo}|${p.numero}`} value={`${p.modelo}|${p.numero}`}>
                            {p.numero}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="w-24 min-w-0">
                <label className="label" htmlFor={`cant-${zona.id}-${i}`}>
                  {i === 0 ? "Cuántos" : <span className="invisible">Cuántos</span>}
                </label>
                <input
                  id={`cant-${zona.id}-${i}`}
                  name={`cantidad_${i}`}
                  type="text"
                  inputMode="numeric"
                  value={f.cantidad}
                  onChange={(e) => cambiar(i, "cantidad", e.target.value)}
                  placeholder="0"
                  className="input"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setFilas((xs) => xs.filter((_, j) => j !== i))}
                  aria-label={`Sacar el renglón ${i + 1}`}
                  className="min-h-11 px-2 text-lg font-bold text-tinta-3 hover:text-urgente-tx sm:min-h-9"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFilas((xs) => [...xs, { pico: "", cantidad: "" }])}
          className="mt-2 flex min-h-11 items-center text-sm font-bold text-pasto hover:underline sm:min-h-9"
        >
          + Otro pico
        </button>

        <div className="mt-3 rounded-xl bg-hecho-bg p-3">
          {sinFicha.length > 0 ? (
            <p className="text-sm text-atencion-tx">
              El pico <strong>{sinFicha[0].pico.split("|")[1]}</strong> no tiene ficha a{" "}
              {numero(bar, 1)} bar. Mientras falte, la zona queda sin caudal calculado.
            </p>
          ) : mmHora > 0 ? (
            <>
              <p className="text-sm text-pasto-oscuro">
                {aspersores} aspersor{aspersores === 1 ? "" : "es"} largando{" "}
                <strong>{numero(litrosHora)} litros por hora</strong> sobre {numero(m2)} m². Eso da:
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-pasto-oscuro">
                {numero(mmHora, 1)} mm por hora
              </p>
            </>
          ) : (
            <p className="text-sm text-tinta-2">
              {aspersores > 0
                ? "Cargá la superficie que moja la zona y sale el caudal."
                : "Cargá los picos y la superficie y sale el caudal."}
            </p>
          )}
        </div>

        <button className="btn btn-alto mt-3">Guardar {zona.nombre}</button>
      </form>
    </details>
  );
}
