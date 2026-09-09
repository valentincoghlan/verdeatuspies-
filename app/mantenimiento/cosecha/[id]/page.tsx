import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat } from "@/components/ui";
import { Confirmar } from "@/components/confirmar";
import {
  borrarCarga,
  borrarCosecha,
  cambiarEstadoCosecha,
  guardarCarga,
  repartirCosecha,
} from "@/lib/actions";
import { CerrarCosecha } from "@/components/cerrar-cosecha";
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

  // C4 a C6 - si la cosecha cubre un pedido, cuando ya cortaste algo la
  // app te ofrece cerrar la entrega ahi mismo, en vez de mandarte a
  // Inicio a buscar la alerta.
  const [{ data: porLote }, { data: lotesCosecha }, { data: pendientes }, { data: yaReparto }] =
    await Promise.all([
      supabase.from("v_cosecha_lotes").select("*").eq("cosecha_id", id),
      supabase.from("cosechas_lotes").select("lote_id, lotes(nombre)").eq("cosecha_id", id),
      // Los pedidos que puede abastecer, en orden de entrega: el que sale
      // antes se llena primero.
      supabase
        .from("ventas")
        .select("id, m2, precio_m2, fecha_entrega, clientes!cliente_id(nombre)")
        .in("estado", ["pedido", "confirmada"])
        .order("fecha_entrega", { ascending: true, nullsFirst: false }),
      supabase.from("cosecha_ventas").select("venta_id, m2").eq("cosecha_id", id),
    ]);

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

  const desglose = ((porLote ?? []) as any[])
    .filter((x) => x.lote)
    .map((x) => ({ lote: String(x.lote), m2: Number(x.m2 ?? 0), panes: Number(x.panes ?? 0) }));

  const asignados = new Map(
    ((yaReparto ?? []) as any[]).map((x) => [x.venta_id, Number(x.m2 ?? 0)]),
  );
  const paraRepartir = ((pendientes ?? []) as any[]).map((v) => ({
    id: v.id as string,
    comprador: (v.clientes as any)?.nombre ?? "Sin comprador",
    fechaEntrega: (v.fecha_entrega ?? null) as string | null,
    m2Pedido: Number(v.m2 ?? 0),
    precioM2: Number(v.precio_m2 ?? 0),
    asignado: asignados.get(v.id) ?? 0,
  }));

  // Los lotes que la cosecha va a tocar: son los que ofrece el selector
  // de cada carga. Con uno solo no se pregunta.
  const lotesDeLaCosecha = ((lotesCosecha ?? []) as any[])
    .map((x) => ({ id: x.lote_id as string, nombre: (x.lotes as any)?.nombre as string }))
    .filter((x) => x.nombre);

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

      {desglose.length > 1 && (
        <div className="mb-3 rounded-2xl border border-borde bg-crema p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
            De dónde salió
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {desglose.map((l) => (
              <li key={l.lote} className="flex justify-between gap-2">
                <span className="font-semibold text-tinta">{l.lote}</span>
                <span className="tabular-nums text-tinta-2">
                  {numero(l.panes)} panes · {m2(l.m2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              {/* De qué lote sale este tramo. Con un solo lote va
                  puesto y no se pregunta. */}
              {lotesDeLaCosecha.length > 1 ? (
                <div className="mb-2 sm:max-w-lg">
                  <label className="label" htmlFor="lote_carga">
                    De qué lote
                  </label>
                  <select id="lote_carga" name="lote_id" className="input" required>
                    {lotesDeLaCosecha.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                lotesDeLaCosecha[0] && (
                  <input type="hidden" name="lote_id" value={lotesDeLaCosecha[0].id} />
                )
              )}

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
            cerrada ? (
              <form action={cambiarEstadoCosecha}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="estado" value="abierta" />
                <button className="whitespace-nowrap text-sm font-bold text-pasto hover:underline">
                  Reabrir
                </button>
              </form>
            ) : (
              <CerrarCosecha
                cosechaId={c.id}
                cosechado={cortado}
                objetivo={objetivo}
                pedidos={paraRepartir}
                porLote={desglose}
                accion={repartirCosecha}
                yaCerrada={false}
              />
            )
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
