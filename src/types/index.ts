


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


export interface AutomationNodeData {
  [key: string]: any;
  nodeType: NodeType;
  type: TriggerType | ActionType | LogicType;
  label: string;
  config: Json;
}

export type AutomationNode = XyNode<AutomationNodeData>;

// --- Plain object types to avoid TS recursion from generated types ---
export type Profile = Tables<'profiles'>;
export type Contact = Tables<'contacts'>;

export type MessageTemplate = Omit<Tables<'message_templates'>, 'category' | 'status' | 'components'> & {
    category: TemplateCategory;
    status: TemplateStatus;
    components: MetaTemplateComponent[];
};

export type Campaign = Tables<'campaigns'> & {
    status: CampaignStatus;
};

export type CampaignMessage = Tables<'campaign_messages'> & {
    status: MessageStatus;
};

export type Automation = Omit<Tables<'automations'>, 'nodes' | 'edges' | 'status'> & {
    nodes: AutomationNode[];
    edges: Edge[];
    status: AutomationStatus;
};

export type Pipeline = Tables<'pipelines'>;
export type PipelineStage = Tables<'pipeline_stages'>;
export type Deal = Tables<'deals'>;
export type Segment = Tables<'segments'>;
export type SegmentRule = Tables<'segment_rules'>;
export type ReceivedMessage = Tables<'received_messages'>;
export type AutomationRun = Tables<'automation_runs'>;
export type AutomationNodeStats = Tables<'automation_node_stats'>;
export type AutomationNodeLog = Tables<'automation_node_logs'>;

// --- END of Plain object types ---

// --- CUSTOMIZED INTERFACES ---
export type DealWithContact = Deal & {
    contacts: Pick<Contact, 'id' | 'name'> | null;
};

// --- INSERT TYPES ---
export interface MessageTemplateInsert extends Omit<TablesInsert<'message_templates'>, 'category' | 'status' | 'components'> {
    user_id: string;
    template_name: string;
    category: TemplateCategory;
    status?: TemplateStatus;
    components: MetaTemplateComponent[];
    meta_id?: string | null;
}

export interface CampaignMessageInsert extends Omit<TablesInsert<'campaign_messages'>, 'status'> {
  status: MessageStatus;
}

export interface AutomationInsert extends Omit<TablesInsert<'automations'>, 'status' | 'nodes' | 'edges'> {
  user_id: string;
  name: string;
  status: AutomationStatus;
  nodes: AutomationNode[];
  edges: Edge[];
}

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