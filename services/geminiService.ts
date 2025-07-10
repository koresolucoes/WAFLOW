
import { CompanyProfileData, MessageTemplate } from '../types';

export const generateTemplateWithAI = async (
  profile: CompanyProfileData,
  campaignGoal: string
): Promise<MessageTemplate> => {
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
        // Usa a mensagem de erro do servidor se disponível, caso contrário, uma genérica.
        throw new Error(errorData.message || `Ocorreu um erro: ${response.statusText}`);
    }

    const data: MessageTemplate = await response.json();
    return data;

  } catch (error: any) {
    console.error("Erro ao chamar a API generate-template:", error);
    // Re-lança o erro para ser tratado pelo componente que o chamou (TemplateEditor).
    throw new Error(error.message || "Falha ao gerar o template. Por favor, verifique sua conexão com a internet.");
  }
};
