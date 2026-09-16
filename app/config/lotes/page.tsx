import { createClient } from "@/lib/supabase/server";
import { Card, Chip, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { CalculadoraCaudal } from "@/components/calculadora-caudal";
import { AspersoresZonas } from "@/components/aspersores-zona";
import { asignarZonas, guardarLote, guardarZona } from "@/lib/actions";
import { caudalDeZona, origenDelCaudal } from "@/lib/caudal";
import { numero } from "@/lib/format";
import { Formulario, Guardar } from "@/components/guardar";

export const dynamic = "force-dynamic";

export default async function ConfigLotesPage() {
  const supabase = await createClient();

  const [{ data: lotes }, { data: zonas }, { data: caudales }, { data: boquillas }, { data: puestos }] =
    await Promise.all([
      supabase.from("lotes").select("*").order("nombre"),
      supabase.from("riego_zonas").select("*, lotes(nombre)").order("nombre"),
      supabase.from("v_caudal_zonas").select("*"),
      supabase.from("boquillas").select("modelo, numero, bar, litros_hora"),
      supabase.from("zona_aspersores").select("zona_id, modelo, numero, cantidad"),
    ]);

  const opcionesLotes = (lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }));
  const sinAsignar = (zonas ?? []).filter((z: any) => !z.lote_id).length;

  // El caudal de cada zona, para no recorrer la lista dentro del render.
  const porZona = new Map((caudales ?? []).map((c: any) => [c.zona_id, c]));

  const zonasConAspersores = (zonas ?? []).map((z: any) => ({
    id: z.id as string,
    nombre: z.nombre as string,
    lote: (z.lotes?.nombre ?? null) as string | null,
    presion_bar: z.presion_bar ?? null,
    presion_medida: Boolean(z.presion_medida),
    superficie_m2: z.superficie_m2 ?? null,
    aspersores: (puestos ?? [])
      .filter((p: any) => p.zona_id === z.id)
      .map((p: any) => ({ modelo: p.modelo, numero: p.numero, cantidad: Number(p.cantidad) })),
  }));

  return (
    <>
      <Card titulo="Lotes">
        <Formulario action={guardarLote} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Nombre" name="nombre" required placeholder="Nuevo lote" />
          <Campo label="Superficie (m²)" name="superficie_m2" type="number" />
          <Campo
            label="Objetivo de corte (días)"
            name="dias_objetivo_corte"
            type="number"
            defaultValue={14}
          />
          <div className="col-span-2 flex items-end sm:col-span-4">
            <Guardar className="btn-ghost btn-alto sm:w-auto">Agregar lote</Guardar>
          </div>
        </Formulario>
        <Tabla
            columnas={[
              { titulo: "Lote" },
              { titulo: "Superficie (m²)" },
              { titulo: "Cortar cada (días)" },
              { titulo: "", ancho: "w-16 sm:w-auto" },
            ]}
          >
          {(lotes ?? []).map((l: any) => (
            <tr key={l.id}>
              <td className="td font-medium">
                {l.nombre}
                <Formulario id={`lote-${l.id}`} action={guardarLote}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="nombre" value={l.nombre} />
                </Formulario>
              </td>
              <td className="td">
                <input
                  form={`lote-${l.id}`}
                  name="superficie_m2"
                  type="number"
                  defaultValue={l.superficie_m2 ?? ""}
                  placeholder="Sin cargar"
                  aria-label={`Superficie de ${l.nombre}`}
                  className="input w-full min-w-0"
                />
              </td>
              <td className="td">
                <input
                  form={`lote-${l.id}`}
                  name="dias_objetivo_corte"
                  type="number"
                  defaultValue={l.dias_objetivo_corte}
                  aria-label={`Objetivo de corte de ${l.nombre}`}
                  className="input w-full min-w-0"
                />
              </td>
              <td className="td text-right">
                <button
                  form={`lote-${l.id}`}
                  className="whitespace-nowrap text-xs font-bold text-pasto hover:underline"
                >
                  Guardar
                </button>
              </td>
            </tr>
          ))}
        </Tabla>
        <p className="mt-3 text-sm text-tinta-2">
          El <strong>objetivo de corte</strong> es cada cuántos días querés cortar ese lote. Si se
          pasa, te llega un aviso de corte atrasado.
        </p>
      </Card>

      <Card titulo="Zonas de riego">
        {sinAsignar > 0 && (
          <p className="mb-3 text-sm font-semibold text-atencion-tx">
            Hay {sinAsignar} zona{sinAsignar === 1 ? "" : "s"} sin lote asignado. Los riegos que
            lleguen de Hydrawise no van a caer en ningún lote hasta que las asignes.
          </p>
        )}
        <Formulario action={guardarZona} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Nombre" name="nombre" required placeholder="Zona 1" />
          <Selector label="Lote" name="lote_id" vacio="Sin asignar" opciones={opcionesLotes} />
          <Campo label="Controller ID Hydrawise" name="hydrawise_controller_id" />
          <Campo label="Relay ID Hydrawise" name="hydrawise_relay_id" />
          <Campo label="Caudal (mm por hora)" name="mm_por_hora" type="number" step="0.5" placeholder="12" />
          <div className="col-span-2 flex items-end sm:col-span-4">
            <Guardar className="btn-ghost btn-alto sm:w-auto">Agregar zona</Guardar>
          </div>
        </Formulario>
        <Formulario action={asignarZonas}>
          <Tabla
            columnas={[
              { titulo: "Zona" },
              { titulo: "Hydrawise", desde: "sm" },
              { titulo: "Lote" },
              { titulo: "mm por hora" },
            ]}
            vacio="Sin zonas. Se crean solas cuando sincronizás Hydrawise."
          >
            {(zonas ?? []).map((z: any) => (
              <tr key={z.id}>
                <td className="td font-medium">
                  {z.nombre}
                  {!z.lote_id && (
                    <span className="ml-2">
                      <Chip tono="ambar">sin asignar</Chip>
                    </span>
                  )}
                </td>
                <td className="td hidden text-xs text-tinta-3 sm:table-cell">
                  {z.hydrawise_relay_id ? `relay ${z.hydrawise_relay_id}` : "carga manual"}
                </td>
                <td className="td">
                  <select
                    name={`lote_${z.id}`}
                    defaultValue={z.lote_id ?? ""}
                    aria-label={`Lote de ${z.nombre}`}
                    className="input w-full min-w-0"
                  >
                    <option value="">Sin asignar</option>
                    {opcionesLotes.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                {/* Si la zona tiene sus aspersores cargados, el caudal
                    sale de la ficha y el campo a mano desaparece: dos
                    números editables para lo mismo es pedir que queden
                    distintos. */}
                <td className="td">
                  {origenDelCaudal(porZona.get(z.id)) === "aspersores" ? (
                    <span className="tabular-nums">
                      {numero(caudalDeZona(porZona.get(z.id))!, 1)}
                      <span className="block text-[11px] text-tinta-3">de los aspersores</span>
                    </span>
                  ) : (
                    <input
                      name={`caudal_${z.id}`}
                      aria-label={`Caudal de ${z.nombre}`}
                      type="number"
                      step="0.5"
                      min="0"
                      defaultValue={z.mm_por_hora ?? ""}
                      placeholder="—"
                      className="input w-full min-w-0"
                    />
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
          {(zonas ?? []).length > 0 && (
            <div className="mt-4">
              <Guardar className="btn btn-alto sm:w-auto">Guardar todas las zonas</Guardar>
            </div>
          )}
        </Formulario>
        <p className="mt-3 text-sm text-tinta-2">
          Elegí el lote de cada zona y guardá todas juntas con el botón de abajo. Las zonas las
          crea sola la app cuando sincroniza con Hydrawise.
        </p>
        <p className="mt-2 text-sm text-tinta-2">
          El <strong>caudal (mm por hora)</strong> es cuánta agua tira esa zona. Con ese número la
          app pasa los minutos a milímetros y el riego entra en el balance de agua, al lado de la
          lluvia. Lo mejor es cargar los aspersores acá abajo y que salga solo; el campo a mano
          queda para las zonas que todavía no tengan la ficha.
        </p>
        <CalculadoraCaudal />
      </Card>

      <Card titulo="Aspersores de cada zona">
        <p className="mb-3 text-sm text-tinta-2">
          Cuántos aspersores de cada pico tiene la zona y a qué presión trabaja. Con eso la app
          saca el caudal de la ficha de Hunter y no hace falta medirlo con vasos: cambiás un pico y
          el número se corrige solo.
        </p>
        <p className="mb-3 text-sm text-tinta-2">
          La <strong>presión</strong> hoy está estimada: la bomba da entre 4 y 5 bar y la app le
          pone menos a las líneas que más agua piden, que son las que más pierden por el caño.
          Cuando la midas con un manómetro, escribila y marcá la casilla: esa queda fija.
        </p>
        <AspersoresZonas
          zonas={zonasConAspersores}
          ficha={(boquillas ?? []) as any}
        />
        <p className="mt-3 text-sm text-tinta-2">
          La <strong>superficie que moja</strong> es el marco entre aspersores por cuántos hay: si
          están en cuadro cada 12 m, cada uno cubre 144 m². Si la dejás vacía, la app reparte la
          superficie del lote entre sus zonas según cuántos aspersores tiene cada una, que para
          zonas parejas alcanza. El número que sale es el teórico: en la cancha suele rendir entre
          un 10 y un 25% menos, porque el agua no cae perfectamente pareja.
        </p>
      </Card>
    </>
  );
}
