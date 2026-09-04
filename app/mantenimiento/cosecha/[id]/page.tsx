import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat } from "@/components/ui";
import { Confirmar } from "@/components/confirmar";
import { borrarCarga, borrarCosecha, cambiarEstadoCosecha, guardarCarga } from "@/lib/actions";
import { fechaLarga, m2, numero } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContarCosechaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: c }, { data: cargas }] = await Promise.all([
    supabase.from("v_cosechas").select("*").eq("id", id).maybeSingle(),
    supabase.from("cosecha_cargas").select("*").eq("cosecha_id", id).order("linea_desde"),
  ]);

  if (!c) notFound();

  const objetivo = Number(c.objetivo_m2 ?? 0);
  const cortado = Number(c.m2_cosechados ?? 0);
  const falta = Math.max(0, objetivo - cortado);
  const pct = objetivo > 0 ? Math.min(100, (cortado / objetivo) * 100) : 0;

  const pilasCargadas = Number(c.pilas_cargadas ?? 0);
  const pilasObjetivo = Number(c.pilas_objetivo ?? 0);
  const pilasFaltan = Math.max(0, pilasObjetivo - pilasCargadas);
  const m2PorPila = Number(c.m2_por_pan) * Number(c.panes_por_pila);

  const filas = (cargas ?? []) as any[];
  const proxima = Number(c.ultima_linea ?? 0) + 1;
  const cerrada = c.estado === "cerrada";

  const tramo = (f: any) =>
    f.linea_desde === f.linea_hasta ? `L${f.linea_desde}` : `L${f.linea_desde}–${f.linea_hasta}`;

  return (
    <>
      <PageHeader
        titulo={`Cosecha del ${fechaLarga(c.fecha)}`}
        bajada={
          c.comprador
            ? `${c.lote ?? "Sin lote"} · para ${c.comprador}`
            : (c.lote ?? "Sin lote definido")
        }
        accion={
          <Link href="/mantenimiento/cosecha" className="btn-ghost">
            Volver
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Falta cortar"
          valor={m2(falta)}
          destacado
          detalle={pilasFaltan > 0 ? `${numero(pilasFaltan)} pilas más` : "Objetivo cumplido"}
        />
        <Stat label="Cortado" valor={m2(cortado)} tono="verde" detalle={`${numero(pct)}% del objetivo`} />
        <Stat
          label="Pilas"
          valor={`${numero(pilasCargadas)} / ${numero(pilasObjetivo)}`}
          detalle={`${numero(c.panes_cargados)} panes de ${numero(c.panes_objetivo)}`}
        />
        <Stat
          label="Objetivo"
          valor={m2(objetivo)}
          detalle={`Pan de ${numero(c.pan_largo_m, 2)} × ${numero(c.pan_ancho_m, 2)} m`}
        />
      </div>

      {/* Barra de avance: se ve de lejos, con el celular en la mano. */}
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-beige">
        <div className="h-full rounded-full bg-pasto transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 space-y-3">
        {!cerrada && (
          <Card titulo="Contar">
            {/* Los tres campos en una sola fila: cuando se abre el teclado del
                celular queda muy poca pantalla y hay que verlos todos juntos. */}
            <form action={guardarCarga}>
              <input type="hidden" name="cosecha_id" value={c.id} />
              <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
                <div>
                  <label className="label" htmlFor="desde">
                    Línea
                  </label>
                  <input
                    id="desde"
                    name="desde"
                    type="number"
                    min="1"
                    required
                    inputMode="numeric"
                    defaultValue={proxima}
                    className="input px-3 text-center"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="hasta">
                    Hasta
                  </label>
                  <input
                    id="hasta"
                    name="hasta"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="—"
                    className="input px-3 text-center"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="pilas">
                    Pilas
                  </label>
                  <input
                    id="pilas"
                    name="pilas"
                    type="number"
                    min="0"
                    required
                    inputMode="numeric"
                    placeholder="0"
                    className="input px-3 text-center"
                  />
                </div>
              </div>
              <button className="btn btn-alto mt-3 sm:w-auto">Guardar</button>
            </form>
            <p className="mt-3 text-sm text-tinta-2">
              <strong>Pilas</strong> es el total contado en ese tramo, no por línea. Si cortaste de
              la 2 a la 4 y contaste 62 pilas entre las tres, ponés 2, 4 y 62. Para una sola línea,
              dejá <strong>Hasta</strong> vacío. Cada pila son {c.panes_por_pila} panes ={" "}
              {numero(m2PorPila, 2)} m².
            </p>
          </Card>
        )}

        <Card
          titulo="Historial"
          accion={
            <form action={cambiarEstadoCosecha}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="estado" value={cerrada ? "abierta" : "cerrada"} />
              <button className="text-sm font-semibold text-pasto hover:underline">
                {cerrada ? "Reabrir" : "Cerrar cosecha"}
              </button>
            </form>
          }
        >
          {filas.length === 0 ? (
            <p className="rounded-[16px] bg-crema py-8 text-center text-[15px] text-tinta-2">
              Todavía no contaste nada.
            </p>
          ) : (
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-[16px] bg-crema px-4 text-[15px] font-semibold text-tinta">
                <span>
                  {numero(c.lineas)} línea{Number(c.lineas) === 1 ? "" : "s"} ·{" "}
                  {numero(pilasCargadas)} pilas · {m2(cortado)}
                </span>
                <span aria-hidden className="text-xs text-tinta-3 group-open:rotate-180">
                  ▾
                </span>
              </summary>

              {/* Filas finas y en varias columnas: suelen ser muchísimas. */}
              <ul className="mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-4">
                {filas.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-baseline justify-between gap-2 border-b border-beige py-1.5 text-[15px]"
                  >
                    <span className="text-tinta-3">{tramo(f)}</span>
                    <span className="font-semibold tabular-nums text-tinta">
                      {numero(f.pilas)}
                    </span>
                    {!cerrada && (
                      <Confirmar
                        action={borrarCarga}
                        campos={{ id: f.id, cosecha_id: c.id }}
                        etiqueta="×"
                        pregunta={`¿Borrar el conteo de ${tramo(f)}?`}
                        compacto
                      />
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-tinta-3">
                A la izquierda el tramo de líneas, a la derecha las pilas contadas en ese tramo.
              </p>
            </details>
          )}

          {c.notas && <p className="mt-4 text-sm italic text-tinta-2">{c.notas}</p>}
        </Card>

        <Confirmar
          action={borrarCosecha}
          campos={{ id: c.id }}
          etiqueta="Borrar esta cosecha"
          pregunta="Se borra la cosecha con todo lo contado. No se puede deshacer."
          confirmar="Sí, borrar todo"
        />
      </div>
    </>
  );
}
