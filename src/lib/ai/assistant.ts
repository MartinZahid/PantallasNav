import type { Project } from '../../types';
import { buildAiContext, screenDetail, searchProducts } from './context';
import { AI_TOOLS, PLAN_TOOL, PRODUCTS_TOOL, SCREEN_TOOL, buildSystemPrompt } from './prompt';
import { AiPlanError, applyPlan } from './plan';
import {
  chatCompletion,
  runtimeConfig,
  type AiChatMessage as ProviderMessage,
} from './provider';
import type { AiChatMessage, AiLabLog, AiPlan, AiSettings, AiToolCallLog } from './types';

export interface RunAssistantArgs {
  project: Project;
  messages: AiChatMessage[];
  text: string;
  settings: AiSettings;
  signal: AbortSignal;
  onDelta?: (text: string) => void;
}

export interface RunAssistantResult {
  message: AiChatMessage;
  lab: AiLabLog;
}

function messageId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assistantMessage(content: string, extra: Partial<AiChatMessage> = {}): AiChatMessage {
  return {
    id: messageId(),
    role: 'assistant',
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

function errorMessage(content: string): AiChatMessage {
  return {
    id: messageId(),
    role: 'error',
    content,
    createdAt: Date.now(),
  };
}

function parsePlan(raw: string): AiPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiPlanError('El plan no es JSON válido.', ['Revisa las comillas y las llaves del JSON.']);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AiPlanError('El plan está vacío o mal formado.');
  }
  const candidate = parsed as { summary?: unknown; operations?: unknown };
  if (typeof candidate.summary !== 'string' || !Array.isArray(candidate.operations)) {
    throw new AiPlanError('El plan debe incluir summary y operations.');
  }
  return { summary: candidate.summary, operations: candidate.operations as AiPlan['operations'] };
}

function extractPlanFromText(content: string): AiPlan | null {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const candidate = JSON.parse(content.slice(start, end + 1)) as { summary?: unknown; operations?: unknown };
    if (typeof candidate.summary === 'string' && Array.isArray(candidate.operations)) {
      return { summary: candidate.summary, operations: candidate.operations as AiPlan['operations'] };
    }
  } catch {
    return null;
  }
  return null;
}

function toolContent(value: unknown): string {
  return JSON.stringify(value);
}

export async function runAssistant({ project, messages, text, settings, signal, onDelta }: RunAssistantArgs): Promise<RunAssistantResult> {
  const started = Date.now();
  const config = runtimeConfig(settings, settings.activeProvider);
  const systemPrompt = buildSystemPrompt(buildAiContext(project), settings.customRules, settings.allowCreateScreens);
  const history: ProviderMessage[] = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-12)
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }));

  const conversation: ProviderMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: text },
  ];

  const toolCalls: AiToolCallLog[] = [];
  let lastRaw: unknown = null;
  let content = '';

  const lab = (error?: string): AiLabLog => ({
    provider: config.id,
    request: { model: config.model, messages: conversation, tools: AI_TOOLS.map((tool) => tool.function.name) },
    response: lastRaw,
    toolCalls,
    durationMs: Date.now() - started,
    at: Date.now(),
    error,
  });

  try {
    for (let round = 0; round < 5; round += 1) {
      content = '';
      const result = await chatCompletion(config, conversation, AI_TOOLS, signal, {
        stream: true,
        onDelta,
      });
      lastRaw = result.raw;
      content = result.content;

      if (!result.toolCalls.length) {
        const fallback = extractPlanFromText(result.content);
        if (fallback) {
          const applied = applyPlan(project, fallback, settings);
          return {
            message: assistantMessage(result.content || fallback.summary, {
              plan: fallback,
              planDetails: applied.details,
              planWarnings: applied.warnings,
              planState: 'pending',
            }),
            lab: lab(),
          };
        }
        if (!result.content.trim()) {
          return { message: errorMessage('El modelo no devolvió una propuesta ni una respuesta.'), lab: lab() };
        }
        return { message: assistantMessage(result.content), lab: lab() };
      }

      conversation.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls });
      let proposedPlan: AiPlan | null = null;
      let proposedDetails: string[] = [];
      let proposedWarnings: string[] = [];

      for (const call of result.toolCalls) {
        toolCalls.push({ name: call.function.name, arguments: call.function.arguments });
        let output: unknown;
        try {
          if (call.function.name === SCREEN_TOOL) {
            const args = JSON.parse(call.function.arguments) as { screen?: string | number };
            output = screenDetail(project, args.screen ?? project.selectedScreenUid ?? 1);
          } else if (call.function.name === PRODUCTS_TOOL) {
            const args = JSON.parse(call.function.arguments) as { query?: string; limit?: number };
            output = searchProducts(project, String(args.query ?? ''), Number(args.limit ?? 20));
          } else if (call.function.name === PLAN_TOOL) {
            const plan = parsePlan(call.function.arguments);
            const applied = applyPlan(project, plan, settings);
            proposedPlan = plan;
            proposedDetails = applied.details;
            proposedWarnings = applied.warnings;
            output = { ok: true, summary: plan.summary, details: applied.details, warnings: applied.warnings };
          } else {
            output = { error: `Herramienta desconocida: ${call.function.name}` };
          }
        } catch (error) {
          const details = error instanceof AiPlanError ? error.details : [];
          output = {
            ok: false,
            error: error instanceof Error ? error.message : 'No pude ejecutar esa operación.',
            details,
          };
        }
        conversation.push({ role: 'tool', tool_call_id: call.id, content: toolContent(output) });
      }

      if (proposedPlan) {
        return {
          message: assistantMessage(content || proposedPlan.summary, {
            plan: proposedPlan,
            planDetails: proposedDetails,
            planWarnings: proposedWarnings,
            planState: 'pending',
          }),
          lab: lab(),
        };
      }
    }

    return {
      message: errorMessage('El modelo no llegó a una propuesta válida después de varios intentos.'),
      lab: lab(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No pude comunicarme con el proveedor de IA.';
    return { message: errorMessage(message), lab: lab(message) };
  }
}
