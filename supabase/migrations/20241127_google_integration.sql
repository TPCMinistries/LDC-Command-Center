-- Google Integration Tables
-- This migration adds support for Google Calendar, Gmail, and other Google services

-- Integrations table to store OAuth tokens
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'microsoft', etc.
  provider_user_id TEXT, -- External user ID from provider
  provider_email TEXT, -- Email from provider
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[], -- Array of authorized scopes
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, provider)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations
CREATE POLICY "Users can view own integrations"
  ON public.integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON public.integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON public.integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON public.integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_integrations_user_workspace ON public.integrations(user_id, workspace_id);
CREATE INDEX idx_integrations_provider ON public.integrations(provider);

-- Calendar events cache table (optional - for offline access)
CREATE TABLE IF NOT EXISTS public.calendar_events_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- Google Calendar event ID
  title TEXT,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  attendees JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, external_id)
);

-- Enable RLS
ALTER TABLE public.calendar_events_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar events cache
CREATE POLICY "Users can view own calendar events"
  ON public.calendar_events_cache FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.integrations
    WHERE integrations.id = calendar_events_cache.integration_id
    AND integrations.user_id = auth.uid()
  ));

CREATE POLICY "System can manage calendar events"
  ON public.calendar_events_cache FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.integrations
    WHERE integrations.id = calendar_events_cache.integration_id
    AND integrations.user_id = auth.uid()
  ));

-- Index for calendar events
CREATE INDEX idx_calendar_events_time ON public.calendar_events_cache(start_time, end_time);
CREATE INDEX idx_calendar_events_workspace ON public.calendar_events_cache(workspace_id);

-- Email threads cache table (optional - for offline access)
CREATE TABLE IF NOT EXISTS public.email_threads_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL, -- Gmail thread ID
  subject TEXT,
  snippet TEXT,
  from_email TEXT,
  from_name TEXT,
  date TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT TRUE,
  labels TEXT[],
  message_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, thread_id)
);

-- Enable RLS
ALTER TABLE public.email_threads_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email threads cache
CREATE POLICY "Users can view own email threads"
  ON public.email_threads_cache FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.integrations
    WHERE integrations.id = email_threads_cache.integration_id
    AND integrations.user_id = auth.uid()
  ));

CREATE POLICY "System can manage email threads"
  ON public.email_threads_cache FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.integrations
    WHERE integrations.id = email_threads_cache.integration_id
    AND integrations.user_id = auth.uid()
  ));

-- Index for email threads
CREATE INDEX idx_email_threads_date ON public.email_threads_cache(date DESC);
CREATE INDEX idx_email_threads_workspace ON public.email_threads_cache(workspace_id);
