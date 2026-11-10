import Link from "next/link";
import { ArrowLeft, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="folio-404">
      <div className="folio-404__glow folio-404__glow--one" />
      <div className="folio-404__glow folio-404__glow--two" />
      <section className="folio-404__card">
        <div className="folio-404__copy">
          <div className="folio-404__brand"><span className="folio-404__mark">✦</span><span>folio<span>.</span></span></div>
          <p className="folio-404__eyebrow">PAGE NOT FOUND</p>
          <h1>Well, this is<br /><em>awkward.</em></h1>
          <p className="folio-404__lead">The page has left the chat. It may have moved, disappeared, or taken a quiet break.</p>
          <div className="folio-404__actions">
            <Link className="folio-404__primary" href="/"><Home size={17} /> Take me home</Link>
            <button className="folio-404__secondary" onClick={() => window.history.back()}><ArrowLeft size={17} /> Go back</button>
          </div>
        </div>
        <div className="folio-404__art">
          <img src="/images/folio-404.jpg" alt="A friendly explorer looking for the missing page" />
        </div>
      </section>
      <div className="folio-404__tip"><Search size={15} /><span>Quick tip: check the URL for typos.</span></div>
    </main>
  );
}
