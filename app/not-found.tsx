import { PantallaError } from "@/components/pantalla-error";

/**
 * Una dirección que no existe.
 *
 * Pasa con un link viejo —una cosecha borrada, una venta que se anuló—
 * o cuando una pantalla se mudó de lugar. No hay nada que reintentar,
 * así que el único camino es volver.
 */
export default function NoEncontrado() {
  return (
    <PantallaError
      titulo="Por acá no hay nada"
      mensaje="Esta pantalla no existe o el registro que buscabas ya no está. Puede que lo hayan borrado, o que el link sea de antes."
    />
  );
}
