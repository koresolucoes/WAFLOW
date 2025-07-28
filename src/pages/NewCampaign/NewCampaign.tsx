import React, { useState, useMemo, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import InfoCard from '../../components/common/InfoCard';
import { Contact, CampaignStatus } from '../../types';
import TemplatePreview from '../../components/common/TemplatePreview';
import { useAuthStore } from '../../stores/authStore';

// Helper functions for variable substitution
const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

const resolveVariables = (text: string, context: { contact: Contact | null }): string => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
        const trimmedPath = path.trim();
        const value = getValueFromPath(context, trimmedPath);
        
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        
        return value !== undefined ? String(value) : `{{${trimmedPath}}}`;
    });
};


const NewCampaign: React.FC = () => {
  const { templates, contacts, addCampaign, pageParams, setCurrentPage } = useAuthStore();
  
  const [campaignName, setCampaignName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [throttleRate, setThrottleRate] = useState(60);


  const template = useMemo(() => {
    return templates.find(t => t.id === pageParams.templateId);
  }, [pageParams.templateId, templates]);

  const placeholders = useMemo(() => {
    if (!template?.components) return [];
    let allText = '';
    template.components.forEach(c => {
        if (c.text) {
            allText += c.text + ' ';
        }
        if (c.type === 'BUTTONS' && c.buttons) {
            c.buttons.forEach(b => {
                if (b.type === 'URL' && b.url) {
                    allText += b.url + ' ';
                }
            });
        }
    });
    const matches = allText.match(/\{\{\d+\}\}/g) || [];
    return [...new Set(matches)].sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
    });
  }, [template]);

  useEffect(() => {
    const initialVars: Record<string, string> = {};
    if (placeholders) {
        placeholders.forEach(p => {
          if (p !== '{{1}}') { // {{1}} é sempre o nome do contato, não precisa de input
            initialVars[p] = '';
          }
        });
    }
    setTemplateVariables(initialVars);
  }, [placeholders]);
  
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    contacts.forEach(c => c.tags?.forEach(t => tagsSet.add(t.trim())));
    return Array.from(tagsSet).sort();
  }, [contacts]);

  const recipients = useMemo(() => {
    if (sendToAll) {
      return contacts;
    }
    if (selectedTags.length === 0) {
      return [];
    }
    return contacts.filter(contact =>
      contact.tags && selectedTags.every(tag => contact.tags!.includes(tag))
    );
  }, [contacts, selectedTags, sendToAll]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleVariableChange = (placeholder: string, value: string) => {
    setTemplateVariables(prev => ({ ...prev, [placeholder]: value }));
  };
  
  const handleConfirmOpen = () => {
    setError(null);
    if (!campaignName.trim() || !template) {
      setError('Por favor, dê um nome para a sua campanha.');
      return;
    }
    if (isScheduled && !scheduleDate) {
        setError("Por favor, selecione uma data e hora para o agendamento.");
        return;
    }
    if (isScheduled && new Date(scheduleDate) <= new Date()) {
        setError("A data de agendamento deve ser no futuro.");
        return;
    }
    if (template.status !== 'APPROVED') {
      setError(`Este template não pode ser usado pois seu status é '${template.status}'. Apenas templates 'APPROVED' podem ser enviados.`);
      return;
    }
    for (const key in templateVariables) {
      if (!templateVariables[key]) {
        setError(`Por favor, preencha o valor para a variável ${key}.`);
        return;
      }
    }
     if (recipients.length === 0) {
      setError("Não há contatos selecionados para esta campanha.");
      return;
    }
    setIsConfirmModalOpen(true);
  }

  const handleLaunch = async () => {
    if (!template) return;
    setIsConfirmModalOpen(false);
    setIsLoading(true);
    setError(null);

    try {
        const campaignData = {
            name: campaignName,
            template_id: template.id,
            status: (isScheduled ? 'Scheduled' : 'Sending') as CampaignStatus,
            sent_at: isScheduled ? new Date(scheduleDate).toISOString() : new Date().toISOString(),
            throttle_rate: throttleRate,
            throttle_unit: 'minute' as 'minute' | 'hour',
        };

        await addCampaign(campaignData, recipients.map(r => r.id), templateVariables);
        setIsResultsModalOpen(true);

    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
};
  
  const previewName = useMemo(() => {
     return recipients[0]?.name || contacts[0]?.name || 'Cliente';
  }, [recipients, contacts]);


  if (!template) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Template não encontrado.</h2>
        <p className="text-slate-400 mt-2">Por favor, volte e selecione um template para começar.</p>
        <Button className="mt-4" onClick={() => setCurrentPage('templates')}>Voltar para Templates</Button>
      </div>
    );
  }

  const variablePlaceholders = placeholders.filter(p => p !== '{{1}}');
  

  return (
    <>
      <div className="space-y-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white">Lançar Nova Campanha</h1>
        
        {error && <Card className="border-l-4 border-red-500"><p className="text-red-400">{error}</p></Card>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Card className="space-y-6">
            <div>
              <label htmlFor="campaignName" className="block text-sm font-medium text-slate-300 mb-1">1. Nome da Campanha</label>
              <input
                type="text"
                id="campaignName"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Promoção de Verão - VIPs"
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">2. Controle de Velocidade</label>
               <div className="p-4 bg-slate-700/50 rounded-md space-y-2">
                    <label htmlFor="throttleRate" className="block text-xs font-medium text-slate-400">Mensagens por Minuto</label>
                    <input
                        type="number"
                        id="throttleRate"
                        value={throttleRate}
                        onChange={(e) => setThrottleRate(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        min="1"
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                    />
                    <InfoCard>
                        Controle a velocidade de envio para evitar bloqueios e gerenciar o fluxo de respostas. Recomendamos iniciar com no máximo 60 mensagens/minuto.
                    </InfoCard>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">3. Agendamento (Opcional)</label>
              <div className="p-4 bg-slate-700/50 rounded-md">
                <label htmlFor="isScheduled" className="flex items-center cursor-pointer">
                  <input type="checkbox" id="isScheduled" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-sky-600 focus:ring-sky-500"/>
                  <span className="ml-3 text-sm font-medium text-white">Agendar envio</span>
                </label>
                {isScheduled && (
                  <div className="mt-3">
                    <label htmlFor="scheduleDate" className="block text-xs font-medium text-slate-400 mb-1">Data e Hora do Envio</label>
                    <input
                      type="datetime-local"
                      id="scheduleDate"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {variablePlaceholders.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">4. Preencher Variáveis</label>
                 <p className="text-xs text-slate-400 mb-2">
                    Você pode usar variáveis como {"{{contact.name}}"}, {"{{contact.email}}"}, ou {"{{contact.custom_fields.sua_chave}}"} nos campos.
                </p>
                <div className="space-y-3 p-4 bg-slate-700/50 rounded-md">
                  {variablePlaceholders.map(p => (
                    <div key={p}>
                      <label htmlFor={`var-${p}`} className="block text-xs font-medium text-slate-400 mb-1">
                        Variável {p}
                      </label>
                      <input
                        type="text"
                        id={`var-${p}`}
                        value={templateVariables[p] || ''}
                        onChange={(e) => handleVariableChange(p, e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                        placeholder={`Valor para ${p}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {variablePlaceholders.length > 0 ? '5.' : '4.'} Selecionar Destinatários
              </label>
              <div className="space-y-3 p-4 bg-slate-700/50 rounded-md">
                  <div className="flex items-center">
                      <input type="radio" id="sendToAll" name="recipientType" checked={sendToAll} onChange={() => setSendToAll(true)} className="h-4 w-4 text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"/>
                      <label htmlFor="sendToAll" className="ml-3 block text-sm font-medium text-white">
                          Todos os Contatos ({contacts.length})
                      </label>
                  </div>
                  <div className="flex items-center">
                      <input type="radio" id="sendToSegment" name="recipientType" checked={!sendToAll} onChange={() => setSendToAll(false)} className="h-4 w-4 text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"/>
                      <label htmlFor="sendToSegment" className="ml-3 block text-sm font-medium text-white">
                          Segmentar por Tags
                      </label>
                  </div>
                  {!sendToAll && (
                      <div className="pl-7 pt-2 space-y-2 max-h-48 overflow-y-auto">
                          {allTags.length > 0 ? (
                              allTags.map(tag => (
                                  <div key={tag} className="flex items-center">
                                      <input
                                          id={`tag-${tag}`}
                                          type="checkbox"
                                          checked={selectedTags.includes(tag)}
                                          onChange={() => handleTagToggle(tag)}
                                          className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-sky-600 focus:ring-sky-500"
                                      />
                                      <label htmlFor={`tag-${tag}`} className="ml-3 text-sm text-slate-300">
                                          {tag}
                                      </label>
                                  </div>
                              ))
                          ) : (
                              <p className="text-sm text-slate-400">Nenhuma tag encontrada nos seus contatos.</p>
                          )}
                      </div>
                  )}
                  <div className="pt-2 text-center text-sm font-semibold text-sky-300">
                      <p>Total de destinatários selecionados: {recipients.length}</p>
                  </div>
              </div>
            </div>

            <Button onClick={handleConfirmOpen} size="lg" className="w-full" isLoading={isLoading} disabled={!campaignName || recipients.length === 0}>
              <span>{isScheduled ? '🗓️ Revisar e Agendar' : '🚀 Revisar e Lançar Campanha'}</span>
            </Button>
          </Card>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Prévia da Mensagem</h2>
            <TemplatePreview 
                components={template.components}
                recipientName={previewName}
                variables={templateVariables}
            />
          </div>
        </div>
      </div>

       <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirmar Campanha"
        >
            <div className="text-slate-300 space-y-4">
                <p>Você está prestes a {isScheduled ? 'agendar' : 'enfileirar para envio'} a campanha <strong className="text-white">{campaignName}</strong>.</p>
                <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
                     <p><strong>Template:</strong> <span className="font-mono text-sky-300">{template?.template_name}</span></p>
                     <p><strong>Total de destinatários:</strong> <span className="font-bold text-white">{recipients.length.toLocaleString('pt-BR')}</span></p>
                     <p><strong>Velocidade:</strong> <span className="font-bold text-white">{throttleRate} mensagens/minuto</span></p>
                     {isScheduled && <p><strong>Agendada para:</strong> <span className="font-bold text-white">{new Date(scheduleDate).toLocaleString('pt-BR')}</span></p>}
                </div>
                <p className="text-amber-400 text-sm">Esta ação não pode ser desfeita. Tem certeza de que deseja continuar?</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleLaunch} isLoading={isLoading}>
                    Sim, {isScheduled ? 'Agendar Agora' : 'Enfileirar Agora'}
                </Button>
            </div>
        </Modal>

        <Modal
            isOpen={isResultsModalOpen}
            onClose={() => setCurrentPage('campaigns')}
            title={isScheduled ? "Campanha Agendada!" : "Campanha na Fila de Envio!"}
        >
            <div className="text-slate-300 space-y-4">
                <p>A campanha <strong className="text-white">{campaignName}</strong> foi {isScheduled ? 'agendada com sucesso' : 'enfileirada para envio'}.</p>
                 <p>Você pode acompanhar o progresso na página de Campanhas.</p>
            </div>
            <div className="mt-6 flex justify-end">
                <Button variant="primary" onClick={() => setCurrentPage('campaigns')}>
                    Ir para Campanhas
                </Button>
            </div>
        </Modal>
    </>
  );
};

export default NewCampaign;
