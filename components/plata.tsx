"use client";

import { useState } from "react";
import { Elegir } from "@/components/elegir";
import { dolares, pesos } from "@/lib/format";

export type CuentaOpcion = { nombre: string; moneda: string; id?: string };

/**
 * Cuenta y monto, juntos.
 *
 * Van de la mano: la cuenta decide en qué moneda se carga (todas son
 * pesos menos USD) y el monto se valoriza solo en la otra moneda con el
 * dólar MEP del día. La cotización a mano volvió, pero sólo en dólares y
 * con el MEP ya puesto: así no se puede olvidar —si no la tocás queda la
 * del día— y se puede cambiar cuando el dólar del negocio no es el del
 * mercado.
 *
 * Eso pasa cada vez que cobrás una venta en dólares: lo que vale ese
 * pago contra la deuda no es el MEP, es el dólar que pactaste con el
 * comprador. Con 2.000 dólares a 1.560 le estás bajando $3.120.000 de
 * deuda, y al MEP del día sería otro número.
 *
 * El formulario manda `cuenta`, `monto`, `moneda` y `cotizacion`; el
 * server action se encarga de guardar las dos cifras.
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
  const [cotizacion, setCotizacion] = useState("");

  const elegida = cuentas.find((c) => c.nombre === cuenta);
  const moneda = elegida?.moneda ?? "ARS";
  const enDolares = moneda === "USD";

  // Los montos se escriben con coma, como en el teclado del celular.
  const aNumero = (texto: string) => {
    const n = Number(texto.replace(/\./g, "").replace(",", "."));
    return texto.trim() !== "" && Number.isFinite(n) && n !== 0 ? n : null;
  };

  const valor = aNumero(monto);
  const pactada = enDolares ? aNumero(cotizacion) : null;

  // La que manda para valorizar: la escrita si hay, y si no el MEP.
  const dolar = pactada ?? mep;

  const equivalente =
    valor === null || !dolar
      ? null
      : enDolares
        ? pesos(valor * dolar)
        : dolares(valor / dolar, 2);

  return (
    <>
      <input type="hidden" name="moneda" value={moneda} />
      {/* El id además del nombre: con varias ventas elegidas el guardado
          pasa por el mismo camino que la tanda, que trabaja por id. */}
      {elegida?.id && <input type="hidden" name="cuenta_id" value={elegida.id} />}

      <Elegir
        label="Cuenta"
        name="cuenta"
        required
        opciones={cuentas.map((c) => ({ value: c.nombre, label: c.nombre }))}
        vacio="Elegí la cuenta"
        value={cuenta}
        onChange={setCuenta}
        className="col-span-1"
      />

      <div className="col-span-1">
        <label className="label" htmlFor="monto">
          Monto{" "}
          <span className="font-normal text-tinta-3">
            {enDolares ? "en dólares" : "en pesos"}
          </span>
        </label>
        <input
          id="monto"
          name="monto"
          type="text"
          inputMode="decimal"
          required
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={enDolares ? "US$ 0" : "$ 0"}
          className="input"
        />
        <p className="mt-1 text-xs text-tinta-3">
          {equivalente
            ? `Son ${equivalente}${pactada ? ` a ${pesos(pactada)}` : " al MEP de hoy"}`
            : mep
              ? `Dólar MEP ${pesos(mep)}`
              : "Falta la cotización del día"}
        </p>
      </div>

      {/* Sólo en dólares: en una cuenta en pesos el dólar del día alcanza
          y un campo más sería ruido en una pantalla que se usa parada. */}
      {enDolares && (
        <div className="col-span-1">
          <label className="label" htmlFor="cotizacion">
            Cotización{" "}
            <span className="font-normal text-tinta-3">la que pactaste</span>
          </label>
          <input
            id="cotizacion"
            name="cotizacion"
            type="text"
            inputMode="decimal"
            value={cotizacion}
            onChange={(e) => setCotizacion(e.target.value)}
            placeholder={mep ? String(Math.round(mep)) : "1560"}
            className="input"
          />
          <p className="mt-1 text-xs text-tinta-3">
            {pactada
              ? "Con esta valoriza el pago"
              : mep
                ? `Vacío = MEP de hoy, ${pesos(mep)}`
                : "Sin MEP del día: conviene escribirla"}
          </p>
        </div>
      )}
    </>
  );
}
