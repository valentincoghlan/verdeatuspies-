"use client";

import { useState } from "react";
import { FechaDeCarga, ProveedorCarga, useCarga } from "@/components/carga";
import { PedidosDeCarga, type PedidoElegible } from "@/components/pedidos-de-carga";
import { QuePaso, type Rubro } from "@/components/que-paso";
import { Renglon, Renglones, renglonVacio, renglonesValidos, totalDe } from "@/components/renglones";
import { repartirProporcional } from "@/lib/reparto";

const pesos = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const metros = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} m²`;

/**
 * Cargar varios pagos de una, y repartirlos entre varios pedidos.
 *
 * Es la pantalla del día de cosecha. Arriba va lo que comparten: la
 * categoría, la fecha, y a qué pedidos les corresponde. Abajo, un
 * renglón por persona con su cuenta y su monto.
 *
 * El reparto entre pedidos se muestra antes de guardar, con los números
 * finales. No es un detalle de cortesía: si el gasto se parte solo y no
 * se ve cómo, el margen de cada venta pasa a ser un número que apareció
 * de la nada.
 */
export function Tanda(props: Parametros) {
  // El proveedor va afuera porque el formulario lo consume: qué pedidos
  // se ofrecen depende de la categoría y la fecha que se elijan adentro.
  return (
    <ProveedorCarga hoy={props.hoy}>
      <FormularioDeTanda {...props} />
    </ProveedorCarga>
  );
}

type Parametros = {
  rubros: Rubro[];
  admin: boolean;
  cuentas: { id: string; nombre: string }[];
  personas: string[];
  lotes: { value: string; label: string }[];
  pedidos: PedidoElegible[];
  hoy: string;
  accion: (fd: FormData) => Promise<void>;
};

function FormularioDeTanda({
  rubros,
  admin,
  cuentas,
  personas,
  lotes,
  pedidos,
  hoy,
  accion,
}: Parametros) {
  const carga = useCarga();
  const [renglones, setRenglones] = useState<Renglon[]>(() => [
    renglonVacio(cuentas[0]?.id ?? ""),
  ]);

  const total = totalDe(renglones);
  const listos = renglonesValidos(renglones);

  // En el orden en que se fueron marcando: el mismo que usa el servidor.
  const destinos = (carga?.elegidos ?? [])
    .map((id) => pedidos.find((p) => p.id === id))
    .filter((p): p is PedidoElegible => !!p);

  const reparto = destinos.length
    ? repartirProporcional(
        total,
        destinos.map((d) => ({ id: d.id, peso: d.m2 })),
      )
    : [];

  const m2Totales = destinos.reduce((a, d) => a + d.m2, 0);
  const cuantos = listos.length * Math.max(1, destinos.length);

  return (
    <form action={accion} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-4xl">
      <QuePaso rubros={rubros} admin={admin} />

      <FechaDeCarga hoy={hoy} className="col-span-1" />

      <div className="col-span-1 min-w-0">
        <label className="label" htmlFor="tanda-lote">
          Lote
        </label>
        <select id="tanda-lote" name="lote_id" className="input">
          <option value="">General</option>
          {lotes.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 min-w-0 sm:col-span-1">
        <label className="label" htmlFor="tanda-detalle">
          Detalle
        </label>
        <input id="tanda-detalle" name="detalle" placeholder="Por qué se pagó" className="input" />
      </div>

      <PedidosDeCarga
        pedidos={pedidos}
        hoy={hoy}
        multiple
        className="col-span-2 sm:col-span-3"
      />

      <div className="col-span-2 sm:col-span-3">
        <span className="label">Los pagos</span>
        <Renglones
          renglones={renglones}
          onChange={setRenglones}
          cuentas={cuentas}
          personas={personas}
          etiquetaPersona="A quién"
        />
      </div>

      {/* Cómo queda repartido, con los números finales. */}
      {destinos.length > 0 && total > 0 && (
        <div className="col-span-2 rounded-2xl border border-borde bg-white p-3 sm:col-span-3">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
            Cómo se reparte
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {destinos.map((d) => {
              const parte = reparto.find((p) => p.id === d.id)?.monto ?? 0;
              const pct = m2Totales > 0 ? (d.m2 / m2Totales) * 100 : 100 / destinos.length;
              return (
                <li key={d.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-tinta">{d.comprador}</span>
                  <span className="shrink-0 text-xs tabular-nums text-tinta-3">
                    {metros(d.m2)} · {Math.round(pct)}%
                  </span>
                  <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-tinta">
                    {pesos(parte)}
                  </span>
                </li>
              );
            })}
          </ul>
          {m2Totales === 0 && (
            <p className="mt-2 text-xs text-atencion-tx">
              Ninguno de esos pedidos tiene metros cargados, así que se reparte en partes iguales.
            </p>
          )}
        </div>
      )}

      <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3">
        <button disabled={listos.length === 0} className="btn btn-alto disabled:opacity-40 sm:w-auto">
          Guardar {cuantos === 1 ? "el movimiento" : `los ${cuantos} movimientos`}
        </button>
        {listos.length > 0 && (
          <span className="text-sm text-tinta-2">
            {pesos(total)} en {listos.length} {listos.length === 1 ? "pago" : "pagos"}
            {destinos.length > 0 &&
              ` · ${destinos.length} ${destinos.length === 1 ? "pedido" : "pedidos"}`}
          </span>
        )}
      </div>
    </form>
  );
}
