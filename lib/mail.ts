import { Resend } from "resend";

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

export async function enviarMail({
  to,
  asunto,
  html,
}: {
  to: string[];
  asunto: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0) return { enviado: false, motivo: "sin RESEND_API_KEY o sin destinatarios" };

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM ?? "Verde A Tus Pies <onboarding@resend.dev>",
    to,
    subject: asunto,
    html,
  });

  if (error) return { enviado: false, motivo: error.message };
  return { enviado: true };
}
