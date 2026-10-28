import type { PdtdButton, Project, ProjectScreen } from '../../types';
import { profileForProject } from '../profiles';
import { isTitle } from '../pdtd';
import type { AiScreenRef } from './types';

export function screenByRef(project: Project, ref: AiScreenRef | undefined): ProjectScreen | null {
  if (ref === undefined || ref === null) {
    return project.screens.find((screen) => screen.uid === project.selectedScreenUid) ?? project.screens[0] ?? null;
  }
  if (typeof ref === 'number' || /^\d+$/.test(String(ref))) {
    const index = Number(ref);
    return project.screens.find((screen) => Number(screen.compact.Index) === index) ?? null;
  }
  const value = String(ref).trim().toLowerCase();
  return (
    project.screens.find((screen) => screen.uid.toLowerCase() === value) ??
    project.screens.find((screen) => String(screen.compact.Id).toLowerCase() === value) ??
    project.screens.find((screen) => String(screen.compact.Id).toLowerCase().includes(value)) ??
    null
  );
}

function buttonBrief(button: PdtdButton, index: number) {
  return {
    index,
    text: String(button.Text.Text ?? ''),
    x: Number(button.X),
    y: Number(button.Y),
    width: Number(button.Width),
    height: Number(button.Height),
    title: isTitle(button),
    hasImage: Boolean(button.Icon?.Imagen),
    style: {
      textColor: String(button.Text.Color ?? ''),
      backColor: String(button.Text.BackColor ?? ''),
      fontFamily: String(button.Text.Font?.Family ?? ''),
      fontSize: Number(button.Text.Font?.Size ?? 9),
      fontStyle: String(button.Text.Font?.FontStyle ?? ''),
      textAlign: String(button.Text.TextAlign ?? 'MiddleCenter'),
    },
    actions: (button.Actions ?? [])
      .filter((action) => String(action.Type) !== 'executionOrder')
      .map((action) => ({ type: String(action.Type), value: action.Value, index: action.Index })),
  };
}

function screenBrief(screen: ProjectScreen) {
  const buttons = screen.compact.Body.Buttons;
  return {
    uid: screen.uid,
    index: Number(screen.compact.Index),
    id: String(screen.compact.Id ?? ''),
    buttons: buttons.length,
    titles: buttons.filter(isTitle).length,
    backColor: String(screen.compact.Body.BackColor ?? ''),
  };
}

export function buildAiContext(project: Project): string {
  const profile = profileForProject(project);
  const selected = screenByRef(project, project.selectedScreenUid ?? undefined);
  const selectedButtons = selected ? selected.compact.Body.Buttons : [];
  const selectedButton =
    project.selectedButtonIndex !== null && selectedButtons[project.selectedButtonIndex]
      ? buttonBrief(selectedButtons[project.selectedButtonIndex], project.selectedButtonIndex)
      : null;

  const context = {
    project: {
      name: project.name,
      source: project.source,
      profile: {
        id: profile.id,
        visibleWidth: profile.visibleWidth,
        visibleHeight: profile.visibleHeight,
      },
      screenCount: project.screens.length,
      productCount: project.products.length,
      productFamilies: Array.from(new Set(project.products.map((product) => product.family).filter(Boolean))).slice(0, 40),
      selectedScreenUid: project.selectedScreenUid,
      selectedButtonIndex: project.selectedButtonIndex,
    },
    screens: project.screens.map(screenBrief),
    selectedScreen: selected
      ? {
          ...screenBrief(selected),
          buttons: selectedButtons.slice(0, 60).map(buttonBrief),
          truncated: selectedButtons.length > 60,
        }
      : null,
    selectedButton,
  };

  return [
    'CONTEXTO ACTUAL DEL EDITOR (JSON). Usa estos datos como fuente de verdad.',
    JSON.stringify(context, null, 2),
    'Los índices de botones son posiciones en Body.Buttons. Las pantallas se identifican por su Index o Id.',
  ].join('\n');
}

export function screenDetail(project: Project, ref: AiScreenRef): string {
  const screen = screenByRef(project, ref);
  if (!screen) return JSON.stringify({ error: 'Pantalla no encontrada.' });
  return JSON.stringify(
    {
      ...screenBrief(screen),
      uid: screen.uid,
      backColor: String(screen.compact.Body.BackColor ?? ''),
      buttons: screen.compact.Body.Buttons.slice(0, 80).map(buttonBrief),
      truncated: screen.compact.Body.Buttons.length > 80,
    },
    null,
    2,
  );
}

export function searchProducts(project: Project, query: string, limit = 20) {
  const value = query.trim().toLowerCase();
  const matches = project.products.filter((product) => {
    if (!value) return true;
    return [product.name, product.code, product.family, product.abbreviation, String(product.id)]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(value));
  });
  return matches.slice(0, Math.max(1, Math.min(50, limit))).map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    price: product.price,
    family: product.family,
  }));
}
