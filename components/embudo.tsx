import { METROS, perdidasDe, type Embudo, type Magnitud } from "@/lib/metros";
import { m2 as fmtM2, numero } from "@/lib/format";

const ORDEN: Magnitud[] = ["comprometidos", "cosechados", "entregados", "facturados", "cobrados"];

/**
 * El camino del pasto, de lo que se prometió a la plata que entró.
 *
 * Es la pantalla que contesta "¿dónde se pierde?". Los cinco números
 * sueltos ya estaban repartidos por la app, pero uno abajo del otro
 * cuentan otra cosa: que entre cosechar y entregar se fue el 3%, que la
 * cortesía fueron 100 m², que hay 330 m² facturados sin cobrar.
 *
 * Las barras son proporcionales al escalón más grande, así la caída se
 * ve antes de leer un número. Sin librerías: son divs, como el resto.
 */
export function EmbudoM2({ datos }: { datos: Embudo }) {
  const perdidas = perdidasDe(datos);
  const tope = Math.max(...ORDEN.map((k) => datos[k]), 1);
  const sinCosecha = Math.max(0, Math.round((datos.entregados - datos.cosechados) * 10) / 10);

  return (
    <div>
      <ul className="space-y-2.5">
        {ORDEN.map((clave) => {
          const valor = datos[clave];
          const ancho = Math.max(2, (valor / tope) * 100);
          // La pérdida que arranca en este escalón va debajo de él.
          const caida = perdidas.find((p) => p.desde === clave);

          return (
            <li key={clave}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-tinta">
                  {METROS[clave].corto}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-tinta">
                  {fmtM2(valor)}
                </span>
              </div>

              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-beige">
                <div
                  className="h-full rounded-full bg-pasto"
                  style={{ width: `${ancho}%` }}
                />
              </div>

              {caida && (
                <p className="mt-1 text-xs text-tinta-3">
                  <span className="font-semibold text-atencion-tx">
                    −{fmtM2(caida.m2)}
                  </span>{" "}
                  {caida.nombre} · {numero(caida.pct, 1)}%
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-1.5 text-xs text-tinta-3">
        <p>
          Los comprometidos son pedidos que todavía no salieron, así que no bajan de los
          cosechados: son la cola, no el principio de esta tanda.
        </p>
        {/*
          La barra de cosechados corta no siempre es merma al revés: el
          conteo por pilas es nuevo, y una entrega vieja no tiene ninguna
          cosecha detrás. Decirlo evita leer como dato lo que es un hueco.
        */}
        {sinCosecha > 0 && (
          <p className="text-atencion-tx">
            {fmtM2(sinCosecha)} de lo entregado no tiene una cosecha cargada detrás, así que el
            escalón de cosechados queda corto y la merma no se puede medir en este período.
          </p>
        )}
      </div>
    </div>
  );
}
