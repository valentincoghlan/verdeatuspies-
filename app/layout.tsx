import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "Verde A Tus Pies",
  description: "Mantenimiento, ventas y administración del campo en un solo lugar",
  // Con esto el celular la puede agregar a la pantalla de inicio y
  // mandar avisos como cualquier app.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Verde", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icono-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#143c22",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      {/*
        overflow-x-hidden es la red de contención de G1: si algo se
        desborda igual, el celular no se va de costado.
      */}
      <body className="min-h-screen overflow-x-hidden">
        <Nav />
        {/*
          Arriba, el alto del header verde; abajo, el de la barra de
          navegación más el borde curvo del teléfono. Sin esto, la
          primera tarjeta y la última quedan tapadas.
        */}
        <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:pb-10 sm:pl-60 sm:pt-6">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
