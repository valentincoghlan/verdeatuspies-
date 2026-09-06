import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Checks } from "@/components/checks";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
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
          <form action={crearCosecha} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Selector
              label="Pedido a cubrir"
              name="venta_id"
              vacio="Sin pedido, cosecha suelta"
              opciones={(pedidos ?? []).map((p: any) => ({
                value: p.id,
                label: `${p.comprador} · ${numero(p.m2)} m² · ${fechaLarga(p.fecha_entrega)}`,
              }))}
              className="col-span-2 sm:col-span-4"
            />
            <Campo
              label="Objetivo en m²"
              name="objetivo_m2"
              type="number"
              step="0.5"
              placeholder="600"
              className="col-span-2"
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
            cabeceras={["Fecha", "Lote", "Objetivo", "Cortado", "Falta", "Pilas", "Líneas", "Estado", ""]}
            vacio="Todavía no empezaste ninguna cosecha."
          >
            {lista.map((c) => {
              const cortado = Number(c.m2_cosechados ?? 0);
              const objetivo = Number(c.objetivo_m2 ?? 0);
              const falta = Math.max(0, objetivo - cortado);
              const pct = objetivo > 0 ? Math.min(100, (cortado / objetivo) * 100) : 0;
              return (
                <tr key={c.id}>
                  <td className="td whitespace-nowrap">{fechaBreve(c.fecha)}</td>
                  <td className="td">
                    {c.lote ?? "—"}
                    {c.comprador && (
                      <span className="block text-xs text-tinta-3">para {c.comprador}</span>
                    )}
                  </td>
                  <td className="td tabular-nums">{numero(objetivo)}</td>
                  <td className="td tabular-nums font-semibold text-pasto">
                    {numero(cortado)}
                    <span className="ml-1 text-xs font-normal text-tinta-3">
                      {numero(pct)}%
                    </span>
                  </td>
                  <td className="td tabular-nums">{falta > 0 ? numero(falta) : "—"}</td>
                  <td className="td tabular-nums text-tinta-2">
                    {numero(c.pilas_cargadas)} / {numero(c.pilas_objetivo)}
                  </td>
                  <td className="td tabular-nums text-tinta-2">{numero(c.lineas)}</td>
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
