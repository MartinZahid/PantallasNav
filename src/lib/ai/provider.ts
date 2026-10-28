import {
  AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  type AiProviderId,
  type AiRuntimeConfig,
  type AiSettings,
} from './types';

const SETTINGS_KEY = 'editor-pantallas-ai-settings-v1';
const KEY_PREFIX = 'editor-pantallas-ai-key-';

export interface AiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: AiToolCall[];
}

export interface AiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiChatResult {
  content: string;
  toolCalls: AiToolCall[];
  raw: unknown;
}

export class AiProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
  }
}

function isProviderId(value: unknown): value is AiProviderId {
  return value === 'openai' || value === 'opencode';
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_AI_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const providers = { ...DEFAULT_AI_SETTINGS.providers };
    for (const id of Object.keys(AI_PROVIDERS) as AiProviderId[]) {
      const item = parsed.providers?.[id];
      providers[id] = {
        baseUrl: String(item?.baseUrl ?? AI_PROVIDERS[id].baseUrl),
        model: String(item?.model ?? AI_PROVIDERS[id].model),
      };
    }
    return {
      activeProvider: isProviderId(parsed.activeProvider)
        ? parsed.activeProvider
        : DEFAULT_AI_SETTINGS.activeProvider,
      providers,
      customRules: String(parsed.customRules ?? ''),
      allowCreateScreens: parsed.allowCreateScreens !== false,
      labMode: parsed.labMode === true,
    };
  } catch {
    return structuredClone(DEFAULT_AI_SETTINGS);
  }
}

export function saveAiSettings(settings: AiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // El proyecto sigue funcionando aunque el navegador bloquee localStorage.
  }
}

export function loadAiKey(provider: AiProviderId): string {
  try {
    return sessionStorage.getItem(`${KEY_PREFIX}${provider}`) ?? '';
  } catch {
    return '';
  }
}

export function saveAiKey(provider: AiProviderId, key: string) {
  try {
    if (key) sessionStorage.setItem(`${KEY_PREFIX}${provider}`, key);
    else sessionStorage.removeItem(`${KEY_PREFIX}${provider}`);
  } catch {
    // La clave no se persiste si sessionStorage no está disponible.
  }
}

export function runtimeConfig(settings: AiSettings, provider: AiProviderId): AiRuntimeConfig {
  return {
    id: provider,
    label: AI_PROVIDERS[provider].label,
    baseUrl: settings.providers[provider].baseUrl.trim(),
    model: settings.providers[provider].model.trim(),
    key: loadAiKey(provider),
  };
}

function endpoint(baseUrl: string): string {
  const value = baseUrl.trim().replace(/\/+$/, '');
  if (!value) throw new AiProviderError('Configura la URL del proveedor.');
  if (value.endsWith('/chat/completions')) return value;
  return `${value}/chat/completions`;
}

function parseToolCalls(value: unknown): AiToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const entry = item as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    return {
      id: String(entry?.id ?? `tool-${index}`),
      type: 'function' as const,
      function: {
        name: String(entry?.function?.name ?? ''),
        arguments: String(entry?.function?.arguments ?? '{}'),
      },
    };
  });
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message;
      if (message) return String(message);
    }
    if (typeof error === 'string') return error;
    if (record.message) return String(record.message);
  }
  return fallback;
}

async function responseError(response: Response): Promise<AiProviderError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    try {
      const text = await response.text();
      return new AiProviderError(text || `Error ${response.status}`, response.status);
    } catch {
      return new AiProviderError(`Error ${response.status}`, response.status);
    }
  }
  return new AiProviderError(errorMessage(payload, `Error ${response.status}`), response.status);
}

function normalizeMessage(payload: unknown): AiChatResult {
  const data = payload as {
    choices?: Array<{
      message?: {
        content?: unknown;
        tool_calls?: unknown;
      };
    }>;
  };
  const message = data?.choices?.[0]?.message;
  return {
    content: typeof message?.content === 'string' ? message.content : '',
    toolCalls: parseToolCalls(message?.tool_calls),
    raw: payload,
  };
}

function accumulateToolCall(
  calls: Map<number, AiToolCall>,
  delta: { index?: number; id?: string; function?: { name?: string; arguments?: string } },
) {
  const index = Number.isFinite(Number(delta.index)) ? Number(delta.index) : 0;
  const current = calls.get(index) ?? {
    id: delta.id || `tool-${index}`,
    type: 'function' as const,
    function: { name: '', arguments: '' },
  };
  if (delta.id) current.id = delta.id;
  if (delta.function?.name) current.function.name += delta.function.name;
  if (delta.function?.arguments) current.function.arguments += delta.function.arguments;
  calls.set(index, current);
}

export async function chatCompletion(
  config: AiRuntimeConfig,
  messages: AiChatMessage[],
  tools: AiToolDefinition[],
  signal: AbortSignal,
  options: { stream?: boolean; onDelta?: (text: string) => void } = {},
): Promise<AiChatResult> {
  if (!config.model) throw new AiProviderError('Configura el modelo de IA.');
  if (!config.key) throw new AiProviderError('Configura la API key del proveedor.');

  const stream = options.stream !== false;
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2,
    stream,
  };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let response: Response;
  try {
    response = await fetch(endpoint(config.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AiProviderError(
      `No se pudo conectar con ${config.label}. Revisa la URL, la red o el proxy local.`,
    );
  }

  if (!response.ok) throw await responseError(response);

  const contentType = response.headers.get('content-type') ?? '';
  if (!stream || contentType.includes('application/json')) {
    const payload = await response.json();
    return normalizeMessage(payload);
  }

  if (!response.body) throw new AiProviderError('El proveedor no devolvió respuesta.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const toolCalls = new Map<number, AiToolCall>();
  let buffer = '';
  let content = '';
  let raw: unknown = { stream: true };
  let done = false;

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    raw = payload;
    const record = payload as {
      error?: unknown;
      choices?: Array<{
        delta?: {
          content?: string;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        message?: { content?: string; tool_calls?: unknown };
      }>;
    };
    if (record.error) {
      throw new AiProviderError(errorMessage(payload, 'El proveedor devolvió un error.'));
    }
    const choice = record.choices?.[0];
    if (choice?.delta?.content) {
      content += choice.delta.content;
      options.onDelta?.(choice.delta.content);
    }
    for (const call of choice?.delta?.tool_calls ?? []) accumulateToolCall(toolCalls, call);
    if (choice?.message) {
      if (typeof choice.message.content === 'string') content += choice.message.content;
      for (const call of parseToolCalls(choice.message.tool_calls)) {
        toolCalls.set(toolCalls.size, call);
      }
    }
  };

  try {
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
    }
    if (buffer.trim()) processLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return {
    content,
    toolCalls: [...toolCalls.entries()].sort(([left], [right]) => left - right).map(([, call]) => call),
    raw,
  };
}

export async function testAiConnection(config: AiRuntimeConfig, signal: AbortSignal) {
  const result = await chatCompletion(
    config,
    [{ role: 'user', content: 'Responde únicamente con la palabra OK.' }],
    [],
    signal,
    { stream: false },
  );
  return result.content.trim() || 'Conexión correcta.';
}
