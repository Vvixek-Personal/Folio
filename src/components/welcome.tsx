"use client";

import { FileText, Leaf, LockKeyhole, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";

type WelcomeProps = { inviteToken: string | null };

export function Welcome({ inviteToken }: WelcomeProps) {
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("authError");
    const messages: Record<string, string> = {
      google_not_configured: "Google sign-in is not configured yet. Please try again later.",
      google_cancelled: "Google sign-in was cancelled.",
      google_state_invalid: "Your sign-in session expired. Please try again.",
      google_missing_code: "Google did not complete sign-in. Please try again.",
      google_signin_failed: "Google sign-in failed. Please try again.",
      invitation_invalid: "This invitation has expired or belongs to a different email address.",
    };
    if (code) setError(messages[code] || "Sign-in failed. Please try again.");
  }, []);

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
          <div className="welcome-story__bottom"><span><FileText size={15} /> Notes & docs</span><span><span>✓</span> Projects</span><span><Users size={15} /> Together</span></div>
        </aside>
        <div className="welcome__side earth-welcome__side">
          <div className="welcome-form-heading"><span className="welcome-form-heading__icon"><Sparkles size={18} /></span><span className="welcome-form-heading__eyebrow">YOUR SPACE, YOUR PACE</span><h2>A calmer place to begin.</h2><p>Sign in securely with your Google account to continue.</p></div>
          {inviteToken && <p className="welcome__invite"><Sparkles size={14} /> You’ve been invited to a team. Continue with the invited Google account to join.</p>}
          <a className="button button--google welcome__google" href={`/api/auth/google${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ""}`} aria-label="Continue with Google">
            <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.15 13.22l7.98 6.19C13.02 13.72 18.11 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.73 7.18l7.64 5.92c4.46-4.13 7.16-10.2 7.16-17.57Z"/><path fill="#FBBC05" d="M11.13 28.59A14.4 14.4 0 0 1 10.35 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.58 10.78l8.55-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.88l-7.64-5.92c-2.12 1.42-4.83 2.27-8.27 2.27-5.89 0-10.98-4.22-12.87-9.91l-8.55 6.19C6.51 43.62 14.62 48 24 48Z"/></svg>
            Continue with Google
          </a>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="welcome__secure"><LockKeyhole size={13} /> A private space for the things you’re making.</p>
        </div>
      </section>
      <div className="welcome-bottomline"><span>MADE FOR MAKING PROGRESS, GENTLY.</span><span>FOLIO &nbsp; / &nbsp; 01</span></div>
    </main>
  );
}
