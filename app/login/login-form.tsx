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
      <p className="text-sm text-tierra-800">
        Listo, te mandamos el link a <strong>{email}</strong>. Abrilo desde este mismo
        dispositivo.
      </p>
    );
  }

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError(null);
    setEstado("idle");
  };

  return (
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

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => cambiarModo(modo === "clave" ? "link" : "clave")}
        className="w-full text-center text-xs font-semibold text-tierra-600 hover:text-tierra-900"
      >
        {modo === "clave"
          ? "No tengo contraseña, mandame un link por mail"
          : "Prefiero entrar con contraseña"}
      </button>
    </form>
  );
}
