# CLAUDE.md — Verde A Tus Pies

## El negocio

Producción y venta de pasto en **Cardales**, provincia de Buenos Aires. Lo administran
tres personas: Valentín (dueño del proyecto) y dos socios. Hay **dos lotes de
producción: "20 de Junio" y "Yapeyú"**.

Esta app es la herramienta interna del proyecto: reemplaza los cuadernos y planillas
sueltas para llevar en un solo lugar el mantenimiento del campo, las ventas y la plata.

## Cómo trabajar con Valentín

- **Todo en español rioplatense**: la interfaz, los mensajes, los nombres de tablas y
  columnas, los comentarios del código.
- **Valentín no escribe código.** Explicá en criollo qué vas a hacer y por qué. No
  asumas que sabe Supabase, SQL ni Next.js. Cuando algo falla, decile qué significa el
  error antes de arreglarlo.
- **Guialo de a un paso.** Si un procedimiento tiene seis pasos, dale el primero y
  esperá, no los seis juntos.
- **Estilo de producto**: simple, poco texto, mobile-first. Se carga desde el campo,
  con el celular en una mano.
- Prefiere ejecución autónoma: si la decisión es obvia, tomala y contá qué elegiste.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres +
Auth + RLS) · Resend (mails) · Vercel (deploy + cron)

```bash
npm run dev        # http://localhost:3000
npm run build      # build de producción
npm run typecheck  # tsc --noEmit
```

## Estructura

```
app/
  page.tsx                       dashboard: pendientes, estado de lotes, clima, plata del mes
  mantenimiento/riego            zonas, abrir/cortar riego, cancelar programados, lluvias
  mantenimiento/cortes           cortes por lote y control de atraso
  mantenimiento/fertilizaciones  agenda, aplicación y catálogo de productos
  mantenimiento/lluvias          mm reales del pluviómetro vs. pronóstico
  ventas                         ventas por cliente, m² por mes
  ventas/cosecha                 cosechas: contar pilas y repartirlas entre pedidos
  ventas/clientes                clientes y cuenta corriente
  administracion                 cobros, pagos, saldos, caja
  config                         lotes, zonas, integraciones, equipo
  api/cron/diario                corrida automática: clima -> Hydrawise -> alertas -> mail
  auth/confirm                   valida el magic link de Supabase
lib/
  actions.ts                     TODAS las mutaciones (server actions)
  sync.ts                        orquesta clima, Hydrawise, alertas y digest por mail
  hydrawise.ts                   integración con la API de Hunter
  clima.ts                       Open-Meteo
  caudal.ts                      mm/hora de cada zona (la regla vive solo ahi)
  mail.ts                        plantilla HTML + envío con Resend
  format.ts                      pesos, m², mm, fechas, días entre fechas
  supabase/{server,client}.ts    clientes de Supabase (server usa cookies; admin usa service role)
components/                      nav, ui (Card/Stat/Tabla/Chip), campos de formulario, barras
supabase/migrations/             esquema (0001) y datos iniciales (0002)
middleware.ts                    protege todas las rutas menos /login, /auth y /api/cron
```

## Convenciones (respetalas al agregar features)

- **Mutaciones**: server actions en `lib/actions.ts`. No agregues API routes para
  escribir datos ni fetch desde el cliente.
- **Formularios**: `<Formulario action={miAction}>` con un `<Guardar>` adentro, los dos
  de `components/guardar.tsx`. Mientras la acción viaja, el botón se apaga, muestra una
  rueda y levanta un velo sobre la pantalla: sin eso, en el campo con señal mala no se
  sabe si entró y se carga dos veces. `<form>` pelado queda solo para las navegaciones
  (`method="get"`, `action="/auth/signout"`), donde no hay nada que esperar.
- **Páginas**: Server Components con `export const dynamic = "force-dynamic"`. Componentes
  de cliente solo donde hay estado real (hoy: `components/nav-links.tsx` y
  `app/login/login-form.tsx`).
- **Estilos**: usá las utilidades propias definidas en `app/globals.css` — `.card`,
  `.input`, `.label`, `.btn`, `.btn-ghost`, `.btn-alto`, `.chip`, `.th`, `.td`.
  Tipografía **Figtree**, nada de serifs ni monoespaciadas. Paleta:
  `pasto` / `pasto-oscuro` / `pasto-medio` (verdes), `crema` / `beige` / `borde`
  (fondos cálidos), `tinta` / `tinta-2` / `tinta-3` (texto), y el semáforo
  `urgente-*` / `atencion-*` / `info-*` / `hecho-*` / `neutro-*` en pares
  texto+fondo. Los nombres viejos (`hoja-*`, `tierra-*`) siguen existiendo
  apuntando a los colores nuevos: no los uses en código nuevo.
- **Piso de toque**: 48px de alto en todo lo tocable (botones, campos, tabs).
  Se usa parada en el campo, con el celular en una mano. Los chips de estado no
  son tocables y quedan afuera de la regla.
- **Contraste**: mínimo 4,5:1 en todo texto, también en 12px. Se lee con sol.
- **Gráficos**: sin librerías. `components/barras.tsx` (divs + Tailwind), una sola serie
  y un solo tono. Si hace falta algo más complejo, preguntá antes de sumar una dependencia.
- **Fechas**: se guardan y comparan como texto ISO `yyyy-mm-dd`. Usá los helpers de
  `lib/format.ts` (`hoyISO`, `fechaLarga`, `diasEntre`, `sumarDiasISO`), que trabajan en
  horario de Argentina. No uses `new Date()` crudo para calcular "hoy".
- **Plata**: ARS, formateada con `pesos()`. Los inputs aceptan coma decimal; `num()` y
  `dec()` en `actions.ts` ya lo resuelven.
- **Base de datos**: nombres en español y plural (`riegos`, `cortes`, `fertilizaciones`).
  Todo cambio de esquema va en un **archivo nuevo** en `supabase/migrations/` numerado
  (`0003_...`, `0004_...`). Nunca edites una migración ya corrida.
- **RLS**: todas las tablas exigen `public.es_miembro()`. Un mail nuevo solo entra si
  está en `miembros_habilitados` (se administra desde Config -> Equipo).
- **Secretos**: nunca commitees `.env.local`. La API key de Hydrawise vive en la tabla
  `config`, no en el código.

## Alertas que genera la corrida diaria

| Alerta | Cuándo | Manda mail |
|---|---|---|
| Confirmar lluvia | El pronóstico marcó lluvia y no hay mm cargados | sí |
| Lluvia pronosticada | Lluvia sobre el umbral en los próximos 2 días | no, solo in-app |
| Fertilización agendada | Faltan N días (configurable, default 3) | sí |
| Fertilización atrasada | Pasó la fecha y sigue sin aplicar | sí |
| Corte atrasado | Se pasó el objetivo de días del lote | sí |
| Sin riego ni lluvia | 4+ días sin ningún registro de agua | sí |

Cada notificación lleva una `clave_unica` para no duplicarse entre corridas. El mail es
un digest: junta todo lo pendiente en un solo envío.

## Cómo funcionan los riegos

El controlador es un **Hunter Hydrawise**. La app no riega sola ni hace de reloj:
manda órdenes, lee lo que el controlador informa y anota todo en `riegos`.

**Las zonas.** Viven en `riego_zonas`, se importan del controlador en el sync y se
atan a un lote a mano desde Config -> Zonas. Una zona sin lote riega igual, pero el
riego no cae en ningún lote y no entra en el balance de agua.

**De minutos a milímetros.** La conversión sale del caudal de la zona, en mm/hora, y
la regla vive en `lib/caudal.ts` **y en ningún otro lado**: si la zona tiene los
aspersores cargados (ficha de boquillas + presión) manda el número calculado; si no,
manda el mm/hora escrito a mano en Ajustes; si no hay ninguno de los dos, el riego
queda sin mm. `mm = minutos / 60 * caudal`.

**La presión (migración 0037).** Cuánto tira un pico depende de a cuántos bar trabaje
su línea: un PGP rojo 12 pasa de 2.510 l/h a 3 bar a 3.220 a 5. Nadie las midió todavía,
así que la app las estima: la bomba da entre 4 y 5 bar, y dentro de cada lote la línea
que menos agua pide queda en 5,0 y la que más pide en 4,0, repartiendo el medio con la
pérdida de carga de Hazen-Williams (crece con el caudal a la 1,85). `presion_medida`
marca las que sí se midieron con manómetro: **esas no se vuelven a estimar nunca**. La
ficha de Hunter viene de media en media atmósfera, así que se interpola —
`litros_hora_boquilla()` en la base y `litrosDeBoquilla()` en `lib/caudal.ts`, la misma
cuenta en los dos lados porque la pantalla de aspersores muestra el caudal antes de
guardar.

**Los tres orígenes de un riego** (columna `origen`):

| Origen | Quién lo crea | Minutos |
|---|---|---|
| `app` | Abrir el riego desde la pantalla (`regarZona`) | exactos |
| `hydrawise` | La corrida diaria, cuando detecta que la zona corrió | estimados del ciclo programado |
| `manual` | Carga a mano de un riego viejo (`crearRiego`) | los que se escriban |

**Abrir y cortar.** `regarZona` le manda `run` al controlador con los segundos, e
inserta el riego en el acto con los mm ya calculados. Al cortar (`stop`) busca el
riego abierto de esa zona del día y le ajusta los minutos a lo que realmente corrió.
Si el agua arrancó pero el registro falla, la acción tira error: nunca se riega sin
que quede anotado.

**Programados y cancelación.** Los programas viven en el controlador, que es hardware
y no depende de que nadie lo despierte (la app tuvo programas propios y se sacaron en
la migración 0021). El sync guarda en `riego_zonas` el próximo riego, su duración y
hasta cuándo está suspendida. `suspenderRiego` cancela los riegos programados hasta un
día y hora — por zona, por lote o todo el campo — sin tocar el programa; para
levantarlo se manda la misma orden con una fecha ya pasada, que es como Hunter
entiende "volvé a regar".

**Límite de la API de Hunter.** `api.hydrawise.com/api/v1` devuelve el catálogo de
zonas, el próximo riego, las zonas corriendo ahora y el último riego en formato
relativo ("2 days ago"). **No expone el historial**, que vive solo en los reportes de
la app de Hunter. Además acepta como máximo **10 órdenes cada 5 minutos** en
`setzone.php`; pasado eso contesta texto plano con HTTP 200, así que `lib/hydrawise.ts`
mira el cuerpo y no solo el código.

**Decisión tomada: un sync por día alcanza.** No se busca tiempo real. Queda registrado
si cada zona regó ese día y con cuántos minutos estimados (marcado así en las notas).
El JSON crudo se guarda en `hydrawise_snapshots` para auditar. Si algún día se quisiera
el detalle exacto, alcanza con pegarle al mismo endpoint más seguido desde un scheduler
externo, sin tocar código.

## Estado

**Hecho**: los tres módulos completos, integración de clima, integración de Hydrawise,
alertas in-app y por mail, cron diario, login por magic link con allowlist, RLS.

**Falta** (ver `SETUP.md`): crear el proyecto en Supabase y correr las migraciones,
`.env.local`, subir a GitHub, deploy en Vercel, cuenta de Resend, API key de Hydrawise
y carga de datos reales (superficie de los lotes, precio por m², clientes).

## Backlog acordado

- Remito / orden de entrega en PDF por venta.
- Stock de m² disponibles por lote y proyección de reposición.
- Costo por m² producido (pagos por lote / m² vendidos).
- Fotos en cada registro (Supabase Storage).
- Avisos por WhatsApp.

---

## Cierre obligatorio de cada tarea (regla del usuario)

Terminá SIEMPRE la respuesta con estas dos secciones, en español:

**QUÉ HICE** — bullets con lo que efectivamente hiciste (archivos, comandos,
resultados reales). Si algo falló o quedó a medias, decilo acá.

**TU TURNO** — bullets con lo que queda del lado del usuario (revisar, aprobar,
configurar, probar, decidir). Si no queda nada: "Nada, podés seguir con lo próximo."

Aplica aunque la tarea haya sido chica o hayas solo respondido una pregunta.
