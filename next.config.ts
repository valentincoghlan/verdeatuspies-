import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // Sin esto, entrar desde el celular por la IP de la red hace que
      // Next rechace los formularios: los server actions comparan el
      // origen del pedido con el del servidor.
      allowedOrigins: ["192.168.10.239:3000", "localhost:3000"],
    },
  },
  // Probar desde el celular en la red de casa.
  allowedDevOrigins: ["192.168.10.239"],
};

export default nextConfig;
