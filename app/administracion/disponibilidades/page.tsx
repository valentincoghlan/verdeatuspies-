import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader, Stat, Tabla } from "@/components/ui";
import { Campo, Selector } from "@/components/campos";
import { crearCuenta, ajustarSaldo } from "@/lib/actions";
import { AjustarSaldo } from "@/components/ajustar-saldo";
import { fechaBreve, fechaLarga, pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIPOS_CUENTA = [
  { value: "efectivo", label: "Efectivo" },
  { value: "banco", label: "Banco" },
  { value: "billetera", label: "Billetera virtual" },
  { value: "socio", label: "Cuenta de un socio" },
  { value: "usd", label: "Dólares" },
  { value: "otro", label: "Otro" },
];

export default async function DisponibilidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const supabase = await createClient();

  const [{ data: saldos }, { data: cuentasCli }, { data: aportes }, { data: prestamos }, { data: yo }] =
    await Promise.all([
    supabase.from("v_saldos_cuentas").select("*").order("orden"),
    supabase.from("v_cuenta_clientes").select("*").order("saldo", { ascending: false }),
    supabase.from("v_aportes").select("*"),
    supabase.from("v_prestamos").select("*"),
    // Los ajustes de saldo son solo para el dueño.
    supabase.auth.getUser().then(async ({ data }) =>
      data.user
        ? supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle()
        : { data: null },
    ),
  ]);

  // Las cuentas de los socios no son plata disponible: son aportes, y van
  // en su propio cuadro, medidos en dólares.
  const lista = ((saldos ?? []) as any[]).filter((c) => c.tipo !== "socio" && c.activa);
  // Las cuentas en dólares no suman al disponible en pesos: lo que tienen
  // ahí es diferencia de cambio, no plata.
  const disponible = lista
    .filter((c) => c.moneda !== "USD")
    .reduce((a, c) => a + Number(c.saldo_ars ?? 0), 0);
  const totalUsd = lista
    .filter((c) => c.moneda === "USD")
    .reduce((a, c) => a + Number(c.saldo_usd ?? 0), 0);

  const esAdmin = (yo as any)?.rol === "admin";

  const socios = (aportes ?? []) as any[];
  const sinCotizacion = socios.reduce((a, s) => a + Number(s.sin_cotizacion ?? 0), 0);

  const debenPlata = (prestamos ?? []) as any[];
  const prestado = debenPlata.reduce((a, p) => a + Number(p.saldo_ars ?? 0), 0);

  const porCobrar = (cuentasCli ?? []).reduce(
    (a: number, c: any) => a + Math.max(0, Number(c.saldo ?? 0)),
    0,
  );
  const deudores = (cuentasCli ?? []).filter((c: any) => Number(c.saldo ?? 0) > 0);

  return (
    <>
      <PageHeader
        titulo="Disponibilidades"
        bajada="Cuánta plata hay en cada cuenta y cuánto te deben."
      />

      {aviso && (
        <div className="mb-3 rounded-2xl border border-borde bg-hecho-bg p-3 text-sm text-pasto-oscuro">
          {aviso}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Plata disponible"
          valor={pesos(disponible)}
          destacado
          detalle="Sin contar las cuentas de los socios"
        />
        <Stat
          label="Prestado sin devolver"
          valor={pesos(prestado)}
          tono={prestado > 0 ? "ambar" : "neutro"}
          detalle={`${debenPlata.length} ${debenPlata.length === 1 ? "persona" : "personas"}`}
        />
        <Stat
          label="Por cobrar"
          valor={pesos(porCobrar)}
          tono={porCobrar > 0 ? "ambar" : "neutro"}
          detalle={`${deudores.length} clientes con saldo`}
        />
        <Stat
          label="En dólares"
          valor={`US$ ${Math.round(totalUsd).toLocaleString("es-AR")}`}
          detalle="Cuentas que operan en dólares"
        />
      </div>

      <div className="mt-3 space-y-3">
        <Card titulo="Saldo por cuenta">
          <Tabla
            cabeceras={["Cuenta", "Tipo", "Movimientos", "Último", "Saldo", ""]}
            soloEnCompu={[1, 2, 3]}
            vacio="Sin cuentas cargadas."
          >
            {lista.map((c) => {
              // Cada cuenta lleva su saldo en SU moneda. Convertir cada
              // movimiento a la cotización de su día y sumar no da un saldo:
              // da la diferencia de cambio, que no es plata que tengas.
              const enDolares = c.moneda === "USD";
              const saldo = enDolares ? Number(c.saldo_usd ?? 0) : Number(c.saldo_ars ?? 0);
              return (
                <tr key={c.cuenta_id}>
                  <td className="td font-semibold">{c.nombre}</td>
                  <td className="td">
                    <Chip tono={enDolares ? "azul" : "neutro"}>{c.tipo}</Chip>
                  </td>
                  <td className="td tabular-nums text-tinta-2">{c.movimientos}</td>
                  <td className="td text-tinta-2">{fechaBreve(c.ultimo_movimiento)}</td>
                  <td
                    className={
                      "td tabular-nums font-semibold " +
                      (saldo < 0 ? "text-urgente-tx" : saldo > 0 ? "text-pasto" : "text-tinta-3")
                    }
                  >
                    {saldo === 0
                      ? "—"
                      : enDolares
                        ? `US$ ${Math.round(saldo).toLocaleString("es-AR")}`
                        : pesos(saldo)}
                  </td>
                  <td className="td text-right">
                    {esAdmin && !enDolares && (
                      <AjustarSaldo
                        cuenta={{ id: c.cuenta_id, nombre: c.nombre, saldo }}
                        accion={ajustarSaldo}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <p className="mt-3 text-sm text-tinta-2">
            Cada cuenta muestra su saldo en la moneda en la que opera. La cuenta{" "}
            <strong>USD</strong> guarda dólares; las demás, pesos.
          </p>
        </Card>

        <Card titulo="Aportes de los socios">
          <Tabla
            cabeceras={["Socio", "Puso", "Recuperó", "Pendiente"]}
            vacio="Sin socios cargados."
          >
            {socios.map((s: any) => {
              const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-AR")}`;
              const pendiente = Number(s.pendiente_usd ?? 0);
              return (
                <tr key={s.persona_id}>
                  <td className="td font-semibold">{s.socio}</td>
                  <td className="td tabular-nums">{usd(Number(s.aportado_usd ?? 0))}</td>
                  <td className="td tabular-nums text-pasto">{usd(Number(s.devuelto_usd ?? 0))}</td>
                  <td
                    className={
                      "td tabular-nums font-semibold " +
                      (pendiente > 1 ? "text-atencion-tx" : "text-tinta-3")
                    }
                  >
                    {pendiente > 1 ? usd(pendiente) : "—"}
                  </td>
                </tr>
              );
            })}
          </Tabla>
          <p className="mt-3 text-sm text-tinta-2">
            Todo en dólares. <strong>Puso</strong> es lo que se pagó desde su cuenta;{" "}
            <strong>recuperó</strong> son los dividendos que cobró. Lo que salió en pesos se
            dolariza con la cotización del día de la operación.
          </p>
          {sinCotizacion > 0 && (
            <p className="mt-2 text-sm font-semibold text-atencion-tx">
              Hay {sinCotizacion} movimiento{sinCotizacion === 1 ? "" : "s"} sin cotización
              cargada, así que no suma{sinCotizacion === 1 ? "" : "n"} al total.
            </p>
          )}
        </Card>

        <Card titulo="Préstamos a cobrar">
          <Tabla
            cabeceras={["Persona", "Desde", "Debe", "En dólares"]}
            vacio="No hay préstamos sin devolver."
          >
            {debenPlata.map((p: any) => (
              <tr key={p.persona_id}>
                <td className="td font-semibold">{p.persona}</td>
                <td className="td text-tinta-2">{fechaBreve(p.desde)}</td>
                <td className="td tabular-nums font-semibold text-atencion-tx">
                  {pesos(Number(p.saldo_ars))}
                </td>
                <td className="td tabular-nums text-tinta-2">
                  US$ {Math.round(Number(p.saldo_usd)).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </Tabla>
          <p className="mt-3 text-sm text-tinta-2">
            Plata que le prestaste a alguien y te tiene que devolver. No son ventas, por eso van
            aparte de los saldos de clientes. Cuando te devuelvan, cargalo en Caja como{" "}
            <strong>Préstamos · Devolución de préstamo</strong> y el saldo baja solo.
          </p>
        </Card>

        <Card titulo="Saldos por cliente">
          <Tabla cabeceras={["Cliente", "Vendido", "Cobrado", "Saldo"]} vacio="Sin movimientos.">
            {(cuentasCli ?? [])
              .filter(
                (c: any) => Number(c.total_vendido ?? 0) !== 0 || Number(c.total_cobrado ?? 0) !== 0,
              )
              .map((c: any) => {
                const saldo = Number(c.saldo ?? 0);
                return (
                  <tr key={c.cliente_id}>
                    <td className="td font-semibold">{c.nombre}</td>
                    <td className="td tabular-nums">{pesos(Number(c.total_vendido ?? 0))}</td>
                    <td className="td tabular-nums">{pesos(Number(c.total_cobrado ?? 0))}</td>
                    <td
                      className={
                        "td tabular-nums font-semibold " +
                        (saldo > 0 ? "text-atencion-tx" : saldo < 0 ? "text-info-tx" : "text-tinta-3")
                      }
                    >
                      {pesos(saldo)}
                    </td>
                  </tr>
                );
              })}
          </Tabla>
          <p className="mt-3 text-sm text-tinta-2">
            En <strong>ámbar</strong> lo que te deben. En <strong>azul</strong>, plata a favor del
            cliente: te pagó por adelantado.
          </p>
        </Card>

        <Card titulo="Agregar una cuenta">
          <form action={crearCuenta} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo label="Nombre" name="nombre" required placeholder="Banco Nación" className="col-span-2" />
            <Selector label="Qué es" name="tipo_cuenta" defaultValue="banco" opciones={TIPOS_CUENTA} />
            <Selector
              label="Moneda"
              name="moneda"
              defaultValue="ARS"
              opciones={[
                { value: "ARS", label: "Pesos" },
                { value: "USD", label: "Dólares" },
              ]}
            />
            <div className="col-span-2 sm:col-span-4">
              <button className="btn-ghost">Agregar cuenta</button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
