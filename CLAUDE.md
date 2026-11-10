# Editor de Pantallas Point POS

Editor local (React + TypeScript + Vite, sin servidor) para diseñar pantallas de navegación de Point POS. Lee y escribe archivos `.pdtd` (Web y Caja).

**`REGLAS.md` es la fuente de verdad** de lo que la app hace y debe respetar. Léelo antes de cambiar comportamiento. Si lo que te piden contradice una regla, dilo antes de hacerlo y actualiza `REGLAS.md` en el mismo cambio.

## Principios (resumen de REGLAS.md)

1. Entra Web o Caja, salen los dos.
2. Todos los planos (1280, 1080, 1024) se convierten entre sí.
3. El editor se ve como la Caja: escala 1:1, sin adornos permanentes.
4. El usuario decide si hay encabezado y cuánto mide.
5. Los valores por defecto son genéricos, calculados del plano. Nunca copies medidas, fuentes, colores ni nombres de un archivo de ejemplo al código o a los documentos.
6. La referencia es Point: ante una diferencia se corrige el editor, con una captura o archivo como evidencia.

## Comandos

```bash
npm run dev
npm run lint
npx tsc -b
npm run build
```

`xlsx` se instala desde `cdn.sheetjs.com`; si la red lo bloquea, `npm install` falla con 403.

## Mapa del código

- `src/lib/profiles.ts` — planos y áreas visibles.
- `src/lib/pdtd.ts` — importar, normalizar, zonas, plantillas, encabezado, exportar Web/Caja y validación.
- `src/lib/convert.ts` — conversión entre planos.
- `src/lib/textStyle.ts` — colores, fuentes y ajuste de imagen para dibujar.
- `src/store.ts` — estado (Zustand), selección por zona e historial.
- `src/components/Canvas.tsx` — lienzo (editor, Caja, portal).
- `src/components/PropertiesPanel.tsx`, `Toolbar.tsx`, `Modals.tsx` — paneles y diálogos.

## Invariantes

- Exportación fiel: importar una Caja y exportarla sin cambios da un JSON idéntico. No normalices valores al importar; los valores por defecto son solo para dibujar.
- Las coordenadas son relativas a la zona (Encabezado, Cuerpo, Pie) y el alto total de la pantalla se conserva.
- Todo cambio en el store crea un proyecto nuevo antes de modificar: el historial guarda referencias, no copias.
- `selectedButtonIndex` es un índice dentro de la lista que indican `selectedZone` y `selectedKind`.
- Nada de `window.confirm`/`alert` para flujos nuevos: confirma dentro de la página.

## Verificación antes de dar algo por hecho

1. `npm run lint`, `npx tsc -b` y `npm run build` sin avisos nuevos.
2. Prueba en el navegador (Playwright): importar una Caja, exportarla sin cambios y comparar con el original; ejercitar lo que cambiaste.
3. Si tocaste el dibujo, compara el lienzo con una captura real de la Caja.

## Convenciones

- Interfaz, mensajes y documentos en español; mensajes de commit en inglés.
- Pendiente conocido: el plano 1024 aún no exporta Web (falta confirmar su formato en el portal de Point).
