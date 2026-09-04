"use client";

import { useState } from "react";
import { Elegir } from "@/components/elegir";
import { dolares, pesos } from "@/lib/format";

export type CuentaOpcion = { nombre: string; moneda: string };

/**
 * Cuenta y monto, juntos.
 *
 * Van de la mano: la cuenta decide en qué moneda se carga (todas son
 * pesos menos USD) y el monto se valoriza solo en la otra moneda con el
 * dólar MEP del día. Antes había que escribir la cotización a mano en un
 * campo aparte y era opcional: si te la olvidabas, el movimiento quedaba
 * sin valorizar y el negocio se mide en dólares.
 *
 * El formulario manda `cuenta`, `monto` y `moneda`; el server action se
 * encarga de guardar las dos cifras.
 */
export function CuentaYMonto({
  cuentas,
  mep,
}: {
  cuentas: CuentaOpcion[];
  mep: number | null;
}) {
  const [cuenta, setCuenta] = useState("");
  const [monto, setMonto] = useState("");

  const moneda = cuentas.find((c) => c.nombre === cuenta)?.moneda ?? "ARS";
  const enDolares = moneda === "USD";

  // Los montos se escriben con coma, como en el teclado del celular.
  const valor = Number(monto.replace(/\./g, "").replace(",", "."));
  const hayValor = monto.trim() !== "" && Number.isFinite(valor) && valor !== 0;

  const equivalente =
    !hayValor || !mep
      ? null
      : enDolares
        ? pesos(valor * mep)
        : dolares(valor / mep, 2);

  return (
    <>
      <input type="hidden" name="moneda" value={moneda} />

      <Elegir
        label="Cuenta"
        name="cuenta"
        required
        opciones={cuentas.map((c) => ({ value: c.nombre, label: c.nombre }))}
        vacio="Elegí la cuenta"
        value={cuenta}
        onChange={setCuenta}
        className="col-span-2 sm:col-span-1"
      />

      <div className="col-span-2 sm:col-span-1">
        <label className="label" htmlFor="monto">
          Monto{" "}
          <span className="font-normal text-tinta-3">
            {enDolares ? "en dólares" : "en pesos"}
          </span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-tinta-3 sm:text-sm">
            {enDolares ? "US$" : "$"}
          </span>
          <input
            id="monto"
            name="monto"
            type="text"
            inputMode="decimal"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className="input pl-10 sm:pl-9"
          />
        </div>
        <p className="mt-1 text-xs text-tinta-3">
          {equivalente
            ? `Son ${equivalente} al MEP de hoy`
            : mep
              ? `Dólar MEP ${pesos(mep)}`
              : "Falta la cotización del día"}
        </p>
      </div>
    </>
  );
}
