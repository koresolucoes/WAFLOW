/**
 * =================================================================================================
 * ZAPFLOW AI - SUPABASE DATABASE SCHEMA (v7 - Node Stats & Logs)
 * =================================================================================================
 * 
 * INSTRUÇÕES IMPORTANTES:
 * 1. Copie TODO o conteúdo deste bloco de código SQL.
 * 2. Vá para o painel do seu projeto no Supabase.
 * 3. Navegue até o "SQL Editor".
 * 4. Cole o script e clique em "RUN".
 *
 * Este script irá (re)criar todas as tabelas e adicionar as NOVAS tabelas para estatísticas
 * e logs de nós de automação. Também adiciona uma função RPC para incrementar os contadores
 * de forma atômica, garantindo a precisão dos dados.
 *
 * É seguro executá-lo múltiplas vezes.
 * CUIDADO: A execução deste script apagará dados existentes nas tabelas antigas. FAÇA UM BACKUP PRIMEIRO.
 *
 *
 * --- INÍCIO DO SCRIPT SQL ---
 *
-- Garante que a extensão uuid-ossp está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
-- Garante que a extensão pgcrypto está habilitada para gerar strings aleatórias
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;


-- Remove tabelas existentes na ordem correta para evitar erros de dependência.
DROP TABLE IF EXISTS public.automation_node_logs CASCADE;
DROP TABLE IF EXISTS public.automation_node_stats CASCADE;
DROP TABLE IF EXISTS public.automation_runs CASCADE;
DROP TABLE IF EXISTS public.automations CASCADE;
DROP TABLE IF EXISTS public.campaign_messages CASCADE;
DROP TABLE IF EXISTS public.received_messages CASCADE;
DROP TABLE IF EXISTS public.segment_rules CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.message_templates CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.segments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Tabela de perfis, ligada à autenticação do Supabase
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at timestamp with time zone,
    company_name text,
    company_description text,
    company_products text,
    company_audience text,
    company_tone text,
    meta_access_token text,
    meta_waba_id text,
    meta_phone_number_id text,
    webhook_path_prefix text UNIQUE
);
comment on table public.profiles is 'Armazena o perfil do usuário e os dados de configuração.';

-- Tabela de contatos de cada usuário
CREATE TABLE public.contacts (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    tags text[],
    custom_fields jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contacts_user_id_phone_idx ON public.contacts USING btree (user_id, phone);
comment on table public.contacts is 'Armazena a lista de contatos para cada usuário.';

-- Tabela para os templates de mensagem
CREATE TABLE public.message_templates (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meta_id text,
    template_name text NOT NULL,
    category text NOT NULL,
    components jsonb NOT NULL,
    status text NOT NULL DEFAULT 'LOCAL',
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX message_templates_meta_id_idx ON public.message_templates USING btree (meta_id);
comment on table public.message_templates is 'Armazena templates de mensagem criados ou sincronizados pelo usuário.';

-- Tabela de Segmentos de Contatos
CREATE TABLE public.segments (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
comment on table public.segments is 'Armazena segmentos de contatos definidos pelo usuário.';

-- Tabela de Regras para os Segmentos
CREATE TABLE public.segment_rules (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id uuid NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
    field text NOT NULL,
    operator text NOT NULL,
    value text NOT NULL
);
comment on table public.segment_rules is 'Define as regras para um segmento específico (ex: tag CONTÉM vip).';

-- Tabela para registrar as campanhas enviadas
CREATE TABLE public.campaigns (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    template_id uuid NOT NULL REFERENCES public.message_templates(id),
    status text NOT NULL,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    recipient_count integer NOT NULL DEFAULT 0
);
comment on table public.campaigns is 'Registra cada campanha enviada por um usuário.';

-- Tabela para rastrear cada mensagem individual de uma campanha
CREATE TABLE public.campaign_messages (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    meta_message_id text,
    status text NOT NULL,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX campaign_messages_meta_message_id_idx ON public.campaign_messages USING btree (meta_message_id);
comment on table public.campaign_messages is 'Rastreia o status de cada mensagem individual em uma campanha.';

-- Tabela para armazenar mensagens recebidas dos contatos
CREATE TABLE public.received_messages (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    meta_message_id text UNIQUE NOT NULL,
    message_body text,
    sentiment text,
    received_at timestamp with time zone NOT NULL DEFAULT now()
);
comment on table public.received_messages is 'Armazena mensagens recebidas de contatos via Webhook.';

-- Tabela de Automações com suporte para editor de fluxo (nodes/edges)
CREATE TABLE public.automations (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    nodes jsonb,
    edges jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
comment on table public.automations is 'Armazena fluxos de trabalho de automação baseados em nós e arestas.';

-- Tabela de logs de execução das automações (visão geral)
CREATE TABLE public.automation_runs (
    id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
    run_at timestamp with time zone NOT NULL DEFAULT now(),
    status text NOT NULL,
    details text
);
comment on table public.automation_runs is 'Registra a execução de cada automação.';

-- Tabela para estatísticas por nó
CREATE TABLE public.automation_node_stats (
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    success_count integer NOT NULL DEFAULT 0,
    error_count integer NOT NULL DEFAULT 0,
    last_run_at timestamp with time zone,
    PRIMARY KEY (automation_id, node_id)
);
comment on table public.automation_node_stats is 'Armazena contadores de sucesso e erro para cada nó de uma automação.';

-- Tabela para logs detalhados por nó
CREATE TABLE public.automation_node_logs (
    id bigserial PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    status text NOT NULL, -- 'success' or 'failed'
    details text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX automation_node_logs_run_id_idx ON public.automation_node_logs(run_id);
CREATE INDEX automation_node_logs_node_id_idx ON public.automation_node_logs(node_id);
comment on table public.automation_node_logs is 'Registra um log detalhado para cada execução de nó.';


-- Habilita a Segurança a Nível de Linha (RLS) para todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_node_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_node_logs ENABLE ROW LEVEL SECURITY;

-- Define as políticas de RLS
CREATE POLICY "Users can manage their own profile." ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can manage their own contacts." ON public.contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own templates." ON public.message_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own segments." ON public.segments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage rules for their own segments." ON public.segment_rules FOR ALL USING (auth.uid() = (SELECT user_id FROM public.segments WHERE id = segment_id)) WITH CHECK (auth.uid() = (SELECT user_id FROM public.segments WHERE id = segment_id));
CREATE POLICY "Users can manage their own campaigns." ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage messages from their own campaigns." ON public.campaign_messages FOR ALL USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id)) WITH CHECK (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can manage their own received messages." ON public.received_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own automations." ON public.automations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own automation runs." ON public.automation_runs FOR ALL USING (auth.uid() = (SELECT user_id FROM public.automations WHERE id = automation_id));
CREATE POLICY "Users can view stats for their own automations." ON public.automation_node_stats FOR ALL USING (auth.uid() = (SELECT user_id FROM public.automations WHERE id = automation_id));
CREATE POLICY "Users can view logs for their own automations." ON public.automation_node_logs FOR ALL USING (auth.uid() = (SELECT a.user_id FROM public.automation_runs r JOIN public.automations a ON r.automation_id = a.id WHERE r.id = run_id));


-- Função para criar um perfil automaticamente quando um novo usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, company_name, webhook_path_prefix)
  VALUES (
      new.id, 
      'Minha Nova Empresa', 
      'user-' || encode(public.gen_random_bytes(6), 'hex') -- Gera um prefixo aleatório e único
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho (trigger) que executa a função acima após um novo usuário ser criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função RPC para incrementar contadores de estatísticas de forma atômica
CREATE OR REPLACE FUNCTION public.increment_node_stat(p_automation_id uuid, p_node_id text, p_status text)
RETURNS void AS $$
BEGIN
    INSERT INTO public.automation_node_stats (automation_id, node_id, success_count, error_count, last_run_at)
    VALUES (p_automation_id, p_node_id, 0, 0, now())
    ON CONFLICT (automation_id, node_id) DO NOTHING;

    IF p_status = 'success' THEN
        UPDATE public.automation_node_stats
        SET success_count = success_count + 1, last_run_at = now()
        WHERE automation_id = p_automation_id AND node_id = p_node_id;
    ELSE
        UPDATE public.automation_node_stats
        SET error_count = error_count + 1, last_run_at = now()
        WHERE automation_id = p_automation_id AND node_id = p_node_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

 *
 * --- FIM DO SCRIPT SQL ---
 *
 */

export type Json = string | number | boolean | null | { [key: string]: any } | any[];

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
        Relationships: [
          {
            foreignKeyName: "automation_node_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "automation_node_stats_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "automations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          id: string
          name: string
          recipient_count: number
          sent_at: string
          status: string
          template_id: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          recipient_count?: number
          sent_at?: string
          status: string
          template_id: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          recipient_count?: number
          sent_at?: string
          status?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          custom_fields: Json | null
          id: string
          name: string
          phone: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          id?: string
          name: string
          phone: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          id?: string
          name?: string
          phone?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "message_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "received_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "segment_rules_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "segments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      increment_node_stat: {
        Args: {
          p_automation_id: string
          p_node_id: string
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never