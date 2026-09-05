"use client";

import { useState } from "react";
import { Elegir } from "@/components/elegir";

export type ClienteOpcion = { nombre: string; canal: string };

const ETIQUETA: Record<string, string> = {
  directa: "Cliente final",
  distribuidor: "Distribuidor",
};

/**
 * Canal y comprador.
 *
 * El buscador muestra TODOS los clientes, no solo los del canal
 * elegido. Filtrarlos era peor que inútil: escribías "Fede" con el
 * canal en Distribuidor, no aparecía nadie y la app ofrecía crear
 * "Fede" — un cliente nuevo al lado de Federico Block, que ya existía.
 *
 * Al elegir un comprador, el canal se acomoda al que tiene cargado.
 * Igual se puede cambiar a mano: una venta puntual a un distribuidor
 * puede ser directa.
 */
export function CanalYComprador({ clientes }: { clientes: ClienteOpcion[] }) {
  const [canal, setCanal] = useState("directa");
  const [comprador, setComprador] = useState("");

  const elegirComprador = (v: string) => {
    setComprador(v);
    const c = clientes.find((x) => x.nombre === v);
    if (c) setCanal(c.canal);
  };

  return (
    <>
      <Elegir
        label="Canal"
        name="canal"
        required
        opciones={[
          { value: "directa", label: "Cliente final" },
          { value: "distribuidor", label: "Distribuidor" },
        ]}
        vacio="Elegí el canal"
        value={canal}
        onChange={setCanal}
      />

      <Elegir
        label="Comprador"
        name="cliente"
        required
        permiteNuevo
        opciones={clientes.map((c) => ({
          value: c.nombre,
          label: c.nombre,
          detalle: ETIQUETA[c.canal] ?? undefined,
        }))}
        vacio={clientes.length === 0 ? "Todavía no hay clientes" : "Elegí el comprador"}
        value={comprador}
        onChange={elegirComprador}
        ayuda="Buscá antes de crear uno nuevo: si ya compró alguna vez, está en la lista."
        className="col-span-2 sm:col-span-1"
      />
    </>
  );
}
