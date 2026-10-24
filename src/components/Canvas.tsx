import { useEffect, useMemo, useRef, useState } from 'react';
import type { PdtdButton } from '../types';
import { isTitle, VISIBLE_HEIGHT, VISIBLE_WIDTH } from '../lib/pdtd';
import { useEditor } from '../store';

type CanvasMode = 'editor' | 'caja' | 'portal';

interface DragState {
  type: 'move' | 'resize';
  dir: string;
  startX: number;
  startY: number;
  screenUid: string;
  index: number;
  origin: { x: number; y: number; w: number; h: number };
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function parseFontSize(button: PdtdButton): number {
  return Math.max(7, Math.round(Number(button.Text?.Font?.Size ?? 9) * 1.33));
}

function alignmentStyle(button: PdtdButton): React.CSSProperties {
  const align = String(button.Text?.TextAlign ?? 'MiddleCenter');
  if (align.includes('Bottom')) return { alignItems: 'flex-end', justifyContent: 'center' };
  if (align.includes('Top')) return { alignItems: 'flex-start', justifyContent: 'center' };
  if (align.includes('Left')) return { alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left' };
  if (align.includes('Right')) return { alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right' };
  return { alignItems: 'center', justifyContent: 'center' };
}

function buttonStyle(button: PdtdButton, selected: boolean, editable: boolean): React.CSSProperties {
  const image = String(button.Icon?.Imagen ?? '');
  return {
    left: Number(button.X),
    top: Number(button.Y),
    width: Number(button.Width),
    height: Number(button.Height),
    backgroundColor: `rgb(${button.Text?.BackColor ?? '0,0,0'})`,
    color: `rgb(${button.Text?.Color ?? '255,255,255'})`,
    backgroundImage: image ? `url(${image.startsWith('data:') ? image : `data:image/png;base64,${image}`})` : undefined,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    fontFamily: `'${button.Text?.Font?.Family || 'Arial Black'}'`,
    fontSize: parseFontSize(button),
    outline: selected ? '3px solid #38bdf8' : '1px solid rgba(0,0,0,0.16)',
    cursor: editable ? 'move' : 'default',
    border: '0',
  };
}

function ButtonView({
  button,
  selected,
  editable,
  mode,
  onPointerDown,
  onResizeStart,
  onClick,
}: {
  button: PdtdButton;
  selected: boolean;
  editable: boolean;
  mode: CanvasMode;
  onPointerDown: (event: React.PointerEvent, index: number) => void;
  onResizeStart: (event: React.PointerEvent, dir: string, index: number) => void;
  onClick: (index: number) => void;
}) {
  const index = Number(button.__index ?? -1);
  return (
    <div
      className={`canvas-button ${selected ? 'selected' : ''} ${isTitle(button) ? 'title' : ''}`}
      style={buttonStyle(button, selected, editable)}
      onPointerDown={(event) => {
        if (!editable) return;
        onPointerDown(event, index);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (editable) onClick(index);
      }}
    >
      <span className="canvas-label" style={alignmentStyle(button)}>
        {button.Text?.Text || (editable ? <em>SIN TEXTO</em> : '')}
      </span>
      {editable && selected
        ? HANDLES.map((dir) => (
            <span
              key={dir}
              className={`resize-handle handle-${dir}`}
              onPointerDown={(event) => onResizeStart(event, dir, index)}
            />
          ))
        : null}
      {editable ? <span className="button-index">{index + 1}</span> : null}
      {mode === 'editor' && imageBadge(button)}
    </div>
  );
}

function imageBadge(button: PdtdButton): React.ReactNode {
  return button.Icon?.Imagen ? <span className="image-badge">IMG</span> : null;
}

export function Canvas({ mode }: { mode: CanvasMode }) {
  const project = useEditor((state) => state.project);
  const scale = useEditor((state) => state.scale);
  const snap = useEditor((state) => state.snap);
  const showGrid = useEditor((state) => state.showGrid);
  const beginTransaction = useEditor((state) => state.beginTransaction);
  const updateButton = useEditor((state) => state.updateButton);
  const selectButton = useEditor((state) => state.selectButton);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const screen = project?.screens.find((item) => item.uid === project.selectedScreenUid);
  const selectedIndex = project?.selectedButtonIndex ?? null;

  const portal = mode === 'portal';
  const canvasWidth = portal ? 1181 : VISIBLE_WIDTH;
  const canvasHeight = portal ? 708 : VISIBLE_HEIGHT;
  const fitScale = portal ? scale * 0.9 : scale;

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = (event.clientX - current.startX) / fitScale;
      const dy = (event.clientY - current.startY) / fitScale;
      const snapValue = (value: number) => (snap ? Math.round(value / 10) * 10 : Math.round(value * 10) / 10);
      let x = current.origin.x;
      let y = current.origin.y;
      let w = current.origin.w;
      let h = current.origin.h;

      if (current.type === 'move') {
        x = Math.max(-w + 20, Math.min(VISIBLE_WIDTH - 20, current.origin.x + dx));
        y = Math.max(-h + 20, Math.min(VISIBLE_HEIGHT - 20, current.origin.y + dy));
        x = snapValue(x);
        y = snapValue(y);
      } else {
        const min = 20;
        if (current.dir.includes('e')) w = Math.max(min, current.origin.w + dx);
        if (current.dir.includes('s')) h = Math.max(min, current.origin.h + dy);
        if (current.dir.includes('w')) {
          const nextX = Math.min(current.origin.x + current.origin.w - min, current.origin.x + dx);
          x = snapValue(nextX);
          w = current.origin.w + (current.origin.x - x);
        }
        if (current.dir.includes('n')) {
          const nextY = Math.min(current.origin.y + current.origin.h - min, current.origin.y + dy);
          y = snapValue(nextY);
          h = current.origin.h + (current.origin.y - y);
        }
        if (current.dir.includes('e')) w = snapValue(w);
        if (current.dir.includes('s')) h = snapValue(h);
      }

      updateButton(current.screenUid, current.index, { X: x, Y: y, Width: w, Height: h }, false);
    };
    const up = () => {
      setDrag(null);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, fitScale, snap, updateButton]);

  const startMove = (event: React.PointerEvent, index: number) => {
    if (!screen) return;
    event.preventDefault();
    event.stopPropagation();
    const button = screen.compact.Body.Buttons[index];
    if (!button) return;
    selectButton(index);
    beginTransaction();
    const state: DragState = {
      type: 'move',
      dir: '',
      startX: event.clientX,
      startY: event.clientY,
      screenUid: screen.uid,
      index,
      origin: { x: Number(button.X), y: Number(button.Y), w: Number(button.Width), h: Number(button.Height) },
    };
    dragRef.current = state;
    setDrag(state);
  };

  const startResize = (event: React.PointerEvent, dir: string, index: number) => {
    if (!screen) return;
    event.preventDefault();
    event.stopPropagation();
    const button = screen.compact.Body.Buttons[index];
    if (!button) return;
    selectButton(index);
    beginTransaction();
    const state: DragState = {
      type: 'resize',
      dir,
      startX: event.clientX,
      startY: event.clientY,
      screenUid: screen.uid,
      index,
      origin: { x: Number(button.X), y: Number(button.Y), w: Number(button.Width), h: Number(button.Height) },
    };
    dragRef.current = state;
    setDrag(state);
  };

  const portalButtons = useMemo(() => {
    if (!screen) return [];
    return screen.compact.Body.Buttons.map((button, index) => {
      const fx = 1181 / Number(screen.compact.Body.Width || 768);
      const fy = 708 / Number(screen.compact.Body.Height || 1024);
      return { button, index, x: Number(button.X) * fx, y: Number(button.Y) * fy, w: Number(button.Width) * fx, h: Number(button.Height) * fy };
    });
  }, [screen]);

  if (!project || !screen) {
    return <div className="empty-stage">Importa un archivo Web o Caja para comenzar.</div>;
  }

  if (mode === 'portal') {
    return (
      <div className="stage-scroll">
        <div className="canvas-caption">
          <strong>Vista diagnóstica del portal</strong>
          <span>El portal puede mostrar el diseño ancho; lo que importa es la Caja que exporta Point.</span>
        </div>
        <div className="canvas-frame portal-frame" style={{ width: canvasWidth * fitScale, height: canvasHeight * fitScale }}>
          <div className="screen-portal" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${fitScale})` }}>
            {portalButtons.map(({ button, index, x, y, w, h }) => (
              <div
                key={index}
                className="portal-tile"
                style={{
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  backgroundColor: `rgb(${button.Text?.BackColor ?? '0,0,0'})`,
                  color: `rgb(${button.Text?.Color ?? '255,255,255'})`,
                  fontFamily: `'${button.Text?.Font?.Family || 'Arial Black'}'`,
                  fontSize: Math.max(7, Number(button.Text?.Font?.Size ?? 9) * 1.33),
                }}
              >
                <span>{button.Text?.Text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-scroll" ref={stageRef}>
      <div className="canvas-caption">
        <strong>{mode === 'caja' ? 'Caja 1280 · 588×843' : 'Editor 1280 · 588×843'}</strong>
        <span>{mode === 'caja' ? 'Así se ve en el POS.' : 'Arrastra para mover · usa las esquinas para redimensionar · clic en el fondo para deseleccionar.'}</span>
      </div>
      <div className="canvas-frame" style={{ width: VISIBLE_WIDTH * fitScale, height: VISIBLE_HEIGHT * fitScale }}>
        <div
          className={`screen-surface ${showGrid && mode === 'editor' ? 'with-grid' : ''}`}
          style={{ width: VISIBLE_WIDTH, height: VISIBLE_HEIGHT, transform: `scale(${fitScale})` }}
          onPointerDown={() => {
            if (mode === 'editor') selectButton(null);
          }}
        >
          {screen.compact.Body.Buttons.map((button, index) => (
            <ButtonView
              key={index}
              button={{ ...button, __index: index }}
              selected={mode === 'editor' && selectedIndex === index}
              editable={mode === 'editor'}
              mode={mode}
              onPointerDown={startMove}
              onResizeStart={startResize}
              onClick={selectButton}
            />
          ))}
          {mode === 'editor' && !screen.compact.Body.Buttons.length ? (
            <div className="blank-hint">
              <div>Pantalla vacía</div>
              <small>Agrega un botón o título desde el panel derecho.</small>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
