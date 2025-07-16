
import React from 'react';
import { NodeSettingsProps } from './common';
import { InputWithVariables } from './common';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const MetaTriggerSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables }) => {
    const { data } = node;
    const config = (data.config as any) || {};

    const handleConfigChange = (key: string, value: any) => {
        onConfigChange({ ...config, [key]: value });
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
            return (
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
                    <InputWithVariables
                        onValueChange={val => handleConfigChange('tag', val)}
                        value={config.tag || ''}
                        type="text"
                        placeholder="Ex: vip"
                        className={baseInputClass}
                        variables={availableVariables}
                    />
                     <p className="text-xs text-slate-400 mt-1">A automação iniciará quando esta tag for adicionada a um contato.</p>
                </div>
            );

        case 'new_contact':
             return <p className="text-slate-400">Este gatilho é acionado sempre que um novo contato é criado no sistema (seja via webhook ou importação, quando aplicável).</p>;

        default:
             return <p className="text-slate-400">Nenhuma configuração necessária para este gatilho.</p>;
    }
};

export default MetaTriggerSettings;
