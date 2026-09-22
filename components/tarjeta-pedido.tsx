import Link from "next/link";
import { Chip } from "@/components/ui";
import { Cobrar, type VentaACobrar } from "@/components/cobrar";
import { ConfirmarEntrega } from "@/components/confirmar-entrega";
import { Cosechar, type LoteOpcion } from "@/components/cosechar";
import { EditarVenta } from "@/components/editar-venta";
import { Formulario, Guardar } from "@/components/guardar";
import { CAMINO, ETAPAS, type Etapa, pasoDe } from "@/lib/etapas";
import { diasEntre, fechaLarga, m2, mm, pesos } from "@/lib/format";

export type PedidoDelFlujo = {
  id: string;
  comprador: string;
  cliente_id: string;
  vinculante: string | null;
  cliente_final: string | null;
  canal: string;
  estado: string;
  etapa: Etapa;
  fecha: string;
  fecha_entrega: string | null;
  lote_id: string | null;
  lote: string | null;
  m2: number;
  m2_cortesia: number;
  precio_m2: number;
  flete: number;
  total: number;
  notas: string | null;
  m2_cosechados: number;
  m2_en_curso: number;
  cosechas_abiertas: number;
  cosecha_abierta_id: string | null;
  cobrado: number;
  pendiente: number;
  precipitacion_mm: number | null;
  prob_precipitacion: number | null;
};

/** Cuántos días faltan, en criollo. */
function cuandoFalta(dias: number) {
  if (dias < -1) return `atrasado ${Math.abs(dias)} días`;
  if (dias === -1) return "era ayer";
  if (dias === 0) return "es hoy";
  if (dias === 1) return "es mañana";
  return `faltan ${dias} días`;
}

/**
 * El recorrido, en cinco tramos.
 *
 * Se lee de lejos y con el celular en la mano: los tramos hechos van
 * pintados y el que viene, vacío. No es decoración — es lo que contesta
 * "¿en qué anda este pedido?" sin leer una palabra.
 */
function Recorrido({ etapa }: { etapa: Etapa }) {
  const paso = pasoDe(etapa);
  // Los que están fuera del camino (presupuesto, anulado) no tienen
  // barra: mostrarla vacía haría creer que están por arrancar.
  if (paso < 0) return null;

  return (
    <div className="mt-2.5 flex gap-1" aria-hidden>
      {CAMINO.map((e, i) => (
        <span
          key={e}
          title={ETAPAS[e].nombre}
          className={
            "h-1.5 flex-1 rounded-full " +
            (i <= paso ? "bg-pasto" : "bg-beige")
          }
        />
      ))}
    </div>
  );
}

/**
 * Un pedido entero, de punta a punta, en una tarjeta.
 *
 * Es la pieza central del módulo: acá se ve en qué escalón está el
 * pedido y —lo que importa— está el botón del escalón que sigue. Cerrar
 * la cosecha, darlo por entregado y cobrarlo son tres modales que se
 * abren encima de esta misma pantalla, así que el recorrido completo se
 * hace sin navegar a ningún lado.
 *
 * Los tres modales ya existían y no cambian: son los mismos que se usan
 * desde Inicio y desde la ficha de la venta. Lo nuevo es que están
 * juntos y que aparece el que corresponde.
 */
export function TarjetaPedido({
  p,
  hoy,
  lotes,
  cuentas,
  ventasACobrar,
  umbralLluvia,
  pan,
  acciones,
}: {
  p: PedidoDelFlujo;
  hoy: string;
  lotes: LoteOpcion[];
  cuentas: { id: string; nombre: string }[];
  ventasACobrar: VentaACobrar[];
  umbralLluvia: number;
  pan: { largo: number; ancho: number; porPila: number };
  acciones: {
    cosechar: (fd: FormData) => Promise<void>;
    confirmar: (fd: FormData) => Promise<void>;
    reprogramar: (fd: FormData) => Promise<void>;
    anular: (fd: FormData) => Promise<void>;
    deshacer: (fd: FormData) => Promise<void>;
    cobrar: (fd: FormData) => Promise<void>;
    senar: (fd: FormData) => Promise<void>;
    editar: (fd: FormData) => Promise<void>;
    borrar: (fd: FormData) => Promise<void>;
  };
}) {
  const ficha = ETAPAS[p.etapa];
  const dias = p.fecha_entrega ? diasEntre(hoy, p.fecha_entrega) : null;
  const llueve =
    p.precipitacion_mm !== null && Number(p.precipitacion_mm) >= umbralLluvia;

  const enCamino = p.etapa === "pedido" || p.etapa === "en_cosecha" || p.etapa === "cosechado";
  const cosechado = Number(p.m2_cosechados ?? 0);
  const faltaCortar = Math.max(0, Math.round((Number(p.m2) - cosechado) * 100) / 100);

  // El borde dice de qué hay que ocuparse hoy sin leer nada: rojo si el
  // pronóstico pinta mal, verde si sale hoy o ya se pasó.
  const borde =
    p.etapa === "cobrado" || p.etapa === "anulado"
      ? "border-borde bg-crema/50"
      : llueve && enCamino
        ? "border-urgente-tx/30 bg-urgente-bg"
        : dias !== null && dias <= 0 && enCamino
          ? "border-pasto/30 bg-hecho-bg"
          : "border-borde";

  const ficheEditar = (
    <EditarVenta
      venta={{
        id: p.id,
        comprador: p.comprador,
        fecha: p.fecha,
        fecha_entrega: p.fecha_entrega,
        m2: Number(p.m2 ?? 0),
        precio_m2: Number(p.precio_m2 ?? 0),
        flete: Number(p.flete ?? 0),
        estado: p.estado,
        lote_id: p.lote_id,
        notas: p.notas,
      }}
      lotes={lotes.map((l) => ({ id: l.id, nombre: l.nombre }))}
      accion={acciones.editar}
      borrar={acciones.borrar}
    />
  );

  const botonCosechar = (etiqueta: string, variante: "principal" | "sutil") => (
    <Cosechar
      pedidoId={p.id}
      comprador={p.comprador}
      m2Pedido={Number(p.m2 ?? 0)}
      m2Cosechado={cosechado}
      lotes={lotes}
      hoy={hoy}
      panLargo={pan.largo}
      panAncho={pan.ancho}
      panesPorPila={pan.porPila}
      accion={acciones.cosechar}
      etiqueta={etiqueta}
      variante={variante}
    />
  );

  const botonEntrega = (etiqueta: string, variante: "principal" | "sutil") => (
    <ConfirmarEntrega
      pedidoId={p.id}
      comprador={p.comprador}
      m2={Number(p.m2 ?? 0)}
      fecha={p.fecha_entrega ?? hoy}
      etiqueta={etiqueta}
      variante={variante}
      // Lo cosechado manda: si se cortaron 212 y el pedido decía 200, lo
      // que salió del campo son 212 y es lo que hay que facturar o
      // regalar. Escribirlo de nuevo a mano era la forma más común de
      // que los metros del campo y los de la factura no cerraran.
      m2Facturados={cosechado > 0 ? cosechado : undefined}
      m2Cortesia={Number(p.m2_cortesia ?? 0)}
      corrigiendo={p.etapa === "entregado" || p.etapa === "cobrado"}
      confirmar={acciones.confirmar}
      reprogramar={acciones.reprogramar}
      anular={acciones.anular}
      deshacer={acciones.deshacer}
    />
  );

  const botonCobrar = (compacto: boolean) => (
    <Cobrar
      ventas={ventasACobrar}
      cuentas={cuentas}
      accion={acciones.cobrar}
      etiqueta={compacto ? "Cobrar" : "Registrar el cobro"}
      clienteInicial={p.cliente_id}
      compacto={compacto}
    />
  );

  return (
    <li className={"rounded-xl border p-3 " + borde}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/ventas/${p.id}`} className="font-bold hover:underline">
              {p.comprador}
            </Link>
            <Chip tono={ficha.tono}>{ficha.nombre}</Chip>
          </div>

          <p className="mt-0.5 text-xs text-tinta-2">
            {p.canal === "distribuidor" ? "Por distribuidor" : "Venta directa"}
            {p.vinculante ? ` · ${p.vinculante}` : ""}
            {p.cliente_final ? ` · entrega a ${p.cliente_final}` : ""}
            {p.lote ? ` · desde ${p.lote}` : ""}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold tabular-nums">{pesos(Number(p.total))}</p>
          <p className="text-xs text-tinta-2">
            {m2(Number(p.m2))} · {pesos(Number(p.precio_m2))}/m²
          </p>
        </div>
      </div>

      {/* Cuándo sale, y qué dice el cielo para ese día. */}
      {p.fecha_entrega && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{fechaLarga(p.fecha_entrega)}</span>
          {dias !== null && enCamino && (
            <Chip tono={dias < 0 ? "rojo" : dias === 0 ? "verde" : "neutro"}>
              {cuandoFalta(dias)}
            </Chip>
          )}
          {enCamino && p.precipitacion_mm !== null && (
            <Chip tono={llueve ? "rojo" : "verde"}>
              {mm(Number(p.precipitacion_mm))}
              {p.prob_precipitacion !== null ? ` · ${p.prob_precipitacion}%` : ""}
              {llueve ? " — conviene reprogramar" : ""}
            </Chip>
          )}
        </div>
      )}

      <Recorrido etapa={p.etapa} />

      {/* Una línea que dice exactamente qué falta y con qué números. */}
      <p className="mt-1.5 text-xs text-tinta-2">
        {p.etapa === "pedido" && `Falta cosechar ${m2(faltaCortar)}.`}
        {p.etapa === "en_cosecha" &&
          `Contando: van ${m2(Number(p.m2_en_curso ?? 0))} de ${m2(Number(p.m2))}.`}
        {p.etapa === "cosechado" &&
          `Cortados ${m2(cosechado)}${faltaCortar > 0.05 ? ` de ${m2(Number(p.m2))}` : ""}. Falta llevarlo.`}
        {p.etapa === "entregado" &&
          `Entregado. Debe ${pesos(Number(p.pendiente))}${
            Number(p.cobrado) > 0 ? ` de ${pesos(Number(p.total))}` : ""
          }.`}
        {p.etapa === "cobrado" && "Entregado y cobrado. Listo."}
        {p.etapa === "anulado" && "El pedido se cayó."}
        {p.etapa === "presupuesto" && "Precio pasado. Todavía no lo confirmaron."}
        {/* La seña es lo único que puede haber entrado antes de salir. */}
        {enCamino && Number(p.cobrado) > 0 && (
          <span className="font-semibold text-info-tx"> Seña: {pesos(Number(p.cobrado))}.</span>
        )}
      </p>

      {p.notas && <p className="mt-1 text-xs italic text-tinta-2">{p.notas}</p>}

      {/* El botón del escalón que sigue, primero y grande. Los otros
          quedan al lado, chicos: siempre se puede saltear un paso o
          arreglar algo que se cargó mal. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.etapa === "pedido" && (
          <>
            {botonCosechar("Cosechar", "principal")}
            {botonEntrega("Se entregó", "sutil")}
          </>
        )}

        {p.etapa === "en_cosecha" && (
          <>
            <Link
              href={`/ventas/cosecha/${p.cosecha_abierta_id}`}
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-pasto px-4 text-sm font-bold text-crema transition active:scale-[.98] sm:min-h-10 sm:w-auto"
            >
              Seguir contando
            </Link>
            {botonEntrega("Se entregó", "sutil")}
          </>
        )}

        {p.etapa === "cosechado" && (
          <>
            {botonEntrega("Se entregó", "principal")}
            {faltaCortar > 0.05 && botonCosechar("Cosechar lo que falta", "sutil")}
          </>
        )}

        {p.etapa === "entregado" && (
          <>
            {botonCobrar(false)}
            {botonEntrega("Corregir la entrega", "sutil")}
          </>
        )}

        {(p.etapa === "cobrado" || p.etapa === "anulado" || p.etapa === "presupuesto") && (
          <Link href={`/ventas/${p.id}`} className="btn-ghost">
            Ver la ficha
          </Link>
        )}

        {ficheEditar}

        {p.etapa !== "cobrado" && p.etapa !== "anulado" && (
          <Link
            href={`/ventas/${p.id}`}
            className="text-xs font-semibold text-tinta-3 hover:text-pasto"
          >
            Ver la ficha
          </Link>
        )}
      </div>

      {/* La seña entra antes de que salga el pasto, así que no puede
          esperar al modal de cobro: ese solo conoce entregas. */}
      {enCamino && (
        <details className="mt-1">
          <summary className="flex min-h-9 cursor-pointer list-none items-center text-xs font-semibold text-tinta-2">
            Registrar una seña
          </summary>
          <Formulario
            action={acciones.senar}
            className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-white p-3"
          >
            <input type="hidden" name="cliente_id" value={p.cliente_id} />
            <input type="hidden" name="venta_id" value={p.id} />

            <div className="min-w-0">
              <label className="label">Monto</label>
              <input name="monto" type="number" required className="input" placeholder="0" />
            </div>
            <div className="min-w-0">
              <label className="label">Fecha</label>
              <input name="fecha" type="date" defaultValue={hoy} className="input" />
            </div>
            <div className="min-w-0">
              <label className="label">Cuenta</label>
              <select name="cuenta_id" required className="input">
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Guardar className="btn-ghost w-full">Guardar seña</Guardar>
            </div>
          </Formulario>
        </details>
      )}
    </li>
  );
}
