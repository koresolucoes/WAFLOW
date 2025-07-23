
import { ActionHandler } from '../types.js';
import { addTag, removeTag, setCustomField } from './contact.js';
import { sendWebhook } from './integrations.js';
import { condition, splitPath } from './logic.js';
import { sendTemplate, sendTextMessageAction, sendMediaAction, sendInteractiveMessageAction } from './messaging.js';
import { triggerHandler } from './trigger.js';

export const actionHandlers: Record<string, ActionHandler> = {
    // Triggers
    'message_received_with_keyword': triggerHandler,
    'button_clicked': triggerHandler,
    'new_contact': triggerHandler,
    'new_contact_with_tag': triggerHandler,
    'webhook_received': triggerHandler,

    // Actions - Contact
    'add_tag': addTag,
    'remove_tag': removeTag,
    'set_custom_field': setCustomField,

    // Actions - Messaging
    'send_template': sendTemplate,
    'send_text_message': sendTextMessageAction,
    'send_media': sendMediaAction,
    'send_interactive_message': sendInteractiveMessageAction,

    // Actions - Integrations
    'send_webhook': sendWebhook,

    // Logic
    'condition': condition,
    'split_path': splitPath,
};
