"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileArchive, FileImage, FileOutput, FileText, LockKeyhole, Merge, Network, Scissors, Sparkles, WandSparkles, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";

type Tool = { title: string; description: string; icon: typeof FileText; tone: string; ready?: boolean };
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

export function AppsView() {
  const [active, setActive] = useState<Tool | null>(null);
  const [opened, setOpened] = useState(false);
  const [alkaneOpened, setAlkaneOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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
  if (alkaneOpened) return <div className="view-stack apps-view apps-view--alkane">
    <div className="apps-alkane-toolbar">
      <button className="apps-back-button" onClick={() => setAlkaneOpened(false)}><ArrowLeft size={15} /> All apps</button>
      <div className="apps-alkane-brand"><span><Network size={16} /></span><strong>Alkane</strong><small>Mind maps and diagrams</small></div>
      <a className="apps-alkane-external" href="/apps/alkane/index.html" target="_blank" rel="noreferrer">Open separately <ArrowRight size={15} /></a>
    </div>
    <iframe
      className="apps-alkane-frame"
      src="/apps/alkane/index.html"
      title="Alkane mind mapping and diagramming workspace"
      allow="fullscreen"
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-modals"
    />
  </div>;
  if (!opened) return <div className="view-stack apps-view">
    <div className="apps-hero panel"><div className="apps-hero__orb"><Sparkles size={24} /></div><div><span className="eyebrow">FOLIO APPS</span><h1>Your apps, inside Folio.</h1><p>Open a focused tool without another account or another history. Everything stays in your Folio workspace.</p></div></div>
    <section className="apps-section"><div className="apps-section__heading"><div><span className="eyebrow">CONNECTED APPS</span><h2>Available in your workspace</h2></div><span>2 apps</span></div><div className="apps-launch-grid"><button className="app-launch-card" onClick={() => setOpened(true)}><span className="app-launch-card__logo">i<span>♥</span>PDF</span><span className="app-launch-card__copy"><strong>I Love PDF</strong><small>Merge, split, compress, organize and transform PDFs.</small><em>Runs privately inside Folio · no separate sign-in</em></span><ArrowRight size={19} /></button><button className="app-launch-card app-launch-card--alkane" onClick={() => setAlkaneOpened(true)}><span className="app-launch-card__logo"><Network size={31} strokeWidth={1.8} /></span><span className="app-launch-card__copy"><strong>Alkane</strong><small>Mind maps, diagrams and visual thinking.</small><em>Offline-first · local documents · no separate sign-in</em></span><ArrowRight size={19} /></button></div></section>
  </div>;
  return <div className="view-stack apps-view">
    <button className="apps-back-button" onClick={() => setOpened(false)}><ArrowLeft size={15} /> All apps</button>
    <div className="apps-hero panel"><div className="apps-hero__orb"><Sparkles size={24} /></div><div><span className="eyebrow">FOLIO APPS</span><h1>Small tools for the work in front of you.</h1><p>Private PDF tools inside Folio. No second account and no upload—the first tools process files in your browser.</p></div><div className="apps-hero__meta"><strong>PDF Studio</strong><span>Built for Folio · no extra sign-in</span></div></div>
    {tools.map((section) => <section className="apps-section" key={section.group}><div className="apps-section__heading"><div><span className="eyebrow">TOOLKIT</span><h2>{section.group}</h2></div><span>{section.tools.length} tools</span></div><div className="apps-grid">{section.tools.map((tool) => { const Icon = tool.icon; return <button className="app-tool-card" key={tool.title} onClick={() => tool.ready ? (setActive(tool), setMessage("")) : undefined} disabled={!tool.ready}><span className={"app-tool-card__icon app-tool-card__icon--" + tool.tone}><Icon size={21} /></span><span className="app-tool-card__copy"><strong>{tool.title}</strong><small>{tool.description}</small></span><span className="app-tool-card__state">{tool.ready ? "Ready" : "Coming soon"}</span><ArrowRight size={16} /></button>; })}</div></section>)}
    <div className="apps-note"><Sparkles size={16} /><span><strong>Your Folio session is shared.</strong> Tool activity will stay with Folio when history is connected.</span></div>
    {active && <div className="apps-modal-backdrop" onClick={() => !busy && setActive(null)}><section className="apps-modal panel" onClick={(event) => event.stopPropagation()}><button className="apps-modal__close" onClick={() => setActive(null)} aria-label="Close"><X size={17} /></button><span className="eyebrow">PDF STUDIO</span><h2>{active.title}</h2><p>{active.title === "Split PDF" ? "Choose a PDF. Folio will download its first page as a separate PDF." : active.description}</p><input ref={inputRef} type="file" accept="application/pdf" multiple={active.title === "Merge PDF"} onChange={(event) => process(event.target.files)} /><button className="apps-upload-button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Working…" : "Choose PDF file"}</button>{message && <div className="apps-modal__message">{message}</div>}<small><Download size={13} /> Nothing is uploaded to Folio or Neon.</small></section></div>}
  </div>;
}
