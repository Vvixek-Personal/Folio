CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#64987c',
  status text NOT NULL DEFAULT 'active',
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects (workspace_id);

CREATE TABLE IF NOT EXISTS studio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, notes text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'meeting', starts_on date NOT NULL, starts_at text, location text NOT NULL DEFAULT '', project_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_events_workspace_idx ON studio_events (workspace_id, starts_on);

CREATE TABLE IF NOT EXISTS library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, url text NOT NULL DEFAULT '', kind text NOT NULL DEFAULT 'article',
  note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'queued', tags text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_items_workspace_idx ON library_items (workspace_id);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL, detail text NOT NULL DEFAULT '', horizon text NOT NULL DEFAULT 'month', progress integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active', due_date date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_workspace_idx ON goals (workspace_id);

CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, context text NOT NULL DEFAULT '', outcome text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open', project_name text NOT NULL DEFAULT '', decided_on date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decisions_workspace_idx ON decisions (workspace_id);

CREATE TABLE IF NOT EXISTS rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL, cadence text NOT NULL DEFAULT 'daily', note text NOT NULL DEFAULT '', streak integer NOT NULL DEFAULT 0, best_streak integer NOT NULL DEFAULT 0, last_completed_on date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rituals_workspace_idx ON rituals (workspace_id);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, minutes integer NOT NULL DEFAULT 25, project_name text NOT NULL DEFAULT '', mood text NOT NULL DEFAULT 'calm', note text NOT NULL DEFAULT '', completed_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS focus_sessions_workspace_idx ON focus_sessions (workspace_id);
