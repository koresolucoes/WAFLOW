// Tipos baseados na documentação da Meta WhatsApp Business API

interface MetaBodyExample {
    body_text: string[][];
}
interface MetaHeaderExample {
    header_text: string[];
}
interface MetaUrlButtonExample {
    url_suffix_example: string;
}

export interface MetaButton {
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
    url_suffix_example?: string;
}

export interface MetaTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
    buttons?: MetaButton[];
    example?: MetaBodyExample | MetaHeaderExample | MetaUrlButtonExample;
}

export interface MetaApiErrorResponse {
    error: {
        message: string;
        type: string;
        code: number;
        error_subcode?: number;
        fbtrace_id: string;
    };
}

// Para criar um template
export interface MetaTemplateCreationPayload {
    name: string;
    language: string; // ex: 'pt_BR'
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    components: MetaTemplateComponent[];
}

// Resposta ao buscar templates
export interface MetaTemplate {
    id: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
    name: string;
    language: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    components: MetaTemplateComponent[];
}

// Para enviar uma mensagem de template
export interface MetaMessagePayload {
    messaging_product: 'whatsapp';
    to: string; // número de telefone do destinatário
    type: 'template';
    template: {
        name: string;
        language: {
            code: string;
        };
        components?: any[]; // Componentes com variáveis
    };
}