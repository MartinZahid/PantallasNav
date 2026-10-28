import type { Action, PdtdButton, Project, ProjectScreen } from '../../types';
import { ACTION_TYPES, clone, isTitle, makeButton, makeScreenFromTemplate, nextScreenIndex, uid, validateProject } from '../pdtd';
import { profileForProject } from '../profiles';
import { parseFontStyles } from '../textStyle';
import { screenByRef } from './context';
import type {
  AiActionValue,
  AiButtonSelector,
  AiLayoutOperation,
  AiNewButton,
  AiOperation,
  AiPlan,
  AiSettings,
} from './types';

export interface AiAppliedPlan {
  project: Project;
  details: string[];
  warnings: string[];
  selectedScreenUid: string;
  selectedButtonIndex: number | null;
  affectedButtons: number;
}

export class AiPlanError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'AiPlanError';
    this.details = details;
  }
}

const NUMBER_ACTIONS = new Set(['addProduct', 'addToList', 'gotoScreen']);
const BOOLEAN_ACTIONS = new Set(['selectProduct', 'deselectProduct', 'listFlush', 'finish', 'reset', 'rewind']);
const COLOR_NAMES: Record<string, string> = {
  naranja: '#f4511e',
  anaranjado: '#f4511e',
  orange: '#f4511e',
  rojo: '#d9534f',
  red: '#d9534f',
  verde: '#2e9e5b',
  green: '#2e9e5b',
  azul: '#2f80ed',
  blue: '#2f80ed',
  amarillo: '#f2c94c',
  yellow: '#f2c94c',
  negro: '#000000',
  black: '#000000',
  blanco: '#ffffff',
  white: '#ffffff',
  gris: '#808080',
  gray: '#808080',
  grey: '#808080',
  marron: '#9b5300',
  café: '#9b5300',
  cafe: '#9b5300',
  morado: '#7b1fa2',
  purple: '#7b1fa2',
  rosa: '#e91e63',
  pink: '#e91e63',
  celeste: '#56ccf2',
  turquesa: '#2d9cdb',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function normalizeColor(value: string): string {
  const source = String(value ?? '').trim().toLowerCase();
  const named = COLOR_NAMES[source];
  const candidate = named ?? source;
  const hex = candidate.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `${parseInt(hex[0] + hex[0], 16)},${parseInt(hex[1] + hex[1], 16)},${parseInt(hex[2] + hex[2], 16)}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return `${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)}`;
  }
  const rgb = candidate.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  const plain = candidate.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  const match = rgb ?? plain;
  if (match) {
    const values = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (values.every((item) => item >= 0 && item <= 255)) return values.join(',');
  }
  throw new AiPlanError(`Color no válido: "${value}". Usa hexadecimal (#F4511E) o "r,g,b".`);
}

function normalizeFontStyle(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const styles = parseFontStyles(value);
  return ['Bold', 'Italic', 'Underline', 'Strikeout'].filter((style) => styles.has(style as never)).join(', ');
}

function normalizeAlignment(value: string | undefined): string | undefined {
  if (value === undefined || !String(value).trim()) return undefined;
  const source = String(value).toLowerCase().replace(/[\s_-]/g, '');
  const vertical = source.includes('top') || source.includes('arriba')
    ? 'Top'
    : source.includes('bottom') || source.includes('abajo') || source.includes('inferior')
      ? 'Bottom'
      : source.includes('middle') || source.includes('center') || source.includes('centro') || source.includes('medio')
        ? 'Middle'
        : '';
  const horizontal = source.includes('left') || source.includes('izquierda')
    ? 'Left'
    : source.includes('right') || source.includes('derecha')
      ? 'Right'
      : source.includes('center') || source.includes('centro') || source.includes('medio')
        ? 'Center'
        : '';
  if (!vertical && !horizontal) {
    throw new AiPlanError(`Alineación no válida: "${value}". Usa por ejemplo TopLeft, MiddleCenter o BottomRight.`);
  }
  return `${vertical || 'Middle'}${horizontal || 'Center'}`;
}

function actionType(type: string): string {
  if (!ACTION_TYPES.includes(type as (typeof ACTION_TYPES)[number]) || type === 'executionOrder') {
    throw new AiPlanError(`Acción no válida: "${type}".`);
  }
  return type;
}

function actionValue(project: Project, type: string, value: AiActionValue | undefined): AiActionValue {
  if (NUMBER_ACTIONS.has(type)) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new AiPlanError(`La acción ${type} necesita un valor numérico mayor que 0.`);
    }
    if (type === 'gotoScreen' && !project.screens.some((screen) => Number(screen.compact.Index) === number)) {
      throw new AiPlanError(`No existe la pantalla ${number} para Ir a pantalla.`);
    }
    if ((type === 'addProduct' || type === 'addToList') && project.products.length > 0) {
      if (!project.products.some((product) => Number(product.id) === number)) {
        throw new AiPlanError(`No existe el producto ${number}.`);
      }
    }
    return number;
  }
  if (BOOLEAN_ACTIONS.has(type)) {
    if (value === undefined) return true;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return ['true', '1', 'si', 'sí', 'yes'].includes(String(value).toLowerCase());
  }
  if (type === 'popUp') return value === undefined ? '' : String(value);
  return value ?? '';
}

function normalizeSelector(screen: ProjectScreen, project: Project, selector: AiButtonSelector | undefined, excludeTitles = true): number[] {
  const buttons = screen.compact.Body.Buttons;
  const all = buttons
    .map((button, index) => ({ button, index }))
    .filter(({ button }) => !excludeTitles || !isTitle(button))
    .map(({ index }) => index);

  if (!selector || selector === 'all') {
    if (!all.length) throw new AiPlanError('No encontré botones editables en esa pantalla.');
    return all;
  }
  if (selector === 'selected') {
    if (project.selectedScreenUid !== screen.uid || project.selectedButtonIndex === null) {
      throw new AiPlanError('No hay un botón seleccionado en esa pantalla.');
    }
    return [project.selectedButtonIndex];
  }
  if (typeof selector === 'object' && 'index' in selector) {
    const index = Number(selector.index);
    if (!Number.isInteger(index) || index < 0 || index >= buttons.length) {
      throw new AiPlanError(`El índice de botón ${selector.index} no existe en la pantalla.`);
    }
    return [index];
  }
  if (typeof selector === 'object' && 'text' in selector) {
    const value = String(selector.text).trim().toLowerCase();
    const exact = buttons.findIndex((button) => String(button.Text.Text ?? '').trim().toLowerCase() === value);
    if (exact >= 0) return [exact];
    const partial = all.filter((index) => String(buttons[index].Text.Text ?? '').toLowerCase().includes(value));
    if (partial.length) return partial;
    throw new AiPlanError(`No encontré botones con el texto "${selector.text}".`);
  }
  throw new AiPlanError('Selector de botones no válido.');
}

function setButtonGeometry(button: PdtdButton, x: number, y: number, width: number, height: number) {
  button.X = round(x);
  button.Y = round(y);
  button.Width = round(width);
  button.Height = round(height);
}

function layoutButtons(screen: ProjectScreen, indices: number[], op: AiLayoutOperation, project: Project): string {
  const profile = profileForProject(project);
  const width = profile.visibleWidth;
  const height = profile.visibleHeight;
  const buttons = screen.compact.Body.Buttons;
  const targets = indices.map((index) => buttons[index]).filter(Boolean);
  if (!targets.length) throw new AiPlanError('No hay botones para acomodar.');
  if (targets.length === 1) {
    const button = targets[0];
    setButtonGeometry(
      button,
      (width - Number(button.Width)) / 2,
      clamp(op.startY ?? 118, 0, height - Number(button.Height)),
      Number(button.Width),
      Number(button.Height),
    );
    return `Centré 1 botón en la pantalla.`;
  }

  const titlePresent = screen.compact.Body.Buttons.some(isTitle);
  const startY = clamp(op.startY ?? (titlePresent && !op.includeTitles ? 116 : 12), 0, height / 2);
  const padding = clamp(op.padding ?? 12, 0, 40);
  const gap = clamp(op.gap ?? 10, 0, 40);
  const count = targets.length;
  const strategy = op.strategy ?? 'grid';
  const columns = clamp(
    Math.round(op.columns ?? (strategy === 'list' ? 1 : strategy === 'row' ? count : Math.ceil(Math.sqrt(count)))),
    1,
    12,
  );
  const rows = Math.ceil(count / columns);
  const availableWidth = width - padding * 2 - gap * (columns - 1);
  const availableHeight = height - startY - padding - gap * (rows - 1);

  if (strategy === 'list') {
    const cellWidth = Math.max(24, availableWidth);
    const cellHeight = Math.max(24, Math.min(160, availableHeight / count));
    targets.forEach((button, position) => {
      setButtonGeometry(button, padding, startY + position * (cellHeight + gap), cellWidth, cellHeight);
    });
    return `Acomodé ${count} botones en lista.`;
  }

  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;
  const size = Math.max(20, Math.min(cellWidth, cellHeight));
  const buttonWidth = op.square === false ? Math.max(20, cellWidth) : size;
  const buttonHeight = op.square === false ? Math.max(20, cellHeight) : size;
  const totalWidth = columns * buttonWidth + gap * (columns - 1);
  const x0 = (width - totalWidth) / 2;

  targets.forEach((button, position) => {
    const column = position % columns;
    const row = Math.floor(position / columns);
    setButtonGeometry(button, x0 + column * (buttonWidth + gap), startY + row * (buttonHeight + gap), buttonWidth, buttonHeight);
  });
  return `Acomodé ${count} botones en ${columns} columnas.`;
}

function applyStyle(screen: ProjectScreen, indices: number[], op: Extract<AiOperation, { op: 'style' }>): string {
  const hasChange = [op.text, op.textColor, op.backColor, op.fontFamily, op.fontSize, op.fontStyle, op.textAlign].some(
    (value) => value !== undefined,
  );
  if (!hasChange) throw new AiPlanError('La operación style no incluye ningún cambio.');
  const textColor = op.textColor === undefined ? undefined : normalizeColor(op.textColor);
  const backColor = op.backColor === undefined ? undefined : normalizeColor(op.backColor);
  const fontStyle = normalizeFontStyle(op.fontStyle);
  const textAlign = normalizeAlignment(op.textAlign);
  if (op.fontFamily !== undefined && (!String(op.fontFamily).trim() || String(op.fontFamily).length > 80)) {
    throw new AiPlanError('La familia de fuente no es válida.');
  }
  const fontSize = op.fontSize === undefined ? undefined : clamp(Number(op.fontSize), 4, 200);

  for (const index of indices) {
    const button = screen.compact.Body.Buttons[index];
    if (!button) continue;
    if (op.text !== undefined) button.Text.Text = String(op.text);
    if (textColor !== undefined) button.Text.Color = textColor;
    if (backColor !== undefined) button.Text.BackColor = backColor;
    if (op.fontFamily !== undefined) button.Text.Font.Family = String(op.fontFamily).trim();
    if (fontSize !== undefined) button.Text.Font.Size = fontSize;
    if (fontStyle !== undefined) button.Text.Font.FontStyle = fontStyle;
    if (textAlign !== undefined) button.Text.TextAlign = textAlign;
  }
  return `Cambié el estilo de ${indices.length} ${indices.length === 1 ? 'botón' : 'botones'}.`;
}

function writeActions(button: PdtdButton, next: Action[]) {
  const markers = (button.Actions ?? []).filter((action) => String(action.Type) === 'executionOrder');
  const ordered = next.map((action, index) => ({ ...action, Index: index + 1 }));
  button.Actions = [...ordered, ...markers];
}

function applyAction(screen: ProjectScreen, indices: number[], op: Extract<AiOperation, { op: 'action' }>, project: Project): string {
  const type = actionType(op.type);
  const value = actionValue(project, type, op.value);
  for (const index of indices) {
    const button = screen.compact.Body.Buttons[index];
    if (!button) continue;
    const existing = (button.Actions ?? []).filter((action) => String(action.Type) !== 'executionOrder');
    if (op.mode === 'replace') {
      writeActions(button, [{ Type: type, Value: value }]);
      continue;
    }
    const found = existing.some((action) => String(action.Type) === type);
    const next = found
      ? existing.map((action) => (String(action.Type) === type ? { ...action, Value: value } : action))
      : [...existing, { Type: type, Value: value }];
    writeActions(button, next);
  }
  return `Actualicé la acción ${type} en ${indices.length} botón${indices.length === 1 ? '' : 'es'}.`;
}

function removeAction(screen: ProjectScreen, indices: number[], op: Extract<AiOperation, { op: 'removeAction' }>): string {
  const type = actionType(op.type);
  let removed = 0;
  for (const index of indices) {
    const button = screen.compact.Body.Buttons[index];
    if (!button) continue;
    const existing = (button.Actions ?? []).filter((action) => String(action.Type) !== 'executionOrder');
    const next = existing.filter((action) => String(action.Type) !== type);
    if (next.length !== existing.length) removed += 1;
    writeActions(button, next);
  }
  return `Quité la acción ${type} de ${removed} botón${removed === 1 ? '' : 'es'}.`;
}

function buildNewButton(project: Project, input: AiNewButton): PdtdButton {
  const text = String(input.text ?? '').trim();
  if (!text) throw new AiPlanError('Cada botón nuevo necesita un texto.');
  if (text.length > 120) throw new AiPlanError(`El texto "${text.slice(0, 20)}..." es demasiado largo.`);
  const button = makeButton(text);
  button.Text.Text = text;
  if (input.backColor !== undefined) button.Text.BackColor = normalizeColor(input.backColor);
  if (input.textColor !== undefined) button.Text.Color = normalizeColor(input.textColor);
  if (input.fontFamily !== undefined) button.Text.Font.Family = String(input.fontFamily).trim();
  if (input.fontSize !== undefined) button.Text.Font.Size = clamp(Number(input.fontSize), 4, 200);
  if (input.fontStyle !== undefined) button.Text.Font.FontStyle = normalizeFontStyle(input.fontStyle) ?? '';
  if (input.textAlign !== undefined) button.Text.TextAlign = normalizeAlignment(input.textAlign) ?? 'MiddleCenter';
  if (input.width !== undefined) button.Width = clamp(Number(input.width), 20, profileForProject(project).visibleWidth);
  if (input.height !== undefined) button.Height = clamp(Number(input.height), 20, profileForProject(project).visibleHeight);

  const explicit = input.actions ?? [];
  if (explicit.length) {
    const actions = explicit.map((action) => ({
      Type: actionType(action.type),
      Value: actionValue(project, action.type, action.value),
    }));
    writeActions(button, actions);
    return button;
  }

  let product: number | null = input.productId === undefined ? null : Number(input.productId);
  if (input.productId !== undefined) {
    const found = project.products.find((item) => Number(item.id) === product);
    if (!found && project.products.length > 0) throw new AiPlanError(`No existe el producto ${input.productId}.`);
  }
  const derived: Action[] = [];
  if (product !== null) {
    derived.push({ Type: 'selectProduct', Value: true });
    derived.push({ Type: 'addProduct', Value: product });
    if (input.addToList) derived.push({ Type: 'addToList', Value: product });
  }
  if (input.gotoScreen !== undefined) {
    const target = Number(input.gotoScreen);
    if (!project.screens.some((screen) => Number(screen.compact.Index) === target)) {
      throw new AiPlanError(`No existe la pantalla ${target}.`);
    }
    derived.push({ Type: 'gotoScreen', Value: target });
  }
  if (derived.length) writeActions(button, derived);
  return button;
}

function createScreen(project: Project, op: Extract<AiOperation, { op: 'createScreen' }>, allowCreateScreens: boolean): { screen: ProjectScreen; message: string } {
  if (!allowCreateScreens) throw new AiPlanError('La creación de pantallas está desactivada en los ajustes.');
  const title = String(op.title ?? '').trim();
  if (!title) throw new AiPlanError('La pantalla nueva necesita un título.');
  if (op.buttons && op.buttons.length > 60) throw new AiPlanError('No se pueden crear más de 60 botones por pantalla.');
  const profile = profileForProject(project);
  const index = nextScreenIndex(project);
  const compact = makeScreenFromTemplate(op.template ?? 'blank', index, title, profile);
  const baseId = String(op.id ?? title).trim();
  let id = baseId;
  let suffix = 2;
  while (project.screens.some((screen) => String(screen.compact.Id).toLowerCase() === id.toLowerCase())) {
    id = `${baseId} ${suffix}`;
    suffix += 1;
  }
  compact.Id = id;
  if (op.bodyColor !== undefined) compact.Body.BackColor = normalizeColor(op.bodyColor);

  if (op.buttons?.length) {
    const titleButton = compact.Body.Buttons.find(isTitle) ?? makeButton(title);
    titleButton.Text.Text = title;
    const buttons = op.buttons.map((input) => buildNewButton(project, input));
    compact.Body.Buttons = [titleButton, ...buttons];
    const indices = buttons.map((_, position) => position + 1);
    layoutButtons({ uid: '', compact }, indices, { op: 'layout', columns: op.columns, startY: 116, padding: 12, gap: 10 }, project);
  }

  const screen: ProjectScreen = { uid: uid('screen'), compact };
  project.screens = [...project.screens, screen];
  return { screen, message: `Creé la pantalla ${index} · ${id}` };
}

function issueKey(issue: { screenUid: string; buttonUid?: string; message: string }): string {
  return `${issue.screenUid}|${issue.buttonUid ?? ''}|${issue.message}`;
}

export function applyPlan(project: Project, plan: AiPlan, settings: AiSettings): AiAppliedPlan {
  if (!plan || typeof plan.summary !== 'string' || !Array.isArray(plan.operations)) {
    throw new AiPlanError('El plan no tiene el formato esperado.');
  }
  if (!plan.operations.length) throw new AiPlanError('El plan está vacío.');
  if (plan.operations.length > 200) throw new AiPlanError('El plan supera el máximo de 200 operaciones.');
  const next = clone(project);
  const details: string[] = [];
  let affected = 0;
  let selectedScreenUid = next.selectedScreenUid ?? next.screens[0]?.uid ?? '';
  let selectedButtonIndex: number | null = next.selectedButtonIndex;
  const beforeErrors = new Set(
    validateProject(project)
      .filter((issue) => issue.level === 'error')
      .map(issueKey),
  );

  for (const operation of plan.operations) {
    if (operation.op === 'createScreen') {
      const created = createScreen(next, operation, settings.allowCreateScreens);
      details.push(created.message);
      selectedScreenUid = created.screen.uid;
      selectedButtonIndex = 0;
      affected += created.screen.compact.Body.Buttons.length;
      continue;
    }

    const screen = screenByRef(next, operation.screen);
    if (!screen) throw new AiPlanError(`No encontré la pantalla "${String(operation.screen ?? 'seleccionada')}".`);

    if (operation.op === 'layout') {
      const indices = normalizeSelector(screen, next, operation.selector, !operation.includeTitles);
      details.push(layoutButtons(screen, indices, operation, next));
      selectedScreenUid = screen.uid;
      selectedButtonIndex = indices[0];
      affected += indices.length;
      continue;
    }
    if (operation.op === 'style') {
      const indices = normalizeSelector(screen, next, operation.selector);
      details.push(applyStyle(screen, indices, operation));
      selectedScreenUid = screen.uid;
      selectedButtonIndex = indices[0];
      affected += indices.length;
      continue;
    }
    if (operation.op === 'action') {
      const indices = normalizeSelector(screen, next, operation.selector);
      details.push(applyAction(screen, indices, operation, next));
      selectedScreenUid = screen.uid;
      selectedButtonIndex = indices[0];
      affected += indices.length;
      continue;
    }
    if (operation.op === 'removeAction') {
      const indices = normalizeSelector(screen, next, operation.selector);
      details.push(removeAction(screen, indices, operation));
      selectedScreenUid = screen.uid;
      selectedButtonIndex = indices[0];
      affected += indices.length;
      continue;
    }
    if (operation.op === 'bodyColor') {
      screen.compact.Body.BackColor = normalizeColor(operation.color);
      details.push(`Cambié el fondo de la pantalla ${screen.compact.Index} · ${screen.compact.Id}.`);
      selectedScreenUid = screen.uid;
      selectedButtonIndex = null;
      continue;
    }
    throw new AiPlanError(`Operación desconocida: ${(operation as { op?: string }).op ?? 'sin tipo'}.`);
  }

  const after = validateProject(next);
  const newErrors = after.filter((issue) => issue.level === 'error' && !beforeErrors.has(issueKey(issue)));
  if (newErrors.length) {
    throw new AiPlanError('El plan genera errores de validación.', newErrors.slice(0, 8).map((issue) => issue.message));
  }
  if (!selectedScreenUid) selectedScreenUid = next.screens[0]?.uid ?? '';
  const warnings = after
    .filter((issue) => issue.level === 'warning' && issue.screenUid === selectedScreenUid)
    .slice(0, 6)
    .map((issue) => issue.message);

  return {
    project: next,
    details,
    warnings,
    selectedScreenUid,
    selectedButtonIndex,
    affectedButtons: affected,
  };
}
