import { sincronizarAhora } from "@/lib/actions";

/**
 * Traer los datos de afuera: clima, dólar y controlador de riego.
 *
 * Es un refresh, no una decisión: por eso va como ícono al lado del
 * título y no como botón grande. Antes ocupaba media pantalla del
 * celular y competía con acciones que sí importan.
 */
export function Refrescar({
  titulo = "Sincronizar ahora",
  sobreVerde,
}: {
  titulo?: string;
  /** Para cuando va dentro del header verde del celular. */
  sobreVerde?: boolean;
}) {
  return (
    <form action={sincronizarAhora}>
      <button
        title={titulo}
        aria-label={titulo}
        className={
          "flex items-center justify-center rounded-full transition " +
          (sobreVerde
            ? "size-10 text-pasto-nav hover:bg-pasto-medio hover:text-crema"
            : "size-11 border-[1.5px] border-borde bg-white text-tinta-2 hover:bg-beige hover:text-pasto sm:size-10")
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
