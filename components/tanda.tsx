"use client";

import { useEffect, useMemo, useState } from "react";
import { FechaDeCarga, ProveedorCarga, useCarga } from "@/components/carga";
import { PedidosDeCarga, type PedidoElegible } from "@/components/pedidos-de-carga";
import { QuePaso, type Rubro } from "@/components/que-paso";
import {
  montoDe,
  Renglon,
  Renglones,
  renglonVacio,
  renglonesValidos,
  totalDe,
} from "@/components/renglones";
import { cancelarDeLaMasVieja, repartirProporcional } from "@/lib/reparto";
import { Formulario, Guardar } from "@/components/guardar";

const pesos = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const metros = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })} m²`;

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

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
 *
 * Y el mismo formulario sirve para cobrar, con una regla distinta: un
 * gasto se parte proporcional entre las cosechas que abasteció, un cobro
 * cancela de la venta más vieja en adelante hasta donde llegue. Las dos
 * cuentas viven en lib/reparto.ts, así que lo que se ve acá es
 * exactamente lo que va a quedar guardado.
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
  const esCobro = (carga?.lado ?? "E") === "I";

  // En el orden en que se fueron marcando: el mismo que usa el servidor.
  const destinos = (carga?.elegidos ?? [])
    .map((id) => pedidos.find((p) => p.id === id))
    .filter((p): p is PedidoElegible => !!p);

  /* --- Quién paga, para que la lista de abajo sea la de él ---------- */

  const compradores = useMemo(
    () => [...new Set(pedidos.filter((p) => p.pendiente > 0.5).map((p) => p.comprador))].sort(),
    [pedidos],
  );

  // El primero que tenga nombre: un cobro es de un cliente solo.
  const quienPaga = renglones.map((r) => r.persona.trim()).find(Boolean) ?? "";
  const cliente = carga?.cliente ?? "";

  // Elegiste quién pagó -> la lista de ventas se queda con las suyas.
  // Un nombre que no le compró nada (un empleado, un proveedor) no
  // filtra nada: no sería un cobro suyo, sería un error de tipeo.
  useEffect(() => {
    if (!esCobro) return;
    const suyo = compradores.includes(quienPaga) ? quienPaga : "";
    if (suyo !== cliente) carga?.setCliente(suyo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCobro, quienPaga, cliente, compradores]);

  // Y al revés: marcaste una venta de Edin y el cobro queda a nombre de
  // Edin, sin tener que escribirlo de nuevo arriba. Los renglones que
  // se agreguen después también, porque un cobro que entra partido —una
  // parte en mano y otra al banco— sigue siendo del mismo que pagó.
  useEffect(() => {
    if (!esCobro || !cliente) return;
    setRenglones((rs) =>
      rs.every((r) => r.persona.trim())
        ? rs
        : rs.map((r) => (r.persona.trim() ? r : { ...r, persona: cliente })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCobro, cliente, renglones.length]);

  /* --- Cómo se reparte ---------------------------------------------- */

  const reparto =
    !esCobro && destinos.length
      ? repartirProporcional(
          total,
          destinos.map((d) => ({ id: d.id, peso: d.m2 })),
        )
      : [];

  // El cobro va cancelando de la más vieja: acá se ve cuánto le toca a
  // cada entrega y cuánto le sigue quedando después de esta plata.
  const cobro =
    esCobro && destinos.length
      ? cancelarDeLaMasVieja(
          listos.map((r) => ({ id: r.key, monto: montoDe(r) })),
          destinos.map((d) => ({ id: d.id, debe: d.pendiente, fecha: d.fecha })),
        )
      : null;

  const imputado = new Map<string, number>();
  for (const c of cobro?.cruces ?? []) {
    if (c.venta) imputado.set(c.venta, (imputado.get(c.venta) ?? 0) + c.monto);
  }

  // De la más vieja a la más nueva: el orden en que se van tapando.
  const enOrden = [...destinos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const m2Totales = destinos.reduce((a, d) => a + d.m2, 0);
  const cuantos = cobro
    ? cobro.cruces.length
    : listos.length * Math.max(1, destinos.length);

  return (
    <Formulario action={accion} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-4xl">
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
          personas={esCobro ? [...compradores, ...personas.filter((n) => !compradores.includes(n))] : personas}
          etiquetaPersona={esCobro ? "Quién pagó" : "A quién"}
        />
      </div>

      {/* Un cobro no se reparte: va cancelando de la más vieja. */}
      {cobro && total > 0 && (
        <div className="col-span-2 rounded-2xl border border-borde bg-white p-3 sm:col-span-3">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
            Qué cancela, de la más vieja en adelante
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {enOrden.map((d) => {
              const tapa = imputado.get(d.id) ?? 0;
              const queda = Math.max(0, Math.round((d.pendiente - tapa) * 100) / 100);
              return (
                <li key={d.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-tinta">
                    {d.comprador} · {dm(d.fecha)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-tinta-3">
                    {tapa <= 0
                      ? `no le llega · debe ${pesos(d.pendiente)}`
                      : queda === 0
                        ? "queda saldada"
                        : `le quedan ${pesos(queda)}`}
                  </span>
                  <span
                    className={
                      "w-24 shrink-0 text-right font-semibold tabular-nums " +
                      (tapa > 0 ? "text-tinta" : "text-tinta-3")
                    }
                  >
                    {pesos(tapa)}
                  </span>
                </li>
              );
            })}
          </ul>
          {cobro.sobra > 0 && (
            <p className="mt-2 text-xs text-atencion-tx">
              Sobran {pesos(cobro.sobra)} después de tapar todo lo elegido: entran igual, a cuenta
              del cliente, sin colgarse de ninguna entrega.
            </p>
          )}
        </div>
      )}

      {/* Un gasto sí: es de todas las cosechas que abasteció. */}
      {!esCobro && destinos.length > 0 && total > 0 && (
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
        <Guardar
          disabled={listos.length === 0}
          className="btn btn-alto disabled:opacity-40 sm:w-auto"
        >
          Guardar {cuantos === 1 ? "el movimiento" : `los ${cuantos} movimientos`}
        </Guardar>
        {listos.length > 0 && (
          <span className="text-sm text-tinta-2">
            {pesos(total)} en {listos.length} {listos.length === 1 ? "pago" : "pagos"}
            {destinos.length > 0 &&
              ` · ${destinos.length} ${destinos.length === 1 ? "pedido" : "pedidos"}`}
          </span>
        )}
      </div>
    </Formulario>
  );
}
