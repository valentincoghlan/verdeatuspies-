import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Campo } from "@/components/campos";
import { AvisosCelular } from "@/components/avisos-celular";
import { AVISOS, GRUPOS } from "@/lib/avisos";
import {
  borrarSuscripcion,
  cambiarAvisoMail,
  cambiarPassword,
  guardarAvisos,
  guardarSuscripcion,
  probarAviso,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ConfigCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ clave?: string; aviso?: string }>;
}) {
  const { clave: resultado, aviso } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: miPerfil } = await supabase
    .from("perfiles")
    .select("notificar_mail")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { count: telefonos } = await supabase
    .from("push_suscripciones")
    .select("id", { count: "exact", head: true });

  const { data: miPerfilAvisos } = await supabase
    .from("perfiles")
    .select("avisos_apagados, mails_apagados")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const pushApagados: string[] = (miPerfilAvisos as any)?.avisos_apagados ?? [];
  const mailApagados: string[] = (miPerfilAvisos as any)?.mails_apagados ?? [];

  return (
    <>
      <Card titulo="Avisos en el celular">
        <p className="mb-3 text-sm text-tinta-2">
          Un aviso apenas arranca a regar una zona, aunque tengas la app cerrada. Sin instalar
          nada de terceros: usa las notificaciones del propio teléfono.
        </p>

        {aviso && (
          <p className="mb-3 rounded-xl bg-hecho-bg p-3 text-sm text-pasto-oscuro">{aviso}</p>
        )}

        <AvisosCelular
          clavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          guardar={guardarSuscripcion}
          borrar={borrarSuscripcion}
        />

        {(telefonos ?? 0) > 0 && (
          <form action={probarAviso} className="mt-3 border-t border-beige pt-3">
            <button className="btn-ghost">Mandar un aviso de prueba</button>
            <span className="ml-3 text-xs text-tinta-3">
              {telefonos} teléfono{telefonos === 1 ? "" : "s"} registrado
              {telefonos === 1 ? "" : "s"}
            </span>
          </form>
        )}
      </Card>

      <Card titulo="Qué avisos quiero recibir">
        <p className="mb-4 text-sm text-tinta-2">
          Elegís qué te llega y por dónde. Es tuyo: lo que apagues acá no le cambia nada a Miguel
          ni a Pedro, y las alertas se siguen viendo dentro de la app igual.
        </p>

        <form action={guardarAvisos}>
          {AVISOS.map((a) => (
            <input key={a.tipo} type="hidden" name="todos" value={a.tipo} />
          ))}
          {AVISOS.map((a) => (
            <input key={a.tipo} type="hidden" name="con_mail" value={a.tipo} />
          ))}

          <div className="space-y-4">
            {GRUPOS.map((grupo) => (
              <div key={grupo}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-tinta-3">
                  {grupo}
                </p>
                <ul className="space-y-1.5">
                  {AVISOS.filter((a) => a.grupo === grupo).map((a) => (
                    <li key={a.tipo} className="rounded-xl border border-borde bg-crema p-3">
                      <p className="text-sm font-semibold text-tinta">{a.titulo}</p>
                      <p className="mt-0.5 text-xs text-tinta-2">{a.detalle}</p>

                      {/* Las dos casillas abajo y a lo ancho: en el
                          celular, tres columnas dejaban el nombre del
                          aviso en una tira finita. */}
                      <div className="mt-2 flex gap-2">
                        <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg bg-white px-3">
                          <input
                            type="checkbox"
                            name="push"
                            value={a.tipo}
                            defaultChecked={!pushApagados.includes(a.tipo)}
                            className="size-5 accent-pasto"
                          />
                          <span className="text-sm font-semibold text-tinta-2">Celular</span>
                        </label>

                        <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg bg-white px-3">
                          <input
                            type="checkbox"
                            name="mail"
                            value={a.tipo}
                            defaultChecked={!mailApagados.includes(a.tipo)}
                            className="size-5 accent-pasto"
                          />
                          <span className="text-sm font-semibold text-tinta-2">Mail</span>
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>



          <div className="mt-4">
            <button className="btn btn-alto">Guardar avisos</button>
          </div>
        </form>
      </Card>

      <Card titulo="Mi contraseña">
        <p className="mb-3 text-sm text-tinta-2">
          Entrás con <strong>{user?.email}</strong>. Con una contraseña entrás directo, sin esperar
          el link por mail.
        </p>
        <form action={cambiarPassword} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Contraseña nueva" name="clave" type="password" required />
          <Campo label="Repetila" name="clave2" type="password" required />
          <div className="col-span-2 flex items-end">
            <button className="btn btn-alto sm:w-auto">Guardar contraseña</button>
          </div>
        </form>
        {resultado === "ok" && (
          <p className="mt-3 text-xs font-semibold text-pasto">
            Listo. La próxima vez entrá con tu mail y esta contraseña.
          </p>
        )}
        {resultado === "corta" && (
          <p className="mt-3 text-xs font-semibold text-urgente-tx">
            Tiene que tener al menos 8 caracteres.
          </p>
        )}
        {resultado === "distintas" && (
          <p className="mt-3 text-xs font-semibold text-urgente-tx">
            Las dos contraseñas no coinciden.
          </p>
        )}
        {resultado === "error" && (
          <p className="mt-3 text-xs font-semibold text-urgente-tx">
            No se pudo guardar. Probá de nuevo.
          </p>
        )}
        <p className="mt-3 text-xs text-tinta-2">
          Cada uno cambia solo la suya. Si te la olvidás, entrás con el link por mail y la volvés a
          poner acá.
        </p>
      </Card>

      <Card titulo="Mis avisos">
        <form action={cambiarAvisoMail} className="flex flex-wrap items-center gap-2">
          <input
            id="notificar_mail"
            name="notificar_mail"
            type="checkbox"
            defaultChecked={miPerfil?.notificar_mail ?? true}
            className="h-4 w-4 rounded border-borde"
          />
          <label htmlFor="notificar_mail" className="text-sm">
            Quiero recibir las alertas por mail
          </label>
          <button className="btn-ghost">Guardar</button>
        </form>
        <p className="mt-3 text-xs text-tinta-2">
          Las alertas del día se juntan en un solo mail: entregas, lluvias a confirmar,
          fertilizaciones y cortes atrasados.
        </p>
      </Card>
    </>
  );
}
