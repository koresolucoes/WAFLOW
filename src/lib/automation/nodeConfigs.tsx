

import React from 'react';
import { AutomationNodeData } from '../../types';
import MetaTriggerSettings from '../../pages/AutomationEditor/node-settings/MetaTriggerSettings';
import SendTemplateSettings from '../../pages/AutomationEditor/node-settings/SendTemplateSettings';
import SendWebhookSettings from '../../pages/AutomationEditor/node-settings/SendWebhookSettings';
import ActionSettings from '../../pages/AutomationEditor/node-settings/ActionSettings';
import LogicSettings from '../../pages/AutomationEditor/node-settings/LogicSettings';
import TriggerSettings from '../../pages/AutomationEditor/node-settings/TriggerSettings';


interface NodeConfig {
    label: string;
    nodeType: 'trigger' | 'action' | 'logic';
    data: Partial<AutomationNodeData>;
    SettingsComponent: React.FC<any>;
    description: (data: AutomationNodeData) => string;
    isConfigured: (data: AutomationNodeData) => boolean;
}

const truncate = (str: string, length: number) => (str && str.length > length) ? `${str.substring(0, length)}...` : str;

export const nodeConfigs: Record<string, NodeConfig> = {
    // Triggers
     'message_received_with_keyword': {
        label: 'Mensagem Recebida (Palavra-Chave)',
        nodeType: 'trigger',
        data: {
            nodeType: 'trigger',
            type: 'message_received_with_keyword',
            label: 'Mensagem Recebida (Palavra-Chave)',
            config: { keyword: '' }
        },
        SettingsComponent: MetaTriggerSettings,
        description: data => (data.config as any)?.keyword ? `Quando a mensagem contém "${truncate((data.config as any).keyword, 20)}"` : 'Configurar palavra-chave.',
        isConfigured: data => !!(data.config as any)?.keyword,
    },
    'button_clicked': {
        label: 'Botão Clicado',
        nodeType: 'trigger',
        data: {
            nodeType: 'trigger',
            type: 'button_clicked',
            label: 'Botão Clicado',
            config: { button_payload: '' }
        },
        SettingsComponent: MetaTriggerSettings,
        description: data => (data.config as any)?.button_payload ? `Quando o botão "${truncate((data.config as any).button_payload, 20)}" é clicado` : 'Configurar ID do botão.',
        isConfigured: data => !!(data.config as any)?.button_payload,
    },
    'new_contact': {
        label: 'Novo Contato Criado',
        nodeType: 'trigger',
        data: {
            nodeType: 'trigger',
            type: 'new_contact',
            label: 'Novo Contato Criado',
            config: {}
        },
        SettingsComponent: MetaTriggerSettings,
        description: () => 'Quando um novo contato é criado.',
        isConfigured: () => true,
    },
    'new_contact_with_tag': {
        label: 'Tag Adicionada a Contato',
        nodeType: 'trigger',
        data: {
            nodeType: 'trigger',
            type: 'new_contact_with_tag',
            label: 'Tag Adicionada a Contato',
            config: { tag: '' }
        },
        SettingsComponent: MetaTriggerSettings,
        description: data => (data.config as any)?.tag ? `Quando a tag "${truncate((data.config as any).tag, 25)}" é adicionada` : 'Configurar tag.',
        isConfigured: data => !!(data.config as any)?.tag,
    },
    'webhook_received': {
        label: 'Webhook Recebido',
        nodeType: 'trigger',
        data: {
            nodeType: 'trigger',
            type: 'webhook_received',
            label: 'Webhook Recebido',
            config: { last_captured_data: null, data_mapping: [], is_listening: false }
        },
        SettingsComponent: TriggerSettings,
        description: () => 'Quando dados são recebidos na URL de gatilho.',
        isConfigured: () => true,
    },
    'deal_created': {
        label: 'Novo Negócio Criado',
        nodeType: 'trigger',
        data: { nodeType: 'trigger', type: 'deal_created', label: 'Novo Negócio Criado', config: {} },
        SettingsComponent: MetaTriggerSettings,
        description: () => 'Inicia quando um novo negócio é criado no funil.',
        isConfigured: () => true,
    },
    'deal_stage_changed': {
        label: 'Etapa do Negócio Alterada',
        nodeType: 'trigger',
        data: { nodeType: 'trigger', type: 'deal_stage_changed', label: 'Etapa do Negócio Alterada', config: { pipeline_id: '', stage_id: '' } },
        SettingsComponent: MetaTriggerSettings,
        description: data => {
            const config = data.config as any || {};
            if (config.stage_id) return 'Quando um negócio entra em uma etapa específica.';
            if (config.pipeline_id) return 'Quando um negócio muda de etapa em um funil específico.';
            return 'Configurar funil e/ou etapa.';
        },
        isConfigured: data => !!(data.config as any)?.pipeline_id,
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
        description: data => (data.config as any)?.template_id ? 'Envia uma mensagem de template.' : 'Selecionar um template.',
        isConfigured: data => !!(data.config as any)?.template_id,
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
        description: data => (data.config as any)?.message_text ? `Envia: "${truncate((data.config as any).message_text, 30)}"` : 'Configurar texto da mensagem.',
        isConfigured: data => !!(data.config as any)?.message_text,
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
        description: data => (data.config as any)?.tag ? `Adiciona a tag: "${truncate((data.config as any).tag, 25)}"` : 'Configurar tag.',
        isConfigured: data => !!(data.config as any)?.tag,
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
        description: data => (data.config as any)?.tag ? `Remove a tag: "${truncate((data.config as any).tag, 25)}"` : 'Configurar tag a remover.',
        isConfigured: data => !!(data.config as any)?.tag,
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
        description: data => (data.config as any)?.field_name ? `Define o campo "${truncate((data.config as any).field_name, 20)}"` : 'Configurar campo e valor.',
        isConfigured: data => !!(data.config as any)?.field_name,
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
        description: data => (data.config as any)?.media_url ? `Envia ${(data.config as any).media_type} de uma URL.` : 'Configurar URL da mídia.',
        isConfigured: data => !!(data.config as any)?.media_url,
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
        description: data => (data.config as any)?.message_text ? `Envia "${truncate((data.config as any).message_text, 25)}" com botões` : 'Configurar mensagem interativa.',
        isConfigured: data => {
            const config = data.config as any;
            return !!config?.message_text && Array.isArray(config?.buttons) && config.buttons.length > 0 && config.buttons.every((b: any) => b.text);
        }
    },
    'send_webhook': {
        label: 'HTTP Request',
        nodeType: 'action',
        data: {
            nodeType: 'action',
            type: 'send_webhook',
            label: 'HTTP Request',
            config: {
                method: 'POST',
                url: '',
                sendHeaders: false,
                headers: [{ key: '', value: '' }],
                sendBody: false,
                body: {
                    contentType: 'json',
                    specify: 'fields',
                    params: [{ key: '', value: '' }],
                    rawJson: '{\n  "id": "{{contact.id}}",\n  "name": "{{contact.name}}"\n}'
                }
            }
        },
        SettingsComponent: SendWebhookSettings,
        description: data => (data.config as any)?.url ? `${(data.config as any).method} para ${truncate((data.config as any).url, 30)}` : 'Configurar URL do webhook.',
        isConfigured: data => !!(data.config as any)?.url,
    },
    'create_deal': {
        label: 'Criar Negócio',
        nodeType: 'action',
        data: { nodeType: 'action', type: 'create_deal', label: 'Criar Negócio', config: { deal_name: '', deal_value: '', pipeline_id: '', stage_id: '' } },
        SettingsComponent: ActionSettings,
        description: data => (data.config as any)?.deal_name ? `Cria o negócio: "${truncate((data.config as any).deal_name, 25)}"` : 'Configurar detalhes do negócio.',
        isConfigured: data => !!((data.config as any)?.deal_name && (data.config as any)?.pipeline_id && (data.config as any)?.stage_id),
    },
    'update_deal_stage': {
        label: 'Atualizar Etapa do Negócio',
        nodeType: 'action',
        data: { nodeType: 'action', type: 'update_deal_stage', label: 'Atualizar Etapa do Negócio', config: { pipeline_id: '', stage_id: '' } },
        SettingsComponent: ActionSettings,
        description: data => (data.config as any)?.stage_id ? 'Move o negócio para uma nova etapa.' : 'Configurar etapa de destino.',
        isConfigured: data => !!((data.config as any)?.pipeline_id && (data.config as any)?.stage_id),
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
        description: data => (data.config as any)?.field ? `Se ${truncate((data.config as any).field, 15)} ${(data.config as any).operator}...` : 'Configurar condição.',
        isConfigured: data => !!(data.config as any)?.field,
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
        description: () => 'Divide aleatoriamente o fluxo em dois caminhos.',
        isConfigured: () => true,
    },
};
