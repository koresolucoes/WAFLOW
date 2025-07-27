import { MetaConfig } from "../types.js";
import metaApiClient from "./apiClient.js";
import { MetaTemplate } from "./types.js";

// Simple in-memory cache for template details to avoid redundant API calls.
const templateCache = new Map<string, { details: Pick<MetaTemplate, 'name' | 'language'>, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * Busca os detalhes de um template específico pelo seu ID da Meta.
 * @param config - Configuração da API da Meta.
 * @param templateId - O ID do template na plataforma da Meta (não o ID do banco de dados).
 * @returns Os detalhes do template, incluindo nome e idioma.
 */
export const getMetaTemplateById = async (config: MetaConfig, templateId: string): Promise<Pick<MetaTemplate, 'name' | 'language'>> => {
    // Check cache first
    const cached = templateCache.get(templateId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.details;
    }

    if (!templateId) throw new Error("O ID do template da Meta é necessário.");
    const response = await metaApiClient<{ name: string; language: string; }>(
        config,
        `/${templateId}?fields=name,language`
    );
    const details = { name: response.name, language: response.language };
    
    // Store in cache
    templateCache.set(templateId, { details, timestamp: Date.now() });

    return details;
};
