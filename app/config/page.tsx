import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Campo } from "@/components/campos";
import { guardarConfig } from "@/lib/actions";
import { esAdmin } from "@/lib/rol";
import { Formulario, Guardar } from "@/components/guardar";

export const dynamic = "force-dynamic";

/**
 * Una tarjeta de ajuste.
 *
 * Son cuatro cosas que se tocan una vez por año, y cada una ocupaba
 * cuatro renglones de alto: el título, la explicación a todo lo ancho,
 * los campos estirados y el botón solo abajo. En la compu la
 * explicación va al costado y los campos con el botón entran en una
 * sola línea, del ancho que necesitan y nada más. En el celular sigue
 * todo apilado, que es como se lee.
 */
function Ajuste({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card titulo={titulo}>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <p className="max-w-prose text-sm text-tinta-2">{ayuda}</p>
        {children}
      </div>
    </Card>
  );
}

/**
 * La línea de campos.
 *
 * `items-end` es lo que mantiene todo apoyado sobre la misma base: los
 * campos y el botón tienen alturas distintas, y sin eso el botón flota
 * medio renglón más arriba.
 */
function Fila({ admin, children }: { admin: boolean; children: ReactNode }) {
  return (
    <Formulario action={guardarConfig}>
      <fieldset
        disabled={!admin}
        className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
      >
        {children}
        {admin && (
          <Guardar className="btn btn-alto col-span-2 sm:w-auto">Guardar</Guardar>
        )}
      </fieldset>
    </Formulario>
  );
}

export default async function ConfigGeneralPage() {
  const supabase = await createClient();
  const [{ data: config }, admin] = await Promise.all([
    supabase.from("config").select("clave, valor"),
    esAdmin(),
  ]);

  const c = new Map<string, any>((config ?? []).map((r: any) => [r.clave, r.valor]));
  const ubicacion = c.get("ubicacion") ?? { nombre: "Cardales", lat: -34.3167, lon: -58.9667 };

  return (
    <>
      {!admin && (
        <p className="mb-3 rounded-2xl border border-borde bg-crema p-3 text-sm text-tinta-2">
          Esta pantalla la maneja el dueño. La podés mirar, pero no cambiar.
        </p>
      )}

      <Ajuste
        titulo="Cuándo te avisa la app"
        ayuda={
          <>
            <strong>Umbral de lluvia</strong>: a partir de cuántos milímetros la app considera
            que llovió en serio. Con eso te pide confirmar la lluvia y te avisa si una entrega se
            puede complicar. <strong>Aviso de fertilización</strong>: cuántos días antes te
            recuerda una fertilización agendada.
          </>
        }
      >
        <Fila admin={admin}>
          <Campo
            label="Umbral de lluvia (mm)"
            name="umbral_lluvia_mm"
            type="number"
            step="0.5"
            defaultValue={Number(c.get("umbral_lluvia_mm") ?? 2)}
            className="col-span-2 sm:w-44"
          />
          <Campo
            label="Aviso fertilización (días antes)"
            name="aviso_fertilizacion_dias"
            type="number"
            defaultValue={Number(c.get("aviso_fertilizacion_dias") ?? 3)}
            className="col-span-2 sm:w-56"
          />
        </Fila>
      </Ajuste>

      <Ajuste
        titulo="Precio de referencia"
        ayuda="Es el precio que aparece ya escrito cuando cargás un pedido o una venta, para no tener que ponerlo cada vez. Igual lo podés cambiar en cada operación."
      >
        <Fila admin={admin}>
          <Campo
            label="Precio por m² sugerido"
            name="precio_m2_default"
            type="number"
            defaultValue={Number(c.get("precio_m2_default") ?? 0)}
            className="col-span-2 sm:w-48"
          />
        </Fila>
      </Ajuste>

      <Ajuste
        titulo="Medida del pan de pasto"
        ayuda="Es la medida que sale de tu máquina. Con esto el contador de cosecha traduce pilas a m². En cada cosecha podés cambiarla si ese día cortás distinto, sin tocar esto."
      >
        <Fila admin={admin}>
          <Campo
            label="Largo (m)"
            name="pan_largo_m"
            decimal
            defaultValue={Number(c.get("pan_largo_m") ?? 0.62)}
            className="sm:w-28"
          />
          <Campo
            label="Ancho (m)"
            name="pan_ancho_m"
            decimal
            defaultValue={Number(c.get("pan_ancho_m") ?? 0.4)}
            className="sm:w-28"
          />
          <Campo
            label="Panes por pila"
            name="panes_por_pila"
            type="number"
            defaultValue={Number(c.get("panes_por_pila") ?? 2)}
            className="sm:w-36"
          />
        </Fila>
      </Ajuste>

      <Ajuste
        titulo="Ubicación del campo"
        ayuda="De acá saca el pronóstico del tiempo. Ya apunta a Cardales: no hace falta que lo toques salvo que el campo se mude."
      >
        <Fila admin={admin}>
          <Campo
            label="Nombre"
            name="ubicacion_nombre"
            defaultValue={ubicacion.nombre}
            className="col-span-2 sm:w-48"
          />
          <Campo
            label="Latitud"
            name="lat"
            type="number"
            step="0.0001"
            defaultValue={ubicacion.lat}
            className="sm:w-32"
          />
          <Campo
            label="Longitud"
            name="lon"
            type="number"
            step="0.0001"
            defaultValue={ubicacion.lon}
            className="sm:w-32"
          />
        </Fila>
      </Ajuste>
    </>
  );
}
