import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardPlegable, PageHeader, Stat } from "@/components/ui";
import { ChipFiltro, TiraChips } from "@/components/chips-filtro";
import { Campo } from "@/components/campos";
import { CanalYComprador } from "@/components/comprador";
import { TarjetaPedido, type PedidoDelFlujo } from "@/components/tarjeta-pedido";
import type { VentaACobrar } from "@/components/cobrar";
import {
  anularPedido,
  borrarVenta,
  cobrarVentas,
  confirmarEntrega,
  cosecharPedido,
  crearCobro,
  crearPedido,
  deshacerEntrega,
  editarVenta,
  reprogramarPedido,
} from "@/lib/actions";
import { CAMINO, ETAPAS, FILTROS, esEtapa, type Etapa } from "@/lib/etapas";
import { fechaCorta, hoyISO, m2, numero, pesos } from "@/lib/format";
import { Formulario, Guardar } from "@/components/guardar";

export const dynamic = "force-dynamic";

/**
 * Pedidos: el recorrido entero, en una sola pantalla.
 *
 * Antes esto vivía en tres lugares. Tomabas el pedido acá, te ibas a
 * Cosecha a abrir un contador, volvías a Pedidos a dar la entrega y
 * terminabas en Ventas a cargar el cobro. Cuatro pantallas para una sola
 * cosa que pasa una sola vez, y en cada una el pedido se llamaba distinto.
 *
 * Ahora el pedido es el eje y no cambia de nombre: nace, se cosecha, se
 * entrega y se cobra, y cada uno de esos tres pasos es un botón en su
 * propia tarjeta. El contador de pilas sigue existiendo —es la
 * herramienta fina para cuando se corta y se cuenta en el momento— pero
 * dejó de ser el camino obligatorio: si el pasto ya está cortado, se
 * cierra la cosecha de una con los metros y el lote.
 */
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.clave === sp.f) ?? FILTROS[0];

  const supabase = await createClient();
  const hoy = hoyISO();

  const [
    { data: clientes },
    { data: lotes },
    { data: enCurso, error: errFlujo },
    { data: cerrados },
    { data: config },
    { data: cuentas },
  ] = await Promise.all([
      // El canal hace falta acá: sin él, el buscador no sabe quién es
      // distribuidor y ofrece crear un cliente que ya existe.
      supabase.from("clientes").select("id, nombre, canal").eq("activo", true).order("nombre"),
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      // Todo lo que tiene algo pendiente, de lo que sale antes a lo que
      // sale después: así de arriba para abajo es el orden en que hay
      // que ocuparse.
      supabase
        .from("v_flujo_pedidos")
        .select("*")
        .in("etapa", ["pedido", "en_cosecha", "cosechado", "entregado"])
        .order("fecha_entrega", { ascending: true, nullsFirst: false }),
      // Lo terminado queda a mano pero no estorba: se ve solo si se pide.
      supabase
        .from("v_flujo_pedidos")
        .select("*")
        .in("etapa", ["cobrado", "anulado"])
        .order("fecha_entrega", { ascending: false, nullsFirst: false })
        .limit(40),
      supabase
        .from("config")
        .select("clave, valor")
        .in("clave", [
          "umbral_lluvia_mm",
          "precio_m2_default",
          "pan_largo_m",
          "pan_ancho_m",
          "panes_por_pila",
        ]),
      supabase.from("cuentas").select("id, nombre").eq("activa", true).order("orden"),
    ]);

  const cfg = new Map((config ?? []).map((c: any) => [c.clave, c.valor]));
  const umbral = Number(cfg.get("umbral_lluvia_mm") ?? 2);
  const precioDefault = Number(cfg.get("precio_m2_default") ?? 0) || undefined;
  const pan = {
    largo: Number(cfg.get("pan_largo_m") ?? 0.62),
    ancho: Number(cfg.get("pan_ancho_m") ?? 0.4),
    porPila: Number(cfg.get("panes_por_pila") ?? 2),
  };

  const normalizar = (r: any): PedidoDelFlujo => ({
    ...r,
    etapa: (esEtapa(r.etapa) ? r.etapa : "pedido") as Etapa,
    m2: Number(r.m2 ?? 0),
    m2_cortesia: Number(r.m2_cortesia ?? 0),
    precio_m2: Number(r.precio_m2 ?? 0),
    flete: Number(r.flete ?? 0),
    total: Number(r.total ?? 0),
    m2_cosechados: Number(r.m2_cosechados ?? 0),
    m2_en_curso: Number(r.m2_en_curso ?? 0),
    cobrado: Number(r.cobrado ?? 0),
    pendiente: Number(r.pendiente ?? 0),
    precipitacion_mm: r.precipitacion_mm === null ? null : Number(r.precipitacion_mm),
  });

  const activos = ((enCurso ?? []) as any[]).map(normalizar);
  const terminados = ((cerrados ?? []) as any[]).map(normalizar);
  const todos = [...activos, ...terminados];
  const lista = todos.filter((p) => filtro.etapas.includes(p.etapa));

  // Cuántos hay en cada solapa: sin esto hay que entrar a cada una para
  // enterarte de que está vacía.
  const cuantos = new Map(
    FILTROS.map((f) => [f.clave, todos.filter((p) => f.etapas.includes(p.etapa)).length]),
  );

  /* Los cuatro números son los cuatro escalones del camino: cuántos
     pedidos hay dando vueltas, cuánto falta cortar, cuánto está cortado
     esperando el camión y cuánta plata falta que entre. */
  const porCosechar = activos
    .filter((p) => p.etapa === "pedido" || p.etapa === "en_cosecha")
    .reduce((a, p) => a + Math.max(0, p.m2 - p.m2_cosechados), 0);
  const porEntregar = activos
    .filter((p) => p.etapa === "cosechado")
    .reduce((a, p) => a + (p.m2_cosechados > 0 ? p.m2_cosechados : p.m2), 0);
  const entregados = activos.filter((p) => p.etapa === "entregado");
  const porCobrar = entregados.reduce((a, p) => a + p.pendiente, 0);
  const proxima = activos.find((p) => p.fecha_entrega && p.etapa !== "entregado");

  // Las entregas sin cobrar, que es lo que conoce el modal de cobro: un
  // pago de un distribuidor puede tapar tres de una.
  const ventasACobrar: VentaACobrar[] = entregados.map((p) => ({
    id: p.id,
    comprador: p.comprador,
    clienteId: p.cliente_id,
    fecha: p.fecha_entrega ?? p.fecha,
    facturado: p.total,
    pendiente: p.pendiente,
  }));

  const clientesPorCanal = (clientes ?? []).map((c: any) => ({
    nombre: c.nombre as string,
    canal: (c.canal ?? "directa") as string,
  }));
  const lotesOpc = ((lotes ?? []) as any[]).map((l) => ({ id: l.id as string, nombre: l.nombre as string }));
  const cuentasOpc = ((cuentas ?? []) as any[]).map((c) => ({ id: c.id as string, nombre: c.nombre as string }));

  const acciones = {
    cosechar: cosecharPedido,
    confirmar: confirmarEntrega,
    reprogramar: reprogramarPedido,
    anular: anularPedido,
    deshacer: deshacerEntrega,
    cobrar: cobrarVentas,
    senar: crearCobro,
    editar: editarVenta,
    borrar: borrarVenta,
  };

  return (
    <>
      <PageHeader
        titulo="Pedidos"
        bajada="De pedido a cobrado, sin cambiar de pantalla. Cada tarjeta trae el botón del paso que sigue."
        accion={
          <div className="flex gap-2">
            <Link href="/ventas/cosecha" className="btn-ghost">
              Cosechas
            </Link>
            <Link href="/ventas" className="btn-ghost">
              Ventas
            </Link>
          </div>
        }
      />

      {/* Sin la migración corrida la vista no existe y la pantalla
          quedaría vacía sin decir por qué, que es la peor manera de
          fallar: parece que no hay pedidos. */}
      {errFlujo && (
        <div className="mb-3 rounded-2xl border border-urgente-tx/30 bg-urgente-bg p-3.5 text-sm text-urgente-tx">
          <p className="font-bold">No se pudo leer el recorrido de los pedidos.</p>
          <p className="mt-1">
            Falta correr la migración <strong>0042</strong> en Supabase. Hasta que se corra, esta
            pantalla va a verse vacía.
          </p>
          <p className="mt-1 text-xs opacity-80">{errFlujo.message}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Pedidos en curso"
          valor={numero(activos.length)}
          destacado
          detalle={
            proxima ? `El próximo sale el ${fechaCorta(proxima.fecha_entrega!)}` : "Nada agendado"
          }
        />
        <Stat
          label="m² por cosechar"
          valor={m2(porCosechar)}
          tono={porCosechar > 0 ? "ambar" : "neutro"}
          detalle={`${cuantos.get("cosechar") ?? 0} pedidos esperando el corte`}
        />
        <Stat
          label="m² por entregar"
          valor={m2(porEntregar)}
          tono={porEntregar > 0 ? "verde" : "neutro"}
          detalle="Cortados, esperando el camión"
        />
        <Stat
          label="Por cobrar"
          valor={pesos(porCobrar)}
          tono={porCobrar > 0 ? "ambar" : "neutro"}
          detalle={`${entregados.length} entregas sin saldar`}
        />
      </div>

      {/* Las solapas son los cuatro escalones: qué hay que cortar, qué
          hay que llevar, qué hay que cobrar. */}
      <div className="mt-3">
        <TiraChips>
          {FILTROS.map((f) => (
            <ChipFiltro
              key={f.clave}
              href={f.clave === FILTROS[0].clave ? "/ventas/pedidos" : `/ventas/pedidos?f=${f.clave}`}
              activo={f.clave === filtro.clave}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{cuantos.get(f.clave) ?? 0}</span>
            </ChipFiltro>
          ))}
        </TiraChips>
      </div>

      <div className="mt-3 space-y-3">
        <CardPlegable id="nuevo" titulo="Nuevo pedido" bajada="Cuándo sale, para quién y cuánto">
          <Formulario action={crearPedido} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Primero cuándo se entrega, que es lo que define todo lo demás. */}
            <Campo label="Entrega" name="fecha_entrega" type="date" required />
            <CanalYComprador clientes={clientesPorCanal} />
            <Campo label="m²" name="m2" type="number" step="0.5" required placeholder="200" />
            <Campo
              label="Precio por m²"
              name="precio_m2"
              type="number"
              required
              defaultValue={precioDefault}
            />
            <Campo label="Notas" name="notas" placeholder="Opcional" className="col-span-2" />

            <div className="col-span-2 sm:col-span-4">
              <Guardar className="btn btn-alto">Guardar pedido</Guardar>
            </div>
          </Formulario>
          {(clientes ?? []).length === 0 && (
            <p className="mt-3 text-xs text-atencion-tx">
              Primero cargá un comprador en{" "}
              <Link href="/ventas/clientes" className="font-semibold underline">
                Clientes
              </Link>
              .
            </p>
          )}
        </CardPlegable>

        <Card titulo={filtro.label}>
          {lista.length === 0 ? (
            <p className="rounded-xl bg-crema py-8 text-center text-sm text-tinta-2">
              {filtro.clave === "curso"
                ? "No hay pedidos dando vueltas. Todo lo que se tomó ya se entregó y se cobró."
                : "Nada por acá."}
            </p>
          ) : (
            <ul className="space-y-3">
              {lista.map((p) => (
                <TarjetaPedido
                  key={p.id}
                  p={p}
                  hoy={hoy}
                  lotes={lotesOpc}
                  cuentas={cuentasOpc}
                  ventasACobrar={ventasACobrar}
                  umbralLluvia={umbral}
                  pan={pan}
                  acciones={acciones}
                />
              ))}
            </ul>
          )}

          {/* El camino escrito, para el que entra por primera vez. */}
          <p className="mt-4 text-xs text-tinta-3">
            {CAMINO.map((e) => ETAPAS[e].nombre).join(" → ")}. El pedido avanza solo cuando se hace
            algo: se cierra la cosecha, se da la entrega, entra la plata.
          </p>
        </Card>
      </div>
    </>
  );
}
