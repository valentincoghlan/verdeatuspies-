"use client";

import { useEffect, useState } from "react";
import { numero } from "@/lib/format";

/**
 * Cómo armar la pulverizadora.
 *
 * Todo sale de una sola cuenta: cuántos litros de caldo caen por hectárea.
 *
 *     litros por hectárea = caudal (L/min) × 600 ÷ (velocidad km/h × ancho m)
 *
 * El 600 no es magia: a V km/h con un ancho de A metros, en una hora se
 * barren V × 1.000 × A metros cuadrados, o sea V × A ÷ 10 hectáreas. El
 * caudal por hora es 60 veces el de por minuto. Dividiendo una cosa por
 * la otra queda el 600.
 *
 * Con ese número ya sabemos cuántas hectáreas hace un tanque, y con la
 * dosis de la etiqueta, cuánto producto va adentro.
 *
 * Los datos de la máquina quedan guardados en el celular (localStorage):
 * el tanque, el ancho y las boquillas no cambian de un día para el otro,
 * y en el campo no da ganas de escribirlos de nuevo. Lo único que se
 * carga cada vez es el producto.
 */

type Lote = { id: string; nombre: string; superficie_m2: number | null };

/** Lee un número escrito como se escribe acá. */
const n = (s: string) => {
  const t = s.trim().replace(/\s/g, "");
  // Si hay coma, mandan las reglas de acá: el punto separa los miles.
  // Si no hay coma, el punto es el decimal — hay teclados que solo dan punto.
  const limpio = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(limpio);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

const num = (v: number, d = 0) => numero(v, d);

/**
 * Las unidades en las que puede venir una dosis.
 *
 * `base` es a cuántos cc (o gramos) equivale una unidad, así adentro
 * siempre trabajamos con la unidad chica y redondeamos una sola vez.
 * `porHa` distingue las dos formas de escribir una etiqueta: por
 * superficie (lo normal en el campo) o por cada 100 litros de agua (lo
 * normal en los productos de jardín).
 */
const UNIDADES = [
  { value: "l_ha", label: "litros por hectárea", base: 1000, solido: false, porHa: true },
  { value: "cc_ha", label: "cc por hectárea", base: 1, solido: false, porHa: true },
  { value: "kg_ha", label: "kilos por hectárea", base: 1000, solido: true, porHa: true },
  { value: "g_ha", label: "gramos por hectárea", base: 1, solido: true, porHa: true },
  { value: "cc_100", label: "cc por cada 100 L de agua", base: 1, solido: false, porHa: false },
  { value: "g_100", label: "gramos por cada 100 L de agua", base: 1, solido: true, porHa: false },
] as const;

type Unidad = (typeof UNIDADES)[number]["value"];

/** Muestra una cantidad en la unidad que se entiende sin pensar. */
function cantidad(v: number, solido: boolean) {
  if (v <= 0) return "—";
  const grande = solido ? "kg" : "L";
  const chica = solido ? "g" : "cc";
  if (v >= 1000) return `${num(v / 1000, 2)} ${grande}`;
  if (v < 10) return `${num(v, 1)} ${chica}`;
  return `${num(v, 0)} ${chica}`;
}

const GUARDADO = "vatp:pulverizadora";

export function CalculadoraPulverizacion({ lotes }: { lotes: Lote[] }) {
  const [tanque, setTanque] = useState("");
  const [ancho, setAncho] = useState("");
  const [caudal, setCaudal] = useState("");
  const [velocidad, setVelocidad] = useState("");
  const [modoVel, setModoVel] = useState<"medida" | "directa">("medida");
  const [metros, setMetros] = useState("100");
  const [segundos, setSegundos] = useState("");
  const [producto, setProducto] = useState("");
  const [dosis, setDosis] = useState("");
  const [unidad, setUnidad] = useState<Unidad>("l_ha");
  const [superficie, setSuperficie] = useState("");
  const [listo, setListo] = useState(false);

  // La máquina se lee después del primer dibujo: si se leyera durante,
  // el HTML del servidor y el del celular no coincidirían y React
  // protestaría.
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(GUARDADO) ?? "{}");
      if (g.tanque) setTanque(g.tanque);
      if (g.ancho) setAncho(g.ancho);
      if (g.caudal) setCaudal(g.caudal);
      if (g.velocidad) setVelocidad(g.velocidad);
      if (g.modoVel) setModoVel(g.modoVel);
      if (g.metros) setMetros(g.metros);
      if (g.segundos) setSegundos(g.segundos);
    } catch {
      // Un celular con el almacenamiento bloqueado no rompe la pantalla.
    }
    setListo(true);
  }, []);

  useEffect(() => {
    if (!listo) return;
    try {
      localStorage.setItem(
        GUARDADO,
        JSON.stringify({ tanque, ancho, caudal, velocidad, modoVel, metros, segundos }),
      );
    } catch {
      // Ídem: si no se puede guardar, se sigue calculando igual.
    }
  }, [listo, tanque, ancho, caudal, velocidad, modoVel, metros, segundos]);

  const T = n(tanque);
  const A = n(ancho);
  const Q = n(caudal);
  const D = n(dosis);

  // La velocidad entra medida o a mano. Medida, se usa el número entero
  // que sale de la división y no el redondeado que se muestra: 81,25
  // segundos dan 4,4307... km/h, y arrastrar ese resto mueve el caldo
  // casi un uno por ciento.
  const M = n(metros);
  const S = n(segundos);
  const V = modoVel === "medida" ? (M && S ? (M / S) * 3.6 : 0) : n(velocidad);
  const u = UNIDADES.find((x) => x.value === unidad)!;

  // El corazón de todo.
  const lHa = Q && V && A ? (Q * 600) / (V * A) : 0;
  const haTanque = lHa && T ? T / lHa : 0;
  const minTanque = Q && T ? T / Q : 0;
  const metrosTanque = haTanque && A ? (haTanque * 10000) / A : 0;

  // La dosis, siempre en cc o gramos.
  const dosisChica = D * u.base;
  const porTanque = u.porHa ? dosisChica * haTanque : (dosisChica * T) / 100;
  const porHa = u.porHa ? dosisChica : (dosisChica * lHa) / 100;
  const por100 = T ? (porTanque / T) * 100 : 0;

  const ha = n(superficie);
  const tanquesExactos = haTanque ? ha / haTanque : 0;
  const tanquesEnteros = Math.floor(tanquesExactos + 1e-9);
  const haSobrante = Math.max(0, ha - tanquesEnteros * haTanque);
  const aguaSobrante = haSobrante * lHa;
  const productoSobrante = u.porHa ? dosisChica * haSobrante : (dosisChica * aguaSobrante) / 100;
  const productoTotal = u.porHa ? dosisChica * ha : (dosisChica * ha * lHa) / 100;

  const faltan = [
    !T && "la capacidad del tanque",
    !V && "la velocidad",
    !Q && "el caudal",
    !A && "el ancho",
    !D && "la dosis",
  ].filter(Boolean) as string[];

  const campo = (
    id: string,
    label: string,
    valor: string,
    set: (s: string) => void,
    ph: string,
    ayuda?: string,
  ) => (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => set(e.target.value)}
        placeholder={ph}
        className="input"
      />
      {ayuda && <p className="mt-1 text-xs text-tinta-3">{ayuda}</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* El resultado va arriba y está siempre, aunque falten datos: si
          apareciera recién al completar, empujaría los campos justo
          mientras se escribe. Y como la máquina queda guardada, la
          próxima vez se entra y el número ya está. */}
      <div className="rounded-2xl bg-pasto-oscuro p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-pasto-claro">
          Cargá en el tanque
        </p>
        {porTanque > 0 ? (
          <>
            <p className="mt-1.5 text-[32px] font-bold leading-none tracking-[-.02em] tabular-nums text-crema">
              {cantidad(porTanque, u.solido)}
            </p>
            <p className="mt-2 text-sm text-pasto-claro">
              {producto ? <strong className="text-crema">{producto}</strong> : "de producto"} en{" "}
              <strong className="text-crema">{num(T)} litros</strong> de agua. Ese tanque alcanza
              para <strong className="text-crema">{num(haTanque, 2)} ha</strong>.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-pasto-claro">
            Faltan {faltan.slice(0, 2).join(" y ")}
            {faltan.length > 2
              ? ` (y ${faltan.length - 2} dato${faltan.length > 3 ? "s" : ""} más)`
              : ""}
            .
          </p>
        )}
      </div>

      {lHa > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="flex flex-col rounded-2xl border border-borde bg-white p-3.5">
            <p className="mb-1.5 min-h-[2.1em] text-[10.5px] font-bold uppercase leading-[1.05] tracking-[.08em] text-tinta-3">
              Caldo
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums text-pasto-oscuro">
              {num(lHa, 0)}
            </p>
            <p className="mt-1 text-xs text-tinta-2">litros por ha</p>
          </div>
          <div className="flex flex-col rounded-2xl border border-borde bg-white p-3.5">
            <p className="mb-1.5 min-h-[2.1em] text-[10.5px] font-bold uppercase leading-[1.05] tracking-[.08em] text-tinta-3">
              Cada tanque
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums text-pasto-oscuro">
              {num(minTanque, 0)}
            </p>
            <p className="mt-1 text-xs text-tinta-2">
              min ·{" "}
              {metrosTanque >= 1000
                ? `${num(metrosTanque / 1000, 1)} km`
                : `${num(metrosTanque)} m`}
            </p>
          </div>
          <div className="flex flex-col rounded-2xl border border-borde bg-white p-3.5">
            <p className="mb-1.5 min-h-[2.1em] text-[10.5px] font-bold uppercase leading-[1.05] tracking-[.08em] text-tinta-3">
              Mezcla
            </p>
            <p className="text-2xl font-bold leading-none tabular-nums text-pasto-oscuro">
              {por100 > 0 ? num(por100, por100 < 10 ? 1 : 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-tinta-2">{u.solido ? "g" : "cc"} por 100 L</p>
          </div>
        </div>
      )}

      {/* Avisos: solo cuando hay algo raro que mirar antes de arrancar. */}
      {lHa > 0 && (lHa < 80 || lHa > 400) && (
        <div
          className={`rounded-2xl p-3 text-sm ${
            lHa < 80 ? "bg-atencion-bg text-atencion-tx" : "bg-info-bg text-info-tx"
          }`}
        >
          {lHa < 80 ? (
            <>
              <strong>{num(lHa)} litros por hectárea es poco caldo.</strong> Con tan poca agua
              cuesta mojar bien la hoja. Revisá si no vas muy rápido o si las boquillas son chicas
              para lo que querés hacer.
            </>
          ) : (
            <>
              <strong>{num(lHa)} litros por hectárea es bastante caldo.</strong> No está mal —moja
              mucho— pero vas a estar recargando seguido, y con algunos productos el exceso de agua
              escurre. Fijate qué dice la etiqueta.
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
          El producto
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <label className="label" htmlFor="pul-producto">
              Qué vas a aplicar
            </label>
            <input
              id="pul-producto"
              type="text"
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              placeholder="Ej. Glifosato"
              className="input"
            />
          </div>
          {campo("pul-dosis", "Dosis", dosis, setDosis, "Ej. 3")}
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <label className="label" htmlFor="pul-unidad">
              Dosis expresada en
            </label>
            <select
              id="pul-unidad"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as Unidad)}
              className="input h-11 sm:h-9"
            >
              {UNIDADES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {porHa > 0 && !u.porHa && (
          <p className="mt-3 text-xs text-tinta-2">
            Con ese caldo, la dosis te queda en{" "}
            <strong>{cantidad(porHa, u.solido)} por hectárea</strong>. Si la etiqueta también da
            una dosis por hectárea, cotejala: no deberían andar lejos.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
          La pulverizadora
        </h2>
        <p className="mb-3 text-sm text-tinta-2">
          Esto queda guardado en el celular: la próxima vez entrás y ya está.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {campo("pul-tanque", "Tanque (litros)", tanque, setTanque, "Ej. 400")}
          {campo("pul-ancho", "Ancho (metros)", ancho, setAncho, "Ej. 6")}
          {campo(
            "pul-caudal",
            "Caudal total (L/min)",
            caudal,
            setCaudal,
            "Ej. 20",
            "Todas las boquillas juntas.",
          )}
        </div>

        <details className="mt-3 rounded-2xl border border-borde bg-crema p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-pasto">
            No sé el caudal total, calculalo por mí
          </summary>
          <CaudalPorBoquilla onUsar={setCaudal} />
        </details>

        {/* La velocidad va aparte y no como un campo más.
            Es el dato que más mueve la cuenta y el único que cambia de
            una pasada a la otra: basta subir una marcha para que el
            caldo por hectárea se caiga. Por eso el cronómetro es la
            forma de arranque, no una ayuda escondida. */}
        <div className="mt-4 border-t border-borde pt-4">
          <p className="label">Velocidad</p>
          <div className="flex gap-2">
            {(
              [
                ["medida", "Medirla con cronómetro"],
                ["directa", "Ya la sé"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={modoVel === valor}
                onClick={() => setModoVel(valor)}
                className={`min-h-11 flex-1 rounded-xl border-[1.5px] px-3 text-sm font-semibold transition ${
                  modoVel === valor
                    ? "border-pasto bg-hecho-bg text-pasto-oscuro"
                    : "border-borde bg-crema text-tinta-2"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          {modoVel === "medida" ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {campo("pul-metros", "Metros marcados", metros, setMetros, "100")}
                {campo("pul-segundos", "Segundos que tardó", segundos, setSegundos, "Ej. 81,25")}
              </div>
              <div className="mt-3 rounded-xl bg-hecho-bg p-3">
                {V > 0 ? (
                  <p className="text-sm text-pasto-oscuro">
                    Vas a <strong className="text-base">{num(V, 2)} km/h</strong>.
                  </p>
                ) : (
                  <p className="text-sm text-tinta-2">
                    Poné los segundos y te digo a cuánto vas.
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-tinta-3">
                Marcá cien metros en el lote y pasá con el tanque cargado, en la misma marcha con la
                que vas a laburar. Arrancá el cronómetro ya andando, no desde parado. Volvé a
                medirla cada vez que cambies de marcha: es el número que más mueve el resultado.
              </p>
            </>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {campo("pul-velocidad", "Velocidad (km/h)", velocidad, setVelocidad, "Ej. 6")}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
          Cuánto vas a pulverizar
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {campo("pul-sup", "Hectáreas", superficie, setSuperficie, "Ej. 2,5")}
        </div>
        {lotes.some((l) => l.superficie_m2) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {lotes
              .filter((l) => l.superficie_m2)
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    setSuperficie(String(Number(l.superficie_m2) / 10000).replace(".", ","))
                  }
                  className="min-h-11 rounded-xl border border-borde bg-crema px-3 text-sm font-semibold text-pasto sm:min-h-9"
                >
                  {l.nombre} · {num(Number(l.superficie_m2) / 10000, 1)} ha
                </button>
              ))}
          </div>
        )}

        {ha > 0 && haTanque > 0 ? (
          <div className="mt-3 rounded-xl bg-hecho-bg p-3">
            <p className="text-sm text-pasto-oscuro">
              Para <strong>{num(ha, 2)} ha</strong> te hacen falta{" "}
              <strong>
                {tanquesExactos <= 1
                  ? "un solo tanque"
                  : `${num(Math.ceil(tanquesExactos - 1e-9))} tanques`}
              </strong>
              .
            </p>
            {tanquesEnteros > 0 && (
              <p className="mt-1.5 text-sm text-pasto-oscuro">
                {tanquesEnteros} tanque{tanquesEnteros === 1 ? "" : "s"} lleno
                {tanquesEnteros === 1 ? "" : "s"}: {num(T)} L de agua con{" "}
                <strong>{cantidad(porTanque, u.solido)}</strong> cada uno.
              </p>
            )}
            {haSobrante > 0.005 && (
              <p className="mt-1.5 text-sm text-pasto-oscuro">
                Y el último a medio cargar, para las {num(haSobrante, 2)} ha que quedan:{" "}
                <strong>{num(aguaSobrante)} L de agua</strong> con{" "}
                <strong>{cantidad(productoSobrante, u.solido)}</strong>.
              </p>
            )}
            <p className="mt-2 border-t border-pasto/15 pt-2 text-sm text-pasto-oscuro">
              En total vas a usar <strong>{cantidad(productoTotal, u.solido)}</strong> de producto
              y <strong>{num(ha * lHa)} litros</strong> de agua. Son cerca de{" "}
              <strong>{num((ha * lHa) / Q, 0)} minutos</strong> de pulverizado, sin contar las
              recargas.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-tinta-3">
            Opcional. Si lo ponés, te digo cuántos tanques preparar y cómo cargar el último.
          </p>
        )}
      </div>

      <p className="px-1 pb-2 text-xs text-tinta-3">
        La cuenta sale de los números que cargaste: el caudal real cambia con la presión y con el
        desgaste de las boquillas, así que conviene medirlo cada tanto. Y la dosis que manda
        siempre es la de la etiqueta del producto.
      </p>
    </div>
  );
}

/**
 * El caudal total, a partir de una boquilla.
 *
 * Se pide por boquilla y no total porque el dato que está a mano es el de
 * la ficha de la pastilla, o el del vasito: lo que larga una sola en un
 * minuto.
 */
function CaudalPorBoquilla({ onUsar }: { onUsar: (s: string) => void }) {
  const [porBoquilla, setPorBoquilla] = useState("");
  const [cuantas, setCuantas] = useState("");
  const total = n(porBoquilla) * n(cuantas);

  return (
    <>
      <p className="mt-3 text-sm text-tinta-2">
        Poné un vaso medidor abajo de una boquilla y dejala tirar un minuto, con la máquina a la
        presión de trabajo. Eso que juntaste es lo que larga una.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="label" htmlFor="pul-bq">
            Litros por minuto de una
          </label>
          <input
            id="pul-bq"
            type="text"
            inputMode="decimal"
            value={porBoquilla}
            onChange={(e) => setPorBoquilla(e.target.value)}
            placeholder="Ej. 1,2"
            className="input"
          />
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor="pul-bq-n">
            Cuántas boquillas
          </label>
          <input
            id="pul-bq-n"
            type="text"
            inputMode="numeric"
            value={cuantas}
            onChange={(e) => setCuantas(e.target.value)}
            placeholder="Ej. 12"
            className="input"
          />
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-pasto-oscuro">
            Da <strong>{num(total, 1)} litros por minuto</strong> en total.
          </p>
          <button
            type="button"
            onClick={() => onUsar(num(total, 1))}
            className="min-h-11 rounded-xl bg-pasto px-4 text-sm font-bold text-crema sm:min-h-9"
          >
            Usar este número
          </button>
        </div>
      )}
    </>
  );
}
