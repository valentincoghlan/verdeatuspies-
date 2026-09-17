import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Checks } from "@/components/checks";
import { Dato } from "@/components/dato";
import { Icono } from "@/components/iconos";
import { PedidoYObjetivo } from "@/components/pedido-objetivo";
import { Card, CardPlegable, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { FiltroFechas, resolverRango } from "@/components/filtro-fechas";
import { Variacion } from "@/components/variacion";
import { Campo, Nota } from "@/components/campos";
import { crearCosecha } from "@/lib/actions";
import { fechaBreve, fechaLarga, hoyISO, m2, numero } from "@/lib/format";
import { Formulario, Guardar } from "@/components/guardar";

export const dynamic = "force-dynamic";

export default async function CosechaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp);
  const supabase = await createClient();
  const hoy = hoyISO();

  const [
    { data: lotes },
    { data: pedidos },
    { data: cosechas },
    { data: config },
    { data: enCurso },
    { data: cosechasAntes },
  ] = await Promise.all([
      supabase.from("lotes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("v_pedidos_pendientes")
        .select("id, comprador, m2, fecha_entrega, lote")
        .order("fecha_entrega"),
      supabase
        .from("v_cosechas")
        .select("*")
        .gte("fecha", rango.desde)
        .lte("fecha", rango.hasta)
        .order("fecha", { ascending: false }),
      supabase
        .from("config")
        .select("clave, valor")
        .in("clave", ["pan_largo_m", "pan_ancho_m", "panes_por_pila"]),
      // Las abiertas van sin filtro de fecha: una cosecha que quedó a
      // medio contar la semana pasada te sigue importando hoy, aunque
      // estés mirando otro período.
      supabase.from("v_cosechas").select("objetivo_m2, m2_cosechados").eq("estado", "abierta"),
      // El mismo tramo una vuelta para atrás, para la flechita.
      supabase
        .from("v_cosechas")
        .select("m2_cosechados")
        .gte("fecha", rango.anterior.desde)
        .lte("fecha", rango.anterior.hasta),
    ]);

  const cfg = new Map((config ?? []).map((c: any) => [c.clave, c.valor]));
  const largo = Number(cfg.get("pan_largo_m") ?? 0.62);
  const ancho = Number(cfg.get("pan_ancho_m") ?? 0.4);
  const porPila = Number(cfg.get("panes_por_pila") ?? 2);
  const m2Pan = largo * ancho;

  const lista = (cosechas ?? []) as any[];

  // Lo que salió del campo en el período elegido, esté la cosecha abierta
  // o cerrada: es el número que dice cuánto se cortó.
  const m2Periodo = lista.reduce((a, c) => a + Number(c.m2_cosechados ?? 0), 0);
  const m2Antes = ((cosechasAntes ?? []) as any[]).reduce(
    (a, c) => a + Number(c.m2_cosechados ?? 0),
    0,
  );
  const contra = rango.anterior.etiqueta;

  const abiertas = (enCurso ?? []) as any[];
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

      <div className="mb-3">
        <FiltroFechas base="/ventas/cosecha" activo={sp.p} rango={rango} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="m² cosechados"
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
          label="Cosechas abiertas"
          valor={numero(abiertas.length)}
          tono={abiertas.length > 0 ? "ambar" : "neutro"}
          detalle="En curso, de cualquier fecha"
        />
        <Stat
          label="m² que faltan"
          valor={m2(faltan)}
          tono={faltan > 0 ? "ambar" : "neutro"}
          detalle="Para cerrar las abiertas"
        />
        <Stat
          label="Pan actual"
          valor={`${numero(m2Pan, 3)} m²`}
          detalle={`${numero(largo, 2)} × ${numero(ancho, 2)} m · ${porPila} por pila`}
        />
      </div>

      <div className="mt-3 space-y-3">
        <CardPlegable
          titulo="Nueva cosecha"
          bajada="Elegí el pedido, el lote y la medida del pan"
        >
          {/* En una pantalla grande la grilla estiraba cada campo a
              trescientos y pico de píxeles: un recuadro enorme para
              escribir "2". Con el tope, el campo queda del tamaño de lo
              que entra adentro. */}
          <Formulario
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
              <Guardar className="btn btn-alto sm:w-auto">Empezar la cosecha</Guardar>
            </div>
          </Formulario>
          <p className="mt-3 text-sm text-tinta-2">
            Si elegís un pedido, el objetivo se toma de sus m². Las medidas del pan vienen de
            Ajustes: cambialas acá si hoy cortás distinto, y quedan guardadas en esta cosecha.
          </p>
        </CardPlegable>

        <Card titulo={`Cosechas · ${rango.etiqueta.toLowerCase()}`}>
          <Tabla
            columnas={[
              { titulo: "Fecha", desde: "sm" },
              // Para quién es, y nada más: el lote ya se ve adentro de la
              // cosecha y acá solo robaba ancho.
              { titulo: "Cliente" },
              // Cuánto salió del campo es el dato de esta pantalla, así que
              // va en su propia columna y no escondido en un "404/400".
              { titulo: "m² cosechados", num: true },
              { titulo: "Objetivo", desde: "sm", num: true },
              { titulo: "Estado" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
            vacio="No hay cosechas en este período."
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
                  <td className="td max-w-0 sm:max-w-none">
                    <span className="block truncate">{c.comprador ?? "Sin pedido"}</span>
                    <span className="block truncate text-xs text-tinta-3 sm:hidden">
                      {fechaBreve(c.fecha)}
                    </span>
                  </td>
                  <td className="td td-num font-semibold text-pasto">
                    <Dato
                      principal={numero(cortado)}
                      secundario={falta > 0 ? `faltan ${numero(falta)}` : "completada"}
                    />
                  </td>
                  <td className="td td-num hidden text-tinta-2 sm:table-cell">
                    {numero(objetivo)}
                  </td>
                  <td className="td">
                    <Chip tono={c.estado === "cerrada" ? "verde" : "ambar"}>{c.estado}</Chip>
                  </td>
                  {/* El lápiz entra a la cosecha: ahí se sigue contando o
                      se cierra, según cómo esté. */}
                  <td className="td text-right">
                    {/* En el celular el ícono solo; en la compu un botón
                        que dice qué hace, igual que en Ventas. */}
                    <Link
                      href={`/ventas/cosecha/${c.id}`}
                      aria-label={`Editar la cosecha del ${fechaBreve(c.fecha)}`}
                      className={
                        "inline-flex size-11 items-center justify-center rounded-full " +
                        "text-tinta-2 transition hover:bg-beige hover:text-pasto " +
                        "sm:size-auto sm:gap-1.5 sm:rounded-full sm:border sm:border-borde-boton " +
                        "sm:px-3 sm:py-1 sm:text-xs sm:font-bold sm:hover:border-pasto"
                      }
                    >
                      <Icono nombre="editar" className="size-[18px] sm:size-4" />
                      <span className="hidden sm:inline">Editar</span>
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
