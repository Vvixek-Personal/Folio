export type ProjectStatus = "planning" | "active" | "paused" | "shipped";
export type EventKind = "meeting" | "ritual" | "deadline" | "focus";
export type LibraryKind = "article" | "book" | "film" | "tool" | "note";
export type LibraryStatus = "queued" | "reading" | "done";
export type GoalHorizon = "week" | "month" | "quarter";
export type GoalStatus = "active" | "done" | "paused";
export type DecisionStatus = "open" | "decided" | "revisited";
export type RitualCadence = "daily" | "weekdays" | "weekly";
export type FocusMood = "calm" | "deep" | "scattered";
export type StudioKind = "projects" | "events" | "library" | "goals" | "decisions" | "rituals" | "focus";

export interface StudioProject {
  id: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  targetDate: string | null;
  leadId: string | null;
  leadName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioEvent {
  id: string;
  title: string;
  notes: string;
  kind: EventKind;
  startsOn: string;
  startsAt: string | null;
  location: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  url: string;
  kind: LibraryKind;
  note: string;
  status: LibraryStatus;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioGoal {
  id: string;
  title: string;
  detail: string;
  horizon: GoalHorizon;
  progress: number;
  status: GoalStatus;
  dueDate: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioDecision {
  id: string;
  title: string;
  context: string;
  outcome: string;
  status: DecisionStatus;
  projectName: string;
  decidedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioRitual {
  id: string;
  name: string;
  cadence: RitualCadence;
  note: string;
  streak: number;
  bestStreak: number;
  lastCompletedOn: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FocusSession {
  id: string;
  title: string;
  minutes: number;
  projectName: string;
  mood: FocusMood;
  note: string;
  completedAt: string;
  createdAt: string;
}

export interface StudioSnapshot {
  projects: StudioProject[];
  events: StudioEvent[];
  library: LibraryItem[];
  goals: StudioGoal[];
  decisions: StudioDecision[];
  rituals: StudioRitual[];
  focus: FocusSession[];
}

export const STUDIO_KINDS: StudioKind[] = ["projects", "events", "library", "goals", "decisions", "rituals", "focus"];
