import type { PdtdButton, ProfileId, Project } from '../types';
import { profileForId } from './profiles';
import { clone, isTitle } from './pdtd';

const MARGIN = 24;
const MAX_SIDE = 340;

function chooseLayout(n: number, top: number, bottom: number, visibleWidth: number, gap: number) {
  const availableWidth = visibleWidth - MARGIN * 2;
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

export function convertProjectProfile(project: Project, profileId: ProfileId): Project {
  const profile = profileForId(profileId);
  const gap = profile.id === '1080' ? 16 : 10;
  const next = clone(project);
  next.profileId = profile.id;
  if (next.webBase) {
    next.webBase.ScreenSize = profile.screenSize;
    next.webBase.OriginalScreenSize = profile.originalScreenSize;
  }

  for (const projectScreen of next.screens) {
    const screen = projectScreen.compact;
    screen.Header.Width = profile.bodyWidth;
    screen.Header.Height = 0;
    screen.Body.Width = profile.bodyWidth;
    screen.Body.Height = profile.bodyHeight;
    screen.Footer.Width = profile.bodyWidth;
    screen.Footer.Height = 0;

    const buttons = screen.Body.Buttons;
    const titles = buttons.filter(isTitle);
    titles.forEach((button) => fitTitle(button, profile.visibleWidth));

    const interactive = buttons.filter((button) => !isTitle(button));
    if (!interactive.length) {
      projectScreen.webRaw = undefined;
      continue;
    }

    const topTitles = titles.filter((button) => Number(button.Y) < 300);
    const bottomTitles = titles.filter((button) => Number(button.Y) >= 300);
    const top = topTitles.length
      ? Math.max(...topTitles.map((button) => Number(button.Y) + Number(button.Height))) + gap
      : 28;
    const bottom = bottomTitles.length
      ? Math.min(...bottomTitles.map((button) => Number(button.Y))) - gap
      : profile.visibleHeight - MARGIN;
    const safeBottom = Math.max(top + 40, bottom);
    const { cols, side } = chooseLayout(interactive.length, top, safeBottom, profile.visibleWidth, gap);
    const gridWidth = cols * side + (cols - 1) * gap;
    const x0 = MARGIN + (profile.visibleWidth - MARGIN * 2 - gridWidth) / 2;
    const y0 = top;

    interactive.forEach((button, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      button.X = Math.round((x0 + col * (side + gap)) * 10) / 10;
      button.Y = Math.round((y0 + row * (side + gap)) * 10) / 10;
      button.Width = side;
      button.Height = side;
      button.Text.TextAlign = 'MiddleCenter';
    });

    projectScreen.webRaw = undefined;
  }

  return next;
}
