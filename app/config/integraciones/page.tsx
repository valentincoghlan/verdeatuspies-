import { createClient } from "@/lib/supabase/server";
import { Card, Tabla } from "@/components/ui";
import { TextoLargo } from "@/components/texto-largo";
import { Campo } from "@/components/campos";
import { guardarConfig } from "@/lib/actions";
import { fechaBreve, fechaDM, numero } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConfigIntegracionesPage() {
  const supabase = await createClient();

  const [{ data: config }, { data: snapshots }] = await Promise.all([
    supabase.from("config").select("clave, valor").eq("clave", "hydrawise_api_key"),
    supabase
      .from("hydrawise_snapshots")
      .select("id, creados, error, created_at")
      .order("id", { ascending: false })
      .limit(5),
  ]);

  const apiKey = String((config ?? [])[0]?.valor ?? "");

  return (
    <>
      <Card titulo="Hydrawise">
        <form action={guardarConfig} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo
            label="API key de Hydrawise"
            name="hydrawise_api_key"
            defaultValue={apiKey}
            placeholder="pegá la key acá"
            className="col-span-2 sm:col-span-4"
          />
          <div className="col-span-2 sm:col-span-4">
            <button className="btn btn-alto sm:w-auto">Guardar</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          La key se saca de Hydrawise: <strong>Menú ☰ → Account Details → Account Settings →
          Generate API Key</strong>. Después tocá <strong>Sincronizar ahora</strong> y la app crea
          sola las zonas de tu controlador; asignales el lote en <strong>Lotes y zonas</strong>.
        </p>
        <p className="mt-2 text-xs text-tierra-400">
          Hydrawise no deja bajar el historial completo de riegos: la API da las zonas, el próximo
          riego programado y las que están corriendo en ese momento. Con la corrida diaria queda
          registrado si cada zona regó ese día, y los minutos son los del ciclo programado.
        </p>
      </Card>

      <Card titulo="Últimas sincronizaciones">
        <Tabla
            columnas={[
              { titulo: "Cuándo", ancho: "w-[5.2rem] sm:w-auto" },
              { titulo: "Riegos", align: "right", ancho: "w-14 sm:w-auto" },
              { titulo: "Error" },
            ]}
            vacio="Todavía no se sincronizó."
          >
          {(snapshots ?? []).map((s: any) => (
            <tr key={s.id}>
              <td className="td whitespace-nowrap">
                <span className="sm:hidden">{fechaDM(s.created_at?.slice(0, 10))}</span>
                <span className="hidden sm:inline">{fechaBreve(s.created_at?.slice(0, 10))}</span>{" "}
                <span className="text-xs text-tinta-3">
                  {new Date(s.created_at).toLocaleTimeString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </td>
              <td className="td text-right tabular-nums sm:text-left">{numero(s.creados)}</td>
              <td className="td">
                {s.error ? (
                  <span className="text-urgente-tx">
                    <TextoLargo texto={s.error} titulo="Error de la sincronización" />
                  </span>
                ) : (
                  <span className="text-xs text-tinta-3">—</span>
                )}
              </td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  );
}
