import { useEditor } from '../store';

export function ScreenList() {
  const project = useEditor((state) => state.project);
  const previewProject = useEditor((state) => state.previewProject);
  const displayProject = previewProject ?? project;
  const preview = Boolean(previewProject);
  const selectScreen = useEditor((state) => state.selectScreen);
  const setTemplateOpen = useEditor((state) => state.setTemplateOpen);
  const duplicateScreen = useEditor((state) => state.duplicateScreen);
  const deleteScreen = useEditor((state) => state.deleteScreen);
  const moveScreen = useEditor((state) => state.moveScreen);
  const setProductsOpen = useEditor((state) => state.setProductsOpen);
  const setView = useEditor((state) => state.setView);
  const view = useEditor((state) => state.view);
  if (!displayProject) return null;
  const shown = displayProject;
  return (
    <aside className="sidebar">
      <div className="panel-heading">
        <span>Drive-Through</span>
        <span className="panel-sub">{shown.screens.length}</span>
      </div>

      <nav className="nav-groups">
        <div className="nav-group">
          <div className="nav-group-title">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M8 21h8M12 18v3" />
              </svg>
            </span>
            Pantallas
            <span className="nav-count">{shown.screens.length}</span>
          </div>
          <div className="nav-sub">
            {shown.screens.map((screen, index) => {
              const selected = shown.selectedScreenUid === screen.uid;
              return (
                <div
                  key={screen.uid}
                  className={`screen-item ${selected ? 'selected' : ''}`}
                  onClick={() => {
                    selectScreen(screen.uid);
                    setView(preview ? 'caja' : 'editor');
                  }}
                >
                  <div className="screen-number">{String(screen.compact.Index).padStart(2, '0')}</div>
                  <div className="screen-meta">
                    <strong>{screen.compact.Id}</strong>
                    <small>{screen.compact.Body.Buttons.length} botones</small>
                  </div>
                  <div className="screen-item-actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" title="Subir" disabled={preview || index === 0} onClick={() => moveScreen(screen.uid, -1)}>↑</button>
                    <button type="button" title="Bajar" disabled={preview || index === shown.screens.length - 1} onClick={() => moveScreen(screen.uid, 1)}>↓</button>
                    <button type="button" title="Duplicar" disabled={preview} onClick={() => duplicateScreen(screen.uid)}>⧉</button>
                    <button type="button" title="Eliminar" disabled={preview} onClick={() => deleteScreen(screen.uid)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-group-title">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            Herramientas
          </div>
          <div className="nav-sub">
            <button type="button" className="nav-link" onClick={() => setProductsOpen(true)}>
              Productos
              <span className="nav-count">{shown.products.length}</span>
            </button>
            <button type="button" className={`nav-link ${view === 'validate' ? 'active' : ''}`} onClick={() => setView('validate')}>
              Validación
            </button>
            <button type="button" className={`nav-link ${view === 'caja' ? 'active' : ''}`} onClick={() => setView('caja')}>
              Vista Caja
            </button>
            <button type="button" className={`nav-link ${view === 'portal' ? 'active' : ''}`} onClick={() => setView('portal')}>
              Vista Portal
            </button>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="primary-button" disabled={preview} onClick={() => setTemplateOpen(true)}>+ Nueva pantalla</button>
        <div className="sidebar-file">
          {shown.source === 'web' ? 'Origen Web' : shown.source === 'caja' ? 'Origen Caja' : 'Proyecto nuevo'} · {shown.screens.length} pantallas
        </div>
      </div>
    </aside>
  );
}
