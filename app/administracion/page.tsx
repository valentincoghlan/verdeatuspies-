import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Opciones, Selector } from "@/components/campos";
import { Elegir } from "@/components/elegir";
import { CuentaYMonto } from "@/components/plata";
import { QuePaso } from "@/components/que-paso";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import { Tanda } from "@/components/tanda";
import { FechaDeCarga, ProveedorCarga } from "@/components/carga";
import { PedidosDeCarga } from "@/components/pedidos-de-carga";
import { crearMovimiento, crearPersona, crearTanda } from "@/lib/actions";
import { esAdmin } from "@/lib/rol";
import { fechaBreve, fechaDM, hoyISO, numero, pesos, sumarDiasISO } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIPOS_PERSONA = [
  { value: "proveedor", label: "Proveedor" },
  { value: "comprador", label: "Comprador" },
  { value: "empleado", label: "Empleado" },
  { value: "socio", label: "Socio" },
  { value: "otro", label: "Otro" },
];

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp);
  const supabase = await createClient();
  const hoy = hoyISO();

  const [
    { data: cuentas },
    { data: categorias },
    { data: personas },
    { data: lotes },
    { data: ventas },
    { data: cosechasDeVenta },
    { data: movs },
    { data: totales },
    { data: cotizacion },
    admin,
  ] = await Promise.all([
    supabase.from("cuentas").select("*").eq("activa", true).order("orden"),
    supabase.from("categorias").select("*").eq("activa", true).order("orden"),
    supabase.from("personas").select("*").eq("activa", true).order("nombre"),
    supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
    // Los pedidos a los que se les puede colgar un movimiento. Vienen
    // los que deben plata —a esos se les cobra siempre, tengan la edad
    // que tengan— y los cosechados hace poco, que son a los que se les
    // puede imputar un gasto. La regla de cuál va con cuál está en
    // PedidosDeCarga.
    supabase
      .from("v_margen_ventas")
      .select("venta_id, comprador, fecha, fecha_entrega, facturado, m2, pendiente")
      .or(`pendiente.gt.0,fecha.gte.${sumarDiasISO(hoy, -60)}`)
      .order("fecha_entrega", { ascending: false, nullsFirst: false })
      .limit(120),
    // De qué día es la cosecha que abasteció cada pedido: la ventana de
    // cinco días de un gasto se mide contra eso, no contra la venta.
    supabase
      .from("cosecha_ventas")
      .select("venta_id, cosechas(fecha)"),
    supabase
      .from("v_movimientos")
      .select("*")
      .gte("fecha", rango.desde)
      .lte("fecha", rango.hasta)
      .order("fecha", { ascending: false })
      .limit(300),
    // Los totales se calculan sobre TODO el período, no sobre las 300 filas
    // que se muestran en la tabla.
    supabase
      .from("v_movimientos")
      // `monto` está siempre en pesos, sin importar en qué moneda se
      // escribió: por eso se suman todos. Los ajustes de saldo quedan
      // afuera: corrigen un arrastre, no son plata que se movió.
      .select("tipo, monto")
      .neq("categoria", "Ajustes")
      .gte("fecha", rango.desde)
      .lte("fecha", rango.hasta),
    supabase
      .from("cotizaciones")
      .select("mep")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    esAdmin(),
  ]);

  const mep = cotizacion?.mep ? Number(cotizacion.mep) : null;

  const lista = (movs ?? []) as any[];
  const todos = (totales ?? []) as any[];
  const ingresos = todos.filter((m) => m.tipo === "I").reduce((a, m) => a + Number(m.monto), 0);
  const egresos = todos.filter((m) => m.tipo === "E").reduce((a, m) => a + Number(m.monto), 0);

  // El saldo en pesos y el de dólares se cuentan por separado: una misma
  // cuenta puede tener movimientos en las dos monedas.


  // Cada rubro con lo que le cuelga: el formulario los pide en dos pasos.
  const rubros = (categorias ?? [])
    .filter((c: any) => !c.padre_id)
    .map((p: any) => ({
      nombre: p.nombre as string,
      tipo: (p.tipo ?? "ambos") as string,
      hijos: (categorias ?? [])
        .filter((c: any) => c.padre_id === p.id)
        .map((h: any) => ({ nombre: h.nombre as string, tipo: (h.tipo ?? "ambos") as string })),
    }));

  const opcionesCuenta = (cuentas ?? []).map((c: any) => ({
    nombre: c.nombre as string,
    moneda: (c.moneda ?? "ARS") as string,
  }));
  const nombresPersona = (personas ?? []).map((p: any) => p.nombre as string);
  const opcionesLote = (lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }));
  // La cosecha más reciente de cada pedido. Si lo abastecieron dos, vale
  // la última: es la que deja la ventana de gastos abierta más tiempo.
  const cosechaDe = new Map<string, string>();
  for (const cv of (cosechasDeVenta ?? []) as any[]) {
    const f = cv.cosechas?.fecha as string | undefined;
    if (!f) continue;
    const antes = cosechaDe.get(cv.venta_id);
    if (!antes || f > antes) cosechaDe.set(cv.venta_id, f);
  }

  // Un solo listado para los dos formularios: quién puede recibir qué lo
  // decide PedidosDeCarga según se esté cargando un cobro o un gasto.
  const pedidosElegibles = ((ventas ?? []) as any[]).map((v) => ({
    id: v.venta_id as string,
    comprador: (v.comprador ?? "Sin comprador") as string,
    m2: Number(v.m2 ?? 0),
    pendiente: Number(v.pendiente ?? 0),
    fechaCosecha: cosechaDe.get(v.venta_id) ?? null,
    fecha: (v.fecha_entrega ?? v.fecha) as string,
  }));

  const cuentasConId = (cuentas ?? []).map((c: any) => ({
    id: c.id as string,
    nombre: c.nombre as string,
  }));

  return (
    <>
      <PageHeader
        titulo="Movimientos"
        bajada="Todo lo que entra y sale. Los saldos están en Disponibilidades y el análisis en Reportes."
      />

      <div className="space-y-3">
        <FiltroFechas base="/administracion" activo={sp.p} rango={rango} />

        <Card titulo="Cargar un movimiento">
          {/* Envuelve el formulario porque dos campos se miran entre sí:
              a qué pedidos se puede imputar depende de si entra o sale
              plata y de qué día es. */}
          <ProveedorCarga hoy={hoy}>
          <form action={crearMovimiento} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Qué pasó */}
            <QuePaso rubros={rubros} admin={admin} />

            {/* Cuánto */}
            <CuentaYMonto cuentas={opcionesCuenta} mep={mep} />
            <FechaDeCarga hoy={hoy} className="col-span-1" />

            {/* Con quién y dónde */}
            <Selector
              label="Lote"
              name="lote_id"
              vacio="General"
              opciones={opcionesLote}
              className="col-span-1"
            />
            <Elegir
              label="Persona"
              name="persona"
              opciones={nombresPersona.map((n) => ({ value: n, label: n }))}
              vacio="Sin especificar"
              opcional
              permiteNuevo
              className="col-span-2 sm:col-span-1"
            />
            <Campo
              label="Detalle"
              name="detalle"
              placeholder="Qué se compró o por qué se cobró"
              className="col-span-2 sm:col-span-1"
            />
            {/* Cualquier movimiento se puede colgar de una venta: un
                cobro, un flete, la mano de obra de esa cosecha. De ahí
                sale el margen real de cada operación. */}
            <PedidosDeCarga
              pedidos={pedidosElegibles}
              hoy={hoy}
              className="col-span-2 sm:col-span-3"
            />

            <div className="col-span-2 sm:col-span-3">
              <button className="btn btn-alto sm:w-auto">Guardar movimiento</button>
            </div>
          </form>
          </ProveedorCarga>
        </Card>

        {/* El día de cosecha no es un movimiento: son cinco pagos que van
            a tres pedidos. Va plegado para no tapar la carga de todos
            los días, que sigue siendo la de arriba. */}
        <Card className="p-0">
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5">
              <span>
                <span className="block text-sm font-bold text-tinta">Cargar varios juntos</span>
                <span className="block text-xs text-tinta-3">
                  Un día de cosecha: varios pagos repartidos entre varios pedidos
                </span>
              </span>
              <span aria-hidden className="text-xs text-tinta-3 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="border-t border-beige p-4 sm:p-5">
              <Tanda
                rubros={rubros}
                admin={admin}
                cuentas={cuentasConId}
                personas={nombresPersona}
                lotes={opcionesLote}
                pedidos={pedidosElegibles}
                hoy={hoy}
                accion={crearTanda}
              />
            </div>
          </details>
        </Card>

        <Card titulo={`Del ${fechaBreve(rango.desde)} al ${fechaBreve(rango.hasta)}`}>
          <p className="mb-3 text-sm text-tinta-2">
            {todos.length} movimientos (sin contar ajustes de saldo) · entró{" "}
            <strong className="text-pasto">{pesos(ingresos)}</strong> · salió{" "}
            <strong className="text-atencion-tx">{pesos(egresos)}</strong> · diferencia{" "}
            <strong className="text-tinta">{pesos(ingresos - egresos)}</strong>
          </p>
          {todos.length > lista.length && (
            <p className="mb-3 text-sm text-tinta-2">
              Mostrando los {lista.length} más recientes de {todos.length} del período. Achicá el
              rango de fechas para ver el resto.
            </p>
          )}
          <Tabla
            columnas={[
              { titulo: "Fecha", ancho: "w-[2.9rem] sm:w-auto" },
              { titulo: "Categoría" },
              { titulo: "Persona y monto" },
              { titulo: "Detalle", desde: "sm" },
              { titulo: "Cuenta", desde: "sm" },
              { titulo: "Monto", desde: "sm" },
            ]}
            vacio="No hay movimientos en este período."
          >
            {lista.map((m) => (
              <tr key={m.id}>
                <td className="td whitespace-nowrap text-[11px] sm:text-sm">
                  {/* Sin año: la tarjeta ya dice de qué período es, y con
                      el año la fecha salía cortada ("03/09/2"). */}
                  <span className="sm:hidden">{fechaDM(m.fecha)}</span>
                  <span className="hidden sm:inline">{fechaBreve(m.fecha)}</span>
                </td>
                <td className="td">
                  <span className="td-envuelve block text-[13px] font-semibold leading-tight sm:text-sm">
                    {m.categoria ?? "—"}
                  </span>
                  {m.subcategoria && (
                    <span className="block text-[11px] leading-tight text-tinta-3">
                      {m.subcategoria}
                    </span>
                  )}
                </td>
                <td className="td">
                  <span className="block text-[13px] leading-tight sm:text-sm">
                    {m.persona ?? "—"}
                  </span>
                  {/* El monto viaja acá abajo en el celular: en su
                      propia columna quedaba cortado contra el borde. */}
                  <span
                    className={
                      "block whitespace-nowrap text-[13px] font-bold tabular-nums leading-tight sm:hidden " +
                      (m.tipo === "I" ? "text-pasto" : "text-atencion-tx")
                    }
                  >
                    {m.tipo === "I" ? "+" : "−"} {pesos(Number(m.monto))}
                  </span>
                  {m.metros ? (
                    <span className="block text-[11px] leading-tight text-tinta-3">
                      {numero(m.metros)} m²
                    </span>
                  ) : null}
                </td>
                <td className="td hidden text-tinta-2 sm:table-cell">{m.detalle ?? "—"}</td>
                <td className="td hidden text-tinta-2 sm:table-cell">{m.cuenta ?? "—"}</td>
                <td
                  className={
                    "td hidden whitespace-nowrap tabular-nums font-semibold sm:table-cell " +
                    (m.tipo === "I" ? "text-pasto" : "text-atencion-tx")
                  }
                >
                  {m.tipo === "I" ? "+" : "−"} {pesos(Number(m.monto))}
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

      </div>
    </>
  );
}
