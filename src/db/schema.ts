import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    googleId: text("google_id"),
    isGuest: boolean("is_guest").notNull().default(false),
    avatarColor: text("avatar_color").notNull().default("#d8d8ff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email), uniqueIndex("users_google_id_idx").on(table.googleId)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("INR"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workspaces_owner_idx").on(table.ownerId)],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    activityReadAt: timestamp("activity_read_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    summary: text("summary"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activity_workspace_idx").on(table.workspaceId, table.createdAt)],
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    role: text("role").notNull().default("member"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_invitations_token_idx").on(table.tokenHash),
    index("workspace_invitations_workspace_idx").on(table.workspaceId),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    icon: text("icon").notNull().default("📄"),
    cover: text("cover").notNull().default("sage"),
    content: text("content").notNull().default(""),
    isFavorite: text("is_favorite").notNull().default("false"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pages_workspace_idx").on(table.workspaceId),
    index("pages_updated_idx").on(table.updatedAt),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("medium"),
    project: text("project").notNull().default("Workspace"),
    dueDate: date("due_date"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_workspace_idx").on(table.workspaceId),
    index("tasks_assignee_idx").on(table.assigneeId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("comments_task_idx").on(table.taskId)],
);


export const driveConnections = pgTable("drive_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  googleAccountId: text("google_account_id").notNull(),
  email: text("email").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("drive_connections_user_idx").on(table.userId)]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#64987c"),
    status: text("status").notNull().default("active"),
    targetDate: date("target_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("projects_workspace_idx").on(table.workspaceId)],
);

export const studioEvents = pgTable(
  "studio_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    kind: text("kind").notNull().default("meeting"),
    startsOn: date("starts_on").notNull(),
    startsAt: text("starts_at"),
    location: text("location").notNull().default(""),
    projectName: text("project_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("studio_events_workspace_idx").on(table.workspaceId, table.startsOn)],
);

export const libraryItems = pgTable(
  "library_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull().default(""),
    kind: text("kind").notNull().default("article"),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("queued"),
    tags: text("tags").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("library_items_workspace_idx").on(table.workspaceId)],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    horizon: text("horizon").notNull().default("month"),
    progress: integer("progress").notNull().default(0),
    status: text("status").notNull().default("active"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("goals_workspace_idx").on(table.workspaceId)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    context: text("context").notNull().default(""),
    outcome: text("outcome").notNull().default(""),
    status: text("status").notNull().default("open"),
    projectName: text("project_name").notNull().default(""),
    decidedOn: date("decided_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("decisions_workspace_idx").on(table.workspaceId)],
);

export const rituals = pgTable(
  "rituals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    cadence: text("cadence").notNull().default("daily"),
    note: text("note").notNull().default(""),
    streak: integer("streak").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    lastCompletedOn: date("last_completed_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rituals_workspace_idx").on(table.workspaceId)],
);

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    minutes: integer("minutes").notNull().default(25),
    projectName: text("project_name").notNull().default(""),
    mood: text("mood").notNull().default("calm"),
    note: text("note").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("focus_sessions_workspace_idx").on(table.workspaceId)],
);
