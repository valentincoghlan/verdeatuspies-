"use client";

import { useState } from "react";
import { Elegir } from "@/components/elegir";

export type SubRubro = { nombre: string; tipo: string };
export type Rubro = { nombre: string; tipo: string; hijos: SubRubro[] };

/** Sirve para este lado del movimiento (o para los dos). */
const sirve = (t: string, lado: string) => t === "ambos" || t === lado;

/**
 * Qué pasó: si entra o sale, y en qué categoría cae.
 *
 * Los tres campos van juntos porque se condicionan entre sí. "Cosecha ·
 * Combustible" nunca es una entrada de plata, así que al marcar Entra el
 * desplegable ni siquiera la ofrece. La regla de cada categoría se
 * administra en Ajustes -> Datos.
 *
 * Con el "+" del pie se agrega una categoría nueva sin salir del
 * formulario: se guarda junto con el movimiento, ya marcada para el lado
 * que estabas cargando.
 */
export function QuePaso({ rubros }: { rubros: Rubro[] }) {
  const [lado, setLado] = useState("E");
  const [rubro, setRubro] = useState("");
  const [sub, setSub] = useState("");
  // Lo que se agrega con el "+" todavía no existe en la base.
  const [nuevos, setNuevos] = useState<string[]>([]);

  const esNuevo = (n: string) => nuevos.includes(n);

  const rubrosDelLado = rubros.filter((r) => sirve(r.tipo, lado));
  const elegido = rubros.find((r) => r.nombre === rubro);
  const hijos = (elegido?.hijos ?? []).filter((h) => sirve(h.tipo, lado));

  const opcionesRubro = [
    ...rubrosDelLado.map((r) => ({ value: r.nombre, label: r.nombre })),
    ...nuevos
      .filter((n) => !n.includes(" · ") && !rubros.some((r) => r.nombre === n))
      .map((n) => ({ value: n, label: n, detalle: "nueva" })),
  ];

  const opcionesSub = [
    ...hijos.map((h) => ({ value: h.nombre, label: h.nombre })),
    ...nuevos
      .filter((n) => n.startsWith(`${rubro} · `))
      .map((n) => ({ value: n.split(" · ")[1], label: n.split(" · ")[1], detalle: "nueva" })),
  ];

  // Si cambiás de lado, lo elegido puede dejar de valer.
  const cambiarLado = (l: string) => {
    setLado(l);
    const r = rubros.find((x) => x.nombre === rubro);
    if (r && !sirve(r.tipo, l)) {
      setRubro("");
      setSub("");
    } else if (r && !r.hijos.some((h) => h.nombre === sub && sirve(h.tipo, l))) {
      setSub("");
    }
  };

  const rubroNuevo = rubro !== "" && !rubros.some((r) => r.nombre === rubro);
  const subNuevo = sub !== "" && !(elegido?.hijos ?? []).some((h) => h.nombre === sub);
  const completa = sub ? `${rubro} · ${sub}` : rubro;

  return (
    <>
      <input type="hidden" name="categoria" value={completa} />
      {(rubroNuevo || subNuevo) && <input type="hidden" name="categoria_crear" value="1" />}

      <div className="col-span-2 sm:col-span-1">
        {/* Sin rótulo: "Sale" y "Entra" ya se explican solos. */}
        <span className="label invisible" aria-hidden>
          Entra o sale
        </span>
        <div role="group" aria-label="Entra o sale" className="grid grid-cols-2 gap-2">
          {[
            { value: "E", label: "Sale" },
            { value: "I", label: "Entra" },
          ].map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value={o.value}
                checked={lado === o.value}
                onChange={() => cambiarLado(o.value)}
                className="peer sr-only"
              />
              <span className="flex min-h-[52px] items-center justify-center rounded-[16px] border-[1.5px] border-borde bg-crema px-4 text-base font-semibold text-tinta-2 transition peer-checked:border-pasto peer-checked:bg-hecho-bg peer-checked:text-pasto-oscuro peer-focus-visible:ring-4 peer-focus-visible:ring-pasto/15 sm:min-h-9 sm:rounded-xl sm:px-3 sm:text-sm">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Elegir
        label="Categoría"
        name="rubro"
        required
        permiteNuevo
        opciones={opcionesRubro}
        vacio="Elegí la categoría"
        value={rubro}
        onChange={(v) => {
          if (v && !rubros.some((r) => r.nombre === v) && !esNuevo(v)) {
            setNuevos((n) => [...n, v]);
          }
          setRubro(v);
          setSub("");
        }}
        className="col-span-2 sm:col-span-1"
      />

      <Elegir
        label="Subcategoría"
        name="subrubro"
        required={opcionesSub.length > 0}
        deshabilitado={!rubro}
        permiteNuevo={Boolean(rubro)}
        opciones={opcionesSub}
        vacio={
          !rubro
            ? "Elegí antes la categoría"
            : opcionesSub.length === 0
              ? "Agregá la primera"
              : "Elegí la subcategoría"
        }
        value={sub}
        onChange={(v) => {
          const completo = `${rubro} · ${v}`;
          if (v && !(elegido?.hijos ?? []).some((h) => h.nombre === v) && !esNuevo(completo)) {
            setNuevos((n) => [...n, completo]);
          }
          setSub(v);
        }}
        className="col-span-2 sm:col-span-1"
      />
    </>
  );
}
