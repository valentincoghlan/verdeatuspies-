"use client";

import { useState } from "react";
import { Elegir } from "@/components/elegir";

export type ClienteOpcion = { nombre: string; canal: string };

/**
 * Canal y comprador, en ese orden y encadenados.
 *
 * El canal define qué es el comprador: si revende o si es el que pisa el
 * pasto. Por eso va primero y filtra la lista — eligiendo Distribuidor
 * solo aparecen los distribuidores, y no hay forma de cargar un pedido
 * con el canal cruzado.
 *
 * Lo que se escriba nuevo se da de alta con el canal que esté elegido.
 */
export function CanalYComprador({ clientes }: { clientes: ClienteOpcion[] }) {
  const [canal, setCanal] = useState("directa");
  const [comprador, setComprador] = useState("");

  const delCanal = clientes.filter((c) => c.canal === canal);

  const cambiarCanal = (v: string) => {
    setCanal(v);
    // El comprador elegido puede no pertenecer al canal nuevo.
    if (comprador && !clientes.some((c) => c.nombre === comprador && c.canal === v)) {
      setComprador("");
    }
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
        onChange={cambiarCanal}
      />

      <Elegir
        label="Comprador"
        name="cliente"
        required
        permiteNuevo
        opciones={delCanal.map((c) => ({ value: c.nombre, label: c.nombre }))}
        vacio={
          delCanal.length === 0
            ? canal === "distribuidor"
              ? "Ningún distribuidor todavía"
              : "Ningún cliente todavía"
            : "Elegí el comprador"
        }
        value={comprador}
        onChange={setComprador}
        className="col-span-2 sm:col-span-1"
      />
    </>
  );
}
