import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Dato } from "@/components/dato";
import { fechaBreve, m2, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * El detalle de un cliente: todo lo que te compró.
 *
 * Se llega tocando su fila en la cuenta corriente. La tabla de arriba
 * solo dice cuánto debe; acá está de dónde sale ese número, que es lo
 * que uno quiere ver cuando lo llama.
 */
export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: ventas }, { data: cuenta }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("ventas")
      .select("id, fecha, fecha_entrega, m2, precio_m2, total, estado")
      .eq("cliente_id", id)
      .neq("estado", "anulada")
      .order("fecha_entrega", { ascending: false, nullsFirst: false })
      .order("fecha", { ascending: false }),
    supabase.from("v_cuenta_clientes").select("*").eq("cliente_id", id).maybeSingle(),
  ]);

  if (!cliente) notFound();

  const compras = (ventas ?? []) as any[];
  const c: any = cuenta ?? {};
  const saldo = Number(c.saldo ?? 0);

  const tono = (e: string) =>
    e === "entregada" ? "verde" : e === "pedido" ? "ambar" : e === "confirmada" ? "azul" : "neutro";

  return (
    <>
      <PageHeader
        titulo={cliente.nombre}
        bajada={
          cliente.canal === "distribuidor" ? "Distribuidor" : "Cliente final"
        }
        accion={
          <Link href="/ventas/clientes" className="btn-ghost">
            Volver
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat label="Facturado" valor={pesos(Number(c.total_vendido ?? 0))} destacado />
        <Stat
          label="Saldo"
          valor={pesos(saldo)}
          tono={saldo > 0 ? "ambar" : "neutro"}
          detalle={saldo > 0 ? "Te debe" : saldo < 0 ? "Pagó de más" : "Al día"}
        />
        <Stat label="m² comprados" valor={m2(Number(c.m2_vendidos ?? 0))} />
        <Stat
          label="Teléfono"
          valor={cliente.telefono ?? "—"}
          detalle={`${compras.length} ${compras.length === 1 ? "compra" : "compras"}`}
        />
      </div>

      <div className="mt-3">
        <Card titulo="Sus compras">
          <Tabla
            columnas={[
              { titulo: "Entrega" },
              { titulo: "Valor" },
              { titulo: "Estado" },
            ]}
            vacio="Todavía no compró nada."
          >
            {compras.map((v) => (
              <tr key={v.id}>
                <td className="td whitespace-nowrap font-medium">
                  {fechaBreve(v.fecha_entrega ?? v.fecha)}
                </td>
                <td className="td tabular-nums font-semibold">
                  <Dato
                    principal={pesos(Number(v.total))}
                    secundario={`${numero(v.m2)} m²`}
                  />
                </td>
                <td className="td">
                  <Chip tono={tono(v.estado) as any}>{v.estado}</Chip>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
