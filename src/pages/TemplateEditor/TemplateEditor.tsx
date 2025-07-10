import React, { useState, useContext } from 'react';
import { generateTemplateWithAI } from '../../services/geminiService';
import { createMetaTemplate } from '../../services/meta/templates';
import { AppContext } from '../../contexts/AppContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { SPARKLES_ICON } from '../../components/icons';
import { MessageTemplate, MessageTemplateInsert } from '../../types';
import { MetaTemplateComponent } from '../../services/meta/types';
import TemplatePreview from '../../components/common/TemplatePreview';

const TemplateEditor: React.FC = () => {
  const { profile, addTemplate, setCurrentPage, metaConfig } = useContext(AppContext);
  const [campaignGoal, setCampaignGoal] = useState('');
  const [template, setTemplate] = useState<Omit<MessageTemplateInsert, 'id' | 'user_id' | 'created_at' | 'status' | 'meta_id'>>({
    template_name: '',
    category: 'MARKETING',
    components: [{ type: 'BODY', text: '' }],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!campaignGoal || !profile) {
      setError('Por favor, descreva o objetivo da campanha e certifique-se de que seu perfil está carregado.');
      return;
    }
    setIsGenerating(true);
    setError(null);

    const companyProfileForAI = {
        name: profile.company_name,
        description: profile.company_description,
        products: profile.company_products,
        audience: profile.company_audience,
        tone: profile.company_tone,
    };

    try {
      const { template_name, category, components } = await generateTemplateWithAI(companyProfileForAI, campaignGoal);
      setTemplate({
          template_name,
          category: category.toUpperCase() as MessageTemplate['category'],
          components,
      });
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado ao gerar com IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!template.template_name || template.components.every(c => !c.text)) {
        setError("Por favor, preencha o nome e o conteúdo do template antes de salvar.");
        return;
    }
     if (!metaConfig.wabaId || !metaConfig.accessToken) {
        setError("Credenciais da Meta não configuradas. Por favor, vá para Configurações.");
        return;
    }

    setIsSaving(true);
    setError(null);

    try {
        const result = await createMetaTemplate(metaConfig, {
            templateName: template.template_name,
            category: template.category,
            components: template.components
        });
        
        await addTemplate({
            ...template,
            meta_id: result.id,
            status: 'PENDING'
        });

        alert('Template enviado para a Meta com sucesso! Ele aparecerá como PENDENTE até ser aprovado.');
        setCurrentPage('templates');
    } catch (err: any) {
        setError(err.message || 'Ocorreu um erro inesperado ao salvar na Meta.');
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => ({...prev, [name]: value}));
  };
  
  const handleComponentChange = (index: number, value: string) => {
    setTemplate(prev => {
        const newComponents = [...prev.components];
        newComponents[index] = { ...newComponents[index], text: value };
        return { ...prev, components: newComponents };
    });
  };

  const headerComponent = template.components.find(c => c.type === 'HEADER');
  const bodyComponent = template.components.find(c => c.type === 'BODY');
  const headerIndex = template.components.findIndex(c => c.type === 'HEADER');
  const bodyIndex = template.components.findIndex(c => c.type === 'BODY');


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white">Editor de Templates com IA</h1>

      {error && <Card className="border-l-4 border-red-500"><p className="text-red-400">{error}</p></Card>}
      
      <Card>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Gere o conteúdo com IA</h2>
          <label htmlFor="campaignGoal" className="block text-sm font-medium text-slate-300">
            Descreva o objetivo da sua campanha
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
          <Button onClick={handleGenerate} isLoading={isGenerating} disabled={!campaignGoal}>
            <SPARKLES_ICON className="w-5 h-5 mr-2" />
            Gerar com IA
          </Button>
        </div>
      </Card>
      
      <Card>
        <h2 className="text-xl font-semibold text-white mb-4">2. Edite e Salve o Template na Meta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div>
                    <label htmlFor="template_name" className="block text-sm font-medium text-slate-300 mb-1">Nome do Template (snake_case)</label>
                    <input type="text" name="template_name" id="template_name" value={template.template_name} onChange={handleInputChange} placeholder="ex: promocao_verao_20" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Categoria</label>
                    <select name="category" id="category" value={template.category} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="AUTHENTICATION">AUTHENTICATION</option>
                    </select>
                </div>
                {headerIndex !== -1 && (
                     <div>
                        <label htmlFor="header" className="block text-sm font-medium text-slate-300 mb-1">Cabeçalho (Header)</label>
                        <input type="text" name="header" id="header" value={headerComponent?.text || ''} onChange={(e) => handleComponentChange(headerIndex, e.target.value)} placeholder="Título da mensagem..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm" />
                    </div>
                )}
                 {bodyIndex !== -1 && (
                    <div>
                        <label htmlFor="body" className="block text-sm font-medium text-slate-300 mb-1">Corpo da Mensagem</label>
                        <textarea name="body" id="body" value={bodyComponent?.text || ''} onChange={(e) => handleComponentChange(bodyIndex, e.target.value)} rows={8} placeholder="O conteúdo da sua mensagem aparecerá aqui..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm"></textarea>
                    </div>
                )}
            </div>
            <TemplatePreview components={template.components} />
        </div>
        <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} variant="primary" isLoading={isSaving} disabled={!template.template_name || template.components.every(c => !c.text)}>
                Salvar e Enviar para Aprovação
            </Button>
        </div>
      </Card>
    </div>
  );
};

export default TemplateEditor;
