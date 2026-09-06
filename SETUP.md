# SETUP — de acá a la app andando

Seguí los bloques en orden. Cada uno se puede hacer suelto; el 1 y el 2 son los que
hacen que la app funcione, el 3 la pone online para el equipo.

---

## 1. Supabase (la base de datos y el login)

**1.1** Entrá a [supabase.com](https://supabase.com), creá cuenta si no tenés, y tocá
**New project**.

- Name: `verdeatuspies`
- Database Password: generala con el botón y **guardala** donde guardás tus claves.
  No la vas a poder ver de nuevo.
- Region: **South America (São Paulo)** — la más cercana a Argentina.

Tarda ~2 minutos en aprovisionar.

**1.2 Correr el esquema.** Menú izquierdo -> **SQL Editor** -> **New query**.
Abrí `supabase/migrations/0001_init.sql`, copiá TODO el contenido, pegalo y tocá **Run**.
Tiene que decir "Success. No rows returned".

**1.3 Datos iniciales.** Antes de correrlo, abrí `supabase/migrations/0002_seed.sql` y
descomentá las dos líneas de tus socios (sacales el `--` del principio) poniendo sus
mails reales. Después: New query -> pegar -> Run.

Eso deja creados los dos lotes (20 de Junio, Yapeyú), cinco fertilizantes comunes y los
mails habilitados a entrar.

**1.4 Las claves.** Menú -> **Project Settings** -> **API**. Necesitás tres valores:

| En Supabase dice | Va en `.env.local` como |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `publishable` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` / `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

Supabase renombró las dos últimas: si ves "publishable" y "secret" en vez de "anon" y
"service_role", son las mismas. La `service_role` da acceso total salteando toda la
seguridad: va solo en `.env.local` y en Vercel, nunca en el código ni en un chat.

**1.5 URLs del login.** Menú -> **Authentication** -> **URL Configuration**:

- Site URL: `http://localhost:3000`
- Redirect URLs: agregá `http://localhost:3000/auth/confirm`

(Cuando tengas la URL de Vercel, volvés y agregás las dos equivalentes con el dominio real.)

---

## 2. Levantarla local

**2.1** Abrí `.env.local` (ya está creado en la raíz, con los campos vacíos) y pegá los
tres valores del paso 1.4.

**2.2**

```powershell
cd C:\Users\valen\projects\verdeatuspies
npm run dev
```

**2.3** Abrí `http://localhost:3000`. Tiene que aparecer la pantalla de login. Poné tu
mail, te llega un link de Supabase, lo abrís **en el mismo navegador** y entrás.

Si el link no llega: Supabase manda 3 mails por hora en el plan free y a veces caen en
spam. En el dashboard, Authentication -> Users, podés confirmar tu usuario a mano.

**2.4** Ya adentro: andá a **Config** y cargá la superficie en m² de cada lote y el
precio por m² sugerido. Después tocá **Sincronizar ahora** — eso trae el clima de
Cardales y llena el panel de inicio.

---

## 3. Ponerla online (GitHub + Vercel)

Hasta acá la app vive en una sola máquina y sin respaldo. Este paso le da URL propia,
deja entrar a tus socios desde el celular y hace que el cron diario corra solo.

**3.1 GitHub.** El repo ya está iniciado con un primer commit. Creá un repo **privado**
en github.com llamado `verdeatuspies`, sin README ni .gitignore, y seguí las
instrucciones de "push an existing repository".

**3.2 Vercel.** Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub ->
**Add New Project** -> importá `verdeatuspies`. No cambies nada de la configuración de
build, Next.js se detecta solo.

**3.3 Variables de entorno.** Antes de darle Deploy, en **Environment Variables** cargá
las mismas del `.env.local`, más estas:

- `NEXT_PUBLIC_APP_URL` = la URL que te da Vercel (ej. `https://verdeatuspies.vercel.app`)
- `CRON_SECRET` = inventate un string largo al azar

**3.4** Volvé a Supabase -> Authentication -> URL Configuration y agregá la URL de Vercel
en Site URL y `https://TU-URL/auth/confirm` en Redirect URLs. Sin esto el login en
producción no funciona.

**3.5 El cron.** `vercel.json` ya lo define: pega en `/api/cron/diario` todos los días a
las **8:00 de Argentina**. Se activa solo con el deploy. Para probarlo sin esperar,
entrá a la app y tocá "Sincronizar ahora".

**3.6 En el celular.** Abrí la URL en el navegador y tocá "Agregar a la pantalla de
inicio". Queda como una app. Pasale el link a tus dos socios: con el mail cargado en
Config -> Equipo entran directo.

---

## 4. Mails de alerta (Gmail)

Sin esto la app funciona igual, pero las alertas quedan solo dentro de la app.

Los mails salen desde `verdeatuspies@gmail.com`, con el SMTP de Gmail. No se usa un
servicio de envío tipo Resend porque ninguno deja mandar desde una dirección
`@gmail.com`: todos exigen un dominio propio verificado.

**4.1** Entrá a esa cuenta de Google y activá la **verificación en dos pasos**
(Seguridad → Verificación en 2 pasos). Sin eso, el paso siguiente no aparece.

**4.2** Andá a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
ponele de nombre "Verde A Tus Pies" y generá la **contraseña de aplicación**. Son 16
letras. Se muestran una sola vez.

**4.3** En `.env.local` y en Vercel:

```
GMAIL_USER=verdeatuspies@gmail.com
GMAIL_APP_PASSWORD=las16letras
MAIL_FROM="Verde A Tus Pies <verdeatuspies@gmail.com>"
```

Los espacios en la contraseña no molestan: la app los saca sola.

**4.4** Probalo desde Ajustes → Mi cuenta, con el botón de aviso de prueba.

Gmail deja mandar unos 500 mails por día. Con tres personas y un digest diario,
no te vas a acercar.

---

## 5. Hydrawise

**5.1** En Hydrawise: **Menú (arriba a la izquierda) -> Account Details -> Account
Settings -> Generate API Key**. Copiala.

**5.2** En la app: **Config -> Integraciones**, pegá la key y guardá.

**5.3** Tocá **Sincronizar ahora**. La app crea solas las zonas de tu controlador.

**5.4** En **Config -> Zonas**, asignale a cada zona su lote (20 de Junio o Yapeyú). Sin
esto los riegos que llegan de Hydrawise no caen en ningún lote.

Recordá el límite: la API no da el historial de riegos. Con el sync diario queda
registrado si cada zona regó ese día; los minutos son los del ciclo programado.

---

## Verificación final

- [ ] Entro con mi mail y veo el dashboard
- [ ] Los dos lotes aparecen en "Estado de los lotes"
- [ ] El clima de Cardales muestra los próximos días
- [ ] Cargo un riego y un corte a mano y quedan en la tabla
- [ ] Agendo una fertilización y aparece en "Próximas fertilizaciones"
- [ ] Cargo un cliente y una venta, y el saldo aparece en Administración
- [ ] Mis dos socios entran desde su celular
