"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

/** Render overlays outside animated workspace containers so fixed positioning uses the viewport. */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
