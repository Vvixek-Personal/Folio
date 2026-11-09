"use client";

import {
  Activity, Building2, CircleCheck, FilePlus2, ListPlus, MessageCircle, Pencil, RotateCcw, Trash2, UserMinus, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ActivityTarget = "page" | "task" | null;

export interface ActivityItem {
  id: string;
  type: string;
  targetType: ActivityTarget;
  targetId: string | null;
  summary: string | null;
  detail: string | null;
  createdAt: string;
  actor: { id: string; name: string; avatarColor: string };
}

const META: Record<string, { icon: LucideIcon; tone: string }> = {
  page_created: { icon: FilePlus2, tone: "act--sage" },
  page_updated: { icon: Pencil, tone: "act--sage" },
  page_deleted: { icon: Trash2, tone: "act--clay" },
  task_created: { icon: ListPlus, tone: "act--clay" },
  task_updated: { icon: Pencil, tone: "act--clay" },
  task_completed: { icon: CircleCheck, tone: "act--sage" },
  task_deleted: { icon: Trash2, tone: "act--clay" },
  comment_added: { icon: MessageCircle, tone: "act--sand" },
  member_joined: { icon: UserPlus, tone: "act--sky" },
  member_removed: { icon: UserMinus, tone: "act--clay" },
  workspace_renamed: { icon: Building2, tone: "act--sky" },
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function MiniAvatar({ name, color }: { name: string; color: string }) {
  return <span className="activity-row__avatar" style={{ backgroundColor: color }} title={name} aria-label={name}>{initials(name) || "?"}</span>;
}

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
}

function dayGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function phrase(item: ActivityItem) {
  const s = item.summary ? ` “${item.summary}”` : "";
  switch (item.type) {
    case "page_created": return <> created page{s}</>;
    case "page_updated": return <> edited page{s}</>;
    case "page_deleted": return <> deleted page{s}</>;
    case "task_created": return <> added task{s}</>;
    case "task_updated": return <> updated task{s}</>;
    case "task_completed": return <> completed{s}</>;
    case "task_deleted": return <> deleted task{s}</>;
    case "comment_added": return <> commented on{s}</>;
    case "member_joined": return <> joined the workspace</>;
    case "member_removed": return <> removed {item.summary ?? "a member"} from the workspace</>;
    case "workspace_renamed": return <> renamed the workspace to{s}</>;
    default: return <> made an update</>;
  }
}

export function ActivityRow({ item, onOpenTarget }: { item: ActivityItem; onOpenTarget: (target: ActivityTarget, id: string | null) => void }) {
  const meta = META[item.type] ?? { icon: Activity, tone: "act--sage" };
  const Icon = meta.icon;
  const clickable = Boolean(item.targetType && item.targetId);
  const inner = (
    <>
      <MiniAvatar name={item.actor.name} color={item.actor.avatarColor} />
      <span className="activity-row__text"><strong>{item.actor.name}</strong>{phrase(item)}{item.detail && <em> · {item.detail}</em>}<time>{timeAgo(item.createdAt)}</time></span>
      <span className={`activity-row__icon ${meta.tone}`}><Icon size={15} strokeWidth={1.8} /></span>
    </>
  );
  if (!clickable) return <div className="activity-row">{inner}</div>;
  return (
    <button className="activity-row" onClick={() => onOpenTarget(item.targetType, item.targetId)} title="Open item">
      {inner}
    </button>
  );
}

export function ActivityView({ onOpenTarget, onOpened }: { onOpenTarget: (target: ActivityTarget, id: string | null) => void; onOpened: () => void }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onOpened();
    let active = true;
    fetch("/api/activity?limit=60")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Couldn’t load activity."))))
      .then((data) => { if (active) { setItems(data.items ?? []); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of items ?? []) {
      const label = dayGroup(item.createdAt);
      const list = map.get(label);
      if (list) list.push(item);
      else map.set(label, [item]);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="view-stack activity-view">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> HOW THINGS ARE MOVING</p>
          <h1>Activity</h1>
          <p className="welcome-subtitle">A gentle timeline of everything happening in this workspace.</p>
        </div>
      </div>

      {failed ? (
        <section className="panel activity-panel">
          <div className="empty-state">
            <span className="empty-state__icon"><Activity size={21} strokeWidth={1.65} /></span>
            <h3>Couldn’t load activity</h3>
            <p>Something went wrong while fetching the timeline.</p>
            <button className="button button--secondary" onClick={() => setAttempt((value) => value + 1)}><RotateCcw size={15} /> Try again</button>
          </div>
        </section>
      ) : items === null ? (
        <section className="panel activity-panel">
          {[0, 1, 2, 3, 4].map((index) => <div className="activity-skeleton" key={index} style={{ animationDelay: `${index * 90}ms` }} />)}
        </section>
      ) : items.length === 0 ? (
        <section className="panel activity-panel">
          <div className="empty-state">
            <span className="empty-state__icon"><Activity size={21} strokeWidth={1.65} /></span>
            <h3>Quiet for now</h3>
            <p>As your team writes, plans, and celebrates, every move will appear here.</p>
          </div>
        </section>
      ) : (
        groups.map(([label, list]) => (
          <section className="activity-day" key={label}>
            <h2>{label}</h2>
            <div className="activity-list">
              {list.map((item) => <ActivityRow key={item.id} item={item} onOpenTarget={onOpenTarget} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
