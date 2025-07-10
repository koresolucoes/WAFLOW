import React, { useState, useContext, useMemo } from 'react';
import { generateTemplateWithAI } from '../../services/geminiService';
import { createMetaTemplate } from '../../services/meta/templates';
import { AppContext } from '../../contexts/AppContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { SPARKLES_ICON, PLUS_ICON, TRASH_ICON } from '../../components/icons';
import { MessageTemplate, MessageTemplateInsert } from '../../types';
import { MetaTemplateComponent, MetaButton } from '../../services/meta/types';
import TemplatePreview from '../../components/common/TemplatePreview';

type EditableTemplate = Omit<MessageTemplateInsert, 'id' | 'user_id' | 'created_at' | 'status' | 'meta_id'>;

const TemplateEditor: React.FC = () => {
  const { profile, addTemplate, setCurrentPage, metaConfig } = useContext(AppContext);
  const [campaignGoal, setCampaignGoal] = useState('');
  const [template, setTemplate] = useState<EditableTemplate>({
    template_name: '',
    category: 'MARKETING',
    components: [{ type: 'BODY', text: '' }],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const header = useMemo(() => template.components.find(c => c.type === 'HEADER'), [template.components]);
  const body = useMemo(() => template.components.find(c => c.type === 'BODY'), [template.components]);
  const footer = useMemo(() => template.components.find(c => c.type === 'FOOTER'), [template.components]);
  const buttonsComponent = useMemo(() => template.components.find(c => c.type === 'BUTTONS'), [template.components]);

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
    if (!template.template_name || !body?.text) {
        setError("O nome do template e o corpo da mensagem são obrigatórios.");
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
        await addTemplate({ ...template, meta_id: result.id, status: 'PENDING' });
        alert('Template enviado para a Meta com sucesso! Ele aparecerá como PENDENTE até ser aprovado.');
        setCurrentPage('templates');
    } catch (err: any) {
        setError(err.message || 'Ocorreu um erro inesperado ao salvar na Meta.');
    } finally {
        setIsSaving(false);
    }
  };

  const handleMainInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTemplate(prev => ({...prev, [name]: value}));
  };

  const updateComponent = (type: 'HEADER' | 'BODY' | 'FOOTER', text: string) => {
    setTemplate(prev => ({
        ...prev,
        components: prev.components.map(c => c.type === type ? { ...c, text } : c)
    }));
  };

  const toggleComponent = (type: 'HEADER' | 'FOOTER' | 'BUTTONS') => {
    setTemplate(prev => {
        const hasComponent = prev.components.some(c => c.type === type);
        if (hasComponent) {
            return { ...prev, components: prev.components.filter(c => c.type !== type) };
        } else {
            const newComponent: MetaTemplateComponent = type === 'BUTTONS' ? { type, buttons: [] } : { type, text: '' };
            return { ...prev, components: [...prev.components, newComponent] };
        }
    });
  };

  const addComponentButton = (type: 'HEADER' | 'FOOTER' | 'BUTTONS', label: string) => {
    const exists = template.components.some(c => c.type === type);
    return (
        <Button variant="secondary" size="sm" onClick={() => toggleComponent(type)}>
            {exists ? <TRASH_ICON className="w-4 h-4 mr-2" /> : <PLUS_ICON className="w-4 h-4 mr-2" />}
            {exists ? `Remover ${label}` : `Adicionar ${label}`}
        </Button>
    );
  };
  
  const handleButtonChange = (index: number, field: keyof MetaButton, value: string) => {
     setTemplate(prev => ({
         ...prev,
         components: prev.components.map(c => {
             if (c.type === 'BUTTONS') {
                 const updatedButtons = c.buttons?.map((b, i) => i === index ? { ...b, [field]: value } : b);
                 return { ...c, buttons: updatedButtons };
             }
             return c;
         })
     }));
  };

  const addInteractiveButton = (type: MetaButton['type']) => {
      setTemplate(prev => ({
          ...prev,
          components: prev.components.map(c => {
              if (c.type === 'BUTTONS') {
                  const newButton: MetaButton = { type, text: '' };
                  if (type === 'URL') newButton.url = 'https://';
                  if (type === 'PHONE_NUMBER') newButton.phone_number = '';
                  const buttons = [...(c.buttons || []), newButton];
                  return { ...c, buttons };
              }
              return c;
          })
      }));
  };
  
  const removeInteractiveButton = (index: number) => {
       setTemplate(prev => ({
          ...prev,
          components: prev.components.map(c => {
              if (c.type === 'BUTTONS') {
                  return { ...c, buttons: c.buttons?.filter((_, i) => i !== index) };
              }
              return c;
          })
      }));
  };


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white">Editor de Templates</h1>

      {error && <Card className="border-l-4 border-red-500"><p className="text-red-400">{error}</p></Card>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Coluna de Edição */}
        <div className="space-y-6">
            <Card>
                <h2 className="text-xl font-semibold text-white mb-4">1. Gerar com IA (Opcional)</h2>
                <div className="space-y-4">
                    <label htmlFor="campaignGoal" className="block text-sm font-medium text-slate-300">
                        Descreva o objetivo da sua campanha
                    </label>
                    <textarea id="campaignGoal" value={campaignGoal} onChange={(e) => { setCampaignGoal(e.target.value); setError(null); }}
                        placeholder="Ex: Anunciar um desconto de 20% em novos produtos para a temporada de verão e levar o cliente para o site."
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        rows={3}
                    />
                    <Button onClick={handleGenerate} isLoading={isGenerating} disabled={!campaignGoal}>
                        <SPARKLES_ICON className="w-5 h-5 mr-2" />
                        Gerar Template
                    </Button>
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold text-white mb-4">2. Configurar e Editar Template</h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="template_name" className="block text-sm font-medium text-slate-300 mb-1">Nome do Template (snake_case)</label>
                        <input type="text" name="template_name" id="template_name" value={template.template_name} onChange={handleMainInputChange} placeholder="ex: promocao_verao_20" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Categoria</label>
                        <select name="category" id="category" value={template.category} onChange={handleMainInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                            <option value="MARKETING">MARKETING</option>
                            <option value="UTILITY">UTILITY</option>
                            <option value="AUTHENTICATION">AUTHENTICATION</option>
                        </select>
                    </div>

                    <div className="border-t border-slate-700 pt-4 space-y-2">
                        <h3 className="text-lg font-semibold text-white">Componentes</h3>
                        <div className="flex gap-2 flex-wrap">
                            {addComponentButton('HEADER', 'Cabeçalho')}
                            {addComponentButton('FOOTER', 'Rodapé')}
                            {addComponentButton('BUTTONS', 'Botões')}
                        </div>
                    </div>

                    {header && (
                        <div>
                            <label htmlFor="header" className="block text-sm font-medium text-slate-300 mb-1">Cabeçalho (Header)</label>
                            <input type="text" name="header" id="header" value={header.text || ''} onChange={(e) => updateComponent('HEADER', e.target.value)} placeholder="Título da mensagem..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="body" className="block text-sm font-medium text-slate-300 mb-1">Corpo da Mensagem (Obrigatório)</label>
                        <textarea name="body" id="body" value={body?.text || ''} onChange={(e) => updateComponent('BODY', e.target.value)} rows={8} placeholder="O conteúdo da sua mensagem. Use {{1}} para o nome do cliente." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm"></textarea>
                    </div>

                    {footer && (
                         <div>
                            <label htmlFor="footer" className="block text-sm font-medium text-slate-300 mb-1">Rodapé (Footer)</label>
                            <input type="text" name="footer" id="footer" value={footer.text || ''} onChange={(e) => updateComponent('FOOTER', e.target.value)} placeholder="Texto de rodapé..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                    )}

                    {buttonsComponent && (
                        <div className="border-t border-slate-700 pt-4 space-y-3">
                           <h3 className="text-lg font-semibold text-white">Botões Interativos</h3>
                           {buttonsComponent.buttons?.map((btn, index) => (
                               <div key={index} className="p-3 bg-slate-700/50 rounded-lg space-y-2 relative">
                                   <button onClick={() => removeInteractiveButton(index)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-400"><TRASH_ICON className="w-4 h-4" /></button>
                                   <p className="text-sm font-semibold text-sky-300">{btn.type}</p>
                                   <div>
                                       <label className="text-xs text-slate-400">Texto do Botão</label>
                                       <input type="text" value={btn.text} onChange={(e) => handleButtonChange(index, 'text', e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm" />
                                   </div>
                                   {btn.type === 'URL' && (
                                       <div>
                                           <label className="text-xs text-slate-400">URL</label>
                                           <input type="text" value={btn.url || ''} onChange={(e) => handleButtonChange(index, 'url', e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm" />
                                       </div>
                                   )}
                                   {btn.type === 'PHONE_NUMBER' && (
                                        <div>
                                           <label className="text-xs text-slate-400">Número de Telefone</label>
                                           <input type="text" value={btn.phone_number || ''} onChange={(e) => handleButtonChange(index, 'phone_number', e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm" />
                                       </div>
                                   )}
                               </div>
                           ))}
                           { (buttonsComponent.buttons?.length || 0) < 3 && (
                                <div className="flex gap-2 flex-wrap">
                                    <Button size="sm" variant="ghost" onClick={() => addInteractiveButton('QUICK_REPLY')}>+ Resposta Rápida</Button>
                                    <Button size="sm" variant="ghost" onClick={() => addInteractiveButton('URL')}>+ Acessar URL</Button>
                                    <Button size="sm" variant="ghost" onClick={() => addInteractiveButton('PHONE_NUMBER')}>+ Ligar</Button>
                                </div>
                           )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
        
        {/* Coluna de Preview */}
        <div className="sticky top-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. Pré-visualização</h2>
            <TemplatePreview components={template.components} recipientName="Ana Silva" />
             <div className="mt-6">
                <Button onClick={handleSave} variant="primary" size="lg" className="w-full" isLoading={isSaving} disabled={!template.template_name || !body?.text}>
                    Salvar e Enviar para Aprovação
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;