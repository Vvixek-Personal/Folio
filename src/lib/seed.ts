import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activity,
  comments,
  decisions,
  focusSessions,
  goals,
  libraryItems,
  pages,
  projects,
  rituals,
  studioEvents,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";

export const DEMO_EMAIL = "mara@folio.studio";
export const DEMO_PASSWORD = "folio-studio";

const TEAM = [
  { email: DEMO_EMAIL, name: "Mara Ellison", color: "#d5e9d7", role: "owner" },
  { email: "jules@folio.studio", name: "Jules Okonkwo", color: "#d8d3ff", role: "admin" },
  { email: "priya@folio.studio", name: "Priya Raman", color: "#f2c6ae", role: "member" },
  { email: "theo@folio.studio", name: "Theo Lang", color: "#d6e7f3", role: "member" },
] as const;

function dayOffset(offset: number, timezone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const date = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function doc(blocks: Array<{ h?: string; p?: string }>) {
  return JSON.stringify({
    type: "doc",
    content: blocks.map((block) =>
      block.h
        ? { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: block.h }] }
        : { type: "paragraph", content: block.p ? [{ type: "text", text: block.p }] : [] },
    ),
  });
}

async function countOf(table: typeof pages | typeof projects, workspaceId: string) {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(eq(table.workspaceId, workspaceId));
  return Number(row?.count ?? 0);
}

let demoPromise: Promise<void> | null = null;

export function ensureDemoStudio() {
  if (!demoPromise) {
    demoPromise = seedDemoStudio().finally(() => {
      demoPromise = null;
    });
  }
  return demoPromise;
}

async function ensureTeam() {
  const ids: Record<string, string> = {};
  for (const person of TEAM) {
    const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, person.email)).limit(1);
    if (found) {
      ids[person.email] = found.id;
      continue;
    }
    try {
      const [created] = await db.insert(users).values({
        name: person.name,
        email: person.email,
        passwordHash: hashPassword(DEMO_PASSWORD),
        avatarColor: person.color,
      }).returning({ id: users.id });
      ids[person.email] = created.id;
    } catch {
      const [again] = await db.select({ id: users.id }).from(users).where(eq(users.email, person.email)).limit(1);
      if (!again) throw new Error(`Could not prepare ${person.email}`);
      ids[person.email] = again.id;
    }
  }
  return ids;
}

async function seedDemoStudio() {
  const ids = await ensureTeam();
  const maraId = ids[DEMO_EMAIL];
  const memberships = await db
    .select({ id: workspaces.id, name: workspaces.name, timezone: workspaces.timezone })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, maraId));
  let workspace = memberships.find((item) => item.name === "Lumen & Co.") ?? memberships[0];
  if (!workspace) {
    const [created] = await db.insert(workspaces).values({
      name: "Lumen & Co.",
      ownerId: maraId,
      currency: "INR",
      timezone: "Asia/Kolkata",
    }).returning({ id: workspaces.id, name: workspaces.name, timezone: workspaces.timezone });
    workspace = created;
  }
  for (const person of TEAM) {
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: ids[person.email],
      role: person.role,
      activityReadAt: person.email === DEMO_EMAIL ? hoursAgo(20) : hoursAgo(2),
    }).onConflictDoNothing();
  }

  if ((await countOf(pages, workspace.id)) === 0) {
    await seedLumenPagesAndTasks(workspace.id, ids);
  }
  if ((await countOf(projects, workspace.id)) === 0) {
    await seedLumenStudio(workspace.id, ids);
  }
}

async function seedLumenPagesAndTasks(workspaceId: string, ids: Record<string, string>) {
  const mara = ids[DEMO_EMAIL];
  const jules = ids["jules@folio.studio"];
  const priya = ids["priya@folio.studio"];
  const theo = ids["theo@folio.studio"];
  const today = dayOffset(0);
  await db.insert(pages).values([
    {
      workspaceId, createdBy: mara, title: "Harbor brief", icon: "sprout", cover: "sage", isFavorite: "true",
      content: doc([
        { h: "The feeling" },
        { p: "Harbor should feel like a well-kept reading room, not a bank lobby. Quiet type, generous margins, and one clear next step on every screen." },
        { h: "Who it is for" },
        { p: "People opening their first savings account in Bengaluru, often on a phone, often between other things. They want reassurance more than dashboards." },
        { h: "What success looks like" },
        { p: "A first-time saver can name their jar, set a gentle weekly amount, and understand the fee in one sitting. No jargon, no dark patterns." },
      ]),
    },
    {
      workspaceId, createdBy: priya, title: "Café interview notes", icon: "coffee", cover: "clay", isFavorite: "true",
      content: doc([
        { h: "What people actually said" },
        { p: "Three conversations at Third Wave and a corner bakery. Nobody asked for more charts. They asked whether the money was 'really there' and whether they could pause without a penalty lecture." },
        { h: "Phrases to keep" },
        { p: "A little, regularly. Not a goal, a habit. Show me the quiet version. I do not want a streak that shames me." },
        { h: "Open questions" },
        { p: "Can we show a pause as care, not failure? Priya is writing the language pass before Friday's critique." },
      ]),
    },
    {
      workspaceId, createdBy: mara, title: "How Lumen works", icon: "leaf", cover: "olive", isFavorite: "false",
      content: doc([
        { h: "A small studio, on purpose" },
        { p: "Four people. One shared Folio. We write before we meet, and we meet before we make more things." },
        { h: "The week" },
        { p: "Monday is for decisions. Wednesday is for making. Friday is a short retro and a walk if the weather allows." },
      ]),
    },
    {
      workspaceId, createdBy: jules, title: "Reading Room sitemap", icon: "book", cover: "sand", isFavorite: "false",
      content: doc([
        { h: "Pages" },
        { p: "Home, this week's shelf, events, a quiet membership page, and a note about the neighbourhood photos." },
        { h: "Tone" },
        { p: "Warm, specific, never cute. Name the street. Name the librarian. Leave room for the photographs." },
      ]),
    },
    {
      workspaceId, createdBy: mara, title: "March studio letter", icon: "notebook", cover: "sky", isFavorite: "true",
      content: doc([
        { h: "Draft" },
        { p: "We spent the month learning how people talk about saving when nobody is selling them anything. The short version: they want a place that does not raise its voice." },
        { p: "Harbor's discovery sprint closes next week. Reading Room photos are still waiting on written consent. Both are moving, neither is rushed." },
      ]),
    },
  ]);

  const inserted = await db.insert(tasks).values([
    { workspaceId, createdBy: mara, assigneeId: jules, title: "Sketch the Harbor empty state", description: "A savings jar with nothing in it yet should still feel welcoming. Try a single line of type and a soft clay circle.", status: "doing", priority: "high", project: "Harbor", dueDate: dayOffset(1), position: 1 },
    { workspaceId, createdBy: priya, assigneeId: priya, title: "Write up the three café interviews", description: "Keep the phrases people actually used. Flag anything that sounds like a bank.", status: "doing", priority: "medium", project: "Harbor", dueDate: today, position: 2 },
    { workspaceId, createdBy: mara, assigneeId: theo, title: "Check contrast on the clay palette", description: "Body text on sand and clay must clear WCAG AA. Note the pairs that fail.", status: "todo", priority: "medium", project: "Harbor", dueDate: dayOffset(2), position: 3 },
    { workspaceId, createdBy: jules, assigneeId: mara, title: "Draft the Reading Room homepage", description: "One photograph, one sentence about this week's shelf, one way to visit.", status: "todo", priority: "medium", project: "Reading Room", dueDate: dayOffset(5), position: 4 },
    { workspaceId, createdBy: jules, assigneeId: jules, title: "Collect consented neighbourhood photos", description: "Written yes from the bakery and the librarian before anything is published.", status: "doing", priority: "low", project: "Reading Room", dueDate: dayOffset(4), position: 5 },
    { workspaceId, createdBy: theo, assigneeId: theo, title: "Point staging at reading-room.lumen.test", description: "Staging is up. Add the note in the studio letter.", status: "done", priority: "medium", project: "Reading Room", dueDate: dayOffset(-2), position: 6 },
    { workspaceId, createdBy: mara, assigneeId: mara, title: "Send the Harbor discovery invoice", description: "Fixed fee, as agreed. Attach the interview summary, not a timesheet.", status: "doing", priority: "high", project: "Studio", dueDate: dayOffset(1), position: 7 },
    { workspaceId, createdBy: mara, assigneeId: mara, title: "Finish the March studio letter", description: "Two short paragraphs. No announcements that are not true yet.", status: "todo", priority: "low", project: "Studio", dueDate: dayOffset(6), position: 8 },
    { workspaceId, createdBy: priya, assigneeId: priya, title: "Close the type pairing note", description: "Newsreader for headlines, Inter for interface. Decided, just needs the page updated.", status: "done", priority: "medium", project: "Harbor", dueDate: dayOffset(-1), position: 9 },
    { workspaceId, createdBy: theo, assigneeId: jules, title: "Prototype the savings jar interaction", description: "A slow fill, not a bounce. 600ms is plenty.", status: "todo", priority: "high", project: "Harbor", dueDate: dayOffset(3), position: 10 },
  ]).returning({ id: tasks.id, title: tasks.title });

  const interview = inserted.find((task) => task.title.includes("café"));
  const sketch = inserted.find((task) => task.title.includes("empty state"));
  if (interview) {
    await db.insert(comments).values([
      { taskId: interview.id, userId: priya, body: "The bakery conversation is the one to quote. She said 'a little, regularly' twice.", createdAt: hoursAgo(5) },
      { taskId: interview.id, userId: mara, body: "Keep that line. It might be the homepage, not just a research note.", createdAt: hoursAgo(3) },
    ]);
  }
  if (sketch) {
    await db.insert(comments).values([
      { taskId: sketch.id, userId: jules, body: "First pass is a clay circle and the line 'Nothing here yet, and that is alright.'", createdAt: hoursAgo(8) },
      { taskId: sketch.id, userId: theo, body: "I can animate the fill once the circle is locked. No bounce, promise.", createdAt: hoursAgo(1) },
    ]);
  }

  await db.insert(activity).values([
    { workspaceId, actorId: priya, type: "page_updated", targetType: "page", summary: "Café interview notes", createdAt: hoursAgo(5) },
    { workspaceId, actorId: jules, type: "task_updated", targetType: "task", targetId: sketch?.id, summary: "Sketch the Harbor empty state", createdAt: hoursAgo(8) },
    { workspaceId, actorId: theo, type: "comment_added", targetType: "task", targetId: sketch?.id, summary: "Sketch the Harbor empty state", detail: "No bounce, promise.", createdAt: hoursAgo(1) },
    { workspaceId, actorId: mara, type: "task_created", targetType: "task", summary: "Send the Harbor discovery invoice", createdAt: hoursAgo(26) },
    { workspaceId, actorId: theo, type: "task_completed", targetType: "task", summary: "Point staging at reading-room.lumen.test", createdAt: hoursAgo(30) },
    { workspaceId, actorId: jules, type: "member_joined", summary: "Jules Okonkwo", createdAt: hoursAgo(80) },
  ]);
}

async function seedLumenStudio(workspaceId: string, ids: Record<string, string>) {
  const mara = ids[DEMO_EMAIL];
  const jules = ids["jules@folio.studio"];
  const priya = ids["priya@folio.studio"];
  const theo = ids["theo@folio.studio"];
  await db.insert(projects).values([
    { workspaceId, createdBy: mara, leadId: mara, name: "Harbor", description: "A calmer savings companion for first-time savers. Discovery sprint, then a careful prototype.", color: "#8474cf", status: "active", targetDate: dayOffset(18) },
    { workspaceId, createdBy: jules, leadId: jules, name: "Reading Room", description: "A neighbourhood library site with consented photographs and a weekly shelf.", color: "#de9b6a", status: "active", targetDate: dayOffset(28) },
    { workspaceId, createdBy: mara, leadId: priya, name: "Studio", description: "How Lumen writes, invoices, and keeps a humane pace.", color: "#64987c", status: "planning", targetDate: dayOffset(12) },
  ]);
  await db.insert(studioEvents).values([
    { workspaceId, createdBy: mara, title: "Harbor critique", notes: "Look at the empty state, the interview phrases, and the fee screen. No new ideas after 40 minutes.", kind: "meeting", startsOn: dayOffset(0), startsAt: "16:30", location: "Studio table", projectName: "Harbor" },
    { workspaceId, createdBy: mara, title: "Discovery invoice due", notes: "Send the fixed-fee invoice with the interview summary attached.", kind: "deadline", startsOn: dayOffset(1), startsAt: "11:00", location: "Folio", projectName: "Studio" },
    { workspaceId, createdBy: jules, title: "Client walkthrough", notes: "Show the jar interaction and the language pass. Ask what felt loud.", kind: "meeting", startsOn: dayOffset(2), startsAt: "11:00", location: "Video", projectName: "Harbor" },
    { workspaceId, createdBy: jules, title: "Neighbourhood photo walk", notes: "Only places that have already said yes.", kind: "ritual", startsOn: dayOffset(4), startsAt: "08:00", location: "Infantry Road", projectName: "Reading Room" },
    { workspaceId, createdBy: priya, title: "Friday retro", notes: "What should we stop, keep, and write down?", kind: "ritual", startsOn: dayOffset(4), startsAt: "17:00", location: "Studio table", projectName: "Studio" },
  ]);
  await db.insert(libraryItems).values([
    { workspaceId, createdBy: priya, title: "The shape of a calm interface", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", kind: "article", note: "A reminder that quiet is a usability choice, not an absence of design.", status: "reading", tags: "research, tone" },
    { workspaceId, createdBy: mara, title: "The Design of Everyday Things", url: "https://en.wikipedia.org/wiki/The_Design_of_Everyday_Things", kind: "book", note: "Re-reading the chapter on constraints before the jar prototype.", status: "reading", tags: "craft" },
    { workspaceId, createdBy: jules, title: "Jiro Dreams of Sushi", url: "https://en.wikipedia.org/wiki/Jiro_Dreams_of_Sushi", kind: "film", note: "For the studio letter. Pace, repetition, care.", status: "queued", tags: "pace" },
    { workspaceId, createdBy: theo, title: "Are.na — clay studies", url: "https://www.are.na", kind: "tool", note: "Jules's board of paper, clay, and late afternoon light.", status: "done", tags: "visual" },
    { workspaceId, createdBy: mara, title: "Fee language, not a timesheet", url: "", kind: "note", note: "We invoice the outcome of the sprint, never the hours. Attach the interview summary.", status: "done", tags: "studio, money" },
  ]);
  await db.insert(goals).values([
    { workspaceId, createdBy: mara, ownerId: mara, title: "Close Harbor discovery without adding scope", detail: "Interviews, language, empty state, and a fee screen. Nothing else.", horizon: "month", progress: 62, status: "active", dueDate: dayOffset(18) },
    { workspaceId, createdBy: priya, ownerId: priya, title: "Publish two honest studio letters", detail: "March is drafted. April waits until something is actually true.", horizon: "quarter", progress: 40, status: "active", dueDate: dayOffset(40) },
    { workspaceId, createdBy: jules, ownerId: jules, title: "Keep a five-day making streak", detail: "Sketch, write, or photograph. A short session still counts.", horizon: "week", progress: 80, status: "active", dueDate: dayOffset(3) },
  ]);
  await db.insert(decisions).values([
    { workspaceId, createdBy: priya, title: "Harbor uses Newsreader and Inter", context: "We tried three pairings. The serif needs to feel literary, not ceremonial.", outcome: "Newsreader for headlines, Inter for the interface and numbers.", status: "decided", projectName: "Harbor", decidedOn: dayOffset(-1) },
    { workspaceId, createdBy: jules, title: "Only consented photographs", context: "The library site will live next to real neighbours. Stock photos would be a lie.", outcome: "Nothing is published without a written yes, including the bakery window.", status: "decided", projectName: "Reading Room", decidedOn: dayOffset(-6) },
    { workspaceId, createdBy: mara, title: "How we price the next Harbor phase", context: "The client asked for an hourly estimate. We would rather name the work.", outcome: "", status: "open", projectName: "Studio", decidedOn: null },
  ]);
  await db.insert(rituals).values([
    { workspaceId, createdBy: mara, ownerId: mara, name: "Morning pages", cadence: "daily", note: "Three pages, before Folio. No editing.", streak: 6, bestStreak: 11, lastCompletedOn: dayOffset(-1) },
    { workspaceId, createdBy: jules, ownerId: jules, name: "Studio walk", cadence: "weekdays", note: "Ten minutes, no podcast, notice one colour.", streak: 4, bestStreak: 9, lastCompletedOn: dayOffset(-1) },
    { workspaceId, createdBy: priya, ownerId: priya, name: "Friday retro", cadence: "weekly", note: "Write three lines before the meeting so the meeting can be short.", streak: 4, bestStreak: 4, lastCompletedOn: dayOffset(-3) },
  ]);
  await db.insert(focusSessions).values([
    { workspaceId, createdBy: jules, title: "Harbor empty states", minutes: 50, projectName: "Harbor", mood: "deep", note: "Locked the clay circle. Type still too loud.", completedAt: hoursAgo(6) },
    { workspaceId, createdBy: mara, title: "Invoice draft", minutes: 25, projectName: "Studio", mood: "calm", note: "Removed the timesheet paragraph.", completedAt: hoursAgo(20) },
    { workspaceId, createdBy: priya, title: "Interview synthesis", minutes: 40, projectName: "Harbor", mood: "scattered", note: "Started scattered, ended with three phrases worth keeping.", completedAt: hoursAgo(28) },
  ]);
}

export async function seedStarterWorkspace(workspaceId: string, userId: string, displayName: string) {
  if ((await countOf(pages, workspaceId)) > 0) return;
  const first = displayName.trim().split(/\s+/)[0] || "You";
  await db.insert(pages).values([
    {
      workspaceId, createdBy: userId, title: "A place to begin", icon: "leaf", cover: "sage", isFavorite: "true",
      content: doc([
        { h: `Welcome, ${first}` },
        { p: "Folio is a quiet home for notes, tasks, projects, and the small rituals that keep work humane." },
        { h: "Try this first" },
        { p: "Rename a task, favourite this page, and add one thing you are actually making. The studio tools on the left — library, goals, decisions, rituals, and focus — are yours to edit or clear." },
      ]),
    },
    {
      workspaceId, createdBy: userId, title: "Working agreement", icon: "notebook", cover: "sand", isFavorite: "false",
      content: doc([
        { h: "How this space should feel" },
        { p: "Write the decision down. Invite people when the work is shared. Leave room for a slower day." },
      ]),
    },
  ]);
  await db.insert(tasks).values([
    { workspaceId, createdBy: userId, assigneeId: userId, title: "Name the thing you are making", description: "A project is just a shared focus. Give it a name you would say out loud.", status: "doing", priority: "medium", project: "First project", dueDate: dayOffset(1), position: 1 },
    { workspaceId, createdBy: userId, assigneeId: userId, title: "Invite one person, if the work is shared", description: "Team invitations create a private link. They can sign up with email.", status: "todo", priority: "low", project: "First project", dueDate: dayOffset(4), position: 2 },
    { workspaceId, createdBy: userId, assigneeId: userId, title: "Write a page you will actually reopen", description: "Meeting notes, a brief, or a letter to yourself. Favourite it so it stays in the sidebar.", status: "todo", priority: "medium", project: "Notes", dueDate: dayOffset(2), position: 3 },
  ]);
  await db.insert(projects).values([
    { workspaceId, createdBy: userId, leadId: userId, name: "First project", description: "A starter focus. Rename it, or replace it with the real work.", color: "#64987c", status: "active", targetDate: dayOffset(14) },
  ]);
  await db.insert(studioEvents).values([
    { workspaceId, createdBy: userId, title: "A quiet hour for planning", notes: "No agenda longer than one page.", kind: "focus", startsOn: dayOffset(1), startsAt: "09:30", location: "Wherever you work", projectName: "First project" },
  ]);
  await db.insert(libraryItems).values([
    { workspaceId, createdBy: userId, title: "Something worth rereading", url: "https://en.wikipedia.org/wiki/Slow_movement_(culture)", kind: "article", note: "Replace this with a link you actually want to return to.", status: "queued", tags: "starter" },
  ]);
  await db.insert(goals).values([
    { workspaceId, createdBy: userId, ownerId: userId, title: "Make one useful thing this week", detail: "Small is allowed. Done is better than impressive.", horizon: "week", progress: 20, status: "active", dueDate: dayOffset(5) },
  ]);
  await db.insert(decisions).values([
    { workspaceId, createdBy: userId, title: "What this workspace is for", context: "A workspace gets noisy when it tries to hold everything.", outcome: "Start with the work in front of you. Archive the rest.", status: "open", projectName: "First project" },
  ]);
  await db.insert(rituals).values([
    { workspaceId, createdBy: userId, ownerId: userId, name: "A short daily check-in", cadence: "weekdays", note: "Open Folio, mark one thing done or one thing next.", streak: 0, bestStreak: 0 },
  ]);
  await db.insert(activity).values([
    { workspaceId, actorId: userId, type: "page_created", summary: "A place to begin", createdAt: hoursAgo(1) },
    { workspaceId, actorId: userId, type: "project_created", summary: "First project", createdAt: hoursAgo(1) },
  ]);
}
