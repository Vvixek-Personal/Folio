import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  decisions,
  focusSessions,
  goals,
  libraryItems,
  projects,
  rituals,
  studioEvents,
  users,
  workspaceMembers,
} from "@/db/schema";
import { recordActivity } from "@/lib/activity";
import type {
  DecisionStatus,
  EventKind,
  FocusMood,
  FocusSession,
  GoalHorizon,
  GoalStatus,
  LibraryItem,
  LibraryKind,
  LibraryStatus,
  ProjectStatus,
  RitualCadence,
  StudioDecision,
  StudioEvent,
  StudioGoal,
  StudioKind,
  StudioProject,
  StudioRitual,
  StudioSnapshot,
} from "@/lib/studio-types";
import { booleanField, enumField, isIsoDate, nullableTextField, readJsonBody, textField } from "@/lib/validate";

const PROJECT_STATUSES = ["planning", "active", "paused", "shipped"] as const;
const EVENT_KINDS = ["meeting", "ritual", "deadline", "focus"] as const;
const LIBRARY_KINDS = ["article", "book", "film", "tool", "note"] as const;
const LIBRARY_STATUSES = ["queued", "reading", "done"] as const;
const GOAL_HORIZONS = ["week", "month", "quarter"] as const;
const GOAL_STATUSES = ["active", "done", "paused"] as const;
const DECISION_STATUSES = ["open", "decided", "revisited"] as const;
const CADENCES = ["daily", "weekdays", "weekly"] as const;
const MOODS = ["calm", "deep", "scattered"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function day(value: Date | string | null) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function dayInTimezone(timezone: string, offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const date = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
}

function shift(isoDate: string, days: number) {
  const [year, month, date] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

function weekday(isoDate: string) {
  const [year, month, date] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

function colorField(body: object, fallback = "#64987c") {
  const value = textField(body, "color", 7);
  if (!value) return fallback;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function urlField(body: object) {
  const value = textField(body, "url", 500) ?? "";
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function intField(body: object, key: string, min: number, max: number) {
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function memberOrNull(workspaceId: string, userId: string | null | undefined) {
  if (!userId) return null;
  if (!UUID_PATTERN.test(userId)) return undefined;
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return member ? userId : undefined;
}

function projectOf(row: typeof projects.$inferSelect, leadName: string | null): StudioProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status as ProjectStatus,
    targetDate: day(row.targetDate),
    leadId: row.leadId,
    leadName,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listStudio(workspaceId: string): Promise<StudioSnapshot> {
  const [projectRows, eventRows, libraryRows, goalRows, decisionRows, ritualRows, focusRows] = await Promise.all([
    db.select({ project: projects, leadName: users.name }).from(projects).leftJoin(users, eq(projects.leadId, users.id)).where(eq(projects.workspaceId, workspaceId)).orderBy(desc(projects.updatedAt)),
    db.select().from(studioEvents).where(eq(studioEvents.workspaceId, workspaceId)).orderBy(asc(studioEvents.startsOn)),
    db.select().from(libraryItems).where(eq(libraryItems.workspaceId, workspaceId)).orderBy(desc(libraryItems.updatedAt)),
    db.select({ goal: goals, ownerName: users.name }).from(goals).leftJoin(users, eq(goals.ownerId, users.id)).where(eq(goals.workspaceId, workspaceId)).orderBy(desc(goals.updatedAt)),
    db.select().from(decisions).where(eq(decisions.workspaceId, workspaceId)).orderBy(desc(decisions.updatedAt)),
    db.select({ ritual: rituals, ownerName: users.name }).from(rituals).leftJoin(users, eq(rituals.ownerId, users.id)).where(eq(rituals.workspaceId, workspaceId)).orderBy(desc(rituals.updatedAt)),
    db.select().from(focusSessions).where(eq(focusSessions.workspaceId, workspaceId)).orderBy(desc(focusSessions.completedAt)),
  ]);

  return {
    projects: projectRows.map((row) => projectOf(row.project, row.leadName)),
    events: eventRows.map((row): StudioEvent => ({
      id: row.id, title: row.title, notes: row.notes, kind: row.kind as EventKind, startsOn: day(row.startsOn) ?? "", startsAt: row.startsAt, location: row.location, projectName: row.projectName, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
    })),
    library: libraryRows.map((row): LibraryItem => ({
      id: row.id, title: row.title, url: row.url, kind: row.kind as LibraryKind, note: row.note, status: row.status as LibraryStatus, tags: row.tags, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
    })),
    goals: goalRows.map((row): StudioGoal => ({
      id: row.goal.id, title: row.goal.title, detail: row.goal.detail, horizon: row.goal.horizon as GoalHorizon, progress: row.goal.progress, status: row.goal.status as GoalStatus, dueDate: day(row.goal.dueDate), ownerId: row.goal.ownerId, ownerName: row.ownerName, createdAt: iso(row.goal.createdAt), updatedAt: iso(row.goal.updatedAt),
    })),
    decisions: decisionRows.map((row): StudioDecision => ({
      id: row.id, title: row.title, context: row.context, outcome: row.outcome, status: row.status as DecisionStatus, projectName: row.projectName, decidedOn: day(row.decidedOn), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
    })),
    rituals: ritualRows.map((row): StudioRitual => ({
      id: row.ritual.id, name: row.ritual.name, cadence: row.ritual.cadence as RitualCadence, note: row.ritual.note, streak: row.ritual.streak, bestStreak: row.ritual.bestStreak, lastCompletedOn: day(row.ritual.lastCompletedOn), ownerId: row.ritual.ownerId, ownerName: row.ownerName, createdAt: iso(row.ritual.createdAt), updatedAt: iso(row.ritual.updatedAt),
    })),
    focus: focusRows.map((row): FocusSession => ({
      id: row.id, title: row.title, minutes: row.minutes, projectName: row.projectName, mood: row.mood as FocusMood, note: row.note, completedAt: iso(row.completedAt), createdAt: iso(row.createdAt),
    })),
  };
}

export async function readStudioBody(request: Request) {
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body;
}

export async function createStudioItem(kind: StudioKind, workspaceId: string, userId: string, timezone: string, body: object) {
  const now = new Date();
  if (kind === "projects") {
    const name = textField(body, "name", 80) ?? "";
    if (name.length < 2) return { error: "Give the project a name.", status: 400 };
    const leadId = await memberOrNull(workspaceId, nullableTextField(body, "leadId", 64) ?? userId);
    if (leadId === undefined) return { error: "Choose a lead from this workspace.", status: 400 };
    const targetDate = nullableTextField(body, "targetDate", 10);
    if (targetDate && !isIsoDate(targetDate)) return { error: "Enter a valid target date.", status: 400 };
    const [row] = await db.insert(projects).values({
      workspaceId, createdBy: userId, leadId, name, description: textField(body, "description", 2000) ?? "", color: colorField(body), status: enumField(body, "status", PROJECT_STATUSES) ?? "active", targetDate: targetDate ?? null, updatedAt: now,
    }).returning();
    recordActivity({ workspaceId, actorId: userId, type: "project_created", summary: name });
    const [lead] = leadId ? await db.select({ name: users.name }).from(users).where(eq(users.id, leadId)).limit(1) : [];
    return { item: projectOf(row, lead?.name ?? null) };
  }
  if (kind === "events") {
    const title = textField(body, "title", 140) ?? "";
    const startsOn = textField(body, "startsOn", 10) ?? "";
    if (title.length < 2) return { error: "Name the gathering first.", status: 400 };
    if (!isIsoDate(startsOn)) return { error: "Choose a date.", status: 400 };
    const startsAt = textField(body, "startsAt", 5);
    if (startsAt && !/^\d{2}:\d{2}$/.test(startsAt)) return { error: "Use a time like 09:30.", status: 400 };
    const [row] = await db.insert(studioEvents).values({
      workspaceId, createdBy: userId, title, notes: textField(body, "notes", 2000) ?? "", kind: enumField(body, "kind", EVENT_KINDS) ?? "meeting", startsOn, startsAt: startsAt || null, location: textField(body, "location", 120) ?? "", projectName: textField(body, "projectName", 80) ?? "", updatedAt: now,
    }).returning();
    recordActivity({ workspaceId, actorId: userId, type: "event_created", summary: title });
    return { item: (await listStudio(workspaceId)).events.find((event) => event.id === row.id) };
  }
  if (kind === "library") {
    const title = textField(body, "title", 160) ?? "";
    if (title.length < 2) return { error: "Give this a title.", status: 400 };
    const url = urlField(body);
    if (url === null) return { error: "Use a full http or https link, or leave it blank.", status: 400 };
    const [row] = await db.insert(libraryItems).values({
      workspaceId, createdBy: userId, title, url, kind: enumField(body, "kind", LIBRARY_KINDS) ?? "article", note: textField(body, "note", 2000) ?? "", status: enumField(body, "status", LIBRARY_STATUSES) ?? "queued", tags: textField(body, "tags", 120) ?? "", updatedAt: now,
    }).returning();
    recordActivity({ workspaceId, actorId: userId, type: "library_saved", summary: title });
    return { item: (await listStudio(workspaceId)).library.find((item) => item.id === row.id) };
  }
  if (kind === "goals") {
    const title = textField(body, "title", 140) ?? "";
    if (title.length < 2) return { error: "Name the goal.", status: 400 };
    const ownerId = await memberOrNull(workspaceId, nullableTextField(body, "ownerId", 64) ?? userId);
    if (ownerId === undefined) return { error: "Choose someone on this workspace.", status: 400 };
    const dueDate = nullableTextField(body, "dueDate", 10);
    if (dueDate && !isIsoDate(dueDate)) return { error: "Enter a valid date.", status: 400 };
    const [row] = await db.insert(goals).values({
      workspaceId, createdBy: userId, ownerId, title, detail: textField(body, "detail", 2000) ?? "", horizon: enumField(body, "horizon", GOAL_HORIZONS) ?? "month", progress: intField(body, "progress", 0, 100) ?? 0, status: enumField(body, "status", GOAL_STATUSES) ?? "active", dueDate: dueDate ?? null, updatedAt: now,
    }).returning();
    recordActivity({ workspaceId, actorId: userId, type: "goal_created", summary: title });
    return { item: (await listStudio(workspaceId)).goals.find((goal) => goal.id === row.id) };
  }
  if (kind === "decisions") {
    const title = textField(body, "title", 160) ?? "";
    if (title.length < 2) return { error: "Name the decision.", status: 400 };
    const decidedOn = nullableTextField(body, "decidedOn", 10);
    if (decidedOn && !isIsoDate(decidedOn)) return { error: "Enter a valid date.", status: 400 };
    const status = enumField(body, "status", DECISION_STATUSES) ?? "open";
    const [row] = await db.insert(decisions).values({
      workspaceId, createdBy: userId, title, context: textField(body, "context", 2000) ?? "", outcome: textField(body, "outcome", 2000) ?? "", status, projectName: textField(body, "projectName", 80) ?? "", decidedOn: decidedOn ?? (status === "decided" ? dayInTimezone(timezone) : null), updatedAt: now,
    }).returning();
    recordActivity({ workspaceId, actorId: userId, type: "decision_logged", summary: title });
    return { item: (await listStudio(workspaceId)).decisions.find((item) => item.id === row.id) };
  }
  if (kind === "rituals") {
    const name = textField(body, "name", 80) ?? "";
    if (name.length < 2) return { error: "Name the ritual.", status: 400 };
    const ownerId = await memberOrNull(workspaceId, nullableTextField(body, "ownerId", 64) ?? userId);
    if (ownerId === undefined) return { error: "Choose someone on this workspace.", status: 400 };
    const [row] = await db.insert(rituals).values({
      workspaceId, createdBy: userId, ownerId, name, cadence: enumField(body, "cadence", CADENCES) ?? "daily", note: textField(body, "note", 500) ?? "", updatedAt: now,
    }).returning();
    recordActivity({ workspaceId, actorId: userId, type: "ritual_created", summary: name });
    return { item: (await listStudio(workspaceId)).rituals.find((item) => item.id === row.id) };
  }
  const title = textField(body, "title", 140) ?? "";
  const minutes = intField(body, "minutes", 1, 240);
  if (title.length < 2) return { error: "Name the focus session.", status: 400 };
  if (!minutes) return { error: "Choose between 1 and 240 minutes.", status: 400 };
  const [row] = await db.insert(focusSessions).values({
    workspaceId, createdBy: userId, title, minutes, projectName: textField(body, "projectName", 80) ?? "", mood: enumField(body, "mood", MOODS) ?? "calm", note: textField(body, "note", 500) ?? "", completedAt: now,
  }).returning();
  recordActivity({ workspaceId, actorId: userId, type: "focus_logged", summary: title, detail: `${minutes} min` });
  return { item: (await listStudio(workspaceId)).focus.find((item) => item.id === row.id) };
}

export async function updateStudioItem(kind: StudioKind, workspaceId: string, userId: string, timezone: string, id: string, body: object) {
  if (!UUID_PATTERN.test(id)) return { error: "Not found.", status: 404 };
  const now = new Date();
  if (kind === "projects") {
    const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId))).limit(1);
    if (!existing) return { error: "Project not found.", status: 404 };
    const name = textField(body, "name", 80);
    if (name !== undefined && name.length < 2) return { error: "Give the project a name.", status: 400 };
    const leadRaw = nullableTextField(body, "leadId", 64);
    const leadId = leadRaw === undefined ? undefined : await memberOrNull(workspaceId, leadRaw);
    if (leadId === undefined && leadRaw !== undefined) return { error: "Choose a lead from this workspace.", status: 400 };
    const targetDate = nullableTextField(body, "targetDate", 10);
    if (targetDate && !isIsoDate(targetDate)) return { error: "Enter a valid target date.", status: 400 };
    const status = enumField(body, "status", PROJECT_STATUSES);
    await db.update(projects).set({
      name: name ?? existing.name,
      description: textField(body, "description", 2000) ?? existing.description,
      color: textField(body, "color", 7) && /^#[0-9a-f]{6}$/i.test(textField(body, "color", 7) ?? "") ? textField(body, "color", 7)! : existing.color,
      status: status ?? existing.status,
      leadId: leadRaw === undefined ? existing.leadId : leadId ?? null,
      targetDate: targetDate === undefined ? existing.targetDate : targetDate,
      updatedAt: now,
    }).where(eq(projects.id, id));
    recordActivity({ workspaceId, actorId: userId, type: status === "shipped" && existing.status !== "shipped" ? "project_shipped" : "project_updated", summary: name ?? existing.name });
    return { item: (await listStudio(workspaceId)).projects.find((item) => item.id === id) };
  }
  if (kind === "events") {
    const [existing] = await db.select().from(studioEvents).where(and(eq(studioEvents.id, id), eq(studioEvents.workspaceId, workspaceId))).limit(1);
    if (!existing) return { error: "Gathering not found.", status: 404 };
    const title = textField(body, "title", 140);
    if (title !== undefined && title.length < 2) return { error: "Name the gathering first.", status: 400 };
    const startsOn = textField(body, "startsOn", 10);
    if (startsOn && !isIsoDate(startsOn)) return { error: "Choose a date.", status: 400 };
    const startsAt = nullableTextField(body, "startsAt", 5);
    if (startsAt && !/^\d{2}:\d{2}$/.test(startsAt)) return { error: "Use a time like 09:30.", status: 400 };
    await db.update(studioEvents).set({
      title: title ?? existing.title,
      notes: textField(body, "notes", 2000) ?? existing.notes,
      kind: enumField(body, "kind", EVENT_KINDS) ?? existing.kind,
      startsOn: startsOn ?? existing.startsOn,
      startsAt: startsAt === undefined ? existing.startsAt : startsAt,
      location: textField(body, "location", 120) ?? existing.location,
      projectName: textField(body, "projectName", 80) ?? existing.projectName,
      updatedAt: now,
    }).where(eq(studioEvents.id, id));
    recordActivity({ workspaceId, actorId: userId, type: "event_updated", summary: title ?? existing.title });
    return { item: (await listStudio(workspaceId)).events.find((item) => item.id === id) };
  }
  if (kind === "library") {
    const [existing] = await db.select().from(libraryItems).where(and(eq(libraryItems.id, id), eq(libraryItems.workspaceId, workspaceId))).limit(1);
    if (!existing) return { error: "Library item not found.", status: 404 };
    const title = textField(body, "title", 160);
    if (title !== undefined && title.length < 2) return { error: "Give this a title.", status: 400 };
    const url = (body as Record<string, unknown>).url === undefined ? existing.url : urlField(body);
    if (url === null) return { error: "Use a full http or https link, or leave it blank.", status: 400 };
    await db.update(libraryItems).set({
      title: title ?? existing.title,
      url,
      kind: enumField(body, "kind", LIBRARY_KINDS) ?? existing.kind,
      note: textField(body, "note", 2000) ?? existing.note,
      status: enumField(body, "status", LIBRARY_STATUSES) ?? existing.status,
      tags: textField(body, "tags", 120) ?? existing.tags,
      updatedAt: now,
    }).where(eq(libraryItems.id, id));
    return { item: (await listStudio(workspaceId)).library.find((item) => item.id === id) };
  }
  if (kind === "goals") {
    const [existing] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.workspaceId, workspaceId))).limit(1);
    if (!existing) return { error: "Goal not found.", status: 404 };
    const title = textField(body, "title", 140);
    if (title !== undefined && title.length < 2) return { error: "Name the goal.", status: 400 };
    const ownerRaw = nullableTextField(body, "ownerId", 64);
    const ownerId = ownerRaw === undefined ? undefined : await memberOrNull(workspaceId, ownerRaw);
    if (ownerRaw !== undefined && ownerId === undefined) return { error: "Choose someone on this workspace.", status: 400 };
    const dueDate = nullableTextField(body, "dueDate", 10);
    if (dueDate && !isIsoDate(dueDate)) return { error: "Enter a valid date.", status: 400 };
    const progress = intField(body, "progress", 0, 100);
    const status = enumField(body, "status", GOAL_STATUSES) ?? (progress === 100 ? "done" : undefined);
    await db.update(goals).set({
      title: title ?? existing.title,
      detail: textField(body, "detail", 2000) ?? existing.detail,
      horizon: enumField(body, "horizon", GOAL_HORIZONS) ?? existing.horizon,
      progress: progress ?? existing.progress,
      status: status ?? existing.status,
      ownerId: ownerRaw === undefined ? existing.ownerId : ownerId ?? null,
      dueDate: dueDate === undefined ? existing.dueDate : dueDate,
      updatedAt: now,
    }).where(eq(goals.id, id));
    if ((status ?? existing.status) === "done" && existing.status !== "done") recordActivity({ workspaceId, actorId: userId, type: "goal_completed", summary: title ?? existing.title });
    else recordActivity({ workspaceId, actorId: userId, type: "goal_updated", summary: title ?? existing.title });
    return { item: (await listStudio(workspaceId)).goals.find((item) => item.id === id) };
  }
  if (kind === "decisions") {
    const [existing] = await db.select().from(decisions).where(and(eq(decisions.id, id), eq(decisions.workspaceId, workspaceId))).limit(1);
    if (!existing) return { error: "Decision not found.", status: 404 };
    const title = textField(body, "title", 160);
    if (title !== undefined && title.length < 2) return { error: "Name the decision.", status: 400 };
    const decidedOn = nullableTextField(body, "decidedOn", 10);
    if (decidedOn && !isIsoDate(decidedOn)) return { error: "Enter a valid date.", status: 400 };
    const status = enumField(body, "status", DECISION_STATUSES);
    await db.update(decisions).set({
      title: title ?? existing.title,
      context: textField(body, "context", 2000) ?? existing.context,
      outcome: textField(body, "outcome", 2000) ?? existing.outcome,
      status: status ?? existing.status,
      projectName: textField(body, "projectName", 80) ?? existing.projectName,
      decidedOn: decidedOn === undefined ? (status === "decided" && !existing.decidedOn ? dayInTimezone(timezone) : existing.decidedOn) : decidedOn,
      updatedAt: now,
    }).where(eq(decisions.id, id));
    recordActivity({ workspaceId, actorId: userId, type: "decision_logged", summary: title ?? existing.title });
    return { item: (await listStudio(workspaceId)).decisions.find((item) => item.id === id) };
  }
  if (kind === "rituals") {
    const [existing] = await db.select().from(rituals).where(and(eq(rituals.id, id), eq(rituals.workspaceId, workspaceId))).limit(1);
    if (!existing) return { error: "Ritual not found.", status: 404 };
    const complete = booleanField(body, "complete");
    if (complete !== undefined) {
      const today = dayInTimezone(timezone);
      let streak = existing.streak;
      let lastCompletedOn = existing.lastCompletedOn;
      if (complete && existing.lastCompletedOn !== today) {
        const yesterday = shift(today, -1);
        const continues = existing.lastCompletedOn === yesterday
          || (existing.cadence === "weekdays" && weekday(today) === 1 && existing.lastCompletedOn === shift(today, -3))
          || (existing.cadence === "weekly" && existing.lastCompletedOn && existing.lastCompletedOn >= shift(today, -8));
        streak = continues ? existing.streak + 1 : 1;
        lastCompletedOn = today;
        recordActivity({ workspaceId, actorId: userId, type: "ritual_kept", summary: existing.name, detail: `${streak} day streak` });
      } else if (!complete && existing.lastCompletedOn === today) {
        streak = Math.max(0, existing.streak - 1);
        lastCompletedOn = null;
      }
      await db.update(rituals).set({ streak, bestStreak: Math.max(existing.bestStreak, streak), lastCompletedOn, updatedAt: now }).where(eq(rituals.id, id));
      return { item: (await listStudio(workspaceId)).rituals.find((item) => item.id === id) };
    }
    const name = textField(body, "name", 80);
    if (name !== undefined && name.length < 2) return { error: "Name the ritual.", status: 400 };
    const ownerRaw = nullableTextField(body, "ownerId", 64);
    const ownerId = ownerRaw === undefined ? undefined : await memberOrNull(workspaceId, ownerRaw);
    if (ownerRaw !== undefined && ownerId === undefined) return { error: "Choose someone on this workspace.", status: 400 };
    await db.update(rituals).set({
      name: name ?? existing.name,
      cadence: enumField(body, "cadence", CADENCES) ?? existing.cadence,
      note: textField(body, "note", 500) ?? existing.note,
      ownerId: ownerRaw === undefined ? existing.ownerId : ownerId ?? null,
      updatedAt: now,
    }).where(eq(rituals.id, id));
    return { item: (await listStudio(workspaceId)).rituals.find((item) => item.id === id) };
  }
  const [existing] = await db.select().from(focusSessions).where(and(eq(focusSessions.id, id), eq(focusSessions.workspaceId, workspaceId))).limit(1);
  if (!existing) return { error: "Session not found.", status: 404 };
  const title = textField(body, "title", 140);
  if (title !== undefined && title.length < 2) return { error: "Name the focus session.", status: 400 };
  const minutes = intField(body, "minutes", 1, 240);
  await db.update(focusSessions).set({
    title: title ?? existing.title,
    minutes: minutes ?? existing.minutes,
    projectName: textField(body, "projectName", 80) ?? existing.projectName,
    mood: enumField(body, "mood", MOODS) ?? existing.mood,
    note: textField(body, "note", 500) ?? existing.note,
  }).where(eq(focusSessions.id, id));
  return { item: (await listStudio(workspaceId)).focus.find((item) => item.id === id) };
}

export async function deleteStudioItem(kind: StudioKind, workspaceId: string, userId: string, id: string) {
  if (!UUID_PATTERN.test(id)) return { error: "Not found.", status: 404 };
  const tables = { projects, events: studioEvents, library: libraryItems, goals, decisions, rituals, focus: focusSessions } as const;
  const table = tables[kind];
  const [existing] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.workspaceId, workspaceId))).limit(1);
  if (!existing) return { error: "Not found.", status: 404 };
  await db.delete(table).where(eq(table.id, id));
  recordActivity({ workspaceId, actorId: userId, type: "studio_removed", summary: kind });
  return { ok: true };
}
