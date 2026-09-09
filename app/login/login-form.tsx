"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Modo = "clave" | "link";

export default function LoginForm() {
  const [modo, setModo] = useState<Modo>("clave");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "listo" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function entrarConClave(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: clave,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Mail o contraseña incorrectos. Si nunca pusiste una, entrá con el link por mail."
          : error.message,
      );
      setEstado("error");
      return;
    }

    // Recarga completa para que el servidor lea la sesión nueva de las cookies.
    window.location.href = "/";
  }

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setError(
        error.message.includes("rate limit")
          ? "Supabase manda pocos mails por hora y ya se llegó al tope. Probá dentro de un rato, o entrá con contraseña."
          : error.message,
      );
      setEstado("error");
    } else {
      setEstado("listo");
    }
  }

  if (estado === "listo") {
    return (
      <p className="text-sm text-tinta">
        Listo, te mandamos el link a <strong>{email}</strong>. Abrilo desde este mismo
        dispositivo.
      </p>
    );
  }

  /**
   * Entrar con la cuenta de Google.
   *
   * Es el camino corto en el celular: un toque, sin contraseña ni
   * esperar un mail. Supabase se encarga de todo y vuelve a
   * /auth/confirm, igual que el link por mail.
   *
   * Quién puede entrar no cambia: el perfil queda activo solo si el mail
   * está en la lista de habilitados.
   */
  async function entrarConGoogle() {
    setEstado("enviando");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    });

    if (error) {
      setError(error.message);
      setEstado("error");
    }
  }

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError(null);
    setEstado("idle");
  };

  return (
    <>
      <button
        type="button"
        onClick={entrarConGoogle}
        disabled={estado === "enviando"}
        className="mb-4 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-borde bg-white text-sm font-bold text-tinta transition hover:bg-beige disabled:opacity-60"
      >
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
          <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.6 5-4.5 7l6.9 5.3C42.5 36.2 45 30.6 45 24z" />
          <path fill="#34A853" d="M24 46c5.9 0 10.8-1.9 14.4-5.2l-6.9-5.3c-1.8 1.3-4.3 2.2-7.5 2.2-5.7 0-10.6-3.8-12.3-9.1l-7.1 5.5C8.2 41.1 15.5 46 24 46z" />
          <path fill="#FBBC05" d="M11.7 28.6c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1l-7.1-5.5C3.2 17.7 2.5 20.8 2.5 24s.7 6.3 2.1 9.1l7.1-4.5z" />
          <path fill="#EA4335" d="M24 10.6c3.2 0 5.4 1.4 6.7 2.5l6.1-5.9C33.1 3.8 28.4 2 24 2 15.5 2 8.2 6.9 4.6 14.1l7.1 5.5c1.7-5.3 6.6-9 12.3-9z" />
        </svg>
        Entrar con Google
      </button>

      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-borde" />
        <span className="text-xs text-tinta-3">o con tu mail</span>
        <span className="h-px flex-1 bg-borde" />
      </div>

      <form onSubmit={modo === "clave" ? entrarConClave : pedirLink} className="space-y-3">
      <div>
        <label className="label" htmlFor="email">
          Mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@mail.com"
        />
      </div>

      {modo === "clave" && (
        <div>
          <label className="label" htmlFor="clave">
            Contraseña
          </label>
          <input
            id="clave"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
      )}

      <button className="btn w-full" disabled={estado === "enviando"}>
        {estado === "enviando"
          ? modo === "clave"
            ? "Entrando…"
            : "Enviando…"
          : modo === "clave"
            ? "Entrar"
            : "Enviarme el link"}
      </button>

      {error && <p className="text-xs text-urgente-tx">{error}</p>}

      <button
        type="button"
        onClick={() => cambiarModo(modo === "clave" ? "link" : "clave")}
        className="w-full text-center text-xs font-semibold text-tinta-2 hover:text-tinta"
      >
        {modo === "clave"
          ? "No tengo contraseña, mandame un link por mail"
          : "Prefiero entrar con contraseña"}
      </button>
      </form>
    </>
  );
}
