import { useEffect, useRef, useState } from 'react';
import type { ElementKind, PdtdButton, PdtdScreen, ZoneId } from '../types';
import { ZONES, ZONE_LABELS, elementAsButton, hasZone, isTitle, textAsButton, zoneElements, zoneOffsets } from '../lib/pdtd';
import { profileForProject } from '../lib/profiles';
import type { ActiveSnap, SnapRect } from '../lib/snapping';
import { snapEdge, snapMove } from '../lib/snapping';
import { DEFAULT_TEXT_COLOR, cssColor, fontCss, fontPixels, imageDataUrl, imageFit, splitAlignment } from '../lib/textStyle';
import { useEditor } from '../store';

type CanvasMode = 'editor' | 'caja' | 'portal';

interface DragState {
  type: 'move' | 'resize';
  dir: string;
  startX: number;
  startY: number;
  screenUid: string;
  zone: ZoneId;
  kind: ElementKind;
  index: number;
  origin: { x: number; y: number; w: number; h: number };
  others: SnapRect[];
  limitY: number;
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

interface ElementRef {
  zone: ZoneId;
  kind: ElementKind;
  index: number;
}

function parseFontSize(button: PdtdButton): number {
  return fontPixels(button.Text?.Font?.Size);
}

/** Acción de navegación que la vista Caja puede simular para un botón. */
type Navigation = { type: 'goto'; target: number } | { type: 'rewind' } | { type: 'reset' };

function isTrue(value: unknown): boolean {
  return value === true || value === 1 || String(value).toLowerCase() === 'true' || value === '1';
}

function navigationOf(button: PdtdButton): Navigation | null {
  const target = gotoScreenTarget(button);
  if (target !== null) return { type: 'goto', target };
  const actions = button.Actions ?? [];
  if (actions.some((action) => String(action.Type) === 'rewind' && isTrue(action.Value))) return { type: 'rewind' };
  if (actions.some((action) => String(action.Type) === 'reset' && isTrue(action.Value))) return { type: 'reset' };
  return null;
}

function alignmentStyle(button: PdtdButton): React.CSSProperties {
  const { vertical, horizontal } = splitAlignment(button.Text?.TextAlign);
  return {
    alignItems: vertical === 'Top' ? 'flex-start' : vertical === 'Bottom' ? 'flex-end' : 'center',
    justifyContent: horizontal === 'Left' ? 'flex-start' : horizontal === 'Right' ? 'flex-end' : 'center',
    textAlign: horizontal === 'Left' ? 'left' : horizontal === 'Right' ? 'right' : 'center',
  };
}

function textAlignment(button: PdtdButton): 'left' | 'right' | 'center' {
  const { horizontal } = splitAlignment(button.Text?.TextAlign);
  return horizontal === 'Left' ? 'left' : horizontal === 'Right' ? 'right' : 'center';
}

function InlineTextEditor({
  initialValue,
  textAlign,
  textStyle,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  textAlign: 'left' | 'right' | 'center';
  textStyle: React.CSSProperties;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (save) onCommit(value);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      className="canvas-inline-input"
      value={value}
      spellCheck={false}
      aria-label="Texto del botón"
      style={{ textAlign, ...textStyle }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
    />
  );
}

function gotoScreenTarget(button: PdtdButton): number | null {
  const actions = (button.Actions ?? [])
    .filter((action) => String(action.Type) === 'gotoScreen')
    .map((action, at) => ({ action, order: Number(action.Index) || at + 1 }))
    .sort((left, right) => left.order - right.order);
  const value = Number(actions[0]?.action.Value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buttonStyle(button: PdtdButton, selected: boolean, editable: boolean, navigable: boolean): React.CSSProperties {
  const image = String(button.Icon?.Imagen ?? '');
  return {
    left: Number(button.X),
    top: Number(button.Y),
    width: Number(button.Width),
    height: Number(button.Height),
    backgroundColor: cssColor(button.Text?.BackColor ?? '0,0,0', 'transparent'),
    color: cssColor(button.Text?.Color ?? '255,255,255', DEFAULT_TEXT_COLOR),
    backgroundImage: image ? `url(${imageDataUrl(image)})` : undefined,
    ...imageFit(button.Icon?.SizeMode),
    backgroundRepeat: 'no-repeat',
    fontFamily: button.Text?.Font?.Family || 'Arial Black',
    fontSize: parseFontSize(button),
    ...fontCss(button.Text?.Font?.FontStyle),
    // La Caja no dibuja bordes: el lienzo tampoco. Las ayudas de edición salen al pasar el cursor.
    outline: selected ? '3px solid #f4511e' : 'none',
    cursor: editable ? 'move' : navigable ? 'pointer' : 'default',
    border: '0',
  };
}

function ButtonView({
  button,
  selected,
  editable,
  editing,
  navigable,
  navigationTitle,
  plainText,
  mode,
  magnetic,
  onPointerDown,
  onResizeStart,
  onClick,
  onActivate,
  onStartEdit,
  onCommitText,
  onCancelEdit,
}: {
  button: PdtdButton;
  selected: boolean;
  editable: boolean;
  editing: boolean;
  navigable: boolean;
  navigationTitle?: string;
  plainText?: boolean;
  mode: CanvasMode;
  magnetic: boolean;
  onPointerDown: (event: React.PointerEvent, index: number) => void;
  onResizeStart: (event: React.PointerEvent, dir: string, index: number) => void;
  onClick: (index: number) => void;
  onActivate: (index: number) => void;
  onStartEdit: (index: number, timeStamp: number) => void;
  onCommitText: (index: number, value: string) => void;
  onCancelEdit: () => void;
}) {
  const index = Number(button.__index ?? -1);
  return (
    <div
      className={`canvas-button ${selected ? 'selected' : ''} ${editing ? 'editing' : ''} ${magnetic ? 'magnetic' : ''} ${navigable ? 'navigable' : ''} ${isTitle(button) ? 'title' : ''} ${plainText ? 'zone-text' : ''} ${editable ? 'editable' : ''} ${editable && isBlank(button) ? 'blank' : ''}`}
      style={buttonStyle(button, selected, editable, navigable)}
      title={navigable ? navigationTitle : undefined}
      onPointerDown={(event) => {
        if (!editable || editing) return;
        onPointerDown(event, index);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (editable) onClick(index);
        else if (navigable && event.detail < 2) onActivate(index);
      }}
      onDoubleClick={(event) => {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        onStartEdit(index, event.timeStamp);
      }}
    >
      {editing ? (
        <InlineTextEditor
          initialValue={button.Text?.Text ?? ''}
          textAlign={textAlignment(button)}
          textStyle={fontCss(button.Text?.Font?.FontStyle)}
          onCommit={(value) => onCommitText(index, value)}
          onCancel={onCancelEdit}
        />
      ) : (
        <span className="canvas-label" style={{ ...alignmentStyle(button), ...fontCss(button.Text?.Font?.FontStyle) }}>
          {button.Text?.Text}
        </span>
      )}
      {editable && selected && !editing
        ? HANDLES.map((dir) => (
            <span
              key={dir}
              className={`resize-handle handle-${dir}`}
              onPointerDown={(event) => onResizeStart(event, dir, index)}
            />
          ))
        : null}
      {editable && !editing ? <span className="button-index">{index + 1}</span> : null}
      {mode === 'editor' && imageBadge(button)}
    </div>
  );
}

/** Elemento que la Caja no dibujaría: sin texto, sin imagen y sin fondo. */
function isBlank(button: PdtdButton): boolean {
  return !button.Text?.Text && !button.Icon?.Imagen && !String(button.Text?.BackColor ?? '').trim();
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
  const selectScreen = useEditor((state) => state.selectScreen);
  const setMessage = useEditor((state) => state.setMessage);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: null, y: null });
  const [editing, setEditing] = useState<ElementRef | null>(null);
  const visitedRef = useRef<string[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const activeSnapRef = useRef<Guides>({ x: null, y: null });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastPointerDownRef = useRef<{ key: string; at: number } | null>(null);

  const displayProject = previewProject ?? project;
  const screen = displayProject?.screens.find((item) => item.uid === displayProject.selectedScreenUid);
  const selectedIndex = displayProject?.selectedButtonIndex ?? null;
  const selectedZone: ZoneId = displayProject?.selectedZone ?? 'Body';
  const selectedKind: ElementKind = displayProject?.selectedKind ?? 'button';
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
        y = Math.max(-h + 20, Math.min(current.limitY - 20, current.origin.y + dy));
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
  }, [drag, fitScale, snap, updateButton, profile.visibleWidth]);

  const refKey = (ref: ElementRef) => `${ref.zone}:${ref.kind}:${ref.index}`;
  const sameRef = (left: ElementRef | null, right: ElementRef) =>
    Boolean(left && left.zone === right.zone && left.kind === right.kind && left.index === right.index);
  const elementOf = (ref: ElementRef): PdtdButton | undefined =>
    screen ? elementAsButton(screen.compact, ref.zone, ref.kind, ref.index) : undefined;
  const zoneLimit = (compact: PdtdScreen, zone: ZoneId) =>
    zone === 'Body' ? profile.visibleHeight : Math.max(20, Number(compact[zone].Height) || 0);

  const beginDrag = (event: React.PointerEvent, ref: ElementRef, type: 'move' | 'resize', dir: string) => {
    if (!screen) return;
    const button = elementOf(ref);
    if (!button) return;
    selectButton(ref.index, ref.zone, ref.kind);
    beginTransaction();
    activeSnapRef.current = { x: null, y: null };
    setGuides({ x: null, y: null });
    const list = zoneElements(screen.compact, ref.zone, ref.kind) as PdtdButton[];
    const state: DragState = {
      type,
      dir,
      startX: event.clientX,
      startY: event.clientY,
      screenUid: screen.uid,
      zone: ref.zone,
      kind: ref.kind,
      index: ref.index,
      origin: { x: Number(button.X), y: Number(button.Y), w: Number(button.Width), h: Number(button.Height) },
      others: neighborRects(list, ref.index),
      limitY: zoneLimit(screen.compact, ref.zone),
    };
    dragRef.current = state;
    setDrag(state);
  };

  const startMove = (event: React.PointerEvent, ref: ElementRef) => {
    if (!screen) return;
    if (editing !== null) {
      if (!sameRef(editing, ref)) (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // preventDefault evita el cambio de foco; se quita a mano para que las flechas muevan el elemento.
    (document.activeElement as HTMLElement | null)?.blur();
    const now = event.timeStamp;
    const previous = lastPointerDownRef.current;
    lastPointerDownRef.current = { key: refKey(ref), at: now };
    if (previous && previous.key === refKey(ref) && now - previous.at < 400) {
      selectButton(ref.index, ref.zone, ref.kind);
      return;
    }
    beginDrag(event, ref, 'move', '');
  };

  const startResize = (event: React.PointerEvent, dir: string, ref: ElementRef) => {
    event.preventDefault();
    event.stopPropagation();
    beginDrag(event, ref, 'resize', dir);
  };

  const startEdit = (ref: ElementRef, timeStamp: number) => {
    if (mode !== 'editor' || preview || !screen) return;
    const previous = lastPointerDownRef.current;
    if (!previous || previous.key !== refKey(ref) || timeStamp - previous.at > 400) beginTransaction();
    selectButton(ref.index, ref.zone, ref.kind);
    setEditing(ref);
  };

  const commitText = (ref: ElementRef, value: string) => {
    setEditing(null);
    if (!screen) return;
    const button = elementOf(ref);
    if (!button) return;
    const text = value.trim();
    if ((button.Text?.Text ?? '') === text) return;
    selectButton(ref.index, ref.zone, ref.kind);
    updateButton(screen.uid, ref.index, { Text: { ...button.Text, Text: text } }, false);
  };

  const cancelEdit = () => setEditing(null);

  const portalButtons = (screen?.compact.Body.Buttons ?? []).map((button, index) => {
    const body = screen!.compact.Body;
    const fx = profile.portalWidth / Number(body.Width || profile.bodyWidth);
    const fy = profile.portalHeight / Number(body.Height || profile.bodyHeight);
    return { button, index, x: Number(button.X) * fx, y: Number(button.Y) * fy, w: Number(button.Width) * fx, h: Number(button.Height) * fy };
  });

  const magnetic = new Set<number>();
  if (guides.x) magnetic.add(guides.x.neighbor);
  if (guides.y) magnetic.add(guides.y.neighbor);

  if (!displayProject || !screen) {
    return <div className="empty-stage">Importa un archivo Web o Caja para comenzar.</div>;
  }

  const describeNavigation = (navigation: Navigation | null): string | undefined => {
    if (!navigation) return undefined;
    if (navigation.type === 'rewind') return 'Regresar a la pantalla anterior';
    if (navigation.type === 'reset') return 'Reiniciar: volver a la primera pantalla';
    const target = displayProject.screens.find((item) => Number(item.compact.Index) === navigation.target);
    return target
      ? `Ir a pantalla ${navigation.target} · ${target.compact.Id}`
      : `Pantalla ${navigation.target} no encontrada`;
  };

  const activateButton = (ref: ElementRef) => {
    if (mode !== 'caja') return;
    const button = elementOf(ref);
    const navigation = button ? navigationOf(button) : null;
    if (!navigation) return;
    if (navigation.type === 'rewind') {
      const previousUid = visitedRef.current.pop();
      const previous = displayProject.screens.find((item) => item.uid === previousUid);
      if (previous) selectScreen(previous.uid);
      else setMessage('No hay una pantalla anterior a la cual regresar.');
      return;
    }
    if (navigation.type === 'reset') {
      visitedRef.current = [];
      const first = displayProject.screens[0];
      if (first && first.uid !== screen.uid) selectScreen(first.uid);
      return;
    }
    const target = displayProject.screens.find((item) => Number(item.compact.Index) === navigation.target);
    if (!target) {
      setMessage(`No encontré la pantalla ${navigation.target} en este proyecto.`);
      return;
    }
    visitedRef.current = [...visitedRef.current.slice(-50), screen.uid];
    selectScreen(target.uid);
  };

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
                  backgroundColor: cssColor(button.Text?.BackColor ?? '0,0,0', 'transparent'),
                  color: cssColor(button.Text?.Color ?? '255,255,255', DEFAULT_TEXT_COLOR),
                  fontFamily: button.Text?.Font?.Family || 'Arial Black',
                  fontSize: fontPixels(button.Text?.Font?.Size),
                  ...fontCss(button.Text?.Font?.FontStyle),
                }}
              >
                <span style={fontCss(button.Text?.Font?.FontStyle)}>{button.Text?.Text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const offsets = zoneOffsets(screen.compact);
  const zoned = hasZone(screen.compact, 'Header') || hasZone(screen.compact, 'Footer');
  const isEmpty = ZONES.every(
    (zone) => !screen.compact[zone].Buttons?.length && !screen.compact[zone].Texts?.length,
  );

  const renderElements = (zone: ZoneId, kind: ElementKind) =>
    (zoneElements(screen.compact, zone, kind) as PdtdButton[]).map((item, index) => {
      const ref: ElementRef = { zone, kind, index };
      const button = kind === 'text' ? textAsButton(item) : item;
      const navigation = mode === 'caja' && kind === 'button' ? navigationOf(button) : null;
      const isSelected = selectedIndex === index && selectedZone === zone && selectedKind === kind;
      const dragging = drag && drag.zone === zone && drag.kind === kind;
      return (
        <ButtonView
          key={`${kind}-${index}`}
          button={{ ...button, __index: index }}
          selected={mode === 'editor' && isSelected}
          editable={mode === 'editor' && !preview}
          editing={mode === 'editor' && !preview && sameRef(editing, ref)}
          navigable={navigation !== null}
          navigationTitle={describeNavigation(navigation)}
          plainText={kind === 'text'}
          mode={mode}
          magnetic={mode === 'editor' && Boolean(dragging) && magnetic.has(index)}
          onPointerDown={(event) => startMove(event, ref)}
          onResizeStart={(event, dir) => startResize(event, dir, ref)}
          onClick={() => selectButton(index, zone, kind)}
          onActivate={() => activateButton(ref)}
          onStartEdit={(_, timeStamp) => startEdit(ref, timeStamp)}
          onCommitText={(_, value) => commitText(ref, value)}
          onCancelEdit={cancelEdit}
        />
      );
    });

  const renderGuides = (zone: ZoneId) =>
    mode === 'editor' && drag && drag.zone === zone ? (
      <>
        {guides.x ? <div className="snap-guide snap-guide-x" style={{ left: guides.x.guide }} /> : null}
        {guides.y ? <div className="snap-guide snap-guide-y" style={{ top: guides.y.guide }} /> : null}
      </>
    ) : null;

  return (
    <div className="stage-scroll" ref={stageRef}>
      <div className="canvas-caption">
        <strong>
          {mode === 'caja' ? 'Caja' : 'Editor'} {profile.short} - {profile.visibleWidth}x{profile.visibleHeight}
        </strong>
        <span>{mode === 'caja' ? 'Así se ve en el POS. Haz clic en un botón con Ir a pantalla o Regresar para navegar.' : 'Doble clic en un botón para escribir · arrastra para mover · usa las esquinas para redimensionar · clic en el fondo para deseleccionar.'}</span>
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
            if (editing !== null) (document.activeElement as HTMLElement | null)?.blur();
            if (mode === 'editor') selectButton(null);
          }}
        >
          {ZONES.filter((zone) => hasZone(screen.compact, zone)).map((zone) => {
            const data = screen.compact[zone];
            const height = zone === 'Body' && !zoned ? profile.visibleHeight : Math.max(0, Number(data.Height) || 0);
            return (
              <div
                key={zone}
                className={`screen-zone zone-${zone.toLowerCase()} ${zoned && mode === 'editor' && showGrid ? 'zoned' : ''} ${zoned && mode === 'caja' ? 'clip' : ''}`}
                style={{
                  top: offsets[zone],
                  height,
                  backgroundColor: zone === 'Body' ? undefined : cssColor(data.BackColor, 'transparent'),
                }}
              >
                {zoned && mode === 'editor' && showGrid ? <span className="zone-tag">{ZONE_LABELS[zone]}</span> : null}
                {renderElements(zone, 'text')}
                {renderElements(zone, 'button')}
                {renderGuides(zone)}
              </div>
            );
          })}
          {mode === 'editor' && isEmpty ? (
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
