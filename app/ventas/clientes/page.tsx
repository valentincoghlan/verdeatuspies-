import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import { crearCliente } from "@/lib/actions";
import { fechaLarga, m2, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIPOS = [
  { value: "particular", label: "Particular" },
  { value: "empresa", label: "Empresa" },
  { value: "paisajista", label: "Paisajista" },
  { value: "vivero", label: "Vivero" },
  { value: "otro", label: "Otro" },
];

export default async function ClientesPage() {
  const supabase = await createClient();

  const [{ data: clientes }, { data: cuentas }] = await Promise.all([
    supabase.from("clientes").select("*").order("nombre"),
    supabase.from("v_cuenta_clientes").select("*"),
  ]);

  const porId = new Map((cuentas ?? []).map((c: any) => [c.cliente_id, c]));
  const totalM2 = (cuentas ?? []).reduce((a, c: any) => a + Number(c.m2_vendidos ?? 0), 0);
  const totalSaldo = (cuentas ?? []).reduce(
    (a, c: any) => a + Math.max(0, Number(c.saldo ?? 0)),
    0,
  );

  return (
    <>
      <PageHeader titulo="Clientes" bajada="Quién compró, cuántos m² y cuánto debe." />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3">
        <Stat label="Clientes" valor={numero((clientes ?? []).length)} />
        <Stat label="m² vendidos (histórico)" valor={m2(totalM2)} tono="verde" />
        <Stat label="Saldo por cobrar" valor={pesos(totalSaldo)} tono={totalSaldo > 0 ? "ambar" : "neutro"} />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Nuevo cliente">
          <form action={crearCliente} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Nombre" name="nombre" required className="col-span-2" />
            <Selector label="Tipo" name="tipo" defaultValue="particular" opciones={TIPOS} />
            <Campo label="Teléfono" name="telefono" />
            <Campo label="Mail" name="email" type="email" />
            <Campo label="Dirección" name="direccion" className="col-span-2" />
            <Campo label="Localidad" name="localidad" />
            <Campo label="CUIT / DNI" name="cuit" />
            <Nota className="col-span-2 sm:col-span-3" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Guardar cliente</button>
            </div>
          </form>
        </Card>

        <Card titulo="Listado">
          <Tabla
            cabeceras={["Cliente", "Contacto", "m² comprados", "Vendido", "Cobrado", "Saldo", "Última compra"]}
            vacio="Todavía no cargaste clientes."
          >
            {(clientes ?? []).map((c: any) => {
              const cta: any = porId.get(c.id) ?? {};
              const saldo = Number(cta.saldo ?? 0);
              return (
                <tr key={c.id}>
                  <td className="td">
                    <div className="font-semibold">{c.nombre}</div>
                    <div className="text-xs text-tierra-400">
                      {c.tipo}
                      {c.localidad ? ` · ${c.localidad}` : ""}
                    </div>
                  </td>
                  <td className="td text-xs text-tierra-600">
                    {c.telefono ?? "—"}
                    {c.email && <div>{c.email}</div>}
                  </td>
                  <td className="td tabular-nums">{numero(cta.m2_vendidos)}</td>
                  <td className="td tabular-nums">{pesos(Number(cta.total_vendido ?? 0))}</td>
                  <td className="td tabular-nums">{pesos(Number(cta.total_cobrado ?? 0))}</td>
                  <td
                    className={
                      "td tabular-nums font-semibold " +
                      (saldo > 0 ? "text-amber-700" : saldo < 0 ? "text-blue-700" : "")
                    }
                  >
                    {pesos(saldo)}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-tierra-600">
                    {fechaLarga(cta.ultima_venta)}
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <p className="mt-3 text-xs text-tierra-400">
            Saldo positivo = te debe. Negativo = pagó de más o hay un anticipo.
          </p>
        </Card>
      </div>
    </>
  );
}
