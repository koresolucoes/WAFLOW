import { Session, User } from '@supabase/supabase-js';
import { Database, Tables, TablesInsert, Json } from './database.types';
import { MetaTemplateComponent } from '../services/meta/types';

export type Page = 'dashboard' | 'campaigns' | 'templates' | 'template-editor' | 'contacts' | 'new-campaign' | 'profile' | 'settings' | 'auth' | 'campaign-details' | 'automations' | 'automation-editor';

// String literal unions to replace DB enums for type safety in the app
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'LOCAL';
export type CampaignStatus = 'Sent' | 'Draft' | 'Failed';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type AutomationStatus = 'active' | 'paused';
export type AutomationTriggerType = 'new_contact_with_tag' | 'message_received_with_keyword' | 'webhook_received';
export type AutomationActionType = 'send_template' | 'add_tag' | 'http_request';
export type AutomationRunStatus = 'success' | 'failed';


// Base table types
export type Profile = Tables<'profiles'>;
export type Contact = Tables<'contacts'>;
export type Segment = Tables<'segments'>;
export type SegmentRule = Tables<'segment_rules'>;
export type ReceivedMessage = Tables<'received_messages'>;
export type AutomationRun = Tables<'automation_runs'>;


// Custom types with stricter enum-like properties
export type MessageTemplate = Omit<Tables<'message_templates'>, 'components' | 'category' | 'status'> & {
  components: MetaTemplateComponent[];
  category: TemplateCategory;
  status: TemplateStatus;
};
export type MessageTemplateInsert = Omit<TablesInsert<'message_templates'>, 'components' | 'category' | 'status'> & {
  components: MetaTemplateComponent[];
  category: TemplateCategory;
  status: TemplateStatus;
};

export type Campaign = Omit<Tables<'campaigns'>, 'status'> & {
    status: CampaignStatus;
};
export type CampaignMessage = Omit<Tables<'campaign_messages'>, 'status'> & {
    status: MessageStatus;
};
export type CampaignMessageInsert = Omit<TablesInsert<'campaign_messages'>, 'status'> & {
    status: MessageStatus;
};
export type Automation = Omit<Tables<'automations'>, 'status' | 'trigger_type' | 'action_type'> & {
    status: AutomationStatus;
    trigger_type: AutomationTriggerType;
    action_type: AutomationActionType;
};
export type AutomationInsert = Omit<TablesInsert<'automations'>, 'status' | 'trigger_type' | 'action_type'> & {
    status: AutomationStatus;
    trigger_type: AutomationTriggerType;
    action_type: AutomationActionType;
};


// Tipos para formulários e operações específicas
export type EditableContact = Omit<Contact, 'id' | 'user_id' | 'created_at'> & { id?: string };
export type EditableProfile = Omit<Profile, 'id' | 'updated_at'>;

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
  webhookVerifyToken?: string;
}

// Tipos de Autenticação
export type { Session, User, Json, TablesInsert };
