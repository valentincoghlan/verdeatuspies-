import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { enviarMail, plantilla } from "@/lib/mail";

/**
 * Avisos al celular.
 *
 * El navegador de cada teléfono nos da una dirección propia y dos
 * claves; con eso el mensaje viaja cifrado hasta ese aparato, aunque la
 * app esté cerrada. No hay servicio de terceros en el medio.
 *
 * Las direcciones se vencen solas cuando alguien desinstala la app o
 * revoca el permiso: en ese caso el envío devuelve 404 o 410 y la
 * borramos, así no se acumula basura.
 */

let configurado = false;

function preparar() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;

  if (!configurado) {
    webpush.setVapidDetails("mailto:valentincoghlan@gmail.com", publica, privada);
    configurado = true;
  }
  return true;
}

export type Aviso = {
  titulo: string;
  mensaje: string;
  url?: string;
  /** Los avisos con la misma etiqueta se reemplazan en vez de apilarse. */
  tag?: string;
  /** De qué se trata. Sirve para respetar quién apagó qué. */
  tipo?: string;
};

/**
 * Manda un aviso por los dos lados: al celular y por mail.
 *
 * Cada persona elige qué recibe y por dónde, así que el mismo aviso le
 * puede llegar a uno al teléfono, a otro al correo y a un tercero por
 * los dos. Los avisos del momento —abrir un riego, cerrar una entrega—
 * salen por acá; los de la corrida diaria van juntos en el resumen.
 */
export async function enviarAviso(aviso: Aviso) {
  const push = await enviarPush(aviso);
  const mail = await enviarAvisoPorMail(aviso);
  return { push, mail };
}

async function enviarAvisoPorMail(aviso: Aviso) {
  if (!aviso.tipo) return { enviados: 0, motivo: "sin tipo" };

  const sb = createAdminClient();
  const { data: perfiles } = await sb
    .from("perfiles")
    .select("email, mails_apagados")
    .eq("activo", true)
    .eq("notificar_mail", true);

  const to = (perfiles ?? [])
    .filter((p: any) => p.email && !(p.mails_apagados ?? []).includes(aviso.tipo))
    .map((p: any) => p.email as string);

  if (!to.length) return { enviados: 0, motivo: "nadie lo quiere por mail" };

  const res = await enviarMail({
    to,
    asunto: aviso.titulo,
    html: plantilla(
      [{ titulo: aviso.titulo, mensaje: aviso.mensaje, accion_url: aviso.url ?? "/" }],
      process.env.NEXT_PUBLIC_APP_URL ?? "",
    ),
  });

  return { enviados: res.enviado ? to.length : 0, motivo: res.motivo };
}

export async function enviarPush(aviso: Aviso) {
  if (!preparar()) return { enviados: 0, motivo: "faltan las claves VAPID" };

  const sb = createAdminClient();
  const { data: todos } = await sb
    .from("push_suscripciones")
    .select("*, perfiles(avisos_apagados)");

  // Cada uno decide qué le llega al celular. Sin tipo, el aviso va a
  // todos: es el caso de la prueba, que tiene que llegar siempre.
  const destinos = (todos ?? []).filter((d: any) =>
    aviso.tipo ? !(d.perfiles?.avisos_apagados ?? []).includes(aviso.tipo) : true,
  );

  if (!destinos.length) {
    return {
      enviados: 0,
      motivo: todos?.length ? "nadie quiere recibir este aviso" : "no hay celulares registrados",
    };
  }

  const cuerpo = JSON.stringify({ url: "/", ...aviso });
  let enviados = 0;
  const vencidas: string[] = [];

  await Promise.all(
    destinos.map(async (d: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          cuerpo,
        );
        enviados++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.push(d.id);
      }
    }),
  );

  if (vencidas.length) await sb.from("push_suscripciones").delete().in("id", vencidas);

  return { enviados, vencidas: vencidas.length };
}
