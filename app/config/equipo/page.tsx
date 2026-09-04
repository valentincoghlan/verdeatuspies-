import { createClient } from "@/lib/supabase/server";
import { Card, Chip, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { agregarMiembro, quitarMiembro } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ConfigEquipoPage() {
  const supabase = await createClient();

  const [{ data: miembros }, { data: perfiles }] = await Promise.all([
    supabase.from("miembros_habilitados").select("*").order("email"),
    supabase.from("perfiles").select("*").order("email"),
  ]);

  return (
    <Card titulo="Quién puede entrar">
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
          <button className="btn">Habilitar mail</button>
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

      <p className="mt-3 text-xs text-tierra-600">
        Solo entra a la app quien esté en esta lista. <strong>Admin</strong> puede dar de alta y de
        baja gente; <strong>Operador</strong> usa la app pero no toca esta pantalla.
      </p>
      <p className="mt-2 text-xs text-tierra-400">
        Cada uno entra la primera vez con el link por mail y después se pone su propia contraseña
        en Mi cuenta.
      </p>
    </Card>
  );
}
