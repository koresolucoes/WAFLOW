
import { Json as DbJson, Database, Tables, TablesInsert, TablesUpdate } from './database.types.js';
import { MetaTemplateComponent } from './meta/types.js';

export type Json = DbJson;
export type { Tables, TablesInsert, TablesUpdate };

// --- Backend-safe Flow Types ---
export interface BackendNode<T = any> {
  id: string;
  position: { x: number; y: number };
  data: T;
  type?: string;
  width?: number | null;
  height?: number | null;
  selected?: boolean;
  positionAbsolute?: { x: number; y: number };
  dragging?: boolean;
}

export interface BackendEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export type AutomationNode = BackendNode<NodeData>;

// --- String literal unions ---
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'LOCAL';
export type AutomationStatus = 'active' | 'paused';
export type NodeType = 'trigger' | 'action' | 'logic';

export type TriggerType = 'new_contact_with_tag' | 'message_received_with_keyword' | 'button_clicked' | 'new_contact' | 'webhook_received';
export type ActionType = 'send_template' | 'add_tag' | 'remove_tag' | 'send_text_message' | 'send_media' | 'send_interactive_message' | 'set_custom_field' | 'send_webhook';
export type LogicType = 'condition' | 'split_path';

// --- Data Structures ---
export interface NodeData {
  [key: string]: any;
  nodeType: NodeType;
  type: TriggerType | ActionType | LogicType;
  label: string;
  config: Json;
}

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

export type Automation = {
    created_at: string;
    edges: BackendEdge[];
    id: string;
    name: string;
    nodes: AutomationNode[];
    status: AutomationStatus;
    user_id: string;
};
// --- END of Plain object types ---


export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}

export interface ActionContext {
    profile: Profile;
    contact: Contact | null;
    trigger: Json | null;
    node: AutomationNode;
}
