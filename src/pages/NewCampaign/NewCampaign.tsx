import React, { useState, useMemo, useEffect } from 'react';
import { sendTemplatedMessage } from '../../services/meta/messages';
import { getMetaTemplateById } from '../../services/meta/templates';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { MessageInsert, Contact, MessageTemplate } from '../../types';
import TemplatePreview from '../../components/common/TemplatePreview';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { supabase } from '../../lib/supabaseClient';

interface SendResult {
    success: boolean;
    contact: Contact;
    error?: string;
}

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
  const { templates, contacts, addCampaign, pageParams, setCurrentPage, activeTeam } = useAuthStore();
  const metaConfig = useMetaConfig();
  
  const [campaignName, setCampaignName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sendingSpeed, setSendingSpeed] = useState<'instant' | 'slow' | 'very_slow'>('instant');


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
  
  const handleEnqueueCampaignWithQStash = async () => {
    if (!template || !activeTeam) {
        setError("Template ou equipe ativa não encontrados.");
        return;
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Sessão inválida. Por favor, faça login novamente.");
      return;
    }

    try {
        const response = await fetch('/api/enqueue-campaign-send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                campaignName,
                templateId: template.id,
                variables: templateVariables,
                recipients,
                speed: sendingSpeed,
                teamId: activeTeam.id,
                scheduleDate: isScheduled ? scheduleDate : null,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao enfileirar a campanha.');
        }
        
        setSendResults([]);
        setIsResultsModalOpen(true);

    } catch(err: any) {
        setError(err.message);
    }
  };


  const handleLaunch = async () => {
    setIsConfirmModalOpen(false);
    setIsLoading(true);
    setError(null);
    
    if (isScheduled || sendingSpeed !== 'instant') {
        await handleEnqueueCampaignWithQStash();
    } else {
        await handleSendCampaignNow();
    }

    setIsLoading(false);
  };

  const handleSendCampaignNow = async () => {
    if (!template || !metaConfig.phoneNumberId || !metaConfig.accessToken) {
      setError("Configuração ou template inválido. Tente novamente.");
      return;
    }
    
    const results: SendResult[] = [];
    try {
      if (!template.meta_id) {
        throw new Error(`Este template não está sincronizado com a Meta. Por favor, sincronize seus templates e tente novamente.`);
      }

      let metaTemplateDetails: { name: string; language: string; };
      try {
          metaTemplateDetails = await getMetaTemplateById(metaConfig, template.meta_id);
      } catch (err: any) {
          throw new Error(`Falha ao verificar o template na Meta: ${err.message}. Certifique-se de que o template existe e está aprovado.`);
      }
        
      const messagesToInsert: Omit<MessageInsert, 'campaign_id' | 'team_id'>[] = [];
      
      const promises = recipients.map(contact => (async () => {
        try {
            const context = { contact };
            const resolvePlaceholder = (placeholder: string) => {
                const rawValue = placeholder === '{{1}}' ? '{{contact.name}}' : (templateVariables[placeholder] || '');
                return resolveVariables(rawValue, context);
            };

            const finalComponents: any[] = [];
            const templateComponents = template.components || [];

            // Process HEADER
            const headerComponent = templateComponents.find(c => c.type === 'HEADER');
            if (headerComponent?.text) {
                const headerPlaceholders = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
                if (headerPlaceholders.length > 0) {
                    const parameters = headerPlaceholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
                    finalComponents.push({ type: 'header', parameters });
                }
            }

            // Process BODY
            const bodyComponent = templateComponents.find(c => c.type === 'BODY');
            if (bodyComponent?.text) {
                const bodyPlaceholders = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
                if (bodyPlaceholders.length > 0) {
                    const parameters = bodyPlaceholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
                    finalComponents.push({ type: 'body', parameters });
                }
            }

            // Process BUTTONS
            const buttonsComponent = templateComponents.find(c => c.type === 'BUTTONS');
            if (buttonsComponent?.buttons) {
                buttonsComponent.buttons.forEach((button, index) => {
                    if (button.type === 'URL' && button.url) {
                        const buttonPlaceholders = button.url.match(/\{\{\d+\}\}/g) || [];
                        if (buttonPlaceholders.length > 0) {
                            const parameters = buttonPlaceholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
                            finalComponents.push({
                                type: 'button',
                                sub_type: 'url',
                                index: String(index),
                                parameters: parameters,
                            });
                        }
                    }
                });
            }
            
            const response = await sendTemplatedMessage(
                metaConfig,
                contact.phone,
                metaTemplateDetails.name,
                metaTemplateDetails.language,
                finalComponents.length > 0 ? finalComponents : undefined
            );

            let resolvedContent = bodyComponent?.text || '';
            const placeholdersInBody = resolvedContent.match(/\{\{\d+\}\}/g) || [];
            for (const placeholder of placeholdersInBody) {
                resolvedContent = resolvedContent.replace(placeholder, resolvePlaceholder(placeholder));
            }
          
            messagesToInsert.push({
                contact_id: contact.id,
                meta_message_id: response.messages[0].id,
                status: 'sent',
                type: 'outbound',
                source: 'campaign',
                content: resolvedContent,
                sent_at: new Date().toISOString()
            });
            results.push({ success: true, contact });

        } catch (err: any) {
            console.error(`Falha ao enviar para ${contact.name} (${contact.phone}): ${err.message}`);
            messagesToInsert.push({
                contact_id: contact.id,
                status: 'failed',
                error_message: err.message,
                type: 'outbound',
                source: 'campaign',
                content: template.components.find(c => c.type === 'BODY')?.text || ''
            });
            results.push({ success: false, contact, error: err.message });
        }
      })());

      await Promise.all(promises);

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0 || messagesToInsert.length > 0) {
          await addCampaign(
            {
              name: campaignName,
              template_id: template.id,
              status: 'Sent',
              sent_at: new Date().toISOString(),
            },
            messagesToInsert
          );
      } else {
        throw new Error("Falha total no envio. Nenhuma mensagem pôde ser processada. Verifique os erros e a configuração da Meta.");
      }
      
      setSendResults(results);
      setIsResultsModalOpen(true);

    } catch (err: any) {
      setError(err.message);
    }
  };
  
  const previewName = useMemo(() => {
     return recipients[0]?.name || contacts[0]?.name || 'Cliente';
  }, [recipients, contacts]);


  if (!template) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Template não encontrado.</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2">Por favor, volte e selecione um template para começar.</p>
        <Button className="mt-4" onClick={() => setCurrentPage('templates')}>Voltar para Templates</Button>
      </div>
    );
  }

  const variablePlaceholders = placeholders.filter(p => p !== '{{1}}');
  
  const successfulSends = sendResults.filter(r => r.success).length;
  const failedSends = sendResults.filter(r => !r.success);

  const getModalActionText = () => {
    if (isScheduled) return 'agendar';
    if (sendingSpeed !== 'instant') return 'enfileirar';
    return 'enviar';
  };
  
  const getModalButtonText = () => {
    if (isScheduled) return 'Agendar Agora';
    if (sendingSpeed !== 'instant') return 'Enfileirar Agora';
    return 'Enviar Agora';
  };

  const getResultTitle = () => {
    if (isScheduled) return "Campanha Agendada!";
    if (sendingSpeed !== 'instant') return "Campanha Enfileirada!";
    return "Resultados do Envio da Campanha";
  };
  
  const getResultMessage = () => {
    if (isScheduled) return "agendada com sucesso";
    if (sendingSpeed !== 'instant') return "enfileirada com sucesso para envio gradual";
    return "processada";
  };

  return (
    <>
      <div className="space-y-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lançar Nova Campanha</h1>
        
        {error && <Card className="border-l-4 border-red-500"><p className="text-red-500 dark:text-red-400">{error}</p></Card>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Card className="space-y-6">
            <div>
              <label htmlFor="campaignName" className="block text-sm font-medium text-gray-500 dark:text-slate-300 mb-1">1. Nome da Campanha</label>
              <input
                type="text"
                id="campaignName"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Promoção de Verão - VIPs"
                className="w-full bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-300 mb-2">2. Velocidade de Envio</label>
                <div className="p-4 bg-gray-100 dark:bg-slate-700/50 rounded-md">
                    <select
                        value={sendingSpeed}
                        onChange={(e) => setSendingSpeed(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white"
                    >
                        <option value="instant">Imediato (Máxima velocidade)</option>
                        <option value="slow">Lento (aprox. 1 por minuto)</option>
                        <option value="very_slow">Muito Lento (aprox. 1 por 5 minutos)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">Escolher uma velocidade mais lenta pode ajudar a evitar bloqueios do WhatsApp em grandes campanhas. Requer um serviço de fila configurado no backend.</p>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-300 mb-2">3. Agendamento (Opcional)</label>
              <div className="p-4 bg-gray-100 dark:bg-slate-700/50 rounded-md">
                <label htmlFor="isScheduled" className="flex items-center cursor-pointer">
                  <input type="checkbox" id="isScheduled" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="h-4 w-4 rounded bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-blue-600 dark:text-sky-600 focus:ring-blue-500 dark:focus:ring-sky-500"/>
                  <span className="ml-3 text-sm font-medium text-gray-800 dark:text-white">Agendar envio para uma data específica</span>
                </label>
                {isScheduled && (
                  <div className="mt-3">
                    <label htmlFor="scheduleDate" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Data e Hora do Envio</label>
                    <input
                      type="datetime-local"
                      id="scheduleDate"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {variablePlaceholders.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-slate-300 mb-2">4. Preencher Variáveis</label>
                 <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                    Você pode usar variáveis como {"{{contact.name}}"}, {"{{contact.email}}"}, ou {"{{contact.custom_fields.sua_chave}}"} nos campos.
                </p>
                <div className="space-y-3 p-4 bg-gray-100 dark:bg-slate-700/50 rounded-md">
                  {variablePlaceholders.map(p => (
                    <div key={p}>
                      <label htmlFor={`var-${p}`} className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                        Variável {p}
                      </label>
                      <input
                        type="text"
                        id={`var-${p}`}
                        value={templateVariables[p] || ''}
                        onChange={(e) => handleVariableChange(p, e.target.value)}
                        className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white"
                        placeholder={`Valor para ${p}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-300 mb-2">
                5. Selecionar Destinatários
              </label>
              <div className="space-y-3 p-4 bg-gray-100 dark:bg-slate-700/50 rounded-md">
                  <div className="flex items-center">
                      <input type="radio" id="sendToAll" name="recipientType" checked={sendToAll} onChange={() => setSendToAll(true)} className="h-4 w-4 text-blue-600 dark:text-sky-600 bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-sky-500"/>
                      <label htmlFor="sendToAll" className="ml-3 block text-sm font-medium text-gray-800 dark:text-white">
                          Todos os Contatos ({contacts.length})
                      </label>
                  </div>
                  <div className="flex items-center">
                      <input type="radio" id="sendToSegment" name="recipientType" checked={!sendToAll} onChange={() => setSendToAll(false)} className="h-4 w-4 text-blue-600 dark:text-sky-600 bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-sky-500"/>
                      <label htmlFor="sendToSegment" className="ml-3 block text-sm font-medium text-gray-800 dark:text-white">
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
                                          className="h-4 w-4 rounded bg-gray-200 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-blue-600 dark:text-sky-600 focus:ring-blue-500 dark:focus:ring-sky-500"
                                      />
                                      <label htmlFor={`tag-${tag}`} className="ml-3 text-sm text-gray-700 dark:text-slate-300">
                                          {tag}
                                      </label>
                                  </div>
                              ))
                          ) : (
                              <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma tag encontrada nos seus contatos.</p>
                          )}
                      </div>
                  )}
                  <div className="pt-2 text-center text-sm font-semibold text-gray-800 dark:text-sky-300">
                      <p>Total de destinatários selecionados: {recipients.length}</p>
                  </div>
              </div>
            </div>

            <Button onClick={handleConfirmOpen} size="lg" className="w-full" isLoading={isLoading} disabled={!campaignName || recipients.length === 0}>
              <span>{isScheduled ? '🗓️ Revisar e Agendar' : '🚀 Revisar e Lançar Campanha'}</span>
            </Button>
          </Card>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Prévia da Mensagem</h2>
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
            <div className="text-gray-600 dark:text-slate-300 space-y-4">
                <p>Você está prestes a {getModalActionText()} a campanha <strong className="text-gray-900 dark:text-white">{campaignName}</strong>.</p>
                <div className="p-4 bg-gray-100 dark:bg-slate-700/50 rounded-lg space-y-2">
                     <p><strong>Template:</strong> <span className="font-mono text-blue-600 dark:text-sky-300">{template?.template_name}</span></p>
                     <p><strong>Total de destinatários:</strong> <span className="font-bold text-gray-900 dark:text-white">{recipients.length.toLocaleString('pt-BR')}</span></p>
                     {isScheduled && <p><strong>Agendada para:</strong> <span className="font-bold text-gray-900 dark:text-white">{new Date(scheduleDate).toLocaleString('pt-BR')}</span></p>}
                     {sendingSpeed !== 'instant' && <p><strong>Velocidade:</strong> <span className="font-bold text-gray-900 dark:text-white">{sendingSpeed === 'slow' ? 'Lenta' : 'Muito Lenta'}</span></p>}
                </div>
                <p className="text-amber-600 dark:text-amber-400 text-sm">Esta ação não pode ser desfeita. Tem certeza de que deseja continuar?</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleLaunch} isLoading={isLoading}>
                    Sim, {getModalButtonText()}
                </Button>
            </div>
        </Modal>

        <Modal
            isOpen={isResultsModalOpen}
            onClose={() => setCurrentPage('campaigns')}
            title={getResultTitle()}
        >
            <div className="text-gray-600 dark:text-slate-300 space-y-4">
                <p>A campanha <strong className="text-gray-900 dark:text-white">{campaignName}</strong> foi {getResultMessage()}.</p>
                
                {/* Only show immediate results for instant, non-scheduled sends */}
                {!isScheduled && sendingSpeed === 'instant' && (
                  <>
                    <div className="p-4 bg-gray-100 dark:bg-slate-700/50 rounded-lg space-y-2 text-center">
                      <p className="text-green-600 dark:text-green-400"><strong className="text-2xl">{successfulSends}</strong> envios bem-sucedidos.</p>
                      <p className="text-red-600 dark:text-red-400"><strong className="text-2xl">{failedSends.length}</strong> envios falharam.</p>
                    </div>
                    {failedSends.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Detalhes das Falhas:</h4>
                            <div className="max-h-60 overflow-y-auto p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg space-y-3">
                                {failedSends.map((result, index) => (
                                    <div key={index} className="text-sm border-b border-gray-200 dark:border-slate-700 pb-2">
                                        <p className="font-bold text-gray-800 dark:text-slate-200">{result.contact.name} ({result.contact.phone})</p>
                                        <p className="text-red-500 dark:text-red-400 font-mono text-xs mt-1">{result.error}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </>
                )}
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