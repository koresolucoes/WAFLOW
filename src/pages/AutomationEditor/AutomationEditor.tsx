import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { Automation, AutomationInsert } from '../../types';
import InfoCard from '../../components/common/InfoCard';

const AutomationEditor: React.FC = () => {
    const { pageParams, automations, templates, addAutomation, updateAutomation, setCurrentPage } = useContext(AppContext);
    
    const getInitialState = (): Partial<AutomationInsert> => ({
        name: '',
        status: 'active',
        trigger_type: 'new_contact_with_tag',
        trigger_config: { tag: '' },
        action_type: 'send_template',
        action_config: { template_id: '' }
    });

    const [automation, setAutomation] = useState<Partial<AutomationInsert>>(getInitialState());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = Boolean(pageParams.automationId);

    useEffect(() => {
        if (isEditing) {
            const existingAutomation = automations.find(a => a.id === pageParams.automationId);
            if (existingAutomation) {
                setAutomation(existingAutomation);
            }
        } else {
            setAutomation(getInitialState());
        }
    }, [isEditing, pageParams.automationId, automations]);

    const webhookUrl = useMemo(() => {
        if (isEditing && automation.trigger_type === 'webhook_received') {
            return `${window.location.origin}/api/webhook?trigger_id=${pageParams.automationId}`;
        }
        return null;
    }, [isEditing, pageParams.automationId, automation.trigger_type]);

    const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setAutomation(prev => ({ ...prev, [name]: value }));
    };

    const handleTriggerTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTriggerType = e.target.value as Automation['trigger_type'];
        let newTriggerConfig: Json = {};
        let newActionType: Automation['action_type'] = 'send_template';
        let newActionConfig: Json = { template_id: '' };

        if (newTriggerType === 'new_contact_with_tag') {
            newTriggerConfig = { tag: '' };
        } else if (newTriggerType === 'message_received_with_keyword') {
            newTriggerConfig = { keyword: '' };
        } else if (newTriggerType === 'webhook_received') {
            newTriggerConfig = {};
            newActionType = 'http_request';
            newActionConfig = { url: '', method: 'POST', headers: '{\n  "Content-Type": "application/json"\n}', body: '{\n  "data": "Hello from ZapFlow AI!"\n}' };
        }
        
        setAutomation(prev => ({
            ...prev,
            trigger_type: newTriggerType,
            trigger_config: newTriggerConfig,
            action_type: newActionType,
            action_config: newActionConfig
        }));
    };
    
    const handleActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newActionType = e.target.value as Automation['action_type'];
        let newActionConfig: Json = {};
        
        if (newActionType === 'add_tag') {
            newActionConfig = { tag: '' };
        } else if (newActionType === 'send_template') {
            newActionConfig = { template_id: '' };
        } else if (newActionType === 'http_request') {
             newActionConfig = { url: '', method: 'POST', headers: '{\n  "Content-Type": "application/json"\n}', body: '{\n  "data": "Hello from ZapFlow AI!"\n}' };
        }
        
        setAutomation(prev => ({
            ...prev,
            action_type: newActionType,
            action_config: newActionConfig
        }));
    };
    
    const handleConfigChange = (type: 'trigger' | 'action', key: string, value: string) => {
        const configKey = type === 'trigger' ? 'trigger_config' : 'action_config';
        setAutomation(prev => ({
            ...prev,
            [configKey]: { ...(prev[configKey] as object), [key]: value }
        }));
    };
    
    const handleJsonConfigChange = (type: 'action', key: 'headers' | 'body', value: string) => {
        const configKey = 'action_config';
         setAutomation(prev => ({
            ...prev,
            [configKey]: { ...(prev[configKey] as object), [key]: value }
        }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!automation.name?.trim()) return setError("O nome da automação é obrigatório.");
        if (automation.trigger_type === 'new_contact_with_tag' && !(automation.trigger_config as any).tag) return setError("A tag para o gatilho é obrigatória.");
        if (automation.trigger_type === 'message_received_with_keyword' && !(automation.trigger_config as any).keyword) return setError("A palavra-chave para o gatilho é obrigatória.");
        if (automation.action_type === 'add_tag' && !(automation.action_config as any).tag) return setError("A tag para a ação é obrigatória.");
        if (automation.action_type === 'send_template' && !(automation.action_config as any).template_id) return setError("Por favor, selecione um template para a ação.");
        if (automation.action_type === 'http_request' && !(automation.action_config as any).url) return setError("A URL para a requisição HTTP é obrigatória.");
        if (automation.action_type === 'http_request') {
            try {
                JSON.parse((automation.action_config as any).headers);
            } catch {
                return setError("O formato dos Cabeçalhos (Headers) é um JSON inválido.");
            }
        }


        setIsSaving(true);
        try {
            if (isEditing) {
                await updateAutomation(automation as Automation);
            } else {
                await addAutomation(automation as AutomationInsert);
            }
            setCurrentPage('automations');
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro ao salvar.');
        } finally {
            setIsSaving(false);
        }
    };

    const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

    const compatibleActions = useMemo(() => {
        if (automation.trigger_type === 'webhook_received') {
            return [{ value: 'http_request', label: 'Enviar Requisição HTTP' }];
        }
        return [
            { value: 'send_template', label: 'Enviar template do WhatsApp' },
            { value: 'add_tag', label: 'Adicionar tag ao contato' }
        ];
    }, [automation.trigger_type]);
    

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-white">
                {isEditing ? 'Editar Automação' : 'Criar Nova Automação'}
            </h1>

            {error && <Card className="border-l-4 border-red-500"><p className="text-red-400">{error}</p></Card>}

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Nome da Automação</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={automation.name || ''}
                        onChange={handleMainChange}
                        placeholder="Ex: Boas-vindas cliente VIP"
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
                    />
                </Card>

                <Card>
                    <h2 className="text-xl font-semibold text-white mb-4">Se... (Gatilho)</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="trigger_type" className="block text-sm font-medium text-slate-300 mb-1">Quando isso acontecer...</label>
                            <select name="trigger_type" id="trigger_type" value={automation.trigger_type} onChange={handleTriggerTypeChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                <option value="new_contact_with_tag">Novo contato com tag</option>
                                <option value="message_received_with_keyword">Mensagem recebida com palavra-chave</option>
                                <option value="webhook_received">Webhook recebido</option>
                            </select>
                        </div>
                        {automation.trigger_type === 'new_contact_with_tag' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
                                <input type="text" value={(automation.trigger_config as any)?.tag || ''} onChange={(e) => handleConfigChange('trigger', 'tag', e.target.value)} placeholder="Ex: vip" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                                <p className="text-xs text-slate-400 mt-1">Dispara quando um contato é criado ou atualizado com esta tag.</p>
                            </div>
                        )}
                         {automation.trigger_type === 'message_received_with_keyword' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Palavra-chave</label>
                                <input type="text" value={(automation.trigger_config as any)?.keyword || ''} onChange={(e) => handleConfigChange('trigger', 'keyword', e.target.value)} placeholder="Ex: promoção" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                                <p className="text-xs text-slate-400 mt-1">Dispara quando uma mensagem recebida contém esta palavra (não diferencia maiúsculas/minúsculas).</p>
                            </div>
                        )}
                        {automation.trigger_type === 'webhook_received' && (
                             <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">URL do Webhook</label>
                                {webhookUrl ? (
                                    <>
                                        <input type="text" value={webhookUrl} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white font-mono" />
                                        <p className="text-xs text-slate-400 mt-1">Use esta URL no serviço externo para enviar dados para esta automação.</p>
                                    </>
                                ) : (
                                    <InfoCard variant="warning">
                                        <p>Salve a automação primeiro para gerar a URL do webhook.</p>
                                    </InfoCard>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                <Card>
                    <h2 className="text-xl font-semibold text-white mb-4">Então... (Ação)</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="action_type" className="block text-sm font-medium text-slate-300 mb-1">Execute esta ação...</label>
                            <select name="action_type" id="action_type" value={automation.action_type} onChange={handleActionTypeChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                               {compatibleActions.map(action => (
                                    <option key={action.value} value={action.value}>{action.label}</option>
                               ))}
                            </select>
                        </div>
                         {automation.action_type === 'send_template' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Selecione o Template</label>
                                <select value={(automation.action_config as any)?.template_id || ''} onChange={(e) => handleConfigChange('action', 'template_id', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                    <option value="">-- Selecione um template --</option>
                                    {approvedTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.template_name}</option>
                                    ))}
                                </select>
                                {approvedTemplates.length === 0 && <p className="text-xs text-amber-400 mt-1">Nenhum template APROVADO encontrado. Sincronize ou crie um novo.</p>}
                            </div>
                        )}
                         {automation.action_type === 'add_tag' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag a Adicionar</label>
                                <input type="text" value={(automation.action_config as any)?.tag || ''} onChange={(e) => handleConfigChange('action', 'tag', e.target.value)} placeholder="Ex: interessado" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                            </div>
                        )}
                         {automation.action_type === 'http_request' && (
                             <div className="space-y-4">
                                <InfoCard>
                                    <p className="text-sm">Você pode usar variáveis do webhook na URL, cabeçalhos e corpo. Ex: <code>&#123;&#123;trigger.body.id&#125;&#125;</code>, <code>&#123;&#123;trigger.query.user&#125;&#125;</code></p>
                                </InfoCard>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">URL</label>
                                    <input type="url" value={(automation.action_config as any)?.url || ''} onChange={(e) => handleConfigChange('action', 'url', e.target.value)} placeholder="https://api.example.com/data" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Método</label>
                                     <select value={(automation.action_config as any)?.method || 'POST'} onChange={(e) => handleConfigChange('action', 'method', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                        <option>POST</option>
                                        <option>GET</option>
                                        <option>PUT</option>
                                        <option>PATCH</option>
                                        <option>DELETE</option>
                                    </select>
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Cabeçalhos (Headers) - Formato JSON</label>
                                    <textarea value={(automation.action_config as any)?.headers || ''} onChange={(e) => handleJsonConfigChange('action', 'headers', e.target.value)} rows={4} placeholder='{ "Content-Type": "application/json" }' className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm"></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Corpo (Body) - Formato JSON</label>
                                    <textarea value={(automation.action_config as any)?.body || ''} onChange={(e) => handleJsonConfigChange('action', 'body', e.target.value)} rows={6} placeholder='{ "message": "Dados do webhook: {{trigger.body.message}}" }' className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm"></textarea>
                                </div>
                             </div>
                         )}
                    </div>
                </Card>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={() => setCurrentPage('automations')} disabled={isSaving}>Cancelar</Button>
                    <Button type="submit" variant="primary" isLoading={isSaving} disabled={isSaving}>Salvar Automação</Button>
                </div>
            </form>
        </div>
    );
};

export default AutomationEditor;