import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import ConfigNav from "@/components/config-nav";
import { Refrescar } from "@/components/refrescar";

export default function ConfigLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader titulo="Ajustes" bajada="Entrá de a una sección." accion={<Refrescar />} />
      <ConfigNav />
      <div className="space-y-3">{children}</div>
    </>
  );
}
