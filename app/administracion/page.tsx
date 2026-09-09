import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Opciones, Selector } from "@/components/campos";
import { Elegir } from "@/components/elegir";
import { CuentaYMonto } from "@/components/plata";
import { QuePaso } from "@/components/que-paso";
import { Confirmar } from "@/components/confirmar";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import { borrarMovimiento, crearMovimiento, crearPersona } from "@/lib/actions";
import { esAdmin } from "@/lib/rol";
import { fechaBreve, hoyISO, numero, pesos } from "@/lib/format";

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
    { data: movs },
    { data: totales },
    { data: cotizacion },
    admin,
  ] = await Promise.all([
    supabase.from("cuentas").select("*").eq("activa", true).order("orden"),
    supabase.from("categorias").select("*").eq("activa", true).order("orden"),
    supabase.from("personas").select("*").eq("activa", true).order("nombre"),
    supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
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

  return (
    <>
      <PageHeader
        titulo="Movimientos"
        bajada="Todo lo que entra y sale. Los saldos están en Disponibilidades y el análisis en Reportes."
      />

      <div className="space-y-3">
        <FiltroFechas base="/administracion" activo={sp.p} rango={rango} />

        <Card titulo="Cargar un movimiento">
          <form action={crearMovimiento} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Qué pasó */}
            <QuePaso rubros={rubros} admin={admin} />

            {/* Cuánto */}
            <CuentaYMonto cuentas={opcionesCuenta} mep={mep} />
            <Campo
              label="Fecha"
              name="fecha"
              type="date"
              required
              defaultValue={hoy}
              className="col-span-1"
            />

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

            <div className="col-span-2 sm:col-span-3">
              <button className="btn btn-alto sm:w-auto">Guardar movimiento</button>
            </div>
          </form>
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
              { titulo: "Fecha", ancho: "w-[3.6rem] sm:w-auto" },
              { titulo: "Categoría" },
              { titulo: "Persona y monto" },
              { titulo: "Detalle", desde: "sm" },
              { titulo: "Cuenta", desde: "sm" },
              { titulo: "Monto", desde: "sm" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="No hay movimientos en este período."
          >
            {lista.map((m) => (
              <tr key={m.id}>
                <td className="td whitespace-nowrap text-[11px] sm:text-sm">
                  {fechaBreve(m.fecha)}
                </td>
                <td className="td">
                  <span className="block text-[13px] font-semibold leading-tight sm:text-sm">
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
                <td className="td text-right">
                  {/* Borrar un movimiento le mueve el saldo a todos: solo
                      lo hace el dueño. */}
                  {admin && (
                    <Confirmar
                      action={borrarMovimiento}
                      campos={{ id: m.id }}
                      etiqueta="×"
                      pregunta="¿Borrar este movimiento?"
                      compacto
                    />
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

      </div>
    </>
  );
}
