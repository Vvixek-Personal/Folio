"use client";

import { Check, ChevronDown, Layers3, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { authHeaders, rememberWorkspace, resumeSession } from "@/lib/client-auth";

type Workspace = { id: string; name: string; role: string };

export function WorkspaceSwitcher({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true); setLoading(true); setError("");
    try {
      const response = await fetch("/api/workspaces", { headers: authHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t load your workspaces.");
      setItems(result.workspaces);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t load your workspaces."); }
    finally { setLoading(false); }
  };
  const switchTo = async (workspaceId: string) => {
    if (workspaceId === id) { setOpen(false); return; }
    setSwitching(workspaceId); setError("");
    try {
      const response = await fetch("/api/workspaces", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ workspaceId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t switch workspaces.");
      rememberWorkspace(workspaceId);
      resumeSession();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t switch workspaces."); setSwitching(null); }
  };

  return <div className="workspace-switcher-wrap"><button className="workspace-switcher" onClick={toggle} aria-expanded={open} aria-label="Switch workspace"><span className="workspace-monogram">{name.slice(0, 1).toUpperCase()}</span><span className="workspace-switcher__copy"><strong>{name}</strong><small><span className="workspace-status-dot" /> Your workspace</small></span><ChevronDown size={15} /></button>{open && <div className="workspace-menu"><div className="workspace-menu__heading"><Layers3 size={14} /> YOUR WORKSPACES</div>{loading ? <div className="workspace-menu__loading"><LoaderCircle size={15} className="workspace-menu__spinner" /> Finding your spaces…</div> : items.map((item) => <button key={item.id} onClick={() => switchTo(item.id)} disabled={Boolean(switching)}><span className="workspace-menu__avatar">{item.name.slice(0, 1).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.role}</small></span>{switching === item.id ? <LoaderCircle size={15} className="workspace-menu__spinner" /> : item.id === id && <Check size={15} />}</button>)}{error && <p className="workspace-menu__error">{error}</p>}<p className="workspace-menu__hint">Joined another team? Accept their invite to see it here.</p></div>}</div>;
}
