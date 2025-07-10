// Tipos baseados na documentação da Meta WhatsApp Business API

interface MetaBodyExample {
    body_text: string[][];
}
interface MetaHeaderExample {
    header_text: string[];
}
// O tipo 'MetaUrlButtonExample' foi removido porque o exemplo para botões de URL
// é um array de strings diretamente no componente, não um objeto.

export interface MetaButton {
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
    // A propriedade 'url_suffix_example' foi removida.
    // O exemplo é fornecido no nível do componente 'BUTTONS'.
}

export interface MetaTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
    buttons?: MetaButton[];
    // O tipo de 'example' foi atualizado para incluir 'string[]'
    // para os exemplos de botões de URL, conforme a documentação oficial da Meta.
    example?: MetaBodyExample | MetaHeaderExample | string[];
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
