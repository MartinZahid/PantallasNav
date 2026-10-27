export interface SnapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  index: number;
}

export interface SnapCandidate {
  axis: 'x' | 'y';
  key: string;
  value: number;
  guide: number;
  neighbor: number;
  sameSize: boolean;
  kind: 'align' | 'dock';
}

export interface ActiveSnap extends SnapCandidate {}

export interface SnapResult {
  value: number;
  active: ActiveSnap | null;
}

const DOCK_GAP = 10;
const SIZE_TOLERANCE = 2;

function sameSize(rect: SnapRect, other: SnapRect): boolean {
  return Math.abs(rect.w - other.w) <= SIZE_TOLERANCE && Math.abs(rect.h - other.h) <= SIZE_TOLERANCE;
}

function candidate(
  axis: 'x' | 'y',
  key: string,
  value: number,
  guide: number,
  neighbor: number,
  same: boolean,
  kind: 'align' | 'dock',
): SnapCandidate {
  return { axis, key, value, guide, neighbor, sameSize: same, kind };
}

export function moveCandidates(rect: SnapRect, others: SnapRect[], axis: 'x' | 'y'): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  const size = axis === 'x' ? rect.w : rect.h;
  const prefix = axis;

  for (const other of others) {
    const otherStart = axis === 'x' ? other.x : other.y;
    const otherSize = axis === 'x' ? other.w : other.h;
    const otherEnd = otherStart + otherSize;
    const same = sameSize(rect, other);

    result.push(
      candidate(axis, `${prefix}-left-${other.index}`, otherStart, otherStart, other.index, same, 'align'),
      candidate(axis, `${prefix}-right-${other.index}`, otherEnd - size, otherEnd, other.index, same, 'align'),
      candidate(
        axis,
        `${prefix}-center-${other.index}`,
        otherStart + otherSize / 2 - size / 2,
        otherStart + otherSize / 2,
        other.index,
        same,
        'align',
      ),
      candidate(
        axis,
        `${prefix}-dock-after-${other.index}`,
        otherEnd + DOCK_GAP,
        otherEnd,
        other.index,
        same,
        'dock',
      ),
      candidate(
        axis,
        `${prefix}-dock-before-${other.index}`,
        otherStart - size - DOCK_GAP,
        otherStart,
        other.index,
        same,
        'dock',
      ),
    );
  }

  return result;
}

export function edgeCandidates(
  side: 'left' | 'right' | 'top' | 'bottom',
  origin: SnapRect,
  others: SnapRect[],
  axis: 'x' | 'y',
): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  const isStart = side === 'left' || side === 'top';
  const prefix = axis;

  for (const other of others) {
    const otherStart = axis === 'x' ? other.x : other.y;
    const otherSize = axis === 'x' ? other.w : other.h;
    const otherEnd = otherStart + otherSize;
    const same = sameSize(origin, other);
    const alignValue = isStart ? otherStart : otherEnd;

    result.push(
      candidate(axis, `${prefix}-edge-align-${side}-${other.index}`, alignValue, alignValue, other.index, same, 'align'),
      candidate(
        axis,
        `${prefix}-edge-center-${side}-${other.index}`,
        otherStart + otherSize / 2,
        otherStart + otherSize / 2,
        other.index,
        same,
        'align',
      ),
      candidate(
        axis,
        `${prefix}-edge-dock-before-${side}-${other.index}`,
        otherStart - DOCK_GAP,
        otherStart,
        other.index,
        same,
        'dock',
      ),
      candidate(
        axis,
        `${prefix}-edge-dock-after-${side}-${other.index}`,
        otherEnd + DOCK_GAP,
        otherEnd,
        other.index,
        same,
        'dock',
      ),
    );
  }

  return result;
}

export function pickSnap(
  candidates: SnapCandidate[],
  raw: number,
  threshold: number,
  release: number,
  active: ActiveSnap | null,
): SnapResult {
  if (active) {
    const held = candidates.find(
      (item) =>
        item.key === active.key &&
        item.neighbor === active.neighbor &&
        Math.abs(item.value - raw) <= (item.sameSize ? release : threshold),
    );
    if (held) return { value: held.value, active: held };
  }

  const best = candidates
    .map((item) => ({ item, distance: Math.abs(item.value - raw) }))
    .filter((item) => item.distance <= threshold)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.item.kind !== b.item.kind) return a.item.kind === 'align' ? -1 : 1;
      return a.item.neighbor - b.item.neighbor;
    })[0]?.item;

  return best ? { value: best.value, active: best } : { value: raw, active: null };
}

export function snapMove(
  rect: SnapRect,
  others: SnapRect[],
  axis: 'x' | 'y',
  threshold: number,
  release: number,
  active: ActiveSnap | null,
): SnapResult {
  const raw = axis === 'x' ? rect.x : rect.y;
  return pickSnap(moveCandidates(rect, others, axis), raw, threshold, release, active);
}

export function snapEdge(
  edge: number,
  side: 'left' | 'right' | 'top' | 'bottom',
  origin: SnapRect,
  others: SnapRect[],
  axis: 'x' | 'y',
  threshold: number,
  release: number,
  active: ActiveSnap | null,
): SnapResult {
  return pickSnap(edgeCandidates(side, origin, others, axis), edge, threshold, release, active);
}
