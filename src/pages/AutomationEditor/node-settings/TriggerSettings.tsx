
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NodeSettingsProps, InputWithVariables } from './common';
import { supabase } from '../../../lib/supabaseClient';
import Button from '../../../components/common/Button';
import { COPY_ICON, PLUS_ICON, TRASH_ICON } from '../../../components/icons';
import { AutomationNode, Json } from '../../../types';

// Componente para renderizar a árvore de dados do webhook
const DataTreeView: React.FC<{ data: any; parentKey?: string }> = ({ data, parentKey = '' }) => {
    if (data === null || typeof data !== 'object') {
        return <span className="text-amber-400">{JSON.stringify(data)}</span>;
    }

    return (
        <div className="pl-4">
            {Object.entries(data).map(([key, value]) => {
                const currentKey = parentKey ? `${parentKey}.${key}` : key;
                return (
                    <div key={currentKey}>
                        <span className="text-sky-300">{key}:</span>
                        {typeof value === 'object' && value !== null ? (
                            <DataTreeView data={value} parentKey={currentKey} />
                        ) : (
                            <span className="text-slate-300 ml-2">{String(value)}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const TriggerSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, profile, availableVariables, automationId }) => {
    const config = (node.data.config as any) || {};
    const [isListening, setIsListening] = useState(false);

    // Subscribe to realtime updates for this automation
    useEffect(() => {
        if (!node || !automationId) return;

        const channel = supabase
            .channel(`automation-update-${automationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'automations',
                    filter: `id=eq.${automationId}`,
                },
                (payload) => {
                    const updatedAutomation = payload.new as any;
                    if (!updatedAutomation || !Array.isArray(updatedAutomation.nodes)) return;

                    const updatedNode = (updatedAutomation.nodes as AutomationNode[]).find(n => n.id === node.id);
                    if (updatedNode && updatedNode.data?.config) {
                        const newConfig = updatedNode.data.config as any;
                        if (newConfig.last_captured_data) {
                            setIsListening(false);
                            onConfigChange(newConfig);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [node, automationId, onConfigChange]);


    const handleStartListening = () => {
        setIsListening(true);
        onConfigChange({ ...config, last_captured_data: null, data_mapping: [] }, { immediate: true });
    };

    const handleMappingChange = (index: number, field: string, value: string) => {
        const newMapping = [...(config.data_mapping || [])];
        (newMapping[index] as any)[field] = value;
        onConfigChange({ ...config, data_mapping: newMapping });
    };

    const addMappingRow = () => {
        const newMapping = [...(config.data_mapping || []), { source: '', destination: 'tag', destination_key: '' }];
        onConfigChange({ ...config, data_mapping: newMapping });
    };

    const removeMappingRow = (index: number) => {
        const newMapping = (config.data_mapping || []).filter((_:any, i:number) => i !== index);
        onConfigChange({ ...config, data_mapping: newMapping });
    };
    
    const setStandardMapping = (destination: 'name' | 'phone', source: string) => {
        const newMapping = (config.data_mapping || []).filter((m: any) => m.destination !== destination);
        if(source){
            newMapping.push({ source, destination });
        }
        onConfigChange({ ...config, data_mapping: newMapping });
    };

    const nameMapping = useMemo(() => config.data_mapping?.find((m: any) => m.destination === 'name')?.source || '', [config.data_mapping]);
    const phoneMapping = useMemo(() => config.data_mapping?.find((m: any) => m.destination === 'phone')?.source || '', [config.data_mapping]);
    const additionalMappings = useMemo(() => (config.data_mapping || []).filter((m: any) => m.destination !== 'name' && m.destination !== 'phone'), [config.data_mapping]);


    const webhookUrl = `${window.location.origin}/api/trigger/${profile?.webhook_path_prefix || profile?.id}_${node.id}`;
    const hasCapturedData = config.last_captured_data && typeof config.last_captured_data === 'object';

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">URL do Webhook (POST)</label>
                <div className="flex items-center gap-2">
                    <input type="text" readOnly value={webhookUrl} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm" />
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}><COPY_ICON className="w-4 h-4"/></Button>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
                {!hasCapturedData ? (
                     <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                        <Button variant="secondary" onClick={handleStartListening} isLoading={isListening} size="lg">
                            {isListening ? 'Aguardando Requisição...' : 'Iniciar Escuta'}
                        </Button>
                        <p className="text-xs text-slate-400 mt-2">Clique para aguardar uma requisição de teste e configurar o mapeamento.</p>
                     </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Coluna de Dados Recebidos */}
                        <div className="space-y-3">
                            <h4 className="text-md font-semibold text-white">Dados Recebidos</h4>
                            <div className="p-3 bg-slate-900/50 rounded-lg max-h-96 overflow-y-auto font-mono text-xs">
                                {Object.entries(config.last_captured_data).map(([key, data]) => (
                                     <details key={key} open={key === 'body'}>
                                        <summary className="cursor-pointer font-bold text-white capitalize">{key}</summary>
                                        <DataTreeView data={data} parentKey={`trigger.${key}`} />
                                     </details>
                                ))}
                            </div>
                             <Button variant="ghost" size="sm" onClick={handleStartListening}>Limpar e Escutar Novamente</Button>
                        </div>
                        {/* Coluna de Mapeamento */}
                        <div className="space-y-4">
                            <h4 className="text-md font-semibold text-white">Mapeamento de Dados</h4>
                             <div className="p-3 bg-slate-700/50 rounded-lg space-y-3">
                                <h5 className="text-sm font-semibold text-slate-200">Campos Padrão</h5>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Telefone do Contato</label>
                                    <InputWithVariables value={phoneMapping} onValueChange={(val) => setStandardMapping('phone', val)} variables={availableVariables} placeholder="Ex: {{trigger.body.phone}}" className="w-full bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm" />
                                </div>
                                 <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Contato</label>
                                    <InputWithVariables value={nameMapping} onValueChange={(val) => setStandardMapping('name', val)} variables={availableVariables} placeholder="Ex: {{trigger.body.name}}" className="w-full bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm" />
                                </div>
                            </div>
                            <div className="p-3 bg-slate-700/50 rounded-lg space-y-3">
                                <h5 className="text-sm font-semibold text-slate-200">Mapeamento Adicional</h5>
                                <div className="space-y-2">
                                {additionalMappings.map((map: any, index: number) => (
                                    <div key={index} className="space-y-1 p-2 border border-slate-600 rounded-md relative">
                                        <button onClick={() => removeMappingRow(index)} className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 text-white text-xs">&times;</button>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Origem do Dado</label>
                                            <InputWithVariables value={map.source} onValueChange={(val) => handleMappingChange(index, 'source', val)} variables={availableVariables} placeholder="Ex: {{trigger.body.id_pedido}}" className="w-full bg-slate-800 border-slate-600 rounded p-1 text-sm"/>
                                        </div>
                                        <div>
                                             <label className="block text-xs font-medium text-slate-400 mb-1">Destino</label>
                                             <select value={map.destination} onChange={e => handleMappingChange(index, 'destination', e.target.value)} className="w-full bg-slate-800 border-slate-600 rounded p-1 text-sm">
                                                <option value="tag">Adicionar como Tag</option>
                                                <option value="custom_field">Campo Personalizado</option>
                                             </select>
                                        </div>
                                        {map.destination === 'custom_field' && (
                                            <div>
                                                 <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Campo Destino</label>
                                                 <input type="text" value={map.destination_key || ''} onChange={e => handleMappingChange(index, 'destination_key', e.target.value)} placeholder="Ex: id_pedido" className="w-full bg-slate-800 border-slate-600 rounded p-1 text-sm"/>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                </div>
                                <Button size="sm" variant="ghost" onClick={addMappingRow}><PLUS_ICON className="w-4 h-4 mr-1" /> Adicionar Mapeamento</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TriggerSettings;
