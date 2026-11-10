"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="folio-404-reference">
      <img src="/images/folio-404-reference.png" alt="404 — page not found" />
      <Link className="folio-404-reference__home" href="/" aria-label="Take me home" />
      <button className="folio-404-reference__back" onClick={() => window.history.back()} aria-label="Go back" />
    </main>
  );
}
