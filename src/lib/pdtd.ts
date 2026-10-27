import type {
  Action,
  DesignProfile,
  Json,
  PdtdButton,
  PdtdScreen,
  Product,
  ProfileId,
  Project,
  ProjectScreen,
  ValidationIssue,
  WebDesign,
  Zone,
} from '../types';
import {
  PROFILE_1280,
  profileForId,
  profileForProject,
  profileFromCaja,
  profileFromWeb,
} from './profiles';

export const VISIBLE_WIDTH = 588;
export const VISIBLE_HEIGHT = 843;
export const BODY_WIDTH = 768;
export const BODY_HEIGHT = 1024;
export const PORTAL_WIDTH = 1181;
export const PORTAL_HEIGHT = 708;
export const ACTION_TYPES = [
  'addProduct',
  'gotoScreen',
  'selectProduct',
  'addToList',
  'executionOrder',
  'finish',
  'deselectProduct',
  'rewind',
  'popUp',
  'listFlush',
] as const;

export type TemplateId = 'blank' | 'grid3' | 'grid2' | 'list20' | 'grid30';

export function uid(prefix = 'id'): string {
  const value =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${value}`;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeButton(input?: Partial<PdtdButton>): PdtdButton {
  const source: any = input ?? {};
  const text: any = source.Text ?? {};
  const icon: any = source.Icon ?? {};
  const font: any = text.Font ?? {};
  const actions: any[] = Array.isArray(source.Actions) ? source.Actions : [];
  return {
    ...source,
    Text: {
      ...text,
      Text: String(text.Text ?? ''),
      Color: String(text.Color ?? '255,255,255'),
      BackColor: String(text.BackColor ?? '155,83,0'),
      TextAlign: String(text.TextAlign ?? 'MiddleCenter'),
      Font: {
        ...font,
        Family: String(font.Family ?? 'Arial Black'),
        Size: number(font.Size, 9),
        FontStyle: String(font.FontStyle ?? ''),
      },
      X: 0,
      Y: 0,
      Width: 0,
      Height: 0,
    },
    Icon: {
      ...icon,
      Imagen: String(icon.Imagen ?? ''),
      SizeMode: String(icon.SizeMode ?? 'Strech'),
      X: 0,
      Y: 0,
      Width: 0,
      Height: 0,
    },
    Actions: actions.map((action) => ({ ...action })) as Action[],
    X: number(source.X, 0),
    Y: number(source.Y, 0),
    Width: number(source.Width, 180),
    Height: number(source.Height, 180),
  };
}

export function normalizeZone(input: Partial<Zone> | undefined, width: number, height: number): Zone {
  const source: any = input ?? {};
  return {
    ...source,
    BackColor: String(source.BackColor ?? '#ffffff'),
    Buttons: Array.isArray(source.Buttons) ? source.Buttons.map(normalizeButton) : [],
    Texts: Array.isArray(source.Texts) ? source.Texts : [],
    Images: Array.isArray(source.Images) ? source.Images : [],
    Width: number(source.Width, width),
    Height: number(source.Height, height),
    Panels: Array.isArray(source.Panels) ? source.Panels : [],
  };
}

export function normalizeScreen(
  input: Partial<PdtdScreen>,
  fallbackIndex = 1,
  profile: DesignProfile = PROFILE_1280,
): PdtdScreen {
  const source: any = input ?? {};
  const index = number(source.Index, fallbackIndex);
  return {
    ...source,
    Index: index,
    ScreenId: number(source.ScreenId, 0),
    Id: String(source.Id ?? `Pantalla${index}`),
    Header: normalizeZone(source.Header, profile.bodyWidth, 0),
    Body: normalizeZone(source.Body, profile.bodyWidth, profile.bodyHeight),
    Footer: normalizeZone(source.Footer, profile.bodyWidth, 0),
  };
}

export function compactFromWeb(screen: PdtdScreen, profile: DesignProfile = PROFILE_1280): PdtdScreen {
  const normalized = normalizeScreen(screen, screen.Index, profile);
  return {
    Index: normalized.Index,
    ScreenId: normalized.ScreenId,
    Id: normalized.Id,
    Header: clone(normalized.Header),
    Body: clone(normalized.Body),
    Footer: clone(normalized.Footer),
  };
}

export function isTitle(button: PdtdButton): boolean {
  return (
    !button.Actions?.length &&
    number(button.Width) >= 350 &&
    number(button.Height) >= 45
  );
}

export function makeButton(text = 'BOTON', overrides: Partial<PdtdButton> = {}): PdtdButton {
  return normalizeButton({
    Text: {
      Text: text,
      Color: '255,255,255',
      BackColor: '155,83,0',
      TextAlign: 'MiddleCenter',
      Font: { Family: 'Arial Black', Size: 9, FontStyle: '' },
      X: 0,
      Y: 0,
      Width: 0,
      Height: 0,
    },
    Icon: { Imagen: '', SizeMode: 'Strech', X: 0, Y: 0, Width: 0, Height: 0 },
    Actions: [],
    X: 10,
    Y: 118,
    Width: 180,
    Height: 180,
    ...overrides,
  });
}

export function makeTitle(text = 'NUEVA PANTALLA', profile: DesignProfile = PROFILE_1280): PdtdButton {
  const width = Math.min(profile.visibleWidth - 48, profile.id === '1080' ? 760 : 499.8);
  return makeButton(text, {
    X: Math.round(((profile.visibleWidth - width) / 2) * 10) / 10,
    Y: 17,
    Width: width,
    Height: 91,
    Text: {
      Text: text,
      Color: '255,255,255',
      BackColor: '120,120,120',
      TextAlign: 'BottomCenter',
      Font: { Family: 'Arial Black', Size: 21, FontStyle: '' },
      X: 0,
      Y: 0,
      Width: 0,
      Height: 0,
    },
  });
}

export function makeEmptyBody(profile: DesignProfile = PROFILE_1280): Zone {
  return {
    BackColor: '#ffffff',
    Buttons: [],
    Texts: [],
    Images: [],
    Width: profile.bodyWidth,
    Height: profile.bodyHeight,
    Panels: [],
  };
}

export function makeEmptyScreen(
  index: number,
  id = `Pantalla${index}`,
  profile: DesignProfile = PROFILE_1280,
): PdtdScreen {
  return {
    Index: index,
    ScreenId: 0,
    Id: id,
    Header: normalizeZone(undefined, profile.bodyWidth, 0),
    Body: makeEmptyBody(profile),
    Footer: normalizeZone(undefined, profile.bodyWidth, 0),
  };
}

export function templateButtons(
  template: TemplateId,
  title = 'NUEVA PANTALLA',
  profile: DesignProfile = PROFILE_1280,
): PdtdButton[] {
  const buttons: PdtdButton[] = [makeTitle(title, profile)];
  if (template === 'blank') return buttons;
  if (template === 'grid3') {
    for (let i = 0; i < 9; i += 1) {
      buttons.push(
        makeButton(`BOTON ${i + 1}`, {
          X: 14 + (i % 3) * 190,
          Y: 118 + Math.floor(i / 3) * 190,
          Width: 180,
          Height: 180,
        }),
      );
    }
  }
  if (template === 'grid2') {
    for (let i = 0; i < 4; i += 1) {
      buttons.push(
        makeButton(`CATEGORIA ${i + 1}`, {
          X: 9 + (i % 2) * 290,
          Y: 118 + Math.floor(i / 2) * 290,
          Width: 280,
          Height: 280,
        }),
      );
    }
  }
  if (template === 'list20') {
    for (let i = 0; i < 20; i += 1) {
      buttons.push(
        makeButton(`PRODUCTO ${i + 1}`, {
          X: 9 + (i % 4) * 145,
          Y: 118 + Math.floor(i / 4) * 145,
          Width: 135,
          Height: 135,
          Text: { ...makeButton().Text, Text: `PRODUCTO ${i + 1}`, Font: { Family: 'Arial Black', Size: 8, FontStyle: '' } },
        }),
      );
    }
  }
  if (template === 'grid30') {
    for (let i = 0; i < 30; i += 1) {
      buttons.push(
        makeButton(`GUISADO ${i + 1}`, {
          X: 4 + (i % 6) * 98,
          Y: 118 + Math.floor(i / 6) * 100,
          Width: 90,
          Height: 90,
          Text: { ...makeButton().Text, Text: `GUISADO ${i + 1}`, Font: { Family: 'Arial Black', Size: 8, FontStyle: '' } },
        }),
      );
    }
  }
  if (profile.id !== '1280' && buttons.length > 1) {
    const rest = buttons.slice(1);
    const minX = Math.min(...rest.map((button) => Number(button.X)));
    const maxX = Math.max(...rest.map((button) => Number(button.X) + Number(button.Width)));
    const shift = Math.round((profile.visibleWidth - (maxX - minX)) / 2 - minX);
    rest.forEach((button) => {
      button.X = Number(button.X) + shift;
    });
  }
  return buttons;
}

export function makeScreenFromTemplate(
  template: TemplateId,
  index: number,
  title: string,
  profile: DesignProfile = PROFILE_1280,
): PdtdScreen {
  const screen = makeEmptyScreen(index, `Pantalla${index}`, profile);
  screen.Body.Buttons = templateButtons(template, title, profile);
  return screen;
}

export function createProject(
  name?: string,
  profileId: ProfileId = '1280',
): Project {
  const profile = profileForId(profileId);
  const screen = makeScreenFromTemplate('blank', 1, 'MENU PRINCIPAL', profile);
  screen.Id = 'MenuPpal';
  const projectScreen: ProjectScreen = { uid: uid('screen'), compact: screen };
  return {
    name: name ?? profile.defaultName,
    profileId: profile.id,
    source: 'new',
    webBase: null,
    screens: [projectScreen],
    products: [],
    selectedScreenUid: projectScreen.uid,
    selectedButtonIndex: screen.Body.Buttons.length ? 0 : null,
  };
}

function projectScreenFromCompact(
  compact: PdtdScreen,
  webRaw?: PdtdScreen,
  profile: DesignProfile = PROFILE_1280,
): ProjectScreen {
  return { uid: uid('screen'), compact: normalizeScreen(compact, compact.Index, profile), webRaw };
}

export function projectFromCaja(data: Json, fileName: string): Project {
  if (!Array.isArray(data)) throw new Error('El archivo Caja debe contener una lista de pantallas.');
  const profile = profileForId(profileFromCaja(data));
  const screens = data.map((screen, index) =>
    projectScreenFromCompact(normalizeScreen(screen, index + 1, profile), undefined, profile),
  );
  return {
    name: fileName.replace(/\.pdtd$/i, '').replace(/_Dise?o(?:Web|Caja).*$/i, '').trim() || 'Caja importada',
    profileId: profile.id,
    source: 'caja',
    webBase: null,
    screens,
    products: [],
    selectedScreenUid: screens[0]?.uid ?? null,
    selectedButtonIndex: null,
  };
}

export function projectFromWeb(data: WebDesign, fileName: string): Project {
  if (!data || !Array.isArray(data.Screens)) throw new Error('El archivo Web no contiene Screens.');
  const web = clone(data);
  const profile = profileForId(profileFromWeb(web));
  const screens = web.Screens.map((screen) => {
    const compact = compactFromWeb(screen, profile);
    return projectScreenFromCompact(compact, clone(screen), profile);
  });
  return {
    name: String(web.Name || fileName.replace(/\.pdtd$/i, '')),
    profileId: profile.id,
    source: 'web',
    webBase: web,
    screens,
    products: [],
    selectedScreenUid: screens[0]?.uid ?? null,
    selectedButtonIndex: null,
  };
}

export function importProjectText(text: string, fileName: string): Project {
  const clean = text.replace(/^\uFEFF/, '');
  const data = JSON.parse(clean);
  if (Array.isArray(data)) return projectFromCaja(data, fileName);
  if (data && Array.isArray(data.Screens)) return projectFromWeb(data, fileName);
  throw new Error('Formato .pdtd no reconocido.');
}

export function cajaFromProject(project: Project): PdtdScreen[] {
  return project.screens.map(({ compact }) => {
    const screen = clone(compact);
    screen.Header = clone(compact.Header);
    screen.Body = clone(compact.Body);
    screen.Footer = clone(compact.Footer);
    return screen;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function rgb(value: string): string {
  const parts = String(value || '0,0,0').split(',').map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return 'rgb(0, 0, 0)';
  return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

function imageUrl(value: string): string {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
}

function labelClass(button: PdtdButton): string {
  const align = String(button.Text?.TextAlign ?? '').toLowerCase();
  if (align.includes('bottom')) return 'element-label-bottom';
  if (align.includes('top')) return 'element-label-top';
  return 'element-label-vertically-center';
}

function textareaHtml(button: PdtdButton, index: number): string {
  const text = escapeHtml(String(button.Text?.Text ?? ''));
  const font = button.Text?.Font ?? { Family: 'Arial Black', Size: 9, FontStyle: '' };
  return `<textarea maxlength="50" id="elementLabel${index}" contenteditable="true" class="${labelClass(button)}" style="font-size: ${number(font.Size, 9)}px; text-align: center; color: ${rgb(button.Text?.Color ?? '255,255,255')}; font-weight: bold; font-family: '${escapeHtml(font.Family || 'Arial Black')}';">${text}</textarea>`;
}

function elementHtml(button: PdtdButton, index: number, x: number, y: number, width: number, height: number): string {
  const bg = rgb(button.Text?.BackColor ?? '0,0,0');
  const image = imageUrl(String(button.Icon?.Imagen ?? ''));
  const imageCss = image ? `background-image: url('${image}'); background-size: 100% 100%;` : 'background-image: none;';
  const style = `top: ${(y + 12).toFixed(4)}px; left: ${x.toFixed(4)}px; background-color: ${bg}; ${imageCss} height: ${(height + 2).toFixed(4)}px; width: ${(width + 2).toFixed(4)}px;`;
  return `<div id="dragEle${index}" class="ui-widget-content resizable item obstacle" style="${style}"><button type="button" class="close close-element delete" aria-label="Close"><span aria-hidden="true">×</span></button>${textareaHtml(button, index)}</div>`;
}

const FUNCTION_TYPES = [
  'gotoScreen',
  'popUp',
  'addProduct',
  'addToList',
  'listFlush',
  'finish',
  'reset',
  'rewind',
  'selectProduct',
  'deselectProduct',
] as const;

type FunctionsObject = Record<string, any>;

function actionNumber(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function actionBoolean(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
  return Boolean(value);
}

function functionsFromActions(
  actions: Action[],
  screens: PdtdScreen[] = [],
  products: Product[] = [],
): FunctionsObject {
  const functions: FunctionsObject = {
    gotoScreen: { id: 0, name: '', executionOrder: 0 },
    popUp: { id: 0, name: '', executionOrder: 0 },
    addProduct: { id: 0, name: '', executionOrder: 0 },
    addToList: { id: 0, name: '', executionOrder: 0 },
    listFlush: { executionOrder: 0, value: false },
    finish: { executionOrder: 0, value: false },
    reset: { executionOrder: 0, value: false },
    rewind: { executionOrder: 0, value: false },
    selectProduct: { executionOrder: 0, value: false },
    deselectProduct: { executionOrder: 0, value: false },
  };

  const screenName = (id: number) =>
    screens.find((screen) => actionNumber(screen.Index) === id)?.Id ?? '';
  const productName = (id: number) =>
    products.find((product) => actionNumber(product.id) === id)?.name ?? '';

  let markerOrder: number | null = null;
  for (const action of actions) {
    const type = String(action.Type ?? '');
    const executionOrder = actionNumber(action.Index);
    if (type === 'executionOrder') {
      markerOrder = actionNumber(action.Value);
      continue;
    }
    if (type === 'gotoScreen') {
      const id = actionNumber(action.Value);
      functions.gotoScreen = { id, name: screenName(id), executionOrder };
    } else if (type === 'popUp') {
      const id = actionNumber(action.Value);
      functions.popUp = { id, name: '', executionOrder };
    } else if (type === 'addProduct' || type === 'addToList') {
      const id = actionNumber(action.Value);
      functions[type] = { id, name: productName(id), executionOrder };
    } else if (type === 'listFlush' || type === 'finish' || type === 'reset' || type === 'rewind') {
      functions[type] = { executionOrder, value: actionBoolean(action.Value) };
    } else if (type === 'selectProduct' || type === 'deselectProduct') {
      functions[type] = { executionOrder, value: actionBoolean(action.Value) };
    }
  }

  if (markerOrder !== null) functions.executionOrder = markerOrder;
  return functions;
}

function functionsMatchActions(source: unknown, actions: Action[]): source is FunctionsObject {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
  const functions = source as FunctionsObject;
  const active = actions.filter((action) => String(action.Type ?? '') !== 'executionOrder');
  const seen = new Set<string>();

  for (const action of active) {
    const type = String(action.Type ?? '');
    const entry = functions[type];
    if (!entry || typeof entry !== 'object') return false;
    if (actionNumber(entry.executionOrder) !== actionNumber(action.Index)) return false;
    if (type === 'gotoScreen' || type === 'addProduct' || type === 'addToList' || type === 'popUp') {
      if (actionNumber(entry.id) !== actionNumber(action.Value)) return false;
    } else if (
      type === 'selectProduct' ||
      type === 'deselectProduct' ||
      type === 'listFlush' ||
      type === 'finish' ||
      type === 'reset' ||
      type === 'rewind'
    ) {
      if (actionBoolean(entry.value) !== actionBoolean(action.Value)) return false;
    } else {
      return false;
    }
    seen.add(type);
  }

  for (const type of FUNCTION_TYPES) {
    const entry = functions[type];
    if (entry && actionNumber(entry.executionOrder) > 0 && !seen.has(type)) return false;
  }
  return true;
}

function syncBodyOriginal(
  screen: PdtdScreen,
  screens: PdtdScreen[] = [],
  products: Product[] = [],
): void {
  const body = screen.Body;
  const buttons = body.Buttons;
  const previous = screen.BodyOriginal && typeof screen.BodyOriginal === 'object' ? screen.BodyOriginal : {};
  const width = Math.max(1, number(previous.width, PORTAL_WIDTH));
  const height = Math.max(1, number(previous.height, PORTAL_HEIGHT));
  const fx = width / Math.max(1, number(body.Width, BODY_WIDTH));
  const fy = height / Math.max(1, number(body.Height, BODY_HEIGHT));
  const previousElements = Array.isArray(previous.elements) ? previous.elements : [];
  const elements = buttons.map((button, index) => {
    const actions = Array.isArray(button.Actions) ? button.Actions : [];
    const previousElement = previousElements[index];
    const x = number(button.X) * fx;
    const y = number(button.Y) * fy;
    const w = number(button.Width) * fx;
    const h = number(button.Height) * fy;
    const main = elementHtml(button, index, x, y, w, h);
    const textarea = textareaHtml(button, index);
    return {
      id: `dragEle${index}`,
      element: {
        e: main,
        sub_e: [{ e: textarea, height: 0, width: 0, X: 0, Y: 0, min: 0, max: 0 }],
        height: Math.round(h * 10000) / 10000,
        width: Math.round(w * 10000) / 10000,
        X: Math.round(x * 10000) / 10000,
        Y: Math.round(y * 10000) / 10000,
        isPanel: false,
        min: 0,
        max: 0,
      },
      label: null,
      isSelected: false,
      containmentId: 'body',
      functions:
        previousElement && functionsMatchActions(previousElement.functions, actions)
          ? clone(previousElement.functions)
          : functionsFromActions(actions, screens, products),
    };
  });
  screen.BodyOriginal = {
    ...previous,
    width,
    height,
    backGroundImage: previous.backGroundImage ?? '',
    backGroundColor: body.BackColor,
    hasElements: buttons.length > 0,
    elements,
  };
  const headerOriginal = {
    width,
    height: 0,
    backGroundImage: '',
    backGroundColor: screen.Header.BackColor,
    hasElements: false,
    elements: [],
  };
  const footerOriginal = {
    width,
    height: 0,
    backGroundImage: '',
    backGroundColor: screen.Footer.BackColor,
    hasElements: false,
    elements: [],
  };
  screen.HeaderOriginal = screen.HeaderOriginal ?? headerOriginal;
  screen.FooterOriginal = screen.FooterOriginal ?? footerOriginal;
}

function makeWebScreen(
  compact: PdtdScreen,
  screens: PdtdScreen[] = [],
  products: Product[] = [],
  profile: DesignProfile = PROFILE_1280,
): PdtdScreen {
  const screen = clone(compact);
  screen.BodyOriginal = {
    width: profile.portalWidth,
    height: profile.portalHeight,
    backGroundImage: '',
    backGroundColor: screen.Body.BackColor,
    hasElements: false,
    elements: [],
  };
  screen.HeaderOriginal = {
    width: profile.portalWidth,
    height: 0,
    backGroundImage: '',
    backGroundColor: screen.Header.BackColor,
    hasElements: false,
    elements: [],
  };
  screen.FooterOriginal = {
    width: profile.portalWidth,
    height: 0,
    backGroundImage: '',
    backGroundColor: screen.Footer.BackColor,
    hasElements: false,
    elements: [],
  };
  syncBodyOriginal(screen, screens, products);
  return screen;
}

export function webFromProject(project: Project): WebDesign {
  const profile = profileForProject(project);
  const base: WebDesign = project.webBase
    ? clone(project.webBase)
    : {
        "PkDise\u00f1o": 0,
        Name: project.name,
        ScreenSize: profile.screenSize,
        OriginalScreenSize: profile.originalScreenSize,
        navigationTypeId: '2',
        Screens: [],
      };
  base.Name = project.name;
  const compactScreens = project.screens.map((projectScreen) => projectScreen.compact);
  base.Screens = project.screens.map((projectScreen) => {
    const compact = clone(projectScreen.compact);
    const screen = projectScreen.webRaw
      ? clone(projectScreen.webRaw)
      : makeWebScreen(compact, compactScreens, project.products, profile);
    screen.Index = compact.Index;
    screen.ScreenId = compact.ScreenId;
    screen.Id = compact.Id;
    screen.Header = clone(compact.Header);
    screen.Body = clone(compact.Body);
    screen.Footer = clone(compact.Footer);
    syncBodyOriginal(screen, compactScreens, project.products);
    return screen;
  });
  return base;
}

export function exportFileName(project: Project, kind: 'web' | 'caja'): string {
  const safe = project.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Diseno 1280';
  return `${safe}_Diseño${kind === 'web' ? 'Web' : 'Caja'}.pdtd`;
}

export function downloadJson(data: Json, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function fileStem(name: string): string {
  return name.replace(/\.pdtd$/i, '').replace(/[_-]+$/g, '');
}

export function screenLabel(screen: PdtdScreen): string {
  return `${String(screen.Index).padStart(2, '0')} · ${screen.Id}`;
}

export function nextScreenIndex(project: Project): number {
  return Math.max(0, ...project.screens.map((screen) => number(screen.compact.Index))) + 1;
}

export function validateProject(project: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const profile = profileForProject(project);
  const indexes = new Map<number, string>();
  const ids = new Map<string, string>();
  const indexSet = new Set(project.screens.map((screen) => number(screen.compact.Index)));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  for (const screen of project.screens) {
    const compact = screen.compact;
    if (indexes.has(compact.Index)) {
      issues.push({
        screenUid: screen.uid,
        screenIndex: compact.Index,
        screenName: compact.Id,
        level: 'error',
        message: `Índice ${compact.Index} duplicado con ${indexes.get(compact.Index)}.`,
      });
    } else {
      indexes.set(compact.Index, compact.Id);
    }
    if (ids.has(compact.Id)) {
      issues.push({
        screenUid: screen.uid,
        screenIndex: compact.Index,
        screenName: compact.Id,
        level: 'error',
        message: `Id ${compact.Id} duplicado.`,
      });
    } else {
      ids.set(compact.Id, compact.Id);
    }
    const buttons = compact.Body.Buttons;
    for (let i = 0; i < buttons.length; i += 1) {
      const button = buttons[i];
      const x = number(button.X);
      const y = number(button.Y);
      const w = number(button.Width);
      const h = number(button.Height);
      const screenName = compact.Id;
      if (
        x < 0 ||
        y < 0 ||
        x + w > profile.visibleWidth + 0.5 ||
        y + h > profile.visibleHeight + 0.5
      ) {
        issues.push({
          screenUid: screen.uid,
          screenIndex: compact.Index,
          screenName,
          buttonUid: String(i),
          level: 'error',
          message: `“${button.Text.Text || `Botón ${i + 1}`}” sale del área visible (${x.toFixed(0)}, ${y.toFixed(0)}, ${w.toFixed(0)}×${h.toFixed(0)}).`,
        });
      }
      if (!button.Text.Text && !button.Icon.Imagen) {
        issues.push({
          screenUid: screen.uid,
          screenIndex: compact.Index,
          screenName,
          buttonUid: String(i),
          level: 'warning',
          message: `Botón ${i + 1} sin texto ni imagen.`,
        });
      }
      if (context && button.Text.Text) {
        const font = button.Text.Font ?? { Size: 9, Family: 'Arial Black' };
        context.font = `${number(font.Size, 9) * 1.333}px "${font.Family || 'Arial Black'}"`;
        const width = context.measureText(button.Text.Text).width;
        if (width > Math.max(20, w - 8)) {
          issues.push({
            screenUid: screen.uid,
            screenIndex: compact.Index,
            screenName,
            buttonUid: String(i),
            level: 'warning',
            message: `“${button.Text.Text}” podría no caber en ${w.toFixed(0)} px.`,
          });
        }
      }
      for (const action of button.Actions ?? []) {
        if (action.Type === 'gotoScreen' && !indexSet.has(number(action.Value))) {
          issues.push({
            screenUid: screen.uid,
            screenIndex: compact.Index,
            screenName,
            buttonUid: String(i),
            level: 'error',
            message: `gotoScreen apunta a la pantalla inexistente ${action.Value}.`,
          });
        }
        if (!ACTION_TYPES.includes(action.Type as any)) {
          issues.push({
            screenUid: screen.uid,
            screenIndex: compact.Index,
            screenName,
            buttonUid: String(i),
            level: 'warning',
            message: `Acción desconocida: ${action.Type}.`,
          });
        }
      }
      for (let j = i + 1; j < buttons.length; j += 1) {
        const other = buttons[j];
        const ox = number(other.X);
        const oy = number(other.Y);
        const ow = number(other.Width);
        const oh = number(other.Height);
        if (x < ox + ow && x + w > ox && y < oy + oh && y + h > oy) {
          issues.push({
            screenUid: screen.uid,
            screenIndex: compact.Index,
            screenName,
            buttonUid: String(i),
            level: 'warning',
            message: `“${button.Text.Text || i + 1}” se traslapa con “${other.Text.Text || j + 1}”.`,
          });
          break;
        }
      }
    }
  }
  return issues;
}

export function parseProducts(rows: Json[][]): Product[] {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => String(cell ?? '').toLowerCase().includes('nombre')),
  );
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map((cell) => String(cell ?? '').toLowerCase());
  const find = (...terms: string[]) =>
    header.findIndex((cell) => terms.some((term) => cell.includes(term)));
  const idCol = find('pk', 'id', 'clave');
  const codeCol = find('código', 'codigo', 'code');
  const nameCol = find('nombre', 'name', 'producto');
  const priceCol = find('precio', 'price');
  const familyCol = find('familia', 'family', 'categor');
  const abbrCol = find('abreviaci', 'abbr');
  const products: Product[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const id = Number(row[idCol] ?? row[0]);
    const name = String(row[nameCol] ?? '').trim();
    if (!Number.isFinite(id) || !name) continue;
    products.push({
      id,
      name,
      code: String(row[codeCol] ?? ''),
      price: number(row[priceCol], 0),
      family: String(row[familyCol] ?? ''),
      abbreviation: abbrCol >= 0 ? String(row[abbrCol] ?? '') : '',
    });
  }
  return products;
}
