import { Json as DbJson, Database, Enums, Tables, TablesInsert, TablesUpdate } from './database.types.js';
import { MetaTemplateComponent } from './meta/types.js';

export type Json = DbJson;
export type { TablesInsert, TablesUpdate };

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
export type TemplateCategory = Enums<'template_category'>;
export type TemplateStatus = Enums<'template_status'>;
export type AutomationStatus = Enums<'automation_status'>;
export type AutomationRunStatus = 'running' | 'success' | 'failed';
export type NodeType = 'trigger' | 'action' | 'logic';

export type TriggerType = 'new_contact_with_tag' | 'message_received_with_keyword' | 'button_clicked' | 'new_contact' | 'webhook_received' | 'deal_created' | 'deal_stage_changed';
export type ActionType = 'send_template' | 'add_tag' | 'remove_tag' | 'send_text_message' | 'send_media' | 'send_interactive_message' | 'set_custom_field' | 'send_webhook' | 'create_deal' | 'update_deal_stage';
export type LogicType = 'condition' | 'split_path';

// --- Data Structures ---
export interface NodeData {
  nodeType: NodeType;
  type: TriggerType | ActionType | LogicType;
  label: string;
  config: any;
}

// --- Plain object types to avoid TS recursion from generated types ---
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type Deal = Database['public']['Tables']['deals']['Row'];

export type MessageTemplate = Omit<Database['public']['Tables']['message_templates']['Row'], 'category' | 'status' | 'components'> & {
    category: TemplateCategory;
    status: TemplateStatus;
    components: MetaTemplateComponent[];
};

export type Automation = Omit<Database['public']['Tables']['automations']['Row'], 'nodes' | 'edges' | 'status'> & {
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
    automationId: string;
    teamId: string;
}

export interface TriggerInfo {
  automation_id: string;
  node_id: string;
}
