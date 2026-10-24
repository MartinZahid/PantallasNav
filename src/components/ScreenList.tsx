import { useEditor } from '../store';

export function ScreenList() {
  const project = useEditor((state) => state.project);
  const selectScreen = useEditor((state) => state.selectScreen);
  const setTemplateOpen = useEditor((state) => state.setTemplateOpen);
  const duplicateScreen = useEditor((state) => state.duplicateScreen);
  const deleteScreen = useEditor((state) => state.deleteScreen);
  const moveScreen = useEditor((state) => state.moveScreen);
  const setProductsOpen = useEditor((state) => state.setProductsOpen);
  const setView = useEditor((state) => state.setView);
  if (!project) return null;
  return (
    <aside className="sidebar">
      <div className="panel-heading">
        <span>Pantallas</span>
        <span className="panel-sub">{project.screens.length}</span>
      </div>
      <div className="screen-list">
        {project.screens.map((screen, index) => {
          const selected = project.selectedScreenUid === screen.uid;
          return (
            <div
              key={screen.uid}
              className={`screen-item ${selected ? 'selected' : ''}`}
              onClick={() => {
                selectScreen(screen.uid);
                setView('editor');
              }}
            >
              <div className="screen-number">{String(screen.compact.Index).padStart(2, '0')}</div>
              <div className="screen-meta">
                <strong>{screen.compact.Id}</strong>
                <small>{screen.compact.Body.Buttons.length} botones</small>
              </div>
              <div className="screen-item-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" title="Subir" disabled={index === 0} onClick={() => moveScreen(screen.uid, -1)}>↑</button>
                <button type="button" title="Bajar" disabled={index === project.screens.length - 1} onClick={() => moveScreen(screen.uid, 1)}>↓</button>
                <button type="button" title="Duplicar" onClick={() => duplicateScreen(screen.uid)}>⧉</button>
                <button type="button" title="Eliminar" onClick={() => deleteScreen(screen.uid)}>×</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sidebar-footer">
        <button type="button" className="primary-button" onClick={() => setTemplateOpen(true)}>+ Nueva pantalla</button>
        <button type="button" className="secondary-button" onClick={() => setProductsOpen(true)}>
          Productos {project.products.length ? `(${project.products.length})` : ''}
        </button>
        <div className="muted tiny">Archivo: {project.source === 'web' ? 'Web' : project.source === 'caja' ? 'Caja' : 'Nuevo'} · {project.screens.length} pantallas</div>
      </div>
    </aside>
  );
}
