import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { Campo } from "@/components/campos";
import { guardarConfig } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ConfigGeneralPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from("config").select("clave, valor");

  const c = new Map<string, any>((config ?? []).map((r: any) => [r.clave, r.valor]));
  const ubicacion = c.get("ubicacion") ?? { nombre: "Cardales", lat: -34.3167, lon: -58.9667 };

  return (
    <>
      <Card titulo="Cuándo te avisa la app">
        <form action={guardarConfig} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo
            label="Umbral de lluvia (mm)"
            name="umbral_lluvia_mm"
            type="number"
            step="0.5"
            defaultValue={Number(c.get("umbral_lluvia_mm") ?? 2)}
            className="col-span-2"
          />
          <Campo
            label="Aviso fertilización (días antes)"
            name="aviso_fertilizacion_dias"
            type="number"
            defaultValue={Number(c.get("aviso_fertilizacion_dias") ?? 3)}
            className="col-span-2"
          />
          <div className="col-span-2 sm:col-span-4">
            <button className="btn">Guardar</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          <strong>Umbral de lluvia</strong>: a partir de cuántos milímetros la app considera que
          llovió en serio. Con eso te pide confirmar la lluvia y te avisa si una entrega se puede
          complicar. <strong>Aviso de fertilización</strong>: cuántos días antes te recuerda una
          fertilización agendada.
        </p>
      </Card>

      <Card titulo="Precio de referencia">
        <form action={guardarConfig} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo
            label="Precio por m² sugerido"
            name="precio_m2_default"
            type="number"
            defaultValue={Number(c.get("precio_m2_default") ?? 0)}
            className="col-span-2"
          />
          <div className="col-span-2 sm:col-span-4">
            <button className="btn">Guardar</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          Es el precio que aparece ya escrito cuando cargás un pedido o una venta, para no tener
          que ponerlo cada vez. Igual lo podés cambiar en cada operación.
        </p>
      </Card>

      <Card titulo="Medida del pan de pasto">
        <form action={guardarConfig} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo
            label="Largo (m)"
            name="pan_largo_m"
            type="number"
            step="0.01"
            defaultValue={Number(c.get("pan_largo_m") ?? 0.62)}
          />
          <Campo
            label="Ancho (m)"
            name="pan_ancho_m"
            type="number"
            step="0.01"
            defaultValue={Number(c.get("pan_ancho_m") ?? 0.4)}
          />
          <Campo
            label="Panes por pila"
            name="panes_por_pila"
            type="number"
            defaultValue={Number(c.get("panes_por_pila") ?? 2)}
          />
          <div className="col-span-2 sm:col-span-4">
            <button className="btn">Guardar</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          Es la medida que sale de tu máquina. Con esto el contador de cosecha traduce pilas a m².
          En cada cosecha podés cambiarla si ese día cortás distinto, sin tocar esto.
        </p>
      </Card>

      <Card titulo="Ubicación del campo">
        <form action={guardarConfig} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo
            label="Nombre"
            name="ubicacion_nombre"
            defaultValue={ubicacion.nombre}
            className="col-span-2"
          />
          <Campo label="Latitud" name="lat" type="number" step="0.0001" defaultValue={ubicacion.lat} />
          <Campo label="Longitud" name="lon" type="number" step="0.0001" defaultValue={ubicacion.lon} />
          <div className="col-span-2 sm:col-span-4">
            <button className="btn">Guardar</button>
          </div>
        </form>
        <p className="mt-3 text-xs text-tierra-600">
          De acá saca el pronóstico del tiempo. Ya apunta a Cardales: no hace falta que lo toques
          salvo que el campo se mude.
        </p>
      </Card>
    </>
  );
}
