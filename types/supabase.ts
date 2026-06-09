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
      ai_sessions: {
        Row: {
          created_at: string | null
          focus_area: string | null
          folder_id: string | null
          id: string
          messages: Json | null
          team_id: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          focus_area?: string | null
          folder_id?: string | null
          id?: string
          messages?: Json | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          focus_area?: string | null
          folder_id?: string | null
          id?: string
          messages?: Json | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "team_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cs2_knowledge: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          file_name: string
          heading: string | null
          id: string
          map: string
          side: string | null
          team_id: string | null
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          file_name: string
          heading?: string | null
          id?: string
          map?: string
          side?: string | null
          team_id?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          file_name?: string
          heading?: string | null
          id?: string
          map?: string
          side?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs2_knowledge_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      cs2_matches: {
        Row: {
          demo_id: string | null
          demo_url: string | null
          discovered_at: string
          id: string
          map: string | null
          match_id: string
          match_result: number | null
          match_time: string | null
          reservation_id: string
          score_ct: number | null
          score_t: number | null
          sharecode: string
          tv_port: number | null
          user_id: string
        }
        Insert: {
          demo_id?: string | null
          demo_url?: string | null
          discovered_at?: string
          id?: string
          map?: string | null
          match_id: string
          match_result?: number | null
          match_time?: string | null
          reservation_id: string
          score_ct?: number | null
          score_t?: number | null
          sharecode: string
          tv_port?: number | null
          user_id: string
        }
        Update: {
          demo_id?: string | null
          demo_url?: string | null
          discovered_at?: string
          id?: string
          map?: string | null
          match_id?: string
          match_result?: number | null
          match_time?: string | null
          reservation_id?: string
          score_ct?: number | null
          score_t?: number | null
          sharecode?: string
          tv_port?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs2_matches_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs2_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demos: {
        Row: {
          ai_report: string | null
          created_at: string | null
          created_by: string | null
          demo_type: string
          error_message: string | null
          faceit_match_id: string | null
          file_hash: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          last_heartbeat_at: string | null
          league: string | null
          map: string
          match_date: string | null
          opponent_name: string
          opponent_slug: string | null
          parsed_at: string | null
          parsed_data: Json | null
          parsed_json_url: string | null
          processing_started_at: string | null
          queued_at: string | null
          raw_file_path: string
          retry_count: number
          share_id: string | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          ai_report?: string | null
          created_at?: string | null
          created_by?: string | null
          demo_type?: string
          error_message?: string | null
          faceit_match_id?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          last_heartbeat_at?: string | null
          league?: string | null
          map: string
          match_date?: string | null
          opponent_name: string
          opponent_slug?: string | null
          parsed_at?: string | null
          parsed_data?: Json | null
          parsed_json_url?: string | null
          processing_started_at?: string | null
          queued_at?: string | null
          raw_file_path: string
          retry_count?: number
          share_id?: string | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          ai_report?: string | null
          created_at?: string | null
          created_by?: string | null
          demo_type?: string
          error_message?: string | null
          faceit_match_id?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          last_heartbeat_at?: string | null
          league?: string | null
          map?: string
          match_date?: string | null
          opponent_name?: string
          opponent_slug?: string | null
          parsed_at?: string | null
          parsed_data?: Json | null
          parsed_json_url?: string | null
          processing_started_at?: string | null
          queued_at?: string | null
          raw_file_path?: string
          retry_count?: number
          share_id?: string | null
          status?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_integrations: {
        Row: {
          channel_id: string | null
          created_at: string | null
          created_by: string | null
          guild_id: string
          guild_name: string | null
          id: string
          team_id: string
          webhook_url: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          guild_id: string
          guild_name?: string | null
          id?: string
          team_id: string
          webhook_url?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          guild_id?: string
          guild_name?: string | null
          id?: string
          team_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discord_integrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discord_integrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      faceit_elo_snapshots: {
        Row: {
          elo: number
          id: string
          level: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          elo: number
          id?: string
          level: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          elo?: number
          id?: string
          level?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faceit_elo_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          description: string
          email: string | null
          id: string
          title: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          email?: string | null
          id?: string
          title?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          canvas_data: Json
          created_at: string
          created_by: string
          id: string
          is_public: boolean
          map: string
          media_type: string | null
          media_urls: string[] | null
          name: string
          notes: string
          published_at: string | null
          team_id: string
          type: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          canvas_data?: Json
          created_at?: string
          created_by: string
          id?: string
          is_public?: boolean
          map: string
          media_type?: string | null
          media_urls?: string[] | null
          name: string
          notes?: string
          published_at?: string | null
          team_id: string
          type?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          canvas_data?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_public?: boolean
          map?: string
          media_type?: string | null
          media_urls?: string[] | null
          name?: string
          notes?: string
          published_at?: string | null
          team_id?: string
          type?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opponent_ratings: {
        Row: {
          created_at: string | null
          folder_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opponent_ratings_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "team_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opponent_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          created_at: string
          created_by: string
          folder_id: string | null
          id: string
          map: string
          name: string
          notes: string | null
          opponent_name: string | null
          player_roles: Json
          players: string[] | null
          sections: Json
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          folder_id?: string | null
          id?: string
          map: string
          name?: string
          notes?: string | null
          opponent_name?: string | null
          player_roles?: Json
          players?: string[] | null
          sections?: Json
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          folder_id?: string | null
          id?: string
          map?: string
          name?: string
          notes?: string | null
          opponent_name?: string | null
          player_roles?: Json
          players?: string[] | null
          sections?: Json
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "team_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          cs2_last_sharecode: string | null
          discord_id: string | null
          display_name: string | null
          faceit_id: string | null
          faceit_player_id: string | null
          favorite_maps: string[] | null
          id: string
          preferred_roles: string[] | null
          steam_auth_token: string | null
          steam_id: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          cs2_last_sharecode?: string | null
          discord_id?: string | null
          display_name?: string | null
          faceit_id?: string | null
          faceit_player_id?: string | null
          favorite_maps?: string[] | null
          id: string
          preferred_roles?: string[] | null
          steam_auth_token?: string | null
          steam_id?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          cs2_last_sharecode?: string | null
          discord_id?: string | null
          display_name?: string | null
          faceit_id?: string | null
          faceit_player_id?: string | null
          favorite_maps?: string[] | null
          id?: string
          preferred_roles?: string[] | null
          steam_auth_token?: string | null
          steam_id?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_folders: {
        Row: {
          aggregated_stats: Json | null
          ai_brief: string | null
          ai_brief_updated_at: string | null
          created_at: string
          id: string
          is_public: boolean
          opponent_display_name: string
          opponent_slug: string
          published_at: string | null
          updated_at: string | null
          user_team_id: string | null
        }
        Insert: {
          aggregated_stats?: Json | null
          ai_brief?: string | null
          ai_brief_updated_at?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          opponent_display_name: string
          opponent_slug: string
          published_at?: string | null
          updated_at?: string | null
          user_team_id?: string | null
        }
        Update: {
          aggregated_stats?: Json | null
          ai_brief?: string | null
          ai_brief_updated_at?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          opponent_display_name?: string
          opponent_slug?: string
          published_at?: string | null
          updated_at?: string | null
          user_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_folders_user_team_id_fkey"
            columns: ["user_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string | null
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string | null
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string | null
          demos_used_this_month: number
          description: string | null
          discord_link_code: string | null
          id: string
          invite_code: string | null
          is_personal: boolean
          logo_url: string | null
          name: string
          quota_reset_at: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          demos_used_this_month?: number
          description?: string | null
          discord_link_code?: string | null
          id?: string
          invite_code?: string | null
          is_personal?: boolean
          logo_url?: string | null
          name: string
          quota_reset_at?: string
          slug: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          demos_used_this_month?: number
          description?: string | null
          discord_link_code?: string | null
          id?: string
          invite_code?: string | null
          is_personal?: boolean
          logo_url?: string | null
          name?: string
          quota_reset_at?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          ai_coach_ready: boolean | null
          ai_model_preference: string | null
          ai_response_style: string | null
          demo_sharing: boolean | null
          email_notifications: boolean | null
          public_profile: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_coach_ready?: boolean | null
          ai_model_preference?: string | null
          ai_response_style?: string | null
          demo_sharing?: boolean | null
          email_notifications?: boolean | null
          public_profile?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_coach_ready?: boolean | null
          ai_model_preference?: string | null
          ai_response_style?: string | null
          demo_sharing?: boolean | null
          email_notifications?: boolean | null
          public_profile?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_plan: { Args: { p_team_id: string }; Returns: string }
      increment_team_demo_count: {
        Args: { p_team_id: string }
        Returns: undefined
      }
      is_team_admin:
        | { Args: { p_team_id: string; p_user_id: string }; Returns: boolean }
        | { Args: { target_team_id: string }; Returns: boolean }
      is_team_creator: { Args: { target_team_id: string }; Returns: boolean }
      is_team_member:
        | { Args: { p_team_id: string; p_user_id: string }; Returns: boolean }
        | { Args: { target_team_id: string }; Returns: boolean }
      match_cs2_knowledge: {
        Args: {
          filter_map?: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
          team_filter?: string
        }
        Returns: {
          chunk_index: number
          content: string
          file_name: string
          heading: string
          id: string
          map: string
          side: string
          similarity: number
          team_id: string
        }[]
      }
      set_demo_opponent_side: {
        Args: { p_demo_id: string; p_opponent_side: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
