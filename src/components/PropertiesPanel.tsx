import { useRef, useState } from 'react';
import type { PdtdButton } from '../types';
import { clone, isTitle, makeTitle } from '../lib/pdtd';
import { profileForProject } from '../lib/profiles';
import { useEditor } from '../store';
import { ActionsEditor } from './ActionsEditor';

function rgbToHex(value: string): string {
  const parts = String(value || '').split(',').map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return '#000000';
  return `#${parts.map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(value: string): string {
  const clean = value.replace('#', '');
  if (clean.length !== 6) return '0,0,0';
  return `${parseInt(clean.slice(0, 2), 16)},${parseInt(clean.slice(2, 4), 16)},${parseInt(clean.slice(4, 6), 16)}`;
}

function ColorField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  return (
    <label className="field color-field">
      <span>{label}</span>
      <span className="color-row">
        <input type="color" value={rgbToHex(value)} onFocus={onFocus} onChange={(event) => onChange(hexToRgb(event.target.value))} />
        <input value={value} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onFocus,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onFocus: () => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number(value.toFixed(2))}
        min={min}
        max={max}
        step={0.5}
        onFocus={onFocus}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ButtonEditor() {
  const project = useEditor((state) => state.project);
  const profile = profileForProject(project);
  const updateButton = useEditor((state) => state.updateButton);
  const beginTransaction = useEditor((state) => state.beginTransaction);
  const deleteButton = useEditor((state) => state.deleteButton);
  const duplicateButton = useEditor((state) => state.duplicateButton);
  const moveButtonLayer = useEditor((state) => state.moveButtonLayer);
  const imageInput = useRef<HTMLInputElement>(null);
  const screen = project?.screens.find((item) => item.uid === project.selectedScreenUid);
  const index = project?.selectedButtonIndex ?? null;
  const button: PdtdButton | undefined = index !== null ? screen?.compact.Body.Buttons[index] : undefined;
  const [imageBusy, setImageBusy] = useState(false);

  if (!project || !screen || !button || index === null) return null;

  const setText = (patch: Partial<PdtdButton['Text']>) => {
    updateButton(screen.uid, index, { Text: { ...button.Text, ...patch } }, false);
  };
  const setIcon = (patch: Partial<PdtdButton['Icon']>) => {
    updateButton(screen.uid, index, { Icon: { ...button.Icon, ...patch } }, false);
  };
  const setGeometry = (patch: { X?: number; Y?: number; Width?: number; Height?: number }) => {
    updateButton(screen.uid, index, patch, false);
  };

  const applyImage = (source: string, fit: boolean) => {
    const dataUrl = source.startsWith('data:') ? source : `data:image/png;base64,${source}`;
    if (!fit) {
      beginTransaction();
      setIcon({ Imagen: dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl, SizeMode: 'Strech' });
      setImageBusy(false);
      return;
    }
    setImageBusy(true);
    const img = new Image();
    img.onload = () => {
      const w = Math.max(1, Number(button.Width));
      const h = Math.max(1, Number(button.Height));
      const scale = Math.max(0.25, Math.min(2, 1024 / Math.max(w, h)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(8, Math.round(w * scale));
      canvas.height = Math.max(8, Math.round(h * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        setImageBusy(false);
        return;
      }
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      beginTransaction();
      setIcon({ Imagen: png.split(',')[1], SizeMode: 'Strech' });
      setImageBusy(false);
    };
    img.onerror = () => setImageBusy(false);
    img.src = dataUrl;
  };

  const uploadImage = (file: File | undefined) => {
    if (!file) return;
    setImageBusy(true);
    const reader = new FileReader();
    reader.onload = () => applyImage(String(reader.result ?? ''), true);
    reader.onerror = () => setImageBusy(false);
    reader.readAsDataURL(file);
  };

  return (
    <div className="properties-body">
      <div className="selection-title">
        <span className={`type-dot ${isTitle(button) ? 'title-dot' : ''}`} />
        <div>
          <strong>{button.Text.Text || `Botón ${index + 1}`}</strong>
          <small>{isTitle(button) ? 'Título / banner' : 'Botón interactivo'} · índice {index + 1}</small>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Texto</div>
        <label className="field">
          <span>Texto</span>
          <textarea
            rows={2}
            value={button.Text.Text}
            onFocus={beginTransaction}
            onChange={(event) => setText({ Text: event.target.value })}
          />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Fuente</span>
            <input value={button.Text.Font.Family} onFocus={beginTransaction} onChange={(event) => setText({ Font: { ...button.Text.Font, Family: event.target.value } })} />
          </label>
          <NumberField label="Tamaño" value={button.Text.Font.Size} min={6} max={60} onFocus={beginTransaction} onChange={(value) => setText({ Font: { ...button.Text.Font, Size: value } })} />
        </div>
        <label className="field">
          <span>Alineación</span>
          <select value={button.Text.TextAlign} onFocus={beginTransaction} onChange={(event) => setText({ TextAlign: event.target.value })}>
            <option value="MiddleCenter">Centro</option>
            <option value="BottomCenter">Abajo centrado</option>
            <option value="TopCenter">Arriba centrado</option>
            <option value="MiddleLeft">Centro izquierda</option>
            <option value="MiddleRight">Centro derecha</option>
            <option value="BottomLeft">Abajo izquierda</option>
            <option value="BottomRight">Abajo derecha</option>
            <option value="TopLeft">Arriba izquierda</option>
            <option value="TopRight">Arriba derecha</option>
          </select>
        </label>
        <div className="grid-2">
          <ColorField label="Color texto" value={button.Text.Color} onFocus={beginTransaction} onChange={(value) => setText({ Color: value })} />
          <ColorField label="Fondo" value={button.Text.BackColor} onFocus={beginTransaction} onChange={(value) => setText({ BackColor: value })} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Posición y tamaño</div>
        <div className="grid-4">
          <NumberField label="X" value={button.X} min={-400} max={profile.visibleWidth} onFocus={beginTransaction} onChange={(value) => setGeometry({ X: value })} />
          <NumberField label="Y" value={button.Y} min={-400} max={profile.visibleHeight} onFocus={beginTransaction} onChange={(value) => setGeometry({ Y: value })} />
          <NumberField label="Ancho" value={button.Width} min={20} onFocus={beginTransaction} onChange={(value) => setGeometry({ Width: value })} />
          <NumberField label="Alto" value={button.Height} min={20} onFocus={beginTransaction} onChange={(value) => setGeometry({ Height: value })} />
        </div>
        <div className="muted tiny">Area visible de la Caja: {profile.visibleWidth} x {profile.visibleHeight}.</div>
      </div>

      <div className="section">
        <div className="section-title">Imagen</div>
        {button.Icon.Imagen ? (
          <div className="image-preview">
            <img src={button.Icon.Imagen.startsWith('data:') ? button.Icon.Imagen : `data:image/png;base64,${button.Icon.Imagen}`} alt="" />
            <div className="image-actions">
              <button type="button" className="small-button" onClick={() => imageInput.current?.click()}>{imageBusy ? 'Leyendo…' : 'Cambiar'}</button>
              <button type="button" className="small-button danger" onClick={() => { beginTransaction(); setIcon({ Imagen: '', SizeMode: 'Strech' }); }}>Quitar</button>
            </div>
          </div>
        ) : (
          <button type="button" className="wide-button" onClick={() => imageInput.current?.click()}>{imageBusy ? 'Leyendo…' : 'Subir imagen'}</button>
        )}
        <input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => uploadImage(event.target.files?.[0])} />
        <label className="field">
          <span>Ajuste</span>
          <select value={button.Icon.SizeMode || 'Strech'} onFocus={beginTransaction} onChange={(event) => setIcon({ SizeMode: event.target.value })}>
            <option value="Strech">Estirar a todo el botón</option>
            <option value="Zoom">Ajustar sin deformar</option>
          </select>
        </label>
        <div className="muted tiny">Para llenar el botón, la imagen debe ser cuadrada o usar “Estirar”.</div>
      </div>

      <ActionsEditor button={button} screenUid={screen.uid} index={index} />

      <div className="section">
        <div className="section-title">Organizar</div>
        <div className="button-row">
          <button type="button" className="small-button" onClick={() => duplicateButton(screen.uid, index)}>Duplicar</button>
          <button type="button" className="small-button" onClick={() => moveButtonLayer(screen.uid, index, -1)}>Subir capa</button>
          <button type="button" className="small-button" onClick={() => moveButtonLayer(screen.uid, index, 1)}>Bajar capa</button>
          <button type="button" className="small-button danger" onClick={() => deleteButton(screen.uid, index)}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function ScreenEditor() {
  const project = useEditor((state) => state.project);
  const profile = profileForProject(project);
  const updateScreen = useEditor((state) => state.updateScreen);
  const updateBody = useEditor((state) => state.updateBody);
  const addButton = useEditor((state) => state.addButton);
  const beginTransaction = useEditor((state) => state.beginTransaction);
  const duplicateScreen = useEditor((state) => state.duplicateScreen);
  const screen = project?.screens.find((item) => item.uid === project.selectedScreenUid);
  if (!project || !screen) return null;
  return (
    <div className="properties-body">
      <div className="selection-title">
        <span className="type-dot screen-dot" />
        <div>
          <strong>{screen.compact.Id}</strong>
          <small>Pantalla {screen.compact.Index} · {screen.compact.Body.Buttons.length} botones</small>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Pantalla</div>
        <label className="field">
          <span>Id</span>
          <input value={screen.compact.Id} onFocus={beginTransaction} onChange={(event) => updateScreen(screen.uid, { Id: event.target.value })} />
        </label>
        <NumberField label="Índice" value={screen.compact.Index} min={1} onFocus={beginTransaction} onChange={(value) => updateScreen(screen.uid, { Index: value })} />
        <ColorField label="Fondo del cuerpo" value={screen.compact.Body.BackColor} onFocus={beginTransaction} onChange={(value) => updateBody(screen.uid, { BackColor: value })} />
        <div className="muted tiny">Cuerpo: {screen.compact.Body.Width} x {screen.compact.Body.Height}. Area visible: {profile.visibleWidth} x {profile.visibleHeight}.</div>
      </div>
      <div className="section">
        <div className="section-title">Crear</div>
        <div className="button-row">
          <button type="button" className="wide-button" onClick={addButton}>+ Botón</button>
          <button type="button" className="wide-button" onClick={() => { beginTransaction(); const title = clone(makeTitle('NUEVO TITULO', profile)); updateButtonAppend(screen.uid, title); }}>+ Título</button>
        </div>
        <div className="button-row">
          <button type="button" className="small-button" onClick={() => duplicateScreen(screen.uid)}>Duplicar pantalla</button>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Selecciona un botón</div>
        <p className="muted small">Haz clic en un botón del lienzo para editar su texto, tamaño, colores, imagen y acciones. Arrastra para mover y usa las esquinas para redimensionar.</p>
      </div>
    </div>
  );
}

function updateButtonAppend(screenUid: string, button: PdtdButton) {
  const state = useEditor.getState();
  const project = state.project;
  if (!project) return;
  const next = clone(project);
  const screen = next.screens.find((item) => item.uid === screenUid);
  if (!screen) return;
  screen.compact.Body.Buttons.push(button);
  next.selectedButtonIndex = screen.compact.Body.Buttons.length - 1;
  useEditor.setState({ project: next, message: 'Título agregado.' });
}

function ButtonList() {
  const project = useEditor((state) => state.project);
  const profile = profileForProject(project);
  const selectButton = useEditor((state) => state.selectButton);
  const screen = project?.screens.find((item) => item.uid === project.selectedScreenUid);
  if (!project || !screen) return null;
  return (
    <div className="button-list">
      <div className="button-list-heading">
        <span>Botones de la pantalla</span>
        <span>{screen.compact.Body.Buttons.length}</span>
      </div>
      <div className="button-list-scroll">
        {screen.compact.Body.Buttons.map((button, index) => {
          const out = Number(button.X) < 0 || Number(button.Y) < 0 || Number(button.X) + Number(button.Width) > profile.visibleWidth + 0.5 || Number(button.Y) + Number(button.Height) > profile.visibleHeight + 0.5;
          const selected = project.selectedButtonIndex === index;
          return (
            <button
              type="button"
              key={index}
              className={`button-list-item ${selected ? 'selected' : ''}`}
              onClick={() => selectButton(index)}
            >
              <span className="button-list-index">{index + 1}</span>
              <span className="button-list-name">{button.Text.Text || <em>Sin texto</em>}</span>
              <span className="button-list-pos">{Number(button.X).toFixed(0)},{Number(button.Y).toFixed(0)}</span>
              {out ? <span className="button-list-out">fuera</span> : null}
              {isTitle(button) ? <span className="button-list-title">T</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const project = useEditor((state) => state.project);
  const profile = profileForProject(project);
  const index = project?.selectedButtonIndex ?? null;
  return (
    <aside className="properties">
      <div className="panel-heading">
        <span>Propiedades</span>
        <span className="panel-sub">{profile.label}</span>
      </div>
      <ButtonList />
      {index !== null ? <ButtonEditor /> : <ScreenEditor />}
    </aside>
  );
}
