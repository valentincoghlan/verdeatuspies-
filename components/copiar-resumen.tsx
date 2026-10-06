"use client";

import { useState } from "react";
import { dibujar, type ResumenParaImagen } from "@/lib/resumen-imagen";

export type { ResumenParaImagen };

/**
 * El botón que copia el resumen de cuenta como imagen, para pegársela al
 * cliente por WhatsApp. El dibujo vive en `lib/resumen-imagen.ts`.
 */

export function CopiarResumen({ datos }: { datos: ResumenParaImagen }) {
  const [estado, setEstado] = useState<"listo" | "yendo" | "ok" | "bajado" | "error">(
    "listo",
  );

  async function copiar() {
    setEstado("yendo");
    try {
      // Sin esto la primera imagen sale con la tipografía de respaldo: el
      // canvas dibuja con lo que haya cargado en ese instante.
      if (document.fonts?.ready) await document.fonts.ready;

      const canvas = dibujar(datos);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("sin imagen");

      // Firefox todavía no deja escribir imágenes en el portapapeles: ahí
      // se baja el archivo, que para mandarlo por WhatsApp sirve igual.
      const bajar = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cuenta-${datos.cliente.replace(/\s+/g, "-").toLowerCase()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setEstado("bajado");
      };

      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        bajar();
        return;
      }

      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setEstado("ok");
      } catch {
        // Safari suele negar el portapapeles cuando la imagen tardó en
        // armarse y perdió el click. La imagen ya está: se baja.
        bajar();
      }
    } catch {
      setEstado("error");
    }

    setTimeout(() => setEstado("listo"), 2500);
  }

  const etiqueta =
    estado === "yendo"
      ? "Armando…"
      : estado === "ok"
        ? "¡Copiada!"
        : estado === "bajado"
          ? "Se bajó la imagen"
          : estado === "error"
            ? "No se pudo"
            : "Copiar imagen";

  return (
    <button
      type="button"
      onClick={copiar}
      disabled={estado === "yendo"}
      className="btn-ghost"
      title="Copia el resumen y las dos tablas como imagen, para mandárselo al cliente"
    >
      {etiqueta}
    </button>
  );
}
