import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import Barras from "@/components/barras";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import {
  fechaBreve,
  fechaLarga,
  hoyISO,
  m2,
  numero,
  dolares,
  dolaresCortos,
  pesos,
  pesosCortos,
  sumarDiasISO,
} from "@/lib/format";
import { Dato } from "@/components/dato";
import { Variacion } from "@/components/variacion";
import { DetalleVenta } from "@/components/detalle-venta";

export const dynamic = "force-dynamic";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];


const mesCorto = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    p?: string;
    desde?: string;
    hasta?: string;
    m?: string;
    ver?: string;
  }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp);

  // La URL del período sin el `ver`: es a donde vuelve el modal al cerrarse,
  // para no perder el filtro que tenías puesto.
  const sinModal = (() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "ver" && v) q.set(k, String(v));
    const cola = q.toString();
    return cola ? `/reportes?${cola}` : "/reportes";
  })();
  const supabase = await createClient();

  // Mirar tres temporadas en pesos no dice nada: $41 millones de 2024 y
  // $11 millones de 2026 no son la misma plata. En dólares sí se
  // comparan. Cada movimiento ya trae su monto_usd; las ventas se pasan
  // con la cotización del mes.
  const enUsd = sp.m === "usd";
  const plata = enUsd ? (n: number) => dolares(n) : (n: number) => pesos(n);
  const plataCorta = enUsd ? (n: number) => dolaresCortos(n) : (n: number) => pesosCortos(n);
  // Los precios por metro son números chicos: en dólares, "US$ 3 / m²"
  // esconde la diferencia entre 2,76 y 3,49. Con dos decimales se lee de
  // verdad. En pesos no hacen falta: ahí el número es de cuatro cifras.
  const plataFina = enUsd ? (n: number) => dolares(n, 2) : (n: number) => pesos(n);

  // Doce meses hacia atras desde hoy, para el costo unitario.
  const desde12 = sumarDiasISO(hoyISO(), -365);

  const [
    { data: porMes },
    { data: margenes },
    { data: pagos },
    { data: cuentas },
    { data: egresos12 },
    { data: ventas12 },
    { data: cotizMes },
    { data: margenesAntes },
    { data: pagosAntes },
  ] = await Promise.all([
      supabase
        .from("v_resumen_mes")
        .select("*")
        .gte("mes", `${rango.desde.slice(0, 7)}-01`)
        .lte("mes", rango.hasta)
        .order("mes"),
      supabase
        .from("v_margen_ventas")
        .select("*")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta)
        .order("fecha", { ascending: false }),
      supabase
        .from("v_movimientos")
        .select("categoria, subcategoria, monto, monto_usd, tipo_plata, fecha")
        .eq("tipo", "E")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta),
      supabase.from("v_cuenta_clientes").select("saldo"),
      supabase
        .from("v_movimientos")
        .select("categoria, monto, monto_usd, tipo_plata")
        .eq("tipo", "E")
        .gte("fecha", desde12)
        .lte("fecha", hoyISO()),
      supabase.from("v_margen_ventas").select("m2").gte("fecha", desde12).lte("fecha", hoyISO()),
      supabase.from("v_cotizacion_mes").select("mes, mep").order("mes"),
      // El mismo tramo una vuelta para atrás: alimenta el comparador de
      // los carteles y nada más, por eso trae solo lo que se compara.
      supabase
        .from("v_margen_ventas")
        .select("m2, facturado, fecha, fecha_entrega")
        .gte("fecha", rango.anterior.desde)
        .lte("fecha", rango.anterior.hasta),
      supabase
        .from("v_movimientos")
        .select("monto, monto_usd, tipo_plata")
        .eq("tipo", "E")
        .gte("fecha", rango.anterior.desde)
        .lte("fecha", rango.anterior.hasta),
    ]);

  // Cotización de cada mes, con el mes anterior más cercano como respaldo
  // para los meses sin ningún movimiento cargado.
  const cotizaciones = ((cotizMes ?? []) as any[]).map((r) => ({
    mes: String(r.mes),
    mep: Number(r.mep),
  }));
  const mepDe = (fecha: string) => {
    if (!cotizaciones.length) return 0;
    const mes = fecha.slice(0, 7);
    let elegida = cotizaciones[0].mep;
    for (const c of cotizaciones) {
      if (c.mes <= mes) elegida = c.mep;
      else break;
    }
    return elegida;
  };
  /** El monto de un movimiento en la moneda elegida. En dólares se usa el
   * monto_usd guardado con la cotización del día: más exacto que el mes. */
  const montoDe = (x: any) => Number((enUsd ? x.monto_usd : x.monto) ?? 0);

  /** Pasa un monto en pesos de esa fecha a la moneda elegida. */
  const conv = (monto: number, fecha: string) => {
    if (!enUsd) return monto;
    const mep = mepDe(fecha);
    return mep > 0 ? monto / mep : 0;
  };

  // Una sola lista manda en todo el panel: las ventas del período que ya
  // están firmes —cosechadas, confirmadas o entregadas—. La cuenta va por
  // entrega, no por cobranza: un pedido entregado y todavía impago ya es
  // plata ganada, y por eso entra en Facturado aunque esté en Por cobrar.
  // Antes Facturado miraba solo las entregadas y m² vendidos miraba las
  // tres, así que el precio promedio dividía la plata de unas por los
  // metros de otras.
  const operaciones = (margenes ?? []) as any[];
  const sinEntregar = operaciones.filter((v) => v.estado !== "entregada");

  const meses = porMes ?? [];
  const serie = (campo: string) =>
    meses.map((r: any) => ({
      label: mesCorto(r.mes),
      valor: campo === "vendido" ? conv(Number(r[campo] ?? 0), r.mes) : Number(r[campo] ?? 0),
    }));
  const sumaM2 = (campo: string) =>
    operaciones.reduce((a: number, v: any) => a + Number(v[campo] ?? 0), 0);

  const vendidos = sumaM2("m2");
  const cosechados = sumaM2("m2_entregados");
  const regalados = sumaM2("m2_cortesia");
  const pctRegalado = cosechados > 0 ? (regalados / cosechados) * 100 : 0;

  // El saldo por cobrar es a hoy, no del período: es plata que te deben ahora.
  // El saldo por cobrar es de hoy, así que va con la cotización de hoy.
  const porCobrar = (cuentas ?? []).reduce(
    (a: number, c: any) => a + Math.max(0, conv(Number(c.saldo ?? 0), hoyISO())),
    0,
  );

  const porCanal = ["directa", "distribuidor"].map((c) => {
    const filas = operaciones.filter((v: any) => v.canal === c);
    return {
      canal: c,
      operaciones: filas.length,
      m2: filas.reduce((a, v: any) => a + Number(v.m2 ?? 0), 0),
      vendido: filas.reduce(
        (a, v: any) => a + conv(Number(v.facturado ?? 0), v.fecha_entrega ?? v.fecha),
        0,
      ),
      margen: filas.reduce(
        (a, v: any) => a + conv(Number(v.margen ?? 0), v.fecha_entrega ?? v.fecha),
        0,
      ),
    };
  });

  // Los egresos se agrupan por la categoría madre, que es como los mirás vos.
  const porCategoria = new Map<string, number>();
  for (const p of pagos ?? []) {
    const k = ((p as any).categoria as string) ?? "Sin categoría";
    porCategoria.set(k, (porCategoria.get(k) ?? 0) + montoDe(p));
  }
  const serieCategorias = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k.slice(0, 14), valor: v }));

  const facturado = operaciones.reduce(
    (a, v: any) => a + conv(Number(v.facturado ?? 0), v.fecha_entrega ?? v.fecha),
    0,
  );

  // Cada rubro dice qué clase de plata mueve (migración 0028). Solo el
  // costo operativo entra en el resultado: plantar el campo o comprar el
  // Tigre son inversión, un dividendo es reparto de la ganancia, y la
  // cobranza de una venta ya está contada en Facturado.
  const egresos = (pagos ?? []) as any[];
  const suman = (xs: any[], tipo: string) =>
    xs.filter((x) => (x.tipo_plata ?? "operativo") === tipo).reduce((a, x) => a + montoDe(x), 0);

  const gastado = suman(egresos, "operativo");
  const invertido = suman(egresos, "inversion");
  const fueraDeCosto = egresos.reduce((a, x) => a + montoDe(x), 0) - gastado;

  const precioProm = vendidos > 0 ? facturado / vendidos : 0;

  // Ojo con el nombre: `m2_cosechados` de la vista son los m² entregados
  // de cada venta, no lo que salió del campo. Mientras la cosecha real se
  // empiece a cargar en serio, el número que sirve es por metro vendido.
  //
  // Y va sobre doce meses fijos, no sobre el filtro: los gastos y las
  // ventas no caen el mismo mes —la mano de obra de julio se paga en
  // septiembre, el pasto que vendés hoy se plantó hace meses— así que en
  // una ventana corta el cociente no mide nada. En septiembre daba
  // $ 11.290 con un solo pago cargado.
  const gastado12 = suman((egresos12 ?? []) as any[], "operativo");
  const m2Doce = ((ventas12 ?? []) as any[]).reduce((a, v) => a + Number(v.m2 ?? 0), 0);
  const costoPorM2 = m2Doce > 0 ? gastado12 / m2Doce : 0;

  // El margen de verdad es lo facturado menos lo que se gastó de verdad
  // en el período. El que trae v_margen_ventas solo descuenta los gastos
  // imputados a cada venta, y casi ninguno lo está: daba 80% cuando el
  // metro cuesta más de lo que se vende.
  const resultado = facturado - gastado;
  const pctMargen = facturado > 0 ? (resultado / facturado) * 100 : 0;
  const ticket = operaciones.length > 0 ? facturado / operaciones.length : 0;

  // Los mismos números del tramo anterior. El facturado se pasa a la
  // moneda elegida con la cotización de su propia fecha, igual que el
  // del período en curso.
  const opsAntes = (margenesAntes ?? []) as any[];
  const vendidosAntes = opsAntes.reduce((a, v) => a + Number(v.m2 ?? 0), 0);
  const facturadoAntes = opsAntes.reduce(
    (a, v) => a + conv(Number(v.facturado ?? 0), v.fecha_entrega ?? v.fecha),
    0,
  );
  const gastadoAntes = suman((pagosAntes ?? []) as any[], "operativo");
  const contra = rango.anterior.etiqueta;

  const mejores = operaciones
    .slice()
    .sort((a: any, b: any) => Number(b.margen ?? 0) - Number(a.margen ?? 0))
    .slice(0, 12);

  return (
    <>
      <PageHeader
        titulo="Reportes"
        bajada={`Del ${fechaLarga(rango.desde)} al ${fechaLarga(rango.hasta)}.`}
        accion={
          <Link href="/reportes/movimientos" className="btn-ghost">
            Ingresos y egresos
          </Link>
        }
      />

      <div className="mb-3">
        <FiltroFechas base="/reportes" activo={sp.p} rango={rango} moneda={enUsd ? "USD" : "ARS"} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="m² vendidos"
          valor={m2(vendidos)}
          destacado
          detalle={
            <Variacion
              actual={vendidos}
              anterior={vendidosAntes}
              formato={(n) => m2(n)}
              contra={contra}
              sobreOscuro
            />
          }
        />
        <Stat
          label="Facturado"
          valor={plata(facturado)}
          tono="verde"
          detalle={
            <Variacion
              actual={facturado}
              anterior={facturadoAntes}
              formato={plata}
              contra={contra}
            />
          }
        />
        <Stat
          label="Resultado"
          valor={plata(resultado)}
          tono={resultado < 0 ? "ambar" : "verde"}
          detalle={
            <Variacion
              actual={resultado}
              anterior={facturadoAntes - gastadoAntes}
              formato={plata}
              contra={contra}
            />
          }
        />
        <Stat
          label="Por cobrar"
          valor={plata(porCobrar)}
          tono={porCobrar > 0 ? "ambar" : "neutro"}
          detalle="Saldo de hoy, no del período"
        />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Precio promedio"
          valor={`${plataFina(precioProm)} / m²`}
          detalle="Lo que sale el metro"
        />
        <Stat
          label="Costo por m² vendido"
          valor={`${plataFina(costoPorM2)} / m²`}
          tono={costoPorM2 > precioProm ? "ambar" : "neutro"}
          detalle={
            costoPorM2 > precioProm
              ? "Últimos 12 meses · más caro de lo que se vende"
              : "Últimos 12 meses"
          }
        />
        <Stat
          label="Costo operativo"
          valor={plata(gastado)}
          detalle={
            <Variacion
              actual={gastado}
              anterior={gastadoAntes}
              formato={plata}
              contra={contra}
              masEsMejor={false}
            />
          }
        />
        <Stat
          label="Invertido"
          valor={plata(invertido)}
          detalle="Plantación, riego y máquinas"
        />
        <Stat
          label="m² regalados"
          valor={m2(regalados)}
          tono={pctRegalado > 5 ? "ambar" : "neutro"}
          detalle={`${numero(pctRegalado, 1)}% de lo cosechado`}
        />
      </div>

      <p className="mt-2.5 text-xs text-tinta-3">
        {operaciones.length} entregas
        {sinEntregar.length > 0 && `, ${sinEntregar.length} sin salir todavía`} · el resultado
        es lo facturado menos el costo operativo, {numero(pctMargen, 1)}% de lo facturado.
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card titulo="m² vendidos por mes">
          <Barras datos={serie("m2_vendidos")} formato={(n) => m2(n)} compacto />
        </Card>

        <Card titulo="m² cosechados por mes">
          <Barras datos={serie("m2_cosechados")} formato={(n) => m2(n)} compacto />
          <p className="mt-3 text-xs text-tinta-3">
            Es todo el pasto que salió del campo, incluyendo lo regalado. La diferencia con el
            gráfico de al lado es lo que entregaste sin cobrar.
          </p>
        </Card>

        <Card titulo="Facturado por mes">
          <Barras datos={serie("vendido")} formato={(n) => plata(n)} compacto />
        </Card>

        <Card titulo="Salidas por categoría">
          <Barras
            datos={serieCategorias}
            formato={(n) => plata(n)}
            destacarUltimo={false}
            compacto
          />
          {fueraDeCosto > 0 && (
            <p className="mt-3 text-xs text-tinta-3">
              Acá está todo lo que salió de la caja. {plata(fueraDeCosto)} de eso no es costo de
              producir —inversión en el campo, dividendos, dólares, aportes y ajustes— así que no
              entra en el resultado ni en el costo por m². Qué es cada rubro se define en Ajustes →
              Datos.
            </p>
          )}
        </Card>

        <div className="lg:col-span-2">
        <Card titulo="Por canal de venta">
          <Tabla
            columnas={[
              { titulo: "Canal" },
              { titulo: "m²", num: true },
              { titulo: "Vendido", num: true },
              { titulo: "Margen", num: true },
            ]}
            vacio="No hay entregas en este período."
          >
            {porCanal
              .filter((c) => c.operaciones > 0)
              .map((c) => (
                <tr key={c.canal}>
                  <td className="td">
                    {/* RP1 - la cantidad de operaciones deja de ser columna
                        y baja debajo del chip. */}
                    <Chip tono={c.canal === "distribuidor" ? "azul" : "verde"}>
                      {c.canal === "distribuidor" ? "Distrib." : "Directa"}
                    </Chip>
                    <span className="mt-0.5 block text-[11px] text-tinta-3">
                      {numero(c.operaciones)} ops
                    </span>
                  </td>
                  <td className="td td-num">{numero(c.m2)}</td>
                  <td className="td td-num whitespace-nowrap font-semibold">
                    {plataCorta(c.vendido)}
                  </td>
                  <td className="td td-num whitespace-nowrap font-semibold text-pasto">
                    {plataCorta(c.margen)}
                  </td>
                </tr>
              ))}
          </Tabla>
          <p className="mt-3 text-sm text-tinta-2">
            <strong>Directa</strong>: se la vendés vos al comprador.{" "}
            <strong>Distribuidores</strong>: la trae un tercero que revende.
          </p>
        </Card>

        </div>

        <div className="lg:col-span-2">
        <Card titulo="Las operaciones que más dejaron" id="mejores">
          {/* RP5 a RP8 - cuatro columnas: el canal baja debajo del
              comprador, los m\u00b2 debajo de lo vendido y los gastos salen. */}
          <Tabla
            columnas={[
              { titulo: "Entrega" },
              { titulo: "Comprador" },
              { titulo: "Vendido", num: true },
              { titulo: "Margen", num: true },
            ]}
            vacio="No hay entregas en este período."
          >
            {mejores.map((v: any) => {
              const vendido = Number(v.facturado ?? 0);
              const margen = Number(v.margen ?? 0);
              const pct = vendido > 0 ? (margen / vendido) * 100 : 0;
              return (
                <tr key={v.venta_id} className="transition hover:bg-crema">
                  <td className="td whitespace-nowrap p-0">
                    <Link
                      href={`${sinModal}${sinModal.includes("?") ? "&" : "?"}ver=${v.venta_id}`}
                      scroll={false}
                      className="block px-2 py-2 sm:px-2.5 sm:py-1.5"
                      title="Ver el detalle de esta operación"
                    >
                    <Dato
                      principal={fechaBreve(v.fecha_entrega)}
                      secundario={v.estado !== "entregada" ? "sin salir" : undefined}
                      tonoSecundario="text-atencion-tx"
                    />
                    </Link>
                  </td>
                  <td className="td max-w-0 font-semibold sm:max-w-none">
                    <Dato
                      principal={<span className="block truncate">{v.comprador}</span>}
                      secundario={v.canal === "distribuidor" ? "distribuidor" : "directa"}
                    />
                  </td>
                  <td className="td td-num font-semibold">
                    <Dato
                      principal={plataCorta(vendido)}
                      secundario={`${numero(Number(v.m2))} m\u00b2`}
                    />
                  </td>
                  <td className="td td-num font-semibold text-pasto">
                    <Dato
                      principal={plataCorta(margen)}
                      secundario={`${numero(pct)}%`}
                    />
                  </td>
                </tr>
              );
            })}
          </Tabla>
        </Card>
        </div>
      </div>

      {sp.ver && <DetalleVenta ventaId={sp.ver} cerrar={sinModal} />}
    </>
  );
}
