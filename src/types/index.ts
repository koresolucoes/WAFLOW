// Type definitions for Vite environment variables were not being picked up correctly.
// Removing them to avoid confusion and relying on a local cast where needed.

import { Database, Json, Enums } from './database.types';
import { MetaTemplateComponent } from '../services/meta/types';
import type { Node as XyNode, Edge } from '@xyflow/react';
import type { Session, User } from '@supabase/auth-js';

export type Page = 'dashboard' | 'campaigns' | 'templates' | 'template-editor' | 'contacts' | 'new-campaign' | 'profile' | 'settings' | 'auth' | 'campaign-details' | 'automations' | 'automation-editor' | 'funnel' | 'contact-details' | 'inbox' | 'webhook-inspector';

// Tipos de string literal para substituir os enums do BD para segurança de tipos no aplicativo
export type TemplateCategory = Enums<'template_category'>;
export type TemplateStatus = Enums<'template_status'>;
export type CampaignStatus = Enums<'campaign_status'>;
export type MessageStatus = Enums<'message_status'>;
export type MessageType = Enums<'message_type'>;
export type MessageSource = Enums<'message_source'>;
export type AutomationStatus = Enums<'automation_status'>;
export type AutomationRunStatus = 'running' | 'success' | 'failed';
export type AutomationLogStatus = 'success' | 'failed';
export type CustomFieldType = Enums<'custom_field_type'>;
export type ActivityType = 'NOTA' | 'TAREFA';
export type DealStatus = Enums<'deal_status'>;
export type StageType = Enums<'stage_type'>;


// Tipos para os nós do editor de automação
export type NodeType = 'trigger' | 'action' | 'logic';

// Tipos expandidos para corresponderem ao backend
export type TriggerType = 'new_contact_with_tag' | 'message_received_with_keyword' | 'button_clicked' | 'new_contact' | 'webhook_received' | 'deal_created' | 'deal_stage_changed';
export type ActionType = 'send_template' | 'add_tag' | 'remove_tag' | 'send_text_message' | 'send_media' | 'send_interactive_message' | 'set_custom_field' | 'send_webhook' | 'create_deal' | 'update_deal_stage';
export type LogicType = 'condition' | 'split_path';


export interface AutomationNodeData {
  [key: string]: any;
  nodeType: NodeType;
  type: TriggerType | ActionType | LogicType;
  label: string;
  config: Json;
}

export type AutomationNode = XyNode<AutomationNodeData, string>;

// --- Tipos de objetos simples para evitar recursão de TS de tipos gerados ---
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type TeamMember = Database['public']['Tables']['team_members']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type CustomFieldDefinition = Database['public']['Tables']['custom_field_definitions']['Row'];
export type ContactActivity = Database['public']['Tables']['contact_activities']['Row'];

export type MessageTemplate = Omit<Database['public']['Tables']['message_templates']['Row'], 'category' | 'status' | 'components'> & {
    category: TemplateCategory;
    status: TemplateStatus;
    components: MetaTemplateComponent[];
};

export type Campaign = Database['public']['Tables']['campaigns']['Row'] & {
    status: CampaignStatus;
};

export type Message = Database['public']['Tables']['messages']['Row'];

export type Automation = Omit<Database['public']['Tables']['automations']['Row'], 'nodes' | 'edges' | 'status'> & {
    nodes: AutomationNode[];
    edges: Edge[];
    status: AutomationStatus;
};

export type Pipeline = Database['public']['Tables']['pipelines']['Row'];
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row'] & {
    type: StageType;
};
export type Deal = Database['public']['Tables']['deals']['Row'] & {
    status: DealStatus;
};
export type WebhookLog = Database['public']['Tables']['webhook_logs']['Row'];
export type CannedResponse = Database['public']['Tables']['canned_responses']['Row'];
// As tabelas de Segmento foram removidas no novo schema
// export type Segment = Database['public']['Tables']['segments']['Row'];
// export type SegmentRule = Database['public'['Tables']['segment_rules']['Row'];
export type AutomationRun = Database['public']['Tables']['automation_runs']['Row'];
export type AutomationNodeStats = Database['public']['Tables']['automation_node_stats']['Row'];
export type AutomationNodeLog = Database['public']['Tables']['automation_node_logs']['Row'];

// --- FIM dos tipos de objetos simples ---

// --- INTERFACES PERSONALIZADAS ---
export type DealWithContact = Deal & {
    contacts: Pick<Contact, 'id' | 'name'> | null;
};

export interface UnifiedMessage {
    id: string;
    contact_id: string;
    content: string;
    created_at: string;
    type: MessageType;
    status: MessageStatus;
    source: MessageSource;
    template?: MessageTemplate | null;
    message_template_id: string | null;
    replied_to_message_id: string | null;
    replied_to_message_content?: string | null;
}

export interface Conversation {
    contact: Contact;
    last_message: UnifiedMessage;
    unread_count: number;
    assignee_id: string | null;
    assignee_email: string | null;
}

export interface TimelineEvent {
  id: string;
  type: 'MESSAGE' | 'AUTOMATION_RUN' | 'DEAL_CREATED' | 'NOTE' | 'TASK';
  timestamp: string;
  data: any;
}

export type TaskWithContact = ContactActivity & {
    contacts: {
        id: string;
        name: string;
    } | null;
};

export type TeamMemberWithEmail = {
  team_id: string;
  user_id: string;
  role: 'admin' | 'agent';
  email: string;
};


// --- TIPOS DE INSERÇÃO ---
export interface MessageTemplateInsert extends Omit<Database['public']['Tables']['message_templates']['Insert'], 'category' | 'status' | 'components'> {
    team_id: string;
    template_name: string;
    category: TemplateCategory;
    status?: TemplateStatus;
    components: MetaTemplateComponent[];
    meta_id?: string | null;
}

export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type CustomFieldDefinitionInsert = Database['public']['Tables']['custom_field_definitions']['Insert'];
export type ContactActivityInsert = Database['public']['Tables']['contact_activities']['Insert'];
export type CannedResponseInsert = Database['public']['Tables']['canned_responses']['Insert'];

export interface AutomationInsert extends Omit<Database['public']['Tables']['automations']['Insert'], 'status' | 'nodes' | 'edges'> {
  team_id: string;
  name: string;
  status: AutomationStatus;
  nodes: AutomationNode[];
  edges: Edge[];
}

export type DealInsert = Database['public']['Tables']['deals']['Insert'];

// Tipos para formulários e operações específicas
export type EditableContact = Omit<Contact, 'id' | 'team_id' | 'created_at'> & { id?: string };
export type EditableProfile = Database['public']['Tables']['profiles']['Update'];
export type ContactActivityUpdate = Database['public']['Tables']['contact_activities']['Update'];


// Tipo combinado para o frontend, que inclui métricas calculadas
export interface CampaignWithMetrics extends Campaign {
    recipient_count: number;
    metrics: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
    };
}

// Tipo para a nova página de detalhes da campanha
export interface MessageWithContact extends Message {
  contacts: Pick<Contact, 'name' | 'phone'> | null;
}

export interface CampaignWithDetails extends Campaign {
  recipient_count: number;
  metrics: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
  };
  messages: MessageWithContact[];
  message_templates: MessageTemplate | null;
}

// Tipo para os detalhes de um contato
export interface ContactWithDetails extends Contact {
    deals: Deal[];
}


// Tipo para as configurações da Meta, derivado do perfil
export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}

// Tipos de Autenticação
export type { Session, User, Edge, Json, MetaTemplateComponent };