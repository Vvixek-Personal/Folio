"use client";
import { HardDrive, ShieldCheck } from "lucide-react";
export function ConnectorsView() {
 return <div className="view-stack connectors-page"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot" /> CONNECTIONS</p><h1>Connectors</h1><p className="welcome-subtitle">Choose where Folio can connect when you are ready.</p></div></div><section className="panel connector-card"><div className="connector-card__icon"><HardDrive size={22}/></div><div className="connector-card__copy"><h2>Google Drive</h2><p>Connect a Drive account for your future Folio workspace backup.</p><small><ShieldCheck size={13}/> Permission is requested only when you connect.</small></div><a className="button button--primary" href="/api/connectors/google">Connect Drive</a></section></div>;
}
