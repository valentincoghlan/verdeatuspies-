import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Campo } from "@/components/campos";
import { AvisosCelular } from "@/components/avisos-celular";
import {
  borrarSuscripcion,
  cambiarAvisoMail,
  cambiarPassword,
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

      <Card titulo="Mi contraseña">
        <p className="mb-3 text-sm text-tierra-600">
          Entrás con <strong>{user?.email}</strong>. Con una contraseña entrás directo, sin esperar
          el link por mail.
        </p>
        <form action={cambiarPassword} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Contraseña nueva" name="clave" type="password" required />
          <Campo label="Repetila" name="clave2" type="password" required />
          <div className="col-span-2 flex items-end">
            <button className="btn">Guardar contraseña</button>
          </div>
        </form>
        {resultado === "ok" && (
          <p className="mt-3 text-xs font-semibold text-hoja-700">
            Listo. La próxima vez entrá con tu mail y esta contraseña.
          </p>
        )}
        {resultado === "corta" && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            Tiene que tener al menos 8 caracteres.
          </p>
        )}
        {resultado === "distintas" && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            Las dos contraseñas no coinciden.
          </p>
        )}
        {resultado === "error" && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            No se pudo guardar. Probá de nuevo.
          </p>
        )}
        <p className="mt-3 text-xs text-tierra-600">
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
            className="h-4 w-4 rounded border-tierra-200"
          />
          <label htmlFor="notificar_mail" className="text-sm">
            Quiero recibir las alertas por mail
          </label>
          <button className="btn-ghost">Guardar</button>
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          Las alertas del día se juntan en un solo mail: entregas, lluvias a confirmar,
          fertilizaciones y cortes atrasados.
        </p>
      </Card>
    </>
  );
}
