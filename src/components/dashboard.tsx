"use client";

import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleHelp,
  Clock3,
  Command,
  Copy,
  FilePlus2,
  FileText,
  Filter,
  Flame,
  FolderKanban,
  BookOpen,
  Globe2,
  GripVertical,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Leaf,
  List,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  Palette,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Scale,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { HomeOverview } from "@/components/home-overview";
import { PageEditor } from "@/components/page-editor";
import { PagesView } from "@/components/pages-view";
import { GuestSaveDialog } from "@/components/guest-save";
import { authHeaders, forgetSessionToken, rememberSessionToken, rememberWorkspace, resumeSession } from "@/lib/client-auth";
import { pagePlainText } from "@/lib/page-content";
import { PageIcon } from "@/components/page-icon";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { ProfileView } from "@/components/profile-view";
import { ConnectorsView } from "@/components/connectors-view";
import { ActivityView, type ActivityTarget } from "@/components/activity-view";
import { StudioBoard, StudioPulse } from "@/components/studio-board";
import type { StudioEvent } from "@/lib/studio-types";
import type {
  SessionUser,
  TaskComment,
  TaskPriority,
  TaskStatus,
  WorkspaceMember,
  WorkspacePage,
  WorkspaceSnapshot,
  WorkspaceTask,
} from "@/lib/types";

type ViewName = "overview" | "inbox" | "tasks" | "projects" | "pages" | "calendar" | "events" | "library" | "goals" | "decisions" | "rituals" | "focus" | "activity" | "team" | "settings" | "profile" | "connectors";
type TaskInput = Pick<WorkspaceTask, "title" | "description" | "status" | "priority" | "project" | "dueDate" | "assigneeId">;
type PageInput = Pick<WorkspacePage, "title" | "icon" | "cover" | "content" | "isFavorite">;
type Invite = { id: string; email: string; role: string; expiresAt: string; url?: string };

type DashboardProps = {
  initialData: WorkspaceSnapshot;
  initialUser: SessionUser;
  isAuthenticated: boolean;
  initialSessionToken?: string;
  initialWorkspaceId?: string;
};

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Something went wrong. Please try again.");
  return result as T;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function dateKey(date: Date, timezone = "Asia/Kolkata") {
  const pieces = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => pieces.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayLabel(value: string, timezone = "Asia/Kolkata") {
  if (!value) return "No date";
  const date = new Date(`${value}T12:00:00Z`);
  const today = dateKey(new Date(), timezone);
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (value === today) return "Today";
  if (value === dateKey(tomorrow, "UTC")) return "Tomorrow";
  const daysAway = Math.round((date.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
  if (daysAway < 0) return `Overdue · ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(date)}`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function relativeTime(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value))}`;
}

function Avatar({ name, color, size = "normal", className = "" }: { name: string; color?: string | null; size?: "small" | "normal" | "large"; className?: string }) {
  return (
    <span className={`avatar avatar--${size} ${className}`} style={{ backgroundColor: color || "#e8e7e3" }} title={name} aria-label={name}>
      {initials(name)}
    </span>
  );
}

function AvatarStack({ members, limit = 4 }: { members: WorkspaceMember[]; limit?: number }) {
  return (
    <div className="avatar-stack" aria-label={`${members.length} team members`}>
      {members.slice(0, limit).map((member) => <Avatar key={member.id} name={member.name} color={member.avatarColor} size="small" />)}
      {members.length > limit && <span className="avatar avatar--small avatar--extra">+{members.length - limit}</span>}
    </div>
  );
}

function StatusMark({ status }: { status: TaskStatus }) {
  if (status === "done") return <CircleCheck size={17} strokeWidth={1.9} className="status-mark status-mark--done" />;
  if (status === "doing") return <span className="status-mark status-mark--doing"><span /></span>;
  return <Circle size={17} strokeWidth={1.7} className="status-mark status-mark--todo" />;
}

function PriorityMark({ priority }: { priority: TaskPriority }) {
  const icon = priority === "high" ? <ArrowUp size={13} /> : priority === "low" ? <ArrowDown size={13} /> : <span className="priority-dash" />;
  return <span className={`priority priority--${priority}`}>{icon}{priority}</span>;
}

function EmptyState({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={21} strokeWidth={1.65} /></span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, trailing }: { icon: LucideIcon; title: string; trailing?: ReactNode }) {
  return <div className="section-title"><div><Icon size={16} strokeWidth={1.8} /><h2>{title}</h2></div>{trailing}</div>;
}

function TaskLine({ task, timezone, onOpen, onToggle }: { task: WorkspaceTask; timezone: string; onOpen: () => void; onToggle: () => void }) {
  return (
    <div className={`task-line ${task.status === "done" ? "task-line--complete" : ""}`}>
      <button className="task-line__check" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={task.status === "done" ? "Mark as to do" : "Mark as complete"}>
        <StatusMark status={task.status} />
      </button>
      <button className="task-line__body" onClick={onOpen}>
        <span className="task-line__title">{task.title}</span>
        <span className="task-line__meta"><span>{task.project}</span><span className="meta-dot" />{task.dueDate ? dayLabel(task.dueDate, timezone) : "No due date"}</span>
      </button>
      <PriorityMark priority={task.priority} />
      {task.assigneeName ? <Avatar name={task.assigneeName} color={task.assigneeColor} size="small" /> : <span className="unassigned-avatar">—</span>}
    </div>
  );
}

function OverviewView({
  data,
  user,
  onCreateTask,
  onCreatePage,
  onNavigate,
  onOpenTask,
  onToggleTask,
  onInvite,
}: {
  data: WorkspaceSnapshot;
  user: SessionUser | null;
  onCreateTask: () => void;
  onCreatePage: () => void;
  onNavigate: (view: ViewName) => void;
  onOpenTask: (task: WorkspaceTask) => void;
  onToggleTask: (task: WorkspaceTask) => void;
  onInvite: () => void;
}) {
  const openTasks = data.tasks.filter((task) => task.status !== "done");
  const assignedTasks = openTasks.filter((task) => !user || task.assigneeId === user.id);
  const dueSoon = openTasks.filter((task) => task.dueDate && task.dueDate <= dateKey(new Date(Date.now() + 7 * 86400000), data.workspace.timezone));
  const projectStats = useMemo(() => {
    const grouped = new Map<string, WorkspaceTask[]>();
    for (const task of data.tasks) grouped.set(task.project, [...(grouped.get(task.project) ?? []), task]);
    return Array.from(grouped.entries()).slice(0, 4).map(([name, tasks], index) => ({
      name,
      tasks,
      complete: tasks.filter((task) => task.status === "done").length,
      color: ["#8474cf", "#de9b6a", "#64987c", "#6297b2"][index % 4],
    }));
  }, [data.tasks]);
  const recentPages = data.pages.slice(0, 3);
  const nextUp = [...openTasks].filter((task) => task.dueDate).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 3);

  return (
    <div className="view-stack">
      <div className="welcome-row">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> YOUR TEAM, IN SYNC</p>
          <h1>Good to see you{user ? `, ${user.name.split(" ")[0]}` : ""}.</h1>
          <p className="welcome-subtitle">A little more room for the work that matters.</p>
        </div>
        <div className="welcome-actions">
          <button className="button button--secondary" onClick={onCreatePage}><FilePlus2 size={16} /> New page</button>
          <button className="button button--primary" onClick={onCreateTask}><Plus size={17} /> New task</button>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={CheckCheck} label="Open tasks" value={`${openTasks.length}`.padStart(2, "0")} note={`${data.tasks.filter((task) => task.status === "done").length} wrapped up`} tone="violet" />
        <MetricCard icon={Activity} label="In progress" value={`${data.tasks.filter((task) => task.status === "doing").length}`.padStart(2, "0")} note="Good momentum" tone="peach" />
        <MetricCard icon={CalendarDays} label="Due this week" value={`${dueSoon.length}`.padStart(2, "0")} note="Across your projects" tone="sage" />
        <MetricCard icon={Users} label="Your team" value={`${data.members.length}`.padStart(2, "0")} note="Working together" tone="blue" />
      </div>

      <div className="overview-grid">
        <div className="overview-main-column">
          <section className="panel focus-panel">
            <div className="panel-heading">
              <div><p className="eyebrow eyebrow--muted">A GOOD PLACE TO START</p><h2>Your projects</h2><p className="panel-heading__sub">A clear view of what’s moving.</p></div>
              <button className="icon-button" aria-label="See all projects" onClick={() => onNavigate("projects")}><ArrowUpRight size={17} /></button>
            </div>
            <div className="project-list">
              {projectStats.length ? projectStats.map((project) => (
                <button className="project-row" key={project.name} onClick={() => onNavigate("projects")}>
                  <span className="project-dot" style={{ background: project.color }} />
                  <span className="project-row__name">{project.name}</span>
                  <span className="project-row__count">{project.complete}/{project.tasks.length}</span>
                  <span className="project-progress"><span style={{ width: `${project.tasks.length ? (project.complete / project.tasks.length) * 100 : 0}%`, background: project.color }} /></span>
                  <ArrowRight size={15} className="project-arrow" />
                </button>
              )) : <EmptyState icon={FolderKanban} title="Your first project starts here" detail="Group a few tasks together and watch the work take shape." action={<button className="button button--small" onClick={onCreateTask}>Create a task</button>} />}
            </div>
            <button className="panel-link" onClick={() => onNavigate("projects")}>Explore all projects <ArrowRight size={14} /></button>
          </section>

          <section className="panel tasks-panel">
            <div className="panel-heading panel-heading--compact">
              <div><div className="section-kicker"><span className="section-kicker__icon"><CheckCheck size={15} /></span><h2>Your next steps</h2></div><p className="panel-heading__sub">Small steps add up to lovely things.</p></div>
              <button className="text-button" onClick={() => onNavigate("tasks")}>View all <ArrowRight size={14} /></button>
            </div>
            {assignedTasks.length ? (
              <div className="task-lines">
                {assignedTasks.slice(0, 5).map((task) => <TaskLine key={task.id} task={task} timezone={data.workspace.timezone} onOpen={() => onOpenTask(task)} onToggle={() => onToggleTask(task)} />)}
              </div>
            ) : <EmptyState icon={CheckCheck} title="A clear path ahead" detail="You’re all caught up. Make space for your next good idea." action={<button className="button button--small" onClick={onCreateTask}>Add a task</button>} />}
          </section>
        </div>

        <div className="overview-side-column">
          <section className="panel today-panel">
            <div className="today-topline"><span className="today-icon"><Sparkles size={16} /></span><span>YOUR DAY</span><span className="today-time">{new Intl.DateTimeFormat("en-IN", { timeZone: data.workspace.timezone, hour: "numeric", minute: "2-digit" }).format(new Date())}</span></div>
            <h2>A thoughtful pace<br />is still a pace.</h2>
            <p>You’ve got <strong>{openTasks.length} open {openTasks.length === 1 ? "task" : "tasks"}</strong> and a team of {data.members.length} behind you.</p>
            <div className="day-progress"><span style={{ width: `${data.tasks.length ? (data.tasks.filter((task) => task.status === "done").length / data.tasks.length) * 100 : 0}%` }} /></div>
            <div className="day-progress-caption"><span>Today’s progress</span><strong>{data.tasks.length ? Math.round((data.tasks.filter((task) => task.status === "done").length / data.tasks.length) * 100) : 0}%</strong></div>
          </section>

          <section className="panel upcoming-panel">
            <div className="section-title"><div><CalendarDays size={16} /><h2>Coming up</h2></div><button className="icon-button icon-button--small" aria-label="Open calendar" onClick={() => onNavigate("calendar")}><ArrowUpRight size={15} /></button></div>
            {nextUp.length ? <div className="upcoming-list">{nextUp.map((task) => <button className="upcoming-item" key={task.id} onClick={() => onOpenTask(task)}><span className="upcoming-date"><strong>{task.dueDate ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "UTC" }).format(new Date(`${task.dueDate}T12:00:00Z`)) : "—"}</strong><small>{task.dueDate ? new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${task.dueDate}T12:00:00Z`)) : "—"}</small></span><span className="upcoming-copy"><strong>{task.title}</strong><small>{task.project}</small></span><span className="upcoming-dot" /></button>)}</div> : <p className="quiet-copy">Nothing scheduled just yet.</p>}
            <button className="panel-link panel-link--border" onClick={() => onNavigate("calendar")}>Open calendar <ArrowRight size={14} /></button>
          </section>

          <section className="panel notes-panel">
            <div className="section-title"><div><FileText size={16} /><h2>Recently opened</h2></div><button className="text-button text-button--small" onClick={() => onNavigate("pages")}>All pages</button></div>
            {recentPages.length ? <div className="recent-page-list">{recentPages.map((page) => <button className="recent-page" key={page.id} onClick={() => onNavigate("pages")}><span className="recent-page__emoji"><PageIcon value={page.icon} size={15} /></span><span><strong>{page.title}</strong><small>{relativeTime(page.updatedAt)}</small></span><ArrowRight size={14} /></button>)}</div> : <p className="quiet-copy">Your notes will find a home here.</p>}
            <button className="create-note-link" onClick={onCreatePage}><Plus size={15} /> Add a page</button>
          </section>

          <section className="team-peek"><div className="team-peek__copy"><span className="team-peek__title">Good work is shared.</span><span className="team-peek__sub">Say hello to the whole team.</span></div><div className="team-peek__bottom"><AvatarStack members={data.members} /><button className="team-peek__invite" onClick={onInvite}><Plus size={14} /> Invite</button></div></section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: string; note: string; tone: string }) {
  return <div className="metric-card"><span className={`metric-icon metric-icon--${tone}`}><Icon size={17} strokeWidth={1.8} /></span><span className="metric-label">{label}</span><div className="metric-value-row"><strong>{value}</strong><span>{note}</span></div></div>;
}

function TasksView({
  tasks,
  members,
  timezone,
  currentUserId,
  onOpen,
  onToggle,
  onMove,
  onCreate,
  title = "Tasks & projects",
  subtitle = "Make the next step easy to see.",
  mineOnly = false,
}: {
  tasks: WorkspaceTask[];
  members: WorkspaceMember[];
  timezone: string;
  currentUserId?: string;
  onOpen: (task: WorkspaceTask) => void;
  onToggle: (task: WorkspaceTask) => void;
  onMove: (task: WorkspaceTask, status: TaskStatus) => void;
  onCreate: () => void;
  title?: string;
  subtitle?: string;
  mineOnly?: boolean;
}) {
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [scope, setScope] = useState(mineOnly ? "mine" : "all");
  const [filter, setFilter] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const visibleTasks = tasks.filter((task) => {
    const matchesScope = scope === "all" || task.assigneeId === currentUserId;
    const matchesQuery = !filter || `${task.title} ${task.project} ${task.assigneeName ?? ""}`.toLowerCase().includes(filter.toLowerCase());
    return matchesScope && matchesQuery;
  });
  const columns: { key: TaskStatus; title: string; hint: string; color: string }[] = [
    { key: "todo", title: "To do", hint: "On the horizon", color: "#b7b1a8" },
    { key: "doing", title: "In progress", hint: "Moving along", color: "#8e7bd3" },
    { key: "done", title: "Done", hint: "Nicely done", color: "#76a68c" },
  ];

  return (
    <div className="view-stack">
      <div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot eyebrow-dot--purple" /> MAKE IT HAPPEN</p><h1>{title}</h1><p className="welcome-subtitle">{subtitle}</p></div><button className="button button--primary" onClick={onCreate}><Plus size={17} /> New task</button></div>
      <div className="task-toolbar panel panel--toolbar">
        <div className="segmented-control"><button className={scope === "all" ? "is-selected" : ""} onClick={() => setScope("all")}>Everything <span>{tasks.length}</span></button><button className={scope === "mine" ? "is-selected" : ""} onClick={() => setScope("mine")}>Assigned to me</button></div>
        <div className="task-toolbar__right"><label className="inline-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tasks" /></label><div className="segmented-control segmented-control--view"><button className={layout === "board" ? "is-selected" : ""} onClick={() => setLayout("board")} aria-label="Board view"><FolderKanban size={15} /></button><button className={layout === "list" ? "is-selected" : ""} onClick={() => setLayout("list")} aria-label="List view"><List size={15} /></button></div><button className="icon-button" onClick={onCreate} aria-label="Create task"><Plus size={17} /></button></div>
      </div>
      {layout === "board" ? <div className="board-grid">{columns.map((column) => {
        const columnTasks = visibleTasks.filter((task) => task.status === column.key);
        return <section className={`board-column ${dropTarget === column.key ? "board-column--drop" : ""}`} key={column.key} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(column.key); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || draggingId; const task = tasks.find((item) => item.id === id); if (task && task.status !== column.key) onMove(task, column.key); setDropTarget(null); setDraggingId(null); }}><div className="board-column__heading"><span className="board-column__dot" style={{ background: column.color }} /><div><h2>{column.title}</h2><small>{column.hint}</small></div><span className="board-count">{columnTasks.length}</span><button className="board-add" onClick={onCreate} aria-label={`Add ${column.title.toLowerCase()} task`}><Plus size={16} /></button></div>
          <div className="board-card-list">{columnTasks.map((task) => <button className={`board-card ${draggingId === task.id ? "board-card--dragging" : ""}`} key={task.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; setDraggingId(task.id); }} onDragEnd={() => { setDraggingId(null); setDropTarget(null); }} onClick={() => onOpen(task)}><span className="board-card__project"><span className="project-dot project-dot--small" />{task.project}<GripVertical size={16} /></span><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<div className="board-card__footer"><PriorityMark priority={task.priority} /><span className="board-card__date">{task.dueDate ? dayLabel(task.dueDate, timezone) : "No date"}</span>{task.assigneeName ? <Avatar name={task.assigneeName} color={task.assigneeColor || members.find((member) => member.id === task.assigneeId)?.avatarColor} size="small" /> : <span className="unassigned-avatar">—</span>}</div><span className="board-card__quick" onClick={(event) => { event.stopPropagation(); onToggle(task); }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onToggle(task); } }} aria-label="Toggle task status"><StatusMark status={task.status} /></span></button>)}</div>
          <button className="board-add-task" onClick={onCreate}><Plus size={15} /> Add a task</button>
        </section>;
      })}</div> : <section className="panel task-table-panel"><div className="task-table-head"><span>Task</span><span>Project</span><span>Priority</span><span>Due date</span><span>Assignee</span><span /></div>{visibleTasks.length ? visibleTasks.map((task) => <div className="task-table-row" key={task.id}><button className="task-line__check" onClick={() => onToggle(task)} aria-label="Toggle task status"><StatusMark status={task.status} /></button><button className="task-table-title" onClick={() => onOpen(task)}>{task.title}<small>{task.status === "doing" ? "In progress" : task.status === "done" ? "Completed" : "To do"}</small></button><span className="task-table-project">{task.project}</span><PriorityMark priority={task.priority} /><span className="task-table-date">{task.dueDate ? dayLabel(task.dueDate, timezone) : "—"}</span><span>{task.assigneeName ? <Avatar name={task.assigneeName} color={task.assigneeColor || members.find((member) => member.id === task.assigneeId)?.avatarColor} size="small" /> : "—"}</span><button className="icon-button icon-button--small" onClick={() => onOpen(task)} aria-label="Edit task"><ArrowRight size={15} /></button></div>) : <EmptyState icon={Filter} title="No tasks match that filter" detail="Try another search or clear your filter." />}</section>}
    </div>
  );
}

function ProjectsView({ tasks, onOpen, onCreate }: { tasks: WorkspaceTask[]; onOpen: (task: WorkspaceTask) => void; onCreate: () => void }) {
  const projects = useMemo(() => {
    const grouped = new Map<string, WorkspaceTask[]>();
    for (const task of tasks) grouped.set(task.project, [...(grouped.get(task.project) ?? []), task]);
    return Array.from(grouped.entries());
  }, [tasks]);
  return <div className="view-stack"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot eyebrow-dot--peach" /> KEEP THE BIG PICTURE</p><h1>Projects</h1><p className="welcome-subtitle">Your team’s work, gathered in one place.</p></div><button className="button button--primary" onClick={onCreate}><Plus size={17} /> New task</button></div>
    {projects.length ? <div className="projects-grid">{projects.map(([name, projectTasks], index) => { const done = projectTasks.filter((task) => task.status === "done").length; const color = ["#8474cf", "#de9b6a", "#64987c", "#6297b2"][index % 4]; return <section className="panel project-card" key={name}><div className="project-card__top"><span className="project-card__symbol" style={{ color, backgroundColor: `${color}18` }}><FolderKanban size={20} /></span><button className="icon-button icon-button--small" onClick={() => onOpen(projectTasks[0])} aria-label={`Open ${name}`}><ArrowUpRight size={16} /></button></div><p className="eyebrow eyebrow--muted">PROJECT</p><h2>{name}</h2><p className="project-card__summary">A shared focus for thoughtful work, decisions, and next steps.</p><div className="project-card__progress"><span><strong>{Math.round(done / projectTasks.length * 100)}%</strong> complete</span><span>{done} of {projectTasks.length} tasks</span></div><div className="project-progress project-progress--wide"><span style={{ width: `${done / projectTasks.length * 100}%`, background: color }} /></div><div className="project-card__tasks">{projectTasks.slice(0, 3).map((task) => <button key={task.id} onClick={() => onOpen(task)}><StatusMark status={task.status} /><span>{task.title}</span><ArrowRight size={13} /></button>)}</div></section>; })}</div> : <section className="panel"><EmptyState icon={FolderKanban} title="A project-shaped space" detail="Create your first task and give your team a shared focus." action={<button className="button button--primary" onClick={onCreate}><Plus size={16} /> Create your first task</button>} /></section>}</div>;
}

function CalendarView({ tasks, timezone, onOpen, onCreate, onCreateEvent, onOpenEvents }: { tasks: WorkspaceTask[]; timezone: string; onOpen: (task: WorkspaceTask) => void; onCreate: () => void; onCreateEvent: () => void; onOpenEvents: () => void }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState<StudioEvent[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/studio", { headers: authHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (active && result?.events) setEvents(result.events); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const days = useMemo(() => {
    const todayParts = dateKey(new Date(), timezone).split("-").map(Number);
    const monthStart = new Date(Date.UTC(todayParts[0], todayParts[1] - 1 + monthOffset, 1));
    const start = new Date(monthStart);
    start.setUTCDate(1 - ((start.getUTCDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      return { key, date: day, label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(day), number: new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "UTC" }).format(day), inMonth: day.getUTCMonth() === monthStart.getUTCMonth() };
    });
  }, [timezone, monthOffset]);
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(days[20].date);
  const scheduled = tasks.filter((task) => task.dueDate);
  return <div className="view-stack"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot eyebrow-dot--blue" /> THE WEEK, AT A GLANCE</p><h1>Calendar</h1><p className="welcome-subtitle">Tasks and gatherings, in the same quiet month.</p></div><div className="welcome-actions"><button className="button button--secondary" onClick={onCreateEvent}><Sun size={16} /> Plan a gathering</button><button className="button button--primary" onClick={onCreate}><Plus size={17} /> New task</button></div></div>
    <section className="panel calendar-panel"><div className="calendar-toolbar"><div><p className="calendar-view-label">MONTH VIEW</p><h2>{title}</h2><p>{scheduled.length} scheduled {scheduled.length === 1 ? "task" : "tasks"} across all projects</p></div><div className="calendar-controls"><button className="button button--secondary button--small" onClick={() => setMonthOffset(0)}>Today</button><button className="icon-button" onClick={() => setMonthOffset((value) => value - 1)} aria-label="Previous month"><ChevronLeft size={17} /></button><button className="icon-button" onClick={() => setMonthOffset((value) => value + 1)} aria-label="Next month"><ChevronRight size={17} /></button></div></div>
      <div className="calendar-month-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <div className="calendar-weekday" key={label}>{label}</div>)}{days.map((day) => <div className={`calendar-day ${day.inMonth ? "" : "calendar-day--outside"} ${day.key === dateKey(new Date(), timezone) ? "calendar-day--today" : ""}`} key={day.key}><div className="calendar-day__heading"><span>{day.number}</span>{day.key === dateKey(new Date(), timezone) && <b>Today</b>}</div><div className="calendar-day__events">{tasks.filter((task) => task.dueDate === day.key).map((task) => <button className={`calendar-event calendar-event--${task.status}`} key={task.id} onClick={() => onOpen(task)}><span>{task.title}</span><small>{task.project}</small></button>)}{events.filter((event) => event.startsOn === day.key).map((event) => <button className="calendar-event calendar-event--gathering" key={event.id} onClick={onOpenEvents}><span>{event.title}</span><small>{event.startsAt ? `${event.startsAt} · ` : ""}{event.kind}</small></button>)}</div></div>)}</div>
      {!scheduled.length && !events.length && <div className="calendar-empty"><CalendarDays size={18} /><span>No due dates on the calendar yet.</span><button className="text-button" onClick={onCreate}>Add a task</button></div>}
    </section>
    <div className="calendar-footnote"><span><Globe2 size={15} /> Calendar uses <strong>{timezone}</strong></span><span>{scheduled.length} tasks · {events.length} gatherings</span></div>
  </div>;
}

function TeamView({
  data,
  user,
  invites,
  invitesLoading,
  canManage,
  onInvite,
  onRemove,
}: {
  data: WorkspaceSnapshot;
  user: SessionUser | null;
  invites: Invite[];
  invitesLoading: boolean;
  canManage: boolean;
  onInvite: () => void;
  onRemove: (member: WorkspaceMember) => void;
}) {
  return <div className="view-stack"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot eyebrow-dot--peach" /> BETTER, TOGETHER</p><h1>Your team</h1><p className="welcome-subtitle">Good things happen when everyone has a place at the table.</p></div>{canManage && <button className="button button--primary" onClick={onInvite}><Plus size={17} /> Invite people</button>}</div>
    <section className="team-hero"><div className="team-hero__art"><span className="team-hero__sun" /><span className="team-hero__shape team-hero__shape--one" /><span className="team-hero__shape team-hero__shape--two" /><span className="team-hero__spark team-hero__spark--one">✳</span><span className="team-hero__spark team-hero__spark--two">✦</span></div><div className="team-hero__copy"><span className="eyebrow">A SHARED SPACE</span><h2>Great work feels better<br />when it’s done together.</h2><p>{data.members.length} thoughtful people, one lovely place to make things happen.</p><div className="team-hero__avatars"><AvatarStack members={data.members} limit={6} /><span>{data.members.length} teammates</span></div></div></section>
    <section className="panel members-panel"><div className="panel-heading"><div><div className="section-kicker"><span className="section-kicker__icon"><Users size={15} /></span><h2>People in {data.workspace.name}</h2></div><p className="panel-heading__sub">Shared pages, thoughtful feedback, and clear next steps.</p></div><span className="member-count-pill">{data.members.length} members</span></div>
      {data.members.length ? <div className="member-list">{data.members.map((member) => <div className="member-row" key={member.id}><Avatar name={member.name} color={member.avatarColor} size="large" /><div className="member-row__identity"><strong>{member.name}{member.id === user?.id && <span className="you-label">You</span>}</strong><span>{member.email}</span></div><span className={`role-pill ${member.role === "owner" ? "role-pill--owner" : ""}`}>{member.role === "owner" ? <ShieldCheck size={13} /> : null}{member.role}</span><span className="member-row__presence"><span /> Active</span>{canManage && member.id !== user?.id && member.role !== "owner" && <button className="icon-button icon-button--small member-remove" onClick={() => onRemove(member)} aria-label={`Remove ${member.name}`}><MoreHorizontal size={17} /></button>}</div>)}</div> : <EmptyState icon={Users} title="Your team starts here" detail="Invite your first teammate to share this workspace." action={canManage ? <button className="button button--primary" onClick={onInvite}>Invite a teammate</button> : undefined} />}
    </section>
    {canManage && <section className="panel invitations-panel"><div className="section-title"><div><Send size={16} /><h2>Invitations</h2></div><span className="muted-count">{invites.length} pending</span></div>{invitesLoading ? <div className="loading-row"><span className="loading-dot" /> Looking for invitations…</div> : invites.length ? <div className="invitation-list">{invites.map((invite) => <div className="invitation-row" key={invite.id}><span className="invitation-icon"><Send size={15} /></span><span><strong>{invite.email}</strong><small>Invited as {invite.role} · expires {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(invite.expiresAt))}</small></span><span className="invitation-status">Awaiting response</span></div>)}</div> : <p className="quiet-copy">Any open invitations will show up here.</p>}</section>}
  </div>;
}

function SettingsView({ data, onSave }: { data: WorkspaceSnapshot; onSave: (values: Pick<WorkspaceSnapshot["workspace"], "name" | "currency" | "timezone">) => Promise<void> }) {
  const [name, setName] = useState(data.workspace.name);
  const [currency, setCurrency] = useState(data.workspace.currency);
  const [timezone, setTimezone] = useState(data.workspace.timezone);
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(true);
  const [activityAlerts, setActivityAlerts] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [startPage, setStartPage] = useState("overview");
  const [weekStart, setWeekStart] = useState("monday");
  useEffect(() => { document.documentElement.classList.toggle("folio-compact", compact); return () => document.documentElement.classList.remove("folio-compact"); }, [compact]);
  useEffect(() => { document.documentElement.classList.toggle("folio-dark", darkMode); return () => document.documentElement.classList.remove("folio-dark"); }, [darkMode]);
  useEffect(() => { setName(data.workspace.name); setCurrency(data.workspace.currency); setTimezone(data.workspace.timezone); }, [data.workspace]);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); try { await onSave({ name, currency, timezone }); } finally { setBusy(false); } };
  return <div className="view-stack"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot eyebrow-dot--blue" /> MAKE IT YOURS</p><h1>Workspace settings</h1><p className="welcome-subtitle">Set up your shared space to feel right for your team.</p></div><span className="settings-lock"><ShieldCheck size={15} /> Owner access</span></div>
    <section className="panel settings-panel"><div className="settings-panel__intro"><span className="settings-icon"><Settings2 size={19} /></span><div><h2>Workspace details</h2><p>Small settings that make a big difference.</p></div></div><form className="settings-form" onSubmit={handleSubmit}><label className="form-field"><span>Workspace name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label><div className="settings-form__row"><label className="form-field"><span>Default currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="INR">INR · Indian rupee</option><option value="USD">USD · US dollar</option><option value="GBP">GBP · British pound</option><option value="EUR">EUR · Euro</option><option value="SGD">SGD · Singapore dollar</option><option value="AUD">AUD · Australian dollar</option></select></label><label className="form-field"><span>Team timezone</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Kolkata">Asia/Kolkata · IST</option><option value="Asia/Singapore">Asia/Singapore · SGT</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London · GMT/BST</option><option value="Europe/Paris">Europe/Paris · CET</option><option value="America/New_York">America/New_York · ET</option><option value="America/Los_Angeles">America/Los_Angeles · PT</option><option value="Australia/Sydney">Australia/Sydney · AET</option></select></label></div><div className="settings-form__footer"><span><Globe2 size={15} /> Dates and schedules use your chosen timezone.</span><button className="button button--primary" disabled={busy}>{busy ? <><span className="button-spinner" /> Saving</> : <><Check size={16} /> Save changes</>}</button></div></form></section>
    <div className="settings-grid"><section className="panel settings-preferences"><div className="settings-panel__intro"><span className="settings-icon settings-icon--blue"><Palette size={19} /></span><div><h2>Appearance</h2><p>Personal choices for this browser.</p></div></div><label className="settings-toggle"><span><strong>Dark mode</strong><small>Use a softer dark canvas for focused work.</small></span><input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} /><i /></label><label className="settings-toggle"><span><strong>Compact desktop layout</strong><small>Keep more of Folio visible on shorter screens.</small></span><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} /><i /></label><label className="settings-toggle"><span><strong>Activity notifications</strong><small>Show new workspace activity on the bell.</small></span><input type="checkbox" checked={activityAlerts} onChange={(event) => setActivityAlerts(event.target.checked)} /><i /></label></section><section className="panel settings-preferences"><div className="settings-panel__intro"><span className="settings-icon settings-icon--gold"><LayoutTemplate size={19} /></span><div><h2>Pages & templates</h2><p>Choose how your workspace opens.</p></div></div><label className="form-field settings-mini-field"><span>Open Folio on</span><select value={startPage} onChange={(event) => setStartPage(event.target.value)}><option value="overview">Overview</option><option value="tasks">Tasks</option><option value="calendar">Calendar</option><option value="pages">Pages</option></select></label><label className="form-field settings-mini-field"><span>Week starts on</span><select value={weekStart} onChange={(event) => setWeekStart(event.target.value)}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label><div className="settings-info-row"><span>Templates</span><strong>Ready to use</strong></div></section><section className="panel settings-preferences"><div className="settings-panel__intro"><span className="settings-icon settings-icon--violet"><Settings2 size={19} /></span><div><h2>Product preferences</h2><p>Keep Folio feeling like your workspace.</p></div></div><div className="settings-info-row"><span>Default task view</span><strong>Board</strong></div><div className="settings-info-row"><span>Calendar density</span><strong>Comfortable</strong></div><div className="settings-info-row"><span>Autosave</span><strong>Always on</strong></div></section><section className="panel settings-preferences"><div className="settings-panel__intro"><span className="settings-icon settings-icon--green"><ShieldCheck size={19} /></span><div><h2>Privacy & connections</h2><p>See what Folio is allowed to use.</p></div></div><div className="settings-info-row"><span>Google Drive</span><strong>Managed in Connectors</strong></div><div className="settings-info-row"><span>Workspace data</span><strong>Private to your team</strong></div><div className="settings-info-row"><span>File access</span><strong>Only after your approval</strong></div></section></div>
    <section className="settings-note"><span><CircleHelp size={16} /></span><p><strong>Made for teams everywhere.</strong> Folio starts in India Standard Time and supports the timezones and currencies your team uses.</p></section>
  </div>;
}

function ModalFrame({ children, onClose, className = "" }: { children: ReactNode; onClose: () => void; className?: string }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`dialog ${className}`} role="dialog" aria-modal="true">{children}</section></div>;
}

function TaskDialog({
  task,
  members,
  currentUser,
  timezone,
  onClose,
  onSave,
  onDelete,
  notify,
}: {
  task?: WorkspaceTask;
  members: WorkspaceMember[];
  currentUser: SessionUser | null;
  timezone: string;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [project, setProject] = useState(task?.project ?? "Workspace");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? currentUser?.id ?? members[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(Boolean(task));
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!task) return;
    let active = true;
    requestJson<{ comments: TaskComment[] }>(`/api/tasks/${task.id}/comments`)
      .then((result) => { if (active) setComments(result.comments); })
      .catch(() => { if (active) notify("Couldn’t load this conversation.", "error"); })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [task, notify]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) { setFormError("Give this task a name first."); return; }
    setBusy(true); setFormError("");
    try { await onSave({ title: title.trim(), description, project: project.trim() || "Workspace", status, priority, dueDate: dueDate || null, assigneeId: assigneeId || null }); onClose(); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Couldn’t save this task."); }
    finally { setBusy(false); }
  };

  const postComment = async () => {
    if (!task || !commentDraft.trim()) return;
    setCommentBusy(true);
    try {
      const result = await requestJson<{ comment: TaskComment }>(`/api/tasks/${task.id}/comments`, { method: "POST", body: JSON.stringify({ body: commentDraft.trim() }) });
      setComments((current) => [...current, result.comment]); setCommentDraft("");
    } catch (error) { notify(error instanceof Error ? error.message : "Couldn’t post your note.", "error"); }
    finally { setCommentBusy(false); }
  };

  const removeTask = async () => {
    if (!task || !onDelete || !window.confirm("Delete this task? This can’t be undone.")) return;
    setDeleteBusy(true);
    try { await onDelete(task.id); onClose(); } catch { setDeleteBusy(false); }
  };

  return <ModalFrame onClose={onClose} className="task-dialog"><div className="dialog-topline"><span className="dialog-icon dialog-icon--task"><CheckCheck size={17} /></span><span>{task ? "TASK DETAILS" : "A NEW NEXT STEP"}</span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <div className="dialog-heading"><h2>{task ? "Edit task" : "Create a task"}</h2><p>Keep the next step clear, and the rest gets easier.</p></div>
    <form onSubmit={save} className="task-dialog__form"><label className="form-field"><span>Task name</span><input className="task-title-input" placeholder="What needs doing?" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} autoFocus required /></label><label className="form-field"><span>A little context <small>Optional</small></span><textarea placeholder="Add a note, link, or helpful detail…" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={3000} /></label>
      <div className="task-form-grid"><label className="form-field"><span>Project</span><input value={project} onChange={(event) => setProject(event.target.value)} maxLength={80} placeholder="Workspace" /></label><label className="form-field"><span>Assignee</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">No assignee</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="form-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></label><label className="form-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="form-field"><span>Due date <small>{timezone}</small></span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
      {formError && <p className="form-error">{formError}</p>}
      {task && <section className="comments-section"><div className="comments-heading"><MessageCircle size={15} /><strong>Conversation</strong><span>{comments.length}</span></div>{commentsLoading ? <div className="loading-row"><span className="loading-dot" /> Loading conversation…</div> : comments.length ? <div className="comment-list">{comments.map((comment) => <div className="comment-row" key={comment.id}><Avatar name={comment.userName} color={comment.avatarColor} size="small" /><div><div className="comment-row__top"><strong>{comment.userName}</strong><span>{relativeTime(comment.createdAt)}</span></div><p>{comment.body}</p></div></div>)}</div> : <p className="comment-empty">A good place for questions, decisions, or a little encouragement.</p>}<div className="comment-composer"><Avatar name={currentUser?.name ?? "You"} color={currentUser?.avatarColor} size="small" /><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void postComment(); } }} placeholder="Leave a thoughtful note…" maxLength={2000} /><button type="button" onClick={() => void postComment()} className="icon-button icon-button--send" disabled={!commentDraft.trim() || commentBusy} aria-label="Post comment">{commentBusy ? <span className="button-spinner" /> : <Send size={16} />}</button></div></section>}
      <div className="dialog-footer">{task && <button className="button button--danger-quiet" type="button" onClick={removeTask} disabled={deleteBusy}><Trash2 size={15} /> {deleteBusy ? "Deleting…" : "Delete task"}</button>}<div className="dialog-footer__right"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={busy}>{busy ? <><span className="button-spinner" /> Saving</> : <><Check size={16} /> {task ? "Save changes" : "Create task"}</>}</button></div></div>
    </form>
  </ModalFrame>;
}

function InviteDialog({ workspaceName, onClose, onInvite }: { workspaceName: string; onClose: () => void; onInvite: (email: string) => Promise<string> }) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); try { const link = await onInvite(email); setUrl(link); } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t create an invitation."); } finally { setBusy(false); } };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setError("Couldn’t copy automatically. Select and copy the link instead."); } };
  return <ModalFrame onClose={onClose} className="invite-dialog"><div className="dialog-topline"><span className="dialog-icon dialog-icon--invite"><Users size={17} /></span><span>MAKE ROOM AT THE TABLE</span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{url ? <div className="invite-success"><span className="invite-success__icon"><Check size={22} /></span><p className="eyebrow eyebrow--muted">INVITATION READY</p><h2>One more good thing, together.</h2><p>Send this private invitation link to <strong>{email}</strong>. It expires in seven days.</p><div className="invite-link-field"><span>{url}</span><button className="button button--primary button--small" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}</button></div><button className="text-button invite-another" onClick={() => { setUrl(""); setEmail(""); }}>Invite another teammate <ArrowRight size={14} /></button></div> : <><div className="dialog-heading"><h2>Good work grows with good people.</h2><p>Invite a teammate to share pages, projects, and the little wins.</p></div><form onSubmit={submit} className="invite-form"><label className="form-field"><span>Their work email</span><input type="email" placeholder="teammate@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></label><div className="invite-role-note"><Users size={16} /><span><strong>Workspace member</strong><small>They’ll be able to see and contribute to shared work.</small></span></div>{error && <p className="form-error">{error}</p>}<div className="dialog-footer"><span className="invite-workspace-name"><Globe2 size={14} /> {workspaceName}</span><div className="dialog-footer__right"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={busy}>{busy ? <><span className="button-spinner" /> Preparing</> : <><Send size={15} /> Create invite</>}</button></div></div></form></>}</ModalFrame>;
}

function AuthDialog({ mode, inviteToken, onClose, onModeChange, onSuccess }: { mode: "login" | "signup"; inviteToken: string | null; onClose: () => void; onModeChange: (mode: "login" | "signup") => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); try { await requestJson<{ user: SessionUser }>("/api/auth", { method: "POST", body: JSON.stringify({ mode, name, email, password, inviteToken }) }); onSuccess(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t sign you in."); } finally { setBusy(false); } };
  return <ModalFrame onClose={onClose} className="auth-dialog"><div className="auth-brand"><span className="brand-mark brand-mark--large"><span /><span /><span /><span /></span><span>folio<span className="brand-period">.</span></span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="auth-art"><span>✳</span><span>✦</span><span>◒</span><span>✧</span><div><Sparkles size={19} /></div></div><div className="auth-copy"><p className="eyebrow eyebrow--muted">A SHARED HOME FOR GOOD WORK</p><h2>{mode === "signup" ? "Make a little room." : "Welcome back."}</h2><p>{inviteToken ? "You’ve been invited to join a team. Sign up with the invited email to accept." : mode === "signup" ? "Bring your team’s notes, projects, and next steps together." : "Your team and the things you’re making are right here."}</p></div><form className="auth-form" onSubmit={submit}>{mode === "signup" && <label className="form-field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Aanya Gupta" autoComplete="name" minLength={2} required /></label>}<label className="form-field"><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></label><label className="form-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} maxLength={128} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>{error && <p className="form-error">{error}</p>}<button className="button button--primary auth-submit" disabled={busy}>{busy ? <><span className="button-spinner" /> One moment…</> : mode === "signup" ? "Create your account" : "Sign in"}<ArrowRight size={16} /></button></form><div className="auth-switch">{mode === "signup" ? <>Already have an account? <button onClick={() => onModeChange("login")}>Sign in</button></> : <>New to Folio? <button onClick={() => onModeChange("signup")}>Create an account</button></>}</div><div className="auth-footnote"><ShieldCheck size={14} /> Your team’s space is private and secure.</div></ModalFrame>;
}

function SearchDialog({ query, setQuery, pages, tasks, onClose, onPage, onTask }: { query: string; setQuery: (value: string) => void; pages: WorkspacePage[]; tasks: WorkspaceTask[]; onClose: () => void; onPage: (page: WorkspacePage) => void; onTask: (task: WorkspaceTask) => void }) {
  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return { pages: pages.slice(0, 4), tasks: tasks.slice(0, 4) };
    return {
      pages: pages.filter((page) => `${page.title} ${pagePlainText(page.content)}`.toLowerCase().includes(value)).slice(0, 5),
      tasks: tasks.filter((task) => `${task.title} ${task.project} ${task.description}`.toLowerCase().includes(value)).slice(0, 5),
    };
  }, [query, pages, tasks]);
  const hasResults = matches.pages.length + matches.tasks.length > 0;
  return (
    <ModalFrame onClose={onClose} className="search-dialog">
      <div className="search-dialog__input"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, tasks, and projects…" autoFocus /><kbd>ESC</kbd><button className="icon-button icon-button--small" onClick={onClose} aria-label="Close search"><X size={16} /></button></div>
      <div className="search-dialog__results">
        {matches.pages.length > 0 && <><p className="search-group-title">PAGES</p>{matches.pages.map((page) => (
          <button className="search-result" key={page.id} onClick={() => onPage(page)}><span className="search-result__emoji"><PageIcon value={page.icon} size={16} /></span><span><strong>{page.title}</strong><small>Page · {relativeTime(page.updatedAt)}</small></span><ArrowUpRight size={15} /></button>
        ))}</>}
        {matches.tasks.length > 0 && <><p className="search-group-title">TASKS</p>{matches.tasks.map((task) => (
          <button className="search-result" key={task.id} onClick={() => onTask(task)}><StatusMark status={task.status} /><span><strong>{task.title}</strong><small>{task.project} · {task.status === "doing" ? "In progress" : task.status}</small></span><ArrowUpRight size={15} /></button>
        ))}</>}
        {!hasResults && <div className="search-no-results"><Search size={20} /><strong>No results this time</strong><span>Try another word or phrase.</span></div>}
      </div>
      <div className="search-dialog__footer"><span><Command size={13} /> <kbd>K</kbd> to search anywhere</span><span><span className="search-dot" /> Pages and tasks stay up to date</span></div>
    </ModalFrame>
  );
}

export function Dashboard({ initialData, initialUser, isAuthenticated: initiallyAuthenticated, initialSessionToken, initialWorkspaceId }: DashboardProps) {
  const [data, setData] = useState(initialData);
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [authenticated] = useState(initiallyAuthenticated);
  const [sessionReady] = useState(true);
  const [view, setView] = useState<ViewName>("overview");
  const [composeKind, setComposeKind] = useState<ViewName | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [inviteToken] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<WorkspaceTask | "new" | null>(null);
  const [pageModal, setPageModal] = useState<WorkspacePage | "new" | null>(null);
  const [templatesInitially, setTemplatesInitially] = useState(false);
  const [guestSaveOpen, setGuestSaveOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [unread, setUnread] = useState(0);
  const [mobileSidebar, setMobileSidebar] = useState(true);
  const toastTimer = useMemo(() => ({ current: 0 as number }), []);

  const notify = useCallback((message: string, kind: "success" | "error" = "success") => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, [toastTimer]);

  // The dashboard only renders for an authenticated session, so an invite token
  // left in the address bar has already been consumed: tidy it up quietly.
  useEffect(() => {
    if (initialSessionToken) rememberSessionToken(initialSessionToken);
    if (initialWorkspaceId) rememberWorkspace(initialWorkspaceId);
    const params = new URLSearchParams(window.location.search);
    if (params.has("invite") || params.has("session") || params.has("ws")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [initialSessionToken, initialWorkspaceId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setAuthOpen(false); setInviteOpen(false); setTaskModal(null); setGuestSaveOpen(false); setProfileOpen(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const tick = () => {
      fetch("/api/activity?limit=1", { headers: authHeaders() })
        .then((response) => (response.ok ? response.json() : null))
        .then((result) => { if (active && result && typeof result.unreadCount === "number") setUnread(result.unreadCount); })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 45000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authenticated]);

  useEffect(() => {
    if (view !== "team" || !authenticated) return;
    let active = true;
    setInvitesLoading(true);
    requestJson<{ invitations: Invite[] }>("/api/members")
      .then((result) => { if (active) setInvites(result.invitations); })
      .catch(() => { if (active) setInvites([]); })
      .finally(() => { if (active) setInvitesLoading(false); });
    return () => { active = false; };
  }, [view, authenticated]);

  const currentMember = data.members.find((member) => member.id === user?.id);
  const canManageTeam = Boolean(currentMember && ["owner", "admin"].includes(currentMember.role));
  const requireAuth = useCallback(() => {
    if (authenticated && sessionReady) return true;
    setAuthMode("login"); setAuthOpen(true);
    return false;
  }, [authenticated, sessionReady]);

  const changeView = (next: ViewName) => { setView(next); setMobileOpen(false); setProfileOpen(false); };
  const openNewTask = () => { if (requireAuth()) setTaskModal("new"); };
  const openNewPage = () => { if (requireAuth()) { setTemplatesInitially(false); setPageModal("new"); } };
  const openTemplates = () => { if (requireAuth()) { setTemplatesInitially(true); setPageModal("new"); setMobileOpen(false); } };
  const enrichTask = useCallback((task: WorkspaceTask): WorkspaceTask => {
    const member = data.members.find((item) => item.id === task.assigneeId);
    return { ...task, assigneeName: task.assigneeName || member?.name || null, assigneeColor: task.assigneeColor || member?.avatarColor || null };
  }, [data.members]);

  const openActivityTarget = (targetType: ActivityTarget, targetId: string | null) => {
    if (!targetType || !targetId) return;
    if (targetType === "page") {
      const page = data.pages.find((item) => item.id === targetId);
      if (page) { setTemplatesInitially(false); setPageModal(page); } else notify("That page no longer exists.", "error");
    } else {
      const task = data.tasks.find((item) => item.id === targetId);
      if (task) setTaskModal(task); else notify("That task no longer exists.", "error");
    }
  };

  const createTask = async (input: TaskInput) => {
    if (!requireAuth()) throw new Error("Sign in to create a task.");
    const now = new Date().toISOString();
    const assigned = data.members.find((member) => member.id === input.assigneeId);
    const optimistic: WorkspaceTask = { ...input, id: `optimistic-${Date.now()}`, position: Date.now(), createdAt: now, updatedAt: now, assigneeName: assigned?.name ?? null, assigneeColor: assigned?.avatarColor ?? null };
    setData((current) => ({ ...current, tasks: [...current.tasks, optimistic] }));
    try {
      const result = await requestJson<{ task: WorkspaceTask }>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
      const saved = enrichTask(result.task);
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === optimistic.id ? saved : task) }));
      notify("Task added to your workspace.");
    } catch (error) {
      setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== optimistic.id) }));
      if (error instanceof Error && error.message.includes("Sign in")) { setAuthOpen(true); setAuthMode("login"); }
      notify(error instanceof Error ? error.message : "Couldn’t create that task.", "error");
      throw error;
    }
  };

  const updateTask = async (taskId: string, input: Partial<TaskInput>) => {
    if (!requireAuth()) throw new Error("Sign in to update this task.");
    const previous = data.tasks.find((task) => task.id === taskId);
    if (!previous) return;
    const assignee = input.assigneeId === undefined ? undefined : data.members.find((member) => member.id === input.assigneeId);
    const updated = { ...previous, ...input, assigneeName: input.assigneeId === null ? null : assignee?.name ?? previous.assigneeName, assigneeColor: input.assigneeId === null ? null : assignee?.avatarColor ?? previous.assigneeColor, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? updated : task) }));
    try {
      const result = await requestJson<{ task: WorkspaceTask }>(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(input) });
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? enrichTask({ ...result.task, assigneeName: result.task.assigneeName ?? updated.assigneeName, assigneeColor: result.task.assigneeColor ?? updated.assigneeColor }) : task) }));
    } catch (error) {
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? previous : task) }));
      if (error instanceof Error && error.message.includes("Sign in")) { setAuthOpen(true); setAuthMode("login"); }
      notify(error instanceof Error ? error.message : "Couldn’t update that task.", "error");
      throw error;
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!requireAuth()) throw new Error("Sign in to delete this task.");
    const previous = data.tasks.find((task) => task.id === taskId);
    setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }));
    try { await requestJson(`/api/tasks/${taskId}`, { method: "DELETE" }); notify("Task removed."); }
    catch (error) { if (previous) setData((current) => ({ ...current, tasks: [...current.tasks, previous] })); notify(error instanceof Error ? error.message : "Couldn’t delete that task.", "error"); throw error; }
  };

  const savePage = async (pageId: string | undefined, input: PageInput) => {
    if (!requireAuth()) throw new Error("Sign in to save a page.");
    if (!pageId) {
      const optimistic: WorkspacePage = { ...input, id: `optimistic-${Date.now()}`, updatedAt: new Date().toISOString() };
      setData((current) => ({ ...current, pages: [optimistic, ...current.pages] }));
      try { const result = await requestJson<{ page: WorkspacePage }>("/api/pages", { method: "POST", body: JSON.stringify(input) }); setData((current) => ({ ...current, pages: current.pages.map((page) => page.id === optimistic.id ? result.page : page) })); notify("Your page is ready."); }
      catch (error) { setData((current) => ({ ...current, pages: current.pages.filter((page) => page.id !== optimistic.id) })); notify(error instanceof Error ? error.message : "Couldn’t create that page.", "error"); throw error; }
      return;
    }
    const previous = data.pages.find((page) => page.id === pageId);
    if (!previous) return;
    const optimistic = { ...previous, ...input, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, pages: current.pages.map((page) => page.id === pageId ? optimistic : page) }));
    try { const result = await requestJson<{ page: WorkspacePage }>(`/api/pages/${pageId}`, { method: "PATCH", body: JSON.stringify(input) }); setData((current) => ({ ...current, pages: current.pages.map((page) => page.id === pageId ? result.page : page) })); notify("Page saved."); }
    catch (error) { setData((current) => ({ ...current, pages: current.pages.map((page) => page.id === pageId ? previous : page) })); notify(error instanceof Error ? error.message : "Couldn’t save that page.", "error"); throw error; }
  };

  const toggleFavorite = async (page: WorkspacePage) => {
    if (!requireAuth()) return;
    const previousValue = page.isFavorite;
    const nextValue = !previousValue;
    setData((current) => ({ ...current, pages: current.pages.map((item) => item.id === page.id ? { ...item, isFavorite: nextValue } : item) }));
    try { await requestJson(`/api/pages/${page.id}`, { method: "PATCH", body: JSON.stringify({ isFavorite: nextValue }) }); }
    catch (error) { setData((current) => ({ ...current, pages: current.pages.map((item) => item.id === page.id ? { ...item, isFavorite: previousValue } : item) })); notify(error instanceof Error ? error.message : "Couldn’t update favourites.", "error"); }
  };

  const deletePage = async (pageId: string) => {
    if (!requireAuth()) throw new Error("Sign in to delete a page.");
    const previous = data.pages.find((page) => page.id === pageId);
    setData((current) => ({ ...current, pages: current.pages.filter((page) => page.id !== pageId) }));
    try { await requestJson(`/api/pages/${pageId}`, { method: "DELETE" }); notify("Page deleted."); }
    catch (error) { if (previous) setData((current) => ({ ...current, pages: [previous, ...current.pages] })); notify(error instanceof Error ? error.message : "Couldn’t delete that page.", "error"); throw error; }
  };

  const inviteTeammate = async (email: string) => {
    if (!requireAuth()) throw new Error("Sign in to invite a teammate.");
    const result = await requestJson<{ invite: Invite }>("/api/members", { method: "POST", body: JSON.stringify({ email }) });
    setInvites((current) => [result.invite, ...current.filter((invite) => invite.email !== result.invite.email)]);
    notify("Invitation link created.");
    return result.invite.url ?? "";
  };

  const removeMember = async (member: WorkspaceMember) => {
    if (!requireAuth() || !window.confirm(`Remove ${member.name} from this workspace?`)) return;
    const previous = data.members;
    setData((current) => ({ ...current, members: current.members.filter((person) => person.id !== member.id) }));
    try { await requestJson(`/api/members/${member.id}`, { method: "DELETE" }); notify(`${member.name} was removed from the team.`); }
    catch (error) { setData((current) => ({ ...current, members: previous })); notify(error instanceof Error ? error.message : "Couldn’t update the team.", "error"); }
  };

  const saveSettings = async (values: Pick<WorkspaceSnapshot["workspace"], "name" | "currency" | "timezone">) => {
    if (!requireAuth()) throw new Error("Sign in to update workspace settings.");
    const previous = data.workspace;
    setData((current) => ({ ...current, workspace: { ...current.workspace, ...values } }));
    try { await requestJson("/api/workspace", { method: "PATCH", body: JSON.stringify(values) }); notify("Workspace settings saved."); }
    catch (error) { setData((current) => ({ ...current, workspace: previous })); notify(error instanceof Error ? error.message : "Couldn’t save those settings.", "error"); throw error; }
  };

  const signOut = async () => {
    setProfileOpen(false);
    if (user?.isGuest && !window.confirm("Your guest workspace is tied to this browser. Sign out only after saving it to an account, or you may lose access. Sign out anyway?")) return;
    try { await requestJson("/api/auth", { method: "DELETE" }); }
    catch { /* Clear the local token regardless so this device is signed out. */ }
    forgetSessionToken();
    window.location.assign("/");
  };

  const handleAuthSuccess = () => {
    resumeSession();
  };

  const openGathering = () => { setComposeKind("events"); changeView("events"); };
  const studio = (kind: "projects" | "events" | "library" | "goals" | "decisions" | "rituals" | "focus") => (
    <StudioBoard
      kind={kind}
      members={data.members}
      tasks={data.tasks}
      timezone={data.workspace.timezone}
      startOpen={composeKind === kind}
      onComposeHandled={() => setComposeKind(null)}
      onOpenTask={(task) => setTaskModal(task)}
      onCreateLinkedTask={async (projectName) => { await createTask({ title: `First step for ${projectName}`, description: "", status: "todo", priority: "medium", project: projectName, dueDate: null, assigneeId: user?.id ?? null }); }}
    />
  );

  const renderContent = () => {
    if (view === "overview") return <div className="view-stack"><HomeOverview data={data} user={user} onCreateTask={openNewTask} onCreatePage={openNewPage} onNavigate={changeView} onOpenPage={(page) => { setTemplatesInitially(false); setPageModal(page); }} onOpenTask={(task) => setTaskModal(task)} onToggleTask={(task) => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" }).catch(() => undefined)} onInvite={() => { if (requireAuth()) setInviteOpen(true); }} onActivityItem={openActivityTarget} onSeeAllActivity={() => changeView("activity")} /><StudioPulse timezone={data.workspace.timezone} onOpen={changeView} /></div>;
    if (view === "tasks") return <TasksView tasks={data.tasks} members={data.members} timezone={data.workspace.timezone} currentUserId={user?.id} onOpen={(task) => setTaskModal(task)} onToggle={(task) => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" }).catch(() => undefined)} onMove={(task, status) => updateTask(task.id, { status }).catch(() => undefined)} onCreate={openNewTask} />;
    if (view === "inbox") return <TasksView tasks={data.tasks.filter((task) => task.status !== "done")} members={data.members} timezone={data.workspace.timezone} currentUserId={user?.id} onOpen={(task) => setTaskModal(task)} onToggle={(task) => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" }).catch(() => undefined)} onMove={(task, status) => updateTask(task.id, { status }).catch(() => undefined)} onCreate={openNewTask} title="Your inbox" subtitle="The open work assigned to you, all in one calm place." mineOnly />;
    if (view === "projects") return studio("projects");
    if (view === "events") return studio("events");
    if (view === "library") return studio("library");
    if (view === "goals") return studio("goals");
    if (view === "decisions") return studio("decisions");
    if (view === "rituals") return studio("rituals");
    if (view === "focus") return studio("focus");
    if (view === "activity") return <ActivityView onOpenTarget={openActivityTarget} onOpened={() => setUnread(0)} />;
    if (view === "pages") return <PagesView pages={data.pages} onOpen={(page) => setPageModal(page)} onCreate={openNewPage} onFavorite={toggleFavorite} />;
    if (view === "calendar") return <CalendarView tasks={data.tasks} timezone={data.workspace.timezone} onOpen={(task) => setTaskModal(task)} onCreate={openNewTask} onCreateEvent={openGathering} onOpenEvents={() => changeView("events")} />;
    if (view === "profile") return <ProfileView user={user} onUpdated={setUser} />;
    if (view === "connectors") return <ConnectorsView />;
    if (view === "team") return <TeamView data={data} user={user} invites={invites} invitesLoading={invitesLoading} canManage={canManageTeam} onInvite={() => { if (requireAuth()) setInviteOpen(true); }} onRemove={removeMember} />;
    return <SettingsView data={data} onSave={saveSettings} />;
  };

  const viewLabels: Record<ViewName, string> = { overview: "Overview", inbox: "Your inbox", tasks: "Tasks", projects: "Projects", pages: "Pages", calendar: "Calendar", events: "Gatherings", library: "Library", goals: "Goals", decisions: "Decisions", rituals: "Rituals", focus: "Focus", activity: "Activity", team: "Team", settings: "Settings", profile: "Profile", connectors: "Connectors" };
  const favoritePages = data.pages.filter((page) => page.isFavorite).slice(0, 4);
  const openCount = data.tasks.filter((task) => task.status !== "done" && (!user || task.assigneeId === user.id)).length;

  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""}`}>
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""} ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}>
        <div className="sidebar-brand-row"><button className="brand-lockup" onClick={() => changeView("overview")} aria-label="Folio home"><span className="brand-mark"><span /><span /><span /><span /></span><span className="brand-name">folio<span className="brand-period">.</span></span></button><button className="sidebar-collapse" onClick={() => { if (window.innerWidth <= 820) setMobileOpen(false); else setSidebarCollapsed((value) => !value); }} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><PanelLeftClose size={17} /></button></div>
        <WorkspaceSwitcher id={data.workspace.id} name={data.workspace.name} />
        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-section-label">YOUR SPACE</span>
          <NavButton icon={LayoutDashboard} label="Overview" active={view === "overview"} onClick={() => changeView("overview")} />
          <NavButton icon={Inbox} label="Your inbox" active={view === "inbox"} count={openCount || undefined} onClick={() => changeView("inbox")} />
          <NavButton icon={Search} label="Quick find" shortcut="⌘ K" onClick={() => setSearchOpen(true)} />
          <NavButton icon={Activity} label="Activity" active={view === "activity"} onClick={() => changeView("activity")} />
          <span className="nav-section-label nav-section-label--spaced">THE WORK</span>
          <NavButton icon={CheckCheck} label="Tasks" active={view === "tasks"} count={data.tasks.filter((task) => task.status !== "done").length || undefined} onClick={() => changeView("tasks")} />
          <NavButton icon={FolderKanban} label="Projects" active={view === "projects"} onClick={() => changeView("projects")} />
          <NavButton icon={FileText} label="Pages" active={view === "pages"} onClick={() => changeView("pages")} />
          <NavButton icon={CalendarDays} label="Calendar" active={view === "calendar"} onClick={() => changeView("calendar")} />
          <NavButton icon={Sun} label="Gatherings" active={view === "events"} onClick={() => changeView("events")} />
          <NavButton icon={BookOpen} label="Library" active={view === "library"} onClick={() => changeView("library")} />
          <NavButton icon={Target} label="Goals" active={view === "goals"} onClick={() => changeView("goals")} />
          <NavButton icon={Scale} label="Decisions" active={view === "decisions"} onClick={() => changeView("decisions")} />
          <NavButton icon={Flame} label="Rituals" active={view === "rituals"} onClick={() => changeView("rituals")} />
          <NavButton icon={Timer} label="Focus" active={view === "focus"} onClick={() => changeView("focus")} />
          <NavButton icon={LayoutTemplate} label="Templates" onClick={openTemplates} />
          <NavButton icon={Users} label="Team" active={view === "team"} onClick={() => changeView("team")} />
          <span className="nav-section-label nav-section-label--spaced sidebar-favourites-heading"><span>FAVOURITES</span><button onClick={() => changeView("pages")} aria-label="Browse pages"><Plus size={14} /></button></span>
          {favoritePages.length ? favoritePages.map((page) => <button key={page.id} className={`favorite-link ${view === "pages" ? "favorite-link--active" : ""}`} onClick={() => { changeView("pages"); setPageModal(page); }}><span><PageIcon value={page.icon} size={15} /></span><span>{page.title}</span></button>) : <button className="sidebar-empty-link" onClick={() => { changeView("pages"); openNewPage(); }}><Plus size={14} /> Add a favourite</button>}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-timezone"><Globe2 size={14} /><span>{data.workspace.timezone}</span><span className="timezone-country">{data.workspace.currency}</span></div><button className="sidebar-settings" onClick={() => changeView("settings")}><Settings2 size={16} /><span>Workspace settings</span><ArrowRight size={14} /></button>{user?.isGuest ? <button className="sidebar-plan sidebar-plan--guest" onClick={() => setGuestSaveOpen(true)}><span className="sidebar-plan__icon"><Leaf size={16} /></span><span><strong>Make this space yours</strong><small>Save your guest workspace</small></span><ArrowUpRight size={15} /></button> : <div className="sidebar-plan"><span className="sidebar-plan__icon"><Sparkles size={15} /></span><span><strong>One shared home</strong><small>Your team is in sync.</small></span><ArrowUpRight size={15} /></div>}<div className="profile-area">{profileOpen && <div className="profile-menu"><div className="profile-menu__identity">{user ? <Avatar name={user.name} color={user.avatarColor} /> : <span className="profile-placeholder">?</span>}<span><strong>{user?.name ?? "Signed out"}</strong><small>{user?.isGuest ? "Guest session · this browser" : user?.email ?? "Sign in to make changes"}</small></span></div><button onClick={() => { setProfileOpen(false); changeView("profile"); }}><UserRound size={15} /> Profile</button><button onClick={() => { setProfileOpen(false); changeView("connectors"); }}><Settings2 size={15} /> Connectors</button><button onClick={() => { setProfileOpen(false); changeView("team"); }}><Users size={15} /> Team & members</button>{authenticated ? <button className="profile-menu__danger" onClick={signOut}><LogOut size={15} /> Sign out</button> : <button onClick={() => { setProfileOpen(false); setAuthMode("login"); setAuthOpen(true); }}><ShieldCheck size={15} /> Sign in</button>}</div>}<button className="profile-button" onClick={() => setProfileOpen((value) => !value)}>{user ? <Avatar name={user.name} color={user.avatarColor} /> : <span className="profile-placeholder">?</span>}<span className="profile-button__copy"><strong>{user?.name ?? "Signed out"}</strong><small>{user?.isGuest ? "Guest workspace" : authenticated ? "Personal workspace" : "Read-only preview"}</small></span><MoreHorizontal size={18} /></button></div></div>
      </aside>

      <main className="main-shell"><header className="topbar"><div className="topbar__left"><button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><span className="topbar-workspace">{data.workspace.name}</span><ChevronRight size={14} className="breadcrumb-chevron" /><span className="topbar-current">{viewLabels[view]}</span><span className="topbar-sync"><span className={sessionReady ? "sync-dot" : "sync-dot sync-dot--loading"} />{sessionReady ? "Workspace ready" : "Opening workspace"}</span></div><div className="topbar__actions">{user?.isGuest && <button className="guest-badge" onClick={() => setGuestSaveOpen(true)}><Leaf size={14} /> Guest <span>·</span> Save workspace</button>}<button className="topbar-search" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-button topbar-bell" onClick={() => changeView("activity")} aria-label="Open activity feed"><Bell size={17} />{unread > 0 ? <span className="notification-badge">{unread > 9 ? "9+" : unread}</span> : <span className="notification-dot" />}</button><span className="topbar-divider" />{user ? <button className="topbar-avatar" onClick={() => setProfileOpen((value) => !value)}><Avatar name={user.name} color={user.avatarColor} size="small" /></button> : <button className="text-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Sign in</button>}</div></header>
        <div className="content-shell"><div className="content-max" key={view}>{renderContent()}</div><footer className="app-footer"><span>Made for people doing good work.</span><span><span className="footer-dot" /> Private team workspace <span className="footer-divider">·</span> {data.workspace.currency} · {data.workspace.timezone}</span></footer></div>
      </main>

      {taskModal && <TaskDialog key={taskModal === "new" ? "new-task" : taskModal.id} task={taskModal === "new" ? undefined : taskModal} members={data.members} currentUser={user} timezone={data.workspace.timezone} onClose={() => setTaskModal(null)} onSave={(input) => taskModal === "new" ? createTask(input) : updateTask(taskModal.id, input)} onDelete={taskModal !== "new" ? deleteTask : undefined} notify={notify} />}
      {pageModal && <PageEditor key={pageModal === "new" ? "new-page" : pageModal.id} page={pageModal === "new" ? undefined : pageModal} startWithTemplates={templatesInitially} onClose={() => setPageModal(null)} onSave={(input) => savePage(pageModal === "new" ? undefined : pageModal.id, input)} onDelete={pageModal !== "new" ? deletePage : undefined} onDuplicate={pageModal !== "new" ? (input) => savePage(undefined, input) : undefined} />}
      {guestSaveOpen && <GuestSaveDialog onClose={() => setGuestSaveOpen(false)} />}
      {inviteOpen && <InviteDialog workspaceName={data.workspace.name} onClose={() => setInviteOpen(false)} onInvite={inviteTeammate} />}
      {authOpen && <AuthDialog mode={authMode} inviteToken={inviteToken} onClose={() => setAuthOpen(false)} onModeChange={setAuthMode} onSuccess={handleAuthSuccess} />}
      {searchOpen && <SearchDialog query={searchQuery} setQuery={setSearchQuery} pages={data.pages} tasks={data.tasks} onClose={() => { setSearchOpen(false); setSearchQuery(""); }} onPage={(page) => { setSearchOpen(false); setView("pages"); setPageModal(page); }} onTask={(task) => { setSearchOpen(false); setTaskModal(task); }} />}
      {toast && <div className={`toast toast--${toast.kind}`} role="status"><span className="toast-icon">{toast.kind === "success" ? <Check size={15} /> : <CircleHelp size={15} />}</span><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
      {!authenticated && sessionReady && <button className="preview-signin" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}><ShieldCheck size={14} /> Sign in to your workspace</button>}
    </div>
  );
}

function NavButton({ icon: Icon, label, active = false, count, shortcut, onClick }: { icon: LucideIcon; label: string; active?: boolean; count?: number; shortcut?: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "nav-button--active" : ""}`} onClick={onClick}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}{shortcut && <kbd>{shortcut}</kbd>}</button>;
}
