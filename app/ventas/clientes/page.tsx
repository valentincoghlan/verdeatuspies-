import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { crearCliente, saldarCliente } from "@/lib/actions";
import { SaldarCliente } from "@/components/saldar-cliente";
import { fechaBreve, m2, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const CANALES = [
  { value: "directa", label: "Particular" },
  { value: "distribuidor", label: "Distribuidor" },
];

const VISTAS = [
  { v: "cuenta", label: "Cuenta corriente" },
  { v: "todos", label: "Todos los clientes" },
];

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; aviso?: string }>;
}) {
  const { ver, aviso } = await searchParams;
  const vista = ver === "todos" ? "todos" : "cuenta";
  const supabase = await createClient();

  const [
    { data: clientes },
    { data: cuentas },
    { data: ventasMov },
    { data: yo },
  ] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("v_cuenta_clientes").select("*"),
    // Los m² de cada canal salen de las ventas, que traen el detalle
    // completo de la planilla.
    supabase.from("ventas").select("canal, m2, total").neq("estado", "anulada"),
    // Saldar una cuenta corriente es solo para el dueño.
    supabase.auth.getUser().then(async ({ data }) =>
      data.user
        ? supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle()
        : { data: null },
    ),
  ]);

  const lista = (clientes ?? []) as any[];
  const porId = new Map((cuentas ?? []).map((c: any) => [c.cliente_id, c]));

  const movs = (ventasMov ?? []) as any[];
  const sumar = (canal: string) =>
    movs.filter((v) => v.canal === canal).reduce((a, v) => a + Number(v.m2 ?? 0), 0);

  const m2Particulares = sumar("directa");
  const m2Distribuidores = sumar("distribuidor");
  const sinMetros = movs.filter((v) => !v.m2).length;

  const totalSaldo = (cuentas ?? []).reduce(
    (a, c: any) => a + Math.max(0, Number(c.saldo ?? 0)),
    0,
  );

  const esAdmin = (yo as any)?.rol === "admin";

  const distribuidores = lista.filter((c) => c.canal === "distribuidor");
  const enVista = vista === "cuenta" ? distribuidores : lista;

  return (
    <>
      <PageHeader titulo="Clientes" bajada="Quién compró, cuántos m² y cuánto debe." />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="m² a particulares" valor={m2(m2Particulares)} destacado />
        <Stat label="m² a distribuidores" valor={m2(m2Distribuidores)} tono="verde" />
        <Stat
          label="Clientes"
          valor={numero(lista.length)}
          detalle={`${distribuidores.length} distribuidor${distribuidores.length === 1 ? "" : "es"}`}
        />
        <Stat
          label="Por cobrar"
          valor={pesos(totalSaldo)}
          tono={totalSaldo > 0 ? "ambar" : "neutro"}
        />
      </div>

      {aviso && (
        <div className="mt-3 rounded-2xl border border-borde bg-hecho-bg p-3 text-sm text-pasto-oscuro">
          {aviso}
        </div>
      )}

      {sinMetros > 0 && (
        <p className="mt-3 rounded-2xl border border-atencion-tx/30 bg-atencion-bg p-3 text-sm text-atencion-tx">
          Hay {sinMetros} ventas cargadas sin los m².
        </p>
      )}

      <div className="mt-3 space-y-3">
        <Card titulo="Nuevo cliente">
          <form action={crearCliente} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Nombre" name="nombre" required className="col-span-2" />
            <Campo label="Teléfono" name="telefono" />
            <Selector label="Canal" name="canal" defaultValue="directa" opciones={CANALES} />
            <div className="col-span-2 sm:col-span-4">
              <button className="btn btn-alto">Guardar cliente</button>
            </div>
          </form>
        </Card>

        <Card
          titulo={vista === "cuenta" ? "Cuenta corriente con distribuidores" : "Todos los clientes"}
          accion={
            <div className="flex gap-1.5">
              {VISTAS.map((x) => (
                <Link
                  key={x.v}
                  href={`/ventas/clientes?ver=${x.v}`}
                  className={
                    "inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold transition " +
                    (vista === x.v
                      ? "bg-pasto text-crema"
                      : "bg-beige text-tinta-2 hover:bg-borde")
                  }
                >
                  {x.label}
                </Link>
              ))}
            </div>
          }
        >
          <Tabla
            cabeceras={["Cliente", "Teléfono", "m² comprados", "Vendido", "Cobrado", "Saldo", "Última compra", ""]}
            soloEnCompu={[1, 2, 3, 4]}
            vacio={
              vista === "cuenta"
                ? "Todavía no hay distribuidores cargados."
                : "Todavía no cargaste clientes."
            }
          >
            {enVista.map((c) => {
              const cta: any = porId.get(c.id) ?? {};
              const saldo = Number(cta.saldo ?? 0);
              return (
                <tr key={c.id}>
                  <td className="td max-w-0 p-0">
                    <Link
                      href={`/ventas/clientes/${c.id}`}
                      className="flex min-h-11 items-center gap-2 px-3 transition hover:bg-beige active:bg-beige"
                    >
                      <span className="truncate font-semibold">{c.nombre}</span>
                      {vista === "todos" && c.canal === "distribuidor" && (
                        <span className="hidden sm:inline">
                          <Chip tono="verde">distribuidor</Chip>
                        </span>
                      )}
                      <span aria-hidden className="ml-auto shrink-0 text-tinta-3 sm:hidden">
                        &rsaquo;
                      </span>
                    </Link>
                  </td>
                  <td className="td text-xs text-tinta-2">{c.telefono ?? "—"}</td>
                  <td className="td tabular-nums">{numero(cta.m2_vendidos)}</td>
                  <td className="td tabular-nums">{pesos(Number(cta.total_vendido ?? 0))}</td>
                  <td className="td tabular-nums">{pesos(Number(cta.total_cobrado ?? 0))}</td>
                  <td
                    className={
                      "td whitespace-nowrap tabular-nums font-semibold " +
                      (saldo > 0 ? "text-atencion-tx" : saldo < 0 ? "text-info-tx" : "text-tinta-3")
                    }
                  >
                    {pesos(saldo)}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-tinta-2">
                    {cta.ultima_venta ? fechaBreve(cta.ultima_venta) : "—"}
                  </td>
                  <td className="td text-right">
                    {esAdmin && saldo > 0 && (
                      <SaldarCliente
                        cliente={{ id: c.id, nombre: c.nombre, saldo }}
                        accion={saldarCliente}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <p className="mt-3 text-xs text-tinta-3">
            Saldo positivo = te debe. Negativo = pagó de más o hay un anticipo, y cero quiere decir
            que está al día. Tocá un nombre para ver todas sus compras.
          </p>
        </Card>
      </div>
    </>
  );
}
