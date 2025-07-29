export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: any }
  | any[]

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
      team_id: string
    }
    Insert: {
      created_at?: string
      details?: string | null
      id?: number
      node_id: string
      run_id: string
      status: string
      team_id: string
    }
    Update: {
      created_at?: string
      details?: string | null
      id?: number
      node_id?: string
      run_id?: string
      status?: string
      team_id?: string
    }
  }
  automation_node_stats: {
    Row: {
      automation_id: string
      error_count: number
      last_run_at: string | null
      node_id: string
      success_count: number
      team_id: string
    }
    Insert: {
      automation_id: string
      error_count?: number
      last_run_at?: string | null
      node_id: string
      success_count?: number
      team_id: string
    }
    Update: {
      automation_id?: string
      error_count?: number
      last_run_at?: string | null
      node_id?: string
      success_count?: number
      team_id?: string
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
      team_id: string
    }
    Insert: {
      automation_id: string
      contact_id?: string | null
      details?: string | null
      id?: string
      run_at?: string
      status: string
      team_id: string
    }
    Update: {
      automation_id?: string
      contact_id?: string | null
      details?: string | null
      id?: string
      run_at?: string
      status?: string
      team_id?: string
    }
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
  }
  automations: {
    Row: {
      created_at: string
      edges: any | null
      id: string
      name: string
      nodes: any | null
      status: PublicEnums["automation_status"]
      team_id: string
    }
    Insert: {
      created_at?: string
      edges?: any | null
      id?: string
      name: string
      nodes?: any | null
      status?: PublicEnums["automation_status"]
      team_id: string
    }
    Update: {
      created_at?: string
      edges?: any | null
      id?: string
      name?: string
      nodes?: any | null
      status?: PublicEnums["automation_status"]
      team_id?: string
    }
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
  }
  contacts: {
    Row: {
      company: string | null
      created_at: string
      custom_fields: any | null
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
      custom_fields?: any | null
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
      custom_fields?: any | null
      email?: string | null
      id?: string
      name?: string
      phone?: string
      sentiment?: string | null
      tags?: string[] | null
      team_id?: string
    }
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
  }
  message_templates: {
    Row: {
      category: PublicEnums["template_category"]
      components: any
      created_at: string
      id: string
      meta_id: string | null
      status: PublicEnums["template_status"]
      template_name: string
      team_id: string
    }
    Insert: {
      category: PublicEnums["template_category"]
      components: any
      created_at?: string
      id?: string
      meta_id?: string | null
      status?: PublicEnums["template_status"]
      template_name: string
      team_id: string
    }
    Update: {
      category?: PublicEnums["template_category"]
      components?: any
      created_at?: string
      id?: string
      meta_id?: string | null
      status?: PublicEnums["template_status"]
      template_name?: string
      team_id?: string
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
  }
  profiles: {
    Row: {
      company_audience: string | null
      company_description: string | null
      company_name: string | null
      company_products: string | null
      company_tone: string | null
      dashboard_layout: any | null
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
      dashboard_layout?: any | null
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
      dashboard_layout?: any | null
      id?: string
      meta_access_token?: string | null
      meta_phone_number_id?: string | null
      meta_verify_token?: string | null
      meta_waba_id?: string | null
      updated_at?: string | null
      webhook_path_prefix?: string | null
    }
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
  }
  webhook_logs: {
    Row: {
      id: string
      team_id: string
      created_at: string
      source: string
      payload: any | null
      path: string | null
    }
    Insert: {
      id?: string
      team_id: string
      created_at?: string
      source: string
      payload?: any | null
      path?: string | null
    }
    Update: {
      id?: string
      team_id?: string
      created_at?: string
      source?: string
      payload?: any | null
      path?: string | null
    }
  }
}

export interface Database {
  public: {
    Tables: PublicTables
    Views: {
      [key: string]: never
    }
    Functions: {
      [key: string]: never
    }
    Enums: PublicEnums
    CompositeTypes: {
      [key: string]: never
    }
  }
}

export type Tables<
  TableName extends keyof PublicTables
> = PublicTables[TableName]["Row"]
export type TablesInsert<
  TableName extends keyof PublicTables
> = PublicTables[TableName]["Insert"]
export type TablesUpdate<
  TableName extends keyof PublicTables
> = PublicTables[TableName]["Update"]
export type Enums<
  EnumName extends keyof PublicEnums
> = PublicEnums[EnumName]
