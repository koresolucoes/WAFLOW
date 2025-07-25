
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export type Database = {
  public: {
    Tables: {
      automation_node_logs: {
        Row: {
          created_at: string
          details: string | null
          id: number
          node_id: string
          run_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: number
          node_id: string
          run_id: string
          status: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: number
          node_id?: string
          run_id?: string
          status?: string
        }
      }
      automation_node_stats: {
        Row: {
          automation_id: string
          error_count: number
          last_run_at: string | null
          node_id: string
          success_count: number
        }
        Insert: {
          automation_id: string
          error_count?: number
          last_run_at?: string | null
          node_id: string
          success_count?: number
        }
        Update: {
          automation_id?: string
          error_count?: number
          last_run_at?: string | null
          node_id?: string
          success_count?: number
        }
      }
      automation_runs: {
        Row: {
          automation_id: string
          contact_id: string | null
          details: string | null
          id: string
          run_at: string
          status: string
        }
        Insert: {
          automation_id: string
          contact_id?: string | null
          details?: string | null
          id?: string
          run_at?: string
          status: string
        }
        Update: {
          automation_id?: string
          contact_id?: string | null
          details?: string | null
          id?: string
          run_at?: string
          status?: string
        }
      }
      automation_triggers: {
        Row: {
          id: string
          user_id: string
          automation_id: string
          node_id: string
          trigger_type: string
          trigger_key: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          automation_id: string
          node_id: string
          trigger_type: string
          trigger_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          automation_id?: string
          node_id?: string
          trigger_type?: string
          trigger_key?: string | null
          created_at?: string
        }
      }
      automations: {
        Row: {
          created_at: string
          edges: Json | null
          id: string
          name: string
          nodes: Json | null
          status: Database["public"]["Enums"]["automation_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json | null
          id?: string
          name: string
          nodes?: Json | null
          status?: Database["public"]["Enums"]["automation_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json | null
          id?: string
          name?: string
          nodes?: Json | null
          status?: Database["public"]["Enums"]["automation_status"]
          user_id?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          created_at: string
          name: string
          recipient_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          recipient_count?: number
          sent_at?: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          recipient_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          user_id?: string
        }
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          name: string
          phone: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name: string
          phone: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          tags?: string[] | null
          user_id?: string
        }
      }
      deals: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          stage_id: string
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          stage_id: string
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          stage_id?: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
      }
      message_templates: {
        Row: {
          category: Database["public"]["Enums"]["template_category"]
          components: Json
          created_at: string
          id: string
          meta_id: string | null
          status: Database["public"]["Enums"]["template_status"]
          template_name: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["template_category"]
          components: Json
          created_at?: string
          id?: string
          meta_id?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          template_name: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["template_category"]
          components?: Json
          created_at?: string
          id?: string
          meta_id?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          template_name?: string
          user_id?: string
        }
      }
      messages: {
        Row: {
          automation_id: string | null
          campaign_id: string | null
          contact_id: string
          content: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          meta_message_id: string | null
          read_at: string | null
          sent_at: string | null
          source: Database["public"]["Enums"]["message_source"]
          status: Database["public"]["Enums"]["message_status"]
          type: Database["public"]["Enums"]["message_type"]
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          campaign_id?: string | null
          contact_id: string
          content: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          meta_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          source: Database["public"]["Enums"]["message_source"]
          status: Database["public"]["Enums"]["message_status"]
          type: Database["public"]["Enums"]["message_type"]
          user_id: string
        }
        Update: {
          automation_id?: string | null
          campaign_id?: string | null
          contact_id?: string
          content?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          meta_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          source?: Database["public"]["Enums"]["message_source"]
          status?: Database["public"]["Enums"]["message_status"]
          type?: Database["public"]["Enums"]["message_type"]
          user_id?: string
        }
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          pipeline_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          sort_order?: number
        }
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
      }
      profiles: {
        Row: {
          company_audience: string | null
          company_description: string | null
          company_name: string | null
          company_products: string | null
          company_tone: string | null
          id: string
          meta_access_token: string | null
          meta_phone_number_id: string | null
          meta_waba_id: string | null
          updated_at: string | null
          webhook_path_prefix: string | null
        }
        Insert: {
          company_audience?: string | null
          company_description?: string | null
          company_name?: string | null
          company_products?: string | null
          company_tone?: string | null
          id: string
          meta_access_token?: string | null
          meta_phone_number_id?: string | null
          meta_waba_id?: string | null
          updated_at?: string | null
          webhook_path_prefix?: string | null
        }
        Update: {
          company_audience?: string | null
          company_description?: string | null
          company_name?: string | null
          company_products?: string | null
          company_tone?: string | null
          id?: string
          meta_access_token?: string | null
          meta_phone_number_id?: string | null
          meta_waba_id?: string | null
          updated_at?: string | null
          webhook_path_prefix?: string | null
        }
      }
    }
    Views: {
      [key: string]: never
    }
    Functions: {
      get_conversations_with_contacts: {
        Args: {
          p_user_id: string
        }
        Returns: {
          contact_details: Json
          last_message: Json
          unread_count: number
        }[]
      }
      get_unified_message_history: {
        Args: {
          p_user_id: string
          p_contact_id: string
        }
        Returns: {
          id: string
          contact_id: string
          content: string
          created_at: string
          type: Database["public"]["Enums"]["message_type"]
          status: Database["public"]["Enums"]["message_status"]
          sourceTable: string
          template: Json
        }[]
      }
      increment_node_stat: {
        Args: {
          p_automation_id: string
          p_node_id: string
          p_status: string
        }
        Returns: undefined
      }
      sync_automation_triggers: {
        Args: {
          automation_id_in: string
        }
        Returns: undefined
      }
    }
    Enums: {
      automation_status: "active" | "paused"
      campaign_status: "Sent" | "Draft" | "Failed" | "Scheduled"
      message_source:
        | "campaign"
        | "automation"
        | "direct"
        | "inbound_reply"
      message_status: "sent" | "delivered" | "read" | "failed" | "pending"
      message_type: "inbound" | "outbound"
      template_category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
      template_status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "LOCAL"
    }
    CompositeTypes: {
      [key: string]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof PublicSchema["Tables"] & string
> = PublicSchema["Tables"][TableName] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  TableName extends keyof PublicSchema["Tables"] & string
> = PublicSchema["Tables"][TableName] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  TableName extends keyof PublicSchema["Tables"] & string
> = PublicSchema["Tables"][TableName] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  EnumName extends keyof PublicSchema["Enums"] & string
> = PublicSchema["Enums"][EnumName]
