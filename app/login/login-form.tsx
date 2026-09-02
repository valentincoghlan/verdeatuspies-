"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "listo" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
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
      setError(error.message);
      setEstado("error");
    } else {
      setEstado("listo");
    }
  }

  if (estado === "listo") {
    return (
      <p className="text-sm text-tierra-800">
        Listo, te mandamos el link a <strong>{email}</strong>. Abrilo desde este
        mismo dispositivo.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div>
        <label className="label" htmlFor="email">
          Mail
        </label>
        <input
          id="email"
          type="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@mail.com"
        />
      </div>
      <button className="btn w-full" disabled={estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviarme el link"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
