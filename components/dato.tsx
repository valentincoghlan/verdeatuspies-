import type { ReactNode } from "react";

/**
 * Un dato con su acompañante debajo, en chico.
 *
 * Es el patrón que se repite en toda la app cuando una tabla tiene que
 * entrar en un teléfono: el número que importa arriba, el que lo explica
 * abajo. El total con sus m², el comprador con su canal, el margen con su
 * porcentaje. Está acá una vez para que las cuatro tablas se vean igual.
 */
export function Dato({
  principal,
  secundario,
  className = "",
  tonoSecundario = "text-tinta-3",
}: {
  principal: ReactNode;
  secundario?: ReactNode;
  className?: string;
  /** Color del renglón de abajo, por si el dato secundario avisa algo. */
  tonoSecundario?: string;
}) {
  return (
    <>
      <span className={"block whitespace-nowrap " + className}>{principal}</span>
      {secundario ? (
        <span className={"block whitespace-nowrap text-[11px] font-normal " + tonoSecundario}>
          {secundario}
        </span>
      ) : null}
    </>
  );
}
