"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function txt(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function num(fd: FormData, k: string): number | null {
  const t = txt(fd, k);
  if (t === null) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Igual que num() pero sin quitar puntos: para campos con decimales tipo 12.5 */
function dec(fd: FormData, k: string): number | null {
  const t = txt(fd, k);
  if (t === null) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function bump(...rutas: string[]) {
  for (const r of rutas) revalidatePath(r);
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/* RIEGO                                                               */
/* ------------------------------------------------------------------ */

export async function crearRiego(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase.from("riegos").insert({
    lote_id: txt(fd, "lote_id"),
    zona_id: txt(fd, "zona_id"),
    fecha: txt(fd, "fecha") ?? hoyISO(),
    hora: txt(fd, "hora"),
    minutos: num(fd, "minutos"),
    mm: dec(fd, "mm"),
    origen: "manual",
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/mantenimiento/riego");
}

export async function borrarRiego(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("riegos").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/riego");
}

/* ------------------------------------------------------------------ */
/* CORTES                                                              */
/* ------------------------------------------------------------------ */

export async function crearCorte(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase.from("cortes").insert({
    lote_id: txt(fd, "lote_id"),
    fecha: txt(fd, "fecha") ?? hoyISO(),
    altura_mm: num(fd, "altura_mm"),
    superficie_m2: num(fd, "superficie_m2"),
    horas_maquina: dec(fd, "horas_maquina"),
    responsable_texto: txt(fd, "responsable_texto"),
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/mantenimiento/cortes");
}

export async function borrarCorte(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("cortes").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/cortes");
}

/* ------------------------------------------------------------------ */
/* FERTILIZACIONES                                                     */
/* ------------------------------------------------------------------ */

export async function crearFertilizacion(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase.from("fertilizaciones").insert({
    lote_id: txt(fd, "lote_id"),
    fertilizante_id: txt(fd, "fertilizante_id"),
    fecha_programada: txt(fd, "fecha_programada") ?? hoyISO(),
    dosis: dec(fd, "dosis"),
    unidad: txt(fd, "unidad") ?? "kg",
    superficie_m2: num(fd, "superficie_m2"),
    costo: num(fd, "costo"),
    estado: "programada",
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/mantenimiento/fertilizaciones");
}

export async function marcarFertilizacionAplicada(fd: FormData) {
  const { supabase, user } = await sesion();
  const id = txt(fd, "id")!;
  await supabase
    .from("fertilizaciones")
    .update({
      estado: "aplicada",
      fecha_aplicada: txt(fd, "fecha_aplicada") ?? hoyISO(),
      responsable_id: user.id,
    })
    .eq("id", id);

  // Si hay costo cargado, dejamos el pago sugerido en administración.
  await supabase
    .from("notificaciones")
    .update({ resuelta: true, resuelta_por: user.id, resuelta_at: new Date().toISOString() })
    .eq("entidad_id", id)
    .eq("resuelta", false);

  bump("/mantenimiento/fertilizaciones");
}

export async function cancelarFertilizacion(fd: FormData) {
  const { supabase } = await sesion();
  await supabase
    .from("fertilizaciones")
    .update({ estado: "cancelada" })
    .eq("id", txt(fd, "id")!);
  bump("/mantenimiento/fertilizaciones");
}

export async function borrarFertilizacion(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("fertilizaciones").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/fertilizaciones");
}

export async function crearFertilizante(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("fertilizantes").insert({
    nombre: txt(fd, "nombre"),
    tipo: txt(fd, "tipo"),
    unidad: txt(fd, "unidad") ?? "kg",
    dosis_por_ha: dec(fd, "dosis_por_ha"),
  });
  bump("/mantenimiento/fertilizaciones", "/config");
}

/* ------------------------------------------------------------------ */
/* LLUVIAS                                                             */
/* ------------------------------------------------------------------ */

export async function registrarLluvia(fd: FormData) {
  const { supabase, user } = await sesion();
  const fecha = txt(fd, "fecha") ?? hoyISO();
  const mmValor = dec(fd, "mm");
  const loteId = txt(fd, "lote_id");
  const notificacionId = txt(fd, "notificacion_id");

  if (mmValor !== null) {
    await supabase.from("lluvias").upsert(
      {
        fecha,
        mm: mmValor,
        lote_id: loteId,
        origen: notificacionId ? "confirmada_alerta" : "manual",
        notas: txt(fd, "notas"),
        created_by: user.id,
      },
      { onConflict: "fecha,lote_id" },
    );
  }

  if (notificacionId) {
    await supabase
      .from("notificaciones")
      .update({
        resuelta: true,
        resuelta_por: user.id,
        resuelta_at: new Date().toISOString(),
      })
      .eq("id", notificacionId);
  }

  bump("/mantenimiento/lluvias");
}

/** "No llovió": cierra la alerta sin cargar mm. */
export async function descartarAlertaLluvia(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase
    .from("notificaciones")
    .update({
      resuelta: true,
      resuelta_por: user.id,
      resuelta_at: new Date().toISOString(),
      mensaje: "Confirmado: no llovió en Cardales.",
    })
    .eq("id", txt(fd, "id")!);
  bump("/mantenimiento/lluvias");
}

export async function borrarLluvia(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("lluvias").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/lluvias");
}

/* ------------------------------------------------------------------ */
/* CLIENTES Y VENTAS                                                   */
/* ------------------------------------------------------------------ */

export async function crearCliente(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("clientes").insert({
    nombre: txt(fd, "nombre"),
    tipo: txt(fd, "tipo") ?? "particular",
    telefono: txt(fd, "telefono"),
    email: txt(fd, "email"),
    direccion: txt(fd, "direccion"),
    localidad: txt(fd, "localidad"),
    cuit: txt(fd, "cuit"),
    notas: txt(fd, "notas"),
  });
  bump("/ventas/clientes", "/ventas");
}

export async function editarCliente(fd: FormData) {
  const { supabase } = await sesion();
  await supabase
    .from("clientes")
    .update({
      nombre: txt(fd, "nombre"),
      tipo: txt(fd, "tipo") ?? "particular",
      telefono: txt(fd, "telefono"),
      email: txt(fd, "email"),
      direccion: txt(fd, "direccion"),
      localidad: txt(fd, "localidad"),
      cuit: txt(fd, "cuit"),
      notas: txt(fd, "notas"),
    })
    .eq("id", txt(fd, "id")!);
  bump("/ventas/clientes", "/ventas");
}

export async function crearVenta(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase.from("ventas").insert({
    cliente_id: txt(fd, "cliente_id"),
    lote_id: txt(fd, "lote_id"),
    fecha: txt(fd, "fecha") ?? hoyISO(),
    fecha_entrega: txt(fd, "fecha_entrega"),
    m2: num(fd, "m2"),
    precio_m2: num(fd, "precio_m2"),
    flete: num(fd, "flete") ?? 0,
    estado: txt(fd, "estado") ?? "confirmada",
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/ventas", "/administracion");
}

export async function cambiarEstadoVenta(fd: FormData) {
  const { supabase } = await sesion();
  const estado = txt(fd, "estado")!;
  const patch: Record<string, unknown> = { estado };
  if (estado === "entregada") patch.fecha_entrega = txt(fd, "fecha_entrega") ?? hoyISO();
  await supabase.from("ventas").update(patch).eq("id", txt(fd, "id")!);
  bump("/ventas", "/administracion");
}

export async function borrarVenta(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("ventas").delete().eq("id", txt(fd, "id")!);
  bump("/ventas", "/administracion");
}

/* ------------------------------------------------------------------ */
/* COBROS Y PAGOS                                                      */
/* ------------------------------------------------------------------ */

export async function crearCobro(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase.from("cobros").insert({
    cliente_id: txt(fd, "cliente_id"),
    venta_id: txt(fd, "venta_id"),
    fecha: txt(fd, "fecha") ?? hoyISO(),
    monto: num(fd, "monto"),
    medio: txt(fd, "medio") ?? "transferencia",
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/administracion", "/ventas");
}

export async function borrarCobro(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("cobros").delete().eq("id", txt(fd, "id")!);
  bump("/administracion", "/ventas");
}

export async function crearPago(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase.from("pagos").insert({
    fecha: txt(fd, "fecha") ?? hoyISO(),
    monto: num(fd, "monto"),
    categoria: txt(fd, "categoria") ?? "otro",
    proveedor: txt(fd, "proveedor"),
    medio: txt(fd, "medio") ?? "transferencia",
    lote_id: txt(fd, "lote_id"),
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/administracion");
}

export async function borrarPago(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("pagos").delete().eq("id", txt(fd, "id")!);
  bump("/administracion");
}

/* ------------------------------------------------------------------ */
/* NOTIFICACIONES                                                      */
/* ------------------------------------------------------------------ */

export async function resolverNotificacion(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase
    .from("notificaciones")
    .update({
      resuelta: true,
      resuelta_por: user.id,
      resuelta_at: new Date().toISOString(),
    })
    .eq("id", txt(fd, "id")!);
  bump("/");
}

/* ------------------------------------------------------------------ */
/* CONFIG, LOTES Y ZONAS                                               */
/* ------------------------------------------------------------------ */

export async function guardarConfig(fd: FormData) {
  const { supabase } = await sesion();
  const items: { clave: string; valor: unknown }[] = [
    { clave: "hydrawise_api_key", valor: txt(fd, "hydrawise_api_key") ?? "" },
    { clave: "umbral_lluvia_mm", valor: dec(fd, "umbral_lluvia_mm") ?? 2 },
    { clave: "aviso_fertilizacion_dias", valor: num(fd, "aviso_fertilizacion_dias") ?? 3 },
    { clave: "precio_m2_default", valor: num(fd, "precio_m2_default") ?? 0 },
    {
      clave: "ubicacion",
      valor: {
        nombre: txt(fd, "ubicacion_nombre") ?? "Cardales",
        lat: dec(fd, "lat") ?? -34.3167,
        lon: dec(fd, "lon") ?? -58.9667,
      },
    },
  ];

  for (const it of items) {
    await supabase
      .from("config")
      .upsert(
        { clave: it.clave, valor: it.valor, actualizado_at: new Date().toISOString() },
        { onConflict: "clave" },
      );
  }
  bump("/config");
}

export async function guardarLote(fd: FormData) {
  const { supabase } = await sesion();
  const id = txt(fd, "id");
  const datos = {
    nombre: txt(fd, "nombre"),
    superficie_m2: num(fd, "superficie_m2"),
    dias_objetivo_corte: num(fd, "dias_objetivo_corte") ?? 14,
    notas: txt(fd, "notas"),
  };
  if (id) await supabase.from("lotes").update(datos).eq("id", id);
  else await supabase.from("lotes").insert(datos);
  bump("/config", "/mantenimiento/cortes", "/mantenimiento/riego");
}

export async function guardarZona(fd: FormData) {
  const { supabase } = await sesion();
  const id = txt(fd, "id");
  const datos = {
    nombre: txt(fd, "nombre"),
    lote_id: txt(fd, "lote_id"),
    hydrawise_controller_id: txt(fd, "hydrawise_controller_id"),
    hydrawise_relay_id: txt(fd, "hydrawise_relay_id"),
  };
  if (id) await supabase.from("riego_zonas").update(datos).eq("id", id);
  else await supabase.from("riego_zonas").insert(datos);
  bump("/config", "/mantenimiento/riego");
}

export async function agregarMiembro(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("miembros_habilitados").insert({
    email: (txt(fd, "email") ?? "").toLowerCase(),
    nombre: txt(fd, "nombre"),
    rol: txt(fd, "rol") ?? "operador",
  });
  bump("/config");
}

export async function quitarMiembro(fd: FormData) {
  const { supabase } = await sesion();
  const email = (txt(fd, "email") ?? "").toLowerCase();
  await supabase.from("miembros_habilitados").delete().eq("email", email);
  await supabase.from("perfiles").update({ activo: false }).eq("email", email);
  bump("/config");
}

export async function cambiarAvisoMail(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase
    .from("perfiles")
    .update({ notificar_mail: fd.get("notificar_mail") === "on" })
    .eq("id", user.id);
  bump("/config");
}

/* ------------------------------------------------------------------ */
/* SINCRONIZACIÓN MANUAL                                               */
/* ------------------------------------------------------------------ */

export async function sincronizarAhora() {
  await sesion();
  const { correrTodo } = await import("@/lib/sync");
  await correrTodo();
  bump("/", "/mantenimiento/riego", "/mantenimiento/lluvias", "/config");
}

export async function asignarZonaALote(fd: FormData) {
  const { supabase } = await sesion();
  await supabase
    .from("riego_zonas")
    .update({ lote_id: txt(fd, "lote_id") })
    .eq("id", txt(fd, "id")!);
  bump("/config", "/mantenimiento/riego");
}
