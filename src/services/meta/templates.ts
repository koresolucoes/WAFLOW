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
        let newComponent: MetaTemplateComponent = { ...component };

        // Lógica para exemplos de HEADER e BODY
        if ((newComponent.type === 'HEADER' || newComponent.type === 'BODY') && newComponent.text) {
            const placeholders = newComponent.text.match(/\{\{\d+\}\}/g);
            if (placeholders && placeholders.length > 0) {
                const exampleValues = placeholders.map(p => `[Exemplo ${p.replace(/\{|\}/g, '')}]`);
                if (newComponent.type === 'BODY') {
                    // O formato { body_text: [exampleValues] } cria corretamente a estrutura string[][]
                    newComponent.example = { body_text: [exampleValues] };
                } else { // HEADER
                    newComponent.example = { header_text: exampleValues };
                }
            }
        }

        // Lógica para exemplos de botões de URL
        if (newComponent.type === 'BUTTONS' && newComponent.buttons) {
            const buttonUrlExamples: string[] = [];
            newComponent.buttons.forEach(button => {
                // A Meta espera um exemplo para cada botão de URL que contém uma variável.
                if (button.type === 'URL' && button.url && /\{\{1\}\}/.test(button.url)) {
                    // A API da Meta espera um exemplo de sufixo para a URL.
                    // Ex: se a URL é https://a.b/{{1}}, um exemplo pode ser "produto/123"
                    buttonUrlExamples.push("exemplo-de-link-dinamico");
                }
            });

            if (buttonUrlExamples.length > 0) {
                // Adiciona o array de exemplos ao componente BUTTONS
                newComponent.example = buttonUrlExamples;
            }
        }
        
        return newComponent;
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
