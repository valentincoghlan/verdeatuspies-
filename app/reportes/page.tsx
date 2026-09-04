import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import Barras from "@/components/barras";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import { fechaBreve, fechaLarga, m2, numero, pesos } from "@/lib/format";

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

  const [{ data: porMes }, { data: margenes }, { data: pagos }, { data: cuentas }] =
    await Promise.all([
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
        .select("categoria, subcategoria, monto")
        .eq("tipo", "E")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta),
      supabase.from("v_cuenta_clientes").select("saldo"),
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

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        <Stat label="m² vendidos" valor={m2(vendidos)} destacado />
        <Stat label="m² cosechados" valor={m2(cosechados)} detalle="Todo lo que salió del campo" />
        <Stat
          label="m² regalados"
          valor={m2(regalados)}
          tono={pctRegalado > 5 ? "ambar" : "neutro"}
          detalle={`${numero(pctRegalado, 1)}% de lo cosechado`}
        />
        <Stat label="Margen" valor={pesos(margenTotal)} detalle="Vendido menos gastos" />
        <Stat
          label="Por cobrar"
          valor={pesos(porCobrar)}
          tono={porCobrar > 0 ? "ambar" : "neutro"}
          detalle="Saldo de hoy, no del período"
        />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Vendido vs. cosechado, por mes">
          <p className="mb-4 text-[15px] leading-relaxed text-tinta-2">
            <strong>Vendido</strong> son los m² que cobraste. <strong>Cosechado</strong> es todo el
            pasto que salió del campo, incluyendo lo que regalaste. La diferencia entre las dos
            barras del mismo mes es lo que entregaste sin cobrar.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[.10em] text-tinta-3">
                Vendidos
              </p>
              <Barras datos={serie("m2_vendidos")} formato={(n) => m2(n)} />
            </div>
            <div>
              <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[.10em] text-tinta-3">
                Cosechados
              </p>
              <Barras datos={serie("m2_cosechados")} formato={(n) => m2(n)} />
            </div>
          </div>
        </Card>

        <Card titulo="Vendido por mes, en pesos">
          <Barras datos={serie("vendido")} formato={(n) => pesos(n)} />
        </Card>

        <Card titulo="Por canal de venta">
          <Tabla
            cabeceras={["Canal", "Operaciones", "m² vendidos", "Vendido", "Margen"]}
            vacio="No hay entregas confirmadas en este período."
          >
            {porCanal
              .filter((c) => c.operaciones > 0)
              .map((c) => (
                <tr key={c.canal}>
                  <td className="td">
                    <Chip tono={c.canal === "distribuidor" ? "azul" : "verde"}>
                      {c.canal === "distribuidor" ? "Distribuidores" : "Directa"}
                    </Chip>
                  </td>
                  <td className="td tabular-nums">{numero(c.operaciones)}</td>
                  <td className="td tabular-nums">{numero(c.m2)}</td>
                  <td className="td tabular-nums font-semibold">{pesos(c.vendido)}</td>
                  <td className="td tabular-nums font-semibold text-pasto">{pesos(c.margen)}</td>
                </tr>
              ))}
          </Tabla>
          <p className="mt-3 text-sm text-tinta-2">
            <strong>Directa</strong>: se la vendés vos al comprador.{" "}
            <strong>Distribuidores</strong>: la trae un tercero que revende.
          </p>
        </Card>

        <Card titulo="Pagos por categoría">
          <Barras
            datos={serieCategorias}
            formato={(n) => pesos(n)}
            destacarUltimo={false}
            vacio="No hay pagos cargados en este período."
          />
        </Card>

        <Card titulo="Las operaciones que más dejaron">
          <Tabla
            cabeceras={["Entrega", "Comprador", "Canal", "m²", "Vendido", "Gastos", "Margen"]}
            vacio="No hay entregas confirmadas en este período."
          >
            {mejores.map((v: any) => {
              const vendido = Number(v.facturado ?? 0);
              const margen = Number(v.margen ?? 0);
              const pct = vendido > 0 ? (margen / vendido) * 100 : 0;
              return (
                <tr key={v.venta_id}>
                  <td className="td whitespace-nowrap">{fechaBreve(v.fecha_entrega)}</td>
                  <td className="td font-semibold">{v.comprador}</td>
                  <td className="td">
                    <Chip tono={v.canal === "distribuidor" ? "azul" : "verde"}>
                      {v.canal === "distribuidor" ? "Distribuidores" : "Directa"}
                    </Chip>
                  </td>
                  <td className="td tabular-nums">{numero(Number(v.m2))}</td>
                  <td className="td tabular-nums font-semibold">{pesos(vendido)}</td>
                  <td className="td tabular-nums text-atencion-tx">
                    {Number(v.gastos) > 0 ? pesos(Number(v.gastos)) : "—"}
                  </td>
                  <td className="td tabular-nums font-semibold text-pasto">
                    {pesos(margen)}
                    <span className="ml-1 text-xs font-normal text-tinta-3">{numero(pct)}%</span>
                  </td>
                </tr>
              );
            })}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
