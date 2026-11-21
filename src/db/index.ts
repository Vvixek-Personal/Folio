import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type FolioDatabase = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __folioPostgresql?: {
    url: string;
    pool: Pool;
    db: FolioDatabase;
  };
};

/**
 * Resolve the database only when a request actually uses it.
 *
 * Next.js imports route modules while building. Creating the Pool lazily keeps
 * previews that intentionally have no database credentials buildable, while
 * still failing with a clear message when a database-backed request is made.
 */
function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for Folio database-backed features.");
  }

  if (globalForDb.__folioPostgresql?.url === url) {
    return globalForDb.__folioPostgresql;
  }

  const previous = globalForDb.__folioPostgresql;
  if (previous) void previous.pool.end().catch(() => undefined);

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  const instance = { url, pool, db };
  globalForDb.__folioPostgresql = instance;
  return instance;
}

type DatabaseProxy = FolioDatabase;

export const db = new Proxy({} as DatabaseProxy, {
  get(_target, property) {
    const instance = getDatabase().db;
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as DatabaseProxy;

export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const instance = getDatabase().pool;
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as Pool;
