import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Tabla } from "@/components/ui";
import { Campo, Nota, Selector } from "@/components/campos";
import {
  agregarMiembro,
  asignarZonaALote,
  cambiarAvisoMail,
  guardarConfig,
  guardarLote,
  guardarZona,
  quitarMiembro,
  sincronizarAhora,
} from "@/lib/actions";
import { fechaLarga, numero } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: config },
    { data: lotes },
    { data: zonas },
    { data: miembros },
    { data: perfiles },
    { data: snapshots },
  ] = await Promise.all([
    supabase.from("config").select("clave, valor"),
    supabase.from("lotes").select("*").order("nombre"),
    supabase.from("riego_zonas").select("*, lotes(nombre)").order("nombre"),
    supabase.from("miembros_habilitados").select("*").order("email"),
    supabase.from("perfiles").select("*").order("email"),
    supabase
      .from("hydrawise_snapshots")
      .select("id, creados, error, created_at")
      .order("id", { ascending: false })
      .limit(5),
  ]);

  const c = new Map<string, any>((config ?? []).map((r: any) => [r.clave, r.valor]));
  const ubicacion = c.get("ubicacion") ?? { nombre: "Cardales", lat: -34.3167, lon: -58.9667 };
  const miPerfil = (perfiles ?? []).find((p: any) => p.id === user?.id);
  const opcionesLotes = (lotes ?? []).map((l: any) => ({ value: l.id, label: l.nombre }));

  return (
    <>
      <PageHeader
        titulo="Configuración"
        bajada="Lotes, zonas de riego, integraciones y equipo."
        accion={
          <form action={sincronizarAhora}>
            <button className="btn-ghost">Sincronizar ahora</button>
          </form>
        }
      />

      <div className="space-y-4">
        <Card titulo="Integraciones y alertas">
          <form action={guardarConfig} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo
              label="API key de Hydrawise"
              name="hydrawise_api_key"
              defaultValue={String(c.get("hydrawise_api_key") ?? "")}
              placeholder="pegá la key acá"
              className="col-span-2"
            />
            <Campo
              label="Umbral de lluvia (mm)"
              name="umbral_lluvia_mm"
              type="number"
              step="0.5"
              defaultValue={Number(c.get("umbral_lluvia_mm") ?? 2)}
            />
            <Campo
              label="Aviso fertilización (días antes)"
              name="aviso_fertilizacion_dias"
              type="number"
              defaultValue={Number(c.get("aviso_fertilizacion_dias") ?? 3)}
            />
            <Campo label="Ubicación" name="ubicacion_nombre" defaultValue={ubicacion.nombre} />
            <Campo label="Latitud" name="lat" type="number" step="0.0001" defaultValue={ubicacion.lat} />
            <Campo label="Longitud" name="lon" type="number" step="0.0001" defaultValue={ubicacion.lon} />
            <Campo
              label="Precio por m² sugerido"
              name="precio_m2_default"
              type="number"
              defaultValue={Number(c.get("precio_m2_default") ?? 0)}
            />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn">Guardar configuración</button>
            </div>
          </form>
          <p className="mt-3 text-xs text-tierra-400">
            La API key se saca de Hydrawise → Menú → Account Details → Account Settings →
            Generate API Key. La API de Hydrawise no expone el historial completo de riegos:
            trae zonas, próximo riego y zonas corriendo. Cuanto más seguido corra el sync, más
            fino queda el detalle de minutos.
          </p>
        </Card>

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
        </Card>

        <Card titulo="Zonas de riego">
          <form action={guardarZona} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Nombre" name="nombre" required placeholder="Zona 1" />
            <Selector label="Lote" name="lote_id" vacio="Sin asignar" opciones={opcionesLotes} />
            <Campo label="Controller ID Hydrawise" name="hydrawise_controller_id" />
            <Campo label="Relay ID Hydrawise" name="hydrawise_relay_id" />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn-ghost">Agregar zona</button>
            </div>
          </form>
          <Tabla
            cabeceras={["Zona", "Lote", "Controller", "Relay", "Asignar a lote"]}
            vacio="Sin zonas. Se crean solas cuando sincronizás Hydrawise."
          >
            {(zonas ?? []).map((z: any) => (
              <tr key={z.id}>
                <td className="td font-medium">{z.nombre}</td>
                <td className="td">{z.lotes?.nombre ?? <Chip tono="ambar">Sin asignar</Chip>}</td>
                <td className="td text-xs text-tierra-600">{z.hydrawise_controller_id ?? "—"}</td>
                <td className="td text-xs text-tierra-600">{z.hydrawise_relay_id ?? "—"}</td>
                <td className="td">
                  <form action={asignarZonaALote} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={z.id} />
                    <select name="lote_id" defaultValue={z.lote_id ?? ""} className="input w-40 py-1">
                      <option value="">Sin asignar</option>
                      {opcionesLotes.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button className="text-xs font-semibold text-hoja-700 hover:underline">
                      Guardar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Equipo">
          <form action={agregarMiembro} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Mail" name="email" type="email" required className="col-span-2" />
            <Campo label="Nombre" name="nombre" />
            <Selector
              label="Rol"
              name="rol"
              defaultValue="operador"
              opciones={[
                { value: "operador", label: "Operador" },
                { value: "admin", label: "Admin" },
              ]}
            />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn-ghost">Habilitar mail</button>
            </div>
          </form>
          <Tabla cabeceras={["Mail habilitado", "Nombre", "Rol", "Estado", ""]}>
            {(miembros ?? []).map((m: any) => {
              const p = (perfiles ?? []).find(
                (x: any) => x.email?.toLowerCase() === m.email.toLowerCase(),
              );
              return (
                <tr key={m.email}>
                  <td className="td font-medium">{m.email}</td>
                  <td className="td">{m.nombre ?? "—"}</td>
                  <td className="td">
                    <Chip tono={m.rol === "admin" ? "verde" : "neutro"}>{m.rol}</Chip>
                  </td>
                  <td className="td">
                    {p?.activo ? <Chip tono="verde">activo</Chip> : <Chip tono="ambar">sin entrar</Chip>}
                  </td>
                  <td className="td text-right">
                    <form action={quitarMiembro}>
                      <input type="hidden" name="email" value={m.email} />
                      <button className="text-xs font-semibold text-tierra-400 hover:text-red-600">
                        Quitar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <form action={cambiarAvisoMail} className="mt-4 flex items-center gap-2">
            <input
              id="notificar_mail"
              name="notificar_mail"
              type="checkbox"
              defaultChecked={miPerfil?.notificar_mail ?? true}
              className="h-4 w-4 rounded border-tierra-200"
            />
            <label htmlFor="notificar_mail" className="text-sm">
              Quiero recibir las alertas por mail
            </label>
            <button className="text-xs font-semibold text-hoja-700 hover:underline">Guardar</button>
          </form>
        </Card>

        <Card titulo="Últimas sincronizaciones con Hydrawise">
          <Tabla cabeceras={["Cuándo", "Riegos nuevos", "Error"]} vacio="Todavía no se sincronizó.">
            {(snapshots ?? []).map((s: any) => (
              <tr key={s.id}>
                <td className="td whitespace-nowrap">
                  {fechaLarga(s.created_at?.slice(0, 10))}{" "}
                  <span className="text-xs text-tierra-400">
                    {new Date(s.created_at).toLocaleTimeString("es-AR", {
                      timeZone: "America/Argentina/Buenos_Aires",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </td>
                <td className="td tabular-nums">{numero(s.creados)}</td>
                <td className="td text-xs text-red-600">{s.error ?? "—"}</td>
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
