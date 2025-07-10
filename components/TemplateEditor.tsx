
import React, { useState } from 'react';
import { CompanyProfileData, MessageTemplate } from '../types';
import { generateTemplateWithAI } from '../services/geminiService';
import Card from './ui/Card';
import Button from './ui/Button';
import { SPARKLES_ICON } from '../constants';

interface TemplateEditorProps {
  companyProfile: CompanyProfileData;
  onSaveTemplate: (template: MessageTemplate) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ companyProfile, onSaveTemplate }) => {
  const [campaignGoal, setCampaignGoal] = useState('');
  const [template, setTemplate] = useState<MessageTemplate>({
    templateName: '',
    category: 'MARKETING',
    body: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!campaignGoal) {
      setError('Por favor, descreva o objetivo da campanha.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const generatedTemplate = await generateTemplateWithAI(companyProfile, campaignGoal);
      setTemplate(generatedTemplate);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!template.templateName || !template.body || !template.category) {
        alert("Por favor, preencha todos os campos do template antes de salvar.");
        return;
    }
    onSaveTemplate(template);
    // Reset form after saving
    setCampaignGoal('');
    setTemplate({ templateName: '', category: 'MARKETING', body: '' });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => ({...prev, [name]: value}));
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white">Editor de Templates com IA</h1>
      
      <Card>
        <div className="space-y-4">
          <label htmlFor="campaignGoal" className="block text-sm font-medium text-slate-300">
            1. Descreva o objetivo da sua campanha
          </label>
          <textarea
            id="campaignGoal"
            value={campaignGoal}
            onChange={(e) => {
                setCampaignGoal(e.target.value)
                setError(null)
            }}
            placeholder="Ex: Anunciar um desconto de 20% em novos produtos para a temporada de verão."
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            rows={3}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button onClick={handleGenerate} isLoading={isLoading} disabled={!campaignGoal}>
            <SPARKLES_ICON className="w-5 h-5 mr-2" />
            Gerar com IA
          </Button>
        </div>
      </Card>
      
      <Card>
        <h2 className="text-xl font-semibold text-white mb-4">2. Edite e Visualize o Template</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div>
                    <label htmlFor="templateName" className="block text-sm font-medium text-slate-300 mb-1">Nome do Template</label>
                    <input type="text" name="templateName" id="templateName" value={template.templateName} onChange={handleInputChange} placeholder="ex: promocao_verao_20" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Categoria</label>
                    <select name="category" id="category" value={template.category} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                        <option>MARKETING</option>
                        <option>UTILITY</option>
                        <option>AUTHENTICATION</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="body" className="block text-sm font-medium text-slate-300 mb-1">Corpo da Mensagem</label>
                    <textarea name="body" id="body" value={template.body} onChange={handleInputChange} rows={8} placeholder="O conteúdo da sua mensagem aparecerá aqui..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm"></textarea>
                </div>
            </div>
            {/* Phone Preview */}
            <div className="flex flex-col items-center justify-center">
                <div className="relative w-72 h-[550px] bg-slate-900 border-4 border-slate-600 rounded-[40px] shadow-2xl p-4">
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-b-lg"></div>
                    <div className="mt-8 bg-green-900/50 rounded-lg p-3 text-white text-sm shadow-inner">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{template.body || "A prévia da sua mensagem aparecerá aqui..."}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} variant="primary" disabled={!template.templateName || !template.body}>
                Salvar Template
            </Button>
        </div>
      </Card>
    </div>
  );
};

export default TemplateEditor;
