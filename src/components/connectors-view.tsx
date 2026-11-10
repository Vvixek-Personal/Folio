"use client";
import { ShieldCheck } from "lucide-react";

function GoogleDriveMark() {
  return <svg className="connector-card__drive-mark" viewBox="0 0 48 42" aria-hidden="true"><path fill="#0F9D58" d="M16.2 2h10.5l13.2 22.8H29.4z"/><path fill="#F4B400" d="M16.2 2 3 24.8l5.3 9.1 13.2-22.8z"/><path fill="#4285F4" d="m8.3 33.9 5.3 6.1h26.3l-5.3-9.1H13.6z"/></svg>;
}
export function ConnectorsView() {
 return <div className="view-stack connectors-page"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot" /> CONNECTIONS</p><h1>Connectors</h1><p className="welcome-subtitle">Choose where Folio can connect when you are ready.</p></div></div><section className="panel connector-card"><div className="connector-card__icon"><GoogleDriveMark /></div><div className="connector-card__copy"><h2>Google Drive</h2><p>Connect a Drive account for your future Folio workspace backup.</p><small><ShieldCheck size={13}/> Permission is requested only when you connect.</small></div><a className="button button--primary connector-card__button" href="/api/connectors/google">Connect Drive</a></section></div>;
}
