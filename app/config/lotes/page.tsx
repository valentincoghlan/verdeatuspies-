import { createClient } from "@/lib/supabase/server";
import { Card, Chip, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { CalculadoraCaudal } from "@/components/calculadora-caudal";
import { asignarZonas, guardarLote, guardarZona } from "@/lib/actions";
import { numero } from "@/lib/format";

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
          <div className="flex items-end">
            <button className="btn-ghost">Agregar lote</button>
          </div>
        </form>
        <Tabla cabeceras={["Lote", "Superficie", "Objetivo corte", "Editar"]}>
          {(lotes ?? []).map((l: any) => (
            <tr key={l.id}>
              <td className="td font-medium">{l.nombre}</td>
              <td className="td tabular-nums">{numero(l.superficie_m2)}</td>
              <td className="td tabular-nums">cada {l.dias_objetivo_corte} días</td>
              <td className="td">
                <form action={guardarLote} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="nombre" value={l.nombre} />
                  <input
                    name="superficie_m2"
                    type="number"
                    defaultValue={l.superficie_m2 ?? ""}
                    placeholder="m²"
                    className="input w-28 py-1"
                  />
                  <input
                    name="dias_objetivo_corte"
                    type="number"
                    defaultValue={l.dias_objetivo_corte}
                    className="input w-20 py-1"
                  />
                  <button className="text-xs font-semibold text-hoja-700 hover:underline">
                    Guardar
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </Tabla>
        <p className="mt-3 text-xs text-tierra-600">
          El <strong>objetivo de corte</strong> es cada cuántos días querés cortar ese lote. Si se
          pasa, te llega un aviso de corte atrasado.
        </p>
      </Card>

      <Card titulo="Zonas de riego">
        {sinAsignar > 0 && (
          <p className="mb-3 text-xs font-semibold text-amber-700">
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
            <button className="btn-ghost">Agregar zona</button>
          </div>
        </form>
        <form action={asignarZonas}>
          <Tabla
            cabeceras={["Zona", "Hydrawise", "Lote", "mm por hora"]}
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
                <td className="td text-xs text-tierra-400">
                  {z.hydrawise_relay_id ? `relay ${z.hydrawise_relay_id}` : "carga manual"}
                </td>
                <td className="td">
                  <select
                    name={`lote_${z.id}`}
                    defaultValue={z.lote_id ?? ""}
                    className="input w-40 py-1"
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
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={z.mm_por_hora ?? ""}
                    placeholder="—"
                    className="input w-24 py-1"
                  />
                </td>
              </tr>
            ))}
          </Tabla>
          {(zonas ?? []).length > 0 && (
            <div className="mt-4">
              <button className="btn">Guardar todas las zonas</button>
            </div>
          )}
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          Elegí el lote de cada zona y guardá todas juntas con el botón de abajo. Las zonas las
          crea sola la app cuando sincroniza con Hydrawise.
        </p>
        <p className="mt-2 text-xs text-tierra-600">
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
