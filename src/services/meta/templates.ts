import { MetaConfig } from "../../types";
import metaApiClient from "./apiClient";
import { MetaTemplate, MetaTemplateComponent, MetaTemplateCreationPayload } from "./types";

/**
 * Busca templates de mensagem da conta da Meta.
 * @param config - Configuração da API da Meta.
 * @returns Uma lista de templates da Meta.
 */
export const getMetaTemplates = async (config: MetaConfig): Promise<MetaTemplate[]> => {
    if (!config.wabaId) throw new Error("ID da Conta WhatsApp Business (WABA ID) não configurado.");
    
    const response = await metaApiClient<{ data: MetaTemplate[] }>(
        config,
        `/${config.wabaId}/message_templates?fields=name,status,category,language,components`
    );
    return response.data;
};

/**
 * Cria um novo template de mensagem na plataforma da Meta.
 * @param config - Configuração da API da Meta.
 * @param template - O template a ser criado.
 * @returns O resultado da criação do template.
 */
export const createMetaTemplate = async (
    config: MetaConfig,
    template: { 
        templateName: string; 
        category: string; 
        components: MetaTemplateComponent[];
    }
): Promise<{ id: string }> => {
    if (!config.wabaId) throw new Error("ID da Conta WhatsApp Business (WABA ID) não configurado.");

    // Adiciona valores de exemplo para cada componente que possuir variáveis
    const componentsWithExamples = template.components.map(component => {
        if (component.text) {
            const placeholders = component.text.match(/\{\{\d+\}\}/g);
            if (placeholders && placeholders.length > 0) {
                const exampleValues = placeholders.map((p, i) => `[Exemplo ${p.replace(/\{|\}/g, '')}]`);
                if (component.type === 'BODY') {
                    return { ...component, example: { body_text: [exampleValues] } };
                }
                if (component.type === 'HEADER') {
                    return { ...component, example: { header_text: exampleValues } };
                }
            }
        }
        return component;
    });

    const payload: MetaTemplateCreationPayload = {
        name: template.templateName.toLowerCase(),
        language: 'pt_BR',
        category: template.category.toUpperCase() as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
        components: componentsWithExamples
    };

    return metaApiClient<{ id: string }>(
        config,
        `/${config.wabaId}/message_templates`,
        {
            method: 'POST',
            body: JSON.stringify(payload)
        }
    );
};