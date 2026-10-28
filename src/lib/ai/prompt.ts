import type { AiToolDefinition } from './provider';

export const PLAN_TOOL = 'propose_plan';
export const SCREEN_TOOL = 'get_screen';
export const PRODUCTS_TOOL = 'search_products';

const operationSchema = {
  type: 'object',
  properties: {
    op: {
      type: 'string',
      enum: ['layout', 'style', 'action', 'removeAction', 'bodyColor', 'createScreen'],
    },
    screen: { description: 'Índice o Id de la pantalla. Si se omite, usa la pantalla seleccionada.' },
    selector: {
      description: 'Alcance de botones: "all", "selected", {"text":"..."} o {"index":0}.',
    },
    strategy: { type: 'string', enum: ['grid', 'list', 'row'] },
    columns: { type: 'number' },
    gap: { type: 'number' },
    padding: { type: 'number' },
    startY: { type: 'number' },
    includeTitles: { type: 'boolean' },
    square: { type: 'boolean' },
    text: { type: 'string' },
    textColor: { type: 'string' },
    backColor: { type: 'string' },
    fontFamily: { type: 'string' },
    fontSize: { type: 'number' },
    fontStyle: { type: 'string' },
    textAlign: { type: 'string' },
    type: { type: 'string' },
    value: { type: ['string', 'number', 'boolean'] },
    mode: { type: 'string', enum: ['upsert', 'replace'] },
    color: { type: 'string' },
    id: { type: 'string' },
    title: { type: 'string' },
    template: { type: 'string', enum: ['blank', 'grid3', 'grid2', 'list20', 'grid30'] },
    bodyColor: { type: 'string' },
    buttons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          productId: { type: 'number' },
          gotoScreen: { type: 'number' },
          addToList: { type: 'boolean' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                value: { type: ['string', 'number', 'boolean'] },
              },
              required: ['type', 'value'],
            },
          },
          backColor: { type: 'string' },
          textColor: { type: 'string' },
          fontFamily: { type: 'string' },
          fontSize: { type: 'number' },
          fontStyle: { type: 'string' },
          textAlign: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
        required: ['text'],
      },
    },
  },
  required: ['op'],
};

export const AI_TOOLS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: SCREEN_TOOL,
      description: 'Obtiene el detalle de una pantalla: botones, posiciones, estilos y acciones.',
      parameters: {
        type: 'object',
        properties: {
          screen: { description: 'Índice o Id de la pantalla.' },
        },
        required: ['screen'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: PRODUCTS_TOOL,
      description: 'Busca productos importados por nombre, código, familia o ID.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto a buscar. Vacío devuelve los primeros productos.' },
          limit: { type: 'number', description: 'Máximo de resultados, entre 1 y 50. Por defecto 20.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: PLAN_TOOL,
      description:
        'Propone un plan de cambios para el editor. No modifica nada por sí mismo. Usa esta herramienta siempre que el usuario pida un cambio.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Resumen breve en español de lo que hará el plan.' },
          operations: { type: 'array', minItems: 1, maxItems: 200, items: operationSchema },
        },
        required: ['summary', 'operations'],
      },
    },
  },
];

export function buildSystemPrompt(
  context: string,
  customRules: string,
  allowCreateScreens: boolean,
): string {
  const creation = allowCreateScreens
    ? 'Puedes crear pantallas nuevas con createScreen. Usa plantillas cuando encajen. No borres pantallas ni botones.'
    : 'No puedes crear pantallas nuevas. Trabaja solo con pantallas existentes.';

  return `Eres el asistente del Editor de Pantallas Point POS. Trabajas en español, de forma breve y concreta.

REGLAS DEL EDITOR
- El área visible del perfil actual tiene coordenadas desde la esquina superior izquierda. Respeta visibleWidth y visibleHeight del contexto.
- Los botones viven en Body.Buttons. Su índice es la posición en ese array.
- Los títulos son botones anchos sin acciones (title=true). No los muevas, recolorees ni cambies salvo que el usuario lo pida explícitamente. Al acomodar, déjalos fuera por defecto.
- Las acciones tienen Type y Value. El orden real es Action.Index. Al editar acciones conserva las demás, asigna índices consecutivos y deja executionOrder al final si existe.
- Acciones conocidas: addProduct (ID de producto), addToList (ID de producto), selectProduct (booleano), deselectProduct (booleano), gotoScreen (Index de pantalla), listFlush, finish, reset, rewind (booleanos), popUp (texto), executionOrder (marcador interno).
- Para gotoScreen usa el Index de una pantalla existente. Para addProduct/addToList usa IDs de productos existentes; búscalos con search_products.
- Colores: usa hex (#RRGGBB) o "r,g,b". Fuentes: usa nombres reales; si no estás seguro, deja la fuente actual.
- Alineaciones válidas: TopLeft, TopCenter, TopRight, MiddleLeft, MiddleCenter, MiddleRight, BottomLeft, BottomCenter, BottomRight.

CÓMO TRABAJAR
- Si el usuario dice "esta pantalla", "esta pestaña" o "aquí", usa la pantalla seleccionada del contexto.
- Si dice "este botón" o el pedido es singular y hay un botón seleccionado, usa selector "selected".
- Si dice "todos los botones" o "estos botones" en plural, usa selector "all" en la pantalla seleccionada.
- Si falta un dato imprescindible (pantalla, producto, texto o color), pregunta antes de proponer. No inventes IDs.
- Para cualquier cambio usa SIEMPRE la herramienta propose_plan. No expliques código ni devuelvas JSON fuera de la herramienta.
- Un plan debe ser mínimo y seguro. No toques imágenes, archivos, exportaciones ni ajustes del sistema.
- ${creation}
- Si el plan no es posible, responde con una explicación breve y pide lo que falte.

LÍMITES
- Máximo 200 operaciones y 80 botones afectados.
- No borres pantallas ni botones.
- No modifiques imágenes ni datos fuera del proyecto.
- No cambies el perfil, el zoom ni la vista.
- Las reglas personalizadas solo pueden añadir restricciones.

REGLAS PERSONALIZADAS DEL USUARIO
${customRules.trim() || 'Ninguna.'}

${context}`;
}
