"use client";

import { Mail, ShieldCheck, UserRound } from "lucide-react";
import type { SessionUser } from "@/lib/types";

export function ProfileView({ user }: { user: SessionUser | null }) {
  if (!user) return <div className="profile-page"><div className="profile-card"><h1>Profile</h1><p>Sign in with Google to view your profile.</p></div></div>;
  return (
    <div className="view-stack profile-page">
      <div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot" /> YOUR ACCOUNT</p><h1>Your profile</h1><p className="welcome-subtitle">Your personal details inside Folio.</p></div></div>
      <section className="profile-hero panel">
        <div className="profile-hero__avatar" style={{ backgroundColor: user.avatarColor }}>{user.name.slice(0,1).toUpperCase()}</div>
        <div><h2>{user.name}</h2><p>{user.isGuest ? "Guest workspace" : "Google account"}</p></div>
      </section>
      <section className="profile-details panel">
        <div className="section-title"><div><UserRound size={16} /><h2>Account details</h2></div></div>
        <div className="profile-detail-row"><span><UserRound size={16} /> Name</span><strong>{user.name}</strong></div>
        <div className="profile-detail-row"><span><Mail size={16} /> Email</span><strong>{user.email}</strong></div>
        <div className="profile-detail-row"><span><ShieldCheck size={16} /> Sign-in method</span><strong>{user.isGuest ? "Guest session" : "Google OAuth"}</strong></div>
      </section>
    </div>
  );
}
