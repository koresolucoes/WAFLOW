export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: unknown }
  | unknown[]

export type PublicEnums = {
  automation_status: "active" | "paused"
  campaign_status: "Sent" | "Draft" | "Failed" | "Scheduled"
  custom_field_type: "TEXTO" | "NUMERO" | "DATA" | "LISTA"
  deal_status: "Aberto" | "Ganho" | "Perdido"
  message_source:
    | "campaign"
    | "automation"
    | "direct"
    | "inbound_reply"
  message_status: "sent" | "delivered" | "read" | "failed" | "pending"
  message_type: "inbound" | "outbound"
  stage_type: "Intermediária" | "Ganho" | "Perdido"
  template_category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  template_status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "LOCAL"
}

export type PublicTables = {
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
    Relationships: []
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
    Relationships: []
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
    Relationships: []
  }
  automation_triggers: {
    Row: {
      id: string
      team_id: string
      automation_id: string
      node_id: string
      trigger_type: string
      trigger_key: string | null
      created_at: string
    }
    Insert: {
      id?: string
      team_id: string
      automation_id: string
      node_id: string
      trigger_type: string
      trigger_key?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      team_id?: string
      automation_id?: string
      node_id?: string
      trigger_type?: string
      trigger_key?: string | null
      created_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "automation_triggers_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  automations: {
    Row: {
      created_at: string
      edges: Json | null
      id: string
      name: string
      nodes: Json | null
      status: PublicEnums["automation_status"]
      team_id: string
    }
    Insert: {
      created_at?: string
      edges?: Json | null
      id?: string
      name: string
      nodes?: Json | null
      status?: PublicEnums["automation_status"]
      team_id: string
    }
    Update: {
      created_at?: string
      edges?: Json | null
      id?: string
      name?: string
      nodes?: Json | null
      status?: PublicEnums["automation_status"]
      team_id?: string
    }
    Relationships: [
      {
        foreignKeyName: "automations_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  campaigns: {
    Row: {
      id: string
      created_at: string
      name: string
      recipient_count: number
      sent_at: string | null
      status: PublicEnums["campaign_status"]
      template_id: string | null
      team_id: string
    }
    Insert: {
      id?: string
      created_at?: string
      name: string
      recipient_count?: number
      sent_at?: string | null
      status: PublicEnums["campaign_status"]
      template_id?: string | null
      team_id: string
    }
    Update: {
      id?: string
      created_at?: string
      name?: string
      recipient_count?: number
      sent_at?: string | null
      status?: PublicEnums["campaign_status"]
      template_id?: string | null
      team_id?: string
    }
    Relationships: [
      {
        foreignKeyName: "campaigns_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  canned_responses: {
    Row: {
      content: string
      created_at: string
      id: string
      shortcut: string
      team_id: string
    }
    Insert: {
      content: string
      created_at?: string
      id?: string
      shortcut: string
      team_id: string
    }
    Update: {
      content?: string
      created_at?: string
      id?: string
      shortcut?: string
      team_id?: string
    }
    Relationships: [
      {
        foreignKeyName: "canned_responses_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  contact_activities: {
    Row: {
      id: string
      team_id: string
      contact_id: string
      created_at: string
      type: "NOTA" | "TAREFA"
      content: string
      due_date: string | null
      is_completed: boolean
    }
    Insert: {
      id?: string
      team_id: string
      contact_id: string
      created_at?: string
      type: "NOTA" | "TAREFA"
      content: string
      due_date?: string | null
      is_completed?: boolean
    }
    Update: {
      id?: string
      team_id?: string
      contact_id?: string
      created_at?: string
      type?: "NOTA" | "TAREFA"
      content?: string
      due_date?: string | null
      is_completed?: boolean
    }
    Relationships: [
      {
        foreignKeyName: "contact_activities_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
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
      sentiment: string | null
      tags: string[] | null
      team_id: string
    }
    Insert: {
      company?: string | null
      created_at?: string
      custom_fields?: Json | null
      email?: string | null
      id?: string
      name: string
      phone: string
      sentiment?: string | null
      tags?: string[] | null
      team_id: string
    }
    Update: {
      company?: string | null
      created_at?: string
      custom_fields?: Json | null
      email?: string | null
      id?: string
      name?: string
      phone?: string
      sentiment?: string | null
      tags?: string[] | null
      team_id?: string
    }
    Relationships: [
       {
        foreignKeyName: "contacts_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  conversations: {
    Row: {
      id: string
      team_id: string
      contact_id: string
      assignee_id: string | null
      status: "open" | "closed"
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      team_id: string
      contact_id: string
      assignee_id?: string | null
      status?: "open" | "closed"
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      team_id?: string
      contact_id?: string
      assignee_id?: string | null
      status?: "open" | "closed"
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "conversations_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "conversations_contact_id_fkey"
        columns: ["contact_id"]
        isOneToOne: true
        referencedRelation: "contacts"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "conversations_assignee_id_fkey"
        columns: ["assignee_id"]
        isOneToOne: false
        referencedRelation: "users"
        referencedColumns: ["id"]
      }
    ]
  }
  custom_field_definitions: {
    Row: {
      created_at: string
      id: string
      key: string
      name: string
      options: string[] | null
      type: PublicEnums["custom_field_type"]
      team_id: string
    }
    Insert: {
      created_at?: string
      id?: string
      key: string
      name: string
      options?: string[] | null
      type: PublicEnums["custom_field_type"]
      team_id: string
    }
    Update: {
      created_at?: string
      id?: string
      key?: string
      name?: string
      options?: string[] | null
      type?: PublicEnums["custom_field_type"]
      team_id?: string
    }
    Relationships: [
      {
        foreignKeyName: "custom_field_definitions_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  deals: {
    Row: {
      closed_at: string | null
      closing_reason: string | null
      contact_id: string
      created_at: string
      id: string
      name: string
      pipeline_id: string
      stage_id: string
      status: PublicEnums["deal_status"]
      updated_at: string
      team_id: string
      value: number | null
    }
    Insert: {
      closed_at?: string | null
      closing_reason?: string | null
      contact_id: string
      created_at?: string
      id?: string
      name: string
      pipeline_id: string
      stage_id: string
      status?: PublicEnums["deal_status"]
      updated_at?: string
      team_id: string
      value?: number | null
    }
    Update: {
      closed_at?: string | null
      closing_reason?: string | null
      contact_id?: string
      created_at?: string
      id?: string
      name?: string
      pipeline_id?: string
      stage_id?: string
      status?: PublicEnums["deal_status"]
      updated_at?: string
      team_id?: string
      value?: number | null
    }
    Relationships: [
      {
        foreignKeyName: "deals_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  message_templates: {
    Row: {
      category: PublicEnums["template_category"]
      components: Json
      created_at: string
      id: string
      meta_id: string | null
      status: PublicEnums["template_status"]
      template_name: string
      team_id: string
    }
    Insert: {
      category: PublicEnums["template_category"]
      components: Json
      created_at?: string
      id?: string
      meta_id?: string | null
      status?: PublicEnums["template_status"]
      template_name: string
      team_id: string
    }
    Update: {
      category?: PublicEnums["template_category"]
      components?: Json
      created_at?: string
      id?: string
      meta_id?: string | null
      status?: PublicEnums["template_status"]
      template_name?: string
      team_id?: string
    }
    Relationships: [
      {
        foreignKeyName: "message_templates_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
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
      message_template_id: string | null
      meta_message_id: string | null
      read_at: string | null
      replied_to_message_id: string | null
      sent_at: string | null
      source: PublicEnums["message_source"]
      status: PublicEnums["message_status"]
      type: PublicEnums["message_type"]
      team_id: string
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
      message_template_id?: string | null
      meta_message_id?: string | null
      read_at?: string | null
      replied_to_message_id?: string | null
      sent_at?: string | null
      source: PublicEnums["message_source"]
      status: PublicEnums["message_status"]
      type: PublicEnums["message_type"]
      team_id: string
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
      message_template_id?: string | null
      meta_message_id?: string | null
      read_at?: string | null
      replied_to_message_id?: string | null
      sent_at?: string | null
      source?: PublicEnums["message_source"]
      status?: PublicEnums["message_status"]
      type?: PublicEnums["message_type"]
      team_id?: string
    }
    Relationships: [
      {
        foreignKeyName: "messages_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  pipeline_stages: {
    Row: {
      created_at: string
      id: string
      name: string
      pipeline_id: string
      sort_order: number
      type: PublicEnums["stage_type"]
    }
    Insert: {
      created_at?: string
      id?: string
      name: string
      pipeline_id: string
      sort_order: number
      type?: PublicEnums["stage_type"]
    }
    Update: {
      created_at?: string
      id?: string
      name?: string
      pipeline_id?: string
      sort_order?: number
      type?: PublicEnums["stage_type"]
    }
    Relationships: []
  }
  pipelines: {
    Row: {
      created_at: string
      id: string
      name: string
      team_id: string
    }
    Insert: {
      created_at?: string
      id?: string
      name: string
      team_id: string
    }
    Update: {
      created_at?: string
      id?: string
      name?: string
      team_id?: string
    }
    Relationships: [
       {
        foreignKeyName: "pipelines_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
  profiles: {
    Row: {
      company_audience: string | null
      company_description: string | null
      company_name: string | null
      company_products: string | null
      company_tone: string | null
      dashboard_layout: Json | null
      id: string
      meta_access_token: string | null
      meta_phone_number_id: string | null
      meta_verify_token: string | null
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
      dashboard_layout?: Json | null
      id: string
      meta_access_token?: string | null
      meta_phone_number_id?: string | null
      meta_verify_token?: string | null
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
      dashboard_layout?: Json | null
      id?: string
      meta_access_token?: string | null
      meta_phone_number_id?: string | null
      meta_verify_token?: string | null
      meta_waba_id?: string | null
      updated_at?: string | null
      webhook_path_prefix?: string | null
    }
    Relationships: []
  }
  team_members: {
    Row: {
      team_id: string
      user_id: string
      role: "admin" | "agent"
    }
    Insert: {
      team_id: string
      user_id: string
      role?: "admin" | "agent"
    }
    Update: {
      team_id?: string
      user_id?: string
      role?: "admin" | "agent"
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
        referencedRelation: "users"
        referencedColumns: ["id"]
      }
    ]
  }
  teams: {
    Row: {
      id: string
      name: string
      owner_id: string | null
      created_at: string
    }
    Insert: {
      id?: string
      name: string
      owner_id?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      name?: string
      owner_id?: string | null
      created_at?: string
    }
    Relationships: [
      {
        foreignKeyName: "teams_owner_id_fkey"
        columns: ["owner_id"]
        isOneToOne: false
        referencedRelation: "users"
        referencedColumns: ["id"]
      }
    ]
  }
  webhook_logs: {
    Row: {
      id: string
      team_id: string
      created_at: string
      source: string
      payload: Json | null
      path: string | null
    }
    Insert: {
      id?: string
      team_id: string
      created_at?: string
      source: string
      payload?: Json | null
      path?: string | null
    }
    Update: {
      id?: string
      team_id?: string
      created_at?: string
      source?: string
      payload?: Json | null
      path?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "webhook_logs_team_id_fkey"
        columns: ["team_id"]
        isOneToOne: false
        referencedRelation: "teams"
        referencedColumns: ["id"]
      }
    ]
  }
}

export interface Database {
  public: {
    Tables: PublicTables
    Views: {
      [key: string]: never
    }
    Functions: {
      get_conversations_with_contacts: {
        Args: {
          p_team_id: string
        }
        Returns: Json
      }
      get_members_for_teams: {
        Args: {
          p_team_ids: string[]
        }
        Returns: Json
      }
      get_user_teams_and_profile: {
        Args: Record<string, never>
        Returns: Json
      }
      increment_node_stat: {
        Args: {
          p_automation_id: string
          p_node_id: string
          p_status: string
        }
        Returns: undefined
      }
      invite_team_member: {
        Args: {
          p_team_id: string
          p_email: string
          p_role: "admin" | "agent"
        }
        Returns: Json
      }
      sync_automation_triggers: {
        Args: {
          automation_id_in: string
        }
        Returns: undefined
      }
    }
    Enums: PublicEnums
    CompositeTypes: {
      [key: string]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  EnumName extends keyof PublicSchema["Enums"]
> = PublicSchema["Enums"][EnumName]