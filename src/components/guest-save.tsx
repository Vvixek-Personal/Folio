"use client";

import { ArrowRight, Leaf, LockKeyhole, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { authHeaders, resumeSession } from "@/lib/client-auth";

export function GuestSaveDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/guest", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ name, email, password }) });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Couldn’t save your workspace. Please try again.");
      resumeSession();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t save your workspace."); setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog guest-save-dialog" role="dialog" aria-modal="true" aria-label="Save your guest workspace"><div className="guest-save-top"><span><Leaf size={18} /></span><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><p className="eyebrow">KEEP YOUR LITTLE CORNER</p><h2>Make this space yours.</h2><p className="guest-save-description">Create an account to return from any device. Your pages, tasks and team stay right where they are.</p><form className="guest-save-form" onSubmit={submit}><label className="form-field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" minLength={2} maxLength={60} required /></label><label className="form-field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={160} required /></label><label className="form-field"><span>Create a password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} maxLength={128} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--primary guest-save-submit" disabled={busy}>{busy ? <><span className="button-spinner" /> Saving workspace…</> : <>Save my workspace <ArrowRight size={16} /></>}</button></form><p className="guest-save-footnote"><LockKeyhole size={14} /> Your workspace stays private to you and your team.</p></section></div>;
}
