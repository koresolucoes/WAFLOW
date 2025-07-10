import { Session, User } from '@supabase/supabase-js';
import { Database, Tables, TablesInsert, Json } from './database.types';
import { MetaTemplateComponent } from '../services/meta/types';

export type Page = 'dashboard' | 'campaigns' | 'templates' | 'template-editor' | 'contacts' | 'new-campaign' | 'profile' | 'settings' | 'auth' | 'campaign-details';

// Derivando tipos diretamente do schema do banco de dados para consistência
export type Profile = Tables<'profiles'>;
export type Contact = Tables<'contacts'>;

// Tipo personalizado para MessageTemplate para garantir que 'components' seja fortemente tipado
export type MessageTemplate = Omit<Tables<'message_templates'>, 'components'> & {
  components: MetaTemplateComponent[];
};
export type MessageTemplateInsert = Omit<TablesInsert<'message_templates'>, 'components'> & {
  components: MetaTemplateComponent[];
};


export type Campaign = Tables<'campaigns'>;
export type CampaignMessage = Tables<'campaign_messages'>;
export type CampaignMessageInsert = TablesInsert<'campaign_messages'>;
export type Segment = Tables<'segments'>;
export type SegmentRule = Tables<'segment_rules'>;
export type ReceivedMessage = Tables<'received_messages'>;


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
export type { Session, User };