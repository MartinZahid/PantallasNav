# Editor de Pantallas Point POS

Editor local para crear y modificar pantallas de Point POS en dos perfiles de resoluci?n: **1280 ? 1024** y **1920 ? 1080**. Genera los archivos `.pdtd` de **Web** (para importar en el portal de Point) y **Caja** (para cargar directamente en el POS).

## Requisitos

- Node.js 20 o superior
- npm

## Instalaci?n y uso

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite, normalmente `http://127.0.0.1:5173`.

```bash
npm run build    # compila TypeScript y genera dist/
npm run preview  # sirve la compilaci?n de producci?n
npm run lint     # oxlint
```

El proyecto no usa servidor propio. Se puede publicar como sitio est?tico.

## Perfiles

| Perfil | Lienzo visible | Body de la Caja | Web | Portal |
| --- | --- | --- | --- | --- |
| 1280 ? 1024 | 588 ? 843 | 768 ? 1024 | 1280 ? 1024 | 1181 ? 708 |
| 1920 ? 1080 | 975 ? 863 | 1152 ? 1080 | 1920 ? 1080 | 1181 ? 713 |

Al cambiar el selector de plano:

1. Se muestra una **vista previa** reacomodada, sin modificar el proyecto.
2. **Convertir dise?o** aplica el cambio a todas las pantallas y permite deshacerlo.
3. **Cancelar** vuelve al plano anterior.

La conversi?n reacomoda los botones en cuadr?culas cuadradas dentro del ?rea visible, conserva t?tulos, textos, colores, fuentes, acciones e im?genes, y actualiza las vistas de **Caja** y **Portal**. La exportaci?n queda deshabilitada hasta convertir la vista previa.

## Funciones principales

- Importar archivos Web o Caja existentes; el perfil se detecta autom?ticamente.
- Crear, duplicar, eliminar y reordenar pantallas.
- Plantillas: vac?a, cuadr?cula 3?3, categor?as 2?2, lista 4?5 y guisados 6?5.
- Mover y redimensionar botones con im?n, gu?as de alineaci?n y cuadr?cula.
- Editar texto, fuente, colores, fondo, alineaci?n e imagen.
- Acciones: `addProduct`, `gotoScreen`, `selectProduct`, `addToList`, `executionOrder`, `finish`, `reset`, `deselectProduct`, `rewind`, `popUp` y `listFlush`.
- Buscar productos por nombre, c?digo o ID al agregar una acci?n.
- Importar productos desde Excel.
- Validaci?n de recortes, traslapes, acciones rotas, textos que no caben e im?genes.
- Deshacer/rehacer y guardado local por perfil.
- Exportar Web y Caja.

## Estructura

```text
src/
  components/   Editor, canvas, propiedades, acciones, modales y validaci?n
  lib/
    pdtd.ts     Importaci?n, normalizaci?n, generaci?n Web/Caja y validaci?n
    profiles.ts Perfiles 1280/1080
    convert.ts  Conversi?n de pantallas entre perfiles
    snapping.ts Im?n y gu?as del canvas
    storage.ts  Guardado local y migraci?n
  store.ts      Estado global con Zustand
  types.ts      Tipos del proyecto y del formato .pdtd
```

## Flujo recomendado

1. Importa un Web/Caja o crea un proyecto nuevo.
2. Elige el plano y revisa la vista previa.
3. Convierte y edita las pantallas en el perfil correcto.
4. Valida antes de exportar.
5. Exporta **Web** para importarlo en Point o **Caja** para probar directamente en el POS.
6. Despu?s de importar el Web en Point, exporta la Caja desde Point y comp?rala con la de la app.

## Almacenamiento

El proyecto se guarda en `localStorage` por perfil. Para conservar una copia independiente del navegador, exporta siempre los archivos Web/Caja.

## Dependencias

- React + TypeScript + Vite
- Zustand
- SheetJS `xlsx` 0.20.3 desde el CDN oficial
- Oxlint
