export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bonus_events: {
        Row: {
          created_at: string
          family_id: string
          id: string
          kid_id: string
          occurred_on: string
          pts: number
          rule_id: string | null
          title: string
          week_key: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          kid_id: string
          occurred_on: string
          pts: number
          rule_id?: string | null
          title: string
          week_key: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          kid_id?: string
          occurred_on?: string
          pts?: number
          rule_id?: string | null
          title?: string
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_events_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "bonus_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_rules: {
        Row: {
          deleted_at: string | null
          family_id: string
          id: string
          pts: number
          title: string
        }
        Insert: {
          deleted_at?: string | null
          family_id: string
          id?: string
          pts: number
          title: string
        }
        Update: {
          deleted_at?: string | null
          family_id?: string
          id?: string
          pts?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          family_id: string
          kid_id: string
          occurred_on: string
        }
        Insert: {
          created_at?: string
          family_id: string
          kid_id: string
          occurred_on: string
        }
        Update: {
          created_at?: string
          family_id?: string
          kid_id?: string
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          active: boolean
          base_pts: number
          deleted_at: string | null
          description: string | null
          emoji: string | null
          family_id: string
          freq: string
          id: string
          sort: number
          title: string
        }
        Insert: {
          active?: boolean
          base_pts: number
          deleted_at?: string | null
          description?: string | null
          emoji?: string | null
          family_id: string
          freq: string
          id?: string
          sort?: number
          title: string
        }
        Update: {
          active?: boolean
          base_pts?: number
          deleted_at?: string | null
          description?: string | null
          emoji?: string | null
          family_id?: string
          freq?: string
          id?: string
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      completions: {
        Row: {
          chore_id: string
          created_at: string
          earned: number
          family_id: string
          id: string
          kid_id: string
          occurred_on: string
          pts_snapshot: number
          rated_by: string | null
          stars: number
          status: string
          title_snapshot: string
          week_key: string
        }
        Insert: {
          chore_id: string
          created_at?: string
          earned?: number
          family_id: string
          id?: string
          kid_id: string
          occurred_on: string
          pts_snapshot: number
          rated_by?: string | null
          stars?: number
          status?: string
          title_snapshot: string
          week_key: string
        }
        Update: {
          chore_id?: string
          created_at?: string
          earned?: number
          family_id?: string
          id?: string
          kid_id?: string
          occurred_on?: string
          pts_snapshot?: number
          rated_by?: string | null
          stars?: number
          status?: string
          title_snapshot?: string
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_rated_by_fkey"
            columns: ["rated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_events: {
        Row: {
          amounts: Json
          created_at: string
          family_id: string
          id: string
          occurred_on: string
          rule_id: string | null
          week_key: string
        }
        Insert: {
          amounts?: Json
          created_at?: string
          family_id: string
          id?: string
          occurred_on: string
          rule_id?: string | null
          week_key: string
        }
        Update: {
          amounts?: Json
          created_at?: string
          family_id?: string
          id?: string
          occurred_on?: string
          rule_id?: string | null
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "deduction_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deduction_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "deduction_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_rules: {
        Row: {
          deleted_at: string | null
          family_id: string
          id: string
          pts: number
          title: string
        }
        Insert: {
          deleted_at?: string | null
          family_id: string
          id?: string
          pts: number
          title: string
        }
        Update: {
          deleted_at?: string | null
          family_id?: string
          id?: string
          pts?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deduction_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      device_registrations: {
        Row: {
          approved: boolean
          auth_user_id: string
          created_at: string
          device_label: string | null
          family_id: string
          id: string
          kid_id: string
        }
        Insert: {
          approved?: boolean
          auth_user_id: string
          created_at?: string
          device_label?: string | null
          family_id: string
          id?: string
          kid_id: string
        }
        Update: {
          approved?: boolean
          auth_user_id?: string
          created_at?: string
          device_label?: string | null
          family_id?: string
          id?: string
          kid_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_registrations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_registrations_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ellie_rewards: {
        Row: {
          deleted_at: string | null
          family_id: string
          id: string
          sort: number
          stickers: number
          title: string
        }
        Insert: {
          deleted_at?: string | null
          family_id: string
          id?: string
          sort?: number
          stickers: number
          title: string
        }
        Update: {
          deleted_at?: string | null
          family_id?: string
          id?: string
          sort?: number
          stickers?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ellie_rewards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          done: boolean
          family_id: string
          id: string
          kid_id: string
          saved: number
          target: number
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          family_id: string
          id?: string
          kid_id: string
          saved?: number
          target: number
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          family_id?: string
          id?: string
          kid_id?: string
          saved?: number
          target?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bank: number
          clean_days: number
          color: string | null
          created_at: string
          emoji: string | null
          family_id: string
          id: string
          mode: string
          name: string
          quality_streak: number
          role: string
          sort: number
          stickers: number
          user_id: string | null
          week: number
          week_deducted: number
        }
        Insert: {
          bank?: number
          clean_days?: number
          color?: string | null
          created_at?: string
          emoji?: string | null
          family_id: string
          id?: string
          mode?: string
          name: string
          quality_streak?: number
          role: string
          sort?: number
          stickers?: number
          user_id?: string | null
          week?: number
          week_deducted?: number
        }
        Update: {
          bank?: number
          clean_days?: number
          color?: string | null
          created_at?: string
          emoji?: string | null
          family_id?: string
          id?: string
          mode?: string
          name?: string
          quality_streak?: number
          role?: string
          sort?: number
          stickers?: number
          user_id?: string | null
          week?: number
          week_deducted?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          cost: string
          created_at: string
          family_id: string
          id: string
          kid_id: string
          occurred_on: string
          title: string
        }
        Insert: {
          cost: string
          created_at?: string
          family_id: string
          id?: string
          kid_id: string
          occurred_on: string
          title: string
        }
        Update: {
          cost?: string
          created_at?: string
          family_id?: string
          id?: string
          kid_id?: string
          occurred_on?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          cost_pts: number
          deleted_at: string | null
          family_id: string
          id: string
          note: string | null
          sort: number
          title: string
          type: string
        }
        Insert: {
          cost_pts: number
          deleted_at?: string | null
          family_id: string
          id?: string
          note?: string | null
          sort?: number
          title: string
          type: string
        }
        Update: {
          cost_pts?: number
          deleted_at?: string | null
          family_id?: string
          id?: string
          note?: string | null
          sort?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      room_checks: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string
          occurred_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id: string
          occurred_on: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_checks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_checks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          cartoon_minutes: number
          family_id: string
          mult: number[]
          personal_streak_bonus: number
          personal_streak_days: number
          point_value: number
          quality_streak_bonus: number
          quality_streak_len: number
          weekly_deduction_cap: number
        }
        Insert: {
          cartoon_minutes?: number
          family_id: string
          mult?: number[]
          personal_streak_bonus?: number
          personal_streak_days?: number
          point_value?: number
          quality_streak_bonus?: number
          quality_streak_len?: number
          weekly_deduction_cap?: number
        }
        Update: {
          cartoon_minutes?: number
          family_id?: string
          mult?: number[]
          personal_streak_bonus?: number
          personal_streak_days?: number
          point_value?: number
          quality_streak_bonus?: number
          quality_streak_len?: number
          weekly_deduction_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_events: {
        Row: {
          created_at: string
          delta: number
          family_id: string
          id: string
          kid_id: string
          occurred_on: string
        }
        Insert: {
          created_at?: string
          delta: number
          family_id: string
          id?: string
          kid_id: string
          occurred_on: string
        }
        Update: {
          created_at?: string
          delta?: number
          family_id?: string
          id?: string
          kid_id?: string
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticker_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sticker_events_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tally_runs: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string
          week_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id: string
          week_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "tally_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tally_runs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _actor_kid: { Args: { p_kid_id: string }; Returns: string }
      _tally: { Args: { fam: string; wk?: string }; Returns: Json }
      add_kid: {
        Args: {
          p_color?: string
          p_emoji: string
          p_mode?: string
          p_name: string
        }
        Returns: {
          bank: number
          clean_days: number
          color: string | null
          created_at: string
          emoji: string | null
          family_id: string
          id: string
          mode: string
          name: string
          quality_streak: number
          role: string
          sort: number
          stickers: number
          user_id: string | null
          week: number
          week_deducted: number
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_sticker: {
        Args: { p_delta?: number; p_kid_id: string }
        Returns: number
      }
      allocate_to_goal: {
        Args: { p_amount: number; p_goal_id: string }
        Returns: Json
      }
      app_today: { Args: never; Returns: string }
      app_week_key: { Args: never; Returns: string }
      apply_deduction: { Args: { p_rule_id: string }; Returns: Json }
      approve_device: {
        Args: { p_approved?: boolean; p_device_id: string }
        Returns: undefined
      }
      award_bonus: {
        Args: { p_kid_id: string; p_rule_id: string }
        Returns: Json
      }
      cartoon_status: { Args: { p_day?: string }; Returns: string }
      check_in: { Args: { p_kid_id?: string }; Returns: undefined }
      chore_period_count: { Args: { p_chore_id: string }; Returns: number }
      claim_chore: {
        Args: { p_chore_id: string; p_kid_id?: string }
        Returns: {
          chore_id: string
          created_at: string
          earned: number
          family_id: string
          id: string
          kid_id: string
          occurred_on: string
          pts_snapshot: number
          rated_by: string | null
          stars: number
          status: string
          title_snapshot: string
          week_key: string
        }
        SetofOptions: {
          from: "*"
          to: "completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_family: {
        Args: {
          p_family_name: string
          p_parent_color?: string
          p_parent_emoji?: string
          p_parent_name: string
        }
        Returns: Json
      }
      current_family_id: { Args: never; Returns: string }
      current_kid_id: { Args: never; Returns: string }
      delete_kid: { Args: { p_kid_id: string }; Returns: undefined }
      family_kids: {
        Args: { p_invite_code: string }
        Returns: {
          color: string
          emoji: string
          id: string
          mode: string
          name: string
        }[]
      }
      family_snapshot: { Args: never; Returns: Json }
      finish_goal: { Args: { p_goal_id: string }; Returns: undefined }
      gen_invite_code: { Args: never; Returns: string }
      is_biweekly_on: { Args: never; Returns: boolean }
      is_parent: { Args: never; Returns: boolean }
      iso_week_key: { Args: { d: string }; Returns: string }
      mark_done: {
        Args: { p_completion_id: string; p_kid_id?: string }
        Returns: {
          chore_id: string
          created_at: string
          earned: number
          family_id: string
          id: string
          kid_id: string
          occurred_on: string
          pts_snapshot: number
          rated_by: string | null
          stars: number
          status: string
          title_snapshot: string
          week_key: string
        }
        SetofOptions: {
          from: "*"
          to: "completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prev_week_key: { Args: never; Returns: string }
      rate_completion: {
        Args: { p_completion_id: string; p_stars: number }
        Returns: Json
      }
      redeem_ellie: {
        Args: { p_kid_id: string; p_reward_id: string }
        Returns: Json
      }
      redeem_flexible: {
        Args: { p_amount: number; p_kid_id?: string; p_reward_id: string }
        Returns: Json
      }
      redeem_reward: {
        Args: { p_kid_id?: string; p_reward_id: string }
        Returns: Json
      }
      request_device: {
        Args: { p_invite_code: string; p_kid_id: string; p_label?: string }
        Returns: Json
      }
      room_check: { Args: never; Returns: Json }
      round_half: { Args: { x: number }; Returns: number }
      run_tally: { Args: never; Returns: Json }
      seed_family: { Args: { fam: string }; Returns: undefined }
      start_goal: {
        Args: { p_kid_id?: string; p_reward_id: string }
        Returns: {
          created_at: string
          done: boolean
          family_id: string
          id: string
          kid_id: string
          saved: number
          target: number
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_hotspot: { Args: { p_chore_id: string }; Returns: boolean }
      update_kid: {
        Args: {
          p_color: string
          p_emoji: string
          p_kid_id: string
          p_name: string
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

