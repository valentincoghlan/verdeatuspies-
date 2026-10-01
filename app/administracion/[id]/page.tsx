import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import { Confirmar } from "@/components/confirmar";
import { Formulario, Guardar } from "@/components/guardar";
import { borrarMovimiento, borrarTanda, editarMovimiento } from "@/lib/actions";
import { esAdmin } from "@/lib/rol";
import { fechaLarga, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * La ficha de un movimiento: para corregir lo que se cargó mal.
 *
 * Se carga desde el campo, con el celular en una mano, y se escribe mal:
 * el monto, la cuenta, el rubro. Hasta acá la única salida era borrarlo
 * —y borrar es solo del dueño— y cargarlo de nuevo.
 *
 * Un pago repartido entre pedidos se edita como lo que fue: un pago. Los
 * datos de arriba valen para todas sus partes, y los montos de cada
 * pedido quedan a la vista pero no se tocan, porque cambiar uno solo
 * rompería el reparto por metros sin que nadie se entere. Si el número
 * está mal, se borra el pago entero y se carga de nuevo.
 */
export default async function MovimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: mov } = await supabase
    .from("v_movimientos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!mov) notFound();

  const [{ data: cuentas }, { data: categorias }, { data: lotes }, admin] = await Promise.all([
    supabase.from("cuentas").select("id, nombre, moneda").eq("activa", true).order("orden"),
    supabase
      .from("categorias")
      .select("id, nombre, padre_id, tipo")
      .eq("activa", true)
      .order("orden"),
    supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
    esAdmin(),
  ]);

  // Las partes del pago, si se repartió. Mismo criterio que la lista: la
  // misma tanda, la misma cuenta y la misma persona son un pago.
  const { data: hermanas } = mov.tanda_id
    ? await supabase
        .from("v_movimientos")
        .select("id, monto, cliente, metros")
        .eq("tanda_id", mov.tanda_id)
        .eq("cuenta_id", mov.cuenta_id)
        .eq("persona_id", mov.persona_id)
    : { data: null };

  const partes = (hermanas ?? []) as any[];
  const repartido = partes.length > 1;
  const total = repartido
    ? partes.reduce((a, p) => a + Number(p.monto ?? 0), 0)
    : Number(mov.monto ?? 0);

  const entra = mov.tipo === "I";

  /*
    El rubro se elige de una sola lista —"Cosecha · Mano de obra"— y no en
    dos pasos como en la carga: acá ya se sabe lo que es y lo que se
    quiere es cambiarlo de una. Solo entran las que sirven para este lado
    (lo que entra o lo que sale) y las madres sin hijas, porque una madre
    con hijas no es un destino válido.
  */
  const todas = (categorias ?? []) as any[];
  const sirve = (c: any) => !c.tipo || c.tipo === "ambos" || c.tipo === (entra ? "I" : "E");
  const opcionesCategoria = todas
    .filter((c) => {
      if (!sirve(c)) return false;
      if (c.padre_id) return true;
      return !todas.some((h) => h.padre_id === c.id);
    })
    .map((c) => {
      const madre = c.padre_id ? todas.find((m) => m.id === c.padre_id) : null;
      return {
        value: c.id as string,
        label: madre ? `${madre.nombre} · ${c.nombre}` : (c.nombre as string),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  const opcionesCuenta = (cuentas ?? []).map((c: any) => ({
    value: c.id as string,
    label: c.nombre as string,
  }));
  const opcionesLote = (lotes ?? []).map((l: any) => ({
    value: l.id as string,
    label: l.nombre as string,
  }));

  // El monto se escribe en la moneda en que se guardó: si salió en
  // dólares, se corrigen dólares y no los pesos que salieron del MEP.
  const enDolares = mov.moneda === "USD";
  const montoEditable = enDolares ? Number(mov.monto_usd ?? 0) : Number(mov.monto ?? 0);

  return (
    <>
      <PageHeader
        titulo={entra ? "Un ingreso" : "Un egreso"}
        bajada={`${fechaLarga(mov.fecha)} · ${mov.categoria ?? "Sin rubro"}${
          mov.subcategoria ? ` · ${mov.subcategoria}` : ""
        }`}
        accion={
          <Link href="/administracion" className="btn-ghost">
            Volver
          </Link>
        }
      />

      <div className="space-y-3">
        <Card titulo="Corregir">
          <Formulario action={editarMovimiento} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={mov.id} />

            <Campo
              label="Fecha"
              name="fecha"
              type="date"
              defaultValue={mov.fecha}
              required
              className="col-span-1"
            />

            {repartido ? (
              <div className="col-span-1">
                <span className="label">{entra ? "Entró" : "Salió"}</span>
                <p className="flex min-h-12 items-center text-sm font-bold tabular-nums text-tinta">
                  {pesos(total)}
                </p>
              </div>
            ) : (
              <Campo
                label={enDolares ? "Monto (US$)" : "Monto"}
                name="monto"
                decimal
                defaultValue={montoEditable}
                required
                className="col-span-1"
              />
            )}

            <Selector
              label="Cuenta"
              name="cuenta_id"
              opciones={opcionesCuenta}
              defaultValue={mov.cuenta_id}
              required
              className="col-span-2 sm:col-span-1"
            />

            <Selector
              label="Rubro"
              name="categoria_id"
              opciones={opcionesCategoria}
              defaultValue={mov.categoria_id}
              required
              className="col-span-2"
            />

            <Selector
              label="Lote"
              name="lote_id"
              vacio="General"
              opciones={opcionesLote}
              defaultValue={mov.lote_id}
              className="col-span-2 sm:col-span-1"
            />

            <Campo
              label={entra ? "Quién pagó" : "Quién cobró"}
              name="persona"
              defaultValue={mov.persona}
              placeholder="Nombre"
              className="col-span-2 sm:col-span-1"
            />

            <Campo
              label="Detalle"
              name="detalle"
              defaultValue={mov.detalle}
              placeholder="Qué se compró o por qué se cobró"
              className="col-span-2"
            />

            <Nota defaultValue={mov.notas} className="col-span-2 sm:col-span-3" />

            <div className="col-span-2 sm:col-span-3">
              <Guardar className="btn btn-alto sm:w-auto">Guardar los cambios</Guardar>
            </div>
          </Formulario>
        </Card>

        {repartido && (
          <Card titulo="A qué pedidos fue">
            <p className="mb-3 text-sm text-tinta-2">
              Este pago se repartió entre {partes.length} pedidos, proporcional a los metros de
              cada uno. Lo de arriba vale para los {partes.length} a la vez. Los montos no se
              editan de a uno: si el número está mal, borrá el pago entero y cargalo de nuevo.
            </p>
            <ul className="divide-y divide-beige">
              {partes.map((p) => (
                <li key={p.id} className="flex min-h-11 items-center gap-2.5 py-1">
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">
                    {p.cliente ?? "Sin pedido"}
                    {p.metros ? (
                      <span className="text-tinta-3"> · {numero(Number(p.metros))} m²</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-tinta-2">
                    {pesos(Number(p.monto))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card titulo="Más">
          <div className="flex flex-wrap items-center gap-2 text-sm text-tinta-2">
            <Chip tono="neutro">{mov.origen ?? "manual"}</Chip>
            {mov.cliente ? (
              <span>Colgado del pedido de {mov.cliente}.</span>
            ) : repartido ? null : (
              <span>No está colgado de ningún pedido.</span>
            )}
          </div>

          {admin ? (
            <div className="mt-3">
              {repartido ? (
                <Confirmar
                  action={borrarTanda}
                  campos={{ id: mov.id }}
                  etiqueta="Borrar el pago entero"
                  pregunta={`¿Borrar las ${partes.length} partes de este pago?`}
                  detalle="Se va del libro completo y los saldos cambian. No se puede deshacer."
                />
              ) : (
                <Confirmar
                  action={borrarMovimiento}
                  campos={{ id: mov.id }}
                  etiqueta="Borrar este movimiento"
                  pregunta="¿Borrar este movimiento?"
                  detalle="Se va del libro y los saldos cambian. No se puede deshacer."
                />
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-tinta-3">
              Borrar es solo del dueño. Corregir lo puede hacer cualquiera del equipo.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
