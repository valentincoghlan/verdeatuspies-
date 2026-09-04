"use client";

import { useState } from "react";

const n = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * Cuántos milímetros por hora tira una zona.
 *
 * La cuenta es directa: un litro repartido sobre un metro cuadrado es un
 * milímetro de agua, igual que la lluvia. Así que alcanza con saber
 * cuántos litros por hora larga la zona y sobre qué superficie caen.
 *
 * No escribe nada: da el número para cargar en la columna de la zona.
 */
export function CalculadoraCaudal() {
  const [porAspersor, setPorAspersor] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [superficie, setSuperficie] = useState("");

  const litrosHora = n(porAspersor) * (n(cantidad) || 1);
  const m2 = n(superficie);
  const mmHora = litrosHora && m2 ? litrosHora / m2 : 0;

  return (
    <details className="mt-4 rounded-2xl border border-borde bg-crema p-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-pasto">
        No sé el caudal, calculalo por mí
      </summary>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="cau-asp">
            Litros por hora de cada aspersor
          </label>
          <input
            id="cau-asp"
            type="number"
            inputMode="decimal"
            value={porAspersor}
            onChange={(e) => setPorAspersor(e.target.value)}
            placeholder="Ej. 600"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="cau-cant">
            Cuántos aspersores tiene la zona
          </label>
          <input
            id="cau-cant"
            type="number"
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Ej. 8"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="cau-sup">
            Metros cuadrados que moja
          </label>
          <input
            id="cau-sup"
            type="number"
            inputMode="decimal"
            value={superficie}
            onChange={(e) => setSuperficie(e.target.value)}
            placeholder="Ej. 1200"
            className="input"
          />
        </div>
      </div>

      {mmHora > 0 ? (
        <div className="mt-3 rounded-xl bg-hecho-bg p-3">
          <p className="text-sm text-pasto-oscuro">
            La zona larga{" "}
            <strong>{litrosHora.toLocaleString("es-AR")} litros por hora</strong> sobre{" "}
            {m2.toLocaleString("es-AR")} m². Eso da:
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-pasto-oscuro">
            {mmHora.toFixed(1).replace(".", ",")} mm por hora
          </p>
          <p className="mt-1 text-xs text-tinta-2">
            Cargá ese número en la columna de la zona. Es el cálculo teórico: en la cancha suele
            rendir entre un 10 y un 25% menos, porque el agua no cae perfectamente pareja. Si
            querés el número fino, medilo con la prueba de los vasos.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-tinta-3">
          Completá los tres campos. Si no sabés los litros por hora del aspersor, está en la ficha
          técnica del modelo, según la boquilla y la presión de trabajo.
        </p>
      )}
    </details>
  );
}
