import { Session, User } from '@supabase/supabase-js';
import { Json, TablesInsert } from './database.types';
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


// Base table types defined explicitly to avoid deep type instantiation errors
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
  meta_webhook_verify_token: string | null;
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  tags: string[] | null;
  created_at: string;
};

export type Segment = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type SegmentRule = {
  id: string;
  segment_id: string;
  field: string;
  operator: string;
  value: string;
};

export type ReceivedMessage = {
  id: string;
  user_id: string;
  contact_id: string;
  meta_message_id: string;
  message_body: string | null;
  sentiment: string | null;
  received_at: string;
};

export type AutomationRun = {
  id: string;
  automation_id: string;
  contact_id: string | null;
  run_at: string;
  status: string;
  details: string | null;
};


// Custom types with stricter enum-like properties
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

export type MessageTemplateInsert = {
  user_id: string;
  meta_id?: string | null;
  template_name: string;
  category: TemplateCategory;
  components: MetaTemplateComponent[];
  status: TemplateStatus;
  created_at?: string;
  id?: string;
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

export type CampaignMessageInsert = {
  campaign_id: string;
  contact_id: string;
  status: MessageStatus;
  meta_message_id?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  created_at?: string;
  id?: string;
};

export type Automation = {
  id: string;
  user_id: string;
  name: string;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  trigger_config: Json;
  action_type: AutomationActionType;
  action_config: Json;
  created_at: string;
};

export type AutomationInsert = {
  user_id: string;
  name: string;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  trigger_config: Json;
  action_type: AutomationActionType;
  action_config: Json;
  created_at?: string;
  id?: string;
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
