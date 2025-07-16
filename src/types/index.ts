


import { Session, User } from '@supabase/supabase-js';
import { Json, Tables, TablesInsert, TablesUpdate } from './database.types';
import { MetaTemplateComponent } from '../services/meta/types';
import type { Node as XyNode, Edge } from '@xyflow/react';

export type Page = 'dashboard' | 'campaigns' | 'templates' | 'template-editor' | 'contacts' | 'new-campaign' | 'profile' | 'settings' | 'auth' | 'campaign-details' | 'automations' | 'automation-editor';

// String literal unions to replace DB enums for type safety in the app
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'LOCAL';
export type CampaignStatus = 'Sent' | 'Draft' | 'Failed';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type AutomationStatus = 'active' | 'paused';
export type AutomationRunStatus = 'success' | 'failed';

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

// --- DATABASE TABLE TYPES ---
export type Profile = Tables<'profiles'>;
export type Contact = Tables<'contacts'>;
export type Segment = Tables<'segments'>;
export type SegmentRule = Tables<'segment_rules'>;
export type ReceivedMessage = Tables<'received_messages'>;
export type AutomationRun = Tables<'automation_runs'>;


// --- CUSTOMIZED TYPES ---
export type MessageTemplate = Omit<Tables<'message_templates'>, 'category' | 'status' | 'components'> & {
  category: TemplateCategory;
  status: TemplateStatus;
  components: MetaTemplateComponent[];
};

export type Campaign = Omit<Tables<'campaigns'>, 'status'> & {
  status: CampaignStatus;
};

export type CampaignMessage = Omit<Tables<'campaign_messages'>, 'status'> & {
  status: MessageStatus;
};

export type Automation = Omit<Tables<'automations'>, 'status' | 'nodes' | 'edges'> & {
  status: AutomationStatus;
  nodes: AutomationNode[];
  edges: Edge[];
};

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


// Tipos para formulários e operações específicas
export type EditableContact = Omit<Contact, 'id' | 'user_id' | 'created_at'> & { id?: string };
export type EditableProfile = Partial<Omit<Profile, 'id' | 'updated_at'>>;

// Tipo combinado para o frontend, que inclui métricas calculadas
export interface CampaignWithMetrics extends Campaign {
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
  metrics: {
      sent: number;
      delivered: number;
      read: number;
  };
  messages: CampaignMessageWithContact[];
  message_templates: MessageTemplate | null;
}


// Tipo para as configurações da Meta, derivado do perfil
export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}

// Tipos de Autenticação
export type { Session, User, Json, Tables, TablesInsert, TablesUpdate, Edge };