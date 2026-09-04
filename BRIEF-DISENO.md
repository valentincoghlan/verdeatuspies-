# Brief para el rediseño — Verde A Tus Pies

> Copiá todo este archivo y pegalo en una conversación nueva con Claude Design.
> Después traé el link del diseño publicado a la conversación de Claude Code.

---

## Qué es

App interna de un productor de pasto (césped en panes) en Cardales, provincia de
Buenos Aires. La usan tres personas: el dueño y dos socios. Reemplaza cuadernos y
planillas sueltas.

No es un producto para vender. Es una herramienta de trabajo diaria: registrar lo
que se hizo en el campo, tomar pedidos y saber quién debe plata.

## Quiénes la usan y dónde

Tres personas, ninguna técnica. **Se usa parada en el campo, con el celular en una
mano y con sol de frente.** También desde la compu en la oficina, para revisar
números.

Esto manda sobre todo lo demás:

- **Mobile-first de verdad.** Si algo se ve bien en la compu pero incómodo en el
  celular, está mal.
- **Poco texto.** Nombres cortos, en español rioplatense.
- **Alto contraste.** Se lee al aire libre.
- **Áreas de toque grandes.** Se opera con una mano y a veces con guantes.

## Las pantallas

| Pantalla | Qué muestra |
|---|---|
| **Inicio** | Tarjetas con números del mes, lista de alertas pendientes con botones de acción, estado de los dos lotes, pronóstico de 6 días |
| **Pedidos** | Pasto vendido sin entregar. Lista ordenada por fecha, cada uno con el pronóstico de ese día al lado. Es la pantalla más usada |
| **Ventas** | Tabla de operaciones con estado |
| **Clientes** | Listado y cuenta corriente |
| **Administración** | Cobros, pagos, saldo por cliente |
| **Reportes** | Gráficos de barras: vendido vs. cosechado, gastos por categoría, margen |
| **Riego / Cortes / Fertilización / Lluvias** | Un formulario de carga arriba y una tabla de historial abajo |
| **Ajustes** | Cinco secciones con formularios |

## Las piezas que se repiten

Todo está armado con ocho piezas. **Rediseñá estas, no las pantallas una por una.**

1. **Tarjeta** — caja blanca con borde, esquinas redondeadas, título chico en
   mayúsculas arriba. Es el contenedor de todo.
2. **Número grande** — un rótulo chico arriba, un número grande abajo, y un
   renglón de detalle. Van de a tres o cuatro en fila.
3. **Tabla** — cabecera en mayúsculas, filas separadas por línea fina. Algunas
   tienen 8 columnas y en el celular se deslizan para el costado.
4. **Formulario** — grilla de campos con etiqueta arriba. Dos columnas en el
   celular, cuatro en la compu.
5. **Botón** — uno principal verde lleno, uno secundario con borde y fondo blanco.
6. **Chip de estado** — pastilla chica de color: verde, ámbar, rojo, azul, gris.
   Dice cosas como "entregada", "atrasado 2 días", "sin asignar".
7. **Alerta con acción** — bloque destacado dentro de una lista, con un texto y
   uno o más formularios chicos adentro (por ejemplo: "¿Se entregó el pedido de
   X?" con tres botones y dos campos numéricos).
8. **Barras** — gráfico de barras horizontales de una sola serie, hecho con divs.

## Lo que hay hoy

Tipografía **Inter**. Fondo casi blanco, tarjetas blancas con borde gris muy
suave. Verde para lo positivo y las acciones; grises azulados para el texto.

```
Verdes (hoja)
  50  #f1fdf5    100 #dcfce9    200 #bbf7d2    300 #86efb0    400 #4ade82
  500 #22c55e    600 #16a34a    700 #15803c    800 #166533    900 #14532b

Grises (tierra)
  50  #f8f8ff    100 #f1f2f6    200 #e3e5ec    400 #9ba1b0
  600 #5b6273    800 #2b303c    900 #16181f

Semáforo de estados
  ámbar → atención        rojo → urgente / atrasado
  azul  → informativo     verde → todo bien / hecho
```

Medidas actuales: tarjetas con esquinas de 16px y 20px de aire interno; campos y
botones con esquinas de 12px; chips redondos.

## Qué quiero del rediseño

Que se vea **más prolijo y más fácil de leer de un vistazo**, sin volverse un
producto corporativo genérico. Es un negocio de campo: puede tener carácter.

Concretamente:

- Una **jerarquía más clara**. Hoy todo pesa parecido y cuesta encontrar el dato
  importante.
- Que se distinga mejor **lo urgente de lo informativo**.
- Las **tablas anchas** en el celular: hoy se deslizan para el costado. Si tenés
  una idea mejor, proponela.
- Los **formularios largos** (el de cargar un pedido tiene 10 campos) deberían
  sentirse más livianos.

## La referencia: Starbucks

Quiero que la app se vea con ese lenguaje. Lo que me interesa de ahí:

- **Verde profundo como color dominante**, oscuro y sobrio, no un verde brillante.
  Usado con confianza pero sin saturar la pantalla.
- **Fondos cálidos** — cremas y beige muy claros en vez de grises fríos.
- **Mucho aire.** Espaciado generoso, las cosas respiran.
- **Jerarquía tipográfica marcada**: títulos grandes y con peso, texto de apoyo
  chico y tranquilo. Que se note de una qué es lo importante.
- **Botones tipo píldora**, completamente redondeados.
- **Separar con espacio y fondos suaves**, no con líneas y bordes por todos lados.
- **Acentos de color usados poco**, para que cuando aparezcan signifiquen algo.

**No copies**: el logo ni la sirena (son marca registrada), ni su tipografía, que
es propia y no se puede usar. Buscá una sin serifas con aire parecido, de las que
se pueden usar libremente.

Y el verde: que sea **nuestro**, no exactamente el de ellos. Un verde de pasto y
de campo, que es de lo que se trata este negocio.

### La tensión que hay que resolver

Ese estilo es aireado y de poca densidad. Esta app es lo contrario: tablas con
ocho columnas, números por todos lados, y se usa parada en el campo mirando el
celular. **Si hay que elegir entre que respire y que se lea, gana que se lea.**

Ese es justamente el laburo interesante: traer esa calidez y esa calma a una
herramienta densa de trabajo, sin que se convierta en una planilla ni en un
folleto.

## Lo que no se puede cambiar

- **Tipografía sin serifas y de uso libre.** Nada de serifs ni monoespaciadas,
  y nada de fuentes con licencia paga.
- **Sin librerías de gráficos.** Las barras son divs.
- **Modo claro solamente.** No hay modo oscuro.
- Todo el texto **en español rioplatense**.

## Qué necesito de vuelta

1. Las pantallas rediseñadas de **Inicio**, **Pedidos** y una de formulario con
   tabla (por ejemplo **Riego**). Con esas tres alcanza: el resto se replica solo.
2. **Los valores exactos**, no solo el dibujo: códigos de color, tamaños de letra,
   espaciados, radios de esquina y sombras. Sin eso hay que adivinar.
3. Cómo queda cada una de **las ocho piezas** de la lista de arriba.

Usá contenido real, no relleno: "20 de Junio", "Yapeyú", "Country El Ombú",
"350 m² para Constructora Delta SA", "$ 467.500", "6,7 mm · 100% — conviene
reprogramar", "atrasado 2 días", "entregada".
