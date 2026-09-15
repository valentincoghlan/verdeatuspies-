"use client";

import { Elegir } from "@/components/elegir";

/**
 * Los renglones de plata de una carga en tanda.
 *
 * Un pago casi nunca es uno solo: el día de cosecha son cinco personas,
 * y una cobra en efectivo y otra por transferencia. Un cobro tampoco: el
 * distribuidor manda una parte al banco y te deja el resto en mano.
 *
 * Cada renglón es un movimiento de verdad —su cuenta, su persona, su
 * monto—, porque es lo que hace que los saldos de cada cuenta cierren.
 * Lo que comparten (la categoría, la fecha, a qué pedidos va) se pide
 * una sola vez arriba.
 *
 * El componente solo edita la lista: quien lo usa decide qué hacer con
 * ella. Los montos se escriben con coma, como en el teclado del celular.
 */

export type Renglon = {
  /** Solo para React: no se guarda. */
  key: string;
  persona: string;
  cuenta: string;
  monto: string;
};

let proximo = 0;
export const renglonVacio = (cuenta = ""): Renglon => ({
  key: `r${proximo++}`,
  persona: "",
  cuenta,
  monto: "",
});

/** Lo que se escribió, como número. Vacío o basura vale cero. */
export const montoDe = (r: Renglon) => {
  const v = Number(String(r.monto).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

export const totalDe = (rs: Renglon[]) => rs.reduce((a, r) => a + montoDe(r), 0);

/** Los que tienen plata y cuenta: los únicos que se van a guardar. */
export const renglonesValidos = (rs: Renglon[]) => rs.filter((r) => montoDe(r) > 0 && r.cuenta);

const pesos = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function Renglones({
  renglones,
  onChange,
  cuentas,
  personas,
  etiquetaPersona = "Quién cobró",
}: {
  renglones: Renglon[];
  onChange: (rs: Renglon[]) => void;
  cuentas: { id: string; nombre: string }[];
  /** Sin esto no se pide persona: sirve para los cobros. */
  personas?: string[];
  etiquetaPersona?: string;
}) {
  const pidePersona = !!personas;

  const cambiar = (key: string, campo: keyof Renglon, valor: string) =>
    onChange(renglones.map((r) => (r.key === key ? { ...r, [campo]: valor } : r)));

  const agregar = () => {
    // La cuenta del último se repite: normalmente se paga todo de la
    // misma y cambiarla es la excepción.
    const ultima = renglones[renglones.length - 1]?.cuenta ?? cuentas[0]?.id ?? "";
    onChange([...renglones, renglonVacio(ultima)]);
  };

  const sacar = (key: string) =>
    onChange(renglones.length > 1 ? renglones.filter((r) => r.key !== key) : renglones);

  const total = totalDe(renglones);

  return (
    <div>
      <ul className="space-y-2">
        {renglones.map((r) => (
          <li key={r.key} className="rounded-2xl bg-crema p-2.5">
            <div className="grid grid-cols-2 gap-2">
              {/*
                El mismo desplegable con buscador que el resto de la app.
                Antes era un campo de texto con datalist y en el celular
                la lista la resolvía el teclado: quedaba escribir el
                nombre a mano y cualquier tipeo distinto daba de alta una
                persona nueva. "Cardozo" y "cardoso" terminaban siendo
                dos proveedores. Acá se elige de los que ya están, y dar
                de alta uno nuevo es un paso aparte y a propósito.
              */}
              {pidePersona && (
                <Elegir
                  label={etiquetaPersona}
                  name={`r_${r.key}_persona`}
                  opciones={personas!.map((n) => ({ value: n, label: n }))}
                  vacio="Elegí o agregá"
                  opcional
                  permiteNuevo
                  value={r.persona}
                  onChange={(v) => cambiar(r.key, "persona", v)}
                  className="col-span-2"
                />
              )}

              <div className="min-w-0">
                <label className="label" htmlFor={`${r.key}-monto`}>
                  Monto
                </label>
                <input
                  id={`${r.key}-monto`}
                  name={`r_${r.key}_monto`}
                  type="text"
                  inputMode="decimal"
                  value={r.monto}
                  onChange={(e) => cambiar(r.key, "monto", e.target.value)}
                  placeholder="0"
                  className="input bg-white text-right"
                />
              </div>

              <div className="min-w-0">
                <label className="label" htmlFor={`${r.key}-cuenta`}>
                  Qué cuenta
                </label>
                <select
                  id={`${r.key}-cuenta`}
                  name={`r_${r.key}_cuenta`}
                  value={r.cuenta}
                  onChange={(e) => cambiar(r.key, "cuenta", e.target.value)}
                  className="input bg-white"
                >
                  <option value="">Elegí</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {renglones.length > 1 && (
              <button
                type="button"
                onClick={() => sacar(r.key)}
                className="mt-1.5 flex min-h-9 items-center text-xs font-semibold text-tinta-3 hover:text-urgente-tx"
              >
                Sacar
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={agregar}
          className="flex min-h-11 items-center rounded-full border-[1.5px] border-borde-boton bg-white px-4 text-sm font-bold text-pasto"
        >
          + Otro renglón
        </button>
        <span className="text-sm text-tinta-2">
          Total <strong className="tabular-nums text-tinta">{pesos(total)}</strong>
        </span>
      </div>
    </div>
  );
}
