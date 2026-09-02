import { NextResponse, type NextRequest } from "next/server";
import { correrTodo } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Corrida automática: clima -> Hydrawise -> alertas -> mail.
 *
 * La llama el cron de Vercel (vercel.json) o cualquier scheduler externo:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://TU-APP/api/cron/diario
 *
 * Si querés más precisión en el detalle de riego, corrélo cada 15-30 min
 * desde un scheduler externo (cron-job.org, GitHub Actions, pg_cron).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const resultado = await correrTodo();
  return NextResponse.json(resultado);
}
