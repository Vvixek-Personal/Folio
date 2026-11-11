"use client";

import { ArrowUpRight, BookOpen, Check, Flame, FolderKanban, Pause, Play, Plus, Scale, Search, Sun, Target, Timer, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { authHeaders } from "@/lib/client-auth";
import type { FocusSession, LibraryItem, StudioDecision, StudioEvent, StudioGoal, StudioKind, StudioProject, StudioRitual, StudioSnapshot } from "@/lib/studio-types";
import type { WorkspaceMember, WorkspaceTask } from "@/lib/types";

type Item = StudioProject | StudioEvent | LibraryItem | StudioGoal | StudioDecision | StudioRitual | FocusSession;

const COPY: Record<StudioKind, { eyebrow: string; title: string; subtitle: string; action: string; empty: string }> = {
  projects: { eyebrow: "SHARED FOCUS", title: "Projects", subtitle: "Name the work, give it a lead, and watch the tasks gather underneath.", action: "New project", empty: "A project is just a name your team can share." },
  events: { eyebrow: "ON THE CALENDAR", title: "Events", subtitle: "Meetings, deadlines, walks, and the hours you protect.", action: "Plan something", empty: "Nothing is on the calendar yet. A small plan is enough." },
  library: { eyebrow: "WORTH RETURNING TO", title: "Library", subtitle: "Articles, books, films, tools, and notes you do not want to lose.", action: "Save something", empty: "Save a link or a note. Future you will be grateful." },
  goals: { eyebrow: "A HORIZON", title: "Goals", subtitle: "Week, month, or quarter. Progress you can move by hand.", action: "Set a goal", empty: "Set one goal you would still care about on Friday." },
  decisions: { eyebrow: "WRITE IT DOWN", title: "Decisions", subtitle: "Context, outcome, and the date you stopped reopening it.", action: "Log a decision", empty: "The next time you decide something, leave it here." },
  rituals: { eyebrow: "SMALL AND REPEATED", title: "Rituals", subtitle: "A streak is a kindness, not a score. Miss a day and begin again.", action: "Add a ritual", empty: "A ritual can be as small as opening Folio before lunch." },
  focus: { eyebrow: "PROTECTED TIME", title: "Focus", subtitle: "A timer, a log, and a note about how the hour actually felt.", action: "Log a session", empty: "Start a 25-minute sit, or log one you already finished." },
};

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Something went wrong.");
  return result as T;
}

function todayKey(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function StudioPulse({ timezone, onOpen }: { timezone: string; onOpen: (view: "goals" | "rituals" | "events" | "decisions" | "focus") => void }) {
  const [data, setData] = useState<StudioSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    requestJson<StudioSnapshot>("/api/studio").then((result) => { if (active) setData(result); }).catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, []);
  if (!data) return <div className="studio-pulse studio-pulse--loading">{[0, 1, 2, 3].map((index) => <div className="activity-skeleton" key={index} />)}</div>;
  const today = todayKey(timezone);
  const kept = data.rituals.filter((ritual) => ritual.lastCompletedOn === today).length;
  const upcoming = data.events.filter((event) => event.startsOn >= today).length;
  const openDecisions = data.decisions.filter((item) => item.status === "open").length;
  const focusMinutes = data.focus.reduce((sum, session) => sum + session.minutes, 0);
  const cards = [
    { label: "Goals in motion", value: data.goals.filter((goal) => goal.status === "active").length, note: `${Math.round(data.goals.reduce((sum, goal) => sum + goal.progress, 0) / Math.max(1, data.goals.length))}% average`, view: "goals" as const },
    { label: "Rituals kept today", value: kept, note: `${data.rituals.length} in the practice`, view: "rituals" as const },
    { label: "Events ahead", value: upcoming, note: "Meetings and deadlines", view: "events" as const },
    { label: "Open decisions", value: openDecisions, note: `${focusMinutes} focus minutes logged`, view: "decisions" as const },
  ];
  return (
    <section className="studio-pulse">
      {cards.map((card) => (
        <button className="studio-pulse__card" key={card.label} onClick={() => onOpen(card.view)}>
          <span>{card.label}</span>
          <strong>{String(card.value).padStart(2, "0")}</strong>
          <small>{card.note}</small>
        </button>
      ))}
    </section>
  );
}

export function StudioBoard({
  kind,
  members,
  tasks = [],
  timezone,
  startOpen = false,
  onComposeHandled,
  onOpenTask,
  onCreateLinkedTask,
}: {
  kind: StudioKind;
  members: WorkspaceMember[];
  tasks?: WorkspaceTask[];
  timezone: string;
  startOpen?: boolean;
  onComposeHandled?: () => void;
  onOpenTask?: (task: WorkspaceTask) => void;
  onCreateLinkedTask?: (projectName: string) => Promise<void>;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [error, setError] = useState("");
  const copy = COPY[kind];

  const load = () => {
    requestJson<StudioSnapshot>("/api/studio")
      .then((result) => setItems(result[kind]))
      .catch((reason) => { setItems([]); setError(reason instanceof Error ? reason.message : "Couldn’t load this collection."); });
  };
  useEffect(() => { load(); }, [kind]);
  useEffect(() => { if (startOpen) { setEditing("new"); onComposeHandled?.(); } }, [startOpen, onComposeHandled]);

  const visible = useMemo(() => {
    const list = items ?? [];
    const value = query.trim().toLowerCase();
    if (!value) return list;
    return list.filter((item) => JSON.stringify(item).toLowerCase().includes(value));
  }, [items, query]);

  const save = async (input: Record<string, unknown>, id?: string) => {
    const optimisticId = id ?? `optimistic-${Date.now()}`;
    const previous = items ?? [];
    const optimistic = { id: optimisticId, ...(id ? previous.find((item) => item.id === id) : {}), ...input } as Item;
    setItems(id ? previous.map((item) => item.id === id ? { ...item, ...input } as Item : item) : [optimistic, ...previous]);
    try {
      const result = await requestJson<{ item: Item }>(id ? `/api/studio/${kind}/${id}` : `/api/studio/${kind}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(input) });
      setItems((current) => (current ?? []).map((item) => item.id === optimisticId || item.id === id ? result.item : item));
      if (!id && kind === "projects" && input.addTask && onCreateLinkedTask) await onCreateLinkedTask(String(input.name));
    } catch (reason) {
      setItems(previous);
      throw reason;
    }
  };

  const remove = async (id: string) => {
    const previous = items ?? [];
    setItems(previous.filter((item) => item.id !== id));
    try { await requestJson(`/api/studio/${kind}/${id}`, { method: "DELETE" }); }
    catch (reason) { setItems(previous); setError(reason instanceof Error ? reason.message : "Couldn’t delete that."); }
  };

  const toggleRitual = async (ritual: StudioRitual) => {
    const today = todayKey(timezone);
    const complete = ritual.lastCompletedOn !== today;
    const previous = items ?? [];
    setItems(previous.map((item) => item.id === ritual.id ? { ...ritual, lastCompletedOn: complete ? today : null, streak: complete ? ritual.streak + 1 : Math.max(0, ritual.streak - 1) } : item));
    try {
      const result = await requestJson<{ item: StudioRitual }>(`/api/studio/rituals/${ritual.id}`, { method: "PATCH", body: JSON.stringify({ complete }) });
      setItems((current) => (current ?? []).map((item) => item.id === ritual.id ? result.item : item));
    } catch (reason) {
      setItems(previous);
      setError(reason instanceof Error ? reason.message : "Couldn’t update that ritual.");
    }
  };

  return (
    <div className="view-stack">
      <div className="page-heading-row">
        <div><p className="eyebrow"><span className="eyebrow-dot" /> {copy.eyebrow}</p><h1>{copy.title}</h1><p className="welcome-subtitle">{copy.subtitle}</p></div>
        <button className="button button--primary" onClick={() => setEditing("new")}><Plus size={16} /> {copy.action}</button>
      </div>
      <div className="studio-toolbar">
        <label className="studio-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${copy.title.toLowerCase()}`} /></label>
        <span>{items === null ? "Loading…" : `${visible.length} ${visible.length === 1 ? "item" : "items"}`}</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      {items === null ? <div className="studio-grid">{[0, 1, 2].map((index) => <div className="panel studio-skeleton" key={index} />)}</div>
        : visible.length === 0 ? <section className="panel empty-state"><span className="empty-state__icon">{iconFor(kind)}</span><h3>{query ? "Nothing matches" : `Nothing in ${copy.title.toLowerCase()} yet`}</h3><p>{query ? "Try another word." : copy.empty}</p><button className="button button--primary" onClick={() => setEditing("new")}><Plus size={15} /> {copy.action}</button></section>
        : <div className={kind === "rituals" || kind === "focus" ? "studio-list" : "studio-grid"}>{visible.map((item) => <StudioCard key={item.id} kind={kind} item={item} tasks={tasks} timezone={timezone} onOpen={() => setEditing(item)} onDelete={() => remove(item.id)} onToggleRitual={toggleRitual} onOpenTask={onOpenTask} onNudgeGoal={(goal, progress) => save({ progress, status: progress >= 100 ? "done" : "active" }, goal.id).catch((reason) => setError(reason instanceof Error ? reason.message : "Couldn’t update progress."))} />)}</div>}
      {editing && <StudioDialog kind={kind} item={editing === "new" ? undefined : editing} members={members} timezone={timezone} onClose={() => setEditing(null)} onSave={save} onDelete={editing !== "new" ? () => remove(editing.id).then(() => setEditing(null)) : undefined} />}
      {kind === "focus" && <FocusTimer onLogged={load} />}
    </div>
  );
}

function iconFor(kind: StudioKind) {
  if (kind === "projects") return <FolderKanban size={20} />;
  if (kind === "library") return <BookOpen size={20} />;
  if (kind === "goals") return <Target size={20} />;
  if (kind === "decisions") return <Scale size={20} />;
  if (kind === "rituals") return <Sun size={20} />;
  if (kind === "focus") return <Timer size={20} />;
  return <Sun size={20} />;
}

function StudioCard({ kind, item, tasks, timezone, onOpen, onDelete, onToggleRitual, onOpenTask, onNudgeGoal }: {
  kind: StudioKind; item: Item; tasks: WorkspaceTask[]; timezone: string; onOpen: () => void; onDelete: () => void;
  onToggleRitual: (ritual: StudioRitual) => void; onOpenTask?: (task: WorkspaceTask) => void; onNudgeGoal: (goal: StudioGoal, progress: number) => void;
}) {
  if (kind === "projects" && "color" in item) {
    const linked = tasks.filter((task) => task.project.toLowerCase() === item.name.toLowerCase());
    const done = linked.filter((task) => task.status === "done").length;
    return <article className="panel studio-card"><header><span className="project-card__symbol" style={{ color: item.color, background: `${item.color}22` }}><FolderKanban size={18} /></span><span className={`status-pill status-pill--${item.status}`}>{item.status}</span></header><h2>{item.name}</h2><p>{item.description || "A shared focus, still finding its words."}</p><div className="project-progress project-progress--wide"><span style={{ width: `${linked.length ? (done / linked.length) * 100 : 0}%`, background: item.color }} /></div><small>{linked.length ? `${done} of ${linked.length} tasks` : "No linked tasks yet"}{item.leadName ? ` · ${item.leadName}` : ""}{item.targetDate ? ` · ${item.targetDate}` : ""}</small>{linked.slice(0, 3).map((task) => <button className="studio-link" key={task.id} onClick={() => onOpenTask?.(task)}>{task.title} <ArrowUpRight size={13} /></button>)}<footer><button className="text-button" onClick={onOpen}>Edit</button><button className="text-button text-button--danger" onClick={onDelete}><Trash2 size={13} /> Delete</button></footer></article>;
  }
  if (kind === "events" && "startsOn" in item && "kind" in item) {
    const event = item as StudioEvent;
    return <article className="panel studio-card"><header><span className={`status-pill status-pill--${event.kind}`}>{event.kind}</span><strong>{event.startsOn}{event.startsAt ? ` · ${event.startsAt}` : ""}</strong></header><h2>{event.title}</h2><p>{event.notes || event.location || "A little time, set aside."}</p><small>{[event.location, event.projectName].filter(Boolean).join(" · ") || timezone}</small><footer><button className="text-button" onClick={onOpen}>Edit</button><button className="text-button text-button--danger" onClick={onDelete}><Trash2 size={13} /> Delete</button></footer></article>;
  }
  if (kind === "library" && "tags" in item) {
    return <article className="panel studio-card"><header><span className="status-pill">{item.kind}</span><span className={`status-pill status-pill--${item.status}`}>{item.status}</span></header><h2>{item.title}</h2><p>{item.note || "Saved for later."}</p><small>{item.tags || "No tags"}</small>{item.url && <a className="studio-link" href={item.url} target="_blank" rel="noreferrer">Open link <ArrowUpRight size={13} /></a>}<footer><button className="text-button" onClick={onOpen}>Edit</button><button className="text-button text-button--danger" onClick={onDelete}><Trash2 size={13} /> Delete</button></footer></article>;
  }
  if (kind === "goals" && "progress" in item && "horizon" in item) {
    const goal = item as StudioGoal;
    return <article className="panel studio-card"><header><span className="status-pill">{goal.horizon}</span><span className={`status-pill status-pill--${goal.status}`}>{goal.status}</span></header><h2>{goal.title}</h2><p>{goal.detail || "A direction, not a demand."}</p><div className="goal-meter"><span style={{ width: `${goal.progress}%` }} /></div><div className="goal-meter__row"><strong>{goal.progress}%</strong><button className="text-button" onClick={() => onNudgeGoal(goal, Math.min(100, goal.progress + 10))}>+10</button></div><small>{goal.ownerName ?? "Unassigned"}{goal.dueDate ? ` · due ${goal.dueDate}` : ""}</small><footer><button className="text-button" onClick={onOpen}>Edit</button><button className="text-button text-button--danger" onClick={onDelete}><Trash2 size={13} /> Delete</button></footer></article>;
  }
  if (kind === "decisions" && "context" in item) {
    const decision = item as StudioDecision;
    return <article className="panel studio-card"><header><span className={`status-pill status-pill--${decision.status}`}>{decision.status}</span>{decision.decidedOn && <small>{decision.decidedOn}</small>}</header><h2>{decision.title}</h2><p>{decision.context}</p>{decision.outcome && <blockquote>{decision.outcome}</blockquote>}<small>{decision.projectName || "Workspace"}</small><footer><button className="text-button" onClick={onOpen}>Edit</button><button className="text-button text-button--danger" onClick={onDelete}><Trash2 size={13} /> Delete</button></footer></article>;
  }
  if (kind === "rituals" && "streak" in item && "cadence" in item) {
    const ritual = item as StudioRitual;
    const done = ritual.lastCompletedOn === todayKey(timezone);
    return <article className="panel studio-row"><button className={`ritual-check ${done ? "ritual-check--done" : ""}`} onClick={() => onToggleRitual(ritual)} aria-label={done ? "Undo today" : "Mark kept today"}>{done ? <Check size={16} /> : <Sun size={16} />}</button><div><h2>{ritual.name}</h2><p>{ritual.note || ritual.cadence}</p></div><span className="streak"><Flame size={14} /> {ritual.streak}<small>best {ritual.bestStreak}</small></span><span className="status-pill">{ritual.cadence}</span><button className="icon-button" onClick={onOpen} aria-label="Edit ritual"><Search size={14} /></button><button className="icon-button" onClick={onDelete} aria-label="Delete ritual"><Trash2 size={14} /></button></article>;
  }
  const session = item as FocusSession;
  return <article className="panel studio-row"><span className="focus-minutes">{session.minutes}<small>min</small></span><div><h2>{session.title}</h2><p>{session.note || session.projectName || session.mood}</p></div><span className={`status-pill status-pill--${session.mood}`}>{session.mood}</span><small>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(session.completedAt))}</small><button className="icon-button" onClick={onDelete} aria-label="Delete session"><Trash2 size={14} /></button></article>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function StudioDialog({ kind, item, members, timezone, onClose, onSave, onDelete }: {
  kind: StudioKind; item?: Item; members: WorkspaceMember[]; timezone: string; onClose: () => void; onSave: (input: Record<string, unknown>, id?: string) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addTask, setAddTask] = useState(!item && kind === "projects");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: Record<string, unknown> = { addTask };
    for (const [key, value] of form.entries()) input[key] = typeof value === "string" ? value : "";
    if (kind === "goals") input.progress = Number(input.progress || 0);
    if (kind === "focus") input.minutes = Number(input.minutes || 25);
    setBusy(true);
    setError("");
    try { await onSave(input, item?.id); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t save."); setBusy(false); }
  };
  const value = (key: string, fallback = "") => {
    if (!item) return fallback;
    const record = item as unknown as Record<string, unknown>;
    const current = record[key];
    return current == null ? fallback : String(current);
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog studio-dialog" role="dialog" aria-modal="true">
        <div className="dialog-topline"><span>{item ? "EDIT" : "NEW"}</span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <form onSubmit={submit} className="studio-form">
          {kind === "projects" && <>
            <Field label="Name"><input name="name" defaultValue={value("name")} required minLength={2} maxLength={80} autoFocus /></Field>
            <Field label="Description"><textarea name="description" defaultValue={value("description")} rows={3} maxLength={2000} /></Field>
            <div className="task-form-grid">
              <Field label="Status"><select name="status" defaultValue={value("status", "active")}><option value="planning">Planning</option><option value="active">Active</option><option value="paused">Paused</option><option value="shipped">Shipped</option></select></Field>
              <Field label="Lead"><select name="leadId" defaultValue={value("leadId")}><option value="">No lead</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
              <Field label="Colour"><input name="color" type="color" defaultValue={value("color", "#64987c")} /></Field>
              <Field label="Target date"><input name="targetDate" type="date" defaultValue={value("targetDate")} /></Field>
            </div>
            {!item && <label className="studio-check"><input type="checkbox" checked={addTask} onChange={(event) => setAddTask(event.target.checked)} /> Add a first task with the same name</label>}
          </>}
          {kind === "events" && <>
            <Field label="Title"><input name="title" defaultValue={value("title")} required minLength={2} autoFocus /></Field>
            <Field label="Notes"><textarea name="notes" defaultValue={value("notes")} rows={3} /></Field>
            <div className="task-form-grid">
              <Field label="Kind"><select name="kind" defaultValue={value("kind", "meeting")}><option value="meeting">Meeting</option><option value="ritual">Ritual</option><option value="deadline">Deadline</option><option value="focus">Focus</option></select></Field>
              <Field label={`Date · ${timezone}`}><input name="startsOn" type="date" defaultValue={value("startsOn", todayKey(timezone))} required /></Field>
              <Field label="Time"><input name="startsAt" type="time" defaultValue={value("startsAt", "09:30")} /></Field>
              <Field label="Place"><input name="location" defaultValue={value("location")} maxLength={120} /></Field>
              <Field label="Project"><input name="projectName" defaultValue={value("projectName")} maxLength={80} /></Field>
            </div>
          </>}
          {kind === "library" && <>
            <Field label="Title"><input name="title" defaultValue={value("title")} required minLength={2} autoFocus /></Field>
            <Field label="Link"><input name="url" type="url" defaultValue={value("url")} placeholder="https://" /></Field>
            <Field label="Note"><textarea name="note" defaultValue={value("note")} rows={3} /></Field>
            <div className="task-form-grid">
              <Field label="Kind"><select name="kind" defaultValue={value("kind", "article")}><option value="article">Article</option><option value="book">Book</option><option value="film">Film</option><option value="tool">Tool</option><option value="note">Note</option></select></Field>
              <Field label="Status"><select name="status" defaultValue={value("status", "queued")}><option value="queued">Queued</option><option value="reading">Reading</option><option value="done">Done</option></select></Field>
              <Field label="Tags"><input name="tags" defaultValue={value("tags")} placeholder="research, tone" /></Field>
            </div>
          </>}
          {kind === "goals" && <>
            <Field label="Title"><input name="title" defaultValue={value("title")} required minLength={2} autoFocus /></Field>
            <Field label="Detail"><textarea name="detail" defaultValue={value("detail")} rows={3} /></Field>
            <div className="task-form-grid">
              <Field label="Horizon"><select name="horizon" defaultValue={value("horizon", "month")}><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option></select></Field>
              <Field label="Status"><select name="status" defaultValue={value("status", "active")}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select></Field>
              <Field label="Progress"><input name="progress" type="number" min={0} max={100} defaultValue={value("progress", "0")} /></Field>
              <Field label="Owner"><select name="ownerId" defaultValue={value("ownerId")}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
              <Field label="Due"><input name="dueDate" type="date" defaultValue={value("dueDate")} /></Field>
            </div>
          </>}
          {kind === "decisions" && <>
            <Field label="Decision"><input name="title" defaultValue={value("title")} required minLength={2} autoFocus /></Field>
            <Field label="Context"><textarea name="context" defaultValue={value("context")} rows={3} /></Field>
            <Field label="Outcome"><textarea name="outcome" defaultValue={value("outcome")} rows={3} /></Field>
            <div className="task-form-grid">
              <Field label="Status"><select name="status" defaultValue={value("status", "open")}><option value="open">Open</option><option value="decided">Decided</option><option value="revisited">Revisited</option></select></Field>
              <Field label="Project"><input name="projectName" defaultValue={value("projectName")} /></Field>
              <Field label="Decided on"><input name="decidedOn" type="date" defaultValue={value("decidedOn")} /></Field>
            </div>
          </>}
          {kind === "rituals" && <>
            <Field label="Name"><input name="name" defaultValue={value("name")} required minLength={2} autoFocus /></Field>
            <Field label="Note"><textarea name="note" defaultValue={value("note")} rows={2} /></Field>
            <div className="task-form-grid">
              <Field label="Cadence"><select name="cadence" defaultValue={value("cadence", "daily")}><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option></select></Field>
              <Field label="Owner"><select name="ownerId" defaultValue={value("ownerId")}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
            </div>
          </>}
          {kind === "focus" && <>
            <Field label="What you worked on"><input name="title" defaultValue={value("title")} required minLength={2} autoFocus /></Field>
            <div className="task-form-grid">
              <Field label="Minutes"><input name="minutes" type="number" min={1} max={240} defaultValue={value("minutes", "25")} /></Field>
              <Field label="Mood"><select name="mood" defaultValue={value("mood", "calm")}><option value="calm">Calm</option><option value="deep">Deep</option><option value="scattered">Scattered</option></select></Field>
              <Field label="Project"><input name="projectName" defaultValue={value("projectName")} /></Field>
            </div>
            <Field label="Note"><textarea name="note" defaultValue={value("note")} rows={2} /></Field>
          </>}
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-footer">{onDelete && <button className="button button--danger-quiet" type="button" onClick={() => void onDelete()}><Trash2 size={14} /> Delete</button>}<div className="dialog-footer__right"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={busy}>{busy ? "Saving" : item ? "Save changes" : "Create"}</button></div></div>
        </form>
      </section>
    </div>
  );
}

function FocusTimer({ onLogged }: { onLogged: () => void }) {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [title, setTitle] = useState("Deep work");
  const [projectName, setProjectName] = useState("");
  const logged = useMemo(() => ({ current: onLogged }), [onLogged]);
  logged.current = onLogged;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (remaining !== 0 || !running) return;
    setRunning(false);
    void requestJson("/api/studio/focus", { method: "POST", body: JSON.stringify({ title: title || "Focus session", minutes, projectName, mood: "deep", note: "Finished with the timer." }) }).then(() => logged.current());
  }, [remaining, running, title, minutes, projectName, logged]);
  const display = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <section className="panel focus-timer">
      <div><p className="eyebrow"><span className="eyebrow-dot" /> A PROTECTED HOUR</p><h2>Focus timer</h2><p>When it ends, Folio logs the session. You can also log one by hand.</p></div>
      <strong className="focus-timer__time">{display}</strong>
      <div className="focus-timer__controls">
        {[25, 45, 50].map((value) => <button key={value} className={`status-pill ${minutes === value ? "status-pill--active" : ""}`} type="button" onClick={() => { setMinutes(value); setRemaining(value * 60); setRunning(false); }}>{value}m</button>)}
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are you making?" />
        <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project" />
        <button className="button button--primary" type="button" onClick={() => { if (!running && remaining === 0) setRemaining(minutes * 60); setRunning((value) => !value); }}>{running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> {remaining === 0 ? "Restart" : "Start"}</>}</button>
      </div>
    </section>
  );
}
