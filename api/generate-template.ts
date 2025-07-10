import { GoogleGenAI, Type } from "@google/genai";

// Definindo os tipos aqui para uma função serverless autocontida
// para evitar problemas de caminho no empacotamento da Vercel.
interface CompanyProfileData {
  name: string;
  description: string;
  products: string;
  audience: string;
  tone: string;
}

// Assinatura da Serverless Function da Vercel usando Request/Response nativos
export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Apenas requisições POST são permitidas' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
        });
    }

    // Verifica a presença da chave de API no servidor
    if (!process.env.API_KEY) {
        console.error("A variável de ambiente API_KEY não está definida.");
        return new Response(JSON.stringify({ message: 'Erro de configuração do servidor.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { profile, campaignGoal } = (await req.json()) as { profile: CompanyProfileData, campaignGoal: string };

        if (!profile || !campaignGoal) {
             return new Response(JSON.stringify({ message: 'Faltando `profile` ou `campaignGoal` no corpo da requisição.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
            Com base no perfil da empresa e no objetivo da campanha a seguir, gere um modelo de mensagem completo para o WhatsApp, em conformidade com as políticas da Meta.

            **Perfil da Empresa:**
            - Nome: ${profile.name}
            - Descrição: ${profile.description}
            - Produtos/Serviços: ${profile.products}
            - Público-alvo: ${profile.audience}
            - Tom de Voz Desejado: ${profile.tone}

            **Objetivo da Campanha:**
            ${campaignGoal}

            **Instruções para Geração:**
            1.  **Estrutura JSON:** Gere uma estrutura de componentes JSON completa.
            2.  **Componentes:** O componente 'BODY' é obrigatório. Inclua opcionalmente 'HEADER', 'FOOTER' e 'BUTTONS' se forem relevantes para o objetivo.
                *   **HEADER**: Um título curto e chamativo para a mensagem. Use o formato 'TEXT'.
                *   **BODY**: O texto principal, conciso e em português do Brasil. Use placeholders como '{{1}}' para o nome do cliente.
                *   **FOOTER**: Uma linha de texto curta no final, como um slogan ou um aviso.
                *   **BUTTONS**: Se a campanha tiver uma chamada para ação clara, adicione até 3 botões. Tipos de botão podem ser 'URL' (para um link), 'PHONE_NUMBER' (para ligar), ou 'QUICK_REPLY' (para uma resposta rápida).
            3.  **Nome do Template:** O nome do template ('template_name') deve ser em 'snake_case', com letras minúsculas, números e underscores.
            4.  **Categoria:** A categoria ('category') deve ser uma das seguintes: 'MARKETING', 'UTILITY', 'AUTHENTICATION'. Escolha a mais apropriada.
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                template_name: {
                    type: Type.STRING,
                    description: "Um nome curto e descritivo para o template em snake_case (ex: 'promocao_verao'). Deve conter apenas letras minúsculas, números e underscores."
                },
                category: {
                    type: Type.STRING,
                    description: "A categoria do template. Deve ser uma das seguintes: MARKETING, UTILITY, AUTHENTICATION."
                },
                components: {
                    type: Type.ARRAY,
                    description: "Uma matriz de componentes do template. Deve conter um objeto para BODY e pode conter opcionalmente para HEADER, FOOTER, e BUTTONS.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: {
                                type: Type.STRING,
                                description: "O tipo de componente: 'HEADER', 'BODY', 'FOOTER', ou 'BUTTONS'."
                            },
                            format: {
                                type: Type.STRING,
                                description: "Opcional. Para HEADER, deve ser 'TEXT'."
                            },
                            text: {
                                type: Type.STRING,
                                description: "O conteúdo de texto para HEADER, BODY, ou FOOTER. Use placeholders como {{1}}."
                            },
                            buttons: {
                                type: Type.ARRAY,
                                description: "Obrigatório se o tipo for 'BUTTONS'. Uma matriz de objetos de botão.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        type: {
                                            type: Type.STRING,
                                            description: "Tipo de botão: 'QUICK_REPLY', 'URL', ou 'PHONE_NUMBER'."
                                        },
                                        text: {
                                            type: Type.STRING,
                                            description: "O texto exibido no botão (máx 20 caracteres)."
                                        },
                                        url: {
                                            type: Type.STRING,
                                            description: "Obrigatório se o tipo for 'URL'. A URL para abrir. Pode usar variáveis."
                                        },
                                        phone_number: {
                                            type: Type.STRING,
                                            description: "Obrigatório se o tipo for 'PHONE_NUMBER'. O número de telefone a ser discado."
                                        }
                                    },
                                    required: ["type", "text"]
                                }
                            }
                        },
                        required: ["type"]
                    }
                }
            },
            required: ["template_name", "category", "components"]
        };
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        // Limpa a resposta da IA para garantir que é um JSON válido
        let jsonText = response.text.trim();
        // Remove ```json e ``` do início e fim, se presentes
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.substring(0, jsonText.length - 3);
        }

        return new Response(jsonText, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("Erro na função generate-template:", error);
        return new Response(JSON.stringify({ message: "Falha ao gerar o template com IA.", error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}