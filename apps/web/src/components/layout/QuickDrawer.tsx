import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useModelStore } from '@/stores';
import { useOrchestrationStore, type DrawerKind } from '@/stores/orchestration';
import type { Agent, Integration, Project, Skill, TaskSchedule, Workflow as WorkflowEntity } from '@lofiaistudio/shared';
import { DEFAULT_AGENT_PROMPT, JAYNE_AGENT_MODEL, JAYNE_AGENT_PROMPT } from './constants';

type DrawerEditableEntity = Agent | WorkflowEntity | Skill | TaskSchedule | Project | Integration;

export function QuickDrawer() {
  const store = useOrchestrationStore();
  const { models, fetchModels } = useModelStore();
  const { drawerKind, drawerEntityId, closeDrawer, createEntity, updateEntity, loadCollection } = store;

  useEffect(() => {
    if (drawerKind === 'agent' || drawerKind === 'quick-create') {
      void fetchModels('text');
      void loadCollection('skills');
      void loadCollection('workflows');
    }
  }, [drawerKind, fetchModels, loadCollection]);

  const collections = {
    agent: 'agents',
    workflow: 'workflows',
    skill: 'skills',
    task: 'tasks',
    project: 'projects',
    integration: 'integrations',
  } as const;
  const data = {
    agent: store.agents,
    workflow: store.workflows,
    skill: store.skills,
    task: store.tasks,
    project: store.projects,
    integration: store.integrations,
  };

  if (!drawerKind) return null;

  const currentKind = drawerKind === 'quick-create' ? 'agent' : drawerKind;
  const entity = currentKind in data
    ? (data[currentKind as keyof typeof data].find((item) => item.id === drawerEntityId) as DrawerEditableEntity | undefined)
    : undefined;
  const agent = currentKind === 'agent' ? (entity as Agent | undefined) : undefined;
  const skillEntity = currentKind === 'skill' ? (entity as Skill | undefined) : undefined;
  const textModelOptions = Array.from(
    new Map(
      [
        { id: JAYNE_AGENT_MODEL, name: JAYNE_AGENT_MODEL, runtime: 'ollama', status: 'available' },
        ...models.text.map((model) => ({
          id: model.id,
          name: model.name || model.id,
          runtime: model.runtime,
          status: model.status,
        })),
      ].map((model) => [model.id, model])
    ).values()
  );
  const audioModelOptions = Array.from(
    new Map(
      [
        { id: 'Qwen3-TTS', name: 'Qwen3-TTS', runtime: 'qwen3-tts', status: 'available', type: 'tts' },
        { id: 'Qwen3-ASR', name: 'Qwen3-ASR', runtime: 'qwen3-asr', status: 'available', type: 'stt' },
        ...models.audio.map((model) => ({
          id: model.id,
          name: model.name || model.id,
          runtime: model.runtime,
          status: model.status,
          type: 'type' in model ? model.type : 'audio',
        })),
      ].map((model) => [model.id, model])
    ).values()
  );
  const ttsModelOptions = audioModelOptions.filter((model) => model.type === 'tts' || model.runtime === 'qwen3-tts');
  const sttModelOptions = audioModelOptions.filter((model) => model.type === 'stt' || model.runtime === 'qwen3-asr');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || 'Untitled');
    const description = String(form.get('description') || '');
    const kind = currentKind as Exclude<DrawerKind, null | 'quick-create'>;
    const collection = collections[kind];
    let payload: unknown;
    try {
      payload = buildDrawerPayload(kind, name, description, form, entity);
    } catch (e) {
      if (e instanceof SyntaxError) {
        store.pushToast('Invalid JSON in skill fields');
        return;
      }
      throw e;
    }
    if (entity) await updateEntity(collection, entity.id, payload as never);
    else await createEntity(collection, payload as never);
    closeDrawer();
  };

  return (
    <>
      <div className="orch-drawer-overlay" onClick={closeDrawer} />
      <aside className="orch-drawer">
        <div className="orch-drawer-header">
          <strong>{capitalize(drawerKind === 'quick-create' ? 'Quick Create' : drawerKind)}</strong>
          <button className="orch-icon-btn" onClick={closeDrawer}>
            <X />
          </button>
        </div>
        <form className="orch-drawer-body" onSubmit={onSubmit}>
          {drawerKind === 'quick-create' && (
            <label className="orch-field">
              <span>Type</span>
              <select className="orch-select" defaultValue="agent" onChange={(event) => store.openDrawer(event.target.value as DrawerKind)}>
                <option value="agent">Agent</option>
                <option value="workflow">Workflow</option>
                <option value="skill">Skill</option>
                <option value="task">Task</option>
                <option value="project">Project</option>
                <option value="integration">Integration</option>
              </select>
            </label>
          )}
          <label className="orch-field">
            <span>Name</span>
            <input className="orch-input" name="name" defaultValue={(entity as { name?: string } | null)?.name ?? ''} required />
          </label>
          <label className="orch-field">
            <span>Description / role</span>
            <textarea
              className="orch-textarea"
              name="description"
              rows={4}
              defaultValue={
                (entity as { description?: string; role?: string } | null)?.description ??
                (entity as { role?: string } | null)?.role ??
                ''
              }
            />
          </label>
          {currentKind === 'skill' && (
            <>
              <label className="orch-field">
                <span>Category</span>
                <input className="orch-input" name="category" defaultValue={skillEntity?.category ?? 'Custom'} />
              </label>
              <label className="orch-field">
                <span>Execution</span>
                <select className="orch-select" name="executionType" defaultValue={skillEntity?.executionType ?? 'internal'}>
                  <option value="internal">Internal</option>
                  <option value="http">HTTP</option>
                  <option value="workflow">Workflow</option>
                </select>
              </label>
              <label className="orch-field">
                <span>HTTP method</span>
                <select className="orch-select" name="method" defaultValue={skillEntity?.method ?? 'POST'}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </label>
              <label className="orch-field">
                <span>Endpoint URL (use {'{param}'} for template slots filled from Run defaults + workflow node input)</span>
                <input
                  className="orch-input"
                  name="endpoint"
                  defaultValue={skillEntity?.endpoint ?? ''}
                  placeholder="https://api.example.com/{id}"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                />
              </label>
              <label className="orch-field">
                <span>Linked workflow ID</span>
                <input className="orch-input" name="workflowId" defaultValue={skillEntity?.workflowId ?? ''} placeholder="For execution type Workflow" />
              </label>
              <label className="orch-field orch-check-row">
                <input type="checkbox" name="enabled" value="on" defaultChecked={skillEntity?.enabled !== false} />
                <span>Enabled</span>
              </label>
              <label className="orch-field">
                <span>Run defaults (JSON, optional)</span>
                <textarea
                  className="orch-textarea"
                  name="runInputDefaults"
                  rows={4}
                  defaultValue={
                    skillEntity?.runInputDefaults ? JSON.stringify(skillEntity.runInputDefaults, null, 2) : ''
                  }
                  placeholder='{"subreddit":"gamedev","t":"week","limit":25}'
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                />
              </label>
              <label className="orch-field">
                <span>Config schema (JSON, optional)</span>
                <textarea
                  className="orch-textarea"
                  name="configSchema"
                  rows={3}
                  defaultValue={
                    skillEntity?.configSchema ? JSON.stringify(skillEntity.configSchema, null, 2) : ''
                  }
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                />
              </label>
              <label className="orch-field">
                <span>Avg latency label</span>
                <input className="orch-input" name="avgLatency" defaultValue={skillEntity?.avgLatency ?? '—'} />
              </label>
              <label className="orch-field">
                <span>Cost label</span>
                <input className="orch-input" name="cost" defaultValue={skillEntity?.cost ?? 'Free'} />
              </label>
            </>
          )}
          {currentKind === 'agent' && (
            <>
              <label className="orch-field">
                <span>Model</span>
                <select className="orch-select" name="model" defaultValue={agent?.model ?? JAYNE_AGENT_MODEL}>
                  {textModelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.runtime} - {model.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="orch-field">
                <span>System prompt</span>
                <textarea
                  className="orch-textarea"
                  name="systemPrompt"
                  rows={6}
                  defaultValue={agent?.systemPrompt ?? (agent?.id === 'agent-jayne' ? JAYNE_AGENT_PROMPT : DEFAULT_AGENT_PROMPT)}
                />
              </label>
              <label className="orch-field">
                <span>Project</span>
                <input className="orch-input" name="project" defaultValue={agent?.project ?? 'Internal'} />
              </label>
              <label className="orch-field">
                <span>Status</span>
                <select className="orch-select" name="status" defaultValue={agent?.status ?? 'active'}>
                  <option value="active">Active</option>
                  <option value="idle">Idle</option>
                  <option value="busy">Busy</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              {/* Agent persona features: TTS, STT, avatar image, greeting */}
              <label className="orch-field">
                <span>Text to speech model</span>
                <select className="orch-select" name="ttsModel" defaultValue={agent?.ttsModel ?? agent?.voiceModel ?? 'Qwen3-TTS'}>
                  {ttsModelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.runtime} - {model.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="orch-field">
                <span>Speech to text model</span>
                <select className="orch-select" name="sttModel" defaultValue={agent?.sttModel ?? 'Qwen3-ASR'}>
                  {sttModelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.runtime} - {model.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="orch-field">
                <span>Avatar image URL</span>
                <input className="orch-input" name="avatarImageUrl" defaultValue={agent?.avatarImageUrl ?? ''} placeholder="Optional image URL or local asset path" />
              </label>
              <label className="orch-field">
                <span>Greeting</span>
                <textarea className="orch-textarea" name="greeting" rows={3} defaultValue={agent?.greeting ?? 'Ready when you are.'} />
              </label>
              <div className="orch-field">
                <span>Skills</span>
                <div className="orch-check-list">
                  {store.skills.length > 0 ? (
                    store.skills.map((skill) => (
                      <label className="orch-check-row" key={skill.id}>
                        <input
                          type="checkbox"
                          name="skillIds"
                          value={skill.id}
                          defaultChecked={agent?.skillIds.includes(skill.id) ?? false}
                        />
                        <span>
                          <strong>{skill.name}</strong>
                          <small>{skill.category}</small>
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="orch-empty compact">No skills installed.</div>
                  )}
                </div>
              </div>
              <div className="orch-field">
                <span>Workflows</span>
                <div className="orch-check-list">
                  {store.workflows.length > 0 ? (
                    store.workflows.map((wf) => (
                      <label className="orch-check-row" key={wf.id}>
                        <input
                          type="checkbox"
                          name="workflowIds"
                          value={wf.id}
                          defaultChecked={agent?.workflowIds?.includes(wf.id) ?? false}
                        />
                        <span>
                          <strong>{wf.name}</strong>
                          <small>{wf.project}</small>
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="orch-empty compact">No workflows created.</div>
                  )}
                </div>
              </div>
              {/* Agent capabilities: skill management tools */}
              <div className="orch-field">
                <span>Skill Management Capabilities</span>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                  Grant this agent the ability to manage skills during chat interactions.
                </div>
                <div className="orch-check-list">
                  <label className="orch-check-row">
                    <input type="checkbox" name="capability.skillRead" defaultChecked={agent?.capabilities?.skillRead ?? false} />
                    <span><strong>Read / list skills</strong><small>Inspect installed skills and their definitions</small></span>
                  </label>
                  <label className="orch-check-row">
                    <input type="checkbox" name="capability.skillCreate" defaultChecked={agent?.capabilities?.skillCreate ?? false} />
                    <span><strong>Create new skills</strong><small>Define and install new skills via chat</small></span>
                  </label>
                  <label className="orch-check-row">
                    <input type="checkbox" name="capability.skillUpdate" defaultChecked={agent?.capabilities?.skillUpdate ?? false} />
                    <span><strong>Update existing skills</strong><small>Modify skill properties via chat</small></span>
                  </label>
                  <label className="orch-check-row">
                    <input type="checkbox" name="capability.skillDelete" defaultChecked={agent?.capabilities?.skillDelete ?? false} />
                    <span><strong>Delete skills</strong><small>Remove installed skills (requires agent to ask for confirmation)</small></span>
                  </label>
                </div>
              </div>
            </>
          )}
          {currentKind === 'task' && (
            <label className="orch-field">
              <span>Cron</span>
              <input className="orch-input" name="cron" defaultValue={(entity as { cron?: string } | null)?.cron ?? '*/30 * * * *'} />
            </label>
          )}
          {currentKind === 'workflow' && (
            <>
              <label className="orch-field">
                <span>Project</span>
                <input className="orch-input" name="project" defaultValue={(entity as { project?: string } | null)?.project ?? 'Internal'} />
              </label>
              <label className="orch-field">
                <span>Category</span>
                <input className="orch-input" name="category" defaultValue={(entity as { category?: string } | null)?.category ?? 'General'} />
              </label>
            </>
          )}
          {currentKind === 'integration' && (
            <>
              <label className="orch-field">
                <span>Category</span>
                <select className="orch-select" name="category" defaultValue={(entity as { category?: string } | null)?.category ?? 'analytics'}>
                  <option value="analytics">Analytics</option>
                  <option value="feature-flags">Feature Flags</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="storage">Storage</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="orch-field">
                <span>Status</span>
                <select className="orch-select" name="status" defaultValue={(entity as { status?: string } | null)?.status ?? 'needs_config'}>
                  <option value="connected">Connected</option>
                  <option value="disconnected">Disconnected</option>
                  <option value="needs_config">Needs Configuration</option>
                </select>
              </label>
              {(() => {
                const integrationEntity = entity as { environment?: string; clientSideID?: string; config?: Record<string, unknown> } | null;
                const isLaunchDarkly = (entity as { name?: string } | null)?.name?.toLowerCase().includes('launchdarkly') ?? false;
                return (
                  <>
                    <label className="orch-field">
                      <span>Environment</span>
                      <input className="orch-input" name="environment" placeholder="e.g., production, staging, development" defaultValue={integrationEntity?.environment ?? ''} />
                    </label>
                    <label className="orch-field">
                      <span>Client-Side ID</span>
                      <input className="orch-input" name="clientSideID" placeholder="LaunchDarkly client-side ID" defaultValue={integrationEntity?.clientSideID ?? ''} />
                    </label>
                    {isLaunchDarkly && (
                      <label className="orch-field">
                        <span>Config (JSON)</span>
                        <textarea
                          className="orch-textarea"
                          name="config"
                          rows={4}
                          defaultValue={integrationEntity?.config ? JSON.stringify(integrationEntity.config, null, 2) : ''}
                          placeholder='{"customField": "value"}'
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                        />
                      </label>
                    )}
                  </>
                );
              })()}
            </>
          )}
          <div className="orch-drawer-foot">
            <button type="button" className="orch-btn" onClick={closeDrawer}>
              Cancel
            </button>
            <button type="submit" className="orch-btn primary">
              Save
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

function buildDrawerPayload(
  kind: Exclude<DrawerKind, null | 'quick-create'>,
  name: string,
  description: string,
  form: FormData,
  entity?: DrawerEditableEntity
) {
  if (kind === 'agent') {
    const existing = entity as Agent | undefined;
    const ttsModel = String(form.get('ttsModel') || existing?.ttsModel || existing?.voiceModel || 'Qwen3-TTS');
    return {
      name,
      role: description || (existing?.id === 'agent-jayne' ? 'LoFi AI Studio spokesperson' : 'Local AI worker'),
      model: String(form.get('model') || JAYNE_AGENT_MODEL),
      systemPrompt: String(form.get('systemPrompt') || (existing?.id === 'agent-jayne' ? JAYNE_AGENT_PROMPT : DEFAULT_AGENT_PROMPT)),
      status: String(form.get('status') || 'active'),
      project: String(form.get('project') || 'Internal'),
      avatar: existing?.avatar ?? name[0]?.toUpperCase() ?? 'A',
      avatarImageUrl: String(form.get('avatarImageUrl') || ''),
      colorA: existing?.colorA ?? '#00d4ff',
      colorB: existing?.colorB ?? '#7c5cff',
      capabilities: {
        skillRead: form.get('capability.skillRead') === 'on',
        skillCreate: form.get('capability.skillCreate') === 'on',
        skillUpdate: form.get('capability.skillUpdate') === 'on',
        skillDelete: form.get('capability.skillDelete') === 'on',
      },
      skillIds: form.getAll('skillIds').map(String),
      workflowIds: form.getAll('workflowIds').map(String),
      ttsModel,
      sttModel: String(form.get('sttModel') || existing?.sttModel || 'Qwen3-ASR'),
      voiceModel: ttsModel,
      greeting: String(form.get('greeting') || existing?.greeting || 'Ready when you are.'),
      ...(existing ? {} : { runCount: 0 }),
    };
  }
  if (kind === 'workflow') {
    return {
      name,
      description,
      project: String(form.get('project') || 'Internal'),
      category: String(form.get('category') || 'General'),
      enabled: true,
      nodes: [
        { id: crypto.randomUUID(), type: 'trigger.manual', label: 'Manual trigger', x: 80, y: 120, config: {} },
        { id: crypto.randomUUID(), type: 'output.note', label: 'Output note', x: 360, y: 120, config: { note: description || name } },
      ],
      edges: [],
    };
  }
  if (kind === 'skill') {
    const existing = entity as Skill | undefined;
    const parseOptionalObject = (raw: string): Record<string, unknown> | undefined => {
      const t = raw.trim();
      if (!t) return undefined;
      return JSON.parse(t) as Record<string, unknown>;
    };
    let runInputDefaults: Record<string, unknown> | undefined;
    let configSchema: Record<string, unknown> | undefined;
    try {
      runInputDefaults = parseOptionalObject(String(form.get('runInputDefaults') ?? ''));
      configSchema = parseOptionalObject(String(form.get('configSchema') ?? ''));
    } catch {
      throw new SyntaxError('Invalid JSON in skill fields');
    }
    return {
      name,
      category: String(form.get('category') ?? existing?.category ?? 'Custom'),
      description,
      usedBy: existing?.usedBy ?? 0,
      runs7d: existing?.runs7d ?? 0,
      avgLatency: String(form.get('avgLatency') ?? existing?.avgLatency ?? '—'),
      cost: String(form.get('cost') ?? existing?.cost ?? 'Free'),
      enabled: form.get('enabled') === 'on',
      executionType: String(form.get('executionType') ?? existing?.executionType ?? 'internal') as Skill['executionType'],
      endpoint: String(form.get('endpoint') ?? existing?.endpoint ?? '').trim() || undefined,
      method: String(form.get('method') ?? existing?.method ?? 'POST') as 'GET' | 'POST',
      workflowId: String(form.get('workflowId') ?? existing?.workflowId ?? '').trim() || undefined,
      runInputDefaults,
      configSchema,
    };
  }
  if (kind === 'task') return { name, cron: String(form.get('cron') || '*/30 * * * *'), enabled: true, nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  if (kind === 'project') return { name, description, status: 'active' };
  if (kind === 'integration') {
    const parseOptionalObject = (raw: string): Record<string, unknown> | undefined => {
      const t = raw.trim();
      if (!t) return undefined;
      return JSON.parse(t) as Record<string, unknown>;
    };
    let config: Record<string, unknown> | undefined;
    try {
      config = parseOptionalObject(String(form.get('config') ?? ''));
    } catch {
      throw new SyntaxError('Invalid JSON in config field');
    }
    return {
      name,
      category: String(form.get('category') ?? 'analytics'),
      description,
      status: String(form.get('status') ?? 'needs_config') as 'connected' | 'disconnected' | 'needs_config',
      environment: String(form.get('environment') ?? '').trim() || undefined,
      clientSideID: String(form.get('clientSideID') ?? '').trim() || undefined,
      config,
    };
  }
  return { name, category: 'Custom', status: 'needs_config' };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
