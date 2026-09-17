import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BarrasTiempo } from "@/components/barras-tiempo";
import { EditarVenta } from "@/components/editar-venta";
import { Dato } from "@/components/dato";
import { Cobrar } from "@/components/cobrar";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { DetalleVenta } from "@/components/detalle-venta";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import { Variacion } from "@/components/variacion";
import { Campo, Nota, Selector } from "@/components/campos";
import { borrarVenta, cobrarVentas, crearVenta, editarVenta } from "@/lib/actions";
import { fechaBreve, fechaCorta, fechaDM, fechaLarga, hoyISO, m2, numero, pesos } from "@/lib/format";
import { Formulario, Guardar } from "@/components/guardar";

export const dynamic = "force-dynamic";

const ESTADOS = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "pedido", label: "Pedido" },
  { value: "confirmada", label: "Confirmada" },
  { value: "entregada", label: "Entregada" },
  { value: "anulada", label: "Anulada" },
];

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    ver?: string;
    p?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  // `?ver=<id>` abre el detalle de esa operación encima de la pantalla.
  // Cerrarlo es volver a la misma URL sin el parámetro, así que el botón
  // de atrás del navegador también lo cierra.
  const sp = await searchParams;
  const ver = sp.ver;
  const rango = resolverRango(sp);
  const supabase = await createClient();
  const hoy = hoyISO();

  // La URL del período sin el `ver`: a donde vuelve el modal al cerrarse,
  // para no perder el filtro puesto.
  const sinModal = (() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "ver" && v) q.set(k, String(v));
    const cola = q.toString();
    return cola ? `/ventas?${cola}` : "/ventas";
  })();

  const [
    { data: clientes },
    { data: lotes },
    { data: porCobrar },
    { data: cuentas },
    { data: ventas },
    { data: porMes },
    { data: config },
    { data: ventasAntes },
  ] = await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      // Lo entregado que todavía no se cobró, y dónde puede entrar la plata.
      supabase
        .from("v_margen_ventas")
        .select("venta_id, comprador, cliente_id, fecha, fecha_entrega, facturado, cobrado, pendiente")
        .eq("estado", "entregada")
        .gt("pendiente", 0)
        .order("fecha_entrega", { ascending: true, nullsFirst: false }),
      supabase.from("cuentas").select("id, nombre").eq("activa", true).order("orden"),
      supabase
        .from("ventas")
        .select("*, clientes!cliente_id(nombre), vinculante:clientes!vinculante_id(nombre), lotes(nombre)")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta)
        .order("fecha", { ascending: false })
        .limit(300),
      // Toda la historia: el grafico recorta segun el zoom que elijas, y
      // con doce meses la vista por ano perdia parte del ano mas viejo.
      supabase.from("v_ventas_por_mes").select("*").order("mes", { ascending: false }).limit(72),
      supabase.from("config").select("valor").eq("clave", "precio_m2_default").single(),
      // El mismo tramo una vuelta para atrás: es lo que alimenta las
      // flechitas de los carteles.
      supabase
        .from("ventas")
        .select("m2, total, estado")
        .gte("fecha", rango.anterior.desde)
        .lte("fecha", rango.anterior.hasta),
    ]);

  /*
   * Qué cuenta como venta hecha.
   *
   * Los mismos tres estados que mira Reportes: una venta cosechada ya
   * tiene el pasto cortado y la mano de obra paga, así que suma igual que
   * una entregada. Lo único que queda afuera es el presupuesto y el
   * pedido, que todavía pueden no pasar. Si acá contáramos distinto que en
   * Reportes, las dos pantallas dirían dos números para el mismo mes.
   */
  const CUENTAN = ["cosechada", "confirmada", "entregada"];
  const activas = (ventas ?? []).filter((v: any) => CUENTAN.includes(v.estado));
  const m2Periodo = activas.reduce((a, v: any) => a + Number(v.m2 ?? 0), 0);
  const totalPeriodo = activas.reduce((a, v: any) => a + Number(v.total ?? 0), 0);
  const precioProm = m2Periodo > 0 ? totalPeriodo / m2Periodo : 0;
  const precioDefault = Number(config?.valor ?? 0) || undefined;

  // Los mismos tres números del tramo anterior, para las flechitas.
  const antes = ((ventasAntes ?? []) as any[]).filter((v) => CUENTAN.includes(v.estado));
  const m2Antes = antes.reduce((a, v) => a + Number(v.m2 ?? 0), 0);
  const totalAntes = antes.reduce((a, v) => a + Number(v.total ?? 0), 0);
  const precioAntes = m2Antes > 0 ? totalAntes / m2Antes : 0;
  const contra = rango.anterior.etiqueta;

  // El grafico arma sus propias etiquetas segun como lo agrupes, asi que
  // desde aca va el mes crudo.
  const serie = (porMes ?? [])
    .slice()
    .reverse()
    .map((r: any) => ({ mes: String(r.mes).slice(0, 7), valor: Number(r.m2 ?? 0) }));

  const aCobrar = ((porCobrar ?? []) as any[]).map((v) => ({
    id: v.venta_id as string,
    comprador: (v.comprador ?? "Sin comprador") as string,
    clienteId: v.cliente_id as string,
    fecha: (v.fecha_entrega ?? v.fecha) as string,
    facturado: Number(v.facturado ?? 0),
    pendiente: Number(v.pendiente ?? 0),
  }));
  const totalPorCobrar = aCobrar.reduce((a, v) => a + v.pendiente, 0);
  const cuentasOpc = ((cuentas ?? []) as any[]).map((c) => ({ id: c.id, nombre: c.nombre }));

  // El camino de una venta: pedido -> cosechada -> entregada. El color
  // acompaña ese avance, de lo más tibio a lo más cerrado.
  const tonoEstado = (e: string) =>
    e === "entregada"
      ? "verde"
      : e === "cosechada" || e === "confirmada"
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
        bajada={`${rango.etiqueta}: m² vendidos por cliente, con el estado de cada operación.`}
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

      <div className="mb-3">
        <FiltroFechas base="/ventas" activo={sp.p} rango={rango} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="m² facturados"
          valor={m2(m2Periodo)}
          destacado
          detalle={
            <Variacion
              actual={m2Periodo}
              anterior={m2Antes}
              formato={(n) => m2(n)}
              contra={contra}
              sobreOscuro
            />
          }
        />
        <Stat
          label="Facturado"
          valor={pesos(totalPeriodo)}
          tono="verde"
          detalle={
            <Variacion
              actual={totalPeriodo}
              anterior={totalAntes}
              formato={pesos}
              contra={contra}
            />
          }
        />
        <Stat
          label="Precio por m² facturado"
          valor={pesos(precioProm, 0)}
          detalle={
            <Variacion
              actual={precioProm}
              anterior={precioAntes}
              formato={(n) => pesos(n, 0)}
              contra={contra}
            />
          }
        />
        <Stat
          label="Operaciones"
          valor={numero(activas.length)}
          detalle={
            <Variacion
              actual={activas.length}
              anterior={antes.length}
              formato={(n) => numero(n)}
              contra={contra}
            />
          }
        />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Nueva venta">
          <Formulario action={crearVenta} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            {/* Los dos vuelven como opcionales. El lote de una venta con
                cosecha sale de las cargas; estos son para las que se
                cargan sueltas, sin cosecha detrás. */}
            <Selector
              label="Lote de origen"
              name="lote_id"
              vacio="Sale de la cosecha"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
              className="col-span-2 sm:col-span-1"
            />
            <Campo
              label="Cliente final"
              name="cliente_final"
              placeholder="Quién recibe, si lo sabés"
              className="col-span-2 sm:col-span-1"
            />
            <Nota className="col-span-2 sm:col-span-4" />
            <div className="col-span-2 sm:col-span-4">
              <Guardar className="btn btn-alto sm:w-auto">Guardar venta</Guardar>
            </div>
          </Formulario>
          {(clientes ?? []).length === 0 && (
            <p className="mt-3 text-xs text-atencion-tx">
              Primero cargá un cliente en{" "}
              <Link href="/ventas/clientes" className="font-semibold underline">
                Clientes
              </Link>
              .
            </p>
          )}
        </Card>

        {/* Lo entregado que todavía no se cobró. Queda acá hasta que
            entre la plata, y desde acá se carga el pago. */}
        <Card
          titulo="Pendiente de cobro"
          accion={
            aCobrar.length > 0 ? (
              <Cobrar ventas={aCobrar} cuentas={cuentasOpc} accion={cobrarVentas} />
            ) : undefined
          }
        >
          {aCobrar.length === 0 ? (
            <p className="rounded-xl bg-crema py-6 text-center text-sm text-tinta-2">
              No te deben nada. Todo lo entregado está cobrado.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-tinta-2">
                {aCobrar.length} entrega{aCobrar.length === 1 ? "" : "s"} sin cobrar por{" "}
                <strong className="text-atencion-tx">{pesos(totalPorCobrar)}</strong>.
              </p>
              <Tabla
                columnas={[
                  { titulo: "Entrega", ancho: "w-[3.4rem] sm:w-auto" },
                  { titulo: "Comprador" },
                  { titulo: "Facturado", desde: "sm" },
                  { titulo: "Debe", align: "right" },
                  { titulo: "", ancho: "w-16 sm:w-auto" },
                ]}
              >
                {aCobrar.map((v) => (
                  <tr key={v.id}>
                    <td className="td whitespace-nowrap">
                      <span className="sm:hidden">{fechaDM(v.fecha)}</span>
                      <span className="hidden sm:inline">{fechaBreve(v.fecha)}</span>
                    </td>
                    <td className="td max-w-0 truncate font-medium">
                      <Link href={`/ventas/${v.id}`} className="hover:underline">
                        {v.comprador}
                      </Link>
                    </td>
                    <td className="td hidden tabular-nums sm:table-cell">{pesos(v.facturado)}</td>
                    <td className="td text-right tabular-nums font-semibold text-atencion-tx">
                      <Dato
                        principal={pesos(v.pendiente)}
                        secundario={
                          v.pendiente < v.facturado ? (
                            <span className="sm:hidden">de {pesos(v.facturado)}</span>
                          ) : null
                        }
                      />
                    </td>
                    {/* Cargar el pago de ESTA entrega, sin volver a elegir
                        de quién es. */}
                    <td className="td text-right">
                      <Cobrar
                        ventas={aCobrar}
                        cuentas={cuentasOpc}
                        accion={cobrarVentas}
                        etiqueta="Cobrar"
                        clienteInicial={v.clienteId}
                        compacto
                      />
                    </td>
                  </tr>
                ))}
              </Tabla>
            </>
          )}
        </Card>

        <Card titulo="m² facturados">
          <BarrasTiempo datos={serie} />
        </Card>

        <Card titulo={`Operaciones · ${rango.etiqueta.toLowerCase()}`}>
          {/* En el celular quedan tres columnas: el comprador con sus m²
              debajo, el total con el precio por m² debajo, y el estado con
              el lapiz al lado. En la compu siguen todas separadas. */}
          <Tabla
            columnas={[
              { titulo: "Fecha", desde: "sm" },
              { titulo: "Cliente" },
              { titulo: "m² fact.", desde: "sm", num: true },
              { titulo: "$/m²", desde: "sm", num: true },
              { titulo: "Total", num: true },
              { titulo: "Estado" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="No hay ventas en este período."
          >
            {(ventas ?? []).map((v: any) => (
              <tr key={v.id}>
                <td className="td hidden whitespace-nowrap sm:table-cell">{fechaBreve(v.fecha)}</td>
                <td className="td max-w-0 font-medium sm:max-w-none">
                  <Link
                    href={`${sinModal}${sinModal.includes("?") ? "&" : "?"}ver=${v.id}`}
                    scroll={false}
                    className="block truncate hover:underline sm:overflow-visible"
                    title={`Ver el detalle de la venta de ${v.clientes?.nombre}`}
                  >
                    {v.clientes?.nombre}
                  </Link>
                  {(v.vinculante || v.cliente_final) && (
                    <span className="block text-xs font-normal text-tinta-3">
                      {v.vinculante ? `vía ${v.vinculante.nombre}` : ""}
                      {v.vinculante && v.cliente_final ? " · " : ""}
                      {v.cliente_final ? `entrega a ${v.cliente_final}` : ""}
                    </span>
                  )}
                </td>
                <td className="td td-num hidden sm:table-cell">{numero(v.m2)}</td>
                <td className="td td-num hidden sm:table-cell">
                  {pesos(Number(v.precio_m2))}
                </td>
                <td className="td td-num font-semibold">
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

      {ver && <DetalleVenta ventaId={ver} cerrar={sinModal} />}
    </>
  );
}
