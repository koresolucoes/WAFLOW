

import { Session, User } from '@supabase/supabase-js';
import { Json, Tables, TablesInsert, TablesUpdate } from './database.types';
import { MetaTemplateComponent } from '../services/meta/types';
import type { Node as XyNode, Edge } from '@xyflow/react';

export type Page = 'dashboard' | 'campaigns' | 'templates' | 'template-editor' | 'contacts' | 'new-campaign' | 'profile' | 'settings' | 'auth' | 'campaign-details' | 'automations' | 'automation-editor' | 'funnel' | 'contact-details';

// String literal unions to replace DB enums for type safety in the app
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'LOCAL';
export type CampaignStatus = 'Sent' | 'Draft' | 'Failed';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type AutomationStatus = 'active' | 'paused';
export type AutomationRunStatus = 'success' | 'failed';
export type AutomationLogStatus = 'success' | 'failed';

// Tipos para os nós do editor de automação
export type NodeType = 'trigger' | 'action' | 'logic';

// Tipos expandidos para corresponderem ao backend
export type TriggerType = 'new_contact_with_tag' | 'message_received_with_keyword' | 'button_clicked' | 'new_contact' | 'webhook_received';
export type ActionType = 'send_template' | 'add_tag' | 'remove_tag' | 'send_text_message' | 'send_media' | 'send_interactive_message' | 'set_custom_field' | 'send_webhook';
export type LogicType = 'condition' | 'split_path';


export interface NodeData {
  [key: string]: any;
  nodeType: NodeType;
  type: TriggerType | ActionType | LogicType;
  label: string;
  config: Json;
}

export type AutomationNode = XyNode<NodeData>;

// --- Plain object types to avoid TS recursion from generated types ---
export type Profile = {
    id: string;
    updated_at: string | null;
    company_name: string | null;
    company_description: string | null;
    company_products: string | null;
    company_audience: string | null;
    company_tone: string | null;
    meta_access_token: string | null;
    meta_waba_id: string | null;
    meta_phone_number_id: string | null;
    webhook_path_prefix: string | null;
};

export type Contact = {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    email: string | null;
    company: string | null;
    tags: string[] | null;
    custom_fields: Json | null;
    created_at: string;
};

export type MessageTemplate = {
    id: string;
    user_id: string;
    meta_id: string | null;
    template_name: string;
    category: TemplateCategory;
    components: MetaTemplateComponent[];
    status: TemplateStatus;
    created_at: string;
};

export type Campaign = {
    id: string;
    user_id: string;
    name: string;
    template_id: string;
    status: CampaignStatus;
    sent_at: string;
    recipient_count: number;
};

export type CampaignMessage = {
    id: string;
    campaign_id: string;
    contact_id: string;
    meta_message_id: string | null;
    status: MessageStatus;
    delivered_at: string | null;
    read_at: string | null;
    error_message: string | null;
    created_at: string;
};

export type Automation = {
    created_at: string;
    edges: Edge[];
    id: string;
    name: string;
    nodes: AutomationNode[];
    status: AutomationStatus;
    user_id: string;
};

export type Pipeline = {
    created_at: string;
    id: string;
    name: string;
    user_id: string;
};

export type PipelineStage = {
    created_at: string;
    id: string;
    name: string;
    pipeline_id: string;
    sort_order: number;
};

export type Deal = {
    contact_id: string;
    created_at: string;
    id: string;
    name: string;
    pipeline_id: string;
    stage_id: string;
    updated_at: string;
    user_id: string;
    value: number | null;
};

export type Segment = {
    created_at: string;
    id: string;
    name: string;
    user_id: string;
};

export type SegmentRule = {
    field: string;
    id: string;
    operator: string;
    segment_id: string;
    value: string;
};

export type ReceivedMessage = {
    contact_id: string;
    id: string;
    message_body: string | null;
    meta_message_id: string;
    received_at: string;
    sentiment: string | null;
    user_id: string;
};

export type AutomationRun = {
    automation_id: string;
    contact_id: string | null;
    details: string | null;
    id: string;
    run_at: string;
    status: string;
};

export type AutomationNodeStats = {
    automation_id: string;
    error_count: number;
    last_run_at: string | null;
    node_id: string;
    success_count: number;
};

export type AutomationNodeLog = {
    created_at: string;
    details: string | null;
    id: number;
    node_id: string;
    run_id: string;
    status: string;
};
// --- END of Plain object types ---

// --- CUSTOMIZED INTERFACES ---
export type DealWithContact = Deal & { contacts: Pick<Contact, 'name' | 'id'> | null };

// --- INSERT TYPES ---
export type MessageTemplateInsert = Omit<TablesInsert<'message_templates'>, 'category' | 'status' | 'components'> & {
    user_id: string;
    template_name: string;
    category: TemplateCategory;
    status?: TemplateStatus;
    components: MetaTemplateComponent[];
    meta_id?: string | null;
};

export type CampaignMessageInsert = Omit<TablesInsert<'campaign_messages'>, 'status'> & {
  status: MessageStatus;
};

export type AutomationInsert = Omit<TablesInsert<'automations'>, 'status' | 'nodes' | 'edges'> & {
  user_id: string;
  name: string;
  status: AutomationStatus;
  nodes: AutomationNode[];
  edges: Edge[];
};

export type DealInsert = TablesInsert<'deals'>;

// Tipos para formulários e operações específicas
export type EditableContact = Omit<Contact, 'id' | 'user_id' | 'created_at'> & { id?: string };
export type EditableProfile = Partial<Omit<Profile, 'id' | 'updated_at'>>;

// Tipo combinado para o frontend, que inclui métricas calculadas
export interface CampaignWithMetrics extends Campaign {
    recipient_count: number;
    metrics: {
        sent: number;
        delivered: number;
        read: number;
    };
}

// Tipo para a nova página de detalhes da campanha
export interface CampaignMessageWithContact extends CampaignMessage {
  contacts: Pick<Contact, 'name' | 'phone'> | null;
}

export interface CampaignWithDetails extends Campaign {
  recipient_count: number;
  metrics: {
      sent: number;
      delivered: number;
      read: number;
  };
  messages: CampaignMessageWithContact[];
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
export type { Session, User, Edge, Json };