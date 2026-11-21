"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileArchive, FileImage, FileOutput, FileText, LockKeyhole, Merge, Network, Scissors, Sparkles, WandSparkles, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { authHeaders } from "@/lib/client-auth";
import { Portal } from "@/components/portal";

type Tool = { title: string; description: string; icon: typeof FileText; tone: string; ready?: boolean };
type SavedAlkaneDocument = { id: string; title: string; updatedAt: string };
type AlkaneDocumentData = { schemaVersion: number; title?: string; boards: unknown[]; activeBoardId: string; [key: string]: unknown };

async function apiJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Folio could not complete that request.");
  return result as T;
}

const tools: { group: string; tools: Tool[] }[] = [
  { group: "Organize PDF", tools: [
    { title: "Merge PDF", description: "Combine multiple files into one clean PDF.", icon: Merge, tone: "violet", ready: true },
    { title: "Split PDF", description: "Extract pages or divide a document into parts.", icon: Scissors, tone: "orange", ready: true },
    { title: "Organize PDF", description: "Reorder, rotate, and remove pages with ease.", icon: FileArchive, tone: "blue", ready: true },
  ] },
  { group: "Convert & optimize", tools: [
    { title: "Compress PDF", description: "Make PDFs smaller while keeping them readable.", icon: FileOutput, tone: "green", ready: true },
    { title: "PDF to JPG", description: "Turn PDF pages into high-quality images.", icon: FileImage, tone: "pink" },
    { title: "OCR PDF", description: "Make scanned documents searchable and usable.", icon: WandSparkles, tone: "gold" },
  ] },
  { group: "Edit & protect", tools: [
    { title: "Edit PDF", description: "Add text, shapes, highlights, and notes.", icon: FileText, tone: "indigo" },
    { title: "Protect PDF", description: "Add a password before sharing a document.", icon: LockKeyhole, tone: "red" },
  ] },
];

function downloadPdf(bytes: Uint8Array, name: string) { const blob = new Blob([bytes as BlobPart], { type: "application/pdf" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

export function AppsView({ openDocumentId = null, onOpenDocumentHandled }: { openDocumentId?: string | null; onOpenDocumentHandled?: () => void } = {}) {
  const [active, setActive] = useState<Tool | null>(null);
  const [opened, setOpened] = useState(false);
  const [alkaneOpened, setAlkaneOpened] = useState(false);
  const [alkaneReady, setAlkaneReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedDocuments, setSavedDocuments] = useState<SavedAlkaneDocument[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [alkaneMessage, setAlkaneMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!alkaneOpened) return;
    let activeListener = true;
    const refreshSaved = async () => {
      try {
        const result = await apiJson<{ documents: SavedAlkaneDocument[] }>("/api/apps/alkane/documents");
        if (activeListener) setSavedDocuments(result.documents);
      } catch (reason) {
        if (activeListener) setAlkaneMessage(reason instanceof Error ? reason.message : "Saved diagrams could not be loaded.");
      }
    };
    void refreshSaved();
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; document?: unknown; message?: unknown } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "folio:alkane-ready") { setAlkaneReady(true); return; }
      if (data.type === "folio:alkane-error") {
        setAlkaneMessage(typeof data.message === "string" ? data.message : "Alkane could not complete that action.");
        return;
      }
      if (data.type !== "folio:save-alkane" || !data.document || typeof data.document !== "object") return;
      const documentData = data.document as AlkaneDocumentData;
      try {
        const result = await apiJson<{ document: SavedAlkaneDocument }>("/api/apps/alkane/documents", {
          method: "POST", body: JSON.stringify({ title: documentData.title, document: documentData }),
        });
        if (!activeListener) return;
        setSavedDocuments((current) => [result.document, ...current.filter((item) => item.id !== result.document.id)]);
        setAlkaneMessage(`Saved “${result.document.title}” to Folio.`);
        iframeRef.current?.contentWindow?.postMessage({ type: "folio:save-alkane-result", ok: true, title: result.document.title }, window.location.origin);
      } catch (reason) {
        const error = reason instanceof Error ? reason.message : "Could not save this diagram to Folio.";
        if (!activeListener) return;
        setAlkaneMessage(error);
        iframeRef.current?.contentWindow?.postMessage({ type: "folio:save-alkane-result", ok: false, error }, window.location.origin);
      }
    };
    window.addEventListener("message", receive);
    iframeRef.current?.contentWindow?.postMessage({ type: "folio:ping" }, window.location.origin);
    return () => { activeListener = false; window.removeEventListener("message", receive); };
  }, [alkaneOpened]);

  const process = async (files: FileList | null) => {
    if (!files?.length || !active) return;
    setBusy(true); setMessage("");
    try {
      const selected = Array.from(files); const docs = await Promise.all(selected.map((file) => file.arrayBuffer().then((bytes) => PDFDocument.load(bytes))));
      if (active.title === "Merge PDF") { const out = await PDFDocument.create(); for (const doc of docs) { const pages = await out.copyPages(doc, doc.getPageIndices()); pages.forEach((page) => out.addPage(page)); } downloadPdf(await out.save({ useObjectStreams: true }), "folio-merged.pdf"); }
      else if (active.title === "Split PDF") { const doc = docs[0]; const out = await PDFDocument.create(); const page = (await out.copyPages(doc, [0]))[0]; out.addPage(page); downloadPdf(await out.save({ useObjectStreams: true }), selected[0].name.replace(/\.pdf$/i, "") + "-page-1.pdf"); }
      else if (active.title === "Organize PDF") { const doc = docs[0]; const out = await PDFDocument.create(); const pages = await out.copyPages(doc, doc.getPageIndices()); pages.reverse().forEach((page) => out.addPage(page)); downloadPdf(await out.save({ useObjectStreams: true }), selected[0].name.replace(/\.pdf$/i, "") + "-organized.pdf"); }
      else { downloadPdf(await docs[0].save({ useObjectStreams: true }), selected[0].name.replace(/\.pdf$/i, "") + "-compressed.pdf"); }
      setMessage("Done — your file was downloaded. Files stayed in this browser.");
    } catch { setMessage("That file could not be read. Please choose a valid PDF."); } finally { setBusy(false); }
  };

  const openSavedDocument = useCallback(async (id: string) => {
    if (!alkaneReady) { setAlkaneMessage("Alkane is still loading. Try again in a moment."); return; }
    setAlkaneMessage("Opening saved diagram…");
    try {
      const result = await apiJson<{ document: { id: string; title: string; data: AlkaneDocumentData } }>(`/api/apps/alkane/documents/${id}`);
      const frame = iframeRef.current?.contentWindow;
      if (!frame) throw new Error("Alkane is not ready to open this diagram.");
      setAlkaneReady(false);
      frame.postMessage({ type: "folio:open-alkane-document", document: result.document.data }, window.location.origin);
      setShowSaved(false);
      setAlkaneMessage(`Opening “${result.document.title}”…`);
    } catch (reason) {
      setAlkaneMessage(reason instanceof Error ? reason.message : "Could not open this saved diagram.");
    }
  }, [alkaneReady]);

  useEffect(() => {
    if (!openDocumentId) return;
    setAlkaneReady(false);
    setAlkaneOpened(true);
    setAlkaneMessage("Opening saved diagram…");
  }, [openDocumentId]);

  const handledOpenId = useRef<string | null>(null);
  useEffect(() => {
    if (!openDocumentId) { handledOpenId.current = null; return; }
    if (!alkaneOpened || !alkaneReady || handledOpenId.current === openDocumentId) return;
    handledOpenId.current = openDocumentId;
    void openSavedDocument(openDocumentId).finally(() => onOpenDocumentHandled?.());
  }, [openDocumentId, alkaneOpened, alkaneReady, openSavedDocument, onOpenDocumentHandled]);

  if (alkaneOpened) return <div className="view-stack apps-view apps-view--alkane">
    <div className="apps-alkane-toolbar">
      <button className="apps-back-button" onClick={() => { setAlkaneOpened(false); setAlkaneReady(false); }}><ArrowLeft size={15} /> All apps</button>
      <div className="apps-alkane-brand"><span><Network size={16} /></span><strong>Alkane</strong><small>Mind maps and diagrams</small></div>
      <button className="apps-alkane-save" type="button" disabled={!alkaneReady} title={alkaneReady ? "Save the current editable diagram to Folio" : "Alkane is loading"} onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: "folio:save-current-alkane" }, window.location.origin)}>Save to Folio</button>
      <div className="apps-alkane-saved-wrap">
        <button className="apps-alkane-saved" type="button" onClick={() => setShowSaved((value) => !value)}>Saved ({savedDocuments.length})</button>
        {showSaved && <div className="apps-alkane-saved-menu">{savedDocuments.length ? savedDocuments.map((doc) => <button type="button" key={doc.id} disabled={!alkaneReady} title={alkaneReady ? `Open ${doc.title}` : "Alkane is loading"} onClick={() => void openSavedDocument(doc.id)}><strong>{doc.title}</strong><small>{new Date(doc.updatedAt).toLocaleDateString()}</small></button>) : <p>No saved diagrams yet.</p>}</div>}
      </div>
      <a className="apps-alkane-external" href="/apps/alkane/index.html" target="_blank" rel="noreferrer">Open separately <ArrowRight size={15} /></a>
    </div>
    {alkaneMessage && <p className="apps-alkane-message" role="status">{alkaneMessage}</p>}
    <iframe ref={iframeRef} className="apps-alkane-frame" src="/apps/alkane/index.html" title="Alkane mind mapping and diagramming workspace" onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: "folio:ping" }, window.location.origin)} allow="fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-modals" />
  </div>;

  if (!opened) return <div className="view-stack apps-view">
    <div className="apps-hero panel"><div className="apps-hero__orb"><Sparkles size={24} /></div><div><span className="eyebrow">FOLIO APPS</span><h1>Your apps, inside Folio.</h1><p>Open a focused tool without another account or another history. Everything stays in your Folio workspace.</p></div></div>
    <section className="apps-section"><div className="apps-section__heading"><div><span className="eyebrow">CONNECTED APPS</span><h2>Available in your workspace</h2></div><span>2 apps</span></div><div className="apps-launch-grid"><button className="app-launch-card" onClick={() => setOpened(true)}><span className="app-launch-card__logo">i<span>♥</span>PDF</span><span className="app-launch-card__copy"><strong>I Love PDF</strong><small>Merge, split, compress, organize and transform PDFs.</small><em>Runs privately inside Folio · no separate sign-in</em></span><ArrowRight size={19} /></button><button className="app-launch-card app-launch-card--alkane" onClick={() => { setAlkaneReady(false); setAlkaneOpened(true); setAlkaneMessage(""); }}><span className="app-launch-card__logo"><Network size={31} strokeWidth={1.8} /></span><span className="app-launch-card__copy"><strong>Alkane</strong><small>Mind maps, diagrams and visual thinking.</small><em>Offline-first · local documents · save editable boards to Folio</em></span><ArrowRight size={19} /></button></div></section>
  </div>;

  return <div className="view-stack apps-view">
    <button className="apps-back-button" onClick={() => setOpened(false)}><ArrowLeft size={15} /> All apps</button>
    <div className="apps-hero panel"><div className="apps-hero__orb"><Sparkles size={24} /></div><div><span className="eyebrow">FOLIO APPS</span><h1>Small tools for the work in front of you.</h1><p>Private PDF tools inside Folio. No second account and no upload—the first tools process files in your browser.</p></div><div className="apps-hero__meta"><strong>PDF Studio</strong><span>Built for Folio · no extra sign-in</span></div></div>
    {tools.map((section) => <section className="apps-section" key={section.group}><div className="apps-section__heading"><div><span className="eyebrow">TOOLKIT</span><h2>{section.group}</h2></div><span>{section.tools.length} tools</span></div><div className="apps-grid">{section.tools.map((tool) => { const Icon = tool.icon; return <button className="app-tool-card" key={tool.title} onClick={() => tool.ready ? (setActive(tool), setMessage("")) : undefined} disabled={!tool.ready}><span className={"app-tool-card__icon app-tool-card__icon--" + tool.tone}><Icon size={21} /></span><span className="app-tool-card__copy"><strong>{tool.title}</strong><small>{tool.description}</small></span><span className="app-tool-card__state">{tool.ready ? "Ready" : "Coming soon"}</span><ArrowRight size={16} /></button>; })}</div></section>)}
    <div className="apps-note"><Sparkles size={16} /><span><strong>Your Folio session is shared.</strong> Tool activity will stay with Folio when history is connected.</span></div>
    {active && <Portal><div className="apps-modal-backdrop" onClick={() => !busy && setActive(null)}><section className="apps-modal panel" onClick={(event) => event.stopPropagation()}><button className="apps-modal__close" onClick={() => setActive(null)} aria-label="Close"><X size={17} /></button><span className="eyebrow">PDF STUDIO</span><h2>{active.title}</h2><p>{active.title === "Split PDF" ? "Choose a PDF. Folio will download its first page as a separate PDF." : active.description}</p><input ref={inputRef} type="file" accept="application/pdf" multiple={active.title === "Merge PDF"} onChange={(event) => process(event.target.files)} /><button className="apps-upload-button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Working…" : "Choose PDF file"}</button>{message && <div className="apps-modal__message">{message}</div>}<small><Download size={13} /> Nothing is uploaded to Folio or Neon.</small></section></div></Portal>}
  </div>;
}
