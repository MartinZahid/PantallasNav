import { useRef } from 'react';
import type { ProfileId, ViewMode } from '../types';
import { useEditor } from '../store';
import { PROFILES, profileForProject } from '../lib/profiles';

function readFile(file: File, callback: (text: string, name: string) => void) {
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result ?? ''), file.name);
  reader.readAsText(file);
}

const TABS: { id: ViewMode; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'caja', label: 'Caja' },
  { id: 'portal', label: 'Portal' },
  { id: 'validate', label: 'Validación' },
];

function Icon({ name }: { name: 'new' | 'import' | 'export' | 'restore' }) {
  if (name === 'new') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M12 11v6M9 14h6" />
      </svg>
    );
  }
  if (name === 'restore') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5v6h6" />
        <path d="M5.6 15a7 7 0 1 0 1.2-7.4L4 11" />
      </svg>
    );
  }
  const up = name === 'export';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11" />
      <path d={up ? 'M8 7l4-4 4 4' : 'M8 10l4 4 4-4'} />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

export function Toolbar() {
  const project = useEditor((state) => state.project);
  const previewProject = useEditor((state) => state.previewProject);
  const displayProject = previewProject ?? project;
  const profile = profileForProject(displayProject);
  const isPreview = Boolean(previewProject);
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
  const previewProfile = useEditor((state) => state.previewProfile);
  const applyPreview = useEditor((state) => state.applyPreview);
  const cancelPreview = useEditor((state) => state.cancelPreview);
  const saveLocal = useEditor((state) => state.saveLocal);
  const loadLocal = useEditor((state) => state.loadLocal);
  const exportWeb = useEditor((state) => state.exportWeb);
  const exportCaja = useEditor((state) => state.exportCaja);
  const webInput = useRef<HTMLInputElement>(null);
  const cajaInput = useRef<HTMLInputElement>(null);

  const createNewProject = () => {
    const target = profile.id;
    if (window.confirm(`¿Crear un proyecto ${target === '1080' ? '1080' : '1280'} nuevo y descartar el actual?`)) {
      newProject(target);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">Editor de pantallas</div>
        <div className="project-field">
          <input
            className="project-name-input"
            value={project?.name ?? ''}
            disabled={isPreview}
            placeholder="Nombre del proyecto"
            title="Nombre del proyecto"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </header>

      <div className="editor-header">
        <div className="editor-title-row">
          <h1>Editor</h1>
          <span className="editor-subtitle">
            Plano {profile.label} · {profile.visibleWidth} x {profile.visibleHeight} px
          </span>
        </div>
        <div className="editor-toolbar">
          <div className="tool-group">
            <button type="button" className="tool-icon" title="Nuevo proyecto" onClick={createNewProject}>
              <Icon name="new" />
            </button>
            <button type="button" className="tool-icon" title="Importar archivo Web" onClick={() => webInput.current?.click()}>
              <Icon name="import" />
            </button>
            <button type="button" className="tool-icon" title="Importar archivo Caja" onClick={() => cajaInput.current?.click()}>
              <Icon name="import" />
            </button>
            <button type="button" className="tool-icon" title="Recuperar guardado local" onClick={loadLocal}>
              <Icon name="restore" />
            </button>
          </div>

          <div className="tool-group">
            <button type="button" className="ghost-button compact" onClick={exportWeb} disabled={isPreview} title="Descargar archivo Web">
              <Icon name="export" /> Web
            </button>
            <button type="button" className="ghost-button compact" onClick={exportCaja} disabled={isPreview} title="Descargar archivo Caja">
              <Icon name="export" /> Caja
            </button>
          </div>

          <button type="button" className="primary-button" onClick={saveLocal}>
            Guardar Todo
          </button>

          <div className="radio-group" role="radiogroup" aria-label="Plano de trabajo">
            <label className={`radio-option ${profile.id === '1280' ? 'checked' : ''}`} title={`${PROFILES['1280'].visibleWidth}x${PROFILES['1280'].visibleHeight}`}>
              <input
                type="radio"
                name="profile"
                checked={profile.id === '1280'}
                onChange={() => previewProfile('1280' as ProfileId)}
              />
              <span>1280</span>
            </label>
            <label className={`radio-option ${profile.id === '1080' ? 'checked' : ''}`} title={`${PROFILES['1080'].visibleWidth}x${PROFILES['1080'].visibleHeight}`}>
              <input
                type="radio"
                name="profile"
                checked={profile.id === '1080'}
                onChange={() => previewProfile('1080' as ProfileId)}
              />
              <span>1080</span>
            </label>
          </div>

          <div className="tabs view-tabs">
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
              <span>{Math.round(scale * 100)}%</span>
              <input type="range" min="0.45" max="1.2" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
            </label>
          </div>
        </div>
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

      {isPreview ? (
        <div className="preview-bar">
          <span>
            <strong>Vista previa {profile.label}</strong> — todavía no está aplicada.
          </span>
          <button type="button" className="primary-button" onClick={() => { if (window.confirm('¿Convertir el diseño al plano seleccionado? Se reacomodarán todas las pantallas.')) applyPreview(); }}>Convertir diseño</button>
          <button type="button" className="ghost-button" onClick={cancelPreview}>Cancelar</button>
        </div>
      ) : null}
      {message ? (
        <div className="toast" onClick={() => setMessage(null)}>
          {message} <span>×</span>
        </div>
      ) : null}
    </>
  );
}
