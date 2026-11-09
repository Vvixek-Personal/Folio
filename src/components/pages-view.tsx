"use client";

import { ArrowRight, FilePlus2, FileText, LayoutGrid, List, Plus, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkspacePage } from "@/lib/types";
import { pagePlainText } from "@/lib/page-content";
import { PageIcon } from "@/components/page-icon";

function updated(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days < 1) return "Edited today";
  if (days === 1) return "Edited yesterday";
  return `Edited ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value))}`;
}

export function PagesView({ pages, onOpen, onCreate, onFavorite }: { pages: WorkspacePage[]; onOpen: (page: WorkspacePage) => void; onCreate: () => void; onFavorite: (page: WorkspacePage) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [sort, setSort] = useState<"recent" | "alphabetical">("recent");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const visiblePages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pages.filter((page) => (filter === "all" || page.isFavorite) && `${page.title} ${pagePlainText(page.content)}`.toLowerCase().includes(query))
      .sort((a, b) => sort === "alphabetical" ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt));
  }, [pages, search, filter, sort]);

  return <div className="view-stack pages-view"><div className="page-heading-row"><div><p className="eyebrow"><span className="eyebrow-dot eyebrow-dot--sage" /> A HOME FOR YOUR IDEAS</p><h1>Pages</h1><p className="welcome-subtitle">Notes, decisions and details worth keeping close.</p></div><button className="button button--primary" onClick={onCreate}><Plus size={17} /> New page</button></div>
    <div className="pages-library-toolbar"><div className="pages-library-tabs"><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All pages <span>{pages.length}</span></button><button className={filter === "favorites" ? "is-active" : ""} onClick={() => setFilter("favorites")}><Star size={14} /> Favourites</button></div><div className="pages-library-controls"><label className="inline-search panel-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a page" aria-label="Find a page" /></label><select value={sort} onChange={(event) => setSort(event.target.value as "recent" | "alphabetical")} aria-label="Sort pages"><option value="recent">Recently edited</option><option value="alphabetical">A to Z</option></select><div className="segmented-control segmented-control--view"><button className={layout === "grid" ? "is-selected" : ""} onClick={() => setLayout("grid")} aria-label="Grid view"><LayoutGrid size={15} /></button><button className={layout === "list" ? "is-selected" : ""} onClick={() => setLayout("list")} aria-label="List view"><List size={15} /></button></div></div></div>
    {visiblePages.length ? <div className={`pages-grid ${layout === "list" ? "pages-grid--list" : ""}`}>{visiblePages.map((page) => {
      const preview = pagePlainText(page.content).replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
      return <article className="page-card library-card" key={page.id}><button className="page-card__main" onClick={() => onOpen(page)}><span className={`library-card__cover notion-editor__cover--${page.cover}`} /><span className="page-card__icon"><PageIcon value={page.icon} size={19} /></span><span className="eyebrow eyebrow--muted">{page.isFavorite ? "FAVOURITE PAGE" : "YOUR PAGE"}</span><strong>{page.title}</strong><p>{preview || "A fresh page, ready for an idea."}</p></button><div className="page-card__footer"><span>{updated(page.updatedAt)}</span><button className={`page-fav ${page.isFavorite ? "is-active" : ""}`} onClick={() => onFavorite(page)} aria-label={page.isFavorite ? "Remove from favourites" : "Add to favourites"}><Star size={16} fill={page.isFavorite ? "currentColor" : "none"} /></button></div></article>;
    })}{filter === "all" && !search && <button className="page-add-card" onClick={onCreate}><span><Plus size={19} /></span><strong>Create a new page</strong><small>Start with a blank canvas</small></button>}</div> : <section className="panel library-empty"><div className="library-empty__icon">{search || filter === "favorites" ? <Search size={24} /> : <FileText size={24} />}</div><h2>{search ? "No pages found" : filter === "favorites" ? "Your favourites will live here" : "A blank page can go anywhere."}</h2><p>{search ? "Try a different word or clear your search." : filter === "favorites" ? "Star a page to keep it close at hand." : "Capture a meeting note, a project brief, or the beginning of a good idea."}</p>{!search && filter === "all" && <button className="button button--primary" onClick={onCreate}><FilePlus2 size={16} /> Create your first page <ArrowRight size={15} /></button>}</section>}
  </div>;
}
