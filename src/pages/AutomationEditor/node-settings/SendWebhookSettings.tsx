
import React, { useState } from 'react';
import { NodeSettingsProps, InputWithVariables, TextareaWithVariables } from './common';
import Button from '../../../components/common/Button';
import Switch from '../../../components/common/Switch';
import { PLUS_ICON, TRASH_ICON } from '../../../components/icons';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const KeyValueRow: React.FC<{
    item: { key: string, value: string },
    index: number,
    onListChange: (index: number, field: 'key' | 'value', value: string) => void,
    onRemove: (index: number) => void,
    variables: NodeSettingsProps['availableVariables'],
    keyPlaceholder: string,
    valuePlaceholder: string,
}> = ({ item, index, onListChange, onRemove, variables, keyPlaceholder, valuePlaceholder }) => (
    <div className="flex items-center gap-2">
        <InputWithVariables
            value={item.key}
            onValueChange={(v) => onListChange(index, 'key', v)}
            placeholder={keyPlaceholder}
            className={`${baseInputClass} text-sm`}
            variables={variables}
        />
        <InputWithVariables
            value={item.value}
            onValueChange={(v) => onListChange(index, 'value', v)}
            placeholder={valuePlaceholder}
            className={`${baseInputClass} text-sm`}
            variables={variables}
        />
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-400" onClick={() => onRemove(index)}>
            <TRASH_ICON className="w-4 h-4" />
        </Button>
    </div>
);


const SendWebhookSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables }) => {
    const config = (node.data.config as any) || {};
    const [isTesting, setIsTesting] = useState(false);
    const [testResponse, setTestResponse] = useState<any>(null);

    const updateConfig = (updater: (draft: any) => void) => {
        const newConfig = JSON.parse(JSON.stringify(config));
        updater(newConfig);
        onConfigChange(newConfig);
    };

    const httpMethods = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];
    const showBody = ['POST', 'PUT', 'PATCH'].includes(config.method || 'POST');

    const handleConfigChange = (key: string, value: any) => {
        updateConfig(draft => {
            draft[key] = value;
        });
    };

    const handleNestedChange = (path: string[], value: any) => {
        updateConfig(draft => {
            let current = draft;
            for (let i = 0; i < path.length - 1; i++) {
                const key = path[i];
                if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
                    current[key] = {};
                }
                current = current[key];
            }
            current[path[path.length - 1]] = value;
        });
    };
    
    const handleListChange = (listName: 'headers' | 'params', index: number, field: 'key' | 'value', value: string) => {
        updateConfig(draft => {
            const list = listName === 'params' ? draft.body?.params : draft.headers;
            if (list && list[index]) {
                list[index][field] = value;
            }
        });
    };

    const addListItem = (listName: 'headers' | 'params') => {
        updateConfig(draft => {
            if (listName === 'params') {
                if (!draft.body) draft.body = {};
                if (!draft.body.params) draft.body.params = [];
                draft.body.params.push({ key: '', value: '' });
            } else {
                if (!draft.headers) draft.headers = [];
                draft.headers.push({ key: '', value: '' });
            }
        });
    };
    
    const removeListItem = (listName: 'headers' | 'params', index: number) => {
        updateConfig(draft => {
            if (listName === 'params') {
                if (draft.body?.params) {
                    draft.body.params.splice(index, 1);
                }
            } else {
                 if (draft.headers) {
                    draft.headers.splice(index, 1);
                 }
            }
        });
    };

    const handleTestWebhook = async () => {
        setIsTesting(true);
        setTestResponse(null);

        const triggerNode = availableVariables.find(group => group.group === 'Gatilho (Webhook Body)');
        const triggerData = triggerNode ? triggerNode.vars.reduce((acc: any, v) => {
            const keys = v.path.split('.').slice(2); // remove trigger.body
            let current = acc;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]] = current[keys[i]] || {};
            }
            current[keys[keys.length - 1]] = `[${v.label}]`;
            return acc;
        }, {}) : {};

        try {
            const res = await fetch('/api/test-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhookConfig: config,
                    context: {
                        trigger: { body: triggerData },
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

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="w-1/3">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Método</label>
                    <select value={config.method || 'POST'} onChange={(e) => handleConfigChange('method', e.target.value)} className={baseInputClass}>
                        {httpMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="w-2/3">
                    <label className="block text-sm font-medium text-slate-300 mb-1">URL</label>
                    <InputWithVariables onValueChange={val => handleConfigChange('url', val)} value={config.url || ''} type="text" placeholder="https://..." className={baseInputClass} variables={availableVariables} />
                </div>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-lg">
                <Switch checked={config.sendHeaders || false} onChange={val => handleConfigChange('sendHeaders', val)} label="Enviar Cabeçalhos" />
                {config.sendHeaders && (
                    <div className="mt-3 space-y-2">
                       {(config.headers || []).map((header: {key: string, value: string}, index: number) => (
                           <KeyValueRow 
                               key={index} 
                               item={header} 
                               index={index}
                               onListChange={(idx, f, v) => handleListChange('headers', idx, f, v)}
                               onRemove={() => removeListItem('headers', index)}
                               variables={availableVariables}
                               keyPlaceholder="Header-Name"
                               valuePlaceholder="Header Value"
                           />
                       ))}
                       <Button size="sm" variant="ghost" onClick={() => addListItem('headers')}><PLUS_ICON className="w-4 h-4 mr-1" /> Adicionar Cabeçalho</Button>
                    </div>
                )}
            </div>

            {showBody && (
                 <div className="p-3 bg-slate-800/50 rounded-lg">
                    <Switch checked={config.sendBody || false} onChange={val => handleConfigChange('sendBody', val)} label="Enviar Corpo (Body)" />
                    {config.sendBody && (
                        <div className="mt-3 space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Conteúdo do Corpo</label>
                                <select value={config.body?.contentType || 'json'} onChange={e => handleNestedChange(['body', 'contentType'], e.target.value)} className={`${baseInputClass} text-sm`}>
                                    <option value="json">JSON (application/json)</option>
                                    <option value="form_urlencoded">Form (x-www-form-urlencoded)</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Especificar Corpo</label>
                                <select value={config.body?.specify || 'fields'} onChange={e => handleNestedChange(['body', 'specify'], e.target.value)} className={`${baseInputClass} text-sm`}>
                                    <option value="fields">Usando Campos (Key-Value)</option>
                                    <option value="raw">JSON Bruto (Raw)</option>
                                </select>
                            </div>
                            
                            {config.body?.specify === 'fields' ? (
                                <div className="space-y-2">
                                     <label className="block text-xs font-medium text-slate-400 mb-1">Parâmetros do Corpo</label>
                                     {(config.body?.params || []).map((param: {key: string, value: string}, index: number) => (
                                       <KeyValueRow 
                                            key={index} 
                                            item={param} 
                                            index={index}
                                            onListChange={(idx, f, v) => handleListChange('params', idx, f, v)}
                                            onRemove={() => removeListItem('params', index)}
                                            variables={availableVariables}
                                            keyPlaceholder="nome_do_campo"
                                            valuePlaceholder="Valor do campo"
                                       />
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => addListItem('params')}><PLUS_ICON className="w-4 h-4 mr-1" /> Adicionar Parâmetro</Button>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Corpo JSON Bruto</label>
                                    <TextareaWithVariables
                                        onValueChange={val => handleNestedChange(['body', 'rawJson'], val)}
                                        value={config.body?.rawJson || ''}
                                        placeholder={'{\n  "id": "{{contact.id}}"\n}'}
                                        rows={6}
                                        className={`${baseInputClass} font-mono text-sm`}
                                        variables={availableVariables}
                                    />
                                </div>
                            )}

                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-2 pt-4 border-t border-slate-700 space-y-3">
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
                                    {typeof testResponse.body === 'object' ? JSON.stringify(testResponse.body, null, 2) : (testResponse.body ?? '').toString()}
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
