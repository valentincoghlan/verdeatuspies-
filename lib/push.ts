import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

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
};

export async function enviarPush(aviso: Aviso) {
  if (!preparar()) return { enviados: 0, motivo: "faltan las claves VAPID" };

  const sb = createAdminClient();
  const { data: destinos } = await sb.from("push_suscripciones").select("*");
  if (!destinos?.length) return { enviados: 0, motivo: "no hay celulares registrados" };

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
