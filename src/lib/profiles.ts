import type { DesignProfile, ProfileId, Project, WebDesign } from '../types';

export const PROFILES: Record<ProfileId, DesignProfile> = {
  '1280': {
    id: '1280',
    label: '1280 × 1024',
    short: '1280',
    defaultName: 'Diseno 1280',
    visibleWidth: 588,
    visibleHeight: 843,
    bodyWidth: 768,
    bodyHeight: 1024,
    portalWidth: 1181,
    portalHeight: 708,
    screenSize: '1280×1024',
    originalScreenSize: '1280x976',
  },
  '1080': {
    id: '1080',
    label: '1920 × 1080',
    short: '1080',
    defaultName: 'Diseno 1080',
    visibleWidth: 975,
    visibleHeight: 863,
    bodyWidth: 1152,
    bodyHeight: 1080,
    portalWidth: 1181,
    portalHeight: 713,
    screenSize: '1920×1080',
    originalScreenSize: '1920x1040',
  },
};

export const PROFILE_1280 = PROFILES['1280'];

export function profileForId(id: ProfileId | string | undefined): DesignProfile {
  return id === '1080' ? PROFILES['1080'] : PROFILES['1280'];
}

export function profileForProject(project: Project | null | undefined): DesignProfile {
  if (project?.profileId) return profileForId(project.profileId);
  const body = project?.screens?.[0]?.compact?.Body;
  if (Number(body?.Width) >= 1000) return PROFILES['1080'];
  return PROFILES['1280'];
}

function screenSizeOf(value: unknown): string {
  return String(value ?? '').replace(/[×xX]/g, 'x').toLowerCase();
}

export function profileFromWeb(data: Partial<WebDesign> | null | undefined): ProfileId {
  const size = screenSizeOf(data?.ScreenSize);
  if (size.includes('1920') || size.includes('1080')) return '1080';
  const first = data?.Screens?.[0] as { Body?: { Width?: unknown } } | undefined;
  if (Number(first?.Body?.Width) >= 1000) return '1080';
  return '1280';
}

export function profileFromCaja(data: unknown): ProfileId {
  const first = Array.isArray(data) ? (data[0] as { Body?: { Width?: unknown } } | undefined) : undefined;
  if (Number(first?.Body?.Width) >= 1000) return '1080';
  return '1280';
}
