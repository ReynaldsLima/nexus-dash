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
      ad_accounts: {
        Row: {
          account_id: string
          active: boolean
          channel: string
          created_at: string
          id: string
          refresh_token: string | null
          tenant_id: string
          token_expires_at: string | null
          vault_secret_id: string
        }
        Insert: {
          account_id: string
          active?: boolean
          channel: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          tenant_id: string
          token_expires_at?: string | null
          vault_secret_id: string
        }
        Update: {
          account_id?: string
          active?: boolean
          channel?: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          ad_group_id: string | null
          attribution_window: string
          campaign_id: string
          campaign_name: string
          channel: string
          clicks: number
          conversion_value: number
          conversions: number
          created_at: string
          date: string
          id: string
          impressions: number
          spend: number
          status: string | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          ad_group_id?: string | null
          attribution_window?: string
          campaign_id: string
          campaign_name: string
          channel: string
          clicks?: number
          conversion_value?: number
          conversions?: number
          created_at?: string
          date: string
          id?: string
          impressions?: number
          spend?: number
          status?: string | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          ad_group_id?: string | null
          attribution_window?: string
          campaign_id?: string
          campaign_name?: string
          channel?: string
          clicks?: number
          conversion_value?: number
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          impressions?: number
          spend?: number
          status?: string | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_rollups: {
        Row: {
          campaign_count: number
          channel: string
          date: string
          id: string
          tenant_id: string
          total_clicks: number
          total_conv_value: number
          total_conversions: number
          total_impressions: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          campaign_count?: number
          channel: string
          date: string
          id?: string
          tenant_id: string
          total_clicks?: number
          total_conv_value?: number
          total_conversions?: number
          total_impressions?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          campaign_count?: number
          channel?: string
          date?: string
          id?: string
          tenant_id?: string
          total_clicks?: number
          total_conv_value?: number
          total_conversions?: number
          total_impressions?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          error_message: string | null
          id: string
          records_synced: number
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          channel: string
          completed_at?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number
          started_at?: string
          status: string
          tenant_id: string
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sheet_id: string | null
          sheets_api_key: string | null
          sheets_service_account: Json | null
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sheet_id?: string | null
          sheets_api_key?: string | null
          sheets_service_account?: Json | null
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sheet_id?: string | null
          sheets_api_key?: string | null
          sheets_service_account?: Json | null
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_or_update_vault_secret: {
        Args: { p_name: string; p_secret: string }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_tenant_id: { Args: never; Returns: string }
      get_tenant_slug: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      read_vault_secret: { Args: { p_secret_name: string }; Returns: string }
      refresh_daily_rollups: {
        Args: { p_date_from: string; p_date_to: string; p_tenant_id: string }
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
