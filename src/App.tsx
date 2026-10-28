import { useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { ScreenList } from './components/ScreenList';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Toolbar } from './components/Toolbar';
import { TemplatesModal, ProductsModal } from './components/Modals';
import { ValidationPanel } from './components/ValidationPanel';
import { AiAssistant } from './components/AiAssistant';
import { useEditor } from './store';
import { profileForProject } from './lib/profiles';
import { localStorageFailureMessage, saveLocalProject } from './lib/storage';
import './App.css';

function App() {
  const project = useEditor((state) => state.project);
  const previewProject = useEditor((state) => state.previewProject);
  const displayProject = previewProject ?? project;
  const profile = profileForProject(displayProject);
  const view = useEditor((state) => state.view);
  const newProject = useEditor((state) => state.newProject);
  const projectFromLocal = useEditor((state) => state.projectFromLocal);

  useEffect(() => {
    const saved = projectFromLocal();
    if (saved) {
      useEditor.setState({
        project: saved,
        view: 'editor',
        history: [],
        future: [],
        message: 'Proyecto recuperado automáticamente.',
      });
    } else {
      newProject();
    }
  }, [newProject, projectFromLocal]);

  useEffect(() => {
    if (!project) return;
    const timeout = window.setTimeout(() => {
      try {
        saveLocalProject(project);
      } catch (error) {
        useEditor
          .getState()
          .setMessage(`No se pudo guardar automáticamente: ${localStorageFailureMessage(error)}.`);
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [project]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
      const modal = Boolean(document.querySelector('.modal-backdrop'));
      if (modal) return;
      const state = useEditor.getState();
      if (state.previewProject) return;
      const currentProject = state.project;
      if (!currentProject?.selectedScreenUid) return;
      const screen = currentProject.screens.find((item) => item.uid === currentProject.selectedScreenUid);
      if (!screen) return;
      const index = currentProject.selectedButtonIndex;
      const command = event.ctrlKey || event.metaKey;

      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (command && event.key.toLowerCase() === 's') {
        event.preventDefault();
        state.saveLocal();
        return;
      }
      if (editing) return;
      if (command && event.key.toLowerCase() === 'c' && index !== null) {
        event.preventDefault();
        state.copyButton(screen.uid, index);
        return;
      }
      if (command && event.key.toLowerCase() === 'v' && state.clipboardButton) {
        event.preventDefault();
        state.pasteButton(screen.uid);
        return;
      }
      if (command && event.key.toLowerCase() === 'd' && index !== null) {
        event.preventDefault();
        state.duplicateButton(screen.uid, index);
        return;
      }
      if (event.key === 'Delete' && index !== null) {
        event.preventDefault();
        state.deleteButton(screen.uid, index);
        return;
      }
      if (event.key === 'Escape') {
        state.selectButton(null);
        return;
      }
      if (index !== null && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        state.nudgeButton(screen.uid, index, dx, dy);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const screen = displayProject?.screens.find((item) => item.uid === displayProject.selectedScreenUid);
  const button = screen && displayProject?.selectedButtonIndex !== null && displayProject?.selectedButtonIndex !== undefined
    ? screen.compact.Body.Buttons[displayProject.selectedButtonIndex]
    : null;

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="main-layout">
        <ScreenList />
        <main className="stage-area">
          {view === 'validate' ? <ValidationPanel /> : <Canvas mode={view === 'caja' ? 'caja' : view === 'portal' ? 'portal' : 'editor'} />}
        </main>
        {view !== 'validate' && !previewProject ? <PropertiesPanel /> : null}
      </div>
      <footer className="statusbar">
        <span className="status-mode">{view === 'editor' ? 'Editor' : view === 'caja' ? `Caja ${profile.short}` : view === 'portal' ? 'Portal (diagnóstico)' : 'Validación'}</span>
        <span>{screen ? `Pantalla ${String(screen.compact.Index).padStart(2, '0')} · ${screen.compact.Id}` : 'Sin pantalla'}</span>
        <span>{button ? `Botón ${(displayProject?.selectedButtonIndex ?? 0) + 1} · ${button.Text.Text || 'sin texto'}` : 'Sin selección'}</span>
        <span className="status-spacer" />
        <span>{screen?.compact.Body.Buttons.length ?? 0} botones</span>
        <span>{displayProject?.products.length ?? 0} productos</span>
        <span className="status-help">Ctrl+Z / Ctrl+C / Ctrl+V / Ctrl+D / Supr · Arrastra y suelta las esquinas</span>
      </footer>
      <TemplatesModal />
      <ProductsModal />
      <AiAssistant />
    </div>
  );
}

export default App;
