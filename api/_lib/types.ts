

import { Json as DbJson, Tables, TablesInsert, TablesUpdate } from './database.types.js';
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
  nodeType: NodeType;
  type: TriggerType | ActionType | LogicType;
  label: string;
  config: Json;
}

// --- Plain object types to avoid TS recursion from generated types ---
export type Profile = Tables<'profiles'>;
export type Contact = Tables<'contacts'>;

export type MessageTemplate = Omit<Tables<'message_templates'>, 'category' | 'status' | 'components'> & {
    category: TemplateCategory;
    status: TemplateStatus;
    components: MetaTemplateComponent[];
};

export type Automation = Omit<Tables<'automations'>, 'nodes' | 'edges' | 'status'> & {
    nodes: AutomationNode[];
    edges: BackendEdge[];
    status: AutomationStatus;
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