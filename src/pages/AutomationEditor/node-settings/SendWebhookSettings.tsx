import React, { useState } from 'react';
import { NodeSettingsProps, InputWithVariables, TextareaWithVariables } from './common';
import Button from '../../../components/common/Button';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const SendWebhookSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables }) => {
    const config = (node.data.config as any) || {};
    const [isTesting, setIsTesting] = useState(false);
    const [testResponse, setTestResponse] = useState<any>(null);

    const handleConfigChange = (key: string, value: any) => {
        onConfigChange({ ...config, [key]: value });
    };
    
    const handleTestWebhook = async () => {
        setIsTesting(true);
        setTestResponse(null);

        const triggerNode = availableVariables.find(group => group.group === 'Gatilho (Webhook)');
        const triggerData = triggerNode ? triggerNode.vars.reduce((acc, v) => ({ ...acc, [v.label]: `[${v.label}]` }), {}) : {};

        try {
            const res = await fetch('/api/test-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhookConfig: config,
                    context: {
                        trigger: triggerData,
                        contact: {
                            id: 'contact_test_id',
                            name: 'Contato de Teste',
                            phone: '5511999998888',
                            tags: ['teste', 'webhook'],
                            custom_fields: { sample: 'data' }
                        }
                    }
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                const errorMessage = data.details || data.error || 'Falha no teste';
                throw new Error(errorMessage);
            }
            setTestResponse(data);
        } catch (err: any) {
            setTestResponse({
                status: 'Erro',
                body: err.message,
            });
        } finally {
            setIsTesting(false);
        }
    };

    const httpMethods = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];
    const showBody = ['POST', 'PUT', 'PATCH'].includes(config.method || 'POST');

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Método HTTP</label>
                <select value={config.method || 'POST'} onChange={(e) => handleConfigChange('method', e.target.value)} className={baseInputClass}>
                    {httpMethods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">URL para Envio</label>
                <InputWithVariables onValueChange={val => handleConfigChange('url', val)} value={config.url || ''} type="text" placeholder="https://..." className={baseInputClass} variables={availableVariables} />
            </div>
             {showBody && (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Corpo (JSON)</label>
                    <TextareaWithVariables 
                        onValueChange={val => handleConfigChange('body', val)} 
                        value={config.body || ''} 
                        placeholder='{ "id": {{contact.id}}, "event": "new_tag" }' 
                        rows={5} 
                        className={`${baseInputClass} font-mono`} 
                        variables={availableVariables} 
                    />
                    <p className="text-xs text-slate-400 mt-1">Dica: Insira placeholders (ex: `{{contact.name}}`) sem aspas ao redor.</p>
                </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                <Button variant="secondary" onClick={handleTestWebhook} isLoading={isTesting} disabled={!config.url}>
                    Testar Requisição
                </Button>
                {testResponse && (
                    <div>
                        <h5 className="text-md font-semibold text-white mt-2 mb-2">Resposta do Teste</h5>
                        <div className="p-3 bg-slate-900/50 rounded-lg space-y-2 font-mono text-xs">
                            <p>
                                <span className="font-bold text-slate-300">Status: </span>
                                <span className={testResponse.status >= 400 || testResponse.status === 'Erro' ? 'text-red-400' : 'text-green-400'}>
                                    {testResponse.status}
                                </span>
                            </p>
                            <div>
                                <p className="font-bold text-slate-300">Corpo:</p>
                                <pre className="mt-1 p-2 bg-slate-800 rounded-md whitespace-pre-wrap max-h-48 overflow-y-auto text-slate-400">
                                    {typeof testResponse.body === 'object' ? JSON.stringify(testResponse.body, null, 2) : String(testResponse.body)}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SendWebhookSettings;
