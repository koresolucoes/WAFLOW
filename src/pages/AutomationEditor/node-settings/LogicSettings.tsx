
import React from 'react';
import { NodeSettingsProps, InputWithVariables } from './common';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const LogicSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables }) => {
    const { data } = node;
    const config = (data.config as any) || {};

    const handleConfigChange = (key: string, value: any) => {
        onConfigChange({ ...config, [key]: value });
    };

    switch (data.type) {
        case 'condition':
             return (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Verificar Variável</label>
                         <InputWithVariables onValueChange={val => handleConfigChange('field', val)} value={config.field || ''} type="text" placeholder={'Ex: {{contact.tags}} ou {{trigger.body.id}}'} className={baseInputClass} variables={availableVariables} />
                         <p className="text-xs text-slate-400 mt-1">Insira a variável a ser verificada. Use o seletor para ajuda.</p>
                    </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Operador</label>
                        <select value={config.operator || 'contains'} onChange={(e) => handleConfigChange('operator', e.target.value)} className={baseInputClass}>
                            <option value="contains">Contém</option>
                            <option value="not_contains">Não contém</option>
                            <option value="equals">É igual a</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Valor</label>
                        <InputWithVariables onValueChange={val => handleConfigChange('value', val)} value={config.value || ''} type="text" placeholder="Valor a comparar" className={baseInputClass} variables={availableVariables} />
                    </div>
                </div>
             );
        case 'split_path':
            return <p className="text-slate-400">Este nó divide aleatoriamente os contatos em dois caminhos (A e B) com uma chance de 50% para cada.</p>;
        default:
            return <p className="text-slate-400">Configuração de lógica não reconhecida.</p>;
    }
};

export default LogicSettings;
