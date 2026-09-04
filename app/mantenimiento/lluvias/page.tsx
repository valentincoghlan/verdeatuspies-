import { redirect } from "next/navigation";

/**
 * Las lluvias ahora viven junto al riego: se analizan en conjunto.
 * La ruta vieja queda redirigiendo para no romper links ni alertas.
 */
export default function LluviasPage() {
  redirect("/mantenimiento/riego");
}
