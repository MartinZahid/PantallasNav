import type { ProfileId, Project } from '../types';
import { normalizeProject } from './pdtd';
import { profileForProject } from './profiles';

export const LOCAL_STORAGE_PREFIX = 'editor-pantallas-project-v1';

const LAST_PROFILE_KEY = `${LOCAL_STORAGE_PREFIX}-last-profile`;
const LEGACY_KEY = 'editor-pantallas-1280-project-v1';

export function localKeyForProfile(profileId: ProfileId): string {
  return `${LOCAL_STORAGE_PREFIX}-${profileId}`;
}

export function saveLocalProject(project: Project): void {
  const profileId = profileForProject(project).id;
  localStorage.setItem(localKeyForProfile(profileId), JSON.stringify(project));
  localStorage.setItem(LAST_PROFILE_KEY, profileId);
}

function parseStoredProject(raw: string): Project | null {
  try {
    return normalizeProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadLocalProject(): Project | null {
  try {
    const preferred = localStorage.getItem(LAST_PROFILE_KEY);
    const profiles: ProfileId[] = preferred === '1080' ? ['1080', '1280'] : ['1280', '1080'];
    for (const profileId of profiles) {
      const raw = localStorage.getItem(localKeyForProfile(profileId));
      if (!raw) continue;
      const project = parseStoredProject(raw);
      if (project) return project;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const project = parseStoredProject(legacy);
    if (!project) return null;
    try {
      saveLocalProject(project);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Si no se puede migrar, el proyecto igualmente se devuelve normalizado.
    }
    return project;
  } catch {
    return null;
  }
}

export function localStorageFailureMessage(error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  ) {
    return 'el almacenamiento del navegador está lleno; exporta el proyecto para no perder cambios';
  }
  return 'el navegador no permitió guardar el proyecto';
}
