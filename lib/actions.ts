"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaArgentina, horaArgentina, mandarZona } from "@/lib/hydrawise";
import { enviarPush } from "@/lib/push";
import { hoyISO } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Junta la fecha y la hora de dos campos en un momento real.
 *
 * Se interpretan en horario de Argentina (UTC-3), que es lo que la
 * persona quiso decir al elegirlas parada en el campo.
 */
function fechaHoraArgentina(fecha: string | null, hora: string | null) {
  if (!fecha) return null;
  const d = new Date(`${fecha}T${(hora ?? "00:00").slice(0, 5)}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

/**
 * Abre o corta una zona de riego, de verdad, en el campo.
 *
 * Es la única acción de la app que mueve algo físico. Además de mandar la
 * orden a Hydrawise, deja el riego registrado con los minutos exactos:
 * Hunter no guarda historial, así que lo que ordenamos nosotros es lo
 * único que podemos anotar con precisión.
 */
export async function regarZona(fd: FormData) {
  const { supabase, user } = await sesion();

  const { data: cfg } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "hydrawise_api_key")
    .maybeSingle();
  const apiKey = cfg?.valor ? String(cfg.valor) : null;
  if (!apiKey) throw new Error("Falta la API key de Hydrawise (Ajustes → Integraciones).");

  const zonaId = txt(fd, "zona_id");
  const { data: zona } = await supabase
    .from("riego_zonas")
    .select("id, nombre, lote_id, hydrawise_controller_id, hydrawise_relay_id, mm_por_hora")
    .eq("id", zonaId!)
    .single();

  if (!zona?.hydrawise_relay_id) throw new Error("Esa zona no está conectada a Hydrawise.");

  const cortar = txt(fd, "accion") === "stop";
  const minutos = num(fd, "minutos") ?? 15;

  await mandarZona(
    apiKey,
    zona.hydrawise_controller_id!,
    zona.hydrawise_relay_id,
    cortar ? "stop" : "run",
    cortar ? undefined : minutos * 60,
  );

  const ahora = new Date();
  if (cortar) {
    // Al cortar, el riego abierto se cierra con los minutos que corrió.
    const { data: abierto } = await supabase
      .from("riegos")
      .select("id, created_at, minutos")
      .eq("zona_id", zona.id)
      .eq("origen", "app")
      .eq("fecha", fechaArgentina(ahora))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (abierto) {
      const corridos = Math.max(
        1,
        Math.round((ahora.getTime() - new Date(abierto.created_at).getTime()) / 60000),
      );
      await supabase
        .from("riegos")
        .update({
          minutos: Math.min(corridos, Number(abierto.minutos ?? corridos)),
          notas: `Cortado desde la app a los ${corridos} min`,
        })
        .eq("id", abierto.id);
    }
  } else {
    const { error } = await supabase.from("riegos").insert({
      zona_id: zona.id,
      lote_id: zona.lote_id,
      fecha: fechaArgentina(ahora),
      hora: horaArgentina(ahora),
      minutos,
      // Si la zona tiene cargado su caudal, el riego ya queda en mm y
      // entra en el balance de agua sin que nadie lo calcule a mano.
      mm: zona.mm_por_hora
        ? Number(((minutos / 60) * Number(zona.mm_por_hora)).toFixed(2))
        : null,
      origen: "app",
      notas: `Abierta desde la app por ${minutos} min`,
      created_by: user.id,
    });

    // El agua ya está corriendo: si el registro falla hay que enterarse,
    // no dejar un riego sin anotar.
    if (error) {
      throw new Error(
        `Se abrió ${zona.nombre}, pero no se pudo registrar el riego: ${error.message}`,
      );
    }

    await enviarPush({
      titulo: "Empezó a regar",
      mensaje: `${zona.nombre} está regando ${minutos} minutos.`,
      url: "/mantenimiento/riego",
      tag: `riego-${zona.id}`,
    });
  }

  bump("/mantenimiento/riego", "/");
}

/**
 * Cancela los riegos programados, hasta el día y la hora que se diga.
 *
 * No toca el programa del controlador: lo deja intacto y le dice a
 * Hydrawise que no riegue hasta tal momento. Pasada esa fecha, los
 * riegos siguen como estaban.
 *
 * Alcance: una zona, un lote entero o todo el campo. Para levantar la
 * cancelación se manda la misma orden con una fecha ya pasada, que es
 * como Hunter entiende "volvé a regar".
 */
export async function suspenderRiego(fd: FormData) {
  const aviso = await intentarSuspender(fd);
  bump("/mantenimiento/riego");
  redirect(aviso ? `/mantenimiento/riego?aviso=${encodeURIComponent(aviso)}` : "/mantenimiento/riego");
}

/** Devuelve el mensaje a mostrar, o null si salió todo bien. */
async function intentarSuspender(fd: FormData): Promise<string | null> {
  const { supabase } = await sesion();

  const { data: cfg } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "hydrawise_api_key")
    .maybeSingle();
  const apiKey = cfg?.valor ? String(cfg.valor).trim() : null;
  if (!apiKey) return "Falta la API key de Hydrawise (Ajustes → Integraciones).";

  const reanudar = txt(fd, "reanudar") === "1";
  const hasta = reanudar ? new Date() : fechaHoraArgentina(txt(fd, "hasta_fecha"), txt(fd, "hasta_hora"));
  if (!hasta) return "Decime hasta qué día y hora cancelar los riegos.";
  if (!reanudar && hasta.getTime() <= Date.now()) {
    return "Esa fecha ya pasó. Elegí un momento futuro.";
  }

  const marca = Math.floor(hasta.getTime() / 1000);

  let query = supabase
    .from("riego_zonas")
    .select("id, nombre, lote_id, hydrawise_controller_id, hydrawise_relay_id")
    .eq("activo", true)
    .not("hydrawise_relay_id", "is", null);

  const zonaId = txt(fd, "zona_id");
  const loteId = txt(fd, "lote_id");
  if (zonaId) query = query.eq("id", zonaId);
  else if (loteId) query = query.eq("lote_id", loteId);

  const { data: zonas } = await query;
  if (!zonas?.length) return "No hay zonas conectadas para cancelar.";

  const guardar = async (ids: string[]) => {
    await supabase
      .from("riego_zonas")
      .update({ suspendida_hasta: reanudar ? null : hasta.toISOString() })
      .in("id", ids);
  };

  // Una zona sola: orden directa.
  if (zonaId) {
    const z = zonas[0];
    try {
      await mandarZona(apiKey, z.hydrawise_controller_id!, z.hydrawise_relay_id, "suspend", marca);
    } catch (e: any) {
      return String(e?.message ?? e);
    }
    await guardar([z.id]);
    return null;
  }

  // Un lote o todo el campo: `suspendall` frena el controlador entero de
  // una. Mandar una orden por zona son veinte llamadas seguidas y
  // Hydrawise corta con un 429.
  const porControlador = new Map<string, string[]>();
  for (const z of zonas) {
    const c = String(z.hydrawise_controller_id);
    if (!porControlador.has(c)) porControlador.set(c, []);
    porControlador.get(c)!.push(z.id);
  }

  const fallaron: string[] = [];
  let primero = true;
  for (const [controlador, ids] of porControlador) {
    // Un respiro entre controladores, por el límite de consultas.
    if (!primero) await new Promise((r) => setTimeout(r, 1200));
    primero = false;

    try {
      await mandarZona(apiKey, controlador, null, "suspendall", marca);
      await guardar(ids);
    } catch (e: any) {
      fallaron.push(String(e?.message ?? e));
    }
  }

  if (fallaron.length === porControlador.size) return fallaron[0];
  if (fallaron.length > 0) {
    return `Se frenó una parte. El resto quedó sin frenar: ${fallaron[0]}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* AVISOS AL CELULAR                                                   */
/* ------------------------------------------------------------------ */

/** Registra este teléfono para recibir avisos. */
export async function guardarSuscripcion(fd: FormData) {
  const { supabase, user } = await sesion();
  const { error } = await supabase.from("push_suscripciones").upsert(
    {
      perfil_id: user.id,
      endpoint: txt(fd, "endpoint"),
      p256dh: txt(fd, "p256dh"),
      auth: txt(fd, "auth"),
      aparato: txt(fd, "aparato"),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`No se pudo registrar el teléfono: ${error.message}`);
  bump("/config/cuenta");
}

export async function borrarSuscripcion(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("push_suscripciones").delete().eq("endpoint", txt(fd, "endpoint")!);
  bump("/config/cuenta");
}

/** Manda un aviso de prueba a todos los teléfonos registrados. */
export async function probarAviso() {
  await sesion();
  const r = await enviarPush({
    titulo: "Prueba de aviso",
    mensaje: "Si ves esto, los avisos de riego te van a llegar bien.",
    url: "/mantenimiento/riego",
    tag: "prueba",
  });
  redirect(
    `/config/cuenta?aviso=${encodeURIComponent(
      r.enviados ? `Aviso mandado a ${r.enviados} teléfono(s).` : `No se mandó: ${r.motivo ?? "sin destinos"}.`,
    )}`,
  );
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

/** Los valores marcados de un grupo de checkboxes con el mismo name. */
function marcados(fd: FormData, k: string): string[] {
  return fd
    .getAll(k)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/**
 * Agenda una fertilización por cada combinación de lote y producto.
 *
 * Si marcás los dos lotes y dos productos salen cuatro fertilizaciones,
 * cada una con su propio aviso, para poder aplicarlas o cancelarlas por
 * separado.
 */
export async function crearFertilizacion(fd: FormData) {
  const { supabase, user } = await sesion();

  const lotes = marcados(fd, "lote_id");
  const productos = marcados(fd, "fertilizante_id");
  if (lotes.length === 0 || productos.length === 0) return;

  const base = {
    fecha_programada: txt(fd, "fecha_programada") ?? hoyISO(),
    dosis: dec(fd, "dosis"),
    unidad: txt(fd, "unidad") ?? "kg",
    superficie_m2: num(fd, "superficie_m2"),
    costo: num(fd, "costo"),
    estado: "programada",
    notas: txt(fd, "notas"),
    created_by: user.id,
  };

  const filas = lotes.flatMap((lote_id) =>
    productos.map((fertilizante_id) => ({ ...base, lote_id, fertilizante_id })),
  );

  await supabase.from("fertilizaciones").insert(filas);
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

  bump("/mantenimiento/riego");
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
  bump("/mantenimiento/riego");
}

export async function borrarLluvia(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("lluvias").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/riego");
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
  const metros = dec(fd, "m2");

  // Los campos mandan el nombre: si el comprador no existe, se crea.
  const clienteId =
    txt(fd, "cliente_id") ??
    (await idPorNombreOCrear(supabase, "clientes", txt(fd, "cliente")));
  const vinculanteId =
    txt(fd, "vinculante_id") ??
    (await idPorNombreOCrear(supabase, "clientes", txt(fd, "vinculante")));

  await supabase.from("ventas").insert({
    cliente_id: clienteId,
    canal: vinculanteId ? "distribuidor" : (txt(fd, "canal") ?? "directa"),
    vinculante_id: vinculanteId,
    cliente_final: txt(fd, "cliente_final"),
    lote_id: txt(fd, "lote_id"),
    fecha: txt(fd, "fecha") ?? hoyISO(),
    fecha_entrega: txt(fd, "fecha_entrega"),
    m2: metros,
    m2_pedido: metros,
    precio_m2: num(fd, "precio_m2"),
    flete: num(fd, "flete") ?? 0,
    estado: txt(fd, "estado") ?? "confirmada",
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/ventas", "/ventas/pedidos", "/administracion");
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
  bump("/ventas", "/ventas/pedidos", "/administracion");
}

/* ------------------------------------------------------------------ */
/* PEDIDOS                                                             */
/*                                                                     */
/* Un pedido es una venta en estado "pedido": el comprador ya confirmó */
/* y el precio está cerrado, pero la entrega depende del clima. No      */
/* genera saldo hasta que se entrega.                                   */
/* ------------------------------------------------------------------ */

/** Cierra la notificación de "confirmar entrega" de un pedido. */
async function cerrarAvisoEntrega(
  supabase: Awaited<ReturnType<typeof sesion>>["supabase"],
  userId: string,
  ventaId: string,
  mensaje?: string,
) {
  const patch: Record<string, unknown> = {
    resuelta: true,
    resuelta_por: userId,
    resuelta_at: new Date().toISOString(),
  };
  if (mensaje) patch.mensaje = mensaje;

  await supabase
    .from("notificaciones")
    .update(patch)
    .eq("entidad_tipo", "pedido")
    .eq("entidad_id", ventaId)
    .eq("resuelta", false);
}

export async function crearPedido(fd: FormData) {
  const { supabase, user } = await sesion();
  const metros = dec(fd, "m2");

  // Los campos mandan el nombre: si el comprador no existe, se crea.
  const clienteId =
    txt(fd, "cliente_id") ??
    (await idPorNombreOCrear(supabase, "clientes", txt(fd, "cliente")));
  const vinculanteId =
    txt(fd, "vinculante_id") ??
    (await idPorNombreOCrear(supabase, "clientes", txt(fd, "vinculante")));

  await supabase.from("ventas").insert({
    cliente_id: clienteId,
    canal: vinculanteId ? "distribuidor" : (txt(fd, "canal") ?? "directa"),
    vinculante_id: vinculanteId,
    cliente_final: txt(fd, "cliente_final"),
    lote_id: txt(fd, "lote_id"),
    fecha: txt(fd, "fecha") ?? hoyISO(),
    fecha_entrega: txt(fd, "fecha_entrega"),
    m2: metros,
    m2_pedido: metros,
    precio_m2: num(fd, "precio_m2"),
    flete: num(fd, "flete") ?? 0,
    estado: "pedido",
    notas: txt(fd, "notas"),
    created_by: user.id,
  });
  bump("/ventas/pedidos", "/ventas", "/administracion");
}

/**
 * Se entregó: recién acá nace la deuda del comprador.
 *
 * Los m² facturados pueden ser más o menos que los pedidos; los de
 * cortesía salen del lote pero no se cobran. La fecha de la venta pasa a
 * ser la de entrega, que es cuando corresponde imputar la facturación.
 */
export async function confirmarEntrega(fd: FormData) {
  const { supabase, user } = await sesion();
  const id = txt(fd, "id")!;
  const fecha = txt(fd, "fecha_entrega") ?? hoyISO();
  const facturados = dec(fd, "m2");
  const cortesia = dec(fd, "m2_cortesia") ?? 0;

  const patch: Record<string, unknown> = {
    estado: "entregada",
    fecha,
    fecha_entrega: fecha,
    m2_cortesia: cortesia,
  };
  if (facturados !== null) patch.m2 = facturados;

  await supabase.from("ventas").update(patch).eq("id", id);
  await cerrarAvisoEntrega(supabase, user.id, id, "Entrega confirmada.");

  bump("/ventas/pedidos", "/ventas", "/administracion");
}

/** Se pasa a una fecha nueva y sigue siendo pedido. */
export async function reprogramarPedido(fd: FormData) {
  const { supabase, user } = await sesion();
  const id = txt(fd, "id")!;
  const nueva = txt(fd, "fecha_entrega");
  if (!nueva) return;

  await supabase
    .from("ventas")
    .update({ estado: "pedido", fecha_entrega: nueva })
    .eq("id", id);

  await cerrarAvisoEntrega(
    supabase,
    user.id,
    id,
    `Reprogramado para el ${nueva.slice(8, 10)}/${nueva.slice(5, 7)}.`,
  );

  bump("/ventas/pedidos", "/ventas", "/administracion");
}

/** Se cayó: no se entrega y no genera saldo. */
export async function anularPedido(fd: FormData) {
  const { supabase, user } = await sesion();
  const id = txt(fd, "id")!;
  await supabase.from("ventas").update({ estado: "anulada" }).eq("id", id);
  await cerrarAvisoEntrega(supabase, user.id, id, "El pedido se cayó.");
  bump("/ventas/pedidos", "/ventas", "/administracion");
}

/* ------------------------------------------------------------------ */
/* CAJA: ingresos y egresos                                            */
/*                                                                     */
/* Una sola tabla para toda la plata. Cada movimiento sabe de qué       */
/* cuenta salió o entró, con quién fue y en qué categoría cae.          */
/* ------------------------------------------------------------------ */

/**
 * Campos comunes a cualquier movimiento de caja.
 *
 * Todo queda guardado en las dos monedas: `monto` siempre en pesos y
 * `monto_usd` siempre en dólares, valorizado con el MEP del día. La
 * cuenta define en cuál de las dos se escribió el importe (todas son en
 * pesos menos USD), y acá se convierte a la otra.
 */
async function movimientoDe(
  fd: FormData,
  userId: string,
  mepDelDia: number | null,
  sb: Sb,
) {
  const escrito = num(fd, "monto");
  const cotizacion = num(fd, "cotizacion") ?? mepDelDia;
  const moneda = txt(fd, "moneda") ?? "ARS";

  // Si se cargó en dólares, lo que se escribió son dólares y los pesos
  // salen de la cotización. Si no hay cotización no se puede convertir:
  // se guarda tal cual y queda pendiente de valorizar.
  const monto =
    moneda === "USD" && escrito !== null && cotizacion
      ? Number((escrito * cotizacion).toFixed(2))
      : escrito;
  const montoUsd =
    moneda === "USD"
      ? escrito
      : monto !== null && cotizacion
        ? Number((monto / cotizacion).toFixed(2))
        : null;

  return {
    fecha: txt(fd, "fecha") ?? hoyISO(),
    cuenta_id: txt(fd, "cuenta_id") ?? (await idPorNombre(sb, "cuentas", txt(fd, "cuenta"))),
    categoria_id:
      txt(fd, "categoria_id") ??
      (await idCategoria(
        sb,
        txt(fd, "categoria"),
        // Solo se crean categorías si el formulario lo pidió con el "+".
        txt(fd, "categoria_crear") === "1"
          ? { tipo: txt(fd, "tipo") === "I" ? "I" : "E" }
          : undefined,
      )),
    persona_id:
      txt(fd, "persona_id") ??
      (await idPorNombreOCrear(sb, "personas", txt(fd, "persona"), { tipo: "otro" })),
    detalle: txt(fd, "detalle"),
    monto,
    moneda,
    cotizacion,
    monto_usd: montoUsd,
    lote_id: txt(fd, "lote_id"),
    venta_id: txt(fd, "venta_id"),
    cliente_id: txt(fd, "cliente_id"),
    notas: txt(fd, "notas"),
    created_by: userId,
  };
}

/* ------------------------------------------------------------------ */
/* Resolver nombres a ids                                              */
/*                                                                     */
/* Los selectores mandan el NOMBRE, no el id: así se puede escribir en  */
/* vez de desplegar una lista. Acá se traduce.                         */
/* ------------------------------------------------------------------ */

type Sb = Awaited<ReturnType<typeof sesion>>["supabase"];

/** Busca por nombre exacto, sin distinguir mayúsculas ni acentos de más. */
async function idPorNombre(sb: Sb, tabla: string, nombre: string | null) {
  if (!nombre) return null;
  const { data } = await sb.from(tabla).select("id").ilike("nombre", nombre.trim()).maybeSingle();
  return data?.id ?? null;
}

/** Igual, pero si no existe lo crea. Para personas y clientes nuevos. */
async function idPorNombreOCrear(sb: Sb, tabla: string, nombre: string | null, extra = {}) {
  if (!nombre) return null;
  const existente = await idPorNombre(sb, tabla, nombre);
  if (existente) return existente;

  const { data } = await sb
    .from(tabla)
    .insert({ nombre: nombre.trim(), ...extra })
    .select("id")
    .single();
  return data?.id ?? null;
}

/**
 * La categoría llega como "Padre · Hijo" o solo "Padre".
 */
async function idCategoria(
  sb: Sb,
  texto: string | null,
  crear?: { tipo: "E" | "I" },
) {
  if (!texto) return null;
  const partes = texto.split("·").map((x) => x.trim());
  const { data: cats } = await sb.from("categorias").select("id, nombre, padre_id");
  if (!cats) return null;

  const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  /** Da de alta la categoría que se agregó con el "+" del formulario. */
  const alta = async (nombre: string, padreId: string | null) => {
    const { data } = await sb
      .from("categorias")
      .insert({ nombre, padre_id: padreId, tipo: crear!.tipo, orden: 999 })
      .select("id")
      .single();
    return data?.id ?? null;
  };

  let padre = cats.find((c: any) => !c.padre_id && igual(c.nombre, partes[0]));
  if (!padre) {
    if (!crear) return null;
    const id = await alta(partes[0], null);
    if (!id || partes.length === 1) return id;
    padre = { id, nombre: partes[0], padre_id: null } as any;
  }

  if (partes.length === 1) return padre!.id;

  const hijo = cats.find(
    (c: any) => c.padre_id === padre!.id && igual(c.nombre, partes[1]),
  );
  if (hijo) return hijo.id;

  return crear ? await alta(partes[1], padre!.id) : padre!.id;
}

/** El MEP más reciente que guardó la corrida diaria. */
async function mepActual(supabase: Awaited<ReturnType<typeof sesion>>["supabase"]) {
  const { data } = await supabase
    .from("cotizaciones")
    .select("mep")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.mep ? Number(data.mep) : null;
}

export async function crearMovimiento(fd: FormData) {
  const { supabase, user } = await sesion();
  const mep = await mepActual(supabase);
  const tipo = txt(fd, "tipo") === "I" ? "I" : "E";

  await supabase.from("movimientos").insert({
    ...(await movimientoDe(fd, user.id, mep, supabase)),
    tipo,
    origen: "manual",
  });

  bump("/administracion", "/reportes", "/ventas/pedidos");
}

export async function borrarMovimiento(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("movimientos").delete().eq("id", txt(fd, "id")!);
  bump("/administracion", "/reportes", "/ventas/pedidos");
}

/** Cobro de un cliente, con o sin venta imputada. Entra como ingreso. */
export async function crearCobro(fd: FormData) {
  const { supabase, user } = await sesion();
  const mep = await mepActual(supabase);
  await supabase.from("movimientos").insert({
    ...(await movimientoDe(fd, user.id, mep, supabase)),
    tipo: "I",
    origen: "venta",
  });
  bump("/administracion", "/ventas", "/ventas/pedidos", "/reportes");
}

/** Gasto imputado a una venta puntual: flete, mano de obra, lo que sea. */
export async function crearGastoVenta(fd: FormData) {
  const { supabase, user } = await sesion();
  const mep = await mepActual(supabase);
  await supabase.from("movimientos").insert({
    ...(await movimientoDe(fd, user.id, mep, supabase)),
    tipo: "E",
    origen: "pedido",
  });
  bump("/ventas/pedidos", "/administracion", "/reportes");
}

/** Alta rápida de una persona o empresa desde la pantalla de caja. */
export async function crearPersona(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("personas").insert({
    nombre: txt(fd, "nombre"),
    tipo: txt(fd, "tipo_persona") ?? "otro",
    telefono: txt(fd, "telefono"),
    notas: txt(fd, "notas"),
  });
  bump("/administracion");
}

export async function crearCuenta(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("cuentas").insert({
    nombre: txt(fd, "nombre"),
    tipo: txt(fd, "tipo_cuenta") ?? "otro",
    moneda: txt(fd, "moneda") ?? "ARS",
  });
  bump("/administracion", "/config");
}

/* ------------------------------------------------------------------ */
/* COSECHA                                                             */
/*                                                                     */
/* Se cosecha por líneas: se cortan panes y se apilan de a dos. La app  */
/* cuenta pilas y traduce a m².                                        */
/* ------------------------------------------------------------------ */

export async function crearCosecha(fd: FormData) {
  const { supabase, user } = await sesion();

  // Si la cosecha sale de un pedido, el objetivo son los m² de ese pedido.
  const ventaId = txt(fd, "venta_id");
  let objetivo = dec(fd, "objetivo_m2");
  if (ventaId && objetivo === null) {
    const { data: v } = await supabase.from("ventas").select("m2").eq("id", ventaId).single();
    objetivo = Number(v?.m2 ?? 0);
  }
  if (!objetivo || objetivo <= 0) return;

  const { data } = await supabase
    .from("cosechas")
    .insert({
      fecha: txt(fd, "fecha") ?? hoyISO(),
      lote_id: txt(fd, "lote_id"),
      venta_id: ventaId,
      objetivo_m2: objetivo,
      pan_largo_m: dec(fd, "pan_largo_m") ?? 0.62,
      pan_ancho_m: dec(fd, "pan_ancho_m") ?? 0.4,
      panes_por_pila: num(fd, "panes_por_pila") ?? 2,
      notas: txt(fd, "notas"),
      created_by: user.id,
    })
    .select("id")
    .single();

  bump("/mantenimiento/cosecha");
  if (data?.id) redirect(`/mantenimiento/cosecha/${data.id}`);
}

/**
 * Guarda una carga: un tramo de líneas con el total de pilas contadas.
 *
 * En el campo se cortan varias líneas al mismo tiempo y se cuenta el
 * montón entero: "de la 2 a la 4 hay 62 pilas" son 62 entre las tres, no
 * 62 en cada una. Por eso el total es del tramo, no por línea.
 *
 * Si volvés a cargar exactamente el mismo tramo, se pisa el valor.
 */
export async function guardarCarga(fd: FormData) {
  const { supabase } = await sesion();
  const cosechaId = txt(fd, "cosecha_id")!;
  const desde = num(fd, "desde");
  if (desde === null || desde < 1) return;

  const hasta = num(fd, "hasta") ?? desde;
  if (hasta < desde) return;

  await supabase.from("cosecha_cargas").upsert(
    {
      cosecha_id: cosechaId,
      linea_desde: desde,
      linea_hasta: hasta,
      pilas: num(fd, "pilas") ?? 0,
      notas: txt(fd, "notas"),
    },
    { onConflict: "cosecha_id,linea_desde,linea_hasta" },
  );

  bump("/mantenimiento/cosecha", `/mantenimiento/cosecha/${cosechaId}`);
}

export async function borrarCarga(fd: FormData) {
  const { supabase } = await sesion();
  const cosechaId = txt(fd, "cosecha_id")!;
  await supabase.from("cosecha_cargas").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/cosecha", `/mantenimiento/cosecha/${cosechaId}`);
}

export async function cambiarEstadoCosecha(fd: FormData) {
  const { supabase } = await sesion();
  const id = txt(fd, "id")!;
  await supabase
    .from("cosechas")
    .update({ estado: txt(fd, "estado") ?? "cerrada" })
    .eq("id", id);
  bump("/mantenimiento/cosecha", `/mantenimiento/cosecha/${id}`);
}

export async function borrarCosecha(fd: FormData) {
  const { supabase } = await sesion();
  await supabase.from("cosechas").delete().eq("id", txt(fd, "id")!);
  bump("/mantenimiento/cosecha");
  redirect("/mantenimiento/cosecha");
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

/**
 * Guarda solo las claves que vinieron en el formulario.
 *
 * Ajustes está partido en varias pantallas y cada una manda sus campos.
 * Si guardáramos todo siempre, entrar a "General" y apretar guardar te
 * borraría la API key de Hydrawise, que vive en otra pantalla.
 */
export async function guardarConfig(fd: FormData) {
  const { supabase } = await sesion();
  const items: { clave: string; valor: unknown }[] = [];

  if (fd.has("hydrawise_api_key")) {
    items.push({ clave: "hydrawise_api_key", valor: txt(fd, "hydrawise_api_key") ?? "" });
  }
  if (fd.has("umbral_lluvia_mm")) {
    items.push({ clave: "umbral_lluvia_mm", valor: dec(fd, "umbral_lluvia_mm") ?? 2 });
  }
  if (fd.has("aviso_fertilizacion_dias")) {
    items.push({
      clave: "aviso_fertilizacion_dias",
      valor: num(fd, "aviso_fertilizacion_dias") ?? 3,
    });
  }
  if (fd.has("precio_m2_default")) {
    items.push({ clave: "precio_m2_default", valor: num(fd, "precio_m2_default") ?? 0 });
  }
  if (fd.has("pan_largo_m")) {
    items.push({ clave: "pan_largo_m", valor: dec(fd, "pan_largo_m") ?? 0.62 });
    items.push({ clave: "pan_ancho_m", valor: dec(fd, "pan_ancho_m") ?? 0.4 });
    items.push({ clave: "panes_por_pila", valor: num(fd, "panes_por_pila") ?? 2 });
  }
  if (fd.has("ubicacion_nombre")) {
    items.push({
      clave: "ubicacion",
      valor: {
        nombre: txt(fd, "ubicacion_nombre") ?? "Cardales",
        lat: dec(fd, "lat") ?? -34.3167,
        lon: dec(fd, "lon") ?? -58.9667,
      },
    });
  }

  for (const it of items) {
    await supabase
      .from("config")
      .upsert(
        { clave: it.clave, valor: it.valor, actualizado_at: new Date().toISOString() },
        { onConflict: "clave" },
      );
  }
  bump("/config", "/config/integraciones", "/config/lotes");
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
  bump("/config/lotes", "/mantenimiento/cortes", "/mantenimiento/riego");
}

/**
 * Alta y edición de categorías, desde Ajustes -> Datos.
 *
 * `tipo` es la regla que después filtra el formulario de caja: una
 * categoría marcada como salida no aparece cuando cargás una entrada.
 */
export async function guardarCategoria(fd: FormData) {
  const { supabase } = await sesion();
  const id = txt(fd, "id");
  const tipo = txt(fd, "tipo");

  if (id) {
    const datos: Record<string, unknown> = {};
    if (tipo) datos.tipo = tipo;
    if (txt(fd, "nombre")) datos.nombre = txt(fd, "nombre");
    if (fd.has("activa")) datos.activa = txt(fd, "activa") === "1";
    if (Object.keys(datos).length) {
      await supabase.from("categorias").update(datos).eq("id", id);

      // Si el rubro pasa a ser de un solo lado, lo que le cuelga lo sigue:
      // no tendría sentido un rubro de salidas con subcategorías de entrada.
      if (datos.tipo && datos.tipo !== "ambos" && !txt(fd, "padre_id")) {
        await supabase
          .from("categorias")
          .update({ tipo: datos.tipo })
          .eq("padre_id", id)
          .neq("tipo", datos.tipo);
      }
    }
  } else {
    await supabase.from("categorias").insert({
      nombre: txt(fd, "nombre"),
      padre_id: txt(fd, "padre_id"),
      tipo: tipo ?? "ambos",
      orden: num(fd, "orden") ?? 999,
    });
  }

  bump("/config/datos", "/administracion", "/reportes");
}

export async function guardarZona(fd: FormData) {
  const { supabase } = await sesion();
  const id = txt(fd, "id");
  const datos = {
    nombre: txt(fd, "nombre"),
    lote_id: txt(fd, "lote_id"),
    hydrawise_controller_id: txt(fd, "hydrawise_controller_id"),
    hydrawise_relay_id: txt(fd, "hydrawise_relay_id"),
    mm_por_hora: dec(fd, "mm_por_hora"),
  };
  if (id) await supabase.from("riego_zonas").update(datos).eq("id", id);
  else await supabase.from("riego_zonas").insert(datos);
  bump("/config/lotes", "/mantenimiento/riego");
}

export async function agregarMiembro(fd: FormData) {
  const { supabase } = await sesion();
  const email = (txt(fd, "email") ?? "").toLowerCase();
  const nombre = txt(fd, "nombre");
  const rol = txt(fd, "rol") ?? "operador";

  await supabase.from("miembros_habilitados").insert({ email, nombre, rol });

  // Si esa persona ya había intentado entrar antes de estar habilitada, su
  // perfil quedó inactivo y el disparador de alta no vuelve a correr. Sin
  // esto la app le abre vacía, sin decirle por qué.
  await supabase
    .from("perfiles")
    .update({ activo: true, rol, ...(nombre ? { nombre } : {}) })
    .ilike("email", email);

  bump("/config/equipo");
}

export async function quitarMiembro(fd: FormData) {
  const { supabase } = await sesion();
  const email = (txt(fd, "email") ?? "").toLowerCase();
  await supabase.from("miembros_habilitados").delete().eq("email", email);
  await supabase.from("perfiles").update({ activo: false }).eq("email", email);
  bump("/config/equipo");
}

/**
 * Define o cambia la contraseña del que está logueado.
 *
 * Solo puede cambiar la suya: updateUser() actúa sobre la sesión activa.
 * Con contraseña se entra sin depender del mail, que en el plan gratis de
 * Supabase está limitado a unos pocos envíos por hora.
 */
export async function cambiarPassword(fd: FormData) {
  const { supabase } = await sesion();
  const clave = txt(fd, "clave") ?? "";
  const repetida = txt(fd, "clave2") ?? "";

  if (clave.length < 8) {
    redirect("/config/cuenta?clave=corta");
  }
  if (clave !== repetida) {
    redirect("/config/cuenta?clave=distintas");
  }

  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    redirect("/config/cuenta?clave=error");
  }

  redirect("/config/cuenta?clave=ok");
}

export async function cambiarAvisoMail(fd: FormData) {
  const { supabase, user } = await sesion();
  await supabase
    .from("perfiles")
    .update({ notificar_mail: fd.get("notificar_mail") === "on" })
    .eq("id", user.id);
  bump("/config/cuenta");
}

/* ------------------------------------------------------------------ */
/* SINCRONIZACIÓN MANUAL                                               */
/* ------------------------------------------------------------------ */

export async function sincronizarAhora() {
  await sesion();
  const { correrTodo } = await import("@/lib/sync");
  await correrTodo();
  bump("/", "/mantenimiento/riego", "/config");
}

/**
 * Asigna el lote de todas las zonas de una, con un solo botón.
 *
 * El formulario manda un select por zona, con name "lote_<id de la zona>".
 * Con 20 zonas, guardar de a una era inusable desde el celular.
 */
export async function asignarZonas(fd: FormData) {
  const { supabase } = await sesion();

  // La tabla manda todas las zonas juntas: lote y caudal de cada una.
  const cambios = new Map<string, Record<string, unknown>>();
  const anotar = (id: string, campo: string, valor: unknown) => {
    if (!cambios.has(id)) cambios.set(id, {});
    cambios.get(id)![campo] = valor;
  };

  for (const [clave, valor] of fd.entries()) {
    if (typeof valor !== "string") continue;
    if (clave.startsWith("lote_")) {
      anotar(clave.slice(5), "lote_id", valor === "" ? null : valor);
    } else if (clave.startsWith("caudal_")) {
      const n = Number(valor.replace(",", "."));
      anotar(clave.slice(7), "mm_por_hora", valor.trim() && n > 0 ? n : null);
    }
  }

  await Promise.all(
    [...cambios.entries()].map(([id, datos]) =>
      supabase.from("riego_zonas").update(datos).eq("id", id),
    ),
  );

  bump("/config/lotes", "/mantenimiento/riego");
}
