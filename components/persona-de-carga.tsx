"use client";

import { useEffect, useState } from "react";
import { Elegir } from "@/components/elegir";
import { useCarga } from "@/components/carga";

/**
 * La persona de un movimiento, atada a la lista de ventas.
 *
 * En un gasto es un campo más: a quién se le pagó. En un cobro es el
 * dato que manda, porque un cobro es de una cuenta corriente sola. En
 * cuanto se elige quién pagó, abajo quedan solo las entregas de esa
 * persona: la plata de uno no puede tapar la entrega de otro.
 *
 * Y funciona en los dos sentidos. Si se empieza por la venta —"quiero
 * cancelar la entrega de Edin"— el nombre se completa solo, que es lo
 * mismo dicho al revés y ahorra elegir dos veces.
 *
 * Los compradores con saldo van arriba de la lista: en un cobro son los
 * únicos que tienen sentido.
 */
export function PersonaDeCarga({
  personas,
  compradores,
  className,
}: {
  personas: string[];
  /** Los que deben algo hoy. */
  compradores: string[];
  className?: string;
}) {
  const carga = useCarga();
  const esCobro = (carga?.lado ?? "E") === "I";
  const cliente = carga?.cliente ?? "";
  const [valor, setValor] = useState("");

  // Un nombre que no compró nada no filtra: sería un error de tipeo, no
  // un cobro suyo.
  useEffect(() => {
    if (!esCobro) return;
    const suyo = compradores.includes(valor) ? valor : "";
    if (suyo !== cliente) carga?.setCliente(suyo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCobro, valor, cliente, compradores]);

  useEffect(() => {
    if (!esCobro || !cliente || valor) return;
    setValor(cliente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCobro, cliente, valor]);

  const opciones = esCobro
    ? [...compradores, ...personas.filter((n) => !compradores.includes(n))]
    : personas;

  return (
    <Elegir
      label={esCobro ? "Quién pagó" : "Persona"}
      name="persona"
      opciones={opciones.map((n) => ({ value: n, label: n }))}
      vacio="Sin especificar"
      opcional
      permiteNuevo
      value={valor}
      onChange={setValor}
      className={className}
    />
  );
}
