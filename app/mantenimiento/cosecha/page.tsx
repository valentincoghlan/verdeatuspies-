import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Checks } from "@/components/checks";
import { Dato } from "@/components/dato";
import { PedidoYObjetivo } from "@/components/pedido-objetivo";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota } from "@/components/campos";
import { crearCosecha } from "@/lib/actions";
import { fechaBreve, fechaLarga, hoyISO, m2, numero } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CosechaPage() {
  const supabase = await createClient();
  const hoy = hoyISO();

  const [{ data: lotes }, { data: pedidos }, { data: cosechas }, { data: config }] =
    await Promise.all([
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("v_pedidos_pendientes")
        .select("id, comprador, m2, fecha_entrega, lote")
        .order("fecha_entrega"),
      supabase.from("v_cosechas").select("*").order("fecha", { ascending: false }).limit(30),
      supabase
        .from("config")
        .select("clave, valor")
        .in("clave", ["pan_largo_m", "pan_ancho_m", "panes_por_pila"]),
    ]);

  const cfg = new Map((config ?? []).map((c: any) => [c.clave, c.valor]));
  const largo = Number(cfg.get("pan_largo_m") ?? 0.62);
  const ancho = Number(cfg.get("pan_ancho_m") ?? 0.4);
  const porPila = Number(cfg.get("panes_por_pila") ?? 2);
  const m2Pan = largo * ancho;

  const lista = (cosechas ?? []) as any[];
  const abiertas = lista.filter((c) => c.estado === "abierta");
  const m2Abiertos = abiertas.reduce((a, c) => a + Number(c.m2_cosechados ?? 0), 0);
  const faltan = abiertas.reduce(
    (a, c) => a + Math.max(0, Number(c.objetivo_m2 ?? 0) - Number(c.m2_cosechados ?? 0)),
    0,
  );

  return (
    <>
      <PageHeader
        titulo="Cosecha"
        bajada="Contá las pilas por tramo de líneas y la app te dice cuánto llevás y cuánto falta."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Cosechas abiertas"
          valor={numero(abiertas.length)}
          detalle={abiertas.length === 1 ? "en curso" : "en curso"}
        />
        <Stat label="m² cortados" valor={m2(m2Abiertos)} tono="verde" detalle="En lo que está abierto" />
        <Stat
          label="m² que faltan"
          valor={m2(faltan)}
          tono={faltan > 0 ? "ambar" : "neutro"}
          detalle="Para llegar al objetivo"
        />
        <Stat
          label="Pan actual"
          valor={`${numero(m2Pan, 3)} m²`}
          detalle={`${numero(largo, 2)} × ${numero(ancho, 2)} m · ${porPila} por pila`}
        />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Nueva cosecha">
          {/* En una pantalla grande la grilla estiraba cada campo a
              trescientos y pico de píxeles: un recuadro enorme para
              escribir "2". Con el tope, el campo queda del tamaño de lo
              que entra adentro. */}
          <form
            action={crearCosecha}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl"
          >
            {/* C3 - el objetivo sale del pedido, no se vuelve a preguntar. */}
            <PedidoYObjetivo
              pedidos={(pedidos ?? []).map((p: any) => ({
                id: p.id,
                m2: Number(p.m2 ?? 0),
                label: `${p.comprador} · ${numero(p.m2)} m² · ${fechaLarga(p.fecha_entrega)}`,
              }))}
            />
            <Checks
              label="Lote"
              name="lote_id"
              required
              todos="Los dos lotes"
              resumenVacio="Elegí de dónde cortás"
              opciones={(lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }))}
              className="col-span-2"
            />
            <Campo label="Fecha" name="fecha" type="date" defaultValue={hoy} />
            <Campo label="Largo del pan (m)" name="pan_largo_m" type="number" step="0.01" defaultValue={largo} />
            <Campo label="Ancho del pan (m)" name="pan_ancho_m" type="number" step="0.01" defaultValue={ancho} />
            <Campo label="Panes por pila" name="panes_por_pila" type="number" defaultValue={porPila} />
            <Nota className="col-span-2 sm:col-span-4" />
            <div className="col-span-2 sm:col-span-4">
              <button className="btn btn-alto sm:w-auto">Empezar la cosecha</button>
            </div>
          </form>
          <p className="mt-3 text-sm text-tinta-2">
            Si elegís un pedido, el objetivo se toma de sus m². Las medidas del pan vienen de
            Ajustes: cambialas acá si hoy cortás distinto, y quedan guardadas en esta cosecha.
          </p>
        </Card>

        <Card titulo="Cosechas">
          <Tabla
            columnas={[
              { titulo: "Fecha", desde: "sm" },
              { titulo: "Lote" },
              // Objetivo, avance y falta son el mismo hecho contado tres
              // veces: "206 de 400" ya dice las tres cosas. Juntarlas es
              // lo que le devuelve el ancho al lote, que se cortaba.
              { titulo: "Avance", align: "right" },
              { titulo: "Pilas", desde: "sm", align: "right" },
              { titulo: "Estado" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="Todavía no empezaste ninguna cosecha."
          >
            {lista.map((c) => {
              const cortado = Number(c.m2_cosechados ?? 0);
              const objetivo = Number(c.objetivo_m2 ?? 0);
              const falta = Math.max(0, objetivo - cortado);
              const pct = objetivo > 0 ? Math.min(100, (cortado / objetivo) * 100) : 0;
              return (
                <tr key={c.id}>
                  {/* El encabezado ya se escondía en el celular, pero la
                      celda no: la fila quedaba corrida una columna. La
                      fecha sigue estando abajo del lote. */}
                  <td className="td hidden whitespace-nowrap sm:table-cell">
                    {fechaBreve(c.fecha)}
                  </td>
                  {/* En el teléfono el ancho es prestado y el nombre se
                      corta; en la compu sobra, así que se muestra entero. */}
                  <td className="td max-w-0 sm:max-w-none">
                    <span className="block truncate">{c.lote ?? "—"}</span>
                    <span className="block truncate text-xs text-tinta-3">
                      {c.comprador ? `para ${c.comprador}` : null}
                      <span className="sm:hidden">
                        {c.comprador ? " · " : ""}
                        {fechaBreve(c.fecha)}
                      </span>
                    </span>
                  </td>
                  <td className="td text-right tabular-nums font-semibold text-pasto">
                    <Dato
                      principal={`${numero(cortado)} de ${numero(objetivo)}`}
                      secundario={
                        falta > 0 ? `${numero(pct)}% · faltan ${numero(falta)}` : "completa"
                      }
                    />
                  </td>
                  <td className="td hidden text-right tabular-nums text-tinta-2 sm:table-cell">
                    <Dato
                      principal={`${numero(c.pilas_cargadas)} / ${numero(c.pilas_objetivo)}`}
                      secundario={`${numero(c.lineas)} ${Number(c.lineas) === 1 ? "línea" : "líneas"}`}
                    />
                  </td>
                  <td className="td">
                    <Chip tono={c.estado === "cerrada" ? "verde" : "ambar"}>{c.estado}</Chip>
                  </td>
                  <td className="td text-right">
                    <Link
                      href={`/mantenimiento/cosecha/${c.id}`}
                      className="text-sm font-semibold text-pasto hover:underline"
                    >
                      Contar
                    </Link>
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
