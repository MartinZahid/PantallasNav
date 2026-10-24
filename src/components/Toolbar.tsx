import { useRef } from 'react';
import type { ViewMode } from '../types';
import { useEditor } from '../store';

function readFile(file: File, callback: (text: string, name: string) => void) {
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result ?? ''), file.name);
  reader.readAsText(file);
}

const TABS: { id: ViewMode; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'caja', label: 'Caja 1280' },
  { id: 'portal', label: 'Portal' },
  { id: 'validate', label: 'Validación' },
];

export function Toolbar() {
  const project = useEditor((state) => state.project);
  const view = useEditor((state) => state.view);
  const scale = useEditor((state) => state.scale);
  const snap = useEditor((state) => state.snap);
  const showGrid = useEditor((state) => state.showGrid);
  const message = useEditor((state) => state.message);
  const setName = useEditor((state) => state.setName);
  const setView = useEditor((state) => state.setView);
  const setScale = useEditor((state) => state.setScale);
  const toggleSnap = useEditor((state) => state.toggleSnap);
  const toggleGrid = useEditor((state) => state.toggleGrid);
  const setMessage = useEditor((state) => state.setMessage);
  const importText = useEditor((state) => state.importText);
  const newProject = useEditor((state) => state.newProject);
  const saveLocal = useEditor((state) => state.saveLocal);
  const loadLocal = useEditor((state) => state.loadLocal);
  const exportWeb = useEditor((state) => state.exportWeb);
  const exportCaja = useEditor((state) => state.exportCaja);
  const webInput = useRef<HTMLInputElement>(null);
  const cajaInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-title">Editor de Pantallas</div>
            <div className="brand-sub">Caja 1280 × 1024 · Point POS</div>
          </div>
        </div>
        <div className="project-name">
          <span>Diseño</span>
          <input value={project?.name ?? ''} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="top-actions">
          <button type="button" className="ghost-button" onClick={() => { if (window.confirm('¿Crear un proyecto nuevo y descartar el actual?')) newProject(); }}>Nuevo</button>
          <button type="button" className="ghost-button" onClick={() => webInput.current?.click()}>Importar Web</button>
          <button type="button" className="ghost-button" onClick={() => cajaInput.current?.click()}>Importar Caja</button>
          <span className="divider" />
          <button type="button" className="ghost-button" onClick={exportWeb}>Exportar Web</button>
          <button type="button" className="primary-button" onClick={exportCaja}>Exportar Caja</button>
          <button type="button" className="ghost-button" onClick={saveLocal}>Guardar</button>
          <button type="button" className="ghost-button" onClick={loadLocal}>Recuperar</button>
        </div>
        <input
          ref={webInput}
          type="file"
          accept=".pdtd,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file, importText);
            event.target.value = '';
          }}
        />
        <input
          ref={cajaInput}
          type="file"
          accept=".pdtd,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file, importText);
            event.target.value = '';
          }}
        />
      </header>
      <div className="subbar">
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              type="button"
              className={`tab ${view === tab.id ? 'active' : ''}`}
              key={tab.id}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="view-controls">
          <label className="toggle">
            <input type="checkbox" checked={snap} onChange={toggleSnap} />
            <span>Snap 10 px</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
            <span>Cuadrícula</span>
          </label>
          <label className="zoom-control">
            <span>Zoom {Math.round(scale * 100)}%</span>
            <input type="range" min="0.45" max="1.2" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
          </label>
        </div>
      </div>
      {message ? (
        <div className="toast" onClick={() => setMessage(null)}>
          {message} <span>×</span>
        </div>
      ) : null}
    </>
  );
}
