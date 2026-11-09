import { create } from 'zustand';
import type { ElementKind, PdtdButton, ProfileId, Product, Project, ProjectScreen, ViewMode, ZoneId } from './types';
import { profileForId, profileForProject } from './lib/profiles';
import { convertProjectProfile } from './lib/convert';
import { loadLocalProject, localStorageFailureMessage, saveLocalProject } from './lib/storage';
import {
  clone,
  createProject,
  cajaFromProject,
  downloadJson,
  exportFileName,
  importProjectText,
  makeButton,
  makeScreenFromTemplate,
  makeZoneText,
  zoneElements,
  nextScreenIndex,
  parseProducts,
  type TemplateId,
  uid,
  webFromProject,
} from './lib/pdtd';

interface EditorState {
  project: Project | null;
  previewProject: Project | null;
  clipboardButton: PdtdButton | null;
  history: Project[];
  future: Project[];
  view: ViewMode;
  scale: number;
  snap: boolean;
  showGrid: boolean;
  message: string | null;
  templateOpen: boolean;
  productsOpen: boolean;
  setView: (view: ViewMode) => void;
  setScale: (scale: number) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  setMessage: (message: string | null) => void;
  setTemplateOpen: (open: boolean) => void;
  setProductsOpen: (open: boolean) => void;
  newProject: (profileId?: ProfileId) => void;
  previewProfile: (profileId: ProfileId) => void;
  applyPreview: () => void;
  cancelPreview: () => void;
  importText: (text: string, fileName: string) => void;
  loadLocal: () => void;
  saveLocal: () => void;
  importProducts: (rows: unknown[][]) => void;
  setName: (name: string) => void;
  selectScreen: (screenUid: string) => void;
  selectButton: (index: number | null, zone?: ZoneId, kind?: ElementKind) => void;
  updateButton: (screenUid: string, index: number, patch: Partial<PdtdButton>, record?: boolean) => void;
  updateScreen: (screenUid: string, patch: { Id?: string; Index?: number }, record?: boolean) => void;
  updateZone: (screenUid: string, zone: ZoneId, patch: { BackColor?: string; Height?: number }, record?: boolean) => void;
  addZoneElement: (zone: ZoneId, kind: ElementKind) => void;
  applyProjectChange: (
    next: Project,
    options?: { message?: string; selectedScreenUid?: string; selectedButtonIndex?: number | null },
  ) => void;
  addScreen: (template: TemplateId, title: string) => void;
  duplicateScreen: (screenUid: string) => void;
  deleteScreen: (screenUid: string) => void;
  moveScreen: (screenUid: string, direction: -1 | 1) => void;
  addButton: () => void;
  duplicateButton: (screenUid: string, index: number) => void;
  copyButton: (screenUid: string, index: number) => void;
  pasteButton: (screenUid: string) => void;
  deleteButton: (screenUid: string, index: number) => void;
  moveButtonLayer: (screenUid: string, index: number, direction: -1 | 1) => void;
  beginTransaction: () => void;
  nudgeButton: (screenUid: string, index: number, dx: number, dy: number) => void;
  undo: () => void;
  redo: () => void;
  exportWeb: () => void;
  exportCaja: () => void;
  projectFromLocal: () => Project | null;
}

const HISTORY_LIMIT = 60;
const NUDGE_WINDOW_MS = 600;

let nudgeSession: { key: string; at: number } | null = null;

function screenOf(project: Project, screenUid: string): ProjectScreen {
  const screen = project.screens.find((item) => item.uid === screenUid);
  if (!screen) throw new Error('Pantalla no encontrada.');
  return screen;
}

function screenCopy(project: Project, screenUid: string): { project: Project; screen: ProjectScreen } | null {
  const at = project.screens.findIndex((item) => item.uid === screenUid);
  if (at < 0) return null;
  const screen = clone(project.screens[at]);
  const screens = project.screens.slice();
  screens[at] = screen;
  return { project: { ...project, screens }, screen };
}

/** Lista (botones o textos) a la que apunta la selección actual del proyecto. */
function selectedList(project: Project, screen: ProjectScreen): any[] {
  return zoneElements(screen.compact, project.selectedZone ?? 'Body', project.selectedKind ?? 'button');
}

// El historial guarda referencias: todos los cambios crean un proyecto nuevo antes de
// modificar, así las imágenes en base64 se comparten entre pasos en vez de duplicarse.
function pushHistory(state: EditorState, project: Project): Pick<EditorState, 'history' | 'future'> {
  return {
    history: [...state.history, project].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  previewProject: null,
  clipboardButton: null,
  history: [],
  future: [],
  view: 'editor',
  scale: 0.9,
  snap: true,
  showGrid: true,
  message: null,
  templateOpen: false,
  productsOpen: false,

  setView: (view) => set({ view }),
  setScale: (scale) => set({ scale: Math.min(1.4, Math.max(0.4, scale)) }),
  toggleSnap: () => set((state) => ({ snap: !state.snap })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setMessage: (message) => set({ message }),
  setTemplateOpen: (templateOpen) => set({ templateOpen }),
  setProductsOpen: (productsOpen) => set({ productsOpen }),

  newProject: (profileId = '1280') =>
    set({
      project: createProject(undefined, profileId),
      previewProject: null,
      history: [],
      future: [],
      view: 'editor',
      message: `Proyecto ${profileForId(profileId).short} creado.`,
    }),

  previewProfile: (profileId) => {
    const source = get().project;
    if (!source) return;
    if (profileForProject(source).id === profileId) {
      set({ previewProject: null, message: 'Vista previa cancelada.' });
      return;
    }
    if (profileForProject(source).cajaOnly || profileForId(profileId).cajaOnly) {
      set({ message: 'El plano 1024 × 768 se edita tal cual; no se convierte a otros planos.' });
      return;
    }
    const previewProject = convertProjectProfile(source, profileId);
    set({
      previewProject,
      view: 'caja',
      message: `Vista previa ${profileForId(profileId).short}; aún no está aplicada.`,
    });
  },

  applyPreview: () => {
    const state = get();
    if (!state.project || !state.previewProject) return;
    set({
      ...pushHistory(state, state.project),
      project: state.previewProject,
      previewProject: null,
      view: 'caja',
      message: 'Diseño convertido al nuevo plano.',
    });
  },

  cancelPreview: () => {
    if (!get().previewProject) return;
    set({ previewProject: null, view: 'editor', message: 'Vista previa cancelada.' });
  },

  importText: (text, fileName) =>
    set((state) => {
      try {
        const project = importProjectText(text, fileName);
        return {
          project,
          previewProject: null,
          history: [],
          future: [],
          view: 'editor',
          message: `Importado: ${project.screens.length} pantallas · plano ${profileForProject(project).label}.`,
        };
      } catch (error) {
        return { ...state, message: error instanceof Error ? error.message : 'No se pudo importar.' };
      }
    }),

  saveLocal: () => {
    const project = get().project;
    if (!project) return;
    try {
      saveLocalProject(project);
      set({ message: `Guardado localmente en este navegador (${profileForProject(project).id}).` });
    } catch (error) {
      set({ message: `No se pudo guardar: ${localStorageFailureMessage(error)}.` });
    }
  },

  projectFromLocal: () => loadLocalProject(),

  loadLocal: () => {
    const project = get().projectFromLocal();
    if (!project) {
      set({ message: 'No hay proyecto guardado.' });
      return;
    }
    set({
      project,
      previewProject: null,
      history: [],
      future: [],
      view: 'editor',
      message: 'Proyecto recuperado.',
    });
  },

  setName: (name) =>
    set((state) => {
      if (!state.project) return state;
      const project = clone(state.project);
      project.name = name;
      return { project };
    }),

  importProducts: (rows) => {
    const project = get().project;
    if (!project) return;
    const products = parseProducts(rows as unknown[][]);
    const historyPatch = pushHistory(get(), project);
    set({
      ...historyPatch,
      project: { ...project, products },
      message: products.length
        ? `Productos importados: ${products.length}.`
        : 'No encontré productos en el archivo.',
    });
  },

  selectScreen: (screenUid) =>
    set((state) => {
      if (state.previewProject) {
        return {
          previewProject: {
            ...state.previewProject,
            selectedScreenUid: screenUid,
            selectedButtonIndex: null,
            selectedZone: 'Body',
            selectedKind: 'button',
          },
        };
      }
      if (!state.project) return state;
      const project: Project = {
        ...state.project,
        selectedScreenUid: screenUid,
        selectedButtonIndex: null,
        selectedZone: 'Body',
        selectedKind: 'button',
      };
      return { project };
    }),

  selectButton: (index, zone, kind) =>
    set((state) => {
      const target = state.previewProject ?? state.project;
      if (!target) return state;
      // Sin zona explícita se conserva la actual; al deseleccionar se vuelve al cuerpo.
      const selection = {
        selectedButtonIndex: index,
        selectedZone: index === null ? 'Body' as ZoneId : zone ?? target.selectedZone ?? 'Body',
        selectedKind: index === null ? 'button' as ElementKind : kind ?? (zone ? 'button' : target.selectedKind ?? 'button'),
      };
      if (state.previewProject) return { previewProject: { ...state.previewProject, ...selection } };
      return { project: { ...target, ...selection } };
    }),

  beginTransaction: () => {
    nudgeSession = null;
    set((state) => {
      if (!state.project) return state;
      return pushHistory(state, state.project);
    });
  },

  nudgeButton: (screenUid, index, dx, dy) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const copy = screenCopy(project, screenUid);
      if (!copy) return state;
      const button = selectedList(project, copy.screen)[index];
      if (!button) return state;
      const key = `${screenUid}:${project.selectedZone ?? 'Body'}:${project.selectedKind ?? 'button'}:${index}`;
      const now = Date.now();
      const historyPatch =
        nudgeSession && nudgeSession.key === key && now - nudgeSession.at <= NUDGE_WINDOW_MS
          ? {}
          : pushHistory(state, project);
      nudgeSession = { key, at: now };
      button.X = Number(button.X) + dx;
      button.Y = Number(button.Y) + dy;
      return {
        ...historyPatch,
        project: { ...copy.project, selectedScreenUid: screenUid, selectedButtonIndex: index },
      };
    }),

  updateButton: (screenUid, index, patch, record = false) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const copy = screenCopy(project, screenUid);
      if (!copy) return state;
      const button = selectedList(project, copy.screen)[index];
      if (!button) return state;
      const historyPatch = record ? pushHistory(state, project) : {};
      if (project.selectedKind === 'text') {
        // Un texto de zona es plano: Text, Color, BackColor, TextAlign y Font viven en la raíz.
        if (patch.Text) {
          const { Text, Color, BackColor, TextAlign, Font } = patch.Text;
          if (typeof Text === 'string') button.Text = Text;
          if (typeof Color === 'string') button.Color = Color;
          if (typeof BackColor === 'string') button.BackColor = BackColor;
          if (typeof TextAlign === 'string') button.TextAlign = TextAlign;
          if (Font) button.Font = { ...button.Font, ...Font };
        }
      } else {
        if (patch.Text) button.Text = { ...button.Text, ...patch.Text };
        if (patch.Icon) button.Icon = { ...button.Icon, ...patch.Icon };
        if (patch.Actions) button.Actions = patch.Actions;
      }
      if (typeof patch.X === 'number') button.X = patch.X;
      if (typeof patch.Y === 'number') button.Y = patch.Y;
      if (typeof patch.Width === 'number') button.Width = patch.Width;
      if (typeof patch.Height === 'number') button.Height = patch.Height;
      return {
        ...historyPatch,
        project: { ...copy.project, selectedScreenUid: screenUid, selectedButtonIndex: index },
      };
    }),

  updateZone: (screenUid, zone, patch, record = false) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const copy = screenCopy(project, screenUid);
      if (!copy) return state;
      const historyPatch = record ? pushHistory(state, project) : {};
      const compact = copy.screen.compact;
      if (typeof patch.BackColor === 'string') compact[zone].BackColor = patch.BackColor;
      if (typeof patch.Height === 'number' && Number.isFinite(patch.Height) && zone !== 'Body') {
        // El alto total de la pantalla se conserva: lo que gana una zona lo cede el cuerpo.
        const previous = Number(compact[zone].Height) || 0;
        const bodyHeight = Number(compact.Body.Height) || 0;
        const next = Math.max(0, Math.min(patch.Height, previous + bodyHeight - 20));
        compact[zone].Height = next;
        compact.Body.Height = Math.round((bodyHeight - (next - previous)) * 100) / 100;
      }
      return { ...historyPatch, project: copy.project };
    }),

  addZoneElement: (zone, kind) => {
    const project = get().project;
    if (!project?.selectedScreenUid || get().previewProject) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === project.selectedScreenUid);
    if (!screen) return;
    const zoneData = screen.compact[zone];
    if (zone !== 'Body' && !(Number(zoneData.Height) > 0)) {
      const height = 70;
      zoneData.Height = height;
      screen.compact.Body.Height = Math.max(20, Number(screen.compact.Body.Height) - height);
    }
    const zoneHeight = Math.max(20, Number(zoneData.Height) || 70);
    const list = zoneElements(screen.compact, zone, kind);
    if (kind === 'text') {
      list.push(makeZoneText(screen.compact.Id.toUpperCase(), { Height: Math.min(60, zoneHeight) }));
    } else {
      const side = zone === 'Body' ? 100 : Math.min(60, zoneHeight);
      list.push(
        makeButton('', {
          X: 8 + (list.length % 5) * 12,
          Y: 0,
          Width: zone === 'Body' ? side : 43.2,
          Height: side,
        }),
      );
    }
    next.selectedZone = zone;
    next.selectedKind = kind;
    next.selectedButtonIndex = list.length - 1;
    set({
      ...pushHistory(get(), project),
      project: next,
      message: kind === 'text' ? 'Texto agregado.' : 'Botón agregado.',
    });
  },

  updateScreen: (screenUid, patch, record = false) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const copy = screenCopy(project, screenUid);
      if (!copy) return state;
      const historyPatch = record ? pushHistory(state, project) : {};
      if (typeof patch.Index === 'number') copy.screen.compact.Index = patch.Index;
      if (typeof patch.Id === 'string') copy.screen.compact.Id = patch.Id;
      return { ...historyPatch, project: copy.project };
    }),

  applyProjectChange: (next, options = {}) =>
    set((state) => {
      if (!state.project || state.previewProject) return state;
      const project = clone(next);
      const selectedScreenUid =
        options.selectedScreenUid ??
        project.screens.find((screen) => screen.uid === project.selectedScreenUid)?.uid ??
        project.screens[0]?.uid ??
        null;
      const selectedScreen = project.screens.find((screen) => screen.uid === selectedScreenUid);
      const requestedIndex = options.selectedButtonIndex;
      const selectedButtonIndex =
        requestedIndex === null
          ? null
          : typeof requestedIndex === 'number' && selectedScreen
            ? Math.max(0, Math.min(requestedIndex, selectedScreen.compact.Body.Buttons.length - 1))
            : selectedScreen
              ? 0
              : null;
      project.selectedScreenUid = selectedScreenUid;
      project.selectedButtonIndex = selectedButtonIndex;
      project.selectedZone = 'Body';
      project.selectedKind = 'button';
      return {
        ...pushHistory(state, state.project),
        project,
        previewProject: null,
        view: 'editor',
        message: options.message ?? 'Cambios aplicados.',
      };
    }),

  addScreen: (template, title) => {
    const project = get().project;
    if (!project) return;
    const index = nextScreenIndex(project);
    const compact = makeScreenFromTemplate(
      template,
      index,
      title || `PANTALLA ${index}`,
      profileForProject(project),
    );
    const screen: ProjectScreen = { uid: uid('screen'), compact };
    const next = clone(project);
    next.screens.push(screen);
    next.selectedScreenUid = screen.uid;
    next.selectedButtonIndex = compact.Body.Buttons.length ? 0 : null;
    next.selectedZone = 'Body';
    next.selectedKind = 'button';
    set({ ...pushHistory(get(), project), project: next, templateOpen: false, message: `Pantalla ${index} creada.` });
  },

  duplicateScreen: (screenUid) => {
    const project = get().project;
    if (!project) return;
    const source = screenOf(project, screenUid);
    const index = nextScreenIndex(project);
    const compact = clone(source.compact);
    compact.Index = index;
    compact.Id = `${source.compact.Id}_${index}`;
    const screen: ProjectScreen = {
      uid: uid('screen'),
      compact,
      webRaw: source.webRaw ? clone(source.webRaw) : undefined,
    };
    if (screen.webRaw) {
      screen.webRaw.Index = index;
      screen.webRaw.Id = compact.Id;
    }
    const next = clone(project);
    const at = next.screens.findIndex((item) => item.uid === screenUid);
    next.screens.splice(at + 1, 0, screen);
    next.selectedScreenUid = screen.uid;
    next.selectedButtonIndex = null;
    next.selectedZone = 'Body';
    next.selectedKind = 'button';
    set({ ...pushHistory(get(), project), project: next, message: 'Pantalla duplicada.' });
  },

  deleteScreen: (screenUid) => {
    const project = get().project;
    if (!project) return;
    if (project.screens.length <= 1) {
      set({ message: 'Debe existir al menos una pantalla.' });
      return;
    }
    const next = clone(project);
    const at = next.screens.findIndex((item) => item.uid === screenUid);
    next.screens.splice(at, 1);
    next.selectedScreenUid = next.screens[Math.max(0, at - 1)]?.uid ?? null;
    next.selectedButtonIndex = null;
    next.selectedZone = 'Body';
    next.selectedKind = 'button';
    set({ ...pushHistory(get(), project), project: next, message: 'Pantalla eliminada.' });
  },

  moveScreen: (screenUid, direction) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const at = next.screens.findIndex((item) => item.uid === screenUid);
    const to = at + direction;
    if (at < 0 || to < 0 || to >= next.screens.length) return;
    const [item] = next.screens.splice(at, 1);
    next.screens.splice(to, 0, item);
    set({ ...pushHistory(get(), project), project: next });
  },

  addButton: () => {
    const project = get().project;
    if (!project?.selectedScreenUid) return;
    const screen = screenOf(project, project.selectedScreenUid);
    const small = Boolean(profileForProject(project).cajaOnly);
    const button = makeButton('NUEVO BOTON', {
      X: 20 + (screen.compact.Body.Buttons.length % 5) * 20,
      Y: (small ? 20 : 118) + (screen.compact.Body.Buttons.length % 5) * 20,
      ...(small ? { Width: 100, Height: 100 } : {}),
    });
    const next = clone(project);
    const nextScreen = next.screens.find((item) => item.uid === project.selectedScreenUid);
    if (!nextScreen) return;
    nextScreen.compact.Body.Buttons.push(button);
    next.selectedButtonIndex = nextScreen.compact.Body.Buttons.length - 1;
    next.selectedZone = 'Body';
    next.selectedKind = 'button';
    set({ ...pushHistory(get(), project), project: next, message: 'Botón agregado.' });
  },

  duplicateButton: (screenUid, index) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    const list = selectedList(next, screen);
    const source = list[index];
    if (!source) return;
    const button = clone(source);
    button.X += 10;
    if (next.selectedZone === undefined || next.selectedZone === 'Body') button.Y += 10;
    list.splice(index + 1, 0, button);
    next.selectedButtonIndex = index + 1;
    set({ ...pushHistory(get(), project), project: next, message: 'Botón duplicado.' });
  },

  copyButton: (screenUid, index) => {
    const project = get().project;
    if (!project || get().previewProject) return;
    const screen = project.screens.find((item) => item.uid === screenUid);
    if (project.selectedKind === 'text') {
      set({ message: 'Los textos del encabezado se duplican con Ctrl+D.' });
      return;
    }
    const source = screen ? selectedList(project, screen)[index] : undefined;
    if (!source) return;
    set({
      clipboardButton: clone(source),
      message: `Botón copiado: ${source.Text.Text || 'sin texto'}.`,
    });
  },

  pasteButton: (screenUid) => {
    const state = get();
    if (!state.project || state.previewProject || !state.clipboardButton) return;
    const next = clone(state.project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    const button = clone(state.clipboardButton);
    delete button.__index;
    button.X = Number(button.X) + 10;
    button.Y = Number(button.Y) + 10;
    // Se pega en la zona seleccionada (cuerpo por defecto); los textos no admiten botones.
    const zone: ZoneId = next.selectedZone ?? 'Body';
    const list = zoneElements(screen.compact, zone, 'button');
    const selected =
      next.selectedScreenUid === screenUid && next.selectedKind !== 'text' ? next.selectedButtonIndex : null;
    const at = selected === null || selected === undefined ? list.length : Math.min(selected + 1, list.length);
    list.splice(at, 0, button);
    next.selectedZone = zone;
    next.selectedKind = 'button';
    next.selectedScreenUid = screenUid;
    next.selectedButtonIndex = at;
    set({ ...pushHistory(state, state.project), project: next, message: 'Botón pegado.' });
  },

  deleteButton: (screenUid, index) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    selectedList(next, screen).splice(index, 1);
    next.selectedButtonIndex = null;
    next.selectedZone = 'Body';
    next.selectedKind = 'button';
    set({ ...pushHistory(get(), project), project: next, message: 'Botón eliminado.' });
  },

  moveButtonLayer: (screenUid, index, direction) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    const buttons = selectedList(next, screen);
    const to = index + direction;
    if (index < 0 || to < 0 || to >= buttons.length) return;
    const [button] = buttons.splice(index, 1);
    buttons.splice(to, 0, button);
    next.selectedButtonIndex = to;
    set({ ...pushHistory(get(), project), project: next });
  },

  undo: () => {
    nudgeSession = null;
    set((state) => {
      if (!state.project || !state.history.length || state.previewProject) return state;
      const previous = state.history[state.history.length - 1];
      return {
        project: previous,
        history: state.history.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
      };
    });
  },

  redo: () => {
    nudgeSession = null;
    set((state) => {
      if (!state.project || !state.future.length || state.previewProject) return state;
      const next = state.future[0];
      return {
        project: next,
        history: [...state.history, state.project].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    });
  },

  exportWeb: () => {
    if (get().previewProject) {
      set({ message: 'Convierte la vista previa antes de exportar.' });
      return;
    }
    const project = get().project;
    if (!project) return;
    if (profileForProject(project).cajaOnly) {
      set({ message: 'El plano 1024 × 768 solo se exporta como Caja.' });
      return;
    }
    downloadJson(webFromProject(project), exportFileName(project, 'web'));
    set({ message: 'Web exportado. Impórtalo en Point y verifica la Caja resultante.' });
  },

  exportCaja: () => {
    if (get().previewProject) {
      set({ message: 'Convierte la vista previa antes de exportar.' });
      return;
    }
    const project = get().project;
    if (!project) return;
    downloadJson(cajaFromProject(project), exportFileName(project, 'caja'));
    set({ message: 'Caja exportada.' });
  },
}));

export type { Product };
