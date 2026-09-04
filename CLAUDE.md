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
  mantenimiento/riego            carga manual + zonas importadas de Hydrawise
  mantenimiento/cortes           cortes por lote y control de atraso
  mantenimiento/fertilizaciones  agenda, aplicación y catálogo de productos
  mantenimiento/lluvias          mm reales del pluviómetro vs. pronóstico
  ventas                         ventas por cliente, m² por mes
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
  mail.ts                        plantilla HTML + envío con Resend
  format.ts                      pesos, m², mm, fechas, días entre fechas
  supabase/{server,client}.ts    clientes de Supabase (server usa cookies; admin usa service role)
components/                      nav, ui (Card/Stat/Tabla/Chip), campos de formulario, barras
supabase/migrations/             esquema (0001) y datos iniciales (0002)
middleware.ts                    protege todas las rutas menos /login, /auth y /api/cron
```

## Convenciones (respetalas al agregar features)

- **Mutaciones**: server actions en `lib/actions.ts`, con formularios HTML nativos
  (`<form action={miAction}>`). No agregues API routes para escribir datos ni fetch
  desde el cliente.
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

## Límite conocido: Hydrawise

La API REST pública de Hunter (`api.hydrawise.com/api/v1`) devuelve el catálogo de zonas,
el próximo riego programado y las zonas corriendo en ese momento. **No expone el
historial de riegos** — eso vive solo en los reportes de la app de Hunter.

**Decisión tomada: un sync por día alcanza.** No se busca tiempo real. Queda registrado
si cada zona regó ese día, y los minutos son los del ciclo programado (estimados, y
marcados como tal en las notas del riego). Si algún día se quisiera el detalle exacto,
alcanza con pegarle al mismo endpoint más seguido desde un scheduler externo, sin tocar
código.

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
