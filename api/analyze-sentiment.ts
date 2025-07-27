import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

        const { messageText } = req.body as { messageText: string };

        if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
             return res.status(400).json({ message: '`messageText` is required and must be a non-empty string.' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
            Analise o sentimento da seguinte mensagem de um cliente em português do Brasil.
            Classifique-o em uma das seguintes categorias: "Positivo", "Negativo", "Neutro", "Dúvida", "Problema Urgente".
            Associe um emoji apropriado a cada categoria.
            - Positivo: 😊
            - Negativo: 😠
            - Neutro: 🙂
            - Dúvida: ❓
            - Problema Urgente: 🔥

            Mensagem do Cliente: "${messageText}"

            Responda apenas com a estrutura JSON.
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                sentiment: {
                    type: Type.STRING,
                    description: "A categoria de sentimento (Positivo, Negativo, Neutro, Dúvida, Problema Urgente)."
                },
                emoji: {
                    type: Type.STRING,
                    description: "O emoji correspondente ao sentimento."
                },
            },
            required: ["sentiment", "emoji"]
        };
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema as any,
            },
        });

        const jsonText = (response.text || '{}').trim();
        const parsedData = JSON.parse(jsonText);

        return res.status(200).json(parsedData);

    } catch (error: any) {
        console.error("Error in analyze-sentiment function:", error);
        return res.status(500).json({ message: "Failed to analyze sentiment.", error: error.message });
    }
}
