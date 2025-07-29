

import React, { useState, useEffect, useMemo } from 'react';
import { NodeSettingsProps } from './common';
import { InputWithVariables } from './common';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const MetaTriggerSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables, allTags, pipelines, stages }) => {
    const { data } = node;
    const config = (data.config as any) || {};

    const [isManualEntry, setIsManualEntry] = useState(false);
    
    useEffect(() => {
        // If the saved tag is not in the list of known tags, and it's not empty, enable manual entry mode.
        if (config.tag && allTags && !allTags.includes(config.tag)) {
            setIsManualEntry(true);
        } else {
            setIsManualEntry(false);
        }
    }, [config.tag, allTags]);


    const handleConfigChange = (key: string, value: any) => {
        onConfigChange({ ...config, [key]: value });
    };
    
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === '__manual__') {
            setIsManualEntry(true);
            handleConfigChange('tag', ''); // Clear the tag when switching to manual
        } else {
            setIsManualEntry(false);
            handleConfigChange('tag', value);
        }
    };

    switch (data.type) {
        case 'message_received_with_keyword':
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Palavra-chave</label>
                    <input
                        type="text"
                        value={config.keyword || ''}
                        onChange={e => handleConfigChange('keyword', e.target.value)}
                        placeholder="Ex: promoção"
                        className={baseInputClass}
                    />
                    <p className="text-xs text-slate-400 mt-1">A automação iniciará se a mensagem do contato contiver este texto (não diferencia maiúsculas/minúsculas).</p>
                </div>
            );

        case 'button_clicked':
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">ID (Payload) do Botão</label>
                    <input
                        type="text"
                        value={config.button_payload || ''}
                        onChange={e => handleConfigChange('button_payload', e.target.value)}
                        placeholder="Ex: comprar_agora_payload"
                        className={baseInputClass}
                    />
                    <p className="text-xs text-slate-400 mt-1">O ID exato (payload) do botão de resposta rápida que acionará a automação.</p>
                </div>
            );
        
        case 'new_contact_with_tag':
            const selectedValue = isManualEntry ? '__manual__' : config.tag || '';
            return (
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
                    <select
                        value={selectedValue}
                        onChange={handleSelectChange}
                        className={baseInputClass}
                    >
                        <option value="">-- Selecione uma tag existente --</option>
                        {allTags.map((tag: string) => <option key={tag} value={tag}>{tag}</option>)}
                        <option value="__manual__">Digitar tag manualmente...</option>
                    </select>

                    {isManualEntry && (
                        <div className="mt-2">
                             <InputWithVariables
                                onValueChange={val => handleConfigChange('tag', val)}
                                value={config.tag || ''}
                                type="text"
                                placeholder="Digite a nova tag aqui"
                                className={baseInputClass}
                                variables={availableVariables}
                                autoFocus
                            />
                        </div>
                    )}
                     <p className="text-xs text-slate-400 mt-1">A automação iniciará quando esta tag for adicionada a um contato.</p>
                </div>
            );

        case 'new_contact':
             return <p className="text-slate-400">Este gatilho é acionado sempre que um novo contato é criado no sistema (seja via webhook ou importação, quando aplicável).</p>;
        
        case 'deal_created':
             return <p className="text-slate-400">Este gatilho é acionado sempre que um novo negócio é criado para qualquer contato.</p>;

        case 'deal_stage_changed': {
            const stagesForPipeline = stages.filter(s => s.pipeline_id === config.pipeline_id);
            return (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Funil</label>
                        <select value={config.pipeline_id || ''} onChange={(e) => onConfigChange({ ...config, pipeline_id: e.target.value, stage_id: '' })} className={baseInputClass}>
                            <option value="">Selecione um Funil</option>
                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {config.pipeline_id && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Quando o negócio entrar na etapa</label>
                            <select value={config.stage_id || ''} onChange={(e) => handleConfigChange('stage_id', e.target.value)} className={baseInputClass}>
                                <option value="">Qualquer Etapa</option>
                                {stagesForPipeline.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1">A automação iniciará quando um negócio for movido para a etapa especificada.</p>
                </div>
            )
        }

        default:
             return <p className="text-slate-400">Nenhuma configuração necessária para este gatilho.</p>;
    }
};

export default MetaTriggerSettings;
