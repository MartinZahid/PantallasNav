import { useEffect, useMemo, useRef, useState } from 'react';
import type { PdtdButton } from '../types';
import { isTitle } from '../lib/pdtd';
import { profileForProject } from '../lib/profiles';
import type { ActiveSnap, SnapRect } from '../lib/snapping';
import { snapEdge, snapMove } from '../lib/snapping';
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
  others: SnapRect[];
}

interface Guides {
  x: ActiveSnap | null;
  y: ActiveSnap | null;
}

function neighborRects(buttons: PdtdButton[], selected: number): SnapRect[] {
  return buttons
    .map((button, index) => ({
      index,
      x: Number(button.X),
      y: Number(button.Y),
      w: Number(button.Width),
      h: Number(button.Height),
    }))
    .filter((item) => item.index !== selected);
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
  magnetic,
  onPointerDown,
  onResizeStart,
  onClick,
}: {
  button: PdtdButton;
  selected: boolean;
  editable: boolean;
  mode: CanvasMode;
  magnetic: boolean;
  onPointerDown: (event: React.PointerEvent, index: number) => void;
  onResizeStart: (event: React.PointerEvent, dir: string, index: number) => void;
  onClick: (index: number) => void;
}) {
  const index = Number(button.__index ?? -1);
  return (
    <div
      className={`canvas-button ${selected ? 'selected' : ''} ${magnetic ? 'magnetic' : ''} ${isTitle(button) ? 'title' : ''}`}
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
  const previewProject = useEditor((state) => state.previewProject);
  const scale = useEditor((state) => state.scale);
  const snap = useEditor((state) => state.snap);
  const showGrid = useEditor((state) => state.showGrid);
  const beginTransaction = useEditor((state) => state.beginTransaction);
  const updateButton = useEditor((state) => state.updateButton);
  const selectButton = useEditor((state) => state.selectButton);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: null, y: null });
  const dragRef = useRef<DragState | null>(null);
  const activeSnapRef = useRef<Guides>({ x: null, y: null });
  const stageRef = useRef<HTMLDivElement | null>(null);

  const displayProject = previewProject ?? project;
  const screen = displayProject?.screens.find((item) => item.uid === displayProject.selectedScreenUid);
  const selectedIndex = displayProject?.selectedButtonIndex ?? null;
  const profile = profileForProject(displayProject);
  const preview = Boolean(previewProject);

  const portal = mode === 'portal';
  const canvasWidth = portal ? profile.portalWidth : profile.visibleWidth;
  const canvasHeight = portal ? profile.portalHeight : profile.visibleHeight;
  const fitScale = portal ? scale * 0.9 : scale;

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const scaleFactor = Math.max(0.1, fitScale);
      const threshold = 10 / scaleFactor;
      const release = 24 / scaleFactor;
      const roundValue = (value: number) => (snap ? Math.round(value / 10) * 10 : Math.round(value * 10) / 10);
      const dx = (event.clientX - current.startX) / fitScale;
      const dy = (event.clientY - current.startY) / fitScale;
      const originRect: SnapRect = { ...current.origin, index: current.index };
      let x = current.origin.x;
      let y = current.origin.y;
      let w = current.origin.w;
      let h = current.origin.h;

      if (current.type === 'move') {
        x = Math.max(-w + 20, Math.min(profile.visibleWidth - 20, current.origin.x + dx));
        y = Math.max(-h + 20, Math.min(profile.visibleHeight - 20, current.origin.y + dy));
        const snapX = snapMove(
          { x, y, w, h, index: current.index },
          current.others,
          'x',
          threshold,
          release,
          activeSnapRef.current.x,
        );
        const snapY = snapMove(
          { x, y, w, h, index: current.index },
          current.others,
          'y',
          threshold,
          release,
          activeSnapRef.current.y,
        );
        x = snapX.active ? snapX.value : roundValue(snapX.value);
        y = snapY.active ? snapY.value : roundValue(snapY.value);
        activeSnapRef.current = { x: snapX.active, y: snapY.active };
        setGuides({ x: snapX.active, y: snapY.active });
      } else {
        const min = 20;
        let left = current.origin.x;
        let top = current.origin.y;
        let right = current.origin.x + current.origin.w;
        let bottom = current.origin.y + current.origin.h;
        let snapX: ReturnType<typeof snapEdge> | null = null;
        let snapY: ReturnType<typeof snapEdge> | null = null;

        if (current.dir.includes('w')) {
          left = Math.min(right - min, current.origin.x + dx);
          snapX = snapEdge(left, 'left', originRect, current.others, 'x', threshold, release, activeSnapRef.current.x);
          left = snapX.active ? snapX.value : roundValue(snapX.value);
        }
        if (current.dir.includes('e')) {
          right = Math.max(left + min, current.origin.x + current.origin.w + dx);
          snapX = snapEdge(right, 'right', originRect, current.others, 'x', threshold, release, activeSnapRef.current.x);
          right = snapX.active ? snapX.value : roundValue(snapX.value);
        }
        if (current.dir.includes('n')) {
          top = Math.min(bottom - min, current.origin.y + dy);
          snapY = snapEdge(top, 'top', originRect, current.others, 'y', threshold, release, activeSnapRef.current.y);
          top = snapY.active ? snapY.value : roundValue(snapY.value);
        }
        if (current.dir.includes('s')) {
          bottom = Math.max(top + min, current.origin.y + current.origin.h + dy);
          snapY = snapEdge(bottom, 'bottom', originRect, current.others, 'y', threshold, release, activeSnapRef.current.y);
          bottom = snapY.active ? snapY.value : roundValue(snapY.value);
        }

        x = left;
        y = top;
        w = right - left;
        h = bottom - top;
        if (w < min) {
          if (current.dir.includes('w')) x = right - min;
          w = min;
          snapX = null;
        }
        if (h < min) {
          if (current.dir.includes('n')) y = bottom - min;
          h = min;
          snapY = null;
        }
        activeSnapRef.current = { x: snapX?.active ?? null, y: snapY?.active ?? null };
        setGuides({ x: snapX?.active ?? null, y: snapY?.active ?? null });
      }

      updateButton(current.screenUid, current.index, { X: x, Y: y, Width: w, Height: h }, false);
    };
    const up = () => {
      setDrag(null);
      dragRef.current = null;
      activeSnapRef.current = { x: null, y: null };
      setGuides({ x: null, y: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, fitScale, snap, updateButton, profile.visibleWidth, profile.visibleHeight]);

  const startMove = (event: React.PointerEvent, index: number) => {
    if (!screen) return;
    event.preventDefault();
    event.stopPropagation();
    const button = screen.compact.Body.Buttons[index];
    if (!button) return;
    selectButton(index);
    beginTransaction();
    activeSnapRef.current = { x: null, y: null };
    setGuides({ x: null, y: null });
    const state: DragState = {
      type: 'move',
      dir: '',
      startX: event.clientX,
      startY: event.clientY,
      screenUid: screen.uid,
      index,
      origin: { x: Number(button.X), y: Number(button.Y), w: Number(button.Width), h: Number(button.Height) },
      others: neighborRects(screen.compact.Body.Buttons, index),
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
    activeSnapRef.current = { x: null, y: null };
    setGuides({ x: null, y: null });
    const state: DragState = {
      type: 'resize',
      dir,
      startX: event.clientX,
      startY: event.clientY,
      screenUid: screen.uid,
      index,
      origin: { x: Number(button.X), y: Number(button.Y), w: Number(button.Width), h: Number(button.Height) },
      others: neighborRects(screen.compact.Body.Buttons, index),
    };
    dragRef.current = state;
    setDrag(state);
  };

  const portalButtons = useMemo(() => {
    if (!screen) return [];
    return screen.compact.Body.Buttons.map((button, index) => {
      const fx = profile.portalWidth / Number(screen.compact.Body.Width || profile.bodyWidth);
      const fy = profile.portalHeight / Number(screen.compact.Body.Height || profile.bodyHeight);
      return { button, index, x: Number(button.X) * fx, y: Number(button.Y) * fy, w: Number(button.Width) * fx, h: Number(button.Height) * fy };
    });
  }, [screen, profile.bodyWidth, profile.bodyHeight, profile.portalWidth, profile.portalHeight]);

  const magnetic = new Set<number>();
  if (guides.x) magnetic.add(guides.x.neighbor);
  if (guides.y) magnetic.add(guides.y.neighbor);

  if (!displayProject || !screen) {
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
        <strong>
          {mode === 'caja' ? 'Caja' : 'Editor'} {profile.short} - {profile.visibleWidth}x{profile.visibleHeight}
        </strong>
        <span>{mode === 'caja' ? 'Así se ve en el POS.' : 'Arrastra para mover · usa las esquinas para redimensionar · clic en el fondo para deseleccionar.'}</span>
      </div>
      <div
        className="canvas-frame"
        style={{ width: profile.visibleWidth * fitScale, height: profile.visibleHeight * fitScale }}
      >
        <div
          className={`screen-surface ${showGrid && mode === 'editor' ? 'with-grid' : ''}`}
          style={{
            width: profile.visibleWidth,
            height: profile.visibleHeight,
            transform: `scale(${fitScale})`,
          }}
          onPointerDown={() => {
            if (mode === 'editor') selectButton(null);
          }}
        >
          {screen.compact.Body.Buttons.map((button, index) => (
            <ButtonView
              key={index}
              button={{ ...button, __index: index }}
              selected={mode === 'editor' && selectedIndex === index}
              editable={mode === 'editor' && !preview}
              mode={mode}
              magnetic={mode === 'editor' && magnetic.has(index)}
              onPointerDown={startMove}
              onResizeStart={startResize}
              onClick={selectButton}
            />
          ))}
          {mode === 'editor' && guides.x ? (
            <div className="snap-guide snap-guide-x" style={{ left: guides.x.guide }} />
          ) : null}
          {mode === 'editor' && guides.y ? (
            <div className="snap-guide snap-guide-y" style={{ top: guides.y.guide }} />
          ) : null}
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
