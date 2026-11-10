import type { DesignProfile, Json, PdtdButton, PdtdScreen, ProfileId, Project } from '../types';
import { profileForId } from './profiles';
import {
  DEFAULT_HEADER,
  clampHeaderHeight,
  clone,
  isTitle,
  makeHeaderElements,
  makeTitle,
  textAsButton,
} from './pdtd';

const MAX_SIDE = 340;

/** Margen y separación de la cuadrícula según el tamaño del plano destino. */
function spacing(profile: DesignProfile): { margin: number; gap: number } {
  if (profile.visibleWidth >= 900) return { margin: 24, gap: 16 };
  if (profile.visibleWidth >= 550) return { margin: 24, gap: 10 };
  return { margin: 8, gap: 8 };
}

function chooseLayout(n: number, top: number, bottom: number, visibleWidth: number, margin: number, gap: number) {
  const availableWidth = visibleWidth - margin * 2;
  const availableHeight = Math.max(1, bottom - top);
  let best: { cols: number; rows: number; side: number; score: number } | null = null;
  for (let cols = 1; cols <= 8; cols += 1) {
    const rows = Math.max(1, Math.ceil(n / cols));
    const side = Math.min(
      (availableWidth - (cols - 1) * gap) / cols,
      (availableHeight - (rows - 1) * gap) / rows,
      MAX_SIDE,
    );
    if (!Number.isFinite(side) || side < 20) continue;
    const empty = cols * rows - n;
    const score = side - empty * 3;
    if (!best || score > best.score || (score === best.score && cols > best.cols)) {
      best = { cols, rows, side, score };
    }
  }
  if (!best) return { cols: 1, rows: Math.max(1, n), side: 20 };
  return { cols: best.cols, rows: best.rows, side: Math.floor(best.side + 1e-9) };
}

function fitTitle(button: PdtdButton, visibleWidth: number): void {
  const maxWidth = visibleWidth - 48;
  const oldWidth = Math.max(1, Number(button.Width) || 1);
  const width = Math.min(oldWidth, maxWidth);
  button.Width = width;
  button.X = Math.round((visibleWidth - width) / 2 * 10) / 10;
  if (width < oldWidth) {
    const font = button.Text?.Font;
    if (font) {
      const size = Number(font.Size) || 21;
      font.Size = Math.max(12, Math.round((size * (width / oldWidth)) * 10) / 10);
    }
  }
}

/** Banner de título para el cuerpo a partir del texto de un encabezado, conservando su estilo. */
function titleFromHeaderText(text: Json, profile: DesignProfile): PdtdButton {
  const source = textAsButton(text);
  const title = makeTitle(source.Text.Text, profile);
  if (source.Text.Color) title.Text.Color = source.Text.Color;
  title.Text.BackColor = source.Text.BackColor;
  if (!source.Text.BackColor && !source.Text.Color) title.Text.Color = '';
  if (source.Text.Font.Family) title.Text.Font.Family = source.Text.Font.Family;
  title.Text.Font.FontStyle = source.Text.Font.FontStyle;
  return title;
}

/**
 * Deja la pantalla sin encabezado ni pie: su contenido pasa al cuerpo.
 * Devuelve los botones que venían de esas zonas, para colocarlos junto al título.
 */
function flattenZones(screen: PdtdScreen, profile: DesignProfile): PdtdButton[] {
  const body = screen.Body.Buttons;
  const moved: PdtdButton[] = [];
  for (const zone of [screen.Header, screen.Footer]) {
    // Los botones de la zona (inicio, regresar, logotipos…) se conservan como botones del cuerpo.
    moved.push(...zone.Buttons);
    zone.Buttons = [];
  }
  const headerTexts = screen.Header.Texts ?? [];
  const hasBodyTitle = body.some(isTitle);
  const titles = !hasBodyTitle && headerTexts.length ? [titleFromHeaderText(headerTexts[0], profile)] : [];
  screen.Header.Texts = [];
  screen.Footer.Texts = [];
  // Se conserva el orden de izquierda a derecha que tenían en su zona.
  moved.sort((left, right) => Number(left.X) - Number(right.X));
  screen.Body.Buttons = [...titles, ...moved, ...body];
  return moved;
}

/**
 * Coloca los botones que venían del encabezado en la fila del título: el primero a la
 * izquierda y el resto a la derecha, con el título entre ellos. Devuelve el borde inferior.
 */
function layoutTitleRow(
  pinned: PdtdButton[],
  title: PdtdButton | undefined,
  profile: DesignProfile,
  margin: number,
  gap: number,
): number {
  const rowTop = title ? Number(title.Y) : margin;
  const rowHeight = title ? Number(title.Height) : 64;
  const side = Math.min(64, rowHeight);
  const y = Math.round(rowTop + (rowHeight - side) / 2);
  const rightCount = pinned.length - 1;
  pinned.forEach((button, index) => {
    button.Width = side;
    button.Height = side;
    button.Y = y;
    button.X =
      index === 0 ? margin : profile.visibleWidth - margin - side - (rightCount - index) * (side + gap);
  });
  if (title) {
    const left = margin + side + gap;
    const right = profile.visibleWidth - margin - rightCount * (side + gap);
    // El título conserva al menos el ancho con el que el editor lo reconoce como título.
    const width = Math.max(350, Math.min(Number(title.Width), right - left));
    title.Width = width;
    title.X = Math.round((left + (right - left - width) / 2) * 10) / 10;
  }
  return rowTop + rowHeight;
}

/** Pasa el título del cuerpo a un encabezado nuevo con inicio y regresar. */
function buildHeader(screen: PdtdScreen, height: number, profile: DesignProfile): void {
  const bodyTitle = screen.Body.Buttons.find(isTitle);
  const text = bodyTitle?.Text?.Text || String(screen.Id ?? '').toUpperCase();
  const base = makeHeaderElements(text, height, profile);
  screen.Header.Buttons = base.buttons;
  screen.Header.Texts = base.texts;
  screen.Body.Buttons = screen.Body.Buttons.filter((button) => !isTitle(button));
}

/**
 * Convierte el proyecto a otro plano. Reacomoda los botones del cuerpo en una cuadrícula
 * dentro del área visible y conserva textos, colores, fuentes, acciones e imágenes.
 * Hacia un plano con zonas se crea el encabezado (si está activado en el proyecto);
 * desde uno con zonas, el encabezado se integra al cuerpo.
 */
export function convertProjectProfile(project: Project, profileId: ProfileId): Project {
  const profile = profileForId(profileId);
  const { margin, gap } = spacing(profile);
  const next = clone(project);
  next.profileId = profile.id;
  next.selectedButtonIndex = null;
  next.selectedZone = 'Body';
  next.selectedKind = 'button';
  if (next.webBase) {
    next.webBase.ScreenSize = profile.screenSize;
    next.webBase.OriginalScreenSize = profile.originalScreenSize;
  }
  const zoned = Boolean(profile.cajaOnly);
  const header = zoned ? next.headerDefaults ?? { ...DEFAULT_HEADER } : { enabled: false, height: 0 };
  if (zoned) next.headerDefaults = { enabled: header.enabled, height: clampHeaderHeight(header.height) };
  else delete next.headerDefaults;
  const headerHeight = zoned && header.enabled ? clampHeaderHeight(header.height) : 0;

  for (const projectScreen of next.screens) {
    const screen = projectScreen.compact;
    projectScreen.webRaw = undefined;
    // Con encabezado en el destino, los botones del encabezado anterior se sustituyen por los nuevos.
    const fromZones = flattenZones(screen, profile);
    const pinned = new Set(headerHeight > 0 ? [] : fromZones);
    if (headerHeight > 0) {
      screen.Body.Buttons = screen.Body.Buttons.filter((button) => !fromZones.includes(button));
      buildHeader(screen, headerHeight, profile);
    }

    for (const zone of [screen.Header, screen.Body, screen.Footer]) zone.Width = profile.bodyWidth;
    screen.Header.Height = headerHeight;
    screen.Footer.Height = 0;
    screen.Body.Height = profile.bodyHeight - headerHeight;

    const buttons = screen.Body.Buttons;
    const titles = buttons.filter(isTitle);
    titles.forEach((button) => fitTitle(button, profile.visibleWidth));
    const interactive = buttons.filter((button) => !isTitle(button) && !pinned.has(button));
    const pinnedBottom = pinned.size ? layoutTitleRow([...pinned], titles[0], profile, margin, gap) : 0;
    if (!interactive.length) continue;

    const bodyVisible = profile.visibleHeight - headerHeight;
    const split = bodyVisible * 0.35;
    const topTitles = titles.filter((button) => Number(button.Y) < split);
    const bottomTitles = titles.filter((button) => Number(button.Y) >= split);
    const top = Math.max(
      topTitles.length
        ? Math.max(...topTitles.map((button) => Number(button.Y) + Number(button.Height))) + gap
        : margin,
      pinnedBottom ? pinnedBottom + gap : 0,
    );
    const bottom = bottomTitles.length
      ? Math.min(...bottomTitles.map((button) => Number(button.Y))) - gap
      : bodyVisible - margin;
    const safeBottom = Math.max(top + 40, bottom);
    const { cols, side } = chooseLayout(interactive.length, top, safeBottom, profile.visibleWidth, margin, gap);
    const gridWidth = cols * side + (cols - 1) * gap;
    const x0 = margin + (profile.visibleWidth - margin * 2 - gridWidth) / 2;

    interactive.forEach((button, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      button.X = Math.round((x0 + col * (side + gap)) * 10) / 10;
      button.Y = Math.round((top + row * (side + gap)) * 10) / 10;
      button.Width = side;
      button.Height = side;
      if (button.Text?.Text) button.Text.TextAlign = 'MiddleCenter';
    });
  }

  return next;
}
