CREATE TABLE schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
  id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('observe', 'draft', 'bounded_live')),
  publication_paused boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  is_staff boolean NOT NULL DEFAULT false,
  is_agent boolean NOT NULL DEFAULT false,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contributions (
  id text PRIMARY KEY,
  member_id text NOT NULL REFERENCES members (id),
  kind text NOT NULL CHECK (kind IN ('post', 'comment', 'reaction')),
  thread_ref text,
  body text,
  occurred_at timestamptz NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contributions_occurred_idx ON contributions (occurred_at);
CREATE INDEX contributions_member_idx ON contributions (member_id);

CREATE TABLE knowledge_facts (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  statement text NOT NULL,
  status text NOT NULL CHECK (status IN ('verified', 'unverified', 'retired')),
  category text NOT NULL,
  effective_from date,
  effective_until date,
  source_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calendar_items (
  id text PRIMARY KEY,
  pillar text NOT NULL,
  scheduled_on date NOT NULL,
  title text NOT NULL,
  body_draft text NOT NULL,
  voice text NOT NULL CHECK (voice IN ('assistant', 'founder_draft')),
  status text NOT NULL,
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE follow_ups (
  id text PRIMARY KEY,
  title text NOT NULL,
  member_display_name text NOT NULL,
  question_text text NOT NULL,
  state text NOT NULL,
  owner_label text,
  due_at timestamptz,
  handoff_confirmed_at timestamptz,
  handoff_note text,
  outcome text,
  sensitivity text NOT NULL DEFAULT 'ordinary',
  kind text NOT NULL DEFAULT 'question',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX follow_ups_state_idx ON follow_ups (state);

CREATE TABLE tasks (
  id text PRIMARY KEY,
  follow_up_id text NOT NULL REFERENCES follow_ups (id),
  title text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE drafts (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('reply', 'post')),
  follow_up_id text REFERENCES follow_ups (id),
  calendar_item_id text REFERENCES calendar_items (id),
  body text NOT NULL,
  voice text NOT NULL CHECK (voice IN ('assistant', 'founder_draft')),
  intent text NOT NULL,
  status text NOT NULL,
  gate_pass boolean NOT NULL,
  gate_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  author text NOT NULL,
  cole_personalized boolean NOT NULL DEFAULT false,
  grok_run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE publications (
  id text PRIMARY KEY,
  draft_id text NOT NULL REFERENCES drafts (id),
  channel text NOT NULL CHECK (channel IN ('human_assisted', 'buffer_notification')),
  status text NOT NULL,
  buffer_post_id text,
  permalink text,
  attestation jsonb,
  evidence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_notes (
  id text PRIMARY KEY,
  week_key text NOT NULL,
  observation text NOT NULL,
  decision text,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE action_log (
  id text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE jobs (
  id text PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX jobs_ready_idx ON jobs (status, run_at);

CREATE TABLE capabilities (
  key text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('supported', 'unsupported', 'needs_setup', 'degraded')),
  summary text NOT NULL,
  evidence jsonb NOT NULL,
  checked_at timestamptz NOT NULL
);

CREATE TABLE grok_runs (
  id text PRIMARY KEY,
  purpose text NOT NULL,
  model text,
  status text NOT NULL,
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reply_events (
  id text PRIMARY KEY,
  draft_id text NOT NULL,
  body_hash text NOT NULL,
  body_normalized text NOT NULL,
  intent text NOT NULL,
  occurred_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE metric_snapshots (
  id text PRIMARY KEY,
  week_start date NOT NULL,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE demo_runs (
  id text PRIMARY KEY,
  branch text NOT NULL,
  trace jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
