"use client";

import { ArrowRight, CheckCheck, FileText, Leaf, LockKeyhole, Sparkles, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { rememberSessionToken, resumeSession } from "@/lib/client-auth";

type WelcomeProps = { inviteToken: string | null };

export function Welcome({ inviteToken }: WelcomeProps) {
  const [mode, setMode] = useState<"login" | "signup">(inviteToken ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"auth" | "guest" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("authError");
    const messages: Record<string, string> = {
      google_not_configured: "Google sign-in is not configured yet. Please use email signup for now.",
      google_cancelled: "Google sign-in was cancelled.",
      google_state_invalid: "Your sign-in session expired. Please try again.",
      google_missing_code: "Google did not complete sign-in. Please try again.",
      google_signin_failed: "Google sign-in failed. Please try again.",
      invitation_invalid: "This invitation has expired or belongs to a different email address.",
    };
    if (code) setError(messages[code] || "Sign-in failed. Please try again.");
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("auth"); setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, name, email, password, inviteToken }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
      if (typeof result.token === "string") rememberSessionToken(result.token);
      resumeSession();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  };

  const continueAsGuest = async () => {
    setBusy("guest"); setError("");
    try {
      const response = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; token?: string };
      if (response.status === 409) { resumeSession(); return; }
      if (!response.ok) throw new Error(result.error || "Couldn’t open a guest workspace. Try again.");
      if (typeof result.token === "string") rememberSessionToken(result.token);
      resumeSession();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t open a guest workspace. Try again.");
      setBusy(null);
    }
  };

  return (
    <main className="welcome earth-welcome">
      <section className="welcome__panel earth-welcome__panel">
        <aside className="welcome-story">
          <div className="welcome-story__top"><div className="welcome-logo"><span className="welcome-logo__mark"><Leaf size={19} /></span><span>folio<span>.</span></span></div><span className="welcome-story__index">A LITTLE SPACE TO THINK</span></div>
          <div className="welcome-story__content">
            <span className="welcome-story__label"><span /> A MORE THOUGHTFUL WORKSPACE</span>
            <h1>Make space for<br /><em>good work.</em></h1>
            <p>A little less noise. A lot more room for the ideas, plans and people that matter.</p>
          </div>
          <div className="welcome-story__bottom"><span><FileText size={15} /> Notes & docs</span><span><CheckCheck size={15} /> Projects</span><span><Users size={15} /> Together</span></div>
        </aside>
        <div className="welcome__side earth-welcome__side">
          <div className="welcome-form-heading"><span className="welcome-form-heading__icon"><Sparkles size={18} /></span><span className="welcome-form-heading__eyebrow">YOUR SPACE, YOUR PACE</span><h2>A calmer place to begin.</h2><p>Bring your thoughts, tasks and team together. Start fresh, just as you are.</p></div>
          {inviteToken && <p className="welcome__invite"><Sparkles size={14} /> You’ve been invited to a team. Sign up or sign in with the invited email to join.</p>}
          <a className="button button--google welcome__google" href={`/api/auth/google${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ""}`} aria-label="Continue with Google">
            <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.15 13.22l7.98 6.19C13.02 13.72 18.11 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.73 7.18l7.64 5.92c4.46-4.13 7.16-10.2 7.16-17.57Z"/><path fill="#FBBC05" d="M11.13 28.59A14.4 14.4 0 0 1 10.35 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.58 10.78l8.55-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.88l-7.64-5.92c-2.12 1.42-4.83 2.27-8.27 2.27-5.89 0-10.98-4.22-12.87-9.91l-8.55 6.19C6.51 43.62 14.62 48 24 48Z"/></svg>
            Continue with Google
          </a>
          {!inviteToken && <div className="guest-entry"><button type="button" className="guest-entry__button" onClick={continueAsGuest} disabled={Boolean(busy)}>{busy === "guest" ? <><span className="button-spinner" /> Opening your space…</> : <><span className="guest-entry__icon"><Leaf size={17} /></span><span>Continue as guest<small>No signup needed</small></span><ArrowRight size={18} /></>}</button><p>Private to this browser for 30 days. Save it to an account anytime.</p></div>}
          <div className="welcome-divider"><span />{inviteToken ? "ACCEPT YOUR INVITATION" : "OR CONTINUE WITH EMAIL"}<span /></div>
          <form className="welcome__card" onSubmit={submit}>
            <div className="welcome__tabs" role="tablist" aria-label="Choose account action"><button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "is-selected" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create account</button></div>
            <div className="welcome__fields">
              {mode === "signup" && <label className="form-field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" maxLength={60} required /></label>}
              <label className="form-field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={160} required /></label>
              <label className="form-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} maxLength={128} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--secondary welcome__submit" disabled={Boolean(busy)}>{busy === "auth" ? <><span className="button-spinner button-spinner--dark" /> One moment…</> : mode === "signup" ? "Create your account" : "Sign in to Folio"}<ArrowRight size={16} /></button>
          </form>
          <p className="welcome__secure"><LockKeyhole size={13} /> A private space for the things you’re making.</p>
        </div>
      </section>
      <div className="welcome-bottomline"><span>MADE FOR MAKING PROGRESS, GENTLY.</span><span>FOLIO &nbsp; / &nbsp; 01</span></div>
    </main>
  );
}
