import { MetaTemplateComponent } from "./meta/types";
import { UnifiedMessage } from "../types";

// This type is defined locally to match the structure expected by the AI service,
// based on the data provided from the user's profile.
interface CompanyProfileForAI {
  name: string | null;
  description: string | null;
  products: string | null;
  audience: string | null;
  tone: string | null;
}

// This function now expects the template structure without the ID,
// as the ID will be assigned by the context upon saving.
export const generateTemplateWithAI = async (
  profile: CompanyProfileForAI,
  campaignGoal: string
): Promise<{ template_name: string; category: string; components: MetaTemplateComponent[]; }> => {
  try {
    const response = await fetch('/api/generate-template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profile, campaignGoal }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ocorreu um erro: ${response.statusText}` }));
        throw new Error(errorData.message || `Ocorreu um erro: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error: any) {
    console.error("Erro ao chamar a API generate-template:", error);
    throw new Error(error.message || "Falha ao gerar o template. Por favor, verifique sua conexão com a internet.");
  }
};

type SimpleMessage = Pick<UnifiedMessage, 'type' | 'content'>;

export const generateReplyWithAI = async (
  instruction: string,
  profile: CompanyProfileForAI,
  conversationHistory: SimpleMessage[]
): Promise<string> => {
  try {
     const response = await fetch('/api/generate-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instruction, profile, conversationHistory }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ocorreu um erro: ${response.statusText}` }));
        throw new Error(errorData.message || `Ocorreu um erro: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.reply || '';

  } catch (error: any) {
    console.error("Erro ao chamar a API generate-reply:", error);
    throw new Error(error.message || "Falha ao gerar resposta com IA. Verifique sua conexão.");
  }
};
