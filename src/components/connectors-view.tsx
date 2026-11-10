"use client";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

function GoogleDriveMark() {
  return <svg className="connector-card__drive-mark" viewBox="0 0 48 42" aria-hidden="true"><path fill="#0F9D58" d="M16.2 2h10.5l13.2 22.8H29.4z"/><path fill="#F4B400" d="M16.2 2 3 24.8l5.3 9.1 13.2-22.8z"/><path fill="#4285F4" d="m8.3 33.9 5.3 6.1h26.3l-5.3-9.1H13.6z"/></svg>;
}
export function ConnectorsView() {
 const [status, setStatus] = useState<{ connected: boolean; email?: string; limit?: number; usage?: number; free?: number; error?: string } | null>(null);
 useEffect(() => { fetch("/api/connectors/google/status", { cache: "no-store" }).then((r) => r.json()).then(setStatus).catch(() => setStatus({ connected: false })); }, []);
 const format = (bytes = 0) => `${(bytes / 1024 ** 3).toFixed(bytes >= 1024 ** 3 ? 1 : 2)} GB`;
 const usedPercent = status?.limit ? Math.min(100, ((status.usage ?? 0) / status.limit) * 100) : 0;
 return <div className="view-stack connectors-page"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot" /> CONNECTIONS</p><h1>Connectors</h1><p className="welcome-subtitle">Choose where Folio can connect when you are ready.</p></div></div><section className={`panel connector-card ${status?.connected ? "connector-card--connected" : ""}`}><div className="connector-card__icon"><GoogleDriveMark /></div><div className="connector-card__copy"><div className="connector-card__title"><h2>Google Drive</h2>{status?.connected && <span className="connector-status"><i /> Connected</span>}</div>{status?.connected ? <p>{status.email}</p> : <p>Connect a Drive account for your future Folio workspace backup.</p>}<small><ShieldCheck size={13}/> Permission is requested only when you connect.</small></div>{status?.connected ? <div className="connector-card__quota"><div className="connector-card__quota-head"><span>Storage</span><strong>{format(status.usage)} used</strong></div><div className="connector-card__meter"><span style={{ width: `${usedPercent}%` }} /></div><div className="connector-card__quota-foot"><span>{format(status.free)} free</span><span>{format(status.limit)} total</span></div>{status.error && <em>{status.error}</em>}</div> : <a className="button button--primary connector-card__button" href="/api/connectors/google">Connect Drive</a>}</section></div>;
}
