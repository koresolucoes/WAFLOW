


import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Automation, AutomationNode, NodeData, MessageTemplate, Profile } from '../../types';
import Button from '../../components/common/Button';
import { COPY_ICON, INFO_ICON } from '../../components/icons';

// ====================================================================================
// Helper Components
// ====================================================================================

const flattenObject = (obj: any, parentKey = '', res: Record<string, any> = {}) => {
  if (typeof obj !== 'object' || obj === null) return res;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const propName = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], propName, res);
      } else {
        res[propName] = obj[key];
      }
    }
  }
  return res;
};

const VariablePill = memo(({ path, value }: { path: string; value: string }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/variable-path', `{{trigger.${path}}}`);
        e.dataTransfer.effectAllowed = 'copy';
    };
    return (
        <div draggable onDragStart={handleDragStart} className="flex justify-between items-center bg-slate-800 p-1.5 rounded-md cursor-grab hover:bg-sky-500/20 group">
            <span className="text-xs font-mono text-sky-300 group-hover:text-sky-200" title={path}>{path}</span>
            <span className="text-xs text-slate-400 truncate ml-2" title={String(value)}>{String(value)}</span>
        </div>
    );
});

const VariablesPanel = memo(({ nodes }: { nodes: AutomationNode[] }) => {
    const triggerNode = nodes.find(n => n.data.nodeType === 'trigger' && n.data.type === 'webhook_received');
    const capturedData = (triggerNode?.data.config as any)?.last_captured_data;

    if (!capturedData || Object.keys(capturedData).length === 0) {
        return <p className="text-xs text-slate-400 p-2 bg-slate-700/50 rounded-md">Para usar variáveis, clique em "Limpar e Escutar" e envie uma requisição de teste para a URL do webhook.</p>;
    }
    
    const flattened = flattenObject(capturedData);

    return (
        <div>
            <h4 className="text-md font-semibold text-white mb-2">Variáveis Disponíveis</h4>
            <p className="text-xs text-slate-400 mb-2">Arraste uma variável para um campo de texto à esquerda.</p>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-2 bg-slate-900/50 p-2 rounded-md">
                {Object.entries(flattened).map(([key, value]) => (
                    <VariablePill key={key} path={key} value={value} />
                ))}
            </div>
        </div>
    );
});

const DroppableInput = (props: React.InputHTMLAttributes<HTMLInputElement> & { onValueChange: (value: string) => void }) => {
    const { onValueChange, ...rest } = props;
    const [isDragOver, setIsDragOver] = useState(false);
    const ref = useRef<HTMLInputElement>(null);

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const path = e.dataTransfer.getData('application/variable-path');
        if (path && ref.current) {
            const { selectionStart, selectionEnd } = ref.current;
            const currentValue = ref.current.value || '';
            const newValue = `${currentValue.substring(0, selectionStart as number)}${path}${currentValue.substring(selectionEnd as number)}`;
            onValueChange(newValue);
        }
    };
    
    return <input ref={ref} {...rest} onDrop={onDrop} onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} className={`${props.className} transition-all ${isDragOver ? 'ring-2 ring-sky-500' : 'ring-0 ring-transparent'}`} />;
};

const DroppableTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { onValueChange: (value: string) => void }) => {
    const { onValueChange, ...rest } = props;
    const [isDragOver, setIsDragOver] = useState(false);
    const ref = useRef<HTMLTextAreaElement>(null);

     const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const path = e.dataTransfer.getData('application/variable-path');
        if (path && ref.current) {
            const { selectionStart, selectionEnd } = ref.current;
            const currentValue = ref.current.value || '';
            const newValue = `${currentValue.substring(0, selectionStart as number)}${path}${currentValue.substring(selectionEnd as number)}`;
            onValueChange(newValue);
        }
    };

    return <textarea ref={ref} {...rest} onDrop={onDrop} onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} className={`${props.className} transition-all ${isDragOver ? 'ring-2 ring-sky-500' : 'ring-0 ring-transparent'}`} />;
};

interface NodeSettingsModalProps {
    node: AutomationNode | null;
    isOpen: boolean;
    onClose: () => void;
    nodes: AutomationNode[];
    setNodes: React.Dispatch<React.SetStateAction<AutomationNode[]>>;
    templates: MessageTemplate[];
    profile: Profile | null;
    automationId?: string;
    updateAutomation: (automation: Automation) => Promise<void>;
}

const NodeSettingsModal: React.FC<NodeSettingsModalProps> = ({ node, isOpen, onClose, nodes, setNodes, templates, profile, automationId, updateAutomation }) => {
    const [isListening, setIsListening] = useState(false);
    
    useEffect(() => {
        // Automatically turn off listening indicator when data arrives
        const config = (node?.data.config as any) || {};
        const hasData = config.last_captured_data && Object.keys(config.last_captured_data).length > 0;
        if (hasData) {
            setIsListening(false);
        }
    }, [node?.data.config]);
    
    const updateNodeConfig = useCallback((key: string, value: any) => {
        if (!node) return;
        setNodes(nds => nds.map(n => {
            if (n.id === node.id) {
                const oldConfig = (typeof n.data.config === 'object' && n.data.config && !Array.isArray(n.data.config)) ? n.data.config : {};
                return { ...n, data: { ...n.data, config: { ...oldConfig, [key]: value } } };
            }
            return n;
        }));
    }, [node, setNodes]);

    const handleStartListening = async () => {
        setIsListening(true);
        const newConfig = { ...(node!.data.config as object || {}), last_captured_data: null };
        const updatedNode = { ...node!, data: { ...node!.data, config: newConfig } };
        
        // This creates a partial automation object just for the update.
        // The AppContext merges it with the full automation data.
        const currentAutomation = { 
            id: automationId!, 
            nodes: nodes.map(n => n.id === node!.id ? updatedNode : n) 
        } as Automation;
        
        await updateAutomation(currentAutomation);
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
        updateNodeConfig('data_mapping', newMapping);
    }, [node, updateNodeConfig]);

    if (!isOpen || !node) return null;

    const { data, id } = node;
    const config = (data.config as any) || {};

    const renderDataMapping = () => {
        if (!config.last_captured_data || Object.keys(config.last_captured_data).length === 0) return null;
        
        const flattenedData = flattenObject(config.last_captured_data);
        const capturedKeys = Object.keys(flattenedData);
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
                    const value = flattenedData[key] ?? '';
                    const mappingRule = currentMapping.find((m: any) => m.source === key);
                    const destination = mappingRule?.destination || 'ignore';
                    
                    return (
                        <div key={key} className="p-2 bg-slate-700/50 rounded-lg">
                            <p className="text-xs text-slate-400 font-mono truncate" title={key}>{key}</p>
                            <p className="text-sm text-white font-semibold truncate my-1" title={String(value)}>{String(value)}</p>
                             <select 
                                value={destination} 
                                onChange={(e) => handleMappingChange(key, e.target.value)}
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
                                    onChange={(e) => handleMappingChange(key, 'custom_field', e.target.value)}
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

    const renderConfig = () => {
        const baseInputClass = "w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white";

        switch (data.type) {
            case 'add_tag':
                return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
                        <DroppableInput type="text" value={config.tag || ''} onValueChange={val => updateNodeConfig('tag', val)} placeholder="Ex: vip" className={baseInputClass} />
                    </div>
                );
            case 'send_template':
                 const approvedTemplates = templates.filter(t => t.status === 'APPROVED');
                 return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Selecione o Template</label>
                        <select value={config.template_id || ''} onChange={(e) => updateNodeConfig('template_id', e.target.value)} className={baseInputClass}>
                            <option value="">-- Selecione um template --</option>
                            {approvedTemplates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
                        </select>
                         {approvedTemplates.length === 0 && <p className="text-xs text-amber-400 mt-1">Nenhum template APROVADO encontrado.</p>}
                    </div>
                 );
            case 'send_text_message':
                return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Texto da Mensagem</label>
                        <DroppableTextarea value={config.message_text || ''} onValueChange={val => updateNodeConfig('message_text', val)} placeholder="Digite sua mensagem..." rows={4} className={baseInputClass} />
                    </div>
                );
            case 'condition':
                 return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Campo</label>
                             <DroppableInput type="text" value={config.field || ''} onValueChange={val => updateNodeConfig('field', val)} placeholder={'tags ou {{trigger.body.id}}'} className={baseInputClass} />
                             <p className="text-xs text-slate-400 mt-1">Para contato: 'tags', 'name'. Para gatilho: arraste a variável.</p>
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Operador</label>
                            <select value={config.operator || 'contains'} onChange={(e) => updateNodeConfig('operator', e.target.value)} className={baseInputClass}>
                                <option value="contains">Contém</option>
                                <option value="not_contains">Não contém</option>
                                <option value="equals">É igual a</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Valor</label>
                            <DroppableInput type="text" value={config.value || ''} onValueChange={val => updateNodeConfig('value', val)} placeholder="Valor a comparar" className={baseInputClass} />
                        </div>
                    </div>
                 );
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
                                <Button size="sm" variant="secondary" onClick={handleStartListening} disabled={!automationId}>Limpar e Escutar por Novos Dados</Button>
                            )}
                        </div>
                        {renderDataMapping()}
                    </div>
                )
            case 'split_path':
                return <p className="text-slate-400">Este nó divide aleatoriamente os contatos em dois caminhos (A e B) com uma chance de 50% para cada.</p>
            default:
                return <p className="text-slate-400">Nenhuma configuração necessária para este nó.</p>;
        }
    };

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
                        {(data.nodeType === 'action' || data.type === 'condition' || data.type === 'webhook_received') && <VariablesPanel nodes={nodes} />}
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
