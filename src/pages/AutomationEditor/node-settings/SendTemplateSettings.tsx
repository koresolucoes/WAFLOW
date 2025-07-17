
import React, { useMemo } from 'react';
import { NodeSettingsProps, InputWithVariables } from './common';
import { getTemplatePlaceholders } from './utils';
import { PlaceholderInfo } from './utils';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const SendTemplateSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables, templates }) => {
    const config = (node.data.config as any) || {};

    const handleConfigChange = (key: string, value: any) => {
        onConfigChange({ ...config, [key]: value });
    };

    const approvedTemplates = useMemo(() => templates.filter(t => t.status === 'APPROVED'), [templates]);
    const selectedTemplate = useMemo(() => templates.find(t => t.id === config.template_id), [templates, config.template_id]);
    const placeholders: PlaceholderInfo[] = useMemo(() => getTemplatePlaceholders(selectedTemplate), [selectedTemplate]);

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Selecione o Template</label>
                <select 
                    value={config.template_id || ''} 
                    onChange={(e) => onConfigChange({ template_id: e.target.value })} // Reset config on change
                    className={baseInputClass}
                >
                    <option value="">-- Selecione um template --</option>
                    {approvedTemplates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
                </select>
                {approvedTemplates.length === 0 && <p className="text-xs text-amber-400 mt-1">Nenhum template APROVADO encontrado.</p>}
            </div>

            {placeholders.length > 0 && (
                <div className="border-t border-slate-700 pt-4 space-y-3">
                    <h5 className="text-md font-semibold text-white">Preencher Variáveis</h5>
                    {placeholders.map(p => (
                        <div key={p.placeholder}>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Variável {p.placeholder}
                                <span className="text-xs text-slate-400 ml-2">({p.location})</span>
                            </label>
                            <InputWithVariables
                                onValueChange={val => handleConfigChange(p.placeholder, val)}
                                value={config[p.placeholder] || ''}
                                type="text"
                                placeholder={`Valor para ${p.placeholder}`}
                                className={baseInputClass}
                                variables={availableVariables}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SendTemplateSettings;
