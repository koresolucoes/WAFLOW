import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Definindo os tipos aqui para uma função serverless autocontida
// para evitar problemas de caminho no empacotamento da Vercel.
interface CompanyProfileData {
  name: string;
  description: string;
  products: string;
  audience: string;
  tone: string;
}

// Assinatura da Serverless Function da Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Apenas requisições POST são permitidas' });
    }

    try {
        // Verifica a presença da chave de API no servidor
        if (!process.env.API_KEY) {
            console.error("A variável de ambiente API_KEY não está definida.");
            return res.status(500).json({ message: 'Erro de configuração do servidor: a variável de ambiente API_KEY não foi encontrada.' });
        }

        const { profile, campaignGoal } = req.body as { profile: CompanyProfileData, campaignGoal: string };

        if (!profile || !campaignGoal) {
             return res.status(400).json({ message: 'Faltando `profile` ou `campaignGoal` no corpo da requisição.' });
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
            1.  **Nome do Template:** Gere um 'template_name' em 'snake_case' (letras minúsculas, números, underscores) com no máximo 512 caracteres.
            2.  **Categoria:** A 'category' deve ser 'MARKETING', 'UTILITY', ou 'AUTHENTICATION'. Escolha a mais apropriada.
            3.  **Estrutura JSON:** Gere a estrutura de componentes JSON completa. O componente 'BODY' é obrigatório.
            4.  **Texto do Botão:** O texto de qualquer botão ('text') deve ter no máximo 20 caracteres.
            
            **Regras por Categoria:**
            - **Se a categoria for MARKETING ou UTILITY:**
                *   Inclua opcionalmente 'HEADER', 'FOOTER' e 'BUTTONS' se forem relevantes.
                *   HEADER: Título curto e chamativo (formato 'TEXT').
                *   BODY: Texto principal, conciso, em português do Brasil. Use placeholders como '{{1}}' para personalização (ex: nome do cliente).
                *   FOOTER: Linha de texto curta (slogan, aviso).
                *   BUTTONS: Se houver uma chamada para ação clara, adicione até 3 botões ('URL', 'PHONE_NUMBER', ou 'QUICK_REPLY').
            - **Se a categoria for AUTHENTICATION:**
                *   O 'BODY' DEVE conter um placeholder para o código, como '{{1}}'. (Ex: "Seu código de acesso é {{1}}.").
                *   NÃO inclua um componente 'BUTTONS'.
                *   Você PODE incluir um 'HEADER' com o nome do app/empresa.
                *   Você PODE incluir um 'FOOTER' com um aviso de segurança (Ex: "Não compartilhe este código.").
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                template_name: {
                    type: Type.STRING,
                    description: "Um nome curto e descritivo para o template em snake_case (ex: 'promocao_verao'). Deve conter apenas letras minúsculas, números e underscores, com no máximo 512 caracteres."
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
                responseSchema: schema as any,
            },
        });

        // Limpa a resposta da IA para garantir que é um JSON válido
        let jsonText = (response.text || '').trim();
        // Remove ```json e ``` do início e fim, se presentes
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.substring(0, jsonText.length - 3);
        }
        
        const parsedData = JSON.parse(jsonText);
        // Garante que o retorno é o objeto de template, não um objeto aninhado.
        const templateData = parsedData.template || parsedData;

        return res.status(200).json(templateData);

    } catch (error: any) {
        console.error("Erro na função generate-template:", error);
        return res.status(500).json({ message: "Falha ao gerar o template com IA.", error: error.message });
    }
}