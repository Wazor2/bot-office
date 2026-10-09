import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Code2,
  Command,
  Database,
  FileCode2,
  FileText,
  FolderKanban,
  GitBranch,
  KeyRound,
  Layers3,
  LockKeyhole,
  MoreHorizontal,
  Paperclip,
  Plus,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  Upload,
  Workflow,
  X,
  Zap,
} from "lucide-react";

type ProviderKind = "Official API" | "Official CLI" | "Local model";

type Provider = {
  id: string;
  name: string;
  family: string;
  kind: ProviderKind;
  tint: string;
  mark: string;
};

type AgentRole = {
  id: string;
  name: string;
  summary: string;
  providerId: string;
  icon: "bot" | "code" | "database" | "terminal";
  tint: string;
};

const providerCatalog: Provider[] = [
  { id: "anthropic-api", name: "Anthropic", family: "Claude models", kind: "Official API", tint: "#d8b48b", mark: "A" },
  { id: "openai-api", name: "OpenAI", family: "GPT models", kind: "Official API", tint: "#a7c8bd", mark: "O" },
  { id: "google-api", name: "Google", family: "Gemini models", kind: "Official API", tint: "#a9bde1", mark: "G" },
  { id: "openrouter-api", name: "OpenRouter", family: "Connected models", kind: "Official API", tint: "#c7afe3", mark: "R" },
  { id: "claude-code-cli", name: "Claude Code", family: "Coding agent", kind: "Official CLI", tint: "#d8b48b", mark: "C" },
  { id: "codex-cli", name: "OpenAI Codex", family: "Coding agent", kind: "Official CLI", tint: "#a7c8bd", mark: "C" },
  { id: "gemini-cli", name: "Gemini CLI", family: "Coding agent", kind: "Official CLI", tint: "#a9bde1", mark: "G" },
  { id: "ollama", name: "Ollama", family: "Local fallback", kind: "Local model", tint: "#c5c8c3", mark: "O" },
];

const initialProviders = providerCatalog.filter((provider) =>
  ["anthropic-api", "openai-api", "google-api", "codex-cli"].includes(provider.id),
);

const initialRoles: AgentRole[] = [
  { id: "supervisor", name: "Supervisor", summary: "Plans · reviews · routes", providerId: "anthropic-api", icon: "bot", tint: "#d7a16f" },
  { id: "frontend", name: "Frontend", summary: "UI · accessibility", providerId: "openai-api", icon: "code", tint: "#91b9a4" },
  { id: "backend", name: "Backend", summary: "APIs · business logic", providerId: "google-api", icon: "database", tint: "#88a4cf" },
  { id: "qa", name: "QA & review", summary: "Tests · evidence", providerId: "codex-cli", icon: "terminal", tint: "#b29bcd" },
];

function readBrowserList<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return Array.isArray(value) ? value as T[] : fallback;
  } catch {
    return fallback;
  }
}

function RoleGlyph({ role }: { role: AgentRole }) {
  const common = { size: 16, strokeWidth: 1.8 };
  if (role.icon === "code") return <Code2 {...common} />;
  if (role.icon === "database") return <Database {...common} />;
  if (role.icon === "terminal") return <TerminalSquare {...common} />;
  return <Bot {...common} />;
}

function ProviderMark({ provider, small = false }: { provider: Provider; small?: boolean }) {
  return (
    <span
      className={`provider-mark${small ? " provider-mark-small" : ""}`}
      style={{ "--mark-tint": provider.tint } as CSSProperties}
      aria-hidden="true"
    >
      {provider.mark}
    </span>
  );
}

function ProviderSettings({
  providers,
  onAdd,
  onRemove,
  onClose,
}: {
  providers: Provider[];
  onAdd: (provider: Provider) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"all" | "api" | "cli">("all");
  const existingIds = new Set(providers.map((provider) => provider.id));
  const available = providerCatalog.filter((provider) => !existingIds.has(provider.id));
  const visible = available.filter((provider) => {
    if (tab === "api") return provider.kind === "Official API";
    if (tab === "cli") return provider.kind === "Official CLI";
    return true;
  });

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="provider-modal" role="dialog" aria-modal="true" aria-labelledby="provider-modal-title">
        <div className="modal-head">
          <div className="modal-title-wrap">
            <div className="modal-icon"><Settings2 size={18} /></div>
            <div>
              <p className="eyebrow">TEAM CONFIGURATION</p>
              <h2 id="provider-modal-title">AI providers</h2>
            </div>
          </div>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close provider settings"><X size={18} /></button>
        </div>
        <div className="secure-note">
          <LockKeyhole size={16} />
          <p><strong>Connection setup comes next.</strong> Draft providers and roles stay in this browser; no API keys are stored, provider requests are sent, or local CLIs run.</p>
        </div>
        <div className="provider-modal-section">
          <div className="section-heading"><span>Example team connections</span><span className="count-pill">{providers.length} drafted</span></div>
          <div className="provider-list">
            {providers.length === 0 ? (
              <div className="empty-providers">No providers added. Choose one below to draft a team connection.</div>
            ) : providers.map((provider) => (
              <div className="provider-card" key={provider.id}>
                <ProviderMark provider={provider} />
                <div className="provider-card-info">
                  <div className="provider-card-name">{provider.name}<span className="not-connected-pill">Not connected</span></div>
                  <div className="provider-card-subtitle">{provider.family} <span>·</span> {provider.kind}</div>
                </div>
                <button className="remove-provider" type="button" onClick={() => onRemove(provider.id)} aria-label={`Remove ${provider.name} draft`} title="Remove draft"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="provider-modal-section catalog-section">
          <div className="section-heading"><span>Add a provider</span><span className="muted-count">No key required for this preview</span></div>
          <div className="catalog-tabs" role="tablist" aria-label="Provider types">
            {(["all", "api", "cli"] as const).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={`catalog-tab${tab === value ? " selected" : ""}`} onClick={() => setTab(value)}>
                {value === "all" ? "All" : value === "api" ? "Official APIs" : "Official CLIs"}
              </button>
            ))}
          </div>
          <div className="catalog-grid">
            {visible.length === 0 ? <p className="empty-providers">All options in this category are already drafted.</p> : visible.map((provider) => (
              <button className="catalog-option" type="button" key={provider.id} onClick={() => onAdd(provider)}>
                <ProviderMark provider={provider} small />
                <span className="catalog-option-copy"><strong>{provider.name}</strong><small>{provider.kind}</small></span>
                <Plus size={16} className="catalog-add-icon" />
              </button>
            ))}
          </div>
          <p className="modal-footnote">Ollama is an optional local fallback. Cloud provider use depends on your own account, credentials and available quota. Desktop-app automation is not supported.</p>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [providers, setProviders] = useState<Provider[]>(() => readBrowserList("bot-office:providers", initialProviders));
  const [roles, setRoles] = useState<AgentRole[]>(() => readBrowserList("bot-office:roles", initialRoles));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const [mobileTeamOpen, setMobileTeamOpen] = useState(false);
  const [activityVisible, setActivityVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try { window.localStorage.setItem("bot-office:providers", JSON.stringify(providers)); } catch {}
  }, [providers]);
  useEffect(() => {
    try { window.localStorage.setItem("bot-office:roles", JSON.stringify(roles)); } catch {}
  }, [roles]);
  const [newProjectMode, setNewProjectMode] = useState(false);
  const workspaceQuery = trpc.workspace.current.useQuery(undefined, { refetchOnWindowFocus: false });
  const trpcUtils = trpc.useUtils();
  const createWithBrief = trpc.workspace.createWithBrief.useMutation({
    onSuccess: async () => {
      setDraft("");
      setFiles([]);
      setNewProjectMode(false);
      setNotice("Draft saved to your private workspace. No AI has received or acted on it yet.");
      await trpcUtils.workspace.current.invalidate();
    },
    onError: (error) => setNotice(`Could not save this brief: ${error.message}`),
  });
  const appendMessage = trpc.workspace.addMessage.useMutation({
    onSuccess: async () => {
      setDraft("");
      setNotice("Message saved to your private workspace. No AI provider was called.");
      await trpcUtils.workspace.current.invalidate();
    },
    onError: (error) => setNotice(`Could not save this message: ${error.message}`),
  });
  const activeProject = newProjectMode ? null : workspaceQuery.data?.project ?? null;
  const activeConversation = newProjectMode ? null : workspaceQuery.data?.conversation ?? null;
  const savedMessages = newProjectMode ? [] : workspaceQuery.data?.messages ?? [];

  const providersById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const addProvider = (provider: Provider) => {
    setProviders((current) => current.some((item) => item.id === provider.id) ? current : [...current, provider]);
    setNotice(`${provider.name} added as a draft. Secure connection setup is not available in this preview yet.`);
  };
  const removeProvider = (id: string) => {
    const removed = providersById.get(id);
    setProviders((current) => current.filter((provider) => provider.id !== id));
    setRoles((current) => current.map((role) => role.providerId === id ? { ...role, providerId: "" } : role));
    if (removed) setNotice(`${removed.name} draft removed. No provider credentials were stored.`);
  };
  const assignProvider = (roleId: string, providerId: string) => {
    setRoles((current) => current.map((role) => role.id === roleId ? { ...role, providerId } : role));
  };
  const insertSuggestion = (text: string) => {
    setDraft(text);
    setNotice("");
    composerRef.current?.focus();
  };
  const submitBrief = () => {
    if (workspaceQuery.isLoading || createWithBrief.isPending || appendMessage.isPending) return;
    if (files.length > 0) {
      setNotice("File uploads are not connected yet. Remove the selected files to save a text-only brief.");
      return;
    }
    const content = draft.trim();
    if (!content) return;
    if (activeConversation) {
      appendMessage.mutate({ conversationId: activeConversation.id, content });
    } else {
      createWithBrief.mutate({ brief: content });
    }
  };
  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitBrief();
    }
  };
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles((current) => [...current, ...Array.from(fileList)]);
    setNotice("Files are selected in this browser preview only. Their contents cannot be saved until uploads are wired up.");
  };

  return (
    <div className="bot-app">
      <nav className="app-rail" aria-label="Main navigation">
        <a className="brand-mark" href="#home" aria-label="Bot Office home">
          <span className="relay-logo"><i /><i /><i /></span>
        </a>
        <div className="rail-divider" />
        <button className="rail-item active" type="button" title="Workspace" aria-label="Workspace"><FolderKanban size={18} /></button>
        <button className="rail-item" type="button" title="Activity" aria-label="Activity" onClick={() => setActivityVisible((value) => !value)}><Activity size={18} /></button>
        <button className="rail-item" type="button" title="Provider settings" aria-label="Provider settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
        <div className="rail-spacer" />
        <div className="rail-avatar" aria-label="Private workspace">B</div>
      </nav>

      <aside className={`team-panel${mobileTeamOpen ? " mobile-open" : ""}`} aria-label="Project and AI role assignments">
        <div className="workspace-switcher">
          <div className="workspace-avatar"><span className="relay-mini"><i /><i /><i /></span></div>
          <div className="workspace-info"><strong>bot office</strong><span>Private workspace</span></div>
          <ChevronDown size={15} className="subtle-icon" />
        </div>

        <div className="project-heading">
          <div><span className="eyebrow">PROJECT</span><button type="button" className="more-button" aria-label="Project menu"><MoreHorizontal size={17} /></button></div>
          <h1>{activeProject?.name ?? "New project"}</h1>
          <p>Start with a brief and your team will take it from there.</p>
        </div>
        <div className="project-tabs" aria-label="Project sections">
          <button type="button" className="project-tab active"><Command size={15} /> Overview</button>
          <button type="button" className="project-tab"><GitBranch size={15} /> Repository <span className="tiny-soon">Later</span></button>
        </div>

        <div className="team-divider" />
        <div className="team-heading">
          <div><span className="eyebrow">YOUR AI TEAM</span><span className="team-count">{roles.length}</span></div>
          <button type="button" className="add-team-button" onClick={() => setSettingsOpen(true)} aria-label="Add provider"><Plus size={15} /></button>
        </div>
        <p className="team-caption">Suggested roles · not connected</p>

        <div className="agent-list">
          {roles.map((role) => {
            const provider = providersById.get(role.providerId);
            return (
              <div className="agent-row" key={role.id} style={{ "--role-color": role.tint } as CSSProperties}>
                <div className="role-icon"><RoleGlyph role={role} /></div>
                <div className="agent-content">
                  <div className="agent-title-row"><strong>{role.name}</strong><span className="agent-dot" /></div>
                  <span className="agent-summary">{role.summary}</span>
                  <label className="assignment-select-wrap">
                    <span className="sr-only">Provider assigned to {role.name}</span>
                    <select value={role.providerId} onChange={(event) => assignProvider(role.id, event.target.value)} aria-label={`Provider assigned to ${role.name}`}>
                      <option value="">Assign a provider</option>
                      {providers.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.kind === "Official CLI" ? "CLI" : option.kind === "Local model" ? "local" : "API"}</option>)}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  {provider && <span className="agent-provider-status"><span className="provider-status-dot" /> {provider.name} · not connected</span>}
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="add-provider-button" onClick={() => setSettingsOpen(true)}><Plus size={15} /> Add or manage providers</button>

        <div className="sidebar-bottom-card">
          <div className="sidebar-card-icon"><ShieldCheck size={17} /></div>
          <div><strong>Built for safe delegation</strong><p>Workers report evidence. The Supervisor reviews before completion.</p></div>
          <ArrowRight size={14} className="sidebar-card-arrow" />
        </div>
        <div className="sidebar-footer"><span className="status-light" /> Preview setup in progress <span className="footer-version">v0.1</span></div>
      </aside>

      {mobileTeamOpen && <button type="button" className="mobile-scrim" onClick={() => setMobileTeamOpen(false)} aria-label="Close team sidebar" />}

      <main className={`chat-area${!activityVisible ? " activity-hidden" : ""}`} id="home">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-menu-button" onClick={() => setMobileTeamOpen((value) => !value)} aria-label="Toggle team sidebar"><Layers3 size={18} /></button>
            <div className="breadcrumbs"><span>Projects</span><ChevronDown size={13} /><strong>{activeProject?.name ?? "New project"}</strong></div>
            <span className="private-badge"><LockKeyhole size={12} /> PRIVATE</span>
          </div>
          <div className="topbar-actions">
            <div className="connection-status"><span className="offline-indicator" /> 0 providers connected</div>
            <button type="button" className="new-project-button" onClick={() => { setNewProjectMode(true); setDraft(""); setFiles([]); setNotice(""); }}><Plus size={13} /><span>New project</span></button>
            <button type="button" className="topbar-icon" onClick={() => setActivityVisible((value) => !value)} aria-label={activityVisible ? "Hide run activity" : "Show run activity"}><Activity size={17} /></button>
            <button type="button" className="settings-button" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /><span>Settings</span></button>
          </div>
        </header>

        {workspaceQuery.isError && <div className="workspace-error-banner" role="alert"><Database size={14} /><span>Your saved workspace did not load.</span><button type="button" onClick={() => void workspaceQuery.refetch()}>Retry</button></div>}
        <div className="preview-banner"><span className="preview-banner-dot" /><span><strong>Preview build</strong> · Text briefs save privately on send; provider calls and file uploads are not connected yet.</span><button type="button" onClick={() => setSettingsOpen(true)}>Set up providers <ArrowRight size={13} /></button></div>

        <section className={`conversation-scroll${savedMessages.length > 0 ? " showing-conversation" : ""}`} aria-label="Project conversation">
          {savedMessages.length > 0 && <div className="conversation-log">
            <div className="saved-thread-heading"><div><span className="eyebrow">PROJECT BRIEF</span><strong>{activeProject?.name ?? "Project conversation"}</strong></div><span className="saved-label"><Check size={12} /> SAVED</span></div>
            {savedMessages.map((message) => <article className="saved-message" key={message.id}>
              <div className="message-avatar">Y</div>
              <div className="saved-message-body"><div className="saved-message-meta"><strong>You</strong><span>Saved to workspace</span></div><p>{message.content}</p></div>
            </article>)}
            <div className="no-provider-response"><div className="no-provider-icon"><Bot size={16} /></div><div><strong>Waiting for provider setup</strong><p>Your brief is saved, but the Supervisor has not received it. Connect a provider before starting an AI run.</p><button type="button" onClick={() => setSettingsOpen(true)}>Open provider settings <ArrowRight size={12} /></button></div></div>
          </div>}
          <div className="conversation-inner">
            <div className="welcome-kicker"><span className="welcome-kicker-line" /> PROJECT WORKSPACE <span className="welcome-kicker-line" /></div>
            <div className="welcome-mark"><span className="welcome-orbit orbit-one" /><span className="welcome-orbit orbit-two" /><span className="welcome-core"><span className="relay-logo large"><i /><i /><i /></span></span></div>
            <h2>Give the team a brief.<br /><span>Stay in command.</span></h2>
            <p className="welcome-copy">Your Supervisor turns a project idea into focused work, coordinates the right AI roles, and brings progress and decisions back here.</p>

            <div className="loop-steps" aria-label="How the supervisor loop works">
              <div className="loop-step"><span className="step-number">01</span><span className="step-icon"><FileText size={15} /></span><div><strong>Brief</strong><small>You set the goal</small></div></div>
              <span className="step-connector" />
              <div className="loop-step"><span className="step-number">02</span><span className="step-icon"><Workflow size={15} /></span><div><strong>Delegate</strong><small>Supervisor assigns</small></div></div>
              <span className="step-connector" />
              <div className="loop-step"><span className="step-number">03</span><span className="step-icon"><Radio size={15} /></span><div><strong>Review</strong><small>Workers report back</small></div></div>
              <span className="step-connector" />
              <div className="loop-step"><span className="step-number">04</span><span className="step-icon user-step-icon"><CircleDot size={15} /></span><div><strong>Your call</strong><small>Only when needed</small></div></div>
            </div>

            <div className="suggestion-heading"><span>TRY A STARTING POINT</span><span className="suggestion-heading-line" /></div>
            <div className="suggestion-list">
              <button type="button" className="suggestion-card" onClick={() => insertSuggestion("I have a new product idea. Help me plan the MVP, divide the work across the team, and list the key decisions you need from me.")}>
                <span className="suggestion-icon green"><Sparkles size={16} /></span><span><strong>Plan a new product</strong><small>Turn an idea into milestones and acceptance criteria</small></span><ArrowUp size={15} className="suggestion-arrow" />
              </button>
              <button type="button" className="suggestion-card" onClick={() => insertSuggestion("Review my existing project, identify the highest-priority issues, and propose a safe, testable implementation plan.")}>
                <span className="suggestion-icon blue"><FolderKanban size={16} /></span><span><strong>Improve an existing project</strong><small>Review a codebase and find the next best steps</small></span><ArrowUp size={15} className="suggestion-arrow" />
              </button>
              <button type="button" className="suggestion-card" onClick={() => insertSuggestion("Build a small web app from this brief. Ask me only for decisions that depend on my intent, and show the work and test evidence as you go.")}>
                <span className="suggestion-icon amber"><Code2 size={16} /></span><span><strong>Build from a brief</strong><small>Delegate implementation, tests and review</small></span><ArrowUp size={15} className="suggestion-arrow" />
              </button>
            </div>
            <div className="honesty-note"><LockKeyhole size={13} /><span>This is the first UI increment. Provider calls, secure credential setup, and file uploads are not wired up yet.</span></div>
          </div>
        </section>

        <div className="composer-wrap">
          {notice && <div className="composer-notice" role="status"><CircleDot size={14} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={14} /></button></div>}
          {files.length > 0 && <div className="selected-files" aria-label="Selected files">{files.map((file, index) => <span className="file-chip" key={`${file.name}-${index}`}><FileCode2 size={13} />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X size={12} /></button></span>)}</div>}
          <div className="composer-box">
            <textarea
              ref={composerRef}
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Describe the project, goal, constraints, and what success looks like…"
              aria-label="Project brief"
            />
            <div className="composer-toolbar">
              <div className="composer-tools">
                <input ref={fileInputRef} className="sr-only" type="file" multiple onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }} />
                <button type="button" className="composer-tool attach-tool" onClick={() => fileInputRef.current?.click()}><Paperclip size={15} /> <span>Add material</span></button>
                <span className="composer-separator" />
                <button type="button" className="composer-mode" title="The Supervisor receives the project brief first"><Bot size={14} /> Supervisor first <ChevronDown size={13} /></button>
              </div>
              <div className="composer-actions"><span className="enter-hint">Enter to send · Shift + Enter for a new line</span><button type="button" className="send-button" onClick={submitBrief} disabled={workspaceQuery.isLoading || createWithBrief.isPending || appendMessage.isPending || (!draft.trim() && files.length === 0)} aria-label="Send project brief"><ArrowUp size={18} /></button></div>
            </div>
          </div>
          <div className="composer-footer"><span><ShieldCheck size={13} /> On send, text is saved privately. No AI is called yet.</span><span><span className="keyboard-key">⌘</span> + <span className="keyboard-key">↵</span> to run later</span></div>
        </div>
      </main>

      {activityVisible && <aside className="activity-panel" aria-label="Run activity and progress">
        <div className="activity-header"><div><span className="eyebrow">RUN STATUS · PREVIEW</span><h2>Run activity</h2></div><button type="button" className="icon-button activity-menu" aria-label="Activity options"><MoreHorizontal size={18} /></button></div>
        <div className="run-state-card">
          <div className="run-state-top"><div className="run-state-icon"><Activity size={17} /></div><span className="idle-pill"><span /> IDLE</span></div>
          <strong>{activeProject ? "Brief saved · no run started" : "Waiting for your first brief"}</strong>
          <p>{activeProject ? "Provider execution is not connected. No AI task has been created." : "The Supervisor will create a task plan once provider execution is connected."}</p>
          <div className="run-progress-label"><span>Project progress</span><span>0%</span></div>
          <div className="progress-track"><span style={{ width: "0%" }} /></div>
          <div className="run-progress-foot"><span>0 tasks</span><span>·</span><span>0 completed</span></div>
        </div>

        <div className="activity-section-head"><span className="eyebrow">SUPERVISOR LOOP</span><span className="loop-live"><span /> FLOW PREVIEW</span></div>
        <div className="timeline-list">
          <div className="timeline-item current"><div className="timeline-marker"><span>1</span></div><div><strong>Understand the brief</strong><small>Clarify intent if essential</small></div></div>
          <div className="timeline-stem" />
          <div className="timeline-item"><div className="timeline-marker"><span>2</span></div><div><strong>Plan & delegate</strong><small>Assign roles and dependencies</small></div></div>
          <div className="timeline-stem" />
          <div className="timeline-item"><div className="timeline-marker"><span>3</span></div><div><strong>Review & correct</strong><small>Workers return evidence</small></div></div>
          <div className="timeline-stem" />
          <div className="timeline-item"><div className="timeline-marker user-marker"><span>4</span></div><div><strong>Ask you when needed</strong><small>Technical blockers stay with the Supervisor</small></div></div>
        </div>

        <div className="activity-divider" />
        <div className="activity-section-head"><span className="eyebrow">TEAM READINESS</span><button type="button" className="text-action" onClick={() => setSettingsOpen(true)}>Manage <ArrowRight size={12} /></button></div>
        <div className="readiness-row"><span className="readiness-icon"><KeyRound size={15} /></span><span><strong>Provider connections</strong><small>Configure an official API or CLI</small></span><span className="readiness-count">0 / {roles.length}</span></div>
        <div className="readiness-row"><span className="readiness-icon"><Layers3 size={15} /></span><span><strong>Worker sandbox</strong><small>Isolated execution not set up yet</small></span><span className="readiness-label">Later</span></div>
        <div className="readiness-row"><span className="readiness-icon"><Database size={15} /></span><span><strong>Project history</strong><small>Text briefs save to your workspace</small></span><span className="readiness-label">On</span></div>

        <div className="activity-spacer" />
        <div className="free-tier-note"><div className="free-tier-icon"><Zap size={14} /></div><div><strong>Free-first, not quota bypass</strong><p>Cloud providers set their own limits. Optional Ollama can be a local fallback.</p><button type="button" onClick={() => setSettingsOpen(true)}>Provider options <ArrowRight size={12} /></button></div></div>
        <div className="activity-footer"><span><span className="activity-footer-dot" /> All agents idle</span><span><Clock3 size={12} /> No run started</span></div>
      </aside>}

      {settingsOpen && <ProviderSettings providers={providers} onAdd={addProvider} onRemove={removeProvider} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
