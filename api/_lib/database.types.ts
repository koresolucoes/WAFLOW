

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
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json | null
          id?: string
          name: string
          nodes?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json | null
          id?: string
          name?: string
          nodes?: Json | null
          status?: string
          user_id?: string
        }
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          meta_message_id: string | null
          read_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          meta_message_id?: string | null
          read_at?: string | null
          status: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          meta_message_id?: string | null
          read_at?: string | null
          status?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          created_at: string
          name: string
          recipient_count: number
          sent_at: string
          status: string
          template_id: string
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          recipient_count?: number
          sent_at?: string
          status: string
          template_id: string
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          recipient_count?: number
          sent_at?: string
          status?: string
          template_id?: string
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
          category: string
          components: Json
          created_at: string
          id: string
          meta_id: string | null
          status: string
          template_name: string
          user_id: string
        }
        Insert: {
          category: string
          components: Json
          created_at?: string
          id?: string
          meta_id?: string | null
          status?: string
          template_name: string
          user_id: string
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          meta_id?: string | null
          status?: string
          template_name?: string
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
      received_messages: {
        Row: {
          contact_id: string
          id: string
          message_body: string | null
          meta_message_id: string
          received_at: string
          sentiment: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          id?: string
          message_body?: string | null
          meta_message_id: string
          received_at?: string
          sentiment?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          id?: string
          message_body?: string | null
          meta_message_id?: string
          received_at?: string
          sentiment?: string | null
          user_id?: string
        }
      }
      segment_rules: {
        Row: {
          field: string
          id: string
          operator: string
          segment_id: string
          value: string
        }
        Insert: {
          field: string
          id?: string
          operator: string
          segment_id: string
          value: string
        }
        Update: {
          field?: string
          id?: string
          operator?: string
          segment_id?: string
          value?: string
        }
      }
      segments: {
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
      sent_messages: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          meta_message_id: string | null
          read_at: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          meta_message_id?: string | null
          read_at?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          meta_message_id?: string | null
          read_at?: string | null
          source?: string
          status?: string
          user_id?: string
        }
      }
    }
    Views: {
      [key: string]: never
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      [key: string]: never
    }
    CompositeTypes: {
      [key: string]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName]["Update"]

export type Enums<
  EnumName extends keyof PublicSchema["Enums"]
> = PublicSchema["Enums"][EnumName]
