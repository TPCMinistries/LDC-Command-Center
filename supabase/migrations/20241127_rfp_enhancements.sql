-- RFP Enhancements Migration
-- Adds support for manual RFP entry from various sources

-- Add source_type column to rfp_items (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'rfp_items' AND column_name = 'source_type') THEN
    ALTER TABLE rfp_items ADD COLUMN source_type text DEFAULT 'sam_gov';
  END IF;
END $$;

-- Add document_url column for uploaded RFP documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'rfp_items' AND column_name = 'document_url') THEN
    ALTER TABLE rfp_items ADD COLUMN document_url text;
  END IF;
END $$;

-- Add extracted_requirements column for AI-extracted data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'rfp_items' AND column_name = 'extracted_requirements') THEN
    ALTER TABLE rfp_items ADD COLUMN extracted_requirements jsonb;
  END IF;
END $$;

-- Add custom_sections column for RFP-specific proposal sections
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'rfp_items' AND column_name = 'custom_sections') THEN
    ALTER TABLE rfp_items ADD COLUMN custom_sections jsonb;
  END IF;
END $$;

-- Create proposal_boilerplate table for reusable content
CREATE TABLE IF NOT EXISTS proposal_boilerplate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  section_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  tags text[],
  usage_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for workspace lookups
CREATE INDEX IF NOT EXISTS idx_boilerplate_workspace ON proposal_boilerplate(workspace_id);
CREATE INDEX IF NOT EXISTS idx_boilerplate_section_type ON proposal_boilerplate(section_type);

-- Enable RLS on proposal_boilerplate
ALTER TABLE proposal_boilerplate ENABLE ROW LEVEL SECURITY;

-- RLS policy for boilerplate - users can access their workspace's boilerplate
CREATE POLICY IF NOT EXISTS "Users can view workspace boilerplate"
  ON proposal_boilerplate FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can insert workspace boilerplate"
  ON proposal_boilerplate FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can update workspace boilerplate"
  ON proposal_boilerplate FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can delete workspace boilerplate"
  ON proposal_boilerplate FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Comment for documentation
COMMENT ON TABLE proposal_boilerplate IS 'Reusable content snippets for proposal sections';
COMMENT ON COLUMN rfp_items.source_type IS 'Source type: sam_gov, city_state, foundation, other';
COMMENT ON COLUMN rfp_items.document_url IS 'URL to uploaded RFP document';
COMMENT ON COLUMN rfp_items.extracted_requirements IS 'AI-extracted requirements from RFP document';
COMMENT ON COLUMN rfp_items.custom_sections IS 'RFP-specific proposal section requirements';
