export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'owner' | 'admin' | 'staff'
export type WorkspaceType = 'personal' | 'organization'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type NoteCategory = 'prophetic' | 'sermon_seed' | 'reflection' | 'prayer' | 'general'
export type NoteStatus = 'pending' | 'transcribing' | 'processing' | 'complete' | 'failed'
export type RfpStatus = 'new' | 'reviewing' | 'pursuing' | 'submitted' | 'won' | 'lost' | 'archived'
export type ApplicantStatus = 'new' | 'screening' | 'interviewing' | 'placed' | 'rejected' | 'inactive'
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
export type ContactType = 'partner' | 'donor' | 'vendor' | 'ministry_contact' | 'government' | 'media' | 'other'
export type CommunicationChannel = 'email' | 'call' | 'meeting' | 'text' | 'other'

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          type: WorkspaceType
          owner_id: string
          description: string | null
          settings: Json
          branding: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          type?: WorkspaceType
          owner_id: string
          description?: string | null
          settings?: Json
          branding?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          type?: WorkspaceType
          owner_id?: string
          description?: string | null
          settings?: Json
          branding?: Json
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: UserRole
          invited_by: string | null
          invited_at: string
          joined_at: string | null
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: UserRole
          invited_by?: string | null
          invited_at?: string
          joined_at?: string | null
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: UserRole
          invited_by?: string | null
          invited_at?: string
          joined_at?: string | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          timezone: string
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          timezone?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          timezone?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      daily_briefings: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          date: string
          scripture: Json | null
          prophetic_word: string | null
          priorities: Json | null
          calendar_summary: Json | null
          communications_summary: Json | null
          project_pulse: Json | null
          rfp_alerts: Json | null
          workforce_status: Json | null
          ministry_corner: Json | null
          closing_reflection: string | null
          raw_data: Json | null
          generation_stats: Json | null
          generated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          date: string
          scripture?: Json | null
          prophetic_word?: string | null
          priorities?: Json | null
          calendar_summary?: Json | null
          communications_summary?: Json | null
          project_pulse?: Json | null
          rfp_alerts?: Json | null
          workforce_status?: Json | null
          ministry_corner?: Json | null
          closing_reflection?: string | null
          raw_data?: Json | null
          generation_stats?: Json | null
          generated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          date?: string
          scripture?: Json | null
          prophetic_word?: string | null
          priorities?: Json | null
          calendar_summary?: Json | null
          communications_summary?: Json | null
          project_pulse?: Json | null
          rfp_alerts?: Json | null
          workforce_status?: Json | null
          ministry_corner?: Json | null
          closing_reflection?: string | null
          raw_data?: Json | null
          generation_stats?: Json | null
          generated_at?: string
        }
      }
      prophetic_notes: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          audio_url: string | null
          audio_duration_seconds: number | null
          audio_file_size_bytes: number | null
          transcript: string | null
          transcript_segments: Json | null
          title: string | null
          summary: string | null
          themes: Json
          scriptures: Json
          key_insights: Json
          category: NoteCategory | null
          expanded_to_sermon_id: string | null
          related_note_ids: Json
          status: NoteStatus
          error_message: string | null
          processing_stats: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          audio_url?: string | null
          audio_duration_seconds?: number | null
          audio_file_size_bytes?: number | null
          transcript?: string | null
          transcript_segments?: Json | null
          title?: string | null
          summary?: string | null
          themes?: Json
          scriptures?: Json
          key_insights?: Json
          category?: NoteCategory | null
          expanded_to_sermon_id?: string | null
          related_note_ids?: Json
          status?: NoteStatus
          error_message?: string | null
          processing_stats?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          audio_url?: string | null
          audio_duration_seconds?: number | null
          audio_file_size_bytes?: number | null
          transcript?: string | null
          transcript_segments?: Json | null
          title?: string | null
          summary?: string | null
          themes?: Json
          scriptures?: Json
          key_insights?: Json
          category?: NoteCategory | null
          expanded_to_sermon_id?: string | null
          related_note_ids?: Json
          status?: NoteStatus
          error_message?: string | null
          processing_stats?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      sermons: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          title: string
          series: string | null
          primary_scriptures: Json
          supporting_scriptures: Json
          central_theme: string | null
          outline: Json | null
          full_manuscript: string | null
          notes: string | null
          devotional: string | null
          discussion_questions: Json
          source_note_ids: Json
          status: string
          scheduled_date: string | null
          delivered_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          title: string
          series?: string | null
          primary_scriptures?: Json
          supporting_scriptures?: Json
          central_theme?: string | null
          outline?: Json | null
          full_manuscript?: string | null
          notes?: string | null
          devotional?: string | null
          discussion_questions?: Json
          source_note_ids?: Json
          status?: string
          scheduled_date?: string | null
          delivered_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          title?: string
          series?: string | null
          primary_scriptures?: Json
          supporting_scriptures?: Json
          central_theme?: string | null
          outline?: Json | null
          full_manuscript?: string | null
          notes?: string | null
          devotional?: string | null
          discussion_questions?: Json
          source_note_ids?: Json
          status?: string
          scheduled_date?: string | null
          delivered_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          workspace_id: string
          title: string
          description: string | null
          status: ProjectStatus
          priority: number
          owner_id: string | null
          team_member_ids: Json
          start_date: string | null
          target_end_date: string | null
          actual_end_date: string | null
          category: string | null
          tags: Json
          budget_amount: number | null
          budget_currency: string
          rfp_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          description?: string | null
          status?: ProjectStatus
          priority?: number
          owner_id?: string | null
          team_member_ids?: Json
          start_date?: string | null
          target_end_date?: string | null
          actual_end_date?: string | null
          category?: string | null
          tags?: Json
          budget_amount?: number | null
          budget_currency?: string
          rfp_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          description?: string | null
          status?: ProjectStatus
          priority?: number
          owner_id?: string | null
          team_member_ids?: Json
          start_date?: string | null
          target_end_date?: string | null
          actual_end_date?: string | null
          category?: string | null
          tags?: Json
          budget_amount?: number | null
          budget_currency?: string
          rfp_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          project_id: string | null
          title: string
          description: string | null
          status: TaskStatus
          priority: number
          assigned_to: string | null
          assigned_agent: string | null
          due_date: string | null
          completed_at: string | null
          is_recurring: boolean
          recurrence_rule: string | null
          notes: string | null
          checklist: Json
          attachments: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          project_id?: string | null
          title: string
          description?: string | null
          status?: TaskStatus
          priority?: number
          assigned_to?: string | null
          assigned_agent?: string | null
          due_date?: string | null
          completed_at?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          notes?: string | null
          checklist?: Json
          attachments?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          project_id?: string | null
          title?: string
          description?: string | null
          status?: TaskStatus
          priority?: number
          assigned_to?: string | null
          assigned_agent?: string | null
          due_date?: string | null
          completed_at?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          notes?: string | null
          checklist?: Json
          attachments?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          workspace_id: string
          full_name: string
          email: string | null
          phone: string | null
          organization: string | null
          title: string | null
          contact_type: ContactType
          tags: Json
          relationship_strength: number | null
          last_contact_date: string | null
          preferred_contact_method: string | null
          notes: string | null
          linkedin_url: string | null
          twitter_handle: string | null
          source: string | null
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          full_name: string
          email?: string | null
          phone?: string | null
          organization?: string | null
          title?: string | null
          contact_type?: ContactType
          tags?: Json
          relationship_strength?: number | null
          last_contact_date?: string | null
          preferred_contact_method?: string | null
          notes?: string | null
          linkedin_url?: string | null
          twitter_handle?: string | null
          source?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          organization?: string | null
          title?: string | null
          contact_type?: ContactType
          tags?: Json
          relationship_strength?: number | null
          last_contact_date?: string | null
          preferred_contact_method?: string | null
          notes?: string | null
          linkedin_url?: string | null
          twitter_handle?: string | null
          source?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      agents: {
        Row: {
          id: string
          workspace_id: string
          agent_type: string
          name: string
          description: string | null
          status: string
          config: Json
          prompt_template: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_type: string
          name: string
          description?: string | null
          status?: string
          config?: Json
          prompt_template?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_type?: string
          name?: string
          description?: string | null
          status?: string
          config?: Json
          prompt_template?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      agent_events: {
        Row: {
          id: string
          workspace_id: string
          source_agent: string
          target_agent: string | null
          event_type: string
          payload: Json
          status: string
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          source_agent: string
          target_agent?: string | null
          event_type: string
          payload: Json
          status?: string
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          source_agent?: string
          target_agent?: string | null
          event_type?: string
          payload?: Json
          status?: string
          processed_at?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          workspace_id: string | null
          user_id: string
          type: string
          title: string
          message: string | null
          action_url: string | null
          is_read: boolean
          read_at: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          user_id: string
          type: string
          title: string
          message?: string | null
          action_url?: string | null
          is_read?: boolean
          read_at?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          user_id?: string
          type?: string
          title?: string
          message?: string | null
          action_url?: string | null
          is_read?: boolean
          read_at?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      soul_scriptures: {
        Row: {
          id: string
          reference: string
          text: string
          book: string
          chapter: number
          verse_start: number
          verse_end: number | null
          themes: Json
          seasons: Json
          use_count: number
          last_used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reference: string
          text: string
          book: string
          chapter: number
          verse_start: number
          verse_end?: number | null
          themes?: Json
          seasons?: Json
          use_count?: number
          last_used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reference?: string
          text?: string
          book?: string
          chapter?: number
          verse_start?: number
          verse_end?: number | null
          themes?: Json
          seasons?: Json
          use_count?: number
          last_used_at?: string | null
          created_at?: string
        }
      }
      soul_patterns: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          pattern_type: string
          theme: string
          description: string | null
          source_ids: Json
          frequency: number
          first_seen_at: string
          last_seen_at: string
          is_highlighted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          pattern_type: string
          theme: string
          description?: string | null
          source_ids?: Json
          frequency?: number
          first_seen_at?: string
          last_seen_at?: string
          is_highlighted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          pattern_type?: string
          theme?: string
          description?: string | null
          source_ids?: Json
          frequency?: number
          first_seen_at?: string
          last_seen_at?: string
          is_highlighted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_has_workspace_access: {
        Args: { ws_id: string }
        Returns: boolean
      }
      get_user_workspace_role: {
        Args: { ws_id: string }
        Returns: UserRole
      }
    }
    Enums: {
      user_role: UserRole
      workspace_type: WorkspaceType
      job_status: JobStatus
      note_category: NoteCategory
      note_status: NoteStatus
      rfp_status: RfpStatus
      applicant_status: ApplicantStatus
      project_status: ProjectStatus
      task_status: TaskStatus
      contact_type: ContactType
      communication_channel: CommunicationChannel
    }
  }
}
