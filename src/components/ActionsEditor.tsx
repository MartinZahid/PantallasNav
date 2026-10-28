import { useEffect, useMemo, useRef, useState } from 'react';
import type { Action, PdtdButton, Product } from '../types';
import { ACTION_TYPES } from '../lib/pdtd';
import { useEditor } from '../store';

const AVAILABLE_ORDER = [
  'addProduct',
  'addToList',
  'selectProduct',
  'gotoScreen',
  'popUp',
  'listFlush',
  'finish',
  'reset',
  'rewind',
  'deselectProduct',
];

const BOOLEAN_ACTIONS = new Set([
  'selectProduct',
  'deselectProduct',
  'listFlush',
  'finish',
  'reset',
  'rewind',
]);

function isMarker(action: Action): boolean {
  return String(action.Type) === 'executionOrder';
}

function actionOrder(action: Action, at: number): number {
  const value = Number(action.Index);
  return Number.isFinite(value) && value > 0 ? value : at + 1;
}

function sortActions(actions: Action[]): Action[] {
  return actions
    .map((action, at) => ({ action, at, order: actionOrder(action, at) }))
    .sort((left, right) => left.order - right.order || left.at - right.at)
    .map((entry) => entry.action);
}

function nextOrder(actions: Action[]): number {
  return actions.reduce((max, action, at) => Math.max(max, actionOrder(action, at)), 0) + 1;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1';
}

function defaultValue(type: string, products: Product[], screens: { Index: number }[]): string | number | boolean {
  if (type === 'addProduct' || type === 'addToList') return products[0]?.id ?? 0;
  if (type === 'gotoScreen') return screens[0]?.Index ?? 1;
  if (BOOLEAN_ACTIONS.has(type)) return true;
  if (type === 'popUp') return '';
  return 0;
}

function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    addProduct: 'Agregar producto',
    addToList: 'Agregar producto a lista',
    selectProduct: 'Seleccionar producto',
    deselectProduct: 'Deseleccionar productos',
    gotoScreen: 'Ir a pantalla',
    listFlush: 'Limpiar lista de productos',
    finish: 'Terminar',
    reset: 'Reiniciar',
    rewind: 'Retroceder',
    popUp: 'Ventana / popup',
    executionOrder: 'Fin de secuencia',
  };
  return labels[type] ?? type;
}

function ProductPicker({
  value,
  products,
  onChange,
  onFocus,
}: {
  value: string | number;
  products: Product[];
  onChange: (value: number) => void;
  onFocus: () => void;
}) {
  const selected = products.find((product) => product.id === Number(value));
  const selectedLabel = selected ? `${selected.id} · ${selected.name}` : '';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products.slice(0, 10);
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(needle) ||
          String(product.id).includes(needle) ||
          product.code.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [products, query]);

  const choose = (product: Product) => {
    onChange(product.id);
    setQuery(`${product.id} · ${product.name}`);
    setOpen(false);
  };

  return (
    <div className="product-picker" ref={wrapper}>
      <input
        type="search"
        value={open ? query : selectedLabel}
        placeholder="Buscar producto por nombre, código o ID…"
        onFocus={(event) => {
          onFocus();
          setQuery(selectedLabel);
          setOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
          if (!event.target.value.trim()) onChange(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlight((at) => Math.min(filtered.length - 1, at + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((at) => Math.max(0, at - 1));
          } else if (event.key === 'Enter' && open && filtered[highlight]) {
            event.preventDefault();
            choose(filtered[highlight]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open ? (
        <div className="product-picker-menu">
          {filtered.length ? (
            filtered.map((product, at) => (
              <button
                type="button"
                key={product.id}
                className={`product-option ${at === highlight ? 'highlighted' : ''} ${product.id === Number(value) ? 'selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(at)}
                onClick={() => choose(product)}
              >
                <span className="product-option-id">{product.id}</span>
                <span className="product-option-name">{product.name}</span>
                <span className="product-option-meta">{product.price ? `$${product.price.toFixed(2)}` : product.family}</span>
              </button>
            ))
          ) : (
            <div className="product-option-empty">Sin resultados. Revisa el nombre o importa productos.</div>
          )}
        </div>
      ) : null}
    </div>
  );
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
  const [menu, setMenu] = useState<number | null>(null);

  const rawActions = useMemo(() => button.Actions ?? [], [button.Actions]);
  const markers = useMemo(() => rawActions.filter(isMarker), [rawActions]);
  const actions = useMemo(() => sortActions(rawActions.filter((action) => !isMarker(action))), [rawActions]);
  const products = project?.products ?? [];
  const screens = project?.screens.map((screen) => screen.compact) ?? [];

  useEffect(() => {
    if (menu === null) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.function-menu')) setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  if (!project) return null;

  const usedTypes = new Set(rawActions.map((action) => String(action.Type)));
  const available = AVAILABLE_ORDER.filter((type) => !usedTypes.has(type) && ACTION_TYPES.includes(type as (typeof ACTION_TYPES)[number]));

  const setActions = (next: Action[], record = false) => {
    updateButton(screenUid, index, { Actions: [...sortActions(next), ...markers] }, record);
  };

  const add = (type: string) => {
    if (usedTypes.has(type)) return;
    beginTransaction();
    setActions([...actions, { Index: nextOrder(actions), Type: type, Value: defaultValue(type, products, screens) }], false);
    setMenu(null);
  };

  const remove = (at: number) => {
    beginTransaction();
    setActions(actions.filter((_, position) => position !== at), false);
    setMenu(null);
  };

  const move = (at: number, direction: -1 | 1) => {
    const to = at + direction;
    if (to < 0 || to >= actions.length) return;
    beginTransaction();
    const next = [...actions];
    const left = next[at];
    const right = next[to];
    const leftOrder = actionOrder(left, at);
    const rightOrder = actionOrder(right, to);
    next[at] = { ...left, Index: rightOrder };
    next[to] = { ...right, Index: leftOrder };
    setActions(leftOrder === rightOrder ? next.map((action, position) => ({ ...action, Index: position + 1 })) : next, false);
    setMenu(null);
  };

  const changeValue = (at: number, value: string | number | boolean) => {
    setActions(
      actions.map((action, position) => (position === at ? { ...action, Value: value } : action)),
      false,
    );
  };

  const valueControl = (action: Action, at: number) => {
    const type = String(action.Type);
    if (type === 'addProduct' || type === 'addToList') {
      return products.length ? (
        <ProductPicker
          value={action.Value ?? 0}
          products={products}
          onFocus={beginTransaction}
          onChange={(productId) => changeValue(at, productId)}
        />
      ) : (
        <input
          type="number"
          value={String(action.Value ?? 0)}
          onFocus={beginTransaction}
          onChange={(event) => changeValue(at, Number(event.target.value))}
          placeholder="ID producto"
        />
      );
    }
    if (type === 'gotoScreen') {
      const value = String(action.Value ?? '');
      const known = screens.some((screen) => String(screen.Index) === value);
      return (
        <select value={value} onFocus={beginTransaction} onChange={(event) => changeValue(at, Number(event.target.value))}>
          {!known ? <option value="">Selecciona pantalla</option> : null}
          {screens.map((screen) => (
            <option key={screen.Index} value={screen.Index}>
              {screen.Index} · {screen.Id}
            </option>
          ))}
        </select>
      );
    }
    if (BOOLEAN_ACTIONS.has(type)) {
      const active = isTrue(action.Value);
      return (
        <label className="function-toggle">
          <input
            type="checkbox"
            checked={active}
            onFocus={beginTransaction}
            onChange={(event) => changeValue(at, event.target.checked)}
          />
          <span>{active ? 'Sí' : 'No'}</span>
        </label>
      );
    }
    return (
      <input
        value={String(action.Value ?? '')}
        onFocus={beginTransaction}
        onChange={(event) => changeValue(at, event.target.value)}
        placeholder="Valor"
      />
    );
  };

  return (
    <div className="actions-editor">
      <div className="functions-block">
        <div className="functions-title">Funciones Actuales</div>
        <div className="functions-card">
          {actions.length ? (
            actions.map((action, at) => {
              const type = String(action.Type);
              const label = actionLabel(type);
              return (
                <div className="function-row" key={`${type}-${actionOrder(action, at)}-${at}`}>
                  <div className="function-main">
                    <span className="function-name">{label}</span>
                    <div className="function-control">{valueControl(action, at)}</div>
                  </div>
                  <span className="function-order" title="Orden de ejecución">
                    {actionOrder(action, at)}
                  </span>
                  <div className="function-menu">
                    <button
                      type="button"
                      className="function-menu-button"
                      title={`Opciones de ${label}`}
                      aria-label={`Opciones de ${label}`}
                      onClick={() => setMenu(menu === at ? null : at)}
                    >
                      ⋮
                    </button>
                    {menu === at ? (
                      <div className="function-menu-popover">
                        <button type="button" disabled={at === 0} onClick={() => move(at, -1)}>
                          Subir
                        </button>
                        <button type="button" disabled={at === actions.length - 1} onClick={() => move(at, 1)}>
                          Bajar
                        </button>
                        <button type="button" className="danger" onClick={() => remove(at)}>
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="functions-empty">Este botón todavía no tiene funciones.</p>
          )}
        </div>
        <p className="functions-help">Las funciones se ejecutan de arriba hacia abajo.</p>
      </div>

      <div className="functions-block">
        <div className="functions-title">Funciones Disponibles</div>
        <div className="available-list">
          {available.length ? (
            available.map((type) => (
              <button type="button" className="available-function" key={type} onClick={() => add(type)}>
                <span>{actionLabel(type)}</span>
                <span aria-hidden="true">+</span>
              </button>
            ))
          ) : (
            <p className="functions-empty">Ya agregaste todas las funciones disponibles.</p>
          )}
        </div>
      </div>
    </div>
  );
}
