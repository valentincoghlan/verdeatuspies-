import { createAdminClient } from "@/lib/supabase/server";
import { traerClima } from "@/lib/clima";
import { traerMep } from "@/lib/dolar";
import { enviarMail, plantilla, type NotiMail } from "@/lib/mail";
import {
  estadoControlador,
  fechaArgentina,
  horaArgentina,
  listarControladores,
  parsearUltimoRiego,
  SIN_PROGRAMAR,
} from "@/lib/hydrawise";

type Sb = ReturnType<typeof createAdminClient>;

function hoyAR() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .slice(0, 10);
}

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** mm con coma decimal, como el resto de la app. */
function mmTxt(n: number) {
  return n.toFixed(1).replace(".", ",");
}

function diasEntre(a: string, b: string) {
  return Math.round(
    (new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000,
  );
}

async function leerConfig(sb: Sb) {
  const { data } = await sb.from("config").select("clave, valor");
  const map = new Map<string, any>((data ?? []).map((r: any) => [r.clave, r.valor]));
  return {
    hydrawiseKey: String(map.get("hydrawise_api_key") ?? "").trim(),
    umbralLluvia: Number(map.get("umbral_lluvia_mm") ?? 2),
    avisoFertDias: Number(map.get("aviso_fertilizacion_dias") ?? 3),
    ubicacion: (map.get("ubicacion") ?? {
      nombre: "Cardales",
      lat: -34.3167,
      lon: -58.9667,
    }) as { nombre: string; lat: number; lon: number },
  };
}

/** Alta idempotente de notificación (clave_unica evita duplicados). */
async function noti(
  sb: Sb,
  n: {
    tipo: string;
    titulo: string;
    mensaje?: string;
    severidad?: "info" | "aviso" | "urgente";
    entidad_tipo?: string;
    entidad_id?: string | null;
    fecha_referencia?: string | null;
    requiere_accion?: boolean;
    accion_url?: string;
    clave_unica: string;
  },
) {
  const { data } = await sb
    .from("notificaciones")
    .upsert({ severidad: "info", requiere_accion: false, ...n }, { onConflict: "clave_unica", ignoreDuplicates: true })
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Alta o puesta al día de un aviso de entrega.
 *
 * A diferencia de noti(), si el aviso ya existe y sigue abierto le
 * actualiza el texto: el pronóstico de ese día cambia de una corrida a
 * otra, y un aviso que quedó congelado con el pronóstico viejo miente.
 * Si además el clima empeoró hasta ponerse urgente, limpia la marca de
 * mail enviado para que el digest lo avise de nuevo — una sola vez.
 *
 * Un aviso que ya resolviste no se toca.
 */
async function avisoEntrega(
  sb: Sb,
  n: {
    tipo: string;
    titulo: string;
    mensaje: string;
    severidad: "info" | "aviso" | "urgente";
    entidad_id: string;
    fecha_referencia: string;
    requiere_accion: boolean;
    clave_unica: string;
  },
) {
  const fila = {
    ...n,
    entidad_tipo: "pedido",
    accion_url: "/ventas/pedidos",
  };

  const { data: existente } = await sb
    .from("notificaciones")
    .select("id, severidad, resuelta, mail_enviado_at")
    .eq("clave_unica", n.clave_unica)
    .maybeSingle();

  if (!existente) {
    await sb.from("notificaciones").insert(fila);
    return true;
  }

  if (existente.resuelta) return false;

  const empeoro = n.severidad === "urgente" && existente.severidad !== "urgente";

  await sb
    .from("notificaciones")
    .update({
      titulo: n.titulo,
      mensaje: n.mensaje,
      severidad: n.severidad,
      ...(empeoro ? { mail_enviado_at: null } : {}),
    })
    .eq("id", existente.id);

  return false;
}

/* =================================================================== */
/* 1. Hydrawise                                                        */
/* =================================================================== */

export async function syncHydrawise() {
  const sb = createAdminClient();
  const { hydrawiseKey } = await leerConfig(sb);

  if (!hydrawiseKey) {
    return { ok: false, motivo: "Falta la API key de Hydrawise (Config)", zonas: 0, riegos: 0 };
  }

  let zonasTocadas = 0;
  let riegosCreados = 0;
  const ahora = new Date();
  const snapshot: any[] = [];

  try {
    const controladores = await listarControladores(hydrawiseKey);

    for (const c of controladores) {
      const estado = await estadoControlador(hydrawiseKey, c.controller_id);
      snapshot.push({ controlador: c, estado });

      const corriendo = new Map<string, number>();
      for (const r of estado.running ?? []) {
        const id = String(r.relay_id ?? r.relay ?? "");
        if (id) corriendo.set(id, Number(r.time_left ?? 0));
      }

      for (const relay of estado.relays ?? []) {
        const relayId = String(relay.relay_id ?? relay.relay ?? "");
        if (!relayId) continue;

        // Catálogo de zonas + lo que tiene programado
        //
        // `time` son los segundos que faltan para el próximo riego. Si es
        // un número enorme, esa zona no tiene nada programado. `run` es
        // cuánto va a durar ese riego, también en segundos.
        const faltan = Number(relay.time ?? 0);
        const programado = faltan > 0 && faltan < SIN_PROGRAMAR;
        const duracion = Number(relay.run ?? 0);

        // La cuenta se hace con el reloj del controlador, no con el
        // nuestro: `estado.time` es la hora de Hunter en ese instante, y
        // sumarle los segundos que faltan da la hora exacta del riego.
        // Con Date.now() los milisegundos sueltos convertían las 6:00 en
        // las 5:59.
        const referencia = Number(estado.time) || Math.floor(ahora.getTime() / 1000);

        const { data: zona } = await sb
          .from("riego_zonas")
          .upsert(
            {
              nombre: relay.name ?? `Zona ${relay.relay ?? relayId}`,
              hydrawise_controller_id: String(c.controller_id),
              hydrawise_relay_id: relayId,
              proximo_riego_at: programado
                ? new Date((referencia + faltan) * 1000).toISOString()
                : null,
              proximo_minutos: programado && duracion ? Math.round(duracion / 60) : null,
            },
            { onConflict: "hydrawise_controller_id,hydrawise_relay_id" },
          )
          .select("id, lote_id")
          .single();

        zonasTocadas++;
        if (!zona) continue;

        // ¿Corrió hoy? Por zona corriendo ahora o por último riego informado.
        const estaCorriendo = corriendo.has(relayId);
        const ultimo = estaCorriendo ? ahora : parsearUltimoRiego(relay.lastwater, ahora);
        if (!ultimo) continue;

        const fecha = fechaArgentina(ultimo);
        if (diasEntre(fecha, hoyAR()) > 7) continue; // no reescribimos historia vieja

        const key = `${c.controller_id}:${relayId}:${fecha}`;
        const minutos = relay.run ? Math.round(Number(relay.run) / 60) || null : null;

        const { data: creado } = await sb
          .from("riegos")
          .upsert(
            {
              hydrawise_key: key,
              zona_id: zona.id,
              lote_id: zona.lote_id,
              fecha,
              hora: horaArgentina(ultimo),
              minutos,
              origen: "hydrawise",
              notas: estaCorriendo
                ? "Detectado corriendo por Hydrawise"
                : "Importado de Hydrawise — minutos estimados del ciclo programado",
            },
            { onConflict: "hydrawise_key", ignoreDuplicates: true },
          )
          .select("id");

        if (creado?.length) riegosCreados++;
      }
    }

    await sb
      .from("hydrawise_snapshots")
      .insert({ payload: { controladores: snapshot }, creados: riegosCreados });

    return { ok: true, zonas: zonasTocadas, riegos: riegosCreados };
  } catch (e: any) {
    await sb
      .from("hydrawise_snapshots")
      .insert({ payload: { controladores: snapshot }, error: String(e?.message ?? e) });
    return { ok: false, motivo: String(e?.message ?? e), zonas: zonasTocadas, riegos: riegosCreados };
  }
}

/* =================================================================== */
/* 2. Clima                                                            */
/* =================================================================== */

export async function syncClima() {
  const sb = createAdminClient();
  const { ubicacion } = await leerConfig(sb);

  try {
    const dias = await traerClima(ubicacion.lat, ubicacion.lon);
    if (dias.length === 0) return { ok: false, motivo: "Open-Meteo no devolvió días" };

    await sb.from("clima_dias").upsert(
      dias.map((d) => ({ ...d, actualizado_at: new Date().toISOString() })),
      { onConflict: "fecha" },
    );

    return { ok: true, dias: dias.length };
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message ?? e) };
  }
}

/* =================================================================== */
/* 2b. Dólar MEP                                                       */
/* =================================================================== */

/** Guarda el MEP del día. Si la API no contesta, no rompe la corrida. */
export async function syncDolar() {
  const sb = createAdminClient();
  const mep = await traerMep();
  if (!mep) return { ok: false, motivo: "no se pudo leer el dólar MEP" };

  await sb.from("cotizaciones").upsert(
    {
      fecha: hoyAR(),
      mep: mep.valor,
      fuente: "dolarapi.com",
      actualizado_at: mep.actualizado,
    },
    { onConflict: "fecha" },
  );

  return { ok: true, mep: mep.valor };
}

/* =================================================================== */
/* 3. Alertas                                                          */
/* =================================================================== */

export async function generarAlertas() {
  const sb = createAdminClient();
  const { umbralLluvia, avisoFertDias, ubicacion } = await leerConfig(sb);
  const hoy = hoyAR();
  const nuevas: string[] = [];

  /* --- 3a. Lluvia observada sin confirmar --------------------------- */
  const { data: climaPasado } = await sb
    .from("clima_dias")
    .select("fecha, precipitacion_mm")
    .gte("fecha", sumarDias(hoy, -3))
    .lte("fecha", hoy)
    .order("fecha");

  const { data: lluviasCargadas } = await sb
    .from("lluvias")
    .select("fecha")
    .gte("fecha", sumarDias(hoy, -3));

  const yaCargadas = new Set((lluviasCargadas ?? []).map((l: any) => l.fecha));

  for (const d of climaPasado ?? []) {
    const mmPron = Number(d.precipitacion_mm ?? 0);
    if (mmPron < umbralLluvia || yaCargadas.has(d.fecha)) continue;

    const creada = await noti(sb, {
      tipo: "confirmar_lluvia",
      titulo: `¿Llovió en ${ubicacion.nombre} el ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}?`,
      mensaje: `El pronóstico marcó ${mmTxt(mmPron)} mm. Confirmá si llovió y cargá los mm reales del pluviómetro.`,
      severidad: "aviso",
      entidad_tipo: "lluvia",
      fecha_referencia: d.fecha,
      requiere_accion: true,
      accion_url: "/mantenimiento/riego",
      clave_unica: `confirmar_lluvia:${d.fecha}`,
    });
    if (creada) nuevas.push("lluvia");
  }

  /* --- 3b. Pronóstico de lluvia próxima ----------------------------- */
  const { data: climaFuturo } = await sb
    .from("clima_dias")
    .select("fecha, precipitacion_mm, prob_precipitacion")
    .gt("fecha", hoy)
    .lte("fecha", sumarDias(hoy, 2))
    .order("fecha");

  for (const d of climaFuturo ?? []) {
    const mmPron = Number(d.precipitacion_mm ?? 0);
    if (mmPron < umbralLluvia) continue;

    const creada = await noti(sb, {
      tipo: "pronostico_lluvia",
      titulo: `Lluvia pronosticada para el ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`,
      mensaje: `${mmTxt(mmPron)} mm estimados (${d.prob_precipitacion ?? "?"}% de probabilidad). Conviene revisar riego y fertilizaciones agendadas.`,
      severidad: "info",
      fecha_referencia: d.fecha,
      accion_url: "/mantenimiento/riego",
      clave_unica: `pronostico_lluvia:${d.fecha}`,
    });
    if (creada) nuevas.push("pronostico");
  }

  /* --- 3c. Fertilizaciones agendadas -------------------------------- */
  const { data: ferts } = await sb
    .from("fertilizaciones")
    .select("id, fecha_programada, dosis, unidad, lotes(nombre), fertilizantes(nombre)")
    .eq("estado", "programada")
    .lte("fecha_programada", sumarDias(hoy, avisoFertDias));

  for (const f of (ferts ?? []) as any[]) {
    const atrasada = f.fecha_programada < hoy;
    const creada = await noti(sb, {
      tipo: "fertilizacion",
      titulo: atrasada
        ? `Fertilización atrasada en ${f.lotes?.nombre ?? "el campo"}`
        : `Fertilización agendada en ${f.lotes?.nombre ?? "el campo"}`,
      mensaje: `${f.fertilizantes?.nombre ?? "Fertilizante"}${f.dosis ? ` — ${f.dosis} ${f.unidad ?? "kg"}` : ""} para el ${f.fecha_programada.slice(8, 10)}/${f.fecha_programada.slice(5, 7)}.`,
      severidad: atrasada ? "urgente" : "aviso",
      entidad_tipo: "fertilizacion",
      entidad_id: f.id,
      fecha_referencia: f.fecha_programada,
      requiere_accion: true,
      accion_url: "/mantenimiento/fertilizaciones",
      clave_unica: `fertilizacion:${f.id}:${atrasada ? "atrasada" : f.fecha_programada}`,
    });
    if (creada) nuevas.push("fertilizacion");
  }

  /* --- 3d. Cortes atrasados ----------------------------------------- */
  const { data: lotes } = await sb
    .from("v_estado_lotes")
    .select("lote_id, nombre, ultimo_corte, dias_objetivo_corte, ultimo_riego");

  for (const l of (lotes ?? []) as any[]) {
    const objetivo = Number(l.dias_objetivo_corte ?? 14);
    const dias = l.ultimo_corte ? diasEntre(l.ultimo_corte, hoy) : null;

    if (dias !== null && dias >= objetivo) {
      const creada = await noti(sb, {
        tipo: "corte_atrasado",
        titulo: `${l.nombre}: hace ${dias} días que no se corta`,
        mensaje: `El objetivo es cada ${objetivo} días. Último corte: ${l.ultimo_corte}.`,
        severidad: dias >= objetivo + 7 ? "urgente" : "aviso",
        entidad_tipo: "lote",
        entidad_id: l.lote_id,
        requiere_accion: true,
        accion_url: "/mantenimiento/cortes",
        clave_unica: `corte_atrasado:${l.lote_id}:${sumarDias(hoy, -(dias % objetivo))}`,
      });
      if (creada) nuevas.push("corte");
    }
  }

  /* --- 3e. Sin riego ni lluvia hace varios días --------------------- */
  const { data: ultLluvia } = await sb
    .from("lluvias")
    .select("fecha")
    .order("fecha", { ascending: false })
    .limit(1);
  const { data: ultRiego } = await sb
    .from("riegos")
    .select("fecha")
    .order("fecha", { ascending: false })
    .limit(1);

  const ultimoAgua = [ultLluvia?.[0]?.fecha, ultRiego?.[0]?.fecha]
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  if (ultimoAgua && diasEntre(ultimoAgua, hoy) >= 4) {
    const creada = await noti(sb, {
      tipo: "sin_agua",
      titulo: `Hace ${diasEntre(ultimoAgua, hoy)} días sin riego ni lluvia registrados`,
      mensaje: "Revisá si falta cargar algún riego o si el campo necesita agua.",
      severidad: "aviso",
      requiere_accion: false,
      accion_url: "/mantenimiento/riego",
      clave_unica: `sin_agua:${ultimoAgua}:${hoy}`,
    });
    if (creada) nuevas.push("sin_agua");
  }

  /* --- 3f. Entregas de pedidos -------------------------------------- */
  // Aviso 2 días antes y el día de la entrega. Si el pronóstico marca
  // lluvia sobre el umbral, el aviso sugiere reprogramar.
  const { data: pedidos } = await sb
    .from("ventas")
    .select("id, fecha_entrega, m2, total, cliente_final, clientes!cliente_id(nombre), lotes(nombre)")
    .eq("estado", "pedido")
    .not("fecha_entrega", "is", null)
    .lte("fecha_entrega", sumarDias(hoy, 2))
    .order("fecha_entrega");

  const fechasEntrega = [...new Set((pedidos ?? []).map((p: any) => p.fecha_entrega))];
  const climaEntregas = fechasEntrega.length
    ? (
        await sb
          .from("clima_dias")
          .select("fecha, precipitacion_mm, prob_precipitacion")
          .in("fecha", fechasEntrega)
      ).data
    : [];
  const climaPorFecha = new Map(
    (climaEntregas ?? []).map((c: any) => [c.fecha, c]),
  );

  for (const p of (pedidos ?? []) as any[]) {
    const dias = diasEntre(hoy, p.fecha_entrega);
    const dm = `${p.fecha_entrega.slice(8, 10)}/${p.fecha_entrega.slice(5, 7)}`;
    const comprador = p.clientes?.nombre ?? "un comprador";
    const cl = climaPorFecha.get(p.fecha_entrega);
    const mmPron = Number(cl?.precipitacion_mm ?? 0);
    const llueve = cl != null && mmPron >= umbralLluvia;

    const clima = !cl
      ? " Todavía no hay pronóstico para ese día."
      : llueve
        ? ` El pronóstico marca ${mmTxt(mmPron)} mm (${cl.prob_precipitacion ?? "?"}%): conviene reprogramar.`
        : ` Pronóstico: ${mmTxt(mmPron)} mm, sin lluvia importante.`;

    const detalle = `${Number(p.m2).toLocaleString("es-AR")} m² para ${comprador}${
      p.lotes?.nombre ? ` desde ${p.lotes.nombre}` : ""
    }.`;

    if (dias > 0) {
      const creada = await avisoEntrega(sb, {
        tipo: "entrega_proxima",
        titulo: llueve
          ? `Entrega del ${dm} en riesgo por lluvia`
          : `Entrega el ${dm}: ${comprador}`,
        mensaje: `${detalle}${clima}`,
        severidad: llueve ? "urgente" : "aviso",
        entidad_id: p.id,
        fecha_referencia: p.fecha_entrega,
        requiere_accion: false,
        clave_unica: `entrega_proxima:${p.id}:${p.fecha_entrega}`,
      });
      if (creada) nuevas.push("entrega_proxima");
    } else {
      const atrasada = dias < 0;
      const creada = await avisoEntrega(sb, {
        tipo: "confirmar_entrega",
        titulo: atrasada
          ? `¿Se entregó el pedido de ${comprador}? (era el ${dm})`
          : `¿Se entregó el pedido de ${comprador}?`,
        mensaje: `${detalle}${clima}`,
        severidad: atrasada || llueve ? "urgente" : "aviso",
        entidad_id: p.id,
        fecha_referencia: p.fecha_entrega,
        requiere_accion: true,
        clave_unica: `confirmar_entrega:${p.id}:${p.fecha_entrega}`,
      });
      if (creada) nuevas.push("confirmar_entrega");
    }
  }

  return { ok: true, nuevas: nuevas.length, detalle: nuevas };
}

/* =================================================================== */
/* 4. Digest por mail                                                  */
/* =================================================================== */

export async function enviarDigest() {
  const sb = createAdminClient();

  const { data: pendientes } = await sb
    .from("notificaciones")
    .select("id, titulo, mensaje, severidad, accion_url")
    .eq("resuelta", false)
    .is("mail_enviado_at", null)
    .neq("severidad", "info")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!pendientes?.length) return { ok: true, enviado: false, motivo: "nada nuevo para avisar" };

  const { data: perfiles } = await sb
    .from("perfiles")
    .select("email")
    .eq("activo", true)
    .eq("notificar_mail", true);

  const to = (perfiles ?? []).map((p: any) => p.email).filter(Boolean);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const res = await enviarMail({
    to,
    asunto:
      pendientes.length === 1
        ? pendientes[0].titulo
        : `Verde A Tus Pies: ${pendientes.length} pendientes`,
    html: plantilla(pendientes as NotiMail[], baseUrl),
  });

  if (res.enviado) {
    await sb
      .from("notificaciones")
      .update({ mail_enviado_at: new Date().toISOString() })
      .in("id", pendientes.map((p: any) => p.id));
  }

  return { ok: true, enviado: res.enviado, motivo: res.motivo, destinatarios: to.length };
}

/* =================================================================== */
/* 5. Corrida completa                                                 */
/* =================================================================== */

export async function correrTodo() {
  const clima = await syncClima();
  const dolar = await syncDolar();
  const hydrawise = await syncHydrawise();
  const alertas = await generarAlertas();
  const mail = await enviarDigest();
  return { clima, dolar, hydrawise, alertas, mail, at: new Date().toISOString() };
}
