-- SPDX-FileCopyrightText: 2024 Vercel, Inc.
-- SPDX-License-Identifier: Apache-2.0

-- Create ENUMS
CREATE TYPE automation_status AS ENUM ('active', 'paused');
CREATE TYPE campaign_status AS ENUM ('Sent', 'Draft', 'Failed', 'Scheduled');
CREATE TYPE custom_field_type AS ENUM ('TEXTO', 'NUMERO', 'DATA', 'LISTA');
CREATE TYPE deal_status AS ENUM ('Aberto', 'Ganho', 'Perdido');
CREATE TYPE message_source AS ENUM ('campaign', 'automation', 'direct', 'inbound_reply');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed', 'pending');
CREATE TYPE message_type AS ENUM ('inbound', 'outbound');
CREATE TYPE stage_type AS ENUM ('Intermediária', 'Ganho', 'Perdido');
CREATE TYPE template_category AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
CREATE TYPE template_status AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'LOCAL');

-- Create TABLES
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(50) DEFAULT 'agent',
    PRIMARY KEY (team_id, user_id)
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_audience TEXT,
    company_description TEXT,
    company_name VARCHAR(255),
    company_products TEXT,
    company_tone VARCHAR(255),
    dashboard_layout JSONB,
    meta_access_token VARCHAR(255),
    meta_phone_number_id VARCHAR(255),
    meta_verify_token VARCHAR(255),
    meta_waba_id VARCHAR(255),
    updated_at TIMESTAMPTZ,
    webhook_path_prefix VARCHAR(255)
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    company VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    custom_fields JSONB,
    email VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(255) NOT NULL,
    sentiment VARCHAR(255),
    tags TEXT[],
    UNIQUE(team_id, phone)
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    category template_category NOT NULL,
    components JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    meta_id VARCHAR(255),
    status template_status DEFAULT 'LOCAL',
    template_name VARCHAR(512) NOT NULL,
    UNIQUE(team_id, template_name)
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    recipient_count INTEGER,
    sent_at TIMESTAMPTZ,
    status campaign_status NOT NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE RESTRICT
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
    automation_id UUID,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    message_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    meta_message_id VARCHAR(255) UNIQUE,
    read_at TIMESTAMPTZ,
    replied_to_message_id UUID,
    sent_at TIMESTAMPTZ,
    source message_source NOT NULL,
    status message_status NOT NULL,
    type message_type NOT NULL
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(team_id, contact_id)
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name VARCHAR(255) NOT NULL
);
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL,
    type stage_type DEFAULT 'Intermediária'
);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE NOT NULL,
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE CASCADE NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
    closed_at TIMESTAMPTZ,
    closing_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    status deal_status DEFAULT 'Aberto',
    updated_at TIMESTAMPTZ,
    value NUMERIC
);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Allow team members to manage resources in their own team" ON teams FOR ALL USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow members to view their own team membership" ON team_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow team owner to manage team members" ON team_members FOR ALL USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));
CREATE POLICY "Allow users to view and edit their own profile" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Allow team members to manage resources in their own team" ON contacts FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow team members to manage resources in their own team" ON message_templates FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow team members to manage resources in their own team" ON campaigns FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow team members to manage resources in their own team" ON messages FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow team members to manage resources in their own team" ON conversations FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow team members to manage resources in their own team" ON pipelines FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY "Allow team members to manage resources in their own team" ON pipeline_stages FOR ALL USING (pipeline_id IN (SELECT id FROM pipelines WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));
CREATE POLICY "Allow team members to manage resources in their own team" ON deals FOR ALL USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
