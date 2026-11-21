CREATE TABLE IF NOT EXISTS "alkane_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "source_id" text NOT NULL,
  "document" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "alkane_documents_workspace_updated_idx"
  ON "alkane_documents" ("workspace_id", "updated_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "alkane_documents_workspace_source_idx"
  ON "alkane_documents" ("workspace_id", "source_id");
