import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import Barras from "@/components/barras";
import { borrarCobro, borrarPago, crearCobro, crearPago } from "@/lib/actions";
import { fechaLarga, hoyISO, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const MEDIOS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "cheque", label: "Cheque" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "otro", label: "Otro" },
];

const CATEGORIAS = [
  { value: "fertilizante", label: "Fertilizante" },
  { value: "insumos", label: "Insumos" },
  { value: "combustible", label: "Combustible" },
  { value: "mano_de_obra", label: "Mano de obra" },
  { value: "maquinaria", label: "Maquinaria" },
  { value: "flete", label: "Flete" },
  { value: "servicios", label: "Servicios" },
  { value: "impuestos", label: "Impuestos" },
  { value: "otro", label: "Otro" },
];

export default async function AdministracionPage() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const inicioAnio = `${hoy.slice(0, 4)}-01-01`;

  const [
    { data: clientes },
    { data: lotes },
    { data: ventasAbiertas },
    { data: cobros },
    { data: pagos },
    { data: cuentas },
  ] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("ventas")
      .select("id, fecha, total, m2, clientes(nombre)")
      .neq("estado", "anulada")
      .order("fecha", { ascending: false })
      .limit(50),
    supabase
      .from("cobros")
      .select("*, clientes(nombre), ventas(fecha, m2)")
      .gte("fecha", inicioAnio)
      .order("fecha", { ascending: false })
      .limit(80),
    supabase.from("pagos").select("*, lotes(nombre)").gte("fecha", inicioAnio).order("fecha", { ascending: false }).limit(80),
    supabase.from("v_cuenta_clientes").select("*").order("saldo", { ascending: false }),
  ]);

  const cobradoMes = (cobros ?? [])
    .filter((c: any) => c.fecha >= inicioMes)
    .reduce((a: number, c: any) => a + Number(c.monto ?? 0), 0);
  const pagadoMes = (pagos ?? [])
    .filter((p: any) => p.fecha >= inicioMes)
    .reduce((a: number, p: any) => a + Number(p.monto ?? 0), 0);
  const cobradoAnio = (cobros ?? []).reduce((a: number, c: any) => a + Number(c.monto ?? 0), 0);
  const pagadoAnio = (pagos ?? []).reduce((a: number, p: any) => a + Number(p.monto ?? 0), 0);
  const porCobrar = (cuentas ?? []).reduce(
    (a: number, c: any) => a + Math.max(0, Number(c.saldo ?? 0)),
    0,
  );

  const porCategoria = new Map<string, number>();
  for (const p of pagos ?? []) {
    const k = (p as any).categoria as string;
    porCategoria.set(k, (porCategoria.get(k) ?? 0) + Number((p as any).monto ?? 0));
  }
  const serieCategorias = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      label: CATEGORIAS.find((c) => c.value === k)?.label.slice(0, 12) ?? k,
      valor: v,
    }));

  const deudores = (cuentas ?? []).filter((c: any) => Number(c.saldo ?? 0) > 0);

  return (
    <>
      <PageHeader
        titulo="Administración"
        bajada="Cobros, pagos y saldo de cada cliente. La caja del campo."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cobrado del mes" valor={pesos(cobradoMes)} tono="verde" />
        <Stat label="Pagado del mes" valor={pesos(pagadoMes)} tono="ambar" />
        <Stat
          label={`Resultado de caja ${hoy.slice(0, 4)}`}
          valor={pesos(cobradoAnio - pagadoAnio)}
          detalle={`Cobros ${pesos(cobradoAnio)} · Pagos ${pesos(pagadoAnio)}`}
        />
        <Stat label="Por cobrar" valor={pesos(porCobrar)} detalle={`${deudores.length} clientes con saldo`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card titulo="Registrar cobro">
          <form action={crearCobro} className="grid grid-cols-2 gap-3">
            <Selector
              label="Cliente"
              name="cliente_id"
              required
              vacio="Elegí un cliente"
              opciones={(clientes ?? []).map((c: any) => ({ value: c.id, label: c.nombre }))}
              className="col-span-2"
            />
            <Selector
              label="Venta (opcional)"
              name="venta_id"
              vacio="Sin imputar"
              opciones={(ventasAbiertas ?? []).map((v: any) => ({
                value: v.id,
                label: `${fechaLarga(v.fecha)} · ${v.clientes?.nombre} · ${pesos(Number(v.total))}`,
              }))}
              className="col-span-2"
            />
            <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
            <Campo label="Monto" name="monto" type="number" required placeholder="0" />
            <Selector label="Medio" name="medio" defaultValue="transferencia" opciones={MEDIOS} />
            <Nota className="col-span-2" />
            <div className="col-span-2">
              <button className="btn">Guardar cobro</button>
            </div>
          </form>
        </Card>

        <Card titulo="Registrar pago">
          <form action={crearPago} className="grid grid-cols-2 gap-3">
            <Campo label="Proveedor / concepto" name="proveedor" className="col-span-2" />
            <Selector label="Categoría" name="categoria" defaultValue="insumos" opciones={CATEGORIAS} />
            <Selector
              label="Lote (opcional)"
              name="lote_id"
              vacio="General"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
            />
            <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
            <Campo label="Monto" name="monto" type="number" required placeholder="0" />
            <Selector label="Medio" name="medio" defaultValue="transferencia" opciones={MEDIOS} />
            <Nota className="col-span-2" />
            <div className="col-span-2">
              <button className="btn">Guardar pago</button>
            </div>
          </form>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        <Card titulo="Saldos por cliente">
          <Tabla cabeceras={["Cliente", "Vendido", "Cobrado", "Saldo"]} vacio="Sin movimientos.">
            {(cuentas ?? [])
              .filter((c: any) => Number(c.total_vendido ?? 0) !== 0 || Number(c.total_cobrado ?? 0) !== 0)
              .map((c: any) => {
                const saldo = Number(c.saldo ?? 0);
                return (
                  <tr key={c.cliente_id}>
                    <td className="td font-medium">{c.nombre}</td>
                    <td className="td tabular-nums">{pesos(Number(c.total_vendido ?? 0))}</td>
                    <td className="td tabular-nums">{pesos(Number(c.total_cobrado ?? 0))}</td>
                    <td
                      className={
                        "td tabular-nums font-semibold " +
                        (saldo > 0 ? "text-amber-700" : saldo < 0 ? "text-blue-700" : "")
                      }
                    >
                      {pesos(saldo)}
                    </td>
                  </tr>
                );
              })}
          </Tabla>
        </Card>

        <Card titulo={`Pagos por categoría ${hoy.slice(0, 4)}`}>
          <Barras datos={serieCategorias} formato={(n) => pesos(n)} />
        </Card>

        <Card titulo="Cobros">
          <Tabla cabeceras={["Fecha", "Cliente", "Monto", "Medio", "Imputado a", ""]} vacio="Sin cobros cargados.">
            {(cobros ?? []).map((c: any) => (
              <tr key={c.id}>
                <td className="td whitespace-nowrap">{fechaLarga(c.fecha)}</td>
                <td className="td font-medium">{c.clientes?.nombre}</td>
                <td className="td tabular-nums font-semibold text-hoja-700">{pesos(Number(c.monto))}</td>
                <td className="td">
                  <Chip>{c.medio}</Chip>
                </td>
                <td className="td text-xs text-tierra-600">
                  {c.ventas ? `Venta ${fechaLarga(c.ventas.fecha)} · ${numero(c.ventas.m2)} m²` : "—"}
                </td>
                <td className="td text-right">
                  <form action={borrarCobro}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Pagos">
          <Tabla cabeceras={["Fecha", "Proveedor", "Categoría", "Lote", "Monto", "Medio", ""]} vacio="Sin pagos cargados.">
            {(pagos ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className="td whitespace-nowrap">{fechaLarga(p.fecha)}</td>
                <td className="td font-medium">{p.proveedor ?? "—"}</td>
                <td className="td">
                  <Chip tono="ambar">
                    {CATEGORIAS.find((c) => c.value === p.categoria)?.label ?? p.categoria}
                  </Chip>
                </td>
                <td className="td text-xs text-tierra-600">{p.lotes?.nombre ?? "General"}</td>
                <td className="td tabular-nums font-semibold">{pesos(Number(p.monto))}</td>
                <td className="td text-xs text-tierra-600">{p.medio}</td>
                <td className="td text-right">
                  <form action={borrarPago}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
