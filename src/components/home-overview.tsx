"use client";

import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, FileText, Leaf, Plus, Sparkles, Users } from "lucide-react";
import type { SessionUser, WorkspacePage, WorkspaceSnapshot, WorkspaceTask } from "@/lib/types";
import { ActivityRow, type ActivityItem, type ActivityTarget } from "@/components/activity-view";
import { useEffect, useState } from "react";
import { pagePlainText } from "@/lib/page-content";
import { PageIcon } from "@/components/page-icon";

type Props = {
  data: WorkspaceSnapshot;
  user: SessionUser | null;
  onCreateTask: () => void;
  onCreatePage: () => void;
  onOpenPage: (page: WorkspacePage) => void;
  onOpenTask: (task: WorkspaceTask) => void;
  onToggleTask: (task: WorkspaceTask) => void;
  onNavigate: (view: "pages" | "tasks" | "calendar" | "team") => void;
  onInvite: () => void;
  onActivityItem: (target: ActivityTarget, id: string | null) => void;
  onSeeAllActivity: () => void;
};

function relativeDate(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  return `Edited ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date)}`;
}

export function HomeOverview({ data, user, onCreateTask, onCreatePage, onOpenPage, onOpenTask, onToggleTask, onNavigate, onInvite, onActivityItem, onSeeAllActivity }: Props) {
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/activity?limit=4")
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (active && result) setActivity(result.items ?? []); })
      .catch(() => { if (active) setActivity([]); });
    return () => { active = false; };
  }, []);
  const openTasks = data.tasks.filter((task) => task.status !== "done");
  const completed = data.tasks.filter((task) => task.status === "done").length;
  const recentPages = [...data.pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const upcoming = [...openTasks].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")).slice(0, 4);
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: data.workspace.timezone }).format(new Date());
  const greeting = user && !user.isGuest ? `${user.name.split(" ")[0]}, this` : "This";

  return <div className="home-view">
    <section className="home-hero"><div className="home-hero__copy"><p className="home-hero__eyebrow"><span className="home-hero__eyebrow-dot" /> YOUR SPACE TO THINK & DO</p><h1>{greeting} is your space<br /><em>to make things happen.</em></h1><p className="home-hero__description">Bring your ideas, plans and people together in a calmer place to work.</p><div className="home-hero__actions"><button className="button button--primary home-primary" onClick={onCreatePage}><Plus size={17} /> Create a page</button><button className="button button--secondary home-secondary" onClick={onCreateTask}><CheckCheck size={16} /> Add a task</button></div></div><div className="home-hero__visual"><div className="home-hero__image" /><span className="home-hero__image-caption"><Leaf size={14} /> A LITTLE SPACE TO GROW</span><span className="home-hero__visual-number">01 / 03</span></div></section>

    <div className="home-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> A GOOD PLACE TO BEGIN</p><h2>Make yourself at home.</h2><p>Everything you need, right where you need it.</p></div><span className="home-heading__date"><CalendarDays size={15} /> {date}</span></div>
    <div className="home-quick-grid">
      <button className="home-quick-card" onClick={onCreatePage}><span className="home-quick-card__icon home-quick-card__icon--sage"><FileText size={21} /></span><span className="home-quick-card__arrow"><ArrowUpRight size={16} /></span><strong>Write it down</strong><small>Give your ideas a place to land.</small><span className="home-quick-card__link">New page <ArrowRight size={14} /></span></button>
      <button className="home-quick-card" onClick={onCreateTask}><span className="home-quick-card__icon home-quick-card__icon--clay"><CheckCheck size={21} /></span><span className="home-quick-card__arrow"><ArrowUpRight size={16} /></span><strong>Plan your work</strong><small>Make the next step feel easy.</small><span className="home-quick-card__link">New task <ArrowRight size={14} /></span></button>
      <button className="home-quick-card" onClick={onInvite}><span className="home-quick-card__icon home-quick-card__icon--sand"><Users size={21} /></span><span className="home-quick-card__arrow"><ArrowUpRight size={16} /></span><strong>Bring people in</strong><small>Good things are better together.</small><span className="home-quick-card__link">Invite team <ArrowRight size={14} /></span></button>
    </div>

    <section className="home-panel activity-strip"><div className="home-panel__heading"><div><span className="home-panel__icon"><Sparkles size={16} /></span><div><h3>What’s new</h3><p>The latest moves from everyone.</p></div></div><button className="home-panel__action" onClick={onSeeAllActivity}>See all <ArrowRight size={14} /></button></div>
      {activity === null ? <div className="activity-strip__rows">{[0, 1, 2].map((index) => <div className="activity-skeleton" key={index} style={{ animationDelay: `${index * 110}ms` }} />)}</div>
        : activity.length === 0 ? <p className="activity-strip__empty">The moment your team starts moving, it will appear here.</p>
        : <div className="activity-strip__rows">{activity.map((item) => <ActivityRow key={item.id} item={item} onOpenTarget={onActivityItem} />)}</div>}
    </section>

    <div className="home-work-grid"><section className="home-panel"><div className="home-panel__heading"><div><span className="home-panel__icon"><FileText size={16} /></span><div><h3>Recent pages</h3><p>Pick up where you left off.</p></div></div><button className="home-panel__action" onClick={() => onNavigate("pages")}>View all <ArrowRight size={14} /></button></div>
      {recentPages.length ? <div className="home-page-list">{recentPages.map((page) => <button className="home-page-row" key={page.id} onClick={() => onOpenPage(page)}><span className={`home-page-row__icon home-page-row__icon--${page.cover}`}><PageIcon value={page.icon} size={18} /></span><span className="home-page-row__text"><strong>{page.title}</strong><small>{pagePlainText(page.content).replace(/\s+/g, " ").slice(0, 65) || "A fresh page for your thoughts"}</small></span><span className="home-page-row__date">{relativeDate(page.updatedAt)}</span><ArrowRight size={15} /></button>)}</div> : <div className="home-empty"><div className="home-empty__illustration"><FileText size={22} /><span><Sparkles size={14} /></span></div><div><strong>A blank page is a lovely start.</strong><p>Capture a thought, a meeting note or a big idea.</p><button onClick={onCreatePage}><Plus size={14} /> Create your first page</button></div></div>}
    </section>
    <section className="home-panel home-panel--tasks"><div className="home-panel__heading"><div><span className="home-panel__icon home-panel__icon--clay"><CheckCheck size={16} /></span><div><h3>Your next steps</h3><p>One little thing at a time.</p></div></div><button className="home-panel__action" onClick={() => onNavigate("tasks")}>View all <ArrowRight size={14} /></button></div>
      {upcoming.length ? <div className="home-task-list">{upcoming.map((task) => <div className="home-task-row" key={task.id}><button className="home-task-row__check" onClick={() => onToggleTask(task)} aria-label={`Complete ${task.title}`}><Check size={13} /></button><button className="home-task-row__title" onClick={() => onOpenTask(task)}><strong>{task.title}</strong><small>{task.project}{task.dueDate ? ` · ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${task.dueDate}T12:00:00Z`))}` : ""}</small></button><ArrowRight size={14} /></div>)}</div> : <div className="home-empty home-empty--tasks"><div className="home-empty__illustration home-empty__illustration--clay"><CheckCheck size={22} /><span><Sparkles size={14} /></span></div><div><strong>A little room to focus.</strong><p>When you’re ready, add your first task here.</p><button onClick={onCreateTask}><Plus size={14} /> Add a task</button></div></div>}
    </section></div>
    <div className="home-bottom"><div><span className="home-bottom__spark">✳</span><span><strong>Little by little, it all comes together.</strong><small>A thoughtful pace is still progress.</small></span></div><div className="home-bottom__stats"><span><strong>{data.pages.length}</strong> {data.pages.length === 1 ? "page" : "pages"}</span><span><strong>{openTasks.length}</strong> open</span><span><strong>{completed}</strong> done</span></div></div>
  </div>;
}
