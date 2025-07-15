
import React, { useState, useEffect, useCallback } from 'react';
import { NodeSettingsProps } from './common';
import Button from '../../../components/common/Button';
import { COPY_ICON, INFO_ICON } from '../../../components/icons';

const TriggerSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, profile }) => {
    const config = (node.data.config as any) || {};
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        const hasData = config.last_captured_data && Object.keys(config.last_captured_data).length > 0;
        if (hasData) setIsListening(false);
    }, [config.last_captured_data]);

    const handleStartListening = () => {
        setIsListening(true);
        onConfigChange({ ...config, last_captured_data: null, data_mapping: [] });
    };

    const handleMappingChange = useCallback((source: string, destination: string, destination_key?: string) => {
        let newMapping = [...(config.data_mapping || [])];
        const existingIndex = newMapping.findIndex(m => m.source === source);

        if (destination === 'ignore') {
             newMapping = newMapping.filter(m => m.source !== source);
        } else {
             const newRule = { source, destination, destination_key };
            if (destination === 'phone') {
                // Garante que apenas um campo seja mapeado para telefone
                newMapping = newMapping.filter(m => m.destination !== 'phone');
            }
            if (existingIndex > -1) {
                newMapping[existingIndex] = newRule;
            } else {
                newMapping.push(newRule);
            }
        }
        onConfigChange({ ...config, data_mapping: newMapping });
    }, [config, onConfigChange]);
    
    const renderDataMapping = () => {
        const capturedData = config.last_captured_data;
        if (!capturedData || !capturedData.body || Object.keys(capturedData.body).length === 0) return null;
        
        const capturedKeys = Object.keys(capturedData.body);
        const currentMapping = config.data_mapping || [];
        const isPhoneMapped = currentMapping.some((m: any) => m.destination === 'phone');

        return (
            <div className="mt-4 border-t border-slate-700 pt-4">
                <h4 className="text-md font-semibold text-white mb-2">Mapeamento de Dados</h4>
                {!isPhoneMapped && (
                     <div className="p-2 mb-3 text-xs text-amber-300 bg-amber-500/10 rounded-md flex items-start gap-2">
                        <INFO_ICON className="w-6 h-6 flex-shrink-0"/>
                        <span>**Atenção:** Mapeie um campo para "Telefone do Contato" para que o sistema saiba qual contato acionar.</span>
                    </div>
                )}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {capturedKeys.map(key => {
                    const value = capturedData.body[key] ?? '';
                    const sourcePath = `body.${key}`;
                    const mappingRule = currentMapping.find((m: any) => m.source === sourcePath);
                    const destination = mappingRule?.destination || 'ignore';
                    
                    return (
                        <div key={key} className="p-2 bg-slate-700/50 rounded-lg">
                            <p className="text-xs text-slate-400 font-mono truncate" title={key}>{key}</p>
                            <p className="text-sm text-white font-semibold truncate my-1" title={String(value)}>{String(value)}</p>
                             <select 
                                value={destination} 
                                onChange={(e) => handleMappingChange(sourcePath, e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm"
                            >
                                <option value="ignore">Ignorar</option>
                                <option value="phone">Telefone do Contato</option>
                                <option value="name">Nome do Contato</option>
                                <option value="tag">Adicionar como Tag</option>
                                <option value="custom_field">Campo Personalizado</option>
                            </select>
                            {destination === 'custom_field' && (
                                <input 
                                    type="text" 
                                    placeholder="Nome do campo (ex: id_pedido)"
                                    value={mappingRule?.destination_key || ''}
                                    onChange={(e) => handleMappingChange(sourcePath, 'custom_field', e.target.value)}
                                    className="w-full mt-2 bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm"
                                />
                            )}
                        </div>
                    );
                })}
                </div>
            </div>
        );
    };

    const webhookUrl = `${window.location.origin}/api/trigger/${profile?.webhook_path_prefix || profile?.id}_${node.id}`;

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">URL do Webhook</label>
                <div className="flex items-center gap-2">
                    <input type="text" readOnly value={webhookUrl} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-sm" />
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}><COPY_ICON className="w-4 h-4"/></Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Esta URL é única para este nó e já está ativa.</p>
            </div>
            
            <div className="mt-4 border-t border-slate-700 pt-4">
                <h4 className="text-md font-semibold text-white mb-2">Escuta de Webhook</h4>
                <Button variant="secondary" onClick={handleStartListening} isLoading={isListening}>
                  {isListening ? 'Aguardando dados...' : 'Limpar e Escutar por Novos Dados'}
                </Button>
                <p className="text-xs text-slate-400 mt-1">Clique para limpar dados antigos e aguardar uma nova requisição de teste.</p>
            </div>

            {renderDataMapping()}
        </div>
    );
};

export default TriggerSettings;
