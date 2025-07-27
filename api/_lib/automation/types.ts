import { AutomationNode, Contact, Json, Profile } from '../types.js';

export interface ActionContext {
    profile: Profile;
    contact: Contact | null;
    trigger: Json | null;
    node: AutomationNode;
    automationId: string;
    teamId: string;
}

export interface ActionResult {
    updatedContact?: Contact;
    nextNodeHandle?: 'yes' | 'no' | 'a' | 'b';
    details?: string;
}

export type ActionHandler = (context: ActionContext) => Promise<ActionResult>;