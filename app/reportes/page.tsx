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
  pesos,
  pesosCortos,
  sumarDiasISO,
} from "@/lib/format";
import { Dato } from "@/components/dato";

export const dynamic = "force-dynamic";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];


const mesCorto = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp);
  const supabase = await createClient();

  // Doce meses hacia atras desde hoy, para el costo unitario.
  const desde12 = sumarDiasISO(hoyISO(), -365);

  const [
    { data: porMes },
    { data: margenes },
    { data: pagos },
    { data: cuentas },
    { data: egresos12 },
    { data: meses12 },
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
        .select("categoria, subcategoria, monto, tipo_plata")
        .eq("tipo", "E")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta),
      supabase.from("v_cuenta_clientes").select("saldo"),
      supabase
        .from("v_movimientos")
        .select("categoria, monto, tipo_plata")
        .eq("tipo", "E")
        .gte("fecha", desde12),
      supabase.from("v_resumen_mes").select("m2_cosechados").gte("mes", desde12.slice(0, 7) + "-01"),
    ]);

  const meses = porMes ?? [];
  const serie = (campo: string) =>
    meses.map((r: any) => ({ label: mesCorto(r.mes), valor: Number(r[campo] ?? 0) }));
  const suma = (campo: string) =>
    meses.reduce((a: number, r: any) => a + Number(r[campo] ?? 0), 0);

  const vendidos = suma("m2_vendidos");
  const cosechados = suma("m2_cosechados");
  const regalados = suma("m2_regalados");
  const pctRegalado = cosechados > 0 ? (regalados / cosechados) * 100 : 0;

  const entregadas = (margenes ?? []).filter((v: any) => v.estado === "entregada");
  const margenTotal = entregadas.reduce((a, v: any) => a + Number(v.margen ?? 0), 0);

  // El saldo por cobrar es a hoy, no del período: es plata que te deben ahora.
  const porCobrar = (cuentas ?? []).reduce(
    (a: number, c: any) => a + Math.max(0, Number(c.saldo ?? 0)),
    0,
  );

  const porCanal = ["directa", "distribuidor"].map((c) => {
    const filas = entregadas.filter((v: any) => v.canal === c);
    return {
      canal: c,
      operaciones: filas.length,
      m2: filas.reduce((a, v: any) => a + Number(v.m2 ?? 0), 0),
      vendido: filas.reduce((a, v: any) => a + Number(v.facturado ?? 0), 0),
      margen: filas.reduce((a, v: any) => a + Number(v.margen ?? 0), 0),
    };
  });

  // Los egresos se agrupan por la categoría madre, que es como los mirás vos.
  const porCategoria = new Map<string, number>();
  for (const p of pagos ?? []) {
    const k = ((p as any).categoria as string) ?? "Sin categoría";
    porCategoria.set(k, (porCategoria.get(k) ?? 0) + Number((p as any).monto ?? 0));
  }
  const serieCategorias = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k.slice(0, 14), valor: v }));

  const facturado = entregadas.reduce((a, v: any) => a + Number(v.facturado ?? 0), 0);

  // Cada rubro dice qué clase de plata mueve (migración 0028). Solo el
  // costo operativo entra en el resultado: plantar el campo o comprar el
  // Tigre son inversión, un dividendo es reparto de la ganancia, y la
  // cobranza de una venta ya está contada en Facturado.
  const egresos = (pagos ?? []) as any[];
  const suman = (xs: any[], tipo: string) =>
    xs.filter((x) => (x.tipo_plata ?? "operativo") === tipo).reduce((a, x) => a + Number(x.monto ?? 0), 0);

  const gastado = suman(egresos, "operativo");
  const invertido = suman(egresos, "inversion");
  const fueraDeCosto = egresos.length
    ? egresos.reduce((a, x) => a + Number(x.monto ?? 0), 0) - gastado
    : 0;

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
  const m2Doce = ((meses12 ?? []) as any[]).reduce(
    (a, r) => a + Number(r.m2_cosechados ?? 0),
    0,
  );
  const costoPorM2 = m2Doce > 0 ? gastado12 / m2Doce : 0;

  // El margen de verdad es lo facturado menos lo que se gastó de verdad
  // en el período. El que trae v_margen_ventas solo descuenta los gastos
  // imputados a cada venta, y casi ninguno lo está: daba 80% cuando el
  // metro cuesta más de lo que se vende.
  const resultado = facturado - gastado;
  const pctMargen = facturado > 0 ? (resultado / facturado) * 100 : 0;
  const ticket = entregadas.length > 0 ? facturado / entregadas.length : 0;

  const mejores = entregadas
    .slice()
    .sort((a: any, b: any) => Number(b.margen ?? 0) - Number(a.margen ?? 0))
    .slice(0, 12);

  return (
    <>
      <PageHeader
        titulo="Reportes"
        bajada={`Del ${fechaLarga(rango.desde)} al ${fechaLarga(rango.hasta)}.`}
      />

      <div className="mb-3">
        <FiltroFechas base="/reportes" activo={sp.p} rango={rango} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="m² vendidos" valor={m2(vendidos)} destacado />
        <Stat label="Facturado" valor={pesos(facturado)} tono="verde" detalle={`${entregadas.length} operaciones`} />
        <Stat
          label="Resultado"
          valor={pesos(resultado)}
          tono={resultado < 0 ? "ambar" : "verde"}
          detalle={`Facturado menos gastos · ${numero(pctMargen, 1)}%`}
        />
        <Stat
          label="Por cobrar"
          valor={pesos(porCobrar)}
          tono={porCobrar > 0 ? "ambar" : "neutro"}
          detalle="Saldo de hoy, no del período"
        />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Precio promedio"
          valor={`${pesos(precioProm)} / m²`}
          detalle="Lo que sale el metro"
        />
        <Stat
          label="Costo por m² vendido"
          valor={`${pesos(costoPorM2)} / m²`}
          tono={costoPorM2 > precioProm ? "ambar" : "neutro"}
          detalle={
            costoPorM2 > precioProm
              ? "Últimos 12 meses · más caro de lo que se vende"
              : "Últimos 12 meses"
          }
        />
        <Stat label="Costo operativo" valor={pesos(gastado)} detalle="Producir y vender" />
        <Stat
          label="Invertido"
          valor={pesos(invertido)}
          detalle="Plantación, riego y máquinas"
        />
        <Stat
          label="m² regalados"
          valor={m2(regalados)}
          tono={pctRegalado > 5 ? "ambar" : "neutro"}
          detalle={`${numero(pctRegalado, 1)}% de lo cosechado`}
        />
      </div>

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
          <Barras datos={serie("vendido")} formato={(n) => pesos(n)} compacto />
        </Card>

        <Card titulo="Salidas por categoría">
          <Barras
            datos={serieCategorias}
            formato={(n) => pesos(n)}
            destacarUltimo={false}
            compacto
          />
          {fueraDeCosto > 0 && (
            <p className="mt-3 text-xs text-tinta-3">
              Acá está todo lo que salió de la caja. {pesos(fueraDeCosto)} de eso no es costo de
              producir —inversión en el campo, dividendos, dólares, aportes y ajustes— así que no
              entra en el resultado ni en el costo por m². Qué es cada rubro se define en Ajustes →
              Datos.
            </p>
          )}
        </Card>

        <div className="lg:col-span-2">
        <Card titulo="Por canal de venta">
          <Tabla
            cabeceras={["Canal", "m\u00b2", "Vendido", "Margen"]}
            vacio="No hay entregas confirmadas en este período."
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
                  <td className="td tabular-nums">{numero(c.m2)}</td>
                  <td className="td whitespace-nowrap tabular-nums font-semibold">
                    {pesosCortos(c.vendido)}
                  </td>
                  <td className="td whitespace-nowrap tabular-nums font-semibold text-pasto">
                    {pesosCortos(c.margen)}
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
            cabeceras={["Entrega", "Comprador", "Vendido", "Margen"]}
            vacio="No hay entregas confirmadas en este período."
          >
            {mejores.map((v: any) => {
              const vendido = Number(v.facturado ?? 0);
              const margen = Number(v.margen ?? 0);
              const pct = vendido > 0 ? (margen / vendido) * 100 : 0;
              return (
                <tr key={v.venta_id}>
                  <td className="td whitespace-nowrap">{fechaBreve(v.fecha_entrega)}</td>
                  <td className="td max-w-0 font-semibold">
                    <Dato
                      principal={<span className="block truncate">{v.comprador}</span>}
                      secundario={v.canal === "distribuidor" ? "distribuidor" : "directa"}
                    />
                  </td>
                  <td className="td tabular-nums font-semibold">
                    <Dato
                      principal={pesosCortos(vendido)}
                      secundario={`${numero(Number(v.m2))} m\u00b2`}
                    />
                  </td>
                  <td className="td tabular-nums font-semibold text-pasto">
                    <Dato
                      principal={pesosCortos(margen)}
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
    </>
  );
}
