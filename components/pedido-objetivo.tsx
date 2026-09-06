"use client";

import { useState } from "react";
import { Elegir } from "@/components/elegir";

export type PedidoOpcion = { id: string; label: string; m2: number };

/**
 * El pedido a cubrir y cuántos m² hay que cortar.
 *
 * Van juntos porque uno sale del otro: si el pedido es de 30 m², el
 * objetivo es 30. Antes la app te lo preguntaba igual, teniendo el dato
 * a la vista dos renglones más arriba. Sigue editable —a veces se corta
 * de más para tener stock— pero ya viene puesto.
 */
export function PedidoYObjetivo({ pedidos }: { pedidos: PedidoOpcion[] }) {
  const [pedido, setPedido] = useState("");
  const [objetivo, setObjetivo] = useState("");

  const elegir = (v: string) => {
    setPedido(v);
    const p = pedidos.find((x) => x.id === v);
    if (p) setObjetivo(String(p.m2));
  };

  return (
    <>
      <Elegir
        label="Pedido a cubrir"
        name="venta_id"
        opcional
        vacio="Sin pedido, cosecha suelta"
        opciones={pedidos.map((p) => ({ value: p.id, label: p.label }))}
        value={pedido}
        onChange={elegir}
        className="col-span-2 sm:col-span-4"
      />

      <div className="col-span-2 min-w-0">
        <label className="label" htmlFor="objetivo_m2">
          Objetivo en m²
        </label>
        <input
          id="objetivo_m2"
          name="objetivo_m2"
          type="number"
          step="0.5"
          min="0"
          required
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="600"
          className="input"
        />
        {pedido && (
          <p className="mt-1 text-xs text-tinta-3">Tomado del pedido. Cambialo si cortás de más.</p>
        )}
      </div>
    </>
  );
}
