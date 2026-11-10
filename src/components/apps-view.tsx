"use client";

import { ArrowRight, FileArchive, FileImage, FileOutput, FileText, LockKeyhole, Merge, Scissors, Sparkles, WandSparkles } from "lucide-react";

type Tool = { title: string; description: string; icon: typeof FileText; tone: string; state?: string };

const tools: { group: string; tools: Tool[] }[] = [
  { group: "Organize PDF", tools: [
    { title: "Merge PDF", description: "Combine multiple files into one clean PDF.", icon: Merge, tone: "violet", state: "Ready next" },
    { title: "Split PDF", description: "Extract pages or divide a document into parts.", icon: Scissors, tone: "orange", state: "Ready next" },
    { title: "Organize PDF", description: "Reorder, rotate, and remove pages with ease.", icon: FileArchive, tone: "blue", state: "Coming soon" },
  ] },
  { group: "Convert & optimize", tools: [
    { title: "Compress PDF", description: "Make PDFs smaller while keeping them readable.", icon: FileOutput, tone: "green", state: "Ready next" },
    { title: "PDF to JPG", description: "Turn PDF pages into high-quality images.", icon: FileImage, tone: "pink", state: "Coming soon" },
    { title: "OCR PDF", description: "Make scanned documents searchable and usable.", icon: WandSparkles, tone: "gold", state: "Coming soon" },
  ] },
  { group: "Edit & protect", tools: [
    { title: "Edit PDF", description: "Add text, shapes, highlights, and notes.", icon: FileText, tone: "indigo", state: "Coming soon" },
    { title: "Protect PDF", description: "Add a password before sharing a document.", icon: LockKeyhole, tone: "red", state: "Coming soon" },
  ] },
];

export function AppsView() {
  return <div className="view-stack apps-view">
    <div className="apps-hero panel">
      <div className="apps-hero__orb"><Sparkles size={24} /></div>
      <div><span className="eyebrow">FOLIO APPS</span><h1>Small tools for the work in front of you.</h1><p>PDF tools are coming into Folio as a focused, private workspace. No second account, no separate history—your activity stays with your Folio workspace.</p></div>
      <div className="apps-hero__meta"><strong>PDF Studio</strong><span>Built for Folio · no extra sign-in</span></div>
    </div>
    {tools.map((section) => <section className="apps-section" key={section.group}><div className="apps-section__heading"><div><span className="eyebrow">TOOLKIT</span><h2>{section.group}</h2></div><span>{section.tools.length} tools</span></div><div className="apps-grid">{section.tools.map((tool) => { const Icon = tool.icon; return <button className="app-tool-card" key={tool.title} onClick={() => undefined}><span className={`app-tool-card__icon app-tool-card__icon--${tool.tone}`}><Icon size={21} /></span><span className="app-tool-card__copy"><strong>{tool.title}</strong><small>{tool.description}</small></span><span className="app-tool-card__state">{tool.state}</span><ArrowRight size={16} /></button>; })}</div></section>)}
    <div className="apps-note"><Sparkles size={16} /><span><strong>Your Folio session is shared.</strong> When tools go live, files will be processed inside this workspace and their activity will appear in Folio—not in a separate app.</span></div>
  </div>;
}
