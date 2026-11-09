"use client";

// The HttpOnly cookie is the primary session transport. When the app runs in an
// embedded/third-party context the browser may drop that cookie, so the same
// opaque token is mirrored in localStorage and sent as a bearer token.
export const SESSION_STORAGE_KEY = "folio_session_token";
export const WORKSPACE_STORAGE_KEY = "folio_active_workspace";

export function rememberSessionToken(token: string) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    /* Storage can be unavailable in hardened browsers; cookies still apply. */
  }
}

export function storedSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function forgetSessionToken() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    /* Nothing else to clean up. */
  }
}

export function rememberWorkspace(workspaceId: string) {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    /* Preference only. */
  }
}

export function storedWorkspace(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = storedSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const workspace = storedWorkspace();
  if (workspace) headers["x-folio-workspace"] = workspace;
  return headers;
}

/** Builds a URL that lets the server render this session without a cookie. */
export function resumeUrl(pathname = "/"): string {
  const token = storedSessionToken();
  const workspace = storedWorkspace();
  const params = new URLSearchParams();
  if (token) params.set("session", token);
  if (workspace) params.set("ws", workspace);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Full reload that keeps the session even when cookies are unavailable. */
export function resumeSession(pathname = "/") {
  window.location.replace(resumeUrl(pathname));
}
