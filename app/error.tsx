"use client";

import { useEffect } from "react";
import { PantallaError } from "@/components/pantalla-error";

/**
 * Cuando una pantalla se rompe.
 *
 * Next la usa para cualquier error que explote al armar una página: se
 * cayó Supabase, falta una columna, se cortó la señal en el medio. El
 * layout sigue en pie, así que la barra de navegación queda y se puede
 * ir a otro lado sin recargar.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Al log del navegador, que es donde se mira cuando pasa.
    console.error(error);
  }, [error]);

  return (
    <PantallaError
      titulo="Se nos cortó el riego"
      mensaje="Algo falló al cargar esta pantalla. No se perdió nada de lo que tenías cargado: probá de nuevo y si sigue igual, volvé al inicio."
      detalle={error.digest ? `${error.message}\n\n(${error.digest})` : error.message}
      reintentar={reset}
    />
  );
}
