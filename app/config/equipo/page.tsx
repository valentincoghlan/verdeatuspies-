import { createClient } from "@/lib/supabase/server";
import { Card, Chip, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { agregarMiembro, cambiarRol, quitarMiembro } from "@/lib/actions";
import { esAdmin, PERMISOS } from "@/lib/rol";
import { Acciones } from "@/components/acciones";

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
            columnas={[
              { titulo: "Mail habilitado" },
              { titulo: "Nombre", desde: "sm" },
              { titulo: "Rol" },
              { titulo: "Estado", desde: "sm" },
              { titulo: "", ancho: "w-11 sm:w-auto" },
            ]}
          >
          {(miembros ?? []).map((m: any) => {
            const p = (perfiles ?? []).find(
              (x: any) => x.email?.toLowerCase() === m.email.toLowerCase(),
            );
            return (
              <tr key={m.email}>
                <td className="td max-w-0 font-medium">
                  <span className="block truncate" title={m.email}>
                    {m.email}
                  </span>
                  <span className="block truncate text-xs font-normal text-tinta-3 sm:hidden">
                    {m.nombre ? `${m.nombre} · ` : ""}
                    {p?.activo ? "activo" : "sin entrar"}
                  </span>
                </td>
                <td className="td">{m.nombre ?? "—"}</td>
                <td className="td">
                  {/* En el celular solo el chip: el select con su botón al
                      lado no entra y salía como "Ca…". Se cambia desde el
                      menú de acciones. */}
                  <span className="sm:hidden">
                    <Chip tono={m.rol === "admin" ? "verde" : "neutro"}>
                      {m.rol === "admin" ? "dueño" : "operador"}
                    </Chip>
                  </span>
                  <span className="hidden sm:block">
                    {admin ? (
                      <form action={cambiarRol} className="flex items-center gap-2">
                        <input type="hidden" name="email" value={m.email} />
                        <select
                          name="rol"
                          defaultValue={m.rol}
                          aria-label={`Rol de ${m.email}`}
                          className="input w-32 min-w-0"
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
                  </span>
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
                    <Acciones titulo={m.nombre ?? m.email}>
                      <form action={cambiarRol} className="flex items-center gap-2 sm:hidden">
                        <input type="hidden" name="email" value={m.email} />
                        <select
                          name="rol"
                          defaultValue={m.rol}
                          aria-label={`Rol de ${m.email}`}
                          className="input min-w-0 flex-1"
                        >
                          <option value="operador">Operador</option>
                          <option value="admin">Dueño</option>
                        </select>
                        <button className="shrink-0 whitespace-nowrap text-sm font-bold text-pasto">
                          Cambiar
                        </button>
                      </form>
                      <form action={quitarMiembro}>
                        <input type="hidden" name="email" value={m.email} />
                        <button className="whitespace-nowrap text-xs font-semibold text-tinta-3 hover:text-urgente-tx">
                          Quitar
                        </button>
                      </form>
                    </Acciones>
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
        <Tabla
            columnas={[
              { titulo: "Tarea" },
              { titulo: "Operador" },
              { titulo: "Dueño" },
            ]}
          >
          {PERMISOS.map((x) => (
            <tr key={x.tarea}>
              <td className="td td-envuelve">{x.tarea}</td>
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
