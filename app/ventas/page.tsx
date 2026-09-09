import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BarrasTiempo } from "@/components/barras-tiempo";
import { EditarVenta } from "@/components/editar-venta";
import { Dato } from "@/components/dato";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import { borrarVenta, crearVenta, editarVenta } from "@/lib/actions";
import { fechaBreve, fechaCorta, fechaLarga, hoyISO, m2, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const ESTADOS = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "pedido", label: "Pedido" },
  { value: "confirmada", label: "Confirmada" },
  { value: "entregada", label: "Entregada" },
  { value: "anulada", label: "Anulada" },
];

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
        .select("*, clientes!cliente_id(nombre), vinculante:clientes!vinculante_id(nombre), lotes(nombre)")
        .order("fecha", { ascending: false })
        .limit(80),
      supabase.from("v_ventas_por_mes").select("*").order("mes", { ascending: false }).limit(12),
      supabase.from("config").select("valor").eq("clave", "precio_m2_default").single(),
    ]);

  // Un pedido todavía no es una venta: no suma a los m² ni a lo facturado.
  const activas = (ventas ?? []).filter(
    (v: any) => v.estado === "confirmada" || v.estado === "entregada",
  );
  const delMes = activas.filter((v: any) => v.fecha >= inicioMes);
  const m2Mes = delMes.reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const totalMes = delMes.reduce((a, v: any) => a + Number(v.total ?? 0), 0);
  const m2Anio = activas
    .filter((v: any) => v.fecha.startsWith(hoy.slice(0, 4)))
    .reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const precioProm = m2Mes > 0 ? totalMes / m2Mes : 0;
  const precioDefault = Number(config?.valor ?? 0) || undefined;

  // El grafico arma sus propias etiquetas segun como lo agrupes, asi que
  // desde aca va el mes crudo.
  const serie = (porMes ?? [])
    .slice()
    .reverse()
    .map((r: any) => ({ mes: String(r.mes).slice(0, 7), valor: Number(r.m2 ?? 0) }));

  const tonoEstado = (e: string) =>
    e === "entregada"
      ? "verde"
      : e === "confirmada"
        ? "azul"
        : e === "pedido"
          ? "ambar"
          : e === "anulada"
            ? "rojo"
            : "neutro";

  return (
    <>
      <PageHeader
        titulo="Ventas"
        bajada="m² vendidos por cliente y por fecha, con estado de cada operación."
        accion={
          <div className="flex gap-2">
            <Link href="/ventas/pedidos" className="btn-ghost">
              Pedidos
            </Link>
            <Link href="/ventas/clientes" className="btn-ghost">
              Clientes
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="m² del mes" valor={m2(m2Mes)} tono="verde" detalle={`${delMes.length} operaciones`} />
        <Stat label="Facturado del mes" valor={pesos(totalMes)} />
        <Stat label="Precio promedio m²" valor={pesos(precioProm, 0)} />
        <Stat label={`m² ${hoy.slice(0, 4)}`} valor={m2(m2Anio)} />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Nueva venta">
          <form action={crearVenta} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Selector
              label="Comprador"
              name="cliente_id"
              required
              vacio="Elegí un cliente"
              opciones={(clientes ?? []).map((c: any) => ({ value: c.id, label: c.nombre }))}
              className="col-span-2"
            />
            <Selector
              label="Distribuidor"
              name="vinculante_id"
              vacio="Sin distribuidor"
              opciones={(clientes ?? []).map((c: any) => ({ value: c.id, label: c.nombre }))}
              className="col-span-2"
            />
            <Selector
              label="Canal de venta"
              name="canal"
              defaultValue="directa"
              opciones={[
                { value: "directa", label: "Directa" },
                { value: "distribuidor", label: "Distribuidores" },
              ]}
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
            <Campo label="Fecha de entrega" name="fecha_entrega" type="date" />
            <Nota className="col-span-2 sm:col-span-4" />
            <div className="col-span-2 sm:col-span-4">
              <button className="btn btn-alto sm:w-auto">Guardar venta</button>
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

        <Card titulo="m² vendidos">
          <BarrasTiempo datos={serie} />
        </Card>

        <Card titulo="Operaciones">
          {/* En el celular quedan tres columnas: el comprador con sus m²
              debajo, el total con el precio por m² debajo, y el estado con
              el lapiz al lado. En la compu siguen todas separadas. */}
          <Tabla
            columnas={[
              { titulo: "Fecha", desde: "sm" },
              { titulo: "Cliente" },
              { titulo: "m²", desde: "sm" },
              { titulo: "$/m²", desde: "sm" },
              { titulo: "Total" },
              { titulo: "Estado" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="Todavía no cargaste ventas."
          >
            {(ventas ?? []).map((v: any) => (
              <tr key={v.id}>
                <td className="td whitespace-nowrap">{fechaBreve(v.fecha)}</td>
                <td className="td max-w-0 truncate font-medium">
                  {v.clientes?.nombre}
                  {(v.vinculante || v.cliente_final) && (
                    <span className="block text-xs font-normal text-tinta-3">
                      {v.vinculante ? `vía ${v.vinculante.nombre}` : ""}
                      {v.vinculante && v.cliente_final ? " · " : ""}
                      {v.cliente_final ? `entrega a ${v.cliente_final}` : ""}
                    </span>
                  )}
                </td>
                <td className="td tabular-nums">{numero(v.m2)}</td>
                <td className="td tabular-nums">{pesos(Number(v.precio_m2))}</td>
                <td className="td tabular-nums font-semibold">
                  <Dato
                    principal={pesos(Number(v.total))}
                    secundario={<span className="sm:hidden">{numero(v.m2)} m&sup2;</span>}
                  />
                </td>
                <td className="td">
                  <Chip tono={tonoEstado(v.estado) as any}>{v.estado}</Chip>
                  {v.fecha_entrega && (
                    <span className="block text-xs text-tinta-3 sm:ml-1 sm:inline">
                      {fechaCorta(v.fecha_entrega)}
                    </span>
                  )}
                </td>
                <td className="td text-right">
                  <EditarVenta
                    venta={{
                      id: v.id,
                      comprador: v.clientes?.nombre ?? "Sin comprador",
                      fecha: v.fecha,
                      fecha_entrega: v.fecha_entrega,
                      m2: Number(v.m2 ?? 0),
                      precio_m2: Number(v.precio_m2 ?? 0),
                      flete: Number(v.flete ?? 0),
                      estado: v.estado,
                      lote_id: v.lote_id,
                      notas: v.notas,
                    }}
                    lotes={(lotes ?? []) as any[]}
                    accion={editarVenta}
                    borrar={borrarVenta}
                  />
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
