import { create } from 'zustand';
import type { PdtdButton, Product, Project, ProjectScreen, ViewMode } from './types';
import {
  clone,
  createProject,
  cajaFromProject,
  downloadJson,
  exportFileName,
  importProjectText,
  makeButton,
  makeScreenFromTemplate,
  nextScreenIndex,
  parseProducts,
  type TemplateId,
  uid,
  webFromProject,
} from './lib/pdtd';

interface EditorState {
  project: Project | null;
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
  newProject: () => void;
  importText: (text: string, fileName: string) => void;
  loadLocal: () => void;
  saveLocal: () => void;
  importProducts: (rows: unknown[][]) => void;
  setName: (name: string) => void;
  selectScreen: (screenUid: string) => void;
  selectButton: (index: number | null) => void;
  updateButton: (screenUid: string, index: number, patch: Partial<PdtdButton>, record?: boolean) => void;
  updateScreen: (screenUid: string, patch: { Id?: string; Index?: number }, record?: boolean) => void;
  updateBody: (screenUid: string, patch: { BackColor?: string }, record?: boolean) => void;
  addScreen: (template: TemplateId, title: string) => void;
  duplicateScreen: (screenUid: string) => void;
  deleteScreen: (screenUid: string) => void;
  moveScreen: (screenUid: string, direction: -1 | 1) => void;
  addButton: () => void;
  duplicateButton: (screenUid: string, index: number) => void;
  deleteButton: (screenUid: string, index: number) => void;
  moveButtonLayer: (screenUid: string, index: number, direction: -1 | 1) => void;
  beginTransaction: () => void;
  undo: () => void;
  redo: () => void;
  exportWeb: () => void;
  exportCaja: () => void;
  projectFromLocal: () => Project | null;
}

const HISTORY_LIMIT = 60;
const LOCAL_KEY = 'editor-pantallas-1280-project-v1';

function screenOf(project: Project, screenUid: string): ProjectScreen {
  const screen = project.screens.find((item) => item.uid === screenUid);
  if (!screen) throw new Error('Pantalla no encontrada.');
  return screen;
}

function pushHistory(state: EditorState, project: Project): Pick<EditorState, 'history' | 'future'> {
  return {
    history: [...state.history, clone(project)].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
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

  newProject: () =>
    set({
      project: createProject(),
      history: [],
      future: [],
      view: 'editor',
      message: 'Proyecto nuevo creado.',
    }),

  importText: (text, fileName) =>
    set((state) => {
      try {
        const project = importProjectText(text, fileName);
        return {
          project,
          history: [],
          future: [],
          view: 'editor',
          message: `Importado: ${project.screens.length} pantallas.`,
        };
      } catch (error) {
        return { ...state, message: error instanceof Error ? error.message : 'No se pudo importar.' };
      }
    }),

  saveLocal: () => {
    const project = get().project;
    if (!project) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(project));
      set({ message: 'Guardado localmente en este navegador.' });
    } catch {
      set({ message: 'No se pudo guardar: el proyecto es demasiado grande.' });
    }
  },

  projectFromLocal: () => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const project = JSON.parse(raw) as Project;
      return project;
    } catch {
      return null;
    }
  },

  loadLocal: () => {
    const project = get().projectFromLocal();
    if (!project) {
      set({ message: 'No hay proyecto guardado.' });
      return;
    }
    set({
      project,
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
      if (!state.project) return state;
      const project = { ...state.project, selectedScreenUid: screenUid, selectedButtonIndex: null };
      return { project };
    }),

  selectButton: (index) =>
    set((state) => {
      if (!state.project) return state;
      return { project: { ...state.project, selectedButtonIndex: index } };
    }),

  beginTransaction: () =>
    set((state) => {
      if (!state.project) return state;
      return pushHistory(state, state.project);
    }),

  updateButton: (screenUid, index, patch, record = false) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const screen = screenOf(project, screenUid);
      const button = screen.compact.Body.Buttons[index];
      if (!button) return state;
      const historyPatch = record ? pushHistory(state, project) : {};
      if (patch.Text) button.Text = { ...button.Text, ...patch.Text };
      if (patch.Icon) button.Icon = { ...button.Icon, ...patch.Icon };
      if (patch.Actions) button.Actions = patch.Actions;
      if (typeof patch.X === 'number') button.X = patch.X;
      if (typeof patch.Y === 'number') button.Y = patch.Y;
      if (typeof patch.Width === 'number') button.Width = patch.Width;
      if (typeof patch.Height === 'number') button.Height = patch.Height;
      return {
        ...historyPatch,
        project: { ...project, selectedScreenUid: screenUid, selectedButtonIndex: index },
      };
    }),

  updateScreen: (screenUid, patch, record = false) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const screen = screenOf(project, screenUid);
      const historyPatch = record ? pushHistory(state, project) : {};
      if (typeof patch.Index === 'number') screen.compact.Index = patch.Index;
      if (typeof patch.Id === 'string') screen.compact.Id = patch.Id;
      return { ...historyPatch, project: { ...project } };
    }),

  updateBody: (screenUid, patch, record = false) =>
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const screen = screenOf(project, screenUid);
      const historyPatch = record ? pushHistory(state, project) : {};
      if (typeof patch.BackColor === 'string') screen.compact.Body.BackColor = patch.BackColor;
      return { ...historyPatch, project: { ...project } };
    }),

  addScreen: (template, title) => {
    const project = get().project;
    if (!project) return;
    const index = nextScreenIndex(project);
    const compact = makeScreenFromTemplate(template, index, title || `PANTALLA ${index}`);
    const screen: ProjectScreen = { uid: uid('screen'), compact };
    const next = clone(project);
    next.screens.push(screen);
    next.selectedScreenUid = screen.uid;
    next.selectedButtonIndex = 0;
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
    const button = makeButton('NUEVO BOTON', {
      X: 20 + (screen.compact.Body.Buttons.length % 5) * 20,
      Y: 118 + (screen.compact.Body.Buttons.length % 5) * 20,
    });
    const next = clone(project);
    const nextScreen = next.screens.find((item) => item.uid === project.selectedScreenUid);
    if (!nextScreen) return;
    nextScreen.compact.Body.Buttons.push(button);
    next.selectedButtonIndex = nextScreen.compact.Body.Buttons.length - 1;
    set({ ...pushHistory(get(), project), project: next, message: 'Bot?n agregado.' });
  },

  duplicateButton: (screenUid, index) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    const source = screen.compact.Body.Buttons[index];
    if (!source) return;
    const button = clone(source);
    button.__uid = uid('button');
    button.X += 10;
    button.Y += 10;
    screen.compact.Body.Buttons.splice(index + 1, 0, button);
    next.selectedButtonIndex = index + 1;
    set({ ...pushHistory(get(), project), project: next, message: 'Bot?n duplicado.' });
  },

  deleteButton: (screenUid, index) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    screen.compact.Body.Buttons.splice(index, 1);
    next.selectedButtonIndex = null;
    set({ ...pushHistory(get(), project), project: next, message: 'Bot?n eliminado.' });
  },

  moveButtonLayer: (screenUid, index, direction) => {
    const project = get().project;
    if (!project) return;
    const next = clone(project);
    const screen = next.screens.find((item) => item.uid === screenUid);
    if (!screen) return;
    const buttons = screen.compact.Body.Buttons;
    const to = index + direction;
    if (index < 0 || to < 0 || to >= buttons.length) return;
    const [button] = buttons.splice(index, 1);
    buttons.splice(to, 0, button);
    next.selectedButtonIndex = to;
    set({ ...pushHistory(get(), project), project: next });
  },

  undo: () =>
    set((state) => {
      if (!state.project || !state.history.length) return state;
      const previous = state.history[state.history.length - 1];
      return {
        project: clone(previous),
        history: state.history.slice(0, -1),
        future: [clone(state.project), ...state.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.project || !state.future.length) return state;
      const next = state.future[0];
      return {
        project: clone(next),
        history: [...state.history, clone(state.project)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }),

  exportWeb: () => {
    const project = get().project;
    if (!project) return;
    downloadJson(webFromProject(project), exportFileName(project, 'web'));
    set({ message: 'Web exportado. Impórtalo en Point y verifica la Caja resultante.' });
  },

  exportCaja: () => {
    const project = get().project;
    if (!project) return;
    downloadJson(cajaFromProject(project), exportFileName(project, 'caja'));
    set({ message: 'Caja exportada.' });
  },
}));

export type { Product };
