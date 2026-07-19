export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_config: {
        Row: {
          id: number
          paypal_handle: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          paypal_handle?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          paypal_handle?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_label: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_label?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_label?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          approved_at: string | null
          asset_type: string
          automation_notes: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          priority: string
          proposed_by: string
          purpose: string | null
          revenue_model: string | null
          scorecard: Json
          source_id: string | null
          source_type: string | null
          status: string
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          asset_type: string
          automation_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: string
          proposed_by?: string
          purpose?: string | null
          revenue_model?: string | null
          scorecard?: Json
          source_id?: string | null
          source_type?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          asset_type?: string
          automation_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: string
          proposed_by?: string
          purpose?: string | null
          revenue_model?: string | null
          scorecard?: Json
          source_id?: string | null
          source_type?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          executive: Database["public"]["Enums"]["executive_id"] | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          executive?: Database["public"]["Enums"]["executive_id"] | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          executive?: Database["public"]["Enums"]["executive_id"] | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      calibration_settings: {
        Row: {
          accuracy_weight: number
          created_at: string
          effort_underestimation_weight: number
          risk_underrating_weight: number
          roi_overshoot_weight: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_weight?: number
          created_at?: string
          effort_underestimation_weight?: number
          risk_underrating_weight?: number
          roi_overshoot_weight?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_weight?: number
          created_at?: string
          effort_underestimation_weight?: number
          risk_underrating_weight?: number
          roi_overshoot_weight?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      committee_outcomes: {
        Row: {
          actual_effort_hours: number | null
          actual_risk: number | null
          actual_roi_pct: number | null
          created_at: string
          id: string
          notes: string | null
          outcome: string
          predicted_effort_hours: number | null
          predicted_risk: number | null
          predicted_roi_pct: number | null
          recorded_at: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_effort_hours?: number | null
          actual_risk?: number | null
          actual_roi_pct?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          outcome: string
          predicted_effort_hours?: number | null
          predicted_risk?: number | null
          predicted_roi_pct?: number | null
          recorded_at?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_effort_hours?: number | null
          actual_risk?: number | null
          actual_roi_pct?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string
          predicted_effort_hours?: number | null
          predicted_risk?: number | null
          predicted_roi_pct?: number | null
          recorded_at?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_outcomes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "committee_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_positions: {
        Row: {
          confidence: number | null
          created_at: string
          executive: string
          id: string
          is_streaming: boolean
          key_concern: string | null
          rationale: string | null
          recommendation: string | null
          review_id: string
          scores: Json
          speaking_order: number
          stance: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          executive: string
          id?: string
          is_streaming?: boolean
          key_concern?: string | null
          rationale?: string | null
          recommendation?: string | null
          review_id: string
          scores?: Json
          speaking_order?: number
          stance?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          executive?: string
          id?: string
          is_streaming?: boolean
          key_concern?: string | null
          rationale?: string | null
          recommendation?: string | null
          review_id?: string
          scores?: Json
          speaking_order?: number
          stance?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_positions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "committee_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_reviews: {
        Row: {
          alignment_score: number | null
          conditions: Json
          confidence_score: number | null
          context: Json
          created_at: string
          current_speaker: string | null
          decided_at: string | null
          decision: string | null
          decision_rationale: string | null
          error: string | null
          execution_score: number | null
          id: string
          memory_refs: Json
          operational_score: number | null
          phase: string
          risk_score: number | null
          strategic_score: number | null
          subject_id: string | null
          subject_type: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alignment_score?: number | null
          conditions?: Json
          confidence_score?: number | null
          context?: Json
          created_at?: string
          current_speaker?: string | null
          decided_at?: string | null
          decision?: string | null
          decision_rationale?: string | null
          error?: string | null
          execution_score?: number | null
          id?: string
          memory_refs?: Json
          operational_score?: number | null
          phase?: string
          risk_score?: number | null
          strategic_score?: number | null
          subject_id?: string | null
          subject_type: string
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alignment_score?: number | null
          conditions?: Json
          confidence_score?: number | null
          context?: Json
          created_at?: string
          current_speaker?: string | null
          decided_at?: string | null
          decision?: string | null
          decision_rationale?: string | null
          error?: string | null
          execution_score?: number | null
          id?: string
          memory_refs?: Json
          operational_score?: number | null
          phase?: string
          risk_score?: number | null
          strategic_score?: number | null
          subject_id?: string | null
          subject_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compounding_goals: {
        Row: {
          autonomy_threshold_usd: number
          created_at: string
          current_capital: number
          id: string
          notes: string | null
          risk_tolerance: number
          starting_capital: number
          status: Database["public"]["Enums"]["goal_status"]
          target_capital: number
          timeframe_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          autonomy_threshold_usd?: number
          created_at?: string
          current_capital?: number
          id?: string
          notes?: string | null
          risk_tolerance?: number
          starting_capital: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_capital: number
          timeframe_days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          autonomy_threshold_usd?: number
          created_at?: string
          current_capital?: number
          id?: string
          notes?: string | null
          risk_tolerance?: number
          starting_capital?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_capital?: number
          timeframe_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      council_sessions: {
        Row: {
          apex_analysis: string | null
          created_at: string
          final_recommendation: string | null
          id: string
          iris_analysis: string | null
          katana_analysis: string | null
          mission_id: string | null
          operator_request: string
          sentinel_analysis: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apex_analysis?: string | null
          created_at?: string
          final_recommendation?: string | null
          id?: string
          iris_analysis?: string | null
          katana_analysis?: string | null
          mission_id?: string | null
          operator_request: string
          sentinel_analysis?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apex_analysis?: string | null
          created_at?: string
          final_recommendation?: string | null
          id?: string
          iris_analysis?: string | null
          katana_analysis?: string | null
          mission_id?: string | null
          operator_request?: string
          sentinel_analysis?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_action_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      executive_handoffs: {
        Row: {
          context: Json
          created_at: string
          depth: number
          expires_at: string
          from_executive: string
          id: string
          mission_id: string | null
          outcome: Json | null
          parent_handoff_id: string | null
          priority: string
          purpose: string
          required_response: string
          responded_at: string | null
          status: string
          task_id: string | null
          to_executive: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          depth?: number
          expires_at?: string
          from_executive: string
          id?: string
          mission_id?: string | null
          outcome?: Json | null
          parent_handoff_id?: string | null
          priority?: string
          purpose: string
          required_response?: string
          responded_at?: string | null
          status?: string
          task_id?: string | null
          to_executive: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          depth?: number
          expires_at?: string
          from_executive?: string
          id?: string
          mission_id?: string | null
          outcome?: Json | null
          parent_handoff_id?: string | null
          priority?: string
          purpose?: string
          required_response?: string
          responded_at?: string | null
          status?: string
          task_id?: string | null
          to_executive?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_handoffs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_handoffs_parent_handoff_id_fkey"
            columns: ["parent_handoff_id"]
            isOneToOne: false
            referencedRelation: "executive_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_handoffs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "katana_agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_journal: {
        Row: {
          content: string
          created_at: string
          executive: string
          id: string
          kind: string
          mission_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          executive: string
          id?: string
          kind: string
          mission_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          executive?: string
          id?: string
          kind?: string
          mission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_journal_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "executive_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_observations: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          dismissed_at: string | null
          evidence: Json
          executive: string
          hash: string
          headline: string
          id: string
          kind: string
          reasoning: string | null
          recommended_action: string | null
          score: number
          shown_at: string | null
          trigger: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          evidence?: Json
          executive: string
          hash: string
          headline: string
          id?: string
          kind: string
          reasoning?: string | null
          recommended_action?: string | null
          score?: number
          shown_at?: string | null
          trigger?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          evidence?: Json
          executive?: string
          hash?: string
          headline?: string
          id?: string
          kind?: string
          reasoning?: string | null
          recommended_action?: string | null
          score?: number
          shown_at?: string | null
          trigger?: string | null
          user_id?: string
        }
        Relationships: []
      }
      executive_state: {
        Row: {
          active_mission_id: string | null
          created_at: string
          current_focus: string | null
          executive_id: string
          id: string
          last_interaction_at: string | null
          memory_pointer_ids: Json
          metadata: Json
          mood: string
          presence: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_mission_id?: string | null
          created_at?: string
          current_focus?: string | null
          executive_id: string
          id?: string
          last_interaction_at?: string | null
          memory_pointer_ids?: Json
          metadata?: Json
          mood?: string
          presence?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_mission_id?: string | null
          created_at?: string
          current_focus?: string | null
          executive_id?: string
          id?: string
          last_interaction_at?: string | null
          memory_pointer_ids?: Json
          metadata?: Json
          mood?: string
          presence?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      executive_threads: {
        Row: {
          created_at: string
          executive: Database["public"]["Enums"]["executive_id"]
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executive: Database["public"]["Enums"]["executive_id"]
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          executive?: Database["public"]["Enums"]["executive_id"]
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founding_vip_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      founding_vip_config: {
        Row: {
          closed: boolean
          granted_count: number
          id: number
          max_positions: number
          paused: boolean
          updated_at: string
        }
        Insert: {
          closed?: boolean
          granted_count?: number
          id?: number
          max_positions?: number
          paused?: boolean
          updated_at?: string
        }
        Update: {
          closed?: boolean
          granted_count?: number
          id?: number
          max_positions?: number
          paused?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token_ciphertext: string | null
          access_token_expires_at: string | null
          account_email: string | null
          account_name: string | null
          created_at: string
          google_sub: string
          id: string
          last_refreshed_at: string | null
          refresh_token_ciphertext: string | null
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          account_name?: string | null
          created_at?: string
          google_sub: string
          id?: string
          last_refreshed_at?: string | null
          refresh_token_ciphertext?: string | null
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          account_name?: string | null
          created_at?: string
          google_sub?: string
          id?: string
          last_refreshed_at?: string | null
          refresh_token_ciphertext?: string | null
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_drive_folders: {
        Row: {
          access_mode: string
          created_at: string
          file_count: number
          folder_id: string
          folder_name: string
          folder_path: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_mode?: string
          created_at?: string
          file_count?: number
          folder_id: string
          folder_name: string
          folder_path?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_mode?: string
          created_at?: string
          file_count?: number
          folder_id?: string
          folder_name?: string
          folder_path?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_rate_limits: {
        Row: {
          bucket_key: string
          count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      google_oauth_states: {
        Row: {
          code_verifier: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          ip_hash: string | null
          nonce: string
          redirect_target: string | null
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          ip_hash?: string | null
          nonce: string
          redirect_target?: string | null
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          ip_hash?: string | null
          nonce?: string
          redirect_target?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      google_selected_folders: {
        Row: {
          created_at: string
          drive_id: string | null
          file_count: number
          folder_id: string
          folder_name: string
          id: string
          is_shared_drive: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drive_id?: string | null
          file_count?: number
          folder_id: string
          folder_name: string
          id?: string
          is_shared_drive?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drive_id?: string | null
          file_count?: number
          folder_id?: string
          folder_name?: string
          id?: string
          is_shared_drive?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      income_opportunities: {
        Row: {
          actual_return_usd: number | null
          capital_required: number
          channel: Database["public"]["Enums"]["income_channel"]
          committee_review_id: string | null
          confidence: number
          created_at: string
          effort_score: number
          evidence: string | null
          goal_id: string | null
          id: string
          kill_reason: string | null
          playbook: Json
          projected_return_usd: number
          projected_roi_pct: number
          risk_score: number
          staged_by_exec: string
          status: Database["public"]["Enums"]["opportunity_status"]
          thesis: string
          timeframe_days: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_return_usd?: number | null
          capital_required: number
          channel: Database["public"]["Enums"]["income_channel"]
          committee_review_id?: string | null
          confidence?: number
          created_at?: string
          effort_score: number
          evidence?: string | null
          goal_id?: string | null
          id?: string
          kill_reason?: string | null
          playbook?: Json
          projected_return_usd?: number
          projected_roi_pct?: number
          risk_score: number
          staged_by_exec?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          thesis: string
          timeframe_days: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_return_usd?: number | null
          capital_required?: number
          channel?: Database["public"]["Enums"]["income_channel"]
          committee_review_id?: string | null
          confidence?: number
          created_at?: string
          effort_score?: number
          evidence?: string | null
          goal_id?: string | null
          id?: string
          kill_reason?: string | null
          playbook?: Json
          projected_return_usd?: number
          projected_roi_pct?: number
          risk_score?: number
          staged_by_exec?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          thesis?: string
          timeframe_days?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_opportunities_committee_review_id_fkey"
            columns: ["committee_review_id"]
            isOneToOne: false
            referencedRelation: "committee_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_opportunities_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "compounding_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          is_seed: boolean | null
          source_filename: string | null
          title: string
          user_id: string
          version: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_seed?: boolean | null
          source_filename?: string | null
          title: string
          user_id: string
          version?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_seed?: boolean | null
          source_filename?: string | null
          title?: string
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      internal_email_domains: {
        Row: {
          created_at: string
          domain: string
          note: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          note?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          note?: string | null
        }
        Relationships: []
      }
      katana_agent_tasks: {
        Row: {
          accuracy_score: number | null
          actual_cost_cents: number
          agent: string
          attempt_count: number
          completed_at: string | null
          confidence_score: number | null
          created_at: string
          depends_on: string[]
          error: string | null
          estimated_cost_cents: number
          estimated_time_ms: number | null
          execution_history: Json
          id: string
          idempotency_key: string | null
          input: Json
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          mission_id: string | null
          next_retry_at: string | null
          opportunity_id: string | null
          output: Json | null
          previous_status: string | null
          reason: string | null
          requires_approval: boolean
          risk_level: string
          started_at: string | null
          status: string
          task_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          actual_cost_cents?: number
          agent: string
          attempt_count?: number
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          depends_on?: string[]
          error?: string | null
          estimated_cost_cents?: number
          estimated_time_ms?: number | null
          execution_history?: Json
          id?: string
          idempotency_key?: string | null
          input?: Json
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          mission_id?: string | null
          next_retry_at?: string | null
          opportunity_id?: string | null
          output?: Json | null
          previous_status?: string | null
          reason?: string | null
          requires_approval?: boolean
          risk_level?: string
          started_at?: string | null
          status?: string
          task_kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          actual_cost_cents?: number
          agent?: string
          attempt_count?: number
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          depends_on?: string[]
          error?: string | null
          estimated_cost_cents?: number
          estimated_time_ms?: number | null
          execution_history?: Json
          id?: string
          idempotency_key?: string | null
          input?: Json
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          mission_id?: string | null
          next_retry_at?: string | null
          opportunity_id?: string | null
          output?: Json | null
          previous_status?: string | null
          reason?: string | null
          requires_approval?: boolean
          risk_level?: string
          started_at?: string | null
          status?: string
          task_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "katana_agent_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "katana_agent_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "katana_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_asset_derivatives: {
        Row: {
          content: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          mission_id: string | null
          parent_asset_ids: string[]
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          mission_id?: string | null
          parent_asset_ids?: string[]
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          mission_id?: string | null
          parent_asset_ids?: string[]
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      katana_asset_sources: {
        Row: {
          account_label: string | null
          connected_at: string | null
          created_at: string
          id: string
          metadata: Json
          provider: string
          revoked_at: string | null
          root_path: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_label?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          provider: string
          revoked_at?: string | null
          root_path?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_label?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string
          revoked_at?: string | null
          root_path?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      katana_assets: {
        Row: {
          authorized: boolean
          business_category: string[]
          categories: string[]
          content_hash: string | null
          created_at: string
          evaluated_at: string | null
          execution_category: string[]
          extracted_text: string | null
          hash: string | null
          id: string
          kind: string
          last_scanned_at: string | null
          metadata: Json
          mime: string | null
          mime_family: string | null
          opportunity_score: number | null
          parent_asset_id: string | null
          priority_band: string | null
          size_bytes: number | null
          source: string
          source_provider: string | null
          source_ref: string
          source_uri: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          authorized?: boolean
          business_category?: string[]
          categories?: string[]
          content_hash?: string | null
          created_at?: string
          evaluated_at?: string | null
          execution_category?: string[]
          extracted_text?: string | null
          hash?: string | null
          id?: string
          kind: string
          last_scanned_at?: string | null
          metadata?: Json
          mime?: string | null
          mime_family?: string | null
          opportunity_score?: number | null
          parent_asset_id?: string | null
          priority_band?: string | null
          size_bytes?: number | null
          source: string
          source_provider?: string | null
          source_ref: string
          source_uri?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          authorized?: boolean
          business_category?: string[]
          categories?: string[]
          content_hash?: string | null
          created_at?: string
          evaluated_at?: string | null
          execution_category?: string[]
          extracted_text?: string | null
          hash?: string | null
          id?: string
          kind?: string
          last_scanned_at?: string | null
          metadata?: Json
          mime?: string | null
          mime_family?: string | null
          opportunity_score?: number | null
          parent_asset_id?: string | null
          priority_band?: string | null
          size_bytes?: number | null
          source?: string
          source_provider?: string | null
          source_ref?: string
          source_uri?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "katana_assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "katana_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_cost_ledger: {
        Row: {
          actual_cents: number
          created_at: string
          currency: string
          estimated_cents: number
          id: string
          kind: string
          metadata: Json
          mission_id: string | null
          provider: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          actual_cents?: number
          created_at?: string
          currency?: string
          estimated_cents?: number
          id?: string
          kind: string
          metadata?: Json
          mission_id?: string | null
          provider?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          actual_cents?: number
          created_at?: string
          currency?: string
          estimated_cents?: number
          id?: string
          kind?: string
          metadata?: Json
          mission_id?: string | null
          provider?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "katana_cost_ledger_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "katana_cost_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "katana_agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_intervention_queue: {
        Row: {
          created_at: string
          estimated_cost_cents: number
          id: string
          kind: string
          mission_id: string | null
          options: Json
          reason: string
          recommended_action: string | null
          resolution: Json | null
          risk_level: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_cents?: number
          id?: string
          kind: string
          mission_id?: string | null
          options?: Json
          reason: string
          recommended_action?: string | null
          resolution?: Json | null
          risk_level?: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_cents?: number
          id?: string
          kind?: string
          mission_id?: string | null
          options?: Json
          reason?: string
          recommended_action?: string | null
          resolution?: Json | null
          risk_level?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "katana_intervention_queue_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "katana_intervention_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "katana_agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_learnings: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          key: string
          kind: string
          last_validated_at: string | null
          source_mission_id: string | null
          state: string
          updated_at: string
          user_id: string
          value: Json
          weight: number
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          key: string
          kind: string
          last_validated_at?: string | null
          source_mission_id?: string | null
          state?: string
          updated_at?: string
          user_id: string
          value?: Json
          weight?: number
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          key?: string
          kind?: string
          last_validated_at?: string | null
          source_mission_id?: string | null
          state?: string
          updated_at?: string
          user_id?: string
          value?: Json
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "katana_learnings_source_mission_id_fkey"
            columns: ["source_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_opportunities: {
        Row: {
          automation_readiness: string | null
          automation_ready: boolean | null
          business_category: string | null
          category: string
          complexity: string | null
          confidence: number | null
          created_at: string
          deliverables: Json | null
          effort_band: string
          estimated_roi: number | null
          estimated_time_minutes: number | null
          estimated_value_band: string
          estimated_value_cents: number | null
          four_questions: Json
          id: string
          mission_id: string | null
          opportunity_type: string | null
          priority_rank: number | null
          rationale: string
          recommended_mission: Json
          required_agents: string[] | null
          revenue_category: string | null
          source_asset_ids: string[]
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_readiness?: string | null
          automation_ready?: boolean | null
          business_category?: string | null
          category: string
          complexity?: string | null
          confidence?: number | null
          created_at?: string
          deliverables?: Json | null
          effort_band?: string
          estimated_roi?: number | null
          estimated_time_minutes?: number | null
          estimated_value_band?: string
          estimated_value_cents?: number | null
          four_questions?: Json
          id?: string
          mission_id?: string | null
          opportunity_type?: string | null
          priority_rank?: number | null
          rationale: string
          recommended_mission?: Json
          required_agents?: string[] | null
          revenue_category?: string | null
          source_asset_ids?: string[]
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_readiness?: string | null
          automation_ready?: boolean | null
          business_category?: string | null
          category?: string
          complexity?: string | null
          confidence?: number | null
          created_at?: string
          deliverables?: Json | null
          effort_band?: string
          estimated_roi?: number | null
          estimated_time_minutes?: number | null
          estimated_value_band?: string
          estimated_value_cents?: number | null
          four_questions?: Json
          id?: string
          mission_id?: string | null
          opportunity_type?: string | null
          priority_rank?: number | null
          rationale?: string
          recommended_mission?: Json
          required_agents?: string[] | null
          revenue_category?: string | null
          source_asset_ids?: string[]
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      katana_scan_log: {
        Row: {
          created_at: string
          duration_ms: number
          files_authorized: number
          files_seen: number
          files_skipped: number
          id: string
          metadata: Json
          notes: string | null
          provider: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          files_authorized?: number
          files_seen?: number
          files_skipped?: number
          id?: string
          metadata?: Json
          notes?: string | null
          provider: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          files_authorized?: number
          files_seen?: number
          files_skipped?: number
          id?: string
          metadata?: Json
          notes?: string | null
          provider?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "katana_scan_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "katana_asset_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_security_events: {
        Row: {
          action: string
          created_at: string
          decision: string
          id: string
          metadata: Json
          mission_id: string | null
          rationale: string | null
          risk_level: string
          severity: string
          stage: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          decision: string
          id?: string
          metadata?: Json
          mission_id?: string | null
          rationale?: string | null
          risk_level?: string
          severity?: string
          stage: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          mission_id?: string | null
          rationale?: string | null
          risk_level?: string
          severity?: string
          stage?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "katana_security_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "katana_security_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "katana_agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      katana_trusted_workflows: {
        Row: {
          created_at: string
          id: string
          scope: Json
          user_id: string
          workflow_signature: string
        }
        Insert: {
          created_at?: string
          id?: string
          scope?: Json
          user_id: string
          workflow_signature: string
        }
        Update: {
          created_at?: string
          id?: string
          scope?: Json
          user_id?: string
          workflow_signature?: string
        }
        Relationships: []
      }
      katana_workflow_versions: {
        Row: {
          allowed_actions: string[]
          approved_destinations: string[]
          approved_services: string[]
          cost_ceiling_cents: number
          created_at: string
          id: string
          last_tested_at: string | null
          policy: Json
          prohibited_actions: string[]
          publishing_allowed: boolean
          required_checkpoints: string[]
          status: string
          success_rate: number | null
          time_window_minutes: number | null
          updated_at: string
          user_id: string
          version: number
          workflow_key: string
        }
        Insert: {
          allowed_actions?: string[]
          approved_destinations?: string[]
          approved_services?: string[]
          cost_ceiling_cents?: number
          created_at?: string
          id?: string
          last_tested_at?: string | null
          policy?: Json
          prohibited_actions?: string[]
          publishing_allowed?: boolean
          required_checkpoints?: string[]
          status?: string
          success_rate?: number | null
          time_window_minutes?: number | null
          updated_at?: string
          user_id: string
          version?: number
          workflow_key: string
        }
        Update: {
          allowed_actions?: string[]
          approved_destinations?: string[]
          approved_services?: string[]
          cost_ceiling_cents?: number
          created_at?: string
          id?: string
          last_tested_at?: string | null
          policy?: Json
          prohibited_actions?: string[]
          publishing_allowed?: boolean
          required_checkpoints?: string[]
          status?: string
          success_rate?: number | null
          time_window_minutes?: number | null
          updated_at?: string
          user_id?: string
          version?: number
          workflow_key?: string
        }
        Relationships: []
      }
      knowledge_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          source: string
          target_ref: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          source: string
          target_ref?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          target_ref?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      knowledge_settings: {
        Row: {
          auto_sync_enabled: boolean
          auto_sync_interval_minutes: number
          id: number
          multi_user_drive_enabled: boolean
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          auto_sync_interval_minutes?: number
          id: number
          multi_user_drive_enabled?: boolean
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean
          auto_sync_interval_minutes?: number
          id?: number
          multi_user_drive_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      learned_patterns: {
        Row: {
          applied_count: number
          confidence: number
          created_at: string
          detail: Json
          evidence_event_ids: string[]
          executive_id: string | null
          failure_count: number
          id: string
          last_applied_at: string | null
          last_observed_at: string
          pattern_type: string
          sensitivity: string
          status: string
          subject_key: string
          success_count: number
          summary: string
          supersedes: string | null
          updated_at: string
          usefulness: number
          user_id: string
          version: number
        }
        Insert: {
          applied_count?: number
          confidence?: number
          created_at?: string
          detail?: Json
          evidence_event_ids?: string[]
          executive_id?: string | null
          failure_count?: number
          id?: string
          last_applied_at?: string | null
          last_observed_at?: string
          pattern_type: string
          sensitivity?: string
          status?: string
          subject_key: string
          success_count?: number
          summary: string
          supersedes?: string | null
          updated_at?: string
          usefulness?: number
          user_id: string
          version?: number
        }
        Update: {
          applied_count?: number
          confidence?: number
          created_at?: string
          detail?: Json
          evidence_event_ids?: string[]
          executive_id?: string | null
          failure_count?: number
          id?: string
          last_applied_at?: string | null
          last_observed_at?: string
          pattern_type?: string
          sensitivity?: string
          status?: string
          subject_key?: string
          success_count?: number
          summary?: string
          supersedes?: string | null
          updated_at?: string
          usefulness?: number
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "learned_patterns_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "learned_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_activity: {
        Row: {
          actor: string
          created_at: string
          detail: string | null
          event: string
          id: string
          mission_id: string
          user_id: string
        }
        Insert: {
          actor: string
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          mission_id: string
          user_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          mission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_activity_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          actual_cost_cents: number
          approval_expires_at: string | null
          approval_scope: string
          business_goal: string | null
          charter: Json | null
          completion_criteria: Json | null
          cost_ceiling_cents: number
          created_at: string
          deliverables: string[]
          dependencies: string[] | null
          estimated_completion_minutes: number | null
          estimated_cost_cents: number
          estimated_roi: number | null
          execution_path: Json | null
          id: string
          idempotency_key: string | null
          lessons_learned: string | null
          objective: string | null
          priority: string
          required_agents: string[] | null
          risk_level: string
          risks: string[]
          sponsor_executive: Database["public"]["Enums"]["executive_id"] | null
          stage: Database["public"]["Enums"]["mission_stage"]
          status: string
          success_metrics: Json | null
          title: string
          updated_at: string
          user_id: string
          workflow_version_id: string | null
        }
        Insert: {
          actual_cost_cents?: number
          approval_expires_at?: string | null
          approval_scope?: string
          business_goal?: string | null
          charter?: Json | null
          completion_criteria?: Json | null
          cost_ceiling_cents?: number
          created_at?: string
          deliverables?: string[]
          dependencies?: string[] | null
          estimated_completion_minutes?: number | null
          estimated_cost_cents?: number
          estimated_roi?: number | null
          execution_path?: Json | null
          id?: string
          idempotency_key?: string | null
          lessons_learned?: string | null
          objective?: string | null
          priority?: string
          required_agents?: string[] | null
          risk_level?: string
          risks?: string[]
          sponsor_executive?: Database["public"]["Enums"]["executive_id"] | null
          stage?: Database["public"]["Enums"]["mission_stage"]
          status?: string
          success_metrics?: Json | null
          title: string
          updated_at?: string
          user_id: string
          workflow_version_id?: string | null
        }
        Update: {
          actual_cost_cents?: number
          approval_expires_at?: string | null
          approval_scope?: string
          business_goal?: string | null
          charter?: Json | null
          completion_criteria?: Json | null
          cost_ceiling_cents?: number
          created_at?: string
          deliverables?: string[]
          dependencies?: string[] | null
          estimated_completion_minutes?: number | null
          estimated_cost_cents?: number
          estimated_roi?: number | null
          execution_path?: Json | null
          id?: string
          idempotency_key?: string | null
          lessons_learned?: string | null
          objective?: string | null
          priority?: string
          required_agents?: string[] | null
          risk_level?: string
          risks?: string[]
          sponsor_executive?: Database["public"]["Enums"]["executive_id"] | null
          stage?: Database["public"]["Enums"]["mission_stage"]
          status?: string
          success_metrics?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
          workflow_version_id?: string | null
        }
        Relationships: []
      }
      operational_events: {
        Row: {
          asset_id: string | null
          confidence: number
          context: Json
          cost_micro_usd: number | null
          created_at: string
          dedupe_key: string | null
          event_type: string
          executive_id: string | null
          id: string
          latency_ms: number | null
          mission_id: string | null
          outcome_class: string
          provider_binding: Json | null
          ref_id: string | null
          ref_kind: string | null
          retention: string
          sensitivity: string
          severity: number
          subsystem: string
          summary: string
          task_id: string | null
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          asset_id?: string | null
          confidence?: number
          context?: Json
          cost_micro_usd?: number | null
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          executive_id?: string | null
          id?: string
          latency_ms?: number | null
          mission_id?: string | null
          outcome_class: string
          provider_binding?: Json | null
          ref_id?: string | null
          ref_kind?: string | null
          retention?: string
          sensitivity?: string
          severity?: number
          subsystem: string
          summary: string
          task_id?: string | null
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          asset_id?: string | null
          confidence?: number
          context?: Json
          cost_micro_usd?: number | null
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          executive_id?: string | null
          id?: string
          latency_ms?: number | null
          mission_id?: string | null
          outcome_class?: string
          provider_binding?: Json | null
          ref_id?: string | null
          ref_kind?: string | null
          retention?: string
          sensitivity?: string
          severity?: number
          subsystem?: string
          summary?: string
          task_id?: string | null
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          founding_vip_number: number | null
          fraud_flag: boolean
          id: string
          is_founding_vip: boolean
          is_internal_account: boolean
          operator_title: string | null
          owner_notes: string | null
          subscription_price_cents: number
          subscription_tier: string
          updated_at: string
          vip_granted_at: string | null
          vip_revocation_reason: string | null
          vip_revoked_at: string | null
          vip_status: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          founding_vip_number?: number | null
          fraud_flag?: boolean
          id: string
          is_founding_vip?: boolean
          is_internal_account?: boolean
          operator_title?: string | null
          owner_notes?: string | null
          subscription_price_cents?: number
          subscription_tier?: string
          updated_at?: string
          vip_granted_at?: string | null
          vip_revocation_reason?: string | null
          vip_revoked_at?: string | null
          vip_status?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          founding_vip_number?: number | null
          fraud_flag?: boolean
          id?: string
          is_founding_vip?: boolean
          is_internal_account?: boolean
          operator_title?: string | null
          owner_notes?: string | null
          subscription_price_cents?: number
          subscription_tier?: string
          updated_at?: string
          vip_granted_at?: string | null
          vip_revocation_reason?: string | null
          vip_revoked_at?: string | null
          vip_status?: string
        }
        Relationships: []
      }
      sentinel_anomalies: {
        Row: {
          anomaly_type: string
          baseline_value: number | null
          capability: string | null
          confidence: number
          dedupe_key: string | null
          detected_at: string
          evidence: Json
          executive_id: string | null
          id: string
          metadata: Json
          observed_value: number | null
          provider: string | null
          recommended_response: string | null
          resolved_at: string | null
          severity: string
          status: string
          subsystem: string | null
          task_id: string | null
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          anomaly_type: string
          baseline_value?: number | null
          capability?: string | null
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          evidence?: Json
          executive_id?: string | null
          id?: string
          metadata?: Json
          observed_value?: number | null
          provider?: string | null
          recommended_response?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          subsystem?: string | null
          task_id?: string | null
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          anomaly_type?: string
          baseline_value?: number | null
          capability?: string | null
          confidence?: number
          dedupe_key?: string | null
          detected_at?: string
          evidence?: Json
          executive_id?: string | null
          id?: string
          metadata?: Json
          observed_value?: number | null
          provider?: string | null
          recommended_response?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          subsystem?: string | null
          task_id?: string | null
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      sentinel_budget_policies: {
        Row: {
          created_at: string
          id: string
          limit_micro_usd: number
          metadata: Json
          mode: string
          scope: string
          scope_key: string | null
          updated_at: string
          user_id: string
          window_kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_micro_usd: number
          metadata?: Json
          mode?: string
          scope: string
          scope_key?: string | null
          updated_at?: string
          user_id: string
          window_kind?: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_micro_usd?: number
          metadata?: Json
          mode?: string
          scope?: string
          scope_key?: string | null
          updated_at?: string
          user_id?: string
          window_kind?: string
        }
        Relationships: []
      }
      sentinel_cost_ledger: {
        Row: {
          capability: string
          cost_micro_usd: number
          created_at: string
          day: string
          dedupe_key: string | null
          estimated_micro_usd: number | null
          event_id: string | null
          executive_id: string | null
          id: string
          latency_ms: number | null
          metadata: Json
          mission_id: string | null
          model: string | null
          occurred_at: string
          outcome: string
          provider: string
          subsystem: string
          task_id: string | null
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          capability: string
          cost_micro_usd?: number
          created_at?: string
          day?: string
          dedupe_key?: string | null
          estimated_micro_usd?: number | null
          event_id?: string | null
          executive_id?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          mission_id?: string | null
          model?: string | null
          occurred_at?: string
          outcome?: string
          provider: string
          subsystem: string
          task_id?: string | null
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          capability?: string
          cost_micro_usd?: number
          created_at?: string
          day?: string
          dedupe_key?: string | null
          estimated_micro_usd?: number | null
          event_id?: string | null
          executive_id?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          mission_id?: string | null
          model?: string | null
          occurred_at?: string
          outcome?: string
          provider?: string
          subsystem?: string
          task_id?: string | null
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      sentinel_provider_health: {
        Row: {
          administratively_disabled: boolean
          availability: number
          avg_latency_ms: number
          capability: string
          consecutive_failures: number
          error_rate: number
          id: string
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          p95_latency_ms: number
          provider: string
          sample_count: number
          timeout_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          administratively_disabled?: boolean
          availability?: number
          avg_latency_ms?: number
          capability: string
          consecutive_failures?: number
          error_rate?: number
          id?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          p95_latency_ms?: number
          provider: string
          sample_count?: number
          timeout_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          administratively_disabled?: boolean
          availability?: number
          avg_latency_ms?: number
          capability?: string
          consecutive_failures?: number
          error_rate?: number
          id?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          p95_latency_ms?: number
          provider?: string
          sample_count?: number
          timeout_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sentinel_runtime_state: {
        Row: {
          disabled_bindings: Json
          fail_policy: string
          kill_switch_activated_at: string | null
          kill_switch_active: boolean
          kill_switch_actor: string | null
          kill_switch_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          disabled_bindings?: Json
          fail_policy?: string
          kill_switch_activated_at?: string | null
          kill_switch_active?: boolean
          kill_switch_actor?: string | null
          kill_switch_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          disabled_bindings?: Json
          fail_policy?: string
          kill_switch_activated_at?: string | null
          kill_switch_active?: boolean
          kill_switch_actor?: string | null
          kill_switch_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sops: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_seed: boolean
          source: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          is_seed?: boolean
          source?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_seed?: boolean
          source?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_documents: {
        Row: {
          analysis: Json
          classification: Json
          created_at: string
          department: string | null
          executive_owner: string | null
          harvested_at: string | null
          id: string
          knowledge_score: number | null
          knowledge_type: string | null
          mime_type: string | null
          modified_at: string | null
          name: string
          path: string | null
          priority: string | null
          raw_text: string | null
          remote_id: string
          sensitivity: string | null
          size_bytes: number | null
          snippet: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          classification?: Json
          created_at?: string
          department?: string | null
          executive_owner?: string | null
          harvested_at?: string | null
          id?: string
          knowledge_score?: number | null
          knowledge_type?: string | null
          mime_type?: string | null
          modified_at?: string | null
          name: string
          path?: string | null
          priority?: string | null
          raw_text?: string | null
          remote_id: string
          sensitivity?: string | null
          size_bytes?: number | null
          snippet?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          classification?: Json
          created_at?: string
          department?: string | null
          executive_owner?: string | null
          harvested_at?: string | null
          id?: string
          knowledge_score?: number | null
          knowledge_type?: string | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string
          path?: string | null
          priority?: string | null
          raw_text?: string | null
          remote_id?: string
          sensitivity?: string | null
          size_bytes?: number | null
          snippet?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vip_access: {
        Row: {
          active: boolean
          granted_at: string
          granted_by: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vip_orders: {
        Row: {
          admin_notes: string | null
          amount_usd: number
          created_at: string
          executed_at: string | null
          id: string
          paid_at: string | null
          paypal_reference: string | null
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_usd: number
          created_at?: string
          executed_at?: string | null
          id?: string
          paid_at?: string | null
          paypal_reference?: string | null
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_usd?: number
          created_at?: string
          executed_at?: string | null
          id?: string
          paid_at?: string | null
          paypal_reference?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vip_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_sessions: {
        Row: {
          amount_usd: number | null
          created_at: string
          goals: string | null
          id: string
          mode: string | null
          reinvest: boolean
          risk_pct: number | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd?: number | null
          created_at?: string
          goals?: string | null
          id?: string
          mode?: string | null
          reinvest?: boolean
          risk_pct?: number | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number | null
          created_at?: string
          goals?: string | null
          id?: string
          mode?: string | null
          reinvest?: boolean
          risk_pct?: number | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_founding_vip: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      current_user_is_owner: { Args: never; Returns: boolean }
      enforce_engine_quota: {
        Args: {
          _action: string
          _metadata?: Json
          _per_day: number
          _per_hour: number
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      owner_flag_fraud: {
        Args: { _flag: boolean; _note: string; _user_id: string }
        Returns: undefined
      }
      owner_manual_grant_vip: {
        Args: { _number: number; _user_id: string }
        Returns: undefined
      }
      owner_restore_vip: { Args: { _user_id: string }; Returns: undefined }
      owner_revoke_vip: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      owner_set_promotion: {
        Args: { _closed: boolean; _paused: boolean }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      executive_id: "iris" | "apex" | "katana" | "sentinel"
      goal_status: "active" | "paused" | "completed" | "abandoned"
      income_channel: "digital" | "ecom" | "affiliate" | "brokerage"
      mission_stage:
        | "proposed"
        | "chartered"
        | "active"
        | "in_review"
        | "completed"
        | "held"
        | "archived"
      opportunity_status:
        | "proposed"
        | "approved"
        | "active"
        | "completed"
        | "killed"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      executive_id: ["iris", "apex", "katana", "sentinel"],
      goal_status: ["active", "paused", "completed", "abandoned"],
      income_channel: ["digital", "ecom", "affiliate", "brokerage"],
      mission_stage: [
        "proposed",
        "chartered",
        "active",
        "in_review",
        "completed",
        "held",
        "archived",
      ],
      opportunity_status: [
        "proposed",
        "approved",
        "active",
        "completed",
        "killed",
        "rejected",
      ],
    },
  },
} as const
