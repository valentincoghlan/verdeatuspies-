# Verde A Tus Pies — plataforma de gestión

App única para administrar el campo entre las tres personas del proyecto:
mantenimiento (riego, cortes, fertilización, lluvias), ventas (m² por cliente)
y administración (cobros y pagos).

Stack: Next.js 15 (App Router) + Supabase (Postgres + auth) + Vercel + Resend.

---

## 1. Correrla local (5 minutos)

```bash
npm install
cp .env.example .env.local   # y completá las claves (ver paso 2)
npm run dev                  # http://localhost:3000
```

## 2. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan free alcanza).
2. **SQL Editor** → pegá y ejecutá, en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed.sql` (antes editá los mails del equipo)
3. **Project Settings → API**: copiá a `.env.local`
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (esta nunca va al browser)
4. **Authentication → URL Configuration**: en `Site URL` poné la URL de la app
   (local: `http://localhost:3000`) y agregá a *Redirect URLs*
   `http://localhost:3000/auth/confirm` y `https://TU-APP.vercel.app/auth/confirm`.

El login es por **magic link**: el usuario pone su mail y recibe un link. Solo
entran los mails cargados en la tabla `miembros_habilitados` (se administra
desde la pantalla **Config → Equipo**). Cualquier otro mail puede registrarse
pero queda inactivo y no ve ningún dato (lo bloquea RLS en la base).

## 3. Deploy en Vercel

1. Subí el repo a GitHub y importalo en [vercel.com](https://vercel.com).
2. Cargá las mismas variables de entorno del `.env.example` en
   *Settings → Environment Variables* (incluida `NEXT_PUBLIC_APP_URL` con la
   URL final y `CRON_SECRET`).
3. `vercel.json` ya define el cron diario a las **8:00 de Argentina**
   (`0 11 * * *` UTC), que pega en `/api/cron/diario`.

En el celular: abrí la URL en Chrome/Safari y "Agregar a inicio". Queda como
una app; todo está pensado mobile-first para cargar datos desde el campo.

## 4. Mails de alerta (Resend)

1. Cuenta en [resend.com](https://resend.com), plan free = 3.000 mails/mes.
2. Copiá la API key a `RESEND_API_KEY`.
3. Para que los mails salgan desde tu dominio, verificalo en Resend y poné
   `MAIL_FROM="Verde A Tus Pies <alertas@tudominio.com>"`. Sin dominio propio
   podés arrancar con `onboarding@resend.dev`.

## 5. Hydrawise

En Hydrawise: **Menú → Account Details → Account Settings → Generate API Key**.
Pegá la key en **Config → Integraciones**. Después tocá *Sincronizar ahora*:
la app crea solas las zonas del controlador. Asignale a cada zona su lote
(Config → Zonas) para que los riegos caigan en el lote correcto.

**Lo que la API de Hydrawise da y lo que no.** La API REST pública
(`api.hydrawise.com/api/v1`) devuelve el catálogo de zonas, el próximo riego
programado, las zonas corriendo en ese momento y —según firmware— cuándo fue
el último riego en formato relativo. **No expone el historial completo de
riegos**: eso está solo en los reportes de la app de Hunter. Por eso el sync:

- mantiene actualizado el catálogo de zonas,
- registra un riego por zona y por día cuando detecta que corrió,
- guarda el JSON crudo en `hydrawise_snapshots` para auditar.

**Cadencia elegida: un sync por día**, en el cron de las 8:00 ART. Con eso queda
registrado si cada zona regó ese día, y los minutos que figuran son los del ciclo
programado (estimados, no medidos) — el riego queda marcado con esa aclaración en
las notas. No hace falta tiempo real.

Si en algún momento se quisiera el detalle exacto de minutos, alcanza con pegarle
al mismo endpoint más seguido desde un scheduler externo (cron-job.org, GitHub
Actions o `pg_cron` de Supabase), sin tocar código:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-APP/api/cron/diario
```

El registro manual de riego sigue disponible siempre, y todo riego cargado a
mano convive con los importados (quedan marcados con su origen).

## 6. Clima y lluvias

El clima sale de [Open-Meteo](https://open-meteo.com) (gratis, sin API key),
para las coordenadas de Cardales que están en Config. Cada corrida diaria:

- guarda 7 días para atrás y 7 para adelante en `clima_dias`,
- si el pronóstico marcó lluvia por encima del umbral (2 mm por defecto) y no
  hay mm cargados, crea la alerta **"¿Llovió en Cardales?"** con los botones
  *Sí, llovió* (pide los mm del pluviómetro) y *No llovió*,
- si viene lluvia en los próximos 2 días, avisa para revisar riego y
  fertilizaciones agendadas.

## 7. Qué alertas manda la app

| Alerta | Cuándo | Mail |
|---|---|---|
| Confirmar lluvia | El pronóstico marcó lluvia y no hay mm cargados | sí |
| Lluvia pronosticada | Lluvia > umbral en los próximos 2 días | no (solo in-app) |
| Fertilización agendada | Faltan N días (configurable, default 3) | sí |
| Fertilización atrasada | Pasó la fecha y sigue sin aplicar | sí |
| Corte atrasado | Se pasó el objetivo de días del lote | sí |
| Sin riego ni lluvia | 4+ días sin ningún registro de agua | sí |

Las alertas viven en la tabla `notificaciones` con una `clave_unica`, así que no
se duplican entre corridas. El mail es un digest: junta todo lo pendiente en un
solo envío a los miembros con "avisos por mail" activado.

---

## Estructura

```
app/
  page.tsx                      dashboard: pendientes, lotes, clima, plata del mes
  mantenimiento/riego           registro manual + zonas Hydrawise
  mantenimiento/cortes          cortes por lote y control de atraso
  mantenimiento/fertilizaciones agenda, aplicación y catálogo de productos
  mantenimiento/lluvias         mm reales vs. pronóstico
  ventas                        ventas por cliente, m² por mes
  ventas/clientes               clientes y cuenta corriente
  administracion                cobros, pagos, saldos, caja
  config                        lotes, zonas, integraciones, equipo
  api/cron/diario               corrida automática (clima → Hydrawise → alertas → mail)
lib/
  actions.ts                    server actions (todas las altas y bajas)
  sync.ts                       orquesta clima, Hydrawise, alertas y digest
  hydrawise.ts / clima.ts       integraciones
  mail.ts                       plantilla + envío con Resend
supabase/migrations/            esquema y datos iniciales
```

## Backlog (lo próximo)

- Remitos / orden de entrega en PDF por venta.
- Stock de m² disponibles por lote y proyección de reposición.
- Costo por m² producido (pagos por lote / m² vendidos).
- Fotos en cada registro (Supabase Storage).
- Recordatorio de corte por WhatsApp.
