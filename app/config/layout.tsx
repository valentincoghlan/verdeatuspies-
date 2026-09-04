import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import ConfigNav from "@/components/config-nav";
import { sincronizarAhora } from "@/lib/actions";

export default function ConfigLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        titulo="Ajustes"
        bajada="Entrá de a una sección."
        accion={
          <form action={sincronizarAhora}>
            <button className="btn-ghost">Sincronizar ahora</button>
          </form>
        }
      />
      <ConfigNav />
      <div className="space-y-3">{children}</div>
    </>
  );
}
