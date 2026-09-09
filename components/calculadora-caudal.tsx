"use client";

import { useState } from "react";

const n = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

type Boquilla = { litros: string; cantidad: string };

/**
 * Cuántos milímetros por hora tira una zona.
 *
 * La cuenta es directa: un litro repartido sobre un metro cuadrado es un
 * milímetro de agua, igual que la lluvia. Así que alcanza con saber
 * cuántos litros por hora larga la zona y sobre qué superficie caen.
 *
 * Se carga por boquilla y no por zona porque en el campo los aspersores
 * no son todos iguales: una zona puede tener cuatro de 600 l/h y tres de
 * 900. Con un solo renglón había que promediar a mano y el número salía
 * mal.
 *
 * No escribe nada: da el número para cargar en la columna de la zona.
 */
export function CalculadoraCaudal() {
  const [boquillas, setBoquillas] = useState<Boquilla[]>([
    { litros: "", cantidad: "" },
    { litros: "", cantidad: "" },
  ]);
  const [superficie, setSuperficie] = useState("");

  const cambiar = (i: number, campo: keyof Boquilla, valor: string) =>
    setBoquillas((xs) => xs.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));

  const litrosHora = boquillas.reduce((a, b) => a + n(b.litros) * (n(b.cantidad) || 0), 0);
  const aspersores = boquillas.reduce((a, b) => a + (n(b.litros) ? n(b.cantidad) : 0), 0);
  const m2 = n(superficie);
  const mmHora = litrosHora && m2 ? litrosHora / m2 : 0;
  const mezcla = boquillas.filter((b) => n(b.litros) && n(b.cantidad)).length > 1;

  return (
    <details className="mt-4 rounded-2xl border border-borde bg-crema p-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-pasto">
        No sé el caudal, calculalo por mí
      </summary>

      <p className="mt-3 text-sm text-tinta-2">
        Un renglón por tipo de boquilla. Si la zona tiene cuatro aspersores de 600 l/h y tres de
        900, van en dos renglones.
      </p>

      <div className="mt-3 space-y-2">
        {boquillas.map((b, i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="label" htmlFor={`cau-l-${i}`}>
                {i === 0 ? "Litros por hora" : <span className="invisible">Litros por hora</span>}
              </label>
              <input
                id={`cau-l-${i}`}
                type="number"
                inputMode="decimal"
                aria-label={`Litros por hora de la boquilla ${i + 1}`}
                value={b.litros}
                onChange={(e) => cambiar(i, "litros", e.target.value)}
                placeholder="Ej. 600"
                className="input"
              />
            </div>
            <div className="min-w-0">
              <label className="label" htmlFor={`cau-c-${i}`}>
                {i === 0 ? "Cuántos así" : <span className="invisible">Cuántos así</span>}
              </label>
              <input
                id={`cau-c-${i}`}
                type="number"
                inputMode="numeric"
                aria-label={`Cuántos aspersores de la boquilla ${i + 1}`}
                value={b.cantidad}
                onChange={(e) => cambiar(i, "cantidad", e.target.value)}
                placeholder="Ej. 4"
                className="input"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setBoquillas((xs) => [...xs, { litros: "", cantidad: "" }])}
        className="mt-2 flex min-h-11 items-center text-sm font-bold text-pasto hover:underline sm:min-h-9"
      >
        + Otra boquilla
      </button>

      <div className="mt-2 border-t border-borde pt-3">
        <label className="label" htmlFor="cau-sup">
          Metros cuadrados que moja la zona
        </label>
        <input
          id="cau-sup"
          type="number"
          inputMode="decimal"
          value={superficie}
          onChange={(e) => setSuperficie(e.target.value)}
          placeholder="Ej. 1200"
          className="input sm:max-w-[16rem]"
        />
        <p className="mt-1 text-xs text-tinta-3">
          Si los aspersores están en cuadro cada 12 m, cada uno cubre 144 m²: multiplicá eso por
          cuántos hay.
        </p>
      </div>

      {mmHora > 0 ? (
        <div className="mt-3 rounded-xl bg-hecho-bg p-3">
          <p className="text-sm text-pasto-oscuro">
            {aspersores} aspersor{aspersores === 1 ? "" : "es"} largando{" "}
            <strong>{litrosHora.toLocaleString("es-AR")} litros por hora</strong> sobre{" "}
            {m2.toLocaleString("es-AR")} m². Eso da:
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-pasto-oscuro">
            {mmHora.toFixed(1).replace(".", ",")} mm por hora
          </p>
          <p className="mt-1 text-xs text-tinta-2">
            Cargá ese número en la columna de la zona. Es el cálculo teórico: en la cancha suele
            rendir entre un 10 y un 25% menos, porque el agua no cae perfectamente pareja.
            {mezcla
              ? " Y con boquillas distintas en la misma zona lo es todavía menos: este número es el promedio, unos sectores reciben más y otros menos. La prueba de los vasos acá vale doble."
              : " Si querés el número fino, medilo con la prueba de los vasos."}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-tinta-3">
          Completá al menos una boquilla y los metros cuadrados. Los litros por hora de cada
          aspersor están en la ficha técnica del modelo, según la boquilla y la presión de trabajo.
        </p>
      )}
    </details>
  );
}
