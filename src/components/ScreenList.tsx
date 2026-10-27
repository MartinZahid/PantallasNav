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
  if (!displayProject) return null;
  const shown = displayProject;
  return (
    <aside className="sidebar">
      <div className="panel-heading">
        <span>Pantallas</span>
        <span className="panel-sub">{shown.screens.length}</span>
      </div>
      <div className="screen-list">
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
      <div className="sidebar-footer">
        <button type="button" className="primary-button" disabled={preview} onClick={() => setTemplateOpen(true)}>+ Nueva pantalla</button>
        <button type="button" className="secondary-button" disabled={preview} onClick={() => setProductsOpen(true)}>
          Productos {shown.products.length ? `(${shown.products.length})` : ''}
        </button>
        <div className="muted tiny">Archivo: {shown.source === 'web' ? 'Web' : shown.source === 'caja' ? 'Caja' : 'Nuevo'} ? {shown.screens.length} pantallas</div>
      </div>
    </aside>
  );
}
