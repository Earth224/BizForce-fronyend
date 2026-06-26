-- ai_tasks table for agent task queue and history
CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL DEFAULT 'general',
  task_type TEXT NOT NULL DEFAULT 'general',
  prompt TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_tasks_user_id_idx ON ai_tasks(user_id);
CREATE INDEX IF NOT EXISTS ai_tasks_agent_type_idx ON ai_tasks(agent_type);
CREATE INDEX IF NOT EXISTS ai_tasks_status_idx ON ai_tasks(status);

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage own tasks"
  ON ai_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
