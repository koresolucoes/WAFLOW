import { MetaConfig } from "../../types";
import { MetaApiErrorResponse } from "./types";

const API_VERSION = 'v23.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

async function metaApiClient<T>(
    config: MetaConfig,
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    if (!config.accessToken) {
        throw new Error("Token de Acesso da Meta não configurado.");
    }

    const url = `${BASE_URL}${endpoint}`;

    const headers = new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
        ...options.headers,
    });

    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData: MetaApiErrorResponse = await response.json();
            console.error("Erro da API da Meta:", errorData);
            throw new Error(`Erro da Meta: ${errorData.error.message} (Code: ${errorData.error.code})`);
        }

        // Se a resposta não tiver corpo (ex: DELETE), retorna um sucesso genérico
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { success: true } as T;
        }

        return await response.json() as T;

    } catch (error) {
        console.error(`Falha na chamada para o endpoint da Meta: ${endpoint}`, error);
        if (error instanceof Error) {
           throw error;
        }
        throw new Error("Ocorreu um erro desconhecido ao comunicar com a API da Meta.");
    }
}

export default metaApiClient;