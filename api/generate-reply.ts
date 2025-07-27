import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Self-contained types for the serverless function.
interface CompanyProfileData {
  name: string;
  description: string;
  products: string;
  audience: string;
  tone: string;
}

interface ConversationMessage {
    type: 'inbound' | 'outbound';
    content: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try {
        if (!process.env.API_KEY) {
            console.error("API_KEY environment variable is not set.");
            return res.status(500).json({ message: 'Server configuration error: API_KEY not found.' });
        }

        const { profile, instruction, conversationHistory } = req.body as { 
            profile: CompanyProfileData, 
            instruction: string,
            conversationHistory: ConversationMessage[]
        };

        if (!profile || !instruction || !conversationHistory) {
             return res.status(400).json({ message: 'Missing `profile`, `instruction`, or `conversationHistory` in request body.' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const formattedHistory = conversationHistory
            .map(msg => `${msg.type === 'inbound' ? 'Cliente' : 'Você'}: ${msg.content}`)
            .join('\n');

        const prompt = `
            Você é um assistente de atendimento ao cliente prestativo e profissional para a empresa: ${profile.name || 'nossa empresa'}.
            Descrição da Empresa: ${profile.description || 'Não fornecida.'}
            Produtos/Serviços: ${profile.products || 'Não fornecidos.'}
            Tom de Voz Desejado: ${profile.tone || 'Profissional e amigável'}.

            Sua tarefa é escrever uma resposta útil para um cliente com base em uma instrução e no histórico recente da conversa.

            Histórico recente da conversa (última mensagem por último):
            ${formattedHistory}

            Instrução para sua resposta:
            "${instruction}"

            Com base em todas as informações acima, gere a resposta para o cliente.
            - Siga estritamente o tom de voz da empresa.
            - Seja conciso e claro.
            - NÃO adicione nenhum texto extra, saudações ou despedidas que não façam parte da própria resposta. Por exemplo, nunca comece com "Aqui está a resposta:" ou "Claro, aqui está uma resposta:".
            - Retorne apenas o texto da mensagem de resposta.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const reply = response.text || '';

        return res.status(200).json({ reply });

    } catch (error: any) {
        console.error("Error in generate-reply function:", error);
        return res.status(500).json({ message: "Failed to generate AI reply.", error: error.message });
    }
}
