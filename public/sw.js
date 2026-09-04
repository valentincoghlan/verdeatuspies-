/**
 * El que recibe los avisos cuando la app está cerrada.
 *
 * El navegador lo deja corriendo en segundo plano. Cuando llega un aviso
 * lo muestra como notificación del sistema, y si la tocás abre la
 * pantalla que corresponda.
 */

self.addEventListener("push", (evento) => {
  let datos = { titulo: "Verde A Tus Pies", mensaje: "", url: "/" };
  try {
    datos = { ...datos, ...evento.data.json() };
  } catch {
    datos.mensaje = evento.data ? evento.data.text() : "";
  }

  evento.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.mensaje,
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      tag: datos.tag || undefined,
      data: { url: datos.url },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abiertas) => {
      // Si la app ya está abierta, se reusa esa ventana.
      for (const c of abiertas) {
        if (c.url.includes(destino) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
