import nodemailer from "nodemailer";

const VERDE = "#15803c";

export type NotiMail = {
  titulo: string;
  mensaje?: string | null;
  severidad?: string;
  accion_url?: string | null;
};

export function plantilla(notis: NotiMail[], baseUrl: string) {
  const filas = notis
    .map((n) => {
      const color =
        n.severidad === "urgente" ? "#b91c1c" : n.severidad === "aviso" ? "#b45309" : VERDE;
      const link = n.accion_url ? `${baseUrl}${n.accion_url}` : baseUrl;
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e3e5ec">
            <div style="font:600 15px Inter,Arial,sans-serif;color:${color}">${n.titulo}</div>
            ${n.mensaje ? `<div style="font:400 14px Inter,Arial,sans-serif;color:#5b6273;margin-top:4px">${n.mensaje}</div>` : ""}
            <a href="${link}" style="display:inline-block;margin-top:8px;font:600 13px Inter,Arial,sans-serif;color:${VERDE};text-decoration:none">Abrir en la app →</a>
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f8f8ff;padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
    <tr><td>
      <div style="font:700 16px Inter,Arial,sans-serif;color:#16181f">Verde A Tus Pies</div>
      <div style="font:400 13px Inter,Arial,sans-serif;color:#9ba1b0;margin-top:2px">Pendientes de hoy</div>
    </td></tr>
    ${filas}
    <tr><td style="padding-top:18px;font:400 12px Inter,Arial,sans-serif;color:#9ba1b0">
      Este mail lo manda tu app de gestión del campo.
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Manda el mail desde la casilla del proyecto.
 *
 * Sale por el SMTP de Gmail, con la casilla verdeatuspies@gmail.com y
 * una "contraseña de aplicacion" —no la contraseña de la cuenta—. Se
 * eligió así porque los servicios de envio tipo Resend no dejan mandar
 * desde una dirección @gmail.com: exigen un dominio propio y verificado.
 * Con tres personas y un puñado de avisos por dia, el límite de Gmail
 * (unos 500 mails diarios) sobra de lejos.
 *
 * GMAIL_USER es la casilla y GMAIL_APP_PASSWORD la clave de aplicación.
 * Si falta cualquiera de las dos, no se manda nada y se avisa por qué.
 */
export async function enviarMail({
  to,
  asunto,
  html,
}: {
  to: string[];
  asunto: string;
  html: string;
}) {
  const usuario = process.env.GMAIL_USER;
  const clave = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!usuario || !clave) {
    return { enviado: false, motivo: "falta GMAIL_USER o GMAIL_APP_PASSWORD" };
  }
  if (to.length === 0) return { enviado: false, motivo: "sin destinatarios" };

  try {
    const correo = nodemailer.createTransport({
      service: "gmail",
      auth: { user: usuario, pass: clave },
    });

    await correo.sendMail({
      from: process.env.MAIL_FROM ?? `Verde A Tus Pies <${usuario}>`,
      to: to.join(", "),
      subject: asunto,
      html,
    });

    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : "error al enviar" };
  }
}
