-- Agent Autonomy Schema
-- Enables agents to take actions, store drafts, save research, and run scheduled jobs

-- Agent Drafts: Content created by agents pending user review
CREATE TABLE IF NOT EXISTS agent_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  draft_type TEXT NOT NULL, -- email, social_post, proposal_section, calendar_block, report
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, approved, rejected, scheduled
  agent_type TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Research: Findings from research agents
CREATE TABLE IF NOT EXISTS agent_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  finding_type TEXT NOT NULL, -- grant_opportunity, funder_intel, market_insight, competitor, news
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  relevance_score DECIMAL(3,2), -- 0.00 to 1.00
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new', -- new, reviewed, actionable, archived
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Jobs: Scheduled/recurring agent tasks
CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- morning_briefing, weekly_review, grant_scan, relationship_check, deadline_monitor
  agent_type TEXT NOT NULL, -- chief_of_staff, research, outreach, etc.
  schedule TEXT NOT NULL, -- cron expression or 'daily', 'weekly', 'hourly'
  config JSONB DEFAULT '{}', -- job-specific configuration
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_status TEXT, -- success, failed, skipped
  last_run_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Job Runs: History of job executions
CREATE TABLE IF NOT EXISTS agent_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running, success, failed, cancelled
  actions_taken JSONB DEFAULT '[]', -- List of actions the agent took
  summary TEXT, -- Human-readable summary of what happened
  tokens_used INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Contact Interactions: Track relationship touchpoints
CREATE TABLE IF NOT EXISTS contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- email, call, meeting, note, social
  summary TEXT,
  sentiment TEXT DEFAULT 'neutral', -- positive, neutral, negative
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_date DATE,
  logged_by TEXT NOT NULL, -- user_id or 'agent'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table (if not exists)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, alert, opportunity, agent_alert
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add relationship health fields to contacts if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'relationship_health') THEN
    ALTER TABLE contacts ADD COLUMN relationship_health TEXT DEFAULT 'warm';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'last_health_check') THEN
    ALTER TABLE contacts ADD COLUMN last_health_check TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'health_notes') THEN
    ALTER TABLE contacts ADD COLUMN health_notes TEXT;
  END IF;
END $$;

-- Add source field to tasks if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'source') THEN
    ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'user';
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_drafts_workspace ON agent_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_drafts_status ON agent_drafts(status);
CREATE INDEX IF NOT EXISTS idx_agent_research_workspace ON agent_research(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_research_status ON agent_research(status);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_workspace ON agent_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_next_run ON agent_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(workspace_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON contact_interactions(contact_id);

-- RLS Policies
ALTER TABLE agent_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies (workspace members can access their workspace data)
CREATE POLICY "Users can view their workspace drafts" ON agent_drafts
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their workspace research" ON agent_research
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their workspace jobs" ON agent_jobs
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their notifications" ON notifications
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
