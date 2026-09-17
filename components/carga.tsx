"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Lo que un formulario de plata sabe de sí mismo mientras se llena.
 *
 * Hace falta porque a qué pedidos se puede colgar un movimiento depende
 * de dos campos que están en otra parte del formulario: si entra o sale,
 * y de qué día es. Un cobro puede ir contra una venta de hace ocho meses
 * —mientras deba plata, se le puede seguir cobrando—; un gasto no, un
 * gasto pertenece a la cosecha que lo generó y esa ventana se cierra.
 *
 * Los tres campos viven acá y no en props para no tener que convertir
 * toda la pantalla en un componente de cliente: el formulario sigue
 * siendo del servidor y solo los pedazos que se miran entre sí saben de
 * este contexto.
 */

type Carga = {
  /** "E" sale, "I" entra. */
  lado: string;
  setLado: (v: string) => void;
  /** La fecha del movimiento, en ISO. */
  fecha: string;
  setFecha: (v: string) => void;
  /** Los pedidos marcados, en el orden en que se marcaron. */
  elegidos: string[];
  setElegidos: (v: string[]) => void;
  /**
   * De quién es el cobro, por nombre de comprador.
   *
   * Un cobro es de una cuenta corriente sola: la plata de Edin tapa
   * ventas de Edin y de nadie más. Se llena por los dos lados —eligiendo
   * quién pagó, o marcando la primera venta— y mientras esté puesto, la
   * lista de ventas no muestra las de otro. En un gasto no se usa: la
   * mano de obra de una cosecha no tiene dueño.
   */
  cliente: string;
  setCliente: (v: string) => void;
};

const Ctx = createContext<Carga | null>(null);

export function ProveedorCarga({ hoy, children }: { hoy: string; children: ReactNode }) {
  const [lado, setLado] = useState("E");
  const [fecha, setFecha] = useState(hoy);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [cliente, setCliente] = useState("");

  const valor = useMemo(
    () => ({ lado, setLado, fecha, setFecha, elegidos, setElegidos, cliente, setCliente }),
    [lado, fecha, elegidos, cliente],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Null si el componente se usa fuera de un formulario de carga. */
export function useCarga() {
  return useContext(Ctx);
}

/**
 * La fecha del movimiento.
 *
 * Es un campo común y corriente; lo único que agrega es avisar lo que se
 * eligió, porque la lista de pedidos de un gasto se mide contra esta
 * fecha y no contra hoy. Si cargás el lunes lo que se gastó el jueves
 * pasado, la ventana es la del jueves.
 */
export function FechaDeCarga({ hoy, className = "" }: { hoy: string; className?: string }) {
  const carga = useCarga();

  return (
    <div className={"min-w-0 " + className}>
      <label className="label" htmlFor="carga-fecha">
        Fecha
      </label>
      <input
        id="carga-fecha"
        name="fecha"
        type="date"
        required
        defaultValue={hoy}
        onChange={(e) => carga?.setFecha(e.target.value)}
        className="input"
      />
    </div>
  );
}
