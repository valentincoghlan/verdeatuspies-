"use client";

/**
 * La red de abajo de todo.
 *
 * Si el que se rompe es el layout, `app/error.tsx` no llega a dibujarse
 * porque vive adentro de él. Este reemplaza la página entera —por eso
 * trae su propio <html> y <body>— y no puede usar nada del proyecto:
 * ni la tipografía, ni los colores, ni los componentes, porque todo eso
 * se carga en el layout que acaba de fallar. Los estilos van a mano.
 *
 * Casi nunca se ve. Cuando se ve, es lo único que hay.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-AR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf6ef",
          color: "#1d2b21",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "26rem" }}>
          {/* Sin next/image: el optimizador tambien vive en lo que fallo. */}
          <img
            src="/logo.png"
            alt="Verde A Tus Pies"
            width={112}
            height={112}
            style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover" }}
          />
          <h1 style={{ margin: "1.25rem 0 0", fontSize: "1.25rem" }}>Se cayó todo el campo</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#4a5b4f", lineHeight: 1.6 }}>
            No pudimos ni armar la pantalla. Probá de nuevo; si sigue así, cerrá y volvé a abrir
            la app.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: 48,
              padding: "0 1.5rem",
              border: 0,
              borderRadius: 999,
              background: "#1c5b33",
              color: "#faf6ef",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Probar de nuevo
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#7b8a80" }}>
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
