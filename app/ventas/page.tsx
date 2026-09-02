import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import Barras from "@/components/barras";
import { borrarVenta, cambiarEstadoVenta, crearVenta } from "@/lib/actions";
import { fechaCorta, fechaLarga, hoyISO, m2, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const ESTADOS = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "confirmada", label: "Confirmada" },
  { value: "entregada", label: "Entregada" },
  { value: "anulada", label: "Anulada" },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function VentasPage() {
  const supabase = await createClient();
  const hoy = hoyISO();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [{ data: clientes }, { data: lotes }, { data: ventas }, { data: porMes }, { data: config }] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("ventas")
        .select("*, clientes(nombre), lotes(nombre)")
        .order("fecha", { ascending: false })
        .limit(80),
      supabase.from("v_ventas_por_mes").select("*").order("mes", { ascending: false }).limit(12),
      supabase.from("config").select("valor").eq("clave", "precio_m2_default").single(),
    ]);

  const activas = (ventas ?? []).filter((v: any) => v.estado !== "anulada");
  const delMes = activas.filter((v: any) => v.fecha >= inicioMes);
  const m2Mes = delMes.reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const totalMes = delMes.reduce((a, v: any) => a + Number(v.total ?? 0), 0);
  const m2Anio = activas
    .filter((v: any) => v.fecha.startsWith(hoy.slice(0, 4)))
    .reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const precioProm = m2Mes > 0 ? totalMes / m2Mes : 0;
  const precioDefault = Number(config?.valor ?? 0) || undefined;

  const serie = (porMes ?? [])
    .slice()
    .reverse()
    .map((r: any) => ({
      label: `${MESES[Number(r.mes.slice(5, 7)) - 1]} ${r.mes.slice(2, 4)}`,
      valor: Number(r.m2 ?? 0),
    }));

  const tonoEstado = (e: string) =>
    e === "entregada" ? "verde" : e === "confirmada" ? "azul" : e === "anulada" ? "rojo" : "neutro";

  return (
    <>
      <PageHeader
        titulo="Ventas"
        bajada="m² vendidos por cliente y por fecha, con estado de cada operación."
        accion={
          <Link href="/ventas/clientes" className="btn-ghost">
            Clientes
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="m² del mes" valor={m2(m2Mes)} tono="verde" detalle={`${delMes.length} operaciones`} />
        <Stat label="Facturado del mes" valor={pesos(totalMes)} />
        <Stat label="Precio promedio m²" valor={pesos(precioProm, 0)} />
        <Stat label={`m² ${hoy.slice(0, 4)}`} valor={m2(m2Anio)} />
      </div>

      <div className="mt-4 space-y-4">
        <Card titulo="Nueva venta">
          <form action={crearVenta} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Selector
              label="Cliente"
              name="cliente_id"
              required
              vacio="Elegí un cliente"
              opciones={(clientes ?? []).map((c: any) => ({ value: c.id, label: c.nombre }))}
              className="col-span-2"
            />
            <Campo label="Fecha" name="fecha" type="date" required defaultValue={hoy} />
            <Selector
              label="Estado"
              name="estado"
              defaultValue="confirmada"
              opciones={ESTADOS.filter((e) => e.value !== "anulada")}
            />
            <Campo label="m²" name="m2" type="number" step="0.5" required placeholder="250" />
            <Campo
              label="Precio por m²"
              name="precio_m2"
              type="number"
              required
              defaultValue={precioDefault}
            />
            <Campo label="Flete" name="flete" type="number" defaultValue={0} />
            <Selector
              label="Lote de origen"
              name="lote_id"
              vacio="Sin definir"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
            />
            <Campo label="Fecha de entrega" name="fecha_entrega" type="date" />
            <Nota className="col-span-2 sm:col-span-3" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Guardar venta</button>
            </div>
          </form>
          {(clientes ?? []).length === 0 && (
            <p className="mt-3 text-xs text-amber-700">
              Primero cargá un cliente en{" "}
              <Link href="/ventas/clientes" className="font-semibold underline">
                Clientes
              </Link>
              .
            </p>
          )}
        </Card>

        <Card titulo="m² vendidos por mes">
          <Barras datos={serie} formato={(n) => m2(n)} />
        </Card>

        <Card titulo="Operaciones">
          <Tabla
            cabeceras={["Fecha", "Cliente", "m²", "$/m²", "Total", "Lote", "Estado", "Acciones"]}
            vacio="Todavía no cargaste ventas."
          >
            {(ventas ?? []).map((v: any) => (
              <tr key={v.id}>
                <td className="td whitespace-nowrap">{fechaLarga(v.fecha)}</td>
                <td className="td font-medium">{v.clientes?.nombre}</td>
                <td className="td tabular-nums">{numero(v.m2)}</td>
                <td className="td tabular-nums">{pesos(Number(v.precio_m2))}</td>
                <td className="td tabular-nums font-semibold">{pesos(Number(v.total))}</td>
                <td className="td text-xs text-tierra-600">{v.lotes?.nombre ?? "—"}</td>
                <td className="td">
                  <Chip tono={tonoEstado(v.estado) as any}>{v.estado}</Chip>
                  {v.fecha_entrega && (
                    <span className="ml-1 text-xs text-tierra-400">
                      {fechaCorta(v.fecha_entrega)}
                    </span>
                  )}
                </td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <form action={cambiarEstadoVenta} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={v.id} />
                      <select name="estado" defaultValue={v.estado} className="input w-32 py-1">
                        {ESTADOS.map((e) => (
                          <option key={e.value} value={e.value}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                      <button className="text-xs font-semibold text-hoja-700 hover:underline">
                        Cambiar
                      </button>
                    </form>
                    <form action={borrarVenta}>
                      <input type="hidden" name="id" value={v.id} />
                      <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                        Borrar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
