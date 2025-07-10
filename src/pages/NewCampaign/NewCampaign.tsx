import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { sendTemplatedMessage } from '../../services/meta/messages';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { CampaignMessageInsert, Contact, MessageTemplate } from '../../types';
import TemplatePreview from '../../components/common/TemplatePreview';

interface SendResult {
    success: boolean;
    contact: Contact;
    error?: string;
}

const NewCampaign: React.FC = () => {
  const { pageParams, templates, contacts, addCampaign, setCurrentPage, metaConfig } = useContext(AppContext);
  const [campaignName, setCampaignName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);


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
    setIsConfirmModalOpen(false);
    if (!template || !metaConfig.phoneNumberId || !metaConfig.accessToken) {
      setError("Configuração ou template inválido. Tente novamente.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const results: SendResult[] = [];

    try {
      const messagesToInsert: Omit<CampaignMessageInsert, 'campaign_id'>[] = [];
      
      const promises = recipients.map(contact => (async () => {
        try {
          // Simplificação: Trata todas as variáveis como pertencentes ao BODY.
          // Para uma implementação completa, seria necessário mapear cada variável ao seu componente (HEADER, BODY, BUTTON).
          const parameters = placeholders.map(p => ({
              type: 'text',
              text: p === '{{1}}' ? (contact.name || '') : (templateVariables[p] || '')
            }));
          
          // Correção: Sempre envia o objeto 'components', mesmo que o array de parâmetros esteja vazio.
          // Isso resolve o erro (#131008) da API da Meta que espera este parâmetro.
          const components = [{ type: 'body', parameters }];

          const response = await sendTemplatedMessage(metaConfig, contact.phone, template.template_name, components);
          messagesToInsert.push({
            contact_id: contact.id,
            meta_message_id: response.messages[0].id,
            status: 'sent'
          });
          results.push({ success: true, contact });
        } catch (err: any) {
          console.error(`Falha ao enviar para ${contact.name} (${contact.phone}): ${err.message}`);
          messagesToInsert.push({
            contact_id: contact.id,
            status: 'failed',
            error_message: err.message
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
              recipient_count: recipients.length,
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
  
  const successfulSends = sendResults.filter(r => r.success).length;
  const failedSends = sendResults.filter(r => !r.success);

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
            
            {variablePlaceholders.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">2. Preencher Variáveis</label>
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
                {variablePlaceholders.length > 0 ? '3.' : '2.'} Selecionar Destinatários
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
              <span>🚀 Revisar e Lançar Campanha</span>
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
          title="Confirmar Envio da Campanha"
        >
            <div className="text-slate-300 space-y-4">
                <p>Você está prestes a enviar a campanha <strong className="text-white">{campaignName}</strong>.</p>
                <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
                     <p><strong>Template:</strong> <span className="font-mono text-sky-300">{template?.template_name}</span></p>
                     <p><strong>Total de destinatários:</strong> <span className="font-bold text-white">{recipients.length.toLocaleString('pt-BR')}</span></p>
                </div>
                <p className="text-amber-400 text-sm">Esta ação não pode ser desfeita. Tem certeza de que deseja continuar?</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleLaunch} isLoading={isLoading}>
                    Sim, Enviar Agora
                </Button>
            </div>
        </Modal>

        <Modal
            isOpen={isResultsModalOpen}
            onClose={() => setCurrentPage('campaigns')}
            title="Resultados do Envio da Campanha"
        >
            <div className="text-slate-300 space-y-4">
                <p>A campanha <strong className="text-white">{campaignName}</strong> foi processada.</p>
                <div className="p-4 bg-slate-700/50 rounded-lg space-y-2 text-center">
                    <p className="text-green-400"><strong className="text-2xl">{successfulSends}</strong> envios bem-sucedidos.</p>
                    <p className="text-red-400"><strong className="text-2xl">{failedSends.length}</strong> envios falharam.</p>
                </div>
                {failedSends.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-white mb-2">Detalhes das Falhas:</h4>
                        <div className="max-h-60 overflow-y-auto p-3 bg-slate-900/50 rounded-lg space-y-3">
                            {failedSends.map((result, index) => (
                                <div key={index} className="text-sm border-b border-slate-700 pb-2">
                                    <p className="font-bold text-slate-200">{result.contact.name} ({result.contact.phone})</p>
                                    <p className="text-red-400 font-mono text-xs mt-1">{result.error}</p>
                                </div>
                            ))}
                        </div>
                    </div>
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
