
import React from 'react';
import { NodeSettingsProps, InputWithVariables, TextareaWithVariables } from './common';
import { PLUS_ICON, TRASH_ICON } from '../../../components/icons';
import Button from '../../../components/common/Button';

const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

const ActionSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, availableVariables, pipelines, stages }) => {
    const { data } = node;
    const config = (data.config as any) || {};

    const handleConfigChange = (key: string, value: any) => {
        onConfigChange({ ...config, [key]: value });
    };

    switch (data.type) {
        case 'send_text_message':
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Texto da Mensagem</label>
                    <TextareaWithVariables 
                        onValueChange={val => handleConfigChange('message_text', val)} 
                        value={config.message_text || ''} 
                        placeholder="Digite sua mensagem..." 
                        rows={4} 
                        className={baseInputClass} 
                        variables={availableVariables} 
                    />
                </div>
            );
        case 'add_tag':
             return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
                        <InputWithVariables onValueChange={val => handleConfigChange('tag', val)} value={config.tag || ''} type="text" placeholder="Ex: vip" className={baseInputClass} variables={availableVariables} />
                    </div>
                );
        case 'remove_tag':
            return (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag a Remover</label>
                     <InputWithVariables onValueChange={val => handleConfigChange('tag', val)} value={config.tag || ''} type="text" placeholder="Ex: lead-antigo" className={baseInputClass} variables={availableVariables} />
                </div>
            );
        case 'set_custom_field':
            return (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Campo</label>
                        <InputWithVariables onValueChange={val => handleConfigChange('field_name', val)} value={config.field_name || ''} type="text" placeholder="Ex: id_pedido" className={baseInputClass} variables={availableVariables} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Valor do Campo</label>
                        <InputWithVariables onValueChange={val => handleConfigChange('field_value', val)} value={config.field_value || ''} type="text" placeholder="Ex: 12345 ou {{trigger.body.id}}" className={baseInputClass} variables={availableVariables} />
                    </div>
                </div>
             );
        case 'send_media':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Mídia</label>
                            <select value={config.media_type || 'image'} onChange={(e) => handleConfigChange('media_type', e.target.value)} className={baseInputClass}>
                                <option value="image">Imagem</option>
                                <option value="video">Vídeo</option>
                                <option value="document">Documento</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">URL da Mídia</label>
                            <InputWithVariables onValueChange={val => handleConfigChange('media_url', val)} value={config.media_url || ''} type="text" placeholder="https://..." className={baseInputClass} variables={availableVariables} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Legenda (Opcional)</label>
                            <TextareaWithVariables onValueChange={val => handleConfigChange('caption', val)} value={config.caption || ''} placeholder="Digite uma legenda..." rows={2} className={baseInputClass} variables={availableVariables} />
                        </div>
                    </div>
                );
        case 'send_interactive_message':
                const buttons = Array.isArray(config.buttons) ? config.buttons : [];
                const handleButtonChange = (index: number, text: string) => {
                    const newButtons = [...buttons];
                    newButtons[index] = { ...newButtons[index], text };
                    handleConfigChange('buttons', newButtons);
                }
                const addButton = () => {
                     const newButtons = [...buttons, { id: `btn_${Date.now()}`, text: ''}];
                     handleConfigChange('buttons', newButtons);
                }
                 const removeButton = (index: number) => {
                    const newButtons = buttons.filter((_, i) => i !== index);
                    handleConfigChange('buttons', newButtons);
                }
                return (
                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Texto Principal</label>
                            <TextareaWithVariables onValueChange={val => handleConfigChange('message_text', val)} value={config.message_text || ''} placeholder="Digite a pergunta ou texto..." rows={3} className={baseInputClass} variables={availableVariables} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Botões (até 3)</label>
                            <div className="space-y-2">
                            {buttons.map((btn: any, index: number) => (
                                <div key={btn.id || index} className="flex items-center gap-2">
                                    <InputWithVariables onValueChange={val => handleButtonChange(index, val)} value={btn.text} type="text" placeholder={`Texto do botão ${index + 1}`} className={baseInputClass} variables={availableVariables} />
                                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => removeButton(index)}><TRASH_ICON className="w-4 h-4"/></Button>
                                </div>
                            ))}
                            </div>
                            {buttons.length < 3 && <Button size="sm" variant="secondary" className="mt-2" onClick={addButton}><PLUS_ICON className="w-4 h-4 mr-1"/> Adicionar Botão</Button>}
                        </div>
                    </div>
                );
        case 'create_deal': {
            const stagesForPipeline = stages.filter(s => s.pipeline_id === config.pipeline_id);
            return (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Negócio</label>
                        <InputWithVariables onValueChange={val => handleConfigChange('deal_name', val)} value={config.deal_name || ''} type="text" placeholder="Negócio para {{contact.name}}" className={baseInputClass} variables={availableVariables} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Valor do Negócio (R$)</label>
                        <InputWithVariables onValueChange={val => handleConfigChange('deal_value', val)} value={config.deal_value || ''} type="number" placeholder="1500.00" className={baseInputClass} variables={availableVariables} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Funil</label>
                        <select value={config.pipeline_id || ''} onChange={(e) => onConfigChange({ ...config, pipeline_id: e.target.value, stage_id: '' })} className={baseInputClass}>
                            <option value="">Selecione um funil</option>
                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {config.pipeline_id && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Etapa Inicial</label>
                            <select value={config.stage_id || ''} onChange={(e) => handleConfigChange('stage_id', e.target.value)} className={baseInputClass}>
                                <option value="">Selecione uma etapa</option>
                                {stagesForPipeline.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            );
        }
        case 'update_deal_stage': {
            const stagesForPipeline = stages.filter(s => s.pipeline_id === config.pipeline_id);
            return (
                <div className="space-y-3">
                     <p className="text-xs text-slate-400">Esta ação irá atualizar o negócio mais recente associado ao contato.</p>
                     <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Funil de Destino</label>
                        <select value={config.pipeline_id || ''} onChange={(e) => onConfigChange({ ...config, pipeline_id: e.target.value, stage_id: '' })} className={baseInputClass}>
                            <option value="">Selecione um funil</option>
                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {config.pipeline_id && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Nova Etapa</label>
                            <select value={config.stage_id || ''} onChange={(e) => handleConfigChange('stage_id', e.target.value)} className={baseInputClass}>
                                <option value="">Selecione a nova etapa</option>
                                {stagesForPipeline.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            );
        }
        default:
             return <p className="text-slate-400">Nenhuma configuração necessária para este nó de ação.</p>;
    }
};

export default ActionSettings;