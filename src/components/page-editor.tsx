"use client";

import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignLeft, Bold, Check, CheckSquare, ChevronDown, Copy, Download, Heading1, Heading2,
  Highlighter, Italic, Link2, List, ListOrdered, Minus, Palette, Quote, Redo2, Sparkles,
  Star, Strikethrough, Trash2, Underline, Undo2, X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { WorkspacePage } from "@/lib/types";
import { pagePlainText } from "@/lib/page-content";
import { PageIcon, PAGE_ICONS } from "@/components/page-icon";

type PageInput = Pick<WorkspacePage, "title" | "icon" | "cover" | "content" | "isFavorite">;

type Props = {
  page?: WorkspacePage;
  startWithTemplates?: boolean;
  onClose: () => void;
  onSave: (input: PageInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onDuplicate?: (input: PageInput) => Promise<void>;
};

const icons = PAGE_ICONS;
const covers = [
  { id: "sage", name: "Sage" }, { id: "clay", name: "Clay" }, { id: "sand", name: "Sand" },
  { id: "sky", name: "Sky" }, { id: "olive", name: "Olive" }, { id: "none", name: "No cover" },
];
const colors = [
  { color: "#37443c", label: "Ink" }, { color: "#758b70", label: "Sage" },
  { color: "#b9785f", label: "Clay" }, { color: "#b58d53", label: "Ochre" },
  { color: "#718c9b", label: "Slate blue" },
];

function paragraph(text = ""): JSONContent {
  return text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
}
function heading(text: string): JSONContent {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}
const templates: { id: string; icon: string; title: string; description: string; content: JSONContent }[] = [
  { id: "meeting", icon: "calendar", title: "Meeting notes", description: "Agenda, notes, next steps", content: { type: "doc", content: [heading("Agenda"), paragraph(), heading("Notes"), paragraph(), heading("Next steps"), paragraph()] } },
  { id: "project", icon: "sprout", title: "Project brief", description: "Turn an idea into a plan", content: { type: "doc", content: [heading("The big idea"), paragraph(), heading("What success looks like"), paragraph(), heading("Next steps"), paragraph()] } },
  { id: "weekly", icon: "sun", title: "Weekly planning", description: "A little structure for your week", content: { type: "doc", content: [heading("This week’s focus"), paragraph(), heading("Things to do"), { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [paragraph()] }] }, heading("Notes to self"), paragraph()] } },
  { id: "journal", icon: "notebook", title: "Daily journal", description: "A quiet moment to reflect", content: { type: "doc", content: [heading("On my mind"), paragraph(), heading("Little wins"), paragraph(), heading("Tomorrow"), paragraph()] } },
];

function initialDocument(value: string): JSONContent {
  if (!value) return { type: "doc", content: [paragraph()] };
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "type" in parsed && parsed.type === "doc") return parsed as JSONContent;
  } catch { /* Earlier pages were saved as plain text. */ }
  return { type: "doc", content: value.split("\n").map((line) => paragraph(line)) };
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`editor-tool ${active ? "editor-tool--active" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={onClick} title={label} aria-label={label} aria-pressed={active}>{children}</button>;
}

export function PageEditor({ page, startWithTemplates = false, onClose, onSave, onDelete, onDuplicate }: Props) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [icon, setIcon] = useState(page?.icon ?? "leaf");
  const [cover, setCover] = useState(page?.cover ?? "sage");
  const [favorite, setFavorite] = useState(page?.isFavorite ?? false);
  const [showIcons, setShowIcons] = useState(false);
  const [showCovers, setShowCovers] = useState(false);
  const [showTemplates, setShowTemplates] = useState(startWithTemplates);
  const [showColors, setShowColors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } } }),
      Placeholder.configure({ placeholder: "Start writing, or choose a template below…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialDocument(page?.content ?? ""),
    onUpdate: () => setDirty(true),
    editorProps: { attributes: { class: "folio-editor-content", "aria-label": "Page content" } },
  });

  const currentInput = (): PageInput => ({
    title: title.trim(), icon, cover, content: editor && !editor.isEmpty ? JSON.stringify(editor.getJSON()) : "", isFavorite: favorite,
  });
  const close = () => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onClose();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (dirty && !window.confirm("Discard your unsaved changes?")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, onClose]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) { setError("Give your page a title first."); return; }
    setBusy(true); setError("");
    try { await onSave(currentInput()); setDirty(false); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t save this page."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!page || !onDelete || !window.confirm("Delete this page? This can’t be undone.")) return;
    setDeleting(true);
    try { await onDelete(page.id); onClose(); } catch { setDeleting(false); }
  };
  const duplicate = async () => {
    if (!onDuplicate || !title.trim()) { setError("Give your page a title before duplicating it."); return; }
    setBusy(true); setError("");
    try { await onDuplicate({ ...currentInput(), title: `${title.trim()} (copy)`.slice(0, 160) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t duplicate this page."); }
    finally { setBusy(false); }
  };
  const download = () => {
    const content = editor ? pagePlainText(JSON.stringify(editor.getJSON())) : "";
    const blob = new Blob([`${title.trim() || "Untitled page"}\n\n${content}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${(title.trim() || "folio-page").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80)}.txt`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const entered = window.prompt("Paste a web link (https://…)", previous ?? "https://");
    if (entered === null) return;
    if (!entered.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    try {
      const url = new URL(entered.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.toString() }).run();
    } catch { setError("Enter a valid link beginning with https:// or http://."); }
  };
  const applyTemplate = (content: JSONContent) => {
    if (!editor) return;
    if (!editor.isEmpty && !window.confirm("Replace the current page content with this template?")) return;
    editor.commands.setContent(content);
    setDirty(true); setShowTemplates(false);
  };

  return (
    <div className="modal-backdrop page-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="notion-editor" role="dialog" aria-modal="true" aria-label={page ? "Edit page" : "Create page"}>
        <form onSubmit={save} className="notion-editor__form">
          <header className="notion-editor__header"><div className="notion-editor__crumb"><span className="notion-editor__crumb-icon"><PageIcon value={icon} size={16} /></span><span>{title || "Untitled page"}</span><span className="notion-editor__draft">{dirty ? "Unsaved changes" : page ? "Saved page" : "New page"}</span></div><div className="notion-editor__header-actions"><button type="button" className={`editor-star ${favorite ? "is-active" : ""}`} onClick={() => { setFavorite(!favorite); setDirty(true); }} title="Toggle favourite" aria-label="Toggle favourite"><Star size={17} fill={favorite ? "currentColor" : "none"} /></button><button type="button" className="editor-icon-action" onClick={download} title="Export text" aria-label="Export text"><Download size={17} /></button>{page && onDuplicate && <button type="button" className="editor-icon-action" onClick={duplicate} title="Duplicate page" aria-label="Duplicate page" disabled={busy}><Copy size={16} /></button>}<button type="button" className="editor-icon-action" onClick={close} title="Close page" aria-label="Close page"><X size={19} /></button></div></header>
          <div className={`notion-editor__cover notion-editor__cover--${cover}`}><div className="cover-actions"><button type="button" onClick={() => setShowCovers(!showCovers)}><Palette size={14} /> Change cover</button></div></div>
          <div className="notion-editor__body">
            {showCovers && <div className="cover-picker"><span>PAGE COVER</span>{covers.map((item) => <button type="button" className={`cover-swatch cover-swatch--${item.id} ${cover === item.id ? "is-selected" : ""}`} key={item.id} onClick={() => { setCover(item.id); setShowCovers(false); setDirty(true); }} title={item.name} aria-label={item.name}>{cover === item.id && <Check size={13} />}</button>)}</div>}
            <div className="notion-editor__icon-wrap"><button type="button" className="notion-editor__page-icon" onClick={() => setShowIcons(!showIcons)} title="Choose page icon" aria-label="Choose page icon"><PageIcon value={icon} size={29} /></button>{showIcons && <div className="notion-icon-picker"><strong>CHOOSE AN ICON</strong><div>{icons.map((item) => <button type="button" key={item.value} onClick={() => { setIcon(item.value); setShowIcons(false); setDirty(true); }} aria-label={`Choose ${item.label}`}><PageIcon value={item.value} size={17} /></button>)}</div></div>}</div>
            <input className="notion-editor__title" value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} placeholder="Untitled page" maxLength={160} autoFocus aria-label="Page title" />
            <div className="notion-editor__meta"><span><span className="notion-editor__meta-dot" /> PRIVATE WORKSPACE</span><span>Make it yours, one thought at a time.</span></div>
            <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
              <ToolButton label="Paragraph" active={editor?.isActive("paragraph")} onClick={() => editor?.chain().focus().setParagraph().run()}><AlignLeft size={16} /></ToolButton>
              <ToolButton label="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></ToolButton>
              <ToolButton label="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolButton>
              <span className="editor-toolbar__divider" />
              <ToolButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></ToolButton>
              <ToolButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolButton>
              <ToolButton label="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={15} /></ToolButton>
              <ToolButton label="Strikethrough" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolButton>
              <div className="editor-color-wrap"><ToolButton label="Text color" active={showColors} onClick={() => setShowColors(!showColors)}><span className="editor-color-icon">A</span></ToolButton>{showColors && <div className="editor-color-popover"><strong>TEXT COLOR</strong>{colors.map((item) => <button type="button" key={item.color} onMouseDown={(event) => event.preventDefault()} onClick={() => { editor?.chain().focus().setColor(item.color).run(); setShowColors(false); }}><span style={{ background: item.color }} />{item.label}</button>)}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor?.chain().focus().unsetColor().run(); setShowColors(false); }}>Reset color</button></div>}</div>
              <ToolButton label="Highlight" active={editor?.isActive("highlight")} onClick={() => editor?.chain().focus().toggleHighlight({ color: "#efe3bd" }).run()}><Highlighter size={15} /></ToolButton>
              <span className="editor-toolbar__divider" />
              <ToolButton label="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={16} /></ToolButton>
              <ToolButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
              <ToolButton label="Checklist" active={editor?.isActive("taskList")} onClick={() => editor?.chain().focus().toggleTaskList().run()}><CheckSquare size={16} /></ToolButton>
              <ToolButton label="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={16} /></ToolButton>
              <ToolButton label="Link" active={editor?.isActive("link")} onClick={setLink}><Link2 size={16} /></ToolButton>
              <ToolButton label="Divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus size={16} /></ToolButton>
              <span className="editor-toolbar__divider" />
              <ToolButton label="Undo" onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></ToolButton>
              <ToolButton label="Redo" onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></ToolButton>
            </div>
            {!editor ? <div className="editor-loading"><span className="loading-dot" /> Preparing your page…</div> : <EditorContent editor={editor} />}
            <div className="notion-editor__extras"><button type="button" className="template-trigger" onClick={() => setShowTemplates(!showTemplates)}><Sparkles size={15} /> Start with a template <ChevronDown size={14} /></button><span>Tip: use #, - or [ ] as you type.</span></div>
            {showTemplates && <div className="template-grid">{templates.map((template) => <button type="button" key={template.id} onClick={() => applyTemplate(template.content)}><span><PageIcon value={template.icon} size={19} /></span><strong>{template.title}</strong><small>{template.description}</small></button>)}</div>}
            {error && <p className="form-error editor-error" role="alert">{error}</p>}
          </div>
          <footer className="notion-editor__footer">{page && onDelete ? <button className="button button--danger-quiet" type="button" onClick={remove} disabled={deleting}><Trash2 size={15} /> {deleting ? "Deleting…" : "Delete page"}</button> : <span>Made for thoughts worth keeping.</span>}<div><button type="button" className="button button--secondary" onClick={close}>Cancel</button><button className="button button--primary" disabled={busy || !editor}>{busy ? <><span className="button-spinner" /> Saving</> : <><Check size={16} /> Save page</>}</button></div></footer>
        </form>
      </section>
    </div>
  );
}
