import { useMemo } from 'react';
import { validateProject } from '../lib/pdtd';
import { useEditor } from '../store';

export function ValidationPanel() {
  const project = useEditor((state) => state.project);
  const selectScreen = useEditor((state) => state.selectScreen);
  const selectButton = useEditor((state) => state.selectButton);
  const setView = useEditor((state) => state.setView);
  const issues = useMemo(() => (project ? validateProject(project) : []), [project]);
  if (!project) return null;
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  const openIssue = (screenUid: string, buttonUid?: string) => {
    selectScreen(screenUid);
    selectButton(buttonUid !== undefined ? Number(buttonUid) : null);
    setView('editor');
  };

  return (
    <div className="validation-panel">
      <div className="validation-hero">
        <div>
          <h2>Validación del diseño</h2>
          <p>Revisa recortes, traslapes, acciones rotas y textos que no caben antes de exportar.</p>
        </div>
        <div className={`validation-score ${errors.length ? 'bad' : warnings.length ? 'warn' : 'good'}`}>
          <strong>{errors.length ? `${errors.length} errores` : warnings.length ? `${warnings.length} avisos` : 'Todo bien'}</strong>
          <small>{project.screens.length} pantallas · {project.screens.reduce((total, screen) => total + screen.compact.Body.Buttons.length, 0)} botones</small>
        </div>
      </div>

      <div className="compat-grid">
        <div className="compat-card">
          <span className="compat-kicker">Caja 1280</span>
          <strong>1:1 en el POS</strong>
          <p>Los botones se muestran con X/Y/Ancho/Alto tal como están en el archivo Caja.</p>
        </div>
        <div className="compat-card">
          <span className="compat-kicker">Archivo Web</span>
          <strong>Proyección para Point</strong>
          <p>Se genera BodyOriginal con las etiquetas y geometría para que el portal exporte la misma Caja.</p>
        </div>
        <div className="compat-card">
          <span className="compat-kicker">Imágenes</span>
          <strong>Sin franjas</strong>
          <p>Para llenar el botón, usa imágenes cuadradas o el ajuste “Estirar”.</p>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="validation-empty">
          <div className="check-mark">✓</div>
          <h3>Sin problemas detectados</h3>
          <p>Las pantallas están dentro del área visible y las acciones principales son válidas.</p>
        </div>
      ) : (
        <div className="issue-list">
          {[...errors, ...warnings].map((issue, index) => (
            <button
              type="button"
              className={`issue-row ${issue.level}`}
              key={`${issue.screenUid}-${issue.buttonUid ?? 'screen'}-${index}`}
              onClick={() => openIssue(issue.screenUid, issue.buttonUid)}
            >
              <span className="issue-level">{issue.level === 'error' ? 'ERROR' : 'AVISO'}</span>
              <span className="issue-main">
                <strong>{issue.screenName} <small>#{issue.screenIndex}</small></strong>
                <span>{issue.message}</span>
              </span>
              <span className="issue-arrow">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
