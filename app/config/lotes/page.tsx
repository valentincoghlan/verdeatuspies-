import { createClient } from "@/lib/supabase/server";
import { Card, Chip, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { CalculadoraCaudal } from "@/components/calculadora-caudal";
import { asignarZonas, guardarLote, guardarZona } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ConfigLotesPage() {
  const supabase = await createClient();

  const [{ data: lotes }, { data: zonas }] = await Promise.all([
    supabase.from("lotes").select("*").order("nombre"),
    supabase.from("riego_zonas").select("*, lotes(nombre)").order("nombre"),
  ]);

  const opcionesLotes = (lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }));
  const sinAsignar = (zonas ?? []).filter((z: any) => !z.lote_id).length;

  return (
    <>
      <Card titulo="Lotes">
        <form action={guardarLote} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Nombre" name="nombre" required placeholder="Nuevo lote" />
          <Campo label="Superficie (m²)" name="superficie_m2" type="number" />
          <Campo
            label="Objetivo de corte (días)"
            name="dias_objetivo_corte"
            type="number"
            defaultValue={14}
          />
          <div className="col-span-2 flex items-end sm:col-span-4">
            <button className="btn-ghost btn-alto sm:w-auto">Agregar lote</button>
          </div>
        </form>
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
                <form id={`lote-${l.id}`} action={guardarLote}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="nombre" value={l.nombre} />
                </form>
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
        <form action={guardarZona} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Nombre" name="nombre" required placeholder="Zona 1" />
          <Selector label="Lote" name="lote_id" vacio="Sin asignar" opciones={opcionesLotes} />
          <Campo label="Controller ID Hydrawise" name="hydrawise_controller_id" />
          <Campo label="Relay ID Hydrawise" name="hydrawise_relay_id" />
          <Campo label="Caudal (mm por hora)" name="mm_por_hora" type="number" step="0.5" placeholder="12" />
          <div className="col-span-2 flex items-end sm:col-span-4">
            <button className="btn-ghost btn-alto sm:w-auto">Agregar zona</button>
          </div>
        </form>
        <form action={asignarZonas}>
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
                <td className="td text-xs text-tinta-3">
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
                <td className="td">
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
                </td>
              </tr>
            ))}
          </Tabla>
          {(zonas ?? []).length > 0 && (
            <div className="mt-4">
              <button className="btn btn-alto sm:w-auto">Guardar todas las zonas</button>
            </div>
          )}
        </form>
        <p className="mt-3 text-sm text-tinta-2">
          Elegí el lote de cada zona y guardá todas juntas con el botón de abajo. Las zonas las
          crea sola la app cuando sincroniza con Hydrawise.
        </p>
        <p className="mt-2 text-sm text-tinta-2">
          El <strong>caudal (mm por hora)</strong> es cuánta agua tira esa zona. Con ese número la
          app pasa los minutos a milímetros y el riego entra en el balance de agua, al lado de la
          lluvia. Para medirlo: poné cuatro o cinco recipientes rectos repartidos en la zona, regá
          15 minutos, medí los milímetros que juntó cada uno, promedialos y multiplicá por 4.
        </p>
        <CalculadoraCaudal />
      </Card>
    </>
  );
}
