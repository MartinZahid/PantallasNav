import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { TemplateId } from '../lib/pdtd';
import { useEditor } from '../store';

const TEMPLATES: { id: TemplateId; name: string; description: string; preview: string }[] = [
  { id: 'blank', name: 'Pantalla vacía', description: 'Solo el título. Construye desde cero.', preview: 'blank' },
  { id: 'grid3', name: 'Cuadrícula 3×3', description: '9 botones de 180×180.', preview: 'grid3' },
  { id: 'grid2', name: 'Categorías 2×2', description: '4 botones grandes de 280×280.', preview: 'grid2' },
  { id: 'list20', name: 'Lista 4×5', description: '20 botones de producto de 135×135.', preview: 'list20' },
  { id: 'grid30', name: 'Guisados 6×5', description: '30 botones compactos de 90×90.', preview: 'grid30' },
];

function TemplatesDialog({ screenCount, onClose }: { screenCount: number; onClose: () => void }) {
  const addScreen = useEditor((state) => state.addScreen);
  const [title, setTitle] = useState(() => `PANTALLA ${screenCount + 1}`);
  const [template, setTemplate] = useState<TemplateId>('grid3');

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <h2>Nueva pantalla</h2>
            <p>Elige una plantilla y ponle nombre. Después puedes mover todo.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>
        <label className="field">
          <span>Nombre de la pantalla</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <div className="template-grid">
          {TEMPLATES.map((item) => (
            <button
              type="button"
              className={`template-card ${template === item.id ? 'selected' : ''}`}
              key={item.id}
              onClick={() => setTemplate(item.id)}
            >
              <div className={`template-preview preview-${item.preview}`}>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="primary-button"
            onClick={() => addScreen(template, title.trim() || 'NUEVA PANTALLA')}
          >
            Crear pantalla
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplatesModal() {
  const open = useEditor((state) => state.templateOpen);
  const setOpen = useEditor((state) => state.setTemplateOpen);
  const project = useEditor((state) => state.project);

  if (!open) return null;
  return (
    <TemplatesDialog
      screenCount={project?.screens.length ?? 0}
      onClose={() => setOpen(false)}
    />
  );
}

export function ProductsModal() {
  const open = useEditor((state) => state.productsOpen);
  const setOpen = useEditor((state) => state.setProductsOpen);
  const project = useEditor((state) => state.project);
  const importProducts = useEditor((state) => state.importProducts);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const close = () => {
    setError('');
    setOpen(false);
  };

  const load = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
      importProducts(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo leer el Excel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal products-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <h2>Productos</h2>
            <p>Importa el reporte de productos (.xls/.xlsx) para usarlo en las acciones.</p>
          </div>
          <button type="button" className="icon-button" onClick={close}>×</button>
        </div>
        <div className="products-toolbar">
          <button type="button" className="primary-button" onClick={() => input.current?.click()}>
            {busy ? 'Leyendo…' : 'Importar Excel'}
          </button>
          <input
            ref={input}
            type="file"
            accept=".xls,.xlsx"
            hidden
            onChange={(event) => {
              void load(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <span className="muted">{project?.products.length ?? 0} productos</span>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr><th>ID</th><th>Producto</th><th>Precio</th><th>Familia</th></tr>
            </thead>
            <tbody>
              {(project?.products ?? []).slice(0, 400).map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>{product.name}</td>
                  <td>{product.price.toFixed(2)}</td>
                  <td>{product.family}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!project?.products.length ? <div className="empty-table">Aún no hay productos importados.</div> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={close}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
