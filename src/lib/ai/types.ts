import type { TemplateId } from '../pdtd';

export type AiProviderId = 'openai' | 'opencode';

export interface AiProviderSettings {
  baseUrl: string;
  model: string;
}

export interface AiSettings {
  activeProvider: AiProviderId;
  providers: Record<AiProviderId, AiProviderSettings>;
  customRules: string;
  allowCreateScreens: boolean;
  labMode: boolean;
}

export type AiScreenRef = string | number;
export type AiButtonSelector = 'all' | 'selected' | { text: string } | { index: number };

export type AiActionValue = string | number | boolean;

export interface AiLayoutOperation {
  op: 'layout';
  screen?: AiScreenRef;
  selector?: AiButtonSelector;
  strategy?: 'grid' | 'list' | 'row';
  columns?: number;
  gap?: number;
  padding?: number;
  startY?: number;
  includeTitles?: boolean;
  square?: boolean;
}

export interface AiStyleOperation {
  op: 'style';
  screen?: AiScreenRef;
  selector?: AiButtonSelector;
  text?: string;
  textColor?: string;
  backColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  textAlign?: string;
}

export interface AiActionOperation {
  op: 'action';
  screen?: AiScreenRef;
  selector?: AiButtonSelector;
  type: string;
  value?: AiActionValue;
  mode?: 'upsert' | 'replace';
}

export interface AiRemoveActionOperation {
  op: 'removeAction';
  screen?: AiScreenRef;
  selector?: AiButtonSelector;
  type: string;
}

export interface AiBodyColorOperation {
  op: 'bodyColor';
  screen?: AiScreenRef;
  color: string;
}

export interface AiNewButtonAction {
  type: string;
  value: AiActionValue;
}

export interface AiNewButton {
  text: string;
  productId?: number;
  gotoScreen?: number;
  addToList?: boolean;
  actions?: AiNewButtonAction[];
  backColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  textAlign?: string;
  width?: number;
  height?: number;
}

export interface AiCreateScreenOperation {
  op: 'createScreen';
  id?: string;
  title: string;
  template?: TemplateId;
  buttons?: AiNewButton[];
  columns?: number;
  bodyColor?: string;
}

export type AiOperation =
  | AiLayoutOperation
  | AiStyleOperation
  | AiActionOperation
  | AiRemoveActionOperation
  | AiBodyColorOperation
  | AiCreateScreenOperation;

export interface AiPlan {
  summary: string;
  operations: AiOperation[];
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  plan?: AiPlan;
  planDetails?: string[];
  planWarnings?: string[];
  planState?: 'pending' | 'applied' | 'discarded';
  createdAt: number;
}

export interface AiToolCallLog {
  name: string;
  arguments: string;
}

export interface AiLabLog {
  provider: AiProviderId;
  request: unknown;
  response: unknown;
  toolCalls: AiToolCallLog[];
  durationMs: number;
  at: number;
  error?: string;
}

export interface AiRuntimeConfig extends AiProviderSettings {
  id: AiProviderId;
  label: string;
  key: string;
}

export const AI_PROVIDERS: Record<AiProviderId, { label: string; baseUrl: string; model: string }> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  },
  opencode: {
    label: 'OpenCode Lab',
    baseUrl: '/api/opencode-go',
    model: 'deepseek-v4.1-flash',
  },
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  activeProvider: 'openai',
  providers: {
    openai: { baseUrl: AI_PROVIDERS.openai.baseUrl, model: '' },
    opencode: { baseUrl: AI_PROVIDERS.opencode.baseUrl, model: AI_PROVIDERS.opencode.model },
  },
  customRules: '',
  allowCreateScreens: true,
  labMode: false,
};
