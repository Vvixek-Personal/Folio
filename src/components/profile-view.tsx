"use client";

import { Check, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { authHeaders } from "@/lib/client-auth";
import type { SessionUser } from "@/lib/types";

const COLORS = ["#d8d3ff", "#f2c6ae", "#d5e9d7", "#f6dfad", "#d6e7f3", "#e7d4c4", "#c9ddd4"];

export function ProfileView({ user, onUpdated }: { user: SessionUser | null; onUpdated: (user: SessionUser) => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [color, setColor] = useState(user?.avatarColor ?? COLORS[2]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!user) return <div className="profile-page"><div className="panel"><h1>Profile</h1><p>Sign in to view your profile.</p></div></div>;
  const method = user.signedInWith === "google" ? "Google" : user.isGuest ? "Guest session" : "Email & password";

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ name, avatarColor: color }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Couldn’t save your profile.");
      onUpdated(result.user);
      setMessage("Profile saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t save your profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-stack profile-page">
      <div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot" /> YOUR ACCOUNT</p><h1>Your profile</h1><p className="welcome-subtitle">The name and colour your team sees beside your work.</p></div></div>
      <section className="profile-hero panel">
        <div className="profile-hero__avatar" style={{ backgroundColor: color }}>{(name || user.name).slice(0, 1).toUpperCase()}</div>
        <div><h2>{name || user.name}</h2><p>{method}</p></div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-panel__intro"><span className="settings-icon"><UserRound size={19} /></span><div><h2>Edit details</h2><p>Changes show up across tasks, comments, and activity.</p></div></div>
        <div className="settings-form">
          <label className="form-field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} minLength={2} /></label>
          <div className="color-choices" role="radiogroup" aria-label="Avatar colour">
            {COLORS.map((swatch) => <button type="button" key={swatch} className={`color-choice ${color === swatch ? "color-choice--selected" : ""}`} style={{ background: swatch }} onClick={() => setColor(swatch)} aria-label={swatch} />)}
          </div>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
          <div className="settings-form__footer"><span><Mail size={15} /> {user.isGuest ? "Guest session · this browser" : user.email}</span><button className="button button--primary" type="button" onClick={save} disabled={busy}>{busy ? "Saving" : <><Check size={16} /> Save profile</>}</button></div>
        </div>
      </section>
      <section className="profile-details panel">
        <div className="section-title"><div><ShieldCheck size={16} /><h2>Sign-in</h2></div></div>
        <div className="profile-detail-row"><span><ShieldCheck size={16} /> Method</span><strong>{method}</strong></div>
        <div className="profile-detail-row"><span><Mail size={16} /> Email</span><strong>{user.isGuest ? "Not saved yet" : user.email}</strong></div>
      </section>
    </div>
  );
}
