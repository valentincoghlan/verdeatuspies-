import { createClient } from "@/lib/supabase/server";
import { Card, CardPlegable, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Opciones, Selector } from "@/components/campos";
import { Elegir } from "@/components/elegir";
import { CuentaYMonto } from "@/components/plata";
import { QuePaso } from "@/components/que-paso";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import {
  aplicarFiltros,
  BuscadorMovimientos,
  leerFiltros,
} from "@/components/buscador-movimientos";
import { Tanda } from "@/components/tanda";
import { FechaDeCarga, ProveedorCarga } from "@/components/carga";
import { PedidosDeCarga } from "@/components/pedidos-de-carga";
import { crearMovimiento, crearPersona, crearTanda } from "@/lib/actions";
import { esAdmin } from "@/lib/rol";
import { fechaBreve, fechaDM, hoyISO, numero, pesos } from "@/lib/format";
import { Formulario, Guardar } from "@/components/guardar";

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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp);
  const filtros = leerFiltros(sp);
  const supabase = await createClient();
  const hoy = hoyISO();

  const [
    { data: cuentas },
    { data: categorias },
    { data: personas },
    { data: lotes },
    { data: ventas },
    { data: senados },
    { data: conSaldo },
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
    // Los pedidos recientes, salga de donde salga la plata.
    //
    // Va contra `ventas` y no contra v_margen_ventas porque esa vista
    // deja afuera los que todavía están en estado "pedido", y un pedido
    // sin confirmar igual se cosecha: la mano de obra de ese día es
    // suya aunque la venta no esté cerrada.
    supabase
      .from("ventas")
      .select("id, m2, total, fecha, fecha_entrega, estado, clientes!cliente_id(nombre)")
      // Sin piso de fecha: la lista corta la arma la pantalla —de entrada
      // muestra la semana— pero "Buscar en todas" tiene que poder llegar
      // a una cosecha vieja.
      .order("fecha_entrega", { ascending: false, nullsFirst: false })
      .limit(200),
    // Lo ya cobrado de los pedidos que todavía no llegaron al margen.
    // Una seña entra antes de cosechar, así que esos pedidos también
    // tienen saldo y también se les puede seguir cobrando.
    supabase.from("v_pedidos_pendientes").select("id, total, senado"),
    // Y las que deben plata, sin límite de fecha: a esas se les cobra
    // hasta que queden en cero, tengan la antigüedad que tengan.
    supabase
      .from("v_margen_ventas")
      .select("venta_id, comprador, fecha, fecha_entrega, m2, pendiente")
      .gt("pendiente", 0)
      .order("fecha_entrega", { ascending: false, nullsFirst: false })
      .limit(120),
    // De qué día es la cosecha que abasteció cada pedido: la ventana de
    // cinco días de un gasto se mide contra eso, no contra la venta.
    supabase
      .from("cosecha_ventas")
      .select("venta_id, cosechas(fecha)"),
    aplicarFiltros(
      supabase
        .from("v_movimientos")
        .select("*")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta)
        .order("fecha", { ascending: false })
        .limit(300),
      filtros,
    ),
    // Los totales se calculan sobre TODO el período, no sobre las 300 filas
    // que se muestran en la tabla.
    aplicarFiltros(
      supabase
        .from("v_movimientos")
        // `monto` está siempre en pesos, sin importar en qué moneda se
        // escribió: por eso se suman todos. Los ajustes de saldo quedan
        // afuera: corrigen un arrastre, no son plata que se movió.
        .select("tipo, monto")
        .neq("categoria", "Ajustes")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta),
      filtros,
    ),
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
  // Solo los rubros padre: es como se ve en la columna "Categoría".
  const nombresCategoria = rubros.map((r) => r.nombre);
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
  // Se juntan las dos consultas porque casi no se pisan: las recientes
  // pueden estar cobradas y las que deben pueden ser viejísimas.
  // Lo que le falta cobrar a un pedido que todavía no pasó por el
  // margen: lo facturado menos lo que ya entró como seña.
  const faltaDelPedido = new Map<string, number>();
  for (const p of (senados ?? []) as any[]) {
    faltaDelPedido.set(p.id, Number(p.total ?? 0) - Number(p.senado ?? 0));
  }

  const porId = new Map<string, any>();
  for (const v of (ventas ?? []) as any[]) {
    porId.set(v.id, {
      id: v.id as string,
      comprador: ((v.clientes as any)?.nombre ?? "Sin comprador") as string,
      m2: Number(v.m2 ?? 0),
      pendiente: Math.max(0, faltaDelPedido.get(v.id) ?? 0),
      fechaCosecha: cosechaDe.get(v.id) ?? null,
      fecha: (v.fecha_entrega ?? v.fecha) as string,
    });
  }
  for (const v of (conSaldo ?? []) as any[]) {
    const ya = porId.get(v.venta_id);
    if (ya) {
      ya.pendiente = Number(v.pendiente ?? 0);
      continue;
    }
    porId.set(v.venta_id, {
      id: v.venta_id as string,
      comprador: (v.comprador ?? "Sin comprador") as string,
      m2: Number(v.m2 ?? 0),
      pendiente: Number(v.pendiente ?? 0),
      fechaCosecha: cosechaDe.get(v.venta_id) ?? null,
      fecha: (v.fecha_entrega ?? v.fecha) as string,
    });
  }
  const pedidosElegibles = [...porId.values()];

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

        {/* Los dos formularios arrancan cerrados: ocupan media pantalla
            y no se usan cada vez que entrás. Lo primero que se ve es lo
            que ya está cargado. */}
        <CardPlegable
          titulo="Cargar un movimiento"
          bajada="Una entrada o una salida"
        >
          {/* Envuelve el formulario porque dos campos se miran entre sí:
              a qué pedidos se puede imputar depende de si entra o sale
              plata y de qué día es. */}
          <ProveedorCarga hoy={hoy}>
          <Formulario
            id="cargar"
            action={crearMovimiento}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
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
              <Guardar className="btn btn-alto sm:w-auto">Guardar movimiento</Guardar>
            </div>
          </Formulario>
          </ProveedorCarga>
        </CardPlegable>

        {/* El día de cosecha no es un movimiento: son cinco pagos que van
            a tres pedidos. */}
        <CardPlegable
          titulo="Cargar varios juntos"
          bajada="Un día de cosecha: varios pagos entre varios pedidos"
        >
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
        </CardPlegable>

        <Card titulo={`Del ${fechaBreve(rango.desde)} al ${fechaBreve(rango.hasta)}`}>
          <BuscadorMovimientos
            base="/administracion"
            filtros={filtros}
            periodo={sp.desde || sp.hasta ? undefined : (sp.p ?? "mes")}
            rango={rango}
            categorias={nombresCategoria}
            cuentas={opcionesCuenta.map((c) => c.nombre)}
            cuantos={todos.length}
          />
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
              // 2,9rem son 46px y de esos 16 se los come el padding:
              // "14/09" no entraba por un pelo y salía "14/...".
              { titulo: "Fecha", ancho: "w-[3.6rem] sm:w-auto" },
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
                <td className="td whitespace-nowrap px-1.5 text-[11px] sm:px-3 sm:text-sm">
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
