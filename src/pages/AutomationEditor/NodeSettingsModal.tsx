



import React, { useState, useEffect, memo, useRef, useCallback, useMemo } from 'react';
import { AutomationNode, MessageTemplate, Profile } from '../../types';
import Button from '../../components/common/Button';
import { COPY_ICON, INFO_ICON, PLUS_ICON, TRASH_ICON } from '../../components/icons';

// ====================================================================================
// Helper Functions
// ====================================================================================

const getContextVariables = (nodes: AutomationNode[]) => {
    const triggerNode = nodes.find(n => n.data.nodeType === 'trigger' && n.data.type === 'webhook_received');
    const capturedData = (triggerNode?.data.config as any)?.last_captured_data;

    const variables = [
        {
            group: 'Contato',
            vars: [
                { path: 'contact.name', label: 'Nome do Contato' },
                { path: 'contact.phone', label: 'Telefone do Contato' },
                { path: 'contact.tags', label: 'Tags do Contato' },
            ],
        }
    ];

    if (capturedData) {
        const flattenObject = (obj: any, parentKey = '', res: { path: string, label: string }[] = []) => {
            if (typeof obj !== 'object' || obj === null) return res;
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const propName = parentKey ? `${parentKey}.${key}` : key;
                    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                        flattenObject(obj[key], propName, res);
                    } else {
                        res.push({ path: `trigger.${propName}`, label: propName });
                    }
                }
            }
            return res;
        };
        const triggerVars = flattenObject(capturedData);
        if (triggerVars.length > 0) {
            variables.push({ group: 'Gatilho (Webhook)', vars: triggerVars });
        }
    }
    return variables;
};

const getTemplatePlaceholders = (template: MessageTemplate | undefined) => {
    if (!template?.components) return [];
    let allText = '';
    template.components.forEach(c => {
        if (c.text) {
            allText += c.text + ' ';
        }
        if (c.type === 'BUTTONS' && c.buttons) {
            c.buttons.forEach(b => {
                if (b.type === 'URL' && b.url) {
                    allText += b.url + ' ';
                }
            });
        }
    });
    const matches = allText.match(/\{\{\d+\}\}/g) || [];
    return [...new Set(matches)].filter(p => p !== '{{1}}').sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
    });
};

// ====================================================================================
// Variable Selector Component
// ====================================================================================
interface VariableSelectorProps {
    variables: ReturnType<typeof getContextVariables>;
    onSelect: (variablePath: string) => void;
}
const VariableSelector: React.FC<VariableSelectorProps> = memo(({ variables, onSelect }) => {
    return (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-slate-700 shadow-lg p-2 border border-slate-600">
            <div className="max-h-48 overflow-y-auto">
                {variables.map(group => (
                    <div key={group.group}>
                        <h5 className="text-xs font-bold text-slate-400 px-2 pt-2">{group.group}</h5>
                        <ul>
                            {group.vars.map(v => (
                                <li key={v.path}>
                                    <button
                                        type="button"
                                        className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-sky-500/20 rounded-md"
                                        onClick={() => onSelect(`{{${v.path}}}`)}
                                        title={`Inserir {{${v.path}}}`}
                                    >
                                        {v.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
});


// ====================================================================================
// Input with Variable Selector
// ====================================================================================
interface InputWithVariablesProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onValueChange: (value: string) => void;
    variables: ReturnType<typeof getContextVariables>;
}
const InputWithVariables: React.FC<InputWithVariablesProps> = ({ onValueChange, value, variables, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSelectVariable = (variablePath: string) => {
        if (!inputRef.current) return;
        const { selectionStart, selectionEnd } = inputRef.current;
        const currentValue = value || '';
        const newValue = `${currentValue.substring(0, selectionStart as number)}${variablePath}${currentValue.substring(selectionEnd as number)}`;
        onValueChange(newValue);
        inputRef.current.focus();
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                value={value}
                onChange={e => onValueChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)} // Delay to allow click on selector
                {...props}
            />
            {isFocused && <VariableSelector variables={variables} onSelect={handleSelectVariable} />}
        </div>
    );
};

interface TextareaWithVariablesProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onValueChange: (value: string) => void;
    variables: ReturnType<typeof getContextVariables>;
}
const TextareaWithVariables: React.FC<TextareaWithVariablesProps> = ({ onValueChange, value, variables, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSelectVariable = (variablePath: string) => {
        if (!textareaRef.current) return;
        const { selectionStart, selectionEnd } = textareaRef.current;
        const currentValue = value || '';
        const newValue = `${currentValue.substring(0, selectionStart as number)}${variablePath}${currentValue.substring(selectionEnd as number)}`;
        onValueChange(newValue);
        textareaRef.current.focus();
    };
    
    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onValueChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                {...props}
            />
            {isFocused && <VariableSelector variables={variables} onSelect={handleSelectVariable} />}
        </div>
    );
};


// ====================================================================================
// Main Modal Component
// ====================================================================================
interface NodeSettingsModalProps {
    node: AutomationNode | null;
    isOpen: boolean;
    onClose: () => void;
    nodes: AutomationNode[];
    templates: MessageTemplate[];
    profile: Profile | null;
    onUpdateNodes: (nodes: AutomationNode[]) => Promise<void>;
}

const NodeSettingsModal: React.FC<NodeSettingsModalProps> = ({ node, isOpen, onClose, nodes, templates, profile, onUpdateNodes }) => {
    const [isListening, setIsListening] = useState(false);
    
    const availableVariables = useMemo(() => getContextVariables(nodes), [nodes]);

    useEffect(() => {
        const config = (node?.data.config as any) || {};
        const hasData = config.last_captured_data && Object.keys(config.last_captured_data).length > 0;
        if (hasData) setIsListening(false);
    }, [node?.data.config]);
    
    const updateNodeConfig = useCallback((updatedConfig: any) => {
        if (!node) return;
        const updatedNodes = nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, config: updatedConfig } } : n);
        onUpdateNodes(updatedNodes);
    }, [node, nodes, onUpdateNodes]);

    const handleConfigChange = (key: string, value: any) => {
        if (!node) return;
        const currentConfig = (typeof node.data.config === 'object' && node.data.config && !Array.isArray(node.data.config)) ? node.data.config : {};
        updateNodeConfig({ ...currentConfig, [key]: value });
    };

    const handleStartListening = async () => {
        setIsListening(true);
        handleConfigChange('last_captured_data', null);
    };

    const handleMappingChange = useCallback((source: string, destination: string, destination_key?: string) => {
        if (!node) return;
        const config = (node.data.config as any) || {};
        let newMapping = [...(config.data_mapping || [])];
        const existingIndex = newMapping.findIndex(m => m.source === source);

        if (destination === 'ignore') {
             newMapping = newMapping.filter(m => m.source !== source);
        } else {
             const newRule = { source, destination, destination_key };
            if (destination === 'phone') newMapping = newMapping.filter(m => m.destination !== 'phone');
            if (existingIndex > -1) newMapping[existingIndex] = newRule;
            else newMapping.push(newRule);
        }
        handleConfigChange('data_mapping', newMapping);
    }, [node, handleConfigChange]);

    if (!isOpen || !node) return null;

    const { data, id } = node;
    const config = (data.config as any) || {};

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
                    )
                })}
                </div>
            </div>
        )
    };
    
    const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

    const renderConfig = () => {
        switch (data.type) {
            case 'webhook_received':
                const webhookPrefix = profile?.webhook_path_prefix || profile?.id;
                const webhookUrl = `${window.location.origin}/api/trigger/${webhookPrefix}_${id}`;
                return (
                     <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">URL do Webhook</label>
                            <div className="flex items-center gap-2">
                                <input type="text" readOnly value={webhookUrl} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-slate-400 font-mono text-xs" />
                                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(webhookUrl)}><COPY_ICON className="w-4 h-4"/></Button>
                            </div>
                             <p className="text-xs text-slate-400 mt-1">Esta URL é única para este nó e já está ativa.</p>
                        </div>
                        <div className="border-t border-slate-700 pt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Escuta de Webhook</label>
                             {isListening ? (
                                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                                    <svg className="animate-spin h-6 w-6 text-sky-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="text-sm text-sky-300 mt-2">Aguardando dados...</p>
                                    <p className="text-xs text-slate-400 mt-1">Envie uma requisição POST com um corpo JSON para a URL.</p>
                                </div>
                            ) : (
                                <Button size="sm" variant="secondary" onClick={handleStartListening}>Limpar e Escutar por Novos Dados</Button>
                            )}
                        </div>
                        {renderDataMapping()}
                    </div>
                )
            case 'send_template': {
                 const approvedTemplates = templates.filter(t => t.status === 'APPROVED');
                 const selectedTemplate = templates.find(t => t.id === config.template_id);
                 const placeholders = selectedTemplate ? getTemplatePlaceholders(selectedTemplate) : [];

                 return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Selecione o Template</label>
                            <select value={config.template_id || ''} onChange={(e) => handleConfigChange('template_id', e.target.value)} className={baseInputClass}>
                                <option value="">-- Selecione um template --</option>
                                {approvedTemplates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
                            </select>
                            {approvedTemplates.length === 0 && <p className="text-xs text-amber-400 mt-1">Nenhum template APROVADO encontrado.</p>}
                        </div>

                        {placeholders.length > 0 && (
                            <div className="border-t border-slate-700 pt-4 space-y-3">
                                <h5 className="text-md font-semibold text-white">Preencher Variáveis</h5>
                                {placeholders.map(p => (
                                    <div key={p}>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Variável {p}
                                        </label>
                                        <InputWithVariables
                                            onValueChange={val => handleConfigChange(p, val)}
                                            value={config[p] || ''}
                                            type="text"
                                            placeholder={`Valor para ${p}`}
                                            className={baseInputClass}
                                            variables={availableVariables}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                 );
            }
            case 'send_text_message':
                return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Texto da Mensagem</label>
                        <TextareaWithVariables onValueChange={val => handleConfigChange('message_text', val)} value={config.message_text || ''} placeholder="Digite sua mensagem..." rows={4} className={baseInputClass} variables={availableVariables} />
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
                )
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
                            {buttons.map((btn, index) => (
                                <div key={btn.id} className="flex items-center gap-2">
                                    <InputWithVariables onValueChange={val => handleButtonChange(index, val)} value={btn.text} type="text" placeholder={`Texto do botão ${index + 1}`} className={baseInputClass} variables={availableVariables} />
                                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => removeButton(index)}><TRASH_ICON className="w-4 h-4"/></Button>
                                </div>
                            ))}
                            </div>
                            {buttons.length < 3 && <Button size="sm" variant="secondary" className="mt-2" onClick={addButton}><PLUS_ICON className="w-4 h-4 mr-1"/> Adicionar Botão</Button>}
                        </div>
                    </div>
                )
            case 'send_webhook':
                return (
                     <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">URL para Envio (POST)</label>
                            <InputWithVariables onValueChange={val => handleConfigChange('url', val)} value={config.url || ''} type="text" placeholder="https://..." className={baseInputClass} variables={availableVariables} />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Corpo (JSON)</label>
                            <TextareaWithVariables onValueChange={val => handleConfigChange('body', val)} value={config.body || ''} placeholder={`{ "id": "{{contact.id}}", "event": "new_tag" }`} rows={5} className={`${baseInputClass} font-mono`} variables={availableVariables} />
                        </div>
                    </div>
                )
            case 'condition':
                 return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Campo</label>
                             <InputWithVariables onValueChange={val => handleConfigChange('field', val)} value={config.field || ''} type="text" placeholder={'tags ou {{trigger.body.id}}'} className={baseInputClass} variables={availableVariables} />
                             <p className="text-xs text-slate-400 mt-1">Para contato: 'tags', 'name'. Para gatilho: use o seletor.</p>
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
                return <p className="text-slate-400">Este nó divide aleatoriamente os contatos em dois caminhos (A e B) com uma chance de 50% para cada.</p>
            default:
                return <p className="text-slate-400">Nenhuma configuração necessária para este nó.</p>;
        }
    };
    
    const renderVariablesPanel = () => {
       if (data.type === 'webhook_received') return null;

       return (
           <div>
               <h4 className="text-lg font-semibold text-white">Variáveis Disponíveis</h4>
               <p className="text-sm text-slate-400 mb-3">Clique em um campo de texto à esquerda e use o seletor para inserir uma variável.</p>
               <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                   {availableVariables.map(group => (
                        <div key={group.group}>
                            <h5 className="text-sm font-bold text-slate-300 px-2 pt-2">{group.group}</h5>
                            <ul className="pl-2">
                                {group.vars.map(v => (
                                    <li key={v.path} className="text-sm text-slate-400 font-mono py-0.5" title={v.path}>
                                        {`{{${v.path}}}`}
                                    </li>
                                ))}
                            </ul>
                        </div>
                   ))}
               </div>
           </div>
       )
    }

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
            
            <div 
                className={`bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold text-white">{data.label}</h3>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                </header>
                
                <main className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-white">Configurações</h4>
                        {renderConfig()}
                    </div>
                    
                    <div className="space-y-4">
                       {renderVariablesPanel()}
                    </div>
                </main>

                <footer className="flex-shrink-0 p-4 border-t border-slate-700 flex justify-end">
                    <Button variant="primary" onClick={onClose}>Fechar</Button>
                </footer>
            </div>
        </div>
    );
};

export default NodeSettingsModal;