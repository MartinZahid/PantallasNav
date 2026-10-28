import { useEffect, useRef, useState } from 'react';
import { applyPlan, AiPlanError } from '../lib/ai/plan';
import { runAssistant } from '../lib/ai/assistant';
import {
  loadAiKey,
  loadAiSettings,
  runtimeConfig,
  saveAiKey,
  saveAiSettings,
  testAiConnection,
} from '../lib/ai/provider';
import {
  AI_PROVIDERS,
  type AiChatMessage,
  type AiLabLog,
  type AiPlan,
  type AiProviderId,
  type AiSettings,
} from '../lib/ai/types';
import { useEditor } from '../store';

function nowId(): string {
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createMessage(role: AiChatMessage['role'], content: string, id = nowId()): AiChatMessage {
  return { id, role, content, createdAt: Date.now() };
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function PlanCard({
  message,
  disabled,
  onApply,
  onDiscard,
}: {
  message: AiChatMessage;
  disabled: boolean;
  onApply: (message: AiChatMessage) => void;
  onDiscard: (message: AiChatMessage) => void;
}) {
  const plan = message.plan as AiPlan;
  return (
    <div className="ai-plan-card">
      <div className="ai-plan-kicker">Propuesta de cambios</div>
      <strong>{plan.summary}</strong>
      {message.planDetails?.length ? (
        <ul className="ai-plan-list">
          {message.planDetails.map((detail, index) => (
            <li key={`${detail}-${index}`}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {message.planWarnings?.length ? (
        <div className="ai-plan-warning">
          {message.planWarnings.map((warning, index) => (
            <div key={`${warning}-${index}`}>{warning}</div>
          ))}
        </div>
      ) : null}
      <div className="ai-plan-meta">
        {plan.operations.length} operación{plan.operations.length === 1 ? '' : 'es'}
      </div>
      <div className="ai-plan-actions">
        {message.planState === 'applied' ? (
          <span className="ai-plan-done">Aplicado</span>
        ) : message.planState === 'discarded' ? (
          <span className="ai-plan-discarded">Descartado</span>
        ) : (
          <>
            <button type="button" className="ai-secondary" onClick={() => onDiscard(message)}>
              Descartar
            </button>
            <button type="button" className="ai-primary" disabled={disabled} onClick={() => onApply(message)}>
              Aplicar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AiAssistant() {
  const project = useEditor((state) => state.project);
  const previewProject = useEditor((state) => state.previewProject);
  const applyProjectChange = useEditor((state) => state.applyProjectChange);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'lab'>('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const provider = settings.activeProvider;
  const [histories, setHistories] = useState<Record<AiProviderId, AiChatMessage[]>>({
    openai: [],
    opencode: [],
  });
  const [logs, setLogs] = useState<Record<AiProviderId, AiLabLog[]>>({ openai: [], opencode: [] });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [key, setKey] = useState(() => loadAiKey(settings.activeProvider));
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testText, setTestText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messages = histories[provider];

  const disabledReason = previewProject
    ? 'La vista previa es de solo lectura. Cancela o aplica el perfil para editar con IA.'
    : !project
      ? 'Importa o crea un proyecto para usar el asistente.'
      : '';

  const selectedScreen = project?.screens.find((screen) => screen.uid === project.selectedScreenUid);
  const selectedButton = selectedScreen && project && project.selectedButtonIndex !== null
    ? selectedScreen.compact.Body.Buttons[Number(project.selectedButtonIndex)]
    : null;

  useEffect(() => {
    saveAiSettings(settings);
  }, [settings]);

  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, open, tab, settingsOpen]);

  const setProvider = (id: AiProviderId) => {
    setSettings((prev) => ({ ...prev, activeProvider: id }));
    setKey(loadAiKey(id));
    setTestState('idle');
    setTestText('');
  };

  const updateProvider = (patch: Partial<AiSettings['providers'][AiProviderId]>) => {
    setSettings((prev) => ({
      ...prev,
      providers: { ...prev.providers, [provider]: { ...prev.providers[provider], ...patch } },
    }));
  };

  const replaceMessage = (id: string, next: AiChatMessage) => {
    setHistories((prev) => ({
      ...prev,
      [provider]: prev[provider].map((message) => (message.id === id ? next : message)),
    }));
  };

  const patchMessage = (id: string, patch: Partial<AiChatMessage>) => {
    setHistories((prev) => ({
      ...prev,
      [provider]: prev[provider].map((message) => (message.id === id ? { ...message, ...patch } : message)),
    }));
  };

  const send = async (value?: string) => {
    const text = String(value ?? input).trim();
    if (!text || sending || !project || previewProject) return;
    const userMessage = createMessage('user', text);
    const prior = histories[provider];
    const placeholder = createMessage('assistant', '');
    setHistories((prev) => ({ ...prev, [provider]: [...prev[provider], userMessage, placeholder] }));
    setInput('');
    setSending(true);
    setTab('chat');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runAssistant({
        project,
        messages: prior,
        text,
        settings,
        signal: controller.signal,
        onDelta: (delta) => {
          setHistories((prev) => ({
            ...prev,
            [provider]: prev[provider].map((message) =>
              message.id === placeholder.id ? { ...message, content: message.content + delta } : message,
            ),
          }));
        },
      });
      const finalMessage = controller.signal.aborted && result.message.role !== 'error'
        ? { ...result.message, content: 'Consulta cancelada.' }
        : result.message;
      replaceMessage(placeholder.id, finalMessage);
      setLogs((prev) => ({ ...prev, [provider]: [result.lab, ...prev[provider]].slice(0, 20) }));
    } catch (error) {
      replaceMessage(
        placeholder.id,
        createMessage(
          'error',
          error instanceof Error ? error.message : 'No pude completar la consulta.',
          placeholder.id,
        ),
      );
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const apply = (message: AiChatMessage) => {
    if (!project || previewProject || !message.plan) return;
    try {
      const applied = applyPlan(project, message.plan, settings);
      applyProjectChange(applied.project, {
        message: `IA aplicó: ${message.plan.summary}`,
        selectedScreenUid: applied.selectedScreenUid,
        selectedButtonIndex: applied.selectedButtonIndex,
      });
      patchMessage(message.id, { planState: 'applied' });
    } catch (error) {
      const details = error instanceof AiPlanError ? error.details : [];
      const text = error instanceof Error ? error.message : 'No pude aplicar la propuesta.';
      patchMessage(message.id, {
        planWarnings: [...(message.planWarnings ?? []), text, ...details],
      });
    }
  };

  const discard = (message: AiChatMessage) => {
    patchMessage(message.id, { planState: 'discarded' });
  };

  const changeKey = (value: string) => {
    setKey(value);
    saveAiKey(provider, value);
    setTestState('idle');
    setTestText('');
  };

  const testConnection = async () => {
    if (testState === 'testing') return;
    setTestState('testing');
    setTestText('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const config = runtimeConfig(settings, provider);
      const result = await testAiConnection(config, controller.signal);
      setTestState('ok');
      setTestText(result.trim() || 'Conexión correcta.');
    } catch (error) {
      setTestState('error');
      setTestText(error instanceof Error ? error.message : 'No pude conectar con el proveedor.');
    } finally {
      window.clearTimeout(timer);
    }
  };

  const quickPrompts = [
    'Acomoda los botones de esta pantalla en una cuadrícula ordenada.',
    'Cambia el color de estos botones a naranja.',
    'Haz que estos botones vayan a la pantalla 1.',
    'Hazme un diseño para una pantalla de postres.',
  ];

  return (
    <>
      <button
        type="button"
        className={`ai-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="Abrir asistente de IA"
        aria-label="Abrir asistente de IA"
      >
        IA
        {settings.providers[provider].model ? <span className="ai-fab-badge" /> : null}
      </button>
      {open ? (
        <aside className="ai-panel" aria-label="Asistente de IA">
          <header className="ai-header">
            <div>
              <div className="ai-kicker">Laboratorio</div>
              <strong className="ai-title">Asistente IA</strong>
            </div>
            <div className="ai-header-actions">
              <button
                type="button"
                className={`ai-icon-button ${settingsOpen ? 'active' : ''}`}
                onClick={() => setSettingsOpen((value) => !value)}
                title="Ajustes del asistente"
                aria-label="Ajustes del asistente"
              >
                Ajustes
              </button>
              <button type="button" className="ai-icon-button" onClick={() => setOpen(false)} title="Cerrar" aria-label="Cerrar">
                ×
              </button>
            </div>
          </header>

          <div className="ai-provider-tabs">
            {(Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => (
              <button
                type="button"
                key={id}
                className={`ai-provider-tab ${provider === id ? 'active' : ''}`}
                onClick={() => setProvider(id)}
              >
                {AI_PROVIDERS[id].label}
              </button>
            ))}
          </div>

          {settingsOpen ? (
            <div className="ai-settings">
              <div className="ai-section-heading">Conexión · {AI_PROVIDERS[provider].label}</div>
              <label className="ai-field">
                <span>Endpoint</span>
                <input
                  value={settings.providers[provider].baseUrl}
                  onChange={(event) => updateProvider({ baseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              {settings.providers[provider].baseUrl.startsWith('/api/') ? (
                <p className="ai-hint">Usa el proxy local de Vite. En producción necesitarás un backend.</p>
              ) : null}
              <label className="ai-field">
                <span>Modelo</span>
                <input
                  value={settings.providers[provider].model}
                  onChange={(event) => updateProvider({ model: event.target.value })}
                  placeholder={provider === 'opencode' ? 'deepseek-v4.1-flash' : 'modelo con soporte de herramientas'}
                />
              </label>
              <label className="ai-field">
                <span>API key</span>
                <input
                  type="password"
                  value={key}
                  onChange={(event) => changeKey(event.target.value)}
                  placeholder="Solo se guarda en esta pestaña"
                  autoComplete="off"
                />
              </label>
              <div className="ai-test-row">
                <button
                  type="button"
                  className="ai-secondary"
                  onClick={testConnection}
                  disabled={testState === 'testing' || !key || !settings.providers[provider].model}
                >
                  {testState === 'testing' ? 'Probando…' : 'Probar conexión'}
                </button>
                {testState !== 'idle' && testState !== 'testing' ? (
                  <span className={`ai-test ${testState}`}>{testText}</span>
                ) : null}
              </div>
              <div className="ai-warning">
                Solo para pruebas. La clave queda en la sesión del navegador; para producción usa un proxy seguro.
              </div>
              <label className="ai-check">
                <input
                  type="checkbox"
                  checked={settings.allowCreateScreens}
                  onChange={(event) => setSettings((prev) => ({ ...prev, allowCreateScreens: event.target.checked }))}
                />
                <span>Permitir crear pantallas nuevas</span>
              </label>
              <label className="ai-check">
                <input
                  type="checkbox"
                  checked={settings.labMode}
                  onChange={(event) => setSettings((prev) => ({ ...prev, labMode: event.target.checked }))}
                />
                <span>Mostrar JSON completo en Laboratorio</span>
              </label>
              <label className="ai-field">
                <span>Reglas personalizadas</span>
                <textarea
                  rows={4}
                  value={settings.customRules}
                  onChange={(event) => setSettings((prev) => ({ ...prev, customRules: event.target.value }))}
                  placeholder="Ej. Usa solo tonos naranjas y deja libres los títulos."
                />
              </label>
              <p className="ai-hint">Las reglas personalizadas solo pueden añadir restricciones; no desactivan los límites de seguridad.</p>
              <button type="button" className="ai-secondary ai-back" onClick={() => setSettingsOpen(false)}>
                Volver al chat
              </button>
            </div>
          ) : (
            <>
              <div className="ai-tabs">
                <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
                  Chat
                </button>
                <button type="button" className={tab === 'lab' ? 'active' : ''} onClick={() => setTab('lab')}>
                  Laboratorio
                </button>
              </div>

              {disabledReason ? <div className="ai-disabled">{disabledReason}</div> : null}

              {tab === 'lab' ? (
                <div className="ai-lab">
                  {(logs[provider] ?? []).length ? (
                    logs[provider].map((log, index) => (
                      <details className="ai-lab-log" key={`${log.at}-${index}`}>
                        <summary>
                          <span>{formatTime(log.at)}</span>
                          <span>{log.toolCalls.map((call) => call.name).join(' · ') || 'Respuesta'}</span>
                          <span>{log.durationMs} ms</span>
                        </summary>
                        {log.error ? <div className="ai-lab-error">{log.error}</div> : null}
                        {settings.labMode ? (
                          <pre>{JSON.stringify({ request: log.request, response: log.response }, null, 2)}</pre>
                        ) : (
                          <p className="ai-hint">Activa “Mostrar JSON completo en Laboratorio” en Ajustes para ver la petición y la respuesta.</p>
                        )}
                      </details>
                    ))
                  ) : (
                    <div className="ai-empty">Todavía no hay registros del laboratorio.</div>
                  )}
                </div>
              ) : (
                <>
                  <div className="ai-context">
                    <span>{selectedScreen ? `${selectedScreen.compact.Index} · ${selectedScreen.compact.Id}` : 'Sin pantalla'}</span>
                    <span>{selectedButton ? `Botón ${Number(project?.selectedButtonIndex) + 1}` : 'Sin botón seleccionado'}</span>
                  </div>
                  <div className="ai-messages" ref={messagesRef}>
                    {messages.length ? (
                      messages.map((message) => (
                        <div className={`ai-message ${message.role}`} key={message.id}>
                          <div className={`ai-bubble ${message.role}`}>
                            {message.content ? <div className="ai-text">{message.content}</div> : null}
                            {message.plan ? (
                              <PlanCard
                                message={message}
                                disabled={Boolean(disabledReason)}
                                onApply={apply}
                                onDiscard={discard}
                              />
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="ai-welcome">
                        <strong>¿Qué quieres cambiar?</strong>
                        <p>Describe el cambio en español. Puedo acomodar botones, cambiar estilos, crear pantallas y modificar acciones.</p>
                        <div className="ai-quick">
                          {quickPrompts.map((prompt) => (
                            <button type="button" key={prompt} onClick={() => send(prompt)} disabled={Boolean(disabledReason)}>
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ai-composer">
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                      placeholder={disabledReason || 'Ej. Acomoda los botones de esta pantalla…'}
                      rows={3}
                      disabled={Boolean(disabledReason) || sending}
                    />
                    <div className="ai-composer-actions">
                      <span className="ai-hint">Enter envía · Shift+Enter salto</span>
                      {sending ? (
                        <button type="button" className="ai-secondary" onClick={stop}>
                          Detener
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ai-primary"
                          onClick={() => void send()}
                          disabled={Boolean(disabledReason) || !input.trim()}
                        >
                          Enviar
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      ) : null}
    </>
  );
}
