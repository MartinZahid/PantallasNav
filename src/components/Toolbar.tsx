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
  { id: 'caja', label: 'Caja 1280' },
  { id: 'portal', label: 'Portal' },
  { id: 'validate', label: 'Validación' },
];

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
    if (window.confirm(`?Crear un proyecto ${target === '1080' ? '1080' : '1280'} nuevo y descartar el actual?`)) {
      newProject(target);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-title">Editor de Pantallas</div>
            <div className="brand-sub">Caja {profile.label} - Point POS</div>
          </div>
        </div>
        <div className="project-name">
          <span>Diseño</span>
          <input value={project?.name ?? ''} disabled={isPreview} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="top-actions">
          <select
            className="profile-select"
            value={profile.id}
            disabled={!project}
            title="Cambiar el plano del proyecto (vista previa)"
            onChange={(event) => previewProfile(event.target.value as ProfileId)}
          >
            <option value="1280">Plano 1280 - {PROFILES['1280'].visibleWidth}x{PROFILES['1280'].visibleHeight}</option>
            <option value="1080">Plano 1080 - {PROFILES['1080'].visibleWidth}x{PROFILES['1080'].visibleHeight}</option>
          </select>
          <button type="button" className="ghost-button" onClick={createNewProject}>Nuevo</button>
          <button type="button" className="ghost-button" onClick={() => webInput.current?.click()}>Importar Web</button>
          <button type="button" className="ghost-button" onClick={() => cajaInput.current?.click()}>Importar Caja</button>
          <span className="divider" />
          <button type="button" className="ghost-button" onClick={exportWeb} disabled={isPreview}>Exportar Web</button>
          <button type="button" className="primary-button" onClick={exportCaja} disabled={isPreview}>Exportar Caja</button>
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
              {tab.id === 'caja' ? `Caja ${profile.short}` : tab.label}
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
      {isPreview ? (
        <div className="preview-bar">
          <span>
            <strong>Vista previa {profile.label}</strong> ? todav?a no est? aplicada.
          </span>
          <button type="button" className="primary-button" onClick={() => { if (window.confirm('?Convertir el dise?o al plano seleccionado? Se reacomodar?n todas las pantallas.')) applyPreview(); }}>Convertir dise?o</button>
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
