import { createClient } from "@/lib/supabase/server";
import { Card, Chip, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { agregarMiembro, cambiarRol, quitarMiembro } from "@/lib/actions";
import { esAdmin, PERMISOS } from "@/lib/rol";

export const dynamic = "force-dynamic";

export default async function ConfigEquipoPage() {
  const supabase = await createClient();

  const [{ data: miembros }, { data: perfiles }, admin] = await Promise.all([
    supabase.from("miembros_habilitados").select("*").order("email"),
    supabase.from("perfiles").select("*").order("email"),
    esAdmin(),
  ]);

  return (
    <div className="space-y-3">
      <Card titulo="Quién puede entrar">
        {admin && (
          <form action={agregarMiembro} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Mail" name="email" type="email" required className="col-span-2" />
            <Campo label="Nombre" name="nombre" />
            <Selector
              label="Rol"
              name="rol"
              defaultValue="operador"
              opciones={[
                { value: "operador", label: "Operador" },
                { value: "admin", label: "Dueño" },
              ]}
            />
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn btn-alto sm:w-auto">Habilitar mail</button>
            </div>
          </form>
        )}

        <Tabla
          cabeceras={["Mail habilitado", "Nombre", "Rol", "Estado", ""]}
          soloEnCompu={[1, 3]}
          anchos={[undefined, undefined, undefined, undefined, "w-14 sm:w-auto"]}
        >
          {(miembros ?? []).map((m: any) => {
            const p = (perfiles ?? []).find(
              (x: any) => x.email?.toLowerCase() === m.email.toLowerCase(),
            );
            return (
              <tr key={m.email}>
                <td className="td font-medium">
                  <span className="block break-all">{m.email}</span>
                  <span className="block text-xs font-normal text-tinta-3 sm:hidden">
                    {p?.activo ? "activo" : "sin entrar"}
                  </span>
                </td>
                <td className="td">{m.nombre ?? "—"}</td>
                <td className="td">
                  {admin ? (
                    // El rol se cambia acá mismo: antes había que sacar a
                    // la persona y volver a cargarla para moverla de lugar.
                    <form action={cambiarRol} className="flex items-center gap-2">
                      <input type="hidden" name="email" value={m.email} />
                      <select
                        name="rol"
                        defaultValue={m.rol}
                        aria-label={`Rol de ${m.email}`}
                        className="input w-full min-w-0 sm:w-32"
                      >
                        <option value="operador">Operador</option>
                        <option value="admin">Dueño</option>
                      </select>
                      <button className="shrink-0 whitespace-nowrap text-xs font-bold text-pasto hover:underline">
                        Cambiar
                      </button>
                    </form>
                  ) : (
                    <Chip tono={m.rol === "admin" ? "verde" : "neutro"}>
                      {m.rol === "admin" ? "dueño" : "operador"}
                    </Chip>
                  )}
                </td>
                <td className="td">
                  {p?.activo ? (
                    <Chip tono="verde">activo</Chip>
                  ) : (
                    <Chip tono="ambar">sin entrar</Chip>
                  )}
                </td>
                <td className="td text-right">
                  {admin && (
                    <form action={quitarMiembro}>
                      <input type="hidden" name="email" value={m.email} />
                      <button className="flex min-h-11 items-center whitespace-nowrap px-1 text-xs font-semibold text-tinta-3 hover:text-urgente-tx sm:min-h-8">
                        Quitar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </Tabla>

        <p className="mt-3 text-sm text-tinta-2">
          Solo entra a la app quien esté en esta lista. Cada uno entra la primera vez con el link
          por mail y después se pone su propia contraseña en Mi cuenta.
        </p>
        {!admin && (
          <p className="mt-2 text-sm text-tinta-3">
            Esta lista la maneja el dueño. Vos la ves, pero no la podés cambiar.
          </p>
        )}
      </Card>

      <Card titulo="Qué puede hacer cada rol">
        <Tabla cabeceras={["Tarea", "Operador", "Dueño"]}>
          {PERMISOS.map((x) => (
            <tr key={x.tarea}>
              <td className="td">{x.tarea}</td>
              <td className={"td text-center " + (x.admin ? "text-tinta-3" : "text-pasto")}>
                {x.admin ? "—" : "sí"}
              </td>
              <td className="td text-center font-semibold text-pasto">sí</td>
            </tr>
          ))}
        </Tabla>

        <p className="mt-3 text-sm text-tinta-2">
          El <strong>operador</strong> hace todo el día a día: el campo, la cosecha, los pedidos,
          las ventas y la carga de movimientos. El <strong>dueño</strong> además toca lo que cambia
          la estructura o deshace plata.
        </p>
        <p className="mt-2 text-sm text-tinta-3">
          Esta tabla es fija: sale del código, no se edita desde acá. Si querés mover una tarea de
          un rol al otro, avisame y la cambio.
        </p>
      </Card>
    </div>
  );
}
