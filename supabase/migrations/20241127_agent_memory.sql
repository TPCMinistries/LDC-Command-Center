-- Agent Memory & Suggestions Schema
-- Enables persistent memory across conversations and proactive AI suggestions

-- Conversation History: Stores all agent conversations
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  agent_type TEXT NOT NULL, -- chief_of_staff, research, outreach, etc.
  session_id UUID NOT NULL, -- Groups messages in a conversation session
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Action taken, tokens used, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory Summaries: AI-generated summaries of past conversations for quick context
CREATE TABLE IF NOT EXISTS memory_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  summary TEXT NOT NULL, -- AI-generated summary of recent conversations
  key_topics TEXT[], -- Main topics discussed
  key_decisions TEXT[], -- Important decisions made
  action_items TEXT[], -- Things mentioned to follow up on
  time_period_start TIMESTAMPTZ NOT NULL,
  time_period_end TIMESTAMPTZ NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Suggestions: Proactive suggestions from AI based on activity
CREATE TABLE IF NOT EXISTS agent_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  suggestion_type TEXT NOT NULL, -- opportunity, reminder, insight, warning, recommendation
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  trigger_reason TEXT, -- What triggered this suggestion
  related_entity_type TEXT, -- task, rfp, proposal, contact, etc.
  related_entity_id UUID,
  action_type TEXT, -- Optional: what action to take
  action_params JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new', -- new, seen, acted, dismissed
  seen_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Some suggestions are time-sensitive
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences: Per-user settings including context mode
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = global preference
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, preference_key)
);

-- Agent Context Settings: Per-workspace context mode settings
CREATE TABLE IF NOT EXISTS agent_context_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  context_mode TEXT NOT NULL DEFAULT 'full', -- full, focused, minimal
  include_cross_workspace BOOLEAN DEFAULT true,
  include_conversation_history BOOLEAN DEFAULT true,
  include_suggestions BOOLEAN DEFAULT true,
  max_history_messages INTEGER DEFAULT 50,
  max_history_days INTEGER DEFAULT 30,
  excluded_workspaces UUID[], -- Workspaces to exclude from cross-workspace context
  custom_instructions TEXT, -- Additional instructions for agents in this workspace
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Activity Log: Track user activity for suggestion generation
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL, -- page_view, task_created, rfp_viewed, proposal_edited, etc.
  entity_type TEXT, -- task, rfp, proposal, contact, etc.
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_history_workspace ON conversation_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_session ON conversation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_agent ON conversation_history(workspace_id, agent_type);
CREATE INDEX IF NOT EXISTS idx_conversation_history_recent ON conversation_history(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_summaries_workspace ON memory_summaries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_agent ON memory_summaries(workspace_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_suggestions_workspace ON agent_suggestions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_status ON agent_suggestions(workspace_id, status) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_priority ON agent_suggestions(workspace_id, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_workspace ON user_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_recent ON user_activity_log(workspace_id, created_at DESC);

-- RLS Policies
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_context_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Conversation history policies
CREATE POLICY "Users can view their workspace conversations" ON conversation_history
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert conversations" ON conversation_history
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Memory summaries policies
CREATE POLICY "Users can view their workspace memory" ON memory_summaries
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Suggestions policies
CREATE POLICY "Users can view their workspace suggestions" ON agent_suggestions
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Preferences policies
CREATE POLICY "Users can manage their preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid());

-- Context settings policies
CREATE POLICY "Users can view their workspace context settings" ON agent_context_settings
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Activity log policies
CREATE POLICY "Users can view their workspace activity" ON user_activity_log
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can log activity" ON user_activity_log
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );
