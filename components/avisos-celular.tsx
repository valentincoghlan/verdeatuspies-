"use client";

import { useEffect, useState } from "react";

/** La clave pública viaja en un formato que el navegador no entiende tal cual. */
function aBytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const limpio = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(limpio);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

type Estado = "cargando" | "no-soportado" | "apagado" | "prendido" | "bloqueado";

/**
 * Prender los avisos de riego en este teléfono.
 *
 * Cada aparato se registra por separado: el permiso lo da el navegador y
 * queda atado a ese teléfono, así que hay que prenderlo una vez en cada
 * uno. En iPhone solo funciona si antes agregaste la app a la pantalla
 * de inicio; desde el navegador Apple no deja.
 */
export function AvisosCelular({
  clavePublica,
  guardar,
  borrar,
}: {
  clavePublica: string;
  guardar: (fd: FormData) => Promise<void>;
  borrar: (fd: FormData) => Promise<void>;
}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no-soportado");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "prendido" : "apagado");
    })();
  }, []);

  const prender = async () => {
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: aBytes(clavePublica),
      });

      const json: any = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", json.endpoint);
      fd.set("p256dh", json.keys.p256dh);
      fd.set("auth", json.keys.auth);
      fd.set("aparato", navigator.userAgent.slice(0, 120));
      await guardar(fd);

      setEstado("prendido");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  const apagar = async () => {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set("endpoint", sub.endpoint);
        await borrar(fd);
        await sub.unsubscribe();
      }
      setEstado("apagado");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  if (estado === "cargando") {
    return <p className="text-sm text-tinta-3">Viendo si este teléfono puede recibir avisos…</p>;
  }

  if (estado === "no-soportado") {
    return (
      <p className="text-sm text-tinta-2">
        Este navegador no maneja avisos. En iPhone hay que abrir la app desde la pantalla de
        inicio: tocá Compartir y después &laquo;Agregar a inicio&raquo;.
      </p>
    );
  }

  if (estado === "bloqueado") {
    return (
      <p className="rounded-xl bg-atencion-bg p-3 text-sm text-atencion-tx">
        Los avisos están bloqueados para este sitio. Hay que habilitarlos desde los ajustes del
        navegador, en la parte de permisos de notificaciones, y volver acá.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={estado === "prendido" ? apagar : prender}
          className={estado === "prendido" ? "btn-ghost" : "btn"}
        >
          {estado === "prendido" ? "Apagar avisos en este teléfono" : "Prender avisos acá"}
        </button>
        {estado === "prendido" && (
          <span className="text-sm font-semibold text-pasto">Este teléfono ya recibe avisos.</span>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-urgente-tx">{error}</p>}

      <p className="mt-2 text-xs text-tinta-3">
        El permiso queda atado a este teléfono: hay que prenderlo una vez en cada uno. Los avisos
        llegan aunque la app esté cerrada.
      </p>
    </div>
  );
}
