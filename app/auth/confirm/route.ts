import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * La vuelta de cualquier forma de entrar que no sea la contraseña.
 *
 * Hay dos maneras de llegar acá y traen cosas distintas:
 *
 *   token_hash + type   el link que llega por mail
 *   code                Google, y en general cualquier proveedor
 *
 * Las dos terminan igual: se canjea lo que vino por una sesión y se
 * deja al usuario adentro.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Google puede devolver un error antes de llegar a canjear nada
  // (por ejemplo si la persona cancela en la pantalla de permisos).
  const errorProveedor = searchParams.get("error_description") ?? searchParams.get("error");
  if (errorProveedor) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorProveedor)}`, request.url),
    );
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=link_invalido", request.url));
}
