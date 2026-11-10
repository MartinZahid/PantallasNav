# Reglas del Editor de Pantallas Point POS

Qué hace la aplicación y qué debe respetar siempre. Si un cambio contradice una regla, primero se cambia la regla (de acuerdo con el dueño del proyecto) y luego el código.

## Principios

1. **Entra Web o Caja, salen los dos.** No importa qué archivo se importó: el proyecto se puede exportar como Web y como Caja.
2. **Todos los planos se convierten entre sí.** Un diseño hecho en un plano se puede llevar a cualquier otro.
3. **El editor se ve como la Caja.** Lo que se dibuja al editar es lo que se verá en el POS: misma escala, mismas posiciones, sin adornos.
4. **El usuario decide el encabezado.** Si una pantalla lo lleva y cuánto mide lo elige quien diseña.
5. **Todo valor por defecto es genérico.** Plantillas, encabezados y estilos se calculan a partir del plano. Un archivo de ejemplo sirve para medir y probar, nunca como fuente de medidas, fuentes, colores o nombres.
6. **La referencia es Point.** Cuando el editor y Point (la Caja o el portal) difieren, se corrige el editor, con una captura o un archivo como evidencia.

> Pendiente: el plano 1024 × 768 todavía exporta solo Caja. Falta confirmar en el portal de Point cómo guarda el archivo Web de ese plano; hasta entonces el botón Web queda deshabilitado en 1024 y esto es una excepción temporal al principio 1.

## 1. Qué es y qué no es

1.1 Es un editor local de pantallas de navegación de Point POS. Lee y escribe archivos `.pdtd`.
1.2 No tiene servidor: todo ocurre en el navegador. No se conecta a Point ni cambia nada en el POS; el usuario importa y exporta los archivos.
1.3 El asistente de IA es opcional, trabaja sobre los botones del cuerpo y no aplica nada sin que el usuario lo acepte.

## 2. Archivos

2.1 **Caja**: lista de pantallas, cada una con `Index`, `ScreenId`, `Id`, `Header`, `Body` y `Footer`. **Web**: objeto con `Screens` y la proyección que usa el portal.
2.2 **Exportación fiel:** una Caja importada y exportada sin cambios sale idéntica.
2.3 Los campos que el editor no conoce se conservan.
2.4 Los valores vacíos del archivo (color, fuente, tamaño, ajuste de imagen) no se reescriben al importar; los valores por defecto se usan solo para dibujar.
2.5 En el archivo solo cambia lo que el usuario editó.

## 3. Planos

3.1 Planos y área visible de la navegación:

| Plano | Área visible | Ancho de zona en el archivo |
| --- | --- | --- |
| 1280 × 1024 | 588 × 843 | 768 |
| 1920 × 1080 | 975 × 863 | 1152 |
| 1024 × 768 | 494 × 587 | 614.4 |

3.2 El plano se detecta al importar: en Web por `ScreenSize`, en Caja por el ancho de zona.
3.3 Cambiar de plano muestra una vista previa; nada cambia hasta confirmar, y la conversión se puede deshacer.
3.4 La conversión conserva textos, colores, fuentes, imágenes y acciones, y reacomoda los botones en cuadrícula dentro del área visible del plano destino.
3.5 Al convertir hacia un plano con encabezado, el título del cuerpo pasa al encabezado junto con inicio y regresar. Al convertir desde uno, el título y los botones del encabezado pasan al cuerpo, en la fila del título.
3.6 Un proyecto nuevo se puede crear en cualquier plano.

## 4. Pantallas y zonas

4.1 Cada pantalla tiene un `Index` y un `Id` únicos. `gotoScreen` apunta al `Index`.
4.2 Una pantalla tiene tres zonas apiladas: Encabezado, Cuerpo y Pie. Las coordenadas de cada elemento son relativas a su zona.
4.3 El alto total de la pantalla no cambia: lo que gana el encabezado o el pie lo cede el cuerpo.
4.4 El encabezado es opcional por pantalla. Su alto lo elige el usuario (30 a 200 px) y se puede aplicar a todas las pantallas.
4.5 Al activar un encabezado vacío se agregan título, inicio y regresar, colocados en proporción al área visible y al alto elegido. Quitar el encabezado borra sus elementos y se puede deshacer.
4.6 Las pantallas nuevas recuerdan la última elección de encabezado del proyecto.

## 5. Elementos

5.1 **Botón:** texto, fuente, colores, alineación, imagen opcional, posición, tamaño y acciones.
5.2 **Texto de zona:** solo texto y estilo; no lleva imagen ni acciones.
5.3 Colores en formato `r,g,b` (o `a,r,g,b`). Vacío significa sin color.
5.4 Imágenes en base64 (PNG o JPEG). Con ajuste `Strech` la imagen se estira; vacío o `Zoom` se ajusta sin deformar y se centra.
5.5 Las plantillas (vacía, 3×3, 2×2, lista, compacta) son las mismas en todos los planos y se calculan con el área visible y el encabezado.

## 6. Acciones

6.1 Tipos válidos: `addProduct`, `addToList`, `selectProduct`, `deselectProduct`, `gotoScreen`, `popUp`, `listFlush`, `finish`, `reset`, `rewind`, y el marcador `executionOrder`.
6.2 Se ejecutan en el orden de su `Index`. El marcador `executionOrder` se conserva al final.
6.3 Una acción que viene sin valor se conserva así hasta que el usuario la edite.

## 7. Cómo se dibuja

7.1 Escala 1:1 con el POS, recortado al área visible del plano.
7.2 El lienzo de edición y la vista Caja dibujan lo mismo: sin bordes ni etiquetas; un texto sin color sale gris oscuro; el tamaño de fuente en pantalla es puntos × 4/3.
7.3 Las ayudas de edición (contorno, número, asas, guías de imán) aparecen solo al pasar el cursor o al seleccionar. La cuadrícula y las marcas de zona son opcionales y están apagadas al empezar.
7.4 La vista Caja simula solo la navegación: `gotoScreen`, `rewind` y `reset`. No agrega productos ni cobra.

## 8. Edición

8.1 Todo cambio se puede deshacer y rehacer (hasta 60 pasos).
8.2 Mover y redimensionar respetan el imán y el paso de 10 px cuando están activos. El tamaño mínimo de un elemento es 20 px.
8.3 Lo que descarta trabajo (proyecto nuevo, convertir, quitar encabezado) pide confirmación o se puede deshacer.

## 9. Validación

9.1 **Errores:** `Index` o `Id` duplicado, `gotoScreen` a una pantalla que no existe, elemento fuera del área visible.
9.2 **Avisos:** texto que podría no caber, traslapes, botón sin texto ni imagen, acción sin valor o desconocida, recorte de pocos píxeles, y botón de cuerpo que solo sobresale por abajo en un plano con encabezado.
9.3 La validación informa; no bloquea la exportación.

## 10. Guardado

10.1 El proyecto se guarda en el navegador, por plano, de forma automática y con "Guardar Todo". Un proyecto con muchas imágenes puede no caber: la copia segura es exportar.
10.2 Los productos importados de Excel solo sirven para elegirlos en las acciones; no se exportan.
