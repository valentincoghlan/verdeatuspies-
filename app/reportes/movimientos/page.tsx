import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat } from "@/components/ui";
import { FiltroPeriodo, resolverPeriodo } from "@/components/filtro-periodo";
import {
  Desglose,
  armarRamas,
  type LineaMov,
} from "@/components/desglose-movimientos";
import { dolares, fechaLarga, numero, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Ingresos y egresos, abriéndose de a un nivel.
 *
 * Es la contracara de Reportes: aquel mira el negocio (m², margen, costo
 * por metro) y este mira la caja, peso por peso. Arranca en el total del
 * período y se baja hasta la línea suelta —"14/09 · Juan · Yapeyú ·
 * $ 42.748"— sin cambiar de pantalla.
 *
 * Cuenta TODO lo que movió la caja, incluida la plata que no es costo de
 * producir (inversión, reparto, ajustes). Por eso los totales de acá no
 * tienen por qué dar iguales a los de Reportes, que descuenta solo el
 * costo operativo: cada rubro que no es operativo se marca con su chip.
 */
export default async function MovimientosReportePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; mes?: string; s?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const periodo = resolverPeriodo(sp);
  const enUsd = sp.m === "usd";
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_movimientos")
    .select(
      "id, fecha, tipo, monto, monto_usd, detalle, cuenta, persona, cliente, lote, categoria, subcategoria, tipo_plata, origen",
    )
    .gte("fecha", periodo.desde)
    .lte("fecha", periodo.hasta)
    .order("fecha", { ascending: false });

  const filas = (data ?? []) as any[];

  // En dólares se usa el monto_usd que quedó guardado con la cotización
  // del día del movimiento: es más fiel que reconvertir después.
  const montoDe = (l: LineaMov & { monto_usd?: number }) =>
    Number((enUsd ? (l as any).monto_usd : l.monto) ?? 0);
  const plata = enUsd ? (n: number) => dolares(n, 2) : (n: number) => pesos(n);
  const plataGrande = enUsd ? (n: number) => dolares(n) : (n: number) => pesos(n);

  const entradas = filas.filter((l) => l.tipo === "I") as LineaMov[];
  const salidas = filas.filter((l) => l.tipo === "E") as LineaMov[];

  const ramasEntradas = armarRamas(entradas, montoDe);
  const ramasSalidas = armarRamas(salidas, montoDe);

  const totalEntradas = ramasEntradas.reduce((a, r) => a + r.total, 0);
  const totalSalidas = ramasSalidas.reduce((a, r) => a + r.total, 0);
  const neto = totalEntradas - totalSalidas;

  // Cuánto de lo que salió es costo de producir y vender, y cuánto es
  // otra cosa. Sin este corte, un mes con una compra de maquinaria parece
  // un desastre operativo.
  const operativo = ramasSalidas
    .filter((r) => r.tipoPlata === "operativo")
    .reduce((a, r) => a + r.total, 0);
  const noOperativo = totalSalidas - operativo;

  return (
    <>
      <PageHeader
        titulo="Ingresos y egresos"
        bajada={`${periodo.etiqueta} · del ${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}.`}
        accion={
          <Link href="/reportes" className="btn-ghost">
            Ver Reportes
          </Link>
        }
      />

      <div className="mb-3">
        <FiltroPeriodo
          base="/reportes/movimientos"
          periodo={periodo}
          moneda={enUsd ? "USD" : "ARS"}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Entró"
          valor={plataGrande(totalEntradas)}
          tono="verde"
          detalle={`${numero(entradas.length)} movimientos`}
        />
        <Stat
          label="Salió"
          valor={plataGrande(totalSalidas)}
          tono="ambar"
          detalle={`${numero(salidas.length)} movimientos`}
        />
        <Stat
          label="Neto"
          valor={plataGrande(neto)}
          tono={neto < 0 ? "rojo" : "verde"}
          destacado
          detalle="Lo que entró menos lo que salió"
        />
        <Stat
          label="Costo operativo"
          valor={plataGrande(operativo)}
          detalle={
            noOperativo > 0
              ? `${plataGrande(noOperativo)} no es costo de producir`
              : "Todo lo que salió es de producir"
          }
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card titulo="Lo que entró">
          <Desglose
            ramas={ramasEntradas}
            total={totalEntradas}
            tono="verde"
            plata={plata}
            normal="cobranza"
            vacio="No entró plata en este período."
          />
        </Card>

        <Card titulo="Lo que salió">
          <Desglose
            ramas={ramasSalidas}
            total={totalSalidas}
            tono="ambar"
            plata={plata}
            normal="operativo"
            vacio="No salió plata en este período."
          />
        </Card>
      </div>

      <p className="mt-3 text-xs text-tinta-3">
        Tocá cualquier rubro para abrirlo en subcategorías, y una subcategoría para ver los
        movimientos que la forman. Acá entra todo lo que pasó por la caja, también lo que no
        es costo de producir —inversión, reparto y ajustes van marcados con su etiqueta—, así
        que los totales no coinciden con los de Reportes. Qué es cada rubro se define en
        Ajustes → Datos.
      </p>
    </>
  );
}
