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
  // Plano 1024 x 768: la navegación ocupa 614.4 px (60 %) y se reparte en
  // Encabezado + Cuerpo + Pie. El área visible se deduce escalando el 1280 por 0.8.
  '1024': {
    id: '1024',
    label: '1024 × 768',
    short: '1024',
    defaultName: 'Diseno 1024',
    visibleWidth: 470.4,
    visibleHeight: 674.4,
    bodyWidth: 614.4,
    bodyHeight: 768,
    portalWidth: 1181,
    portalHeight: 708,
    screenSize: '1024×768',
    originalScreenSize: '1024x768',
    cajaOnly: true,
  },
};

export const PROFILE_1280 = PROFILES['1280'];

export function profileForId(id: ProfileId | string | undefined): DesignProfile {
  if (id === '1080') return PROFILES['1080'];
  if (id === '1024') return PROFILES['1024'];
  return PROFILES['1280'];
}

export function profileForProject(project: Project | null | undefined): DesignProfile {
  if (project?.profileId) return profileForId(project.profileId);
  return PROFILES[profileFromBodyWidth(project?.screens?.[0]?.compact?.Body?.Width)];
}

function profileFromBodyWidth(value: unknown): ProfileId {
  const width = Number(value);
  if (width >= 1000) return '1080';
  if (width > 0 && width < 700) return '1024';
  return '1280';
}

function screenSizeOf(value: unknown): string {
  return String(value ?? '').replace(/[×xX]/g, 'x').toLowerCase();
}

export function profileFromWeb(data: Partial<WebDesign> | null | undefined): ProfileId {
  const size = screenSizeOf(data?.ScreenSize);
  if (size.includes('1920') || size.includes('1080')) return '1080';
  const first = data?.Screens?.[0] as { Body?: { Width?: unknown } } | undefined;
  return profileFromBodyWidth(first?.Body?.Width);
}

export function profileFromCaja(data: unknown): ProfileId {
  const first = Array.isArray(data) ? (data[0] as { Body?: { Width?: unknown } } | undefined) : undefined;
  return profileFromBodyWidth(first?.Body?.Width);
}
