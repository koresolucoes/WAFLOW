import React from 'react';
import { NodeData } from '../../types';
import TriggerSettings from '../../pages/AutomationEditor/node-settings/TriggerSettings';
import SendTemplateSettings from '../../pages/AutomationEditor/node-settings/SendTemplateSettings';
import SendWebhookSettings from '../../pages/AutomationEditor/node-settings/SendWebhookSettings';
import ActionSettings from '../../pages/AutomationEditor/node-settings/ActionSettings';
import LogicSettings from '../../pages/AutomationEditor/node-settings/LogicSettings';


interface NodeConfig {
    label: string;
    nodeType: 'trigger' | 'action' | 'logic';
    data: Partial<NodeData>;
    SettingsComponent: React.FC<any>;
}

export const nodeConfigs: Record<string, NodeConfig> = {
    // Triggers
    'webhook_received': {
        label: 'Webhook Recebido',
        nodeType: 'trigger',
        data: {
            nodeType: 'trigger',
            type: 'webhook_received',
            label: 'Webhook Recebido',
            config: { last_captured_data: null, data_mapping: [] }
        },
        SettingsComponent: TriggerSettings,
    },
    // Actions
    'send_template': {
        label: 'Enviar Template',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'send_template',
            label: 'Enviar Template',
            config: { template_id: '' }
        },
        SettingsComponent: SendTemplateSettings,
    },
     'send_text_message': {
        label: 'Enviar Texto Simples',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'send_text_message',
            label: 'Enviar Texto Simples',
            config: { message_text: '' }
        },
        SettingsComponent: ActionSettings,
    },
    'add_tag': {
        label: 'Adicionar Tag',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'add_tag',
            label: 'Adicionar Tag',
            config: { tag: '' }
        },
        SettingsComponent: ActionSettings,
    },
    'remove_tag': {
        label: 'Remover Tag',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'remove_tag',
            label: 'Remover Tag',
            config: { tag: '' }
        },
        SettingsComponent: ActionSettings,
    },
     'set_custom_field': {
        label: 'Definir Campo Personalizado',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'set_custom_field',
            label: 'Definir Campo Personalizado',
            config: { field_name: '', field_value: '' }
        },
        SettingsComponent: ActionSettings,
    },
     'send_media': {
        label: 'Enviar Mídia',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'send_media',
            label: 'Enviar Mídia',
            config: { media_type: 'image', media_url: '', caption: '' }
        },
        SettingsComponent: ActionSettings,
    },
    'send_interactive_message': {
        label: 'Enviar Msg Interativa',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'send_interactive_message',
            label: 'Enviar Msg Interativa',
            config: { message_text: '', buttons: [] }
        },
        SettingsComponent: ActionSettings,
    },
    'send_webhook': {
        label: 'Enviar Webhook',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'send_webhook',
            label: 'Enviar Webhook',
            config: { method: 'POST', url: '', body: '' }
        },
        SettingsComponent: SendWebhookSettings,
    },
    // Logic
    'condition': {
        label: 'Condição (Se/Senão)',
        nodeType: 'logic',
        data: {
            nodeType: 'logic',
            type: 'condition',
            label: 'Condição (Se/Senão)',
            config: { field: '', operator: 'contains', value: '' }
        },
        SettingsComponent: LogicSettings,
    },
    'split_path': {
        label: 'Dividir Caminho (A/B)',
        nodeType: 'logic',
        data: {
            nodeType: 'logic',
            type: 'split_path',
            label: 'Dividir Caminho (A/B)',
            config: {}
        },
        SettingsComponent: LogicSettings,
    },
};