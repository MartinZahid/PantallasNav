import type { Action, PdtdButton, Product } from '../types';
import { ACTION_TYPES } from '../lib/pdtd';
import { useEditor } from '../store';

function defaultValue(type: string, products: Product[], screens: { Index: number }[]): string | number {
  if (type === 'addProduct') return products[0]?.id ?? 0;
  if (type === 'gotoScreen') return screens[0]?.Index ?? 1;
  if (type === 'popUp' || type === 'listFlush') return '';
  return 0;
}

function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    addProduct: 'Agregar producto',
    gotoScreen: 'Ir a pantalla',
    selectProduct: 'Seleccionar producto',
    addToList: 'Agregar a lista',
    executionOrder: 'Orden de ejecución',
    finish: 'Terminar',
    deselectProduct: 'Deseleccionar producto',
    rewind: 'Retroceder',
    popUp: 'Ventana / popup',
    listFlush: 'Vaciar lista',
  };
  return labels[type] ?? type;
}

export function ActionsEditor({
  button,
  screenUid,
  index,
}: {
  button: PdtdButton;
  screenUid: string;
  index: number;
}) {
  const project = useEditor((state) => state.project);
  const updateButton = useEditor((state) => state.updateButton);
  const beginTransaction = useEditor((state) => state.beginTransaction);
  if (!project) return null;
  const actions = button.Actions ?? [];
  const products = project.products;
  const screens = project.screens.map((screen) => screen.compact);

  const setActions = (next: Action[], record = false) => {
    updateButton(screenUid, index, { Actions: next.map((action, at) => ({ ...action, Index: at + 1 })) }, record);
  };

  const add = () => {
    beginTransaction();
    const type = 'addProduct';
    setActions([...actions, { Index: actions.length + 1, Type: type, Value: defaultValue(type, products, screens) }], false);
  };

  const remove = (at: number) => {
    beginTransaction();
    setActions(actions.filter((_, position) => position !== at), false);
  };

  const move = (at: number, direction: -1 | 1) => {
    const to = at + direction;
    if (to < 0 || to >= actions.length) return;
    beginTransaction();
    const next = [...actions];
    const [item] = next.splice(at, 1);
    next.splice(to, 0, item);
    setActions(next, false);
  };

  const changeType = (at: number, type: string) => {
    beginTransaction();
    const next = actions.map((action, position) =>
      position === at ? { ...action, Type: type, Value: defaultValue(type, products, screens) } : action,
    );
    setActions(next, false);
  };

  const changeValue = (at: number, value: string | number) => {
    const next = actions.map((action, position) =>
      position === at ? { ...action, Value: value } : action,
    );
    setActions(next, false);
  };

  return (
    <div className="actions-editor">
      <div className="field-heading">
        <span>Acciones</span>
        <button type="button" className="small-button" onClick={add}>+ Acción</button>
      </div>
      {actions.length === 0 ? <p className="muted small">Sin acciones. Este botón solo muestra contenido o es un título.</p> : null}
      <div className="action-list">
        {actions.map((action, at) => {
          const type = String(action.Type);
          return (
            <div className="action-row" key={`${at}-${type}`}>
              <span className="action-order">{at + 1}</span>
              <div className="action-fields">
                <select
                  value={type}
                  onFocus={beginTransaction}
                  onChange={(event) => changeType(at, event.target.value)}
                >
                  {ACTION_TYPES.map((item) => (
                    <option value={item} key={item}>{actionLabel(item)}</option>
                  ))}
                  {!ACTION_TYPES.includes(type as (typeof ACTION_TYPES)[number]) ? (
                    <option value={type}>{type}</option>
                  ) : null}
                </select>
                {type === 'addProduct' ? (
                  products.length ? (
                    <select
                      value={String(action.Value ?? '')}
                      onFocus={beginTransaction}
                      onChange={(event) => changeValue(at, Number(event.target.value))}
                    >
                      <option value="">Selecciona producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.id} · {product.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={String(action.Value ?? 0)}
                      onFocus={beginTransaction}
                      onChange={(event) => changeValue(at, Number(event.target.value))}
                      placeholder="ID producto"
                    />
                  )
                ) : type === 'gotoScreen' ? (
                  <select
                    value={String(action.Value ?? '')}
                    onFocus={beginTransaction}
                    onChange={(event) => changeValue(at, Number(event.target.value))}
                  >
                    {screens.map((screen) => (
                      <option key={screen.Index} value={screen.Index}>
                        {screen.Index} · {screen.Id}
                      </option>
                    ))}
                  </select>
                ) : type === 'popUp' || type === 'listFlush' ? (
                  <input
                    value={String(action.Value ?? '')}
                    onFocus={beginTransaction}
                    onChange={(event) => changeValue(at, event.target.value)}
                    placeholder="Valor"
                  />
                ) : (
                  <input
                    type="number"
                    value={String(action.Value ?? 0)}
                    onFocus={beginTransaction}
                    onChange={(event) => changeValue(at, Number(event.target.value))}
                    placeholder="Valor"
                  />
                )}
              </div>
              <div className="action-buttons">
                <button type="button" title="Subir" onClick={() => move(at, -1)}>↑</button>
                <button type="button" title="Bajar" onClick={() => move(at, 1)}>↓</button>
                <button type="button" title="Eliminar" onClick={() => remove(at)}>×</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
