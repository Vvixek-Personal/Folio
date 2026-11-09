// Lightweight, dependency-free request input helpers.
// Every POST/PATCH handler parses with readJsonBody() and then applies the same
// object/array fallback check before touching any field.

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Removes server-managed / relational columns from an already-validated body.
 * Tenant, audit, and identifier fields can never be sourced from a request.
 */
export function stripFields(body: object, keys: readonly string[]): Record<string, unknown> {
  const record = body as Record<string, unknown>;
  for (const key of keys) delete record[key];
  return record;
}

/** Returns a string value exactly as sent (no trimming). */
export function rawString(body: object, key: string): string | undefined {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/** Returns a trimmed string, or undefined when the key is absent or not a string. */
export function textField(body: object, key: string, maxLength: number): string | undefined {
  const value = rawString(body, key);
  if (value === undefined) return undefined;
  return value.trim().slice(0, maxLength);
}

/**
 * Returns a trimmed string, null for explicit nulls or whitespace-only values,
 * or undefined when the key is absent. Used for clearable optional fields.
 */
export function nullableTextField(body: object, key: string, maxLength: number): string | null | undefined {
  const value = (body as Record<string, unknown>)[key];
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

export function booleanField(body: object, key: string): boolean | undefined {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}

/** Returns the value only when it is one of the explicitly allowed options. */
export function enumField(body: object, key: string, allowed: readonly string[]): string | undefined {
  const value = rawString(body, key);
  return value !== undefined && allowed.includes(value) ? value : undefined;
}

export function isEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
