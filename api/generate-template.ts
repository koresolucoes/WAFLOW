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
            Com base no perfil da empresa e no objetivo da campanha a seguir, gere um modelo de mensagem do WhatsApp que esteja em conformidade com as políticas da Meta.

            **Perfil da Empresa:**
            - Nome: ${profile.name}
            - Descrição: ${profile.description}
            - Produtos/Serviços: ${profile.products}
            - Público-alvo: ${profile.audience}
            - Tom de Voz Desejado: ${profile.tone}

            **Objetivo da Campanha:**
            ${campaignGoal}

            **Instruções:**
            1.  Gere uma estrutura de componentes JSON, incluindo um HEADER (com 'format': 'TEXT') e um BODY.
            2.  A mensagem deve ser amigável, profissional e concisa, em português do Brasil.
            3.  O HEADER deve ser um título curto e chamativo para a mensagem.
            4.  O BODY deve conter o texto principal e incluir placeholders para personalização, como {{1}} para o nome do cliente.
            5.  A categoria deve ser uma das seguintes: MARKETING, UTILITY, AUTHENTICATION.
            6.  O nome do template deve estar em snake_case, usando apenas letras minúsculas, números e underscores.
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
                    description: "Uma matriz de componentes do template. Deve conter um objeto para HEADER e um para BODY.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: {
                                type: Type.STRING,
                                description: "O tipo de componente, 'HEADER' ou 'BODY'."
                            },
                            format: {
                                type: Type.STRING,
                                description: "O formato para o HEADER, deve ser 'TEXT'."
                            },
                            text: {
                                type: Type.STRING,
                                description: "O conteúdo de texto para o componente. Use placeholders como {{1}} no BODY."
                            }
                        },
                        required: ["type", "text"]
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

        return new Response(response.text, {
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