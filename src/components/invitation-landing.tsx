"use client";

import { ArrowRight, Leaf, LogOut, Users } from "lucide-react";
import { useState } from "react";
import type { SessionUser } from "@/lib/types";
import { authHeaders, forgetSessionToken, rememberWorkspace, resumeSession } from "@/lib/client-auth";

export function InvitationLanding({ token, user }: { token: string; user: SessionUser }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accept = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ token }) });
      const result = (await response.json()) as { error?: string; workspaceId?: string };
      if (!response.ok) throw new Error(result.error || "Couldn’t accept this invitation.");
      if (typeof result.workspaceId === "string") rememberWorkspace(result.workspaceId);
      resumeSession();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t accept this invitation."); setBusy(false); }
  };
  const switchAccount = async () => {
    if (user.isGuest && !window.confirm("Your guest workspace is tied to this browser. Save it to an account first if you want to return to it. Sign out anyway?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "DELETE", headers: authHeaders() });
      if (!response.ok) throw new Error("Couldn’t sign out. Please try again.");
      forgetSessionToken();
      window.location.assign(`/?invite=${encodeURIComponent(token)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t sign out."); setBusy(false); }
  };
  return <main className="invite-landing"><section className="invite-landing__card"><div className="invite-landing__brand"><span><Leaf size={17} /></span> folio.</div><div className="invite-landing__icon"><Users size={24} /></div><p className="eyebrow">BETTER, TOGETHER</p><h1>There’s room for you here.</h1><p>You’ve been invited to a shared workspace. Accept with the email address that received the invitation.</p><div className="invite-landing__identity"><span>{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.isGuest ? "Guest workspace · this browser" : user.email}</small></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary invite-landing__accept" disabled={busy} onClick={accept}>{busy ? <><span className="button-spinner" /> One moment…</> : <>Accept invitation <ArrowRight size={16} /></>}</button><button className="invite-landing__switch" disabled={busy} onClick={switchAccount}><LogOut size={14} /> Sign in with another account</button><a href="/">Back to my workspace</a>{user.isGuest && <small className="invite-landing__guest-note">Save your guest workspace before signing out if you want to keep access.</small>}</section></main>;
}
