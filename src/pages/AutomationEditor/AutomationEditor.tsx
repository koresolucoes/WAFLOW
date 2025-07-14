


import React, { useContext, useState, useEffect, useCallback, memo } from 'react';
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from '@xyflow/react';
import { AppContext } from '../../contexts/AppContext';
import { Automation, AutomationInsert, AutomationNode, NodeData, TriggerType, ActionType, LogicType, MessageTemplate, Profile } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { AUTOMATION_ICON, PLUS_ICON, TRASH_ICON, COPY_ICON, INFO_ICON } from '../../components/icons';


const initialNodes: AutomationNode[] = [];
const initialEdges: Edge[] = [];

// ====================================================================================
// Helper Functions
// ====================================================================================

const flattenObject = (obj: any, parentKey = '', res: Record<string, any> = {}) => {
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

const getValueFromPath = (obj: any, path: string) => {
    if (!path) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}


// ====================================================================================
// Custom Node Components
// ====================================================================================

const nodeStyles = {
    base: "bg-slate-800 border-2 rounded-lg shadow-xl text-white w-72",
    body: "p-4 space-y-1",
    header: "px-4 py-2 rounded-t-lg font-bold text-sm flex items-center gap-2",
    trigger: "border-sky-500",
    action: "border-pink-500",
    logic: "border-purple-500",
    triggerHeader: "bg-sky-500/20",
    actionHeader: "bg-pink-500/20",
    logicHeader: "bg-purple-500/20",
    label: "text-base font-semibold",
    description: "text-xs text-slate-400"
};

const CustomNode = ({ data }: NodeProps<NodeData>) => {
    const isTrigger = data.nodeType === 'trigger';

    const nodeTypeStyle = data.nodeType;
    const headerStyle = `${nodeStyles.header} ${nodeStyles[`${nodeTypeStyle}Header`]}`;
    const borderStyle = `${nodeStyles.base} ${nodeStyles[nodeTypeStyle]}`;

    return (
        <div className={borderStyle}>
            <div className={headerStyle}>
                <AUTOMATION_ICON className="w-4 h-4" />
                {data.nodeType.charAt(0).toUpperCase() + data.nodeType.slice(1)}
            </div>
            <div className={nodeStyles.body}>
                <p className={nodeStyles.label}>{data.label}</p>
                <p className={nodeStyles.description}>Tipo: {data.type}</p>
            </div>
            {!isTrigger && <Handle type="target" position={Position.Left} className="!bg-slate-400" />}
            <Handle type="source" position={Position.Right} className="!bg-slate-400" />
        </div>
    );
};

const ConditionNode = ({ data }: NodeProps<NodeData>) => {
    return (
      <div className={`${nodeStyles.base} ${nodeStyles.logic}`}>
        <div className={`${nodeStyles.header} ${nodeStyles.logicHeader}`}>
            <AUTOMATION_ICON className="w-4 h-4" />
            Lógica
        </div>
        <div className={nodeStyles.body}>
            <p className={nodeStyles.label}>{data.label}</p>
            <p className={nodeStyles.description}>
                {`${(data.config as any)?.field || ''} ${(data.config as any)?.operator || ''} "${(data.config as any)?.value || ''}"`}
            </p>
        </div>
        <Handle type="target" position={Position.Left} className="!bg-slate-400" />
        
        <Handle type="source" id="yes" position={Position.Right} style={{ top: '40%' }} className="!bg-green-500" />
        <div className="absolute right-[-25px] top-[40%] -translate-y-1/2 text-xs text-green-400 font-bold">Sim</div>
        
        <Handle type="source" id="no" position={Position.Right} style={{ top: '70%' }} className="!bg-red-500" />
        <div className="absolute right-[-25px] top-[70%] -translate-y-1/2 text-xs text-red-400 font-bold">Não</div>
      </div>
    );
};

const SplitPathNode = ({ data }: NodeProps<NodeData>) => {
    return (
      <div className={`${nodeStyles.base} ${nodeStyles.logic}`}>
        <div className={`${nodeStyles.header} ${nodeStyles.logicHeader}`}>
            <AUTOMATION_ICON className="w-4 h-4" />
            Lógica
        </div>
        <div className={nodeStyles.body}>
            <p className={nodeStyles.label}>{data.label}</p>
            <p className={nodeStyles.description}>Divide o fluxo em 50/50 aleatoriamente.</p>
        </div>
        <Handle type="target" position={Position.Left} className="!bg-slate-400" />
        
        <Handle type="source" id="a" position={Position.Right} style={{ top: '40%' }} className="!bg-sky-500" />
        <div className="absolute right-[-35px] top-[40%] -translate-y-1/2 text-xs text-sky-400 font-bold">Via A</div>
        
        <Handle type="source" id="b" position={Position.Right} style={{ top: '70%' }} className="!bg-amber-500" />
        <div className="absolute right-[-35px] top-[70%] -translate-y-1/2 text-xs text-amber-400 font-bold">Via B</div>
      </div>
    );
};


const nodeTypes = {
    trigger: (props: NodeProps<NodeData>) => <CustomNode {...props} />,
    action: (props: NodeProps<NodeData>) => <CustomNode {...props} />,
    logic: (props: NodeProps<NodeData>) => {
        if (props.data.type === 'condition') {
            return <ConditionNode {...props} />;
        }
        if (props.data.type === 'split_path') {
            return <SplitPathNode {...props} />;
        }
        return <CustomNode {...props} />;
    },
};

// ====================================================================================
// Sidebar & Settings Panel Components
// ====================================================================================

const DraggableNode = ({ type, label, onDragStart, specificType }: { type: 'trigger' | 'action' | 'logic', label: string, onDragStart: (event: React.DragEvent, nodeType: string, type: string, label: string) => void, specificType: string }) => (
    <div
        className="p-3 mb-2 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-grab bg-slate-800 hover:bg-slate-700 hover:border-sky-500"
        onDragStart={(event) => onDragStart(event, type, specificType, label)}
        draggable
    >
        <p className="font-semibold text-sm">{label}</p>
    </div>
);

const NodeSidebar = ({ onDragStart }: { onDragStart: (event: React.DragEvent, nodeType: string, specificType: string, label: string) => void }) => (
    <Card className="w-80 h-full overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-4">Blocos</h3>
        <p className="text-sm text-slate-400 mb-4">Arraste os blocos para a área de trabalho para construir sua automação.</p>
        <div>
            <h4 className="font-semibold text-sky-300 mb-2">Gatilhos (Início)</h4>
            <DraggableNode type="trigger" label="Novo Contato" specificType="new_contact" onDragStart={onDragStart} />
            <DraggableNode type="trigger" label="Tag Adicionada" specificType="new_contact_with_tag" onDragStart={onDragStart} />
            <DraggableNode type="trigger" label="Msg com Palavra-chave" specificType="message_received_with_keyword" onDragStart={onDragStart} />
            <DraggableNode type="trigger" label="Botão Clicado" specificType="button_clicked" onDragStart={onDragStart} />
            <DraggableNode type="trigger" label="Webhook Recebido" specificType="webhook_received" onDragStart={onDragStart} />
        </div>
        <div className="mt-6">
            <h4 className="font-semibold text-pink-300 mb-2">Ações</h4>
            <DraggableNode type="action" label="Enviar Template" specificType="send_template" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Enviar Texto Simples" specificType="send_text_message" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Enviar Mídia" specificType="send_media" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Enviar Msg com Botões" specificType="send_interactive_message" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Adicionar Tag" specificType="add_tag" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Remover Tag" specificType="remove_tag" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Definir Campo" specificType="set_custom_field" onDragStart={onDragStart} />
            <DraggableNode type="action" label="Enviar Webhook" specificType="send_webhook" onDragStart={onDragStart} />
        </div>
         <div className="mt-6">
            <h4 className="font-semibold text-purple-300 mb-2">Lógica</h4>
            <DraggableNode type="logic" label="Condição (Se/Senão)" specificType="condition" onDragStart={onDragStart} />
            <DraggableNode type="logic" label="Dividir Caminho (A/B)" specificType="split_path" onDragStart={onDragStart} />
        </div>
    </Card>
);

const SettingsPanel = ({ node, setNodes, templates, profile, automationId }: { node: AutomationNode, setNodes: React.Dispatch<React.SetStateAction<AutomationNode[]>>, templates: MessageTemplate[], profile: Profile | null, automationId?: string }) => {
    const { data, id } = node;
    const config = (data.config as any) || {};
    const [isListening, setIsListening] = useState(false);

    // Watch for incoming data to stop the listening state
    useEffect(() => {
        if (config.last_captured_data) {
            setIsListening(false);
        }
    }, [config.last_captured_data]);

    const updateNodeConfig = (key: string, value: any) => {
        setNodes(nds => nds.map(n => {
            if (n.id === id) {
                const oldConfig = (typeof n.data.config === 'object' && n.data.config && !Array.isArray(n.data.config)) ? n.data.config : {};
                return { ...n, data: { ...n.data, config: { ...oldConfig, [key]: value } } };
            }
            return n;
        }));
    };
    
    const handleStartListening = () => {
        if (!automationId) {
            alert("Por favor, salve a automação primeiro para ativar o modo de escuta.");
            return;
        }
        // This relies on an external save function to persist the state change
        // We clear the data, and the parent component should save this change
        updateNodeConfig('last_captured_data', null);
        setIsListening(true);
        // The parent onSave will be called after this state update, persisting the change
        setTimeout(() => {
             const saveButton = document.getElementById('automation-save-button') as HTMLButtonElement;
             if (saveButton) {
                saveButton.click();
                alert("Modo de escuta ativado. Envie uma requisição de teste para a URL do webhook para capturar os dados.");
             }
        }, 100);
    }
    
    const handleMappingChange = (source: string, destination: string, destination_key?: string) => {
        let newMapping = [...(config.data_mapping || [])];
        const existingIndex = newMapping.findIndex(m => m.source === source);

        if (destination === 'ignore') {
             newMapping = newMapping.filter(m => m.source !== source);
        } else {
             const newRule = { source, destination, destination_key };
            // Ensure only one field is mapped to phone
            if (destination === 'phone') {
                newMapping = newMapping.filter(m => m.destination !== 'phone');
            }
             if (existingIndex > -1) {
                newMapping[existingIndex] = newRule;
            } else {
                newMapping.push(newRule);
            }
        }
        updateNodeConfig('data_mapping', newMapping);
    };

    const renderDataMapping = () => {
        if (!config.last_captured_data) return null;
        
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
                    const value = flattenedData[key];
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
    }

    const renderConfig = () => {
        switch (data.type) {
            case 'new_contact_with_tag':
            case 'add_tag':
            case 'remove_tag':
                return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
                        <input type="text" value={config.tag || ''} onChange={(e) => updateNodeConfig('tag', e.target.value)} placeholder="Ex: vip" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                    </div>
                );
            case 'message_received_with_keyword':
                 return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Palavra-chave</label>
                        <input type="text" value={config.keyword || ''} onChange={(e) => updateNodeConfig('keyword', e.target.value)} placeholder="Ex: promoção" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                         <p className="text-xs text-slate-400 mt-1">A automação iniciará se a mensagem do contato contiver esta palavra.</p>
                    </div>
                );
            case 'button_clicked':
                 return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">ID do Botão</label>
                        <input type="text" value={config.button_payload || ''} onChange={(e) => updateNodeConfig('button_payload', e.target.value)} placeholder="O ID único do botão" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                    </div>
                );
            case 'send_template':
                 const approvedTemplates = templates.filter(t => t.status === 'APPROVED');
                 return (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Selecione o Template</label>
                        <select value={config.template_id || ''} onChange={(e) => updateNodeConfig('template_id', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
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
                        <textarea value={config.message_text || ''} onChange={(e) => updateNodeConfig('message_text', e.target.value)} placeholder="Digite sua mensagem. Use {{contact.name}} para o nome." rows={4} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                    </div>
                );
            case 'condition':
                 return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Campo do Contato</label>
                            <select value={config.field || 'tags'} onChange={(e) => updateNodeConfig('field', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                <option value="tags">Tags</option>
                                <option value="name">Nome</option>
                                <option value="custom_fields">Campo Personalizado</option>
                            </select>
                        </div>
                        {config.field === 'custom_fields' && (
                             <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Campo Personalizado</label>
                                <input type="text" value={config.custom_field_name || ''} onChange={(e) => updateNodeConfig('custom_field_name', e.target.value)} placeholder="Ex: id_pedido" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                            </div>
                        )}
                         <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Operador</label>
                            <select value={config.operator || 'contains'} onChange={(e) => updateNodeConfig('operator', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                <option value="contains">Contém</option>
                                <option value="not_contains">Não contém</option>
                                <option value="equals">É igual a</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Valor</label>
                            <input type="text" value={config.value || ''} onChange={(e) => updateNodeConfig('value', e.target.value)} placeholder="Valor a comparar" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
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
                             <p className="text-xs text-slate-400 mt-1">Salve a automação para que esta URL se torne ativa.</p>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-300 mb-1">Método HTTP</label>
                             <select value={config.method || 'POST'} onChange={(e) => updateNodeConfig('method', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                            </select>
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
                                    <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setIsListening(false)}>Cancelar</Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="secondary" onClick={handleStartListening} disabled={!automationId}>Limpar e Escutar por Dados</Button>
                            )}
                             {!isListening && <p className="text-xs text-slate-400 mt-1">Clique, salve, e envie um teste. Os dados capturados aparecerão abaixo para mapeamento.</p>}
                        </div>
                        {renderDataMapping()}
                    </div>
                )
            case 'send_media':
                return (
                    <div className="space-y-3">
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Mídia</label>
                            <select value={config.media_type || 'image'} onChange={(e) => updateNodeConfig('media_type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                                <option value="image">Imagem</option>
                                <option value="video">Vídeo</option>
                                <option value="document">Documento</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">URL da Mídia</label>
                            <input type="url" value={config.media_url || ''} onChange={(e) => updateNodeConfig('media_url', e.target.value)} placeholder="https://..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Legenda (Opcional)</label>
                            <textarea value={config.caption || ''} onChange={(e) => updateNodeConfig('caption', e.target.value)} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                    </div>
                )
            case 'send_interactive_message':
                const buttons = Array.isArray(config.buttons) ? config.buttons : [];
                const handleButtonChange = (index: number, field: string, value: string) => {
                    const newButtons = buttons.map((b, i) => i === index ? {...b, [field]: value} : b);
                    updateNodeConfig('buttons', newButtons);
                }
                const addButton = () => {
                    if (buttons.length < 3) {
                        const newButtons = [...buttons, {id: `btn_${Date.now()}`, text: ''}];
                        updateNodeConfig('buttons', newButtons);
                    }
                }
                 const removeButton = (index: number) => {
                    const newButtons = buttons.filter((_, i) => i !== index);
                    updateNodeConfig('buttons', newButtons);
                }

                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Texto Principal</label>
                            <textarea value={config.message_text || ''} onChange={(e) => updateNodeConfig('message_text', e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-300 mb-1">Botões (Quick Reply)</label>
                             <div className="space-y-2">
                                {buttons.map((btn: any, index: number) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input type="text" value={btn.text} onChange={e => handleButtonChange(index, 'text', e.target.value)} placeholder={`Botão ${index + 1}`} className="flex-grow bg-slate-800 border border-slate-600 rounded-md p-1.5 text-white text-sm" />
                                        <button onClick={() => removeButton(index)} className="p-1 text-slate-400 hover:text-red-400"><TRASH_ICON className="w-4 h-4" /></button>
                                    </div>
                                ))}
                             </div>
                             {buttons.length < 3 && <Button size="sm" variant="ghost" className="mt-2" onClick={addButton}>+ Adicionar Botão</Button>}
                        </div>
                    </div>
                )
             case 'set_custom_field':
                 return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Campo</label>
                            <input type="text" value={config.field_name || ''} onChange={(e) => updateNodeConfig('field_name', e.target.value)} placeholder="Ex: plano" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Valor do Campo</label>
                            <input type="text" value={config.field_value || ''} onChange={(e) => updateNodeConfig('field_value', e.target.value)} placeholder="Ex: premium" className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                    </div>
                );
            case 'send_webhook':
                return (
                     <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">URL do Webhook</label>
                            <input type="url" value={config.url || ''} onChange={(e) => updateNodeConfig('url', e.target.value)} placeholder="https://..." className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-300 mb-1">Corpo da Requisição (JSON)</label>
                             <textarea value={config.body || ''} onChange={(e) => updateNodeConfig('body', e.target.value)} rows={5} placeholder={`{ "name": "{{contact.name}}" }`} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-xs" />
                        </div>
                    </div>
                )
            case 'split_path':
                return <p className="text-slate-400">Este nó divide aleatoriamente os contatos em dois caminhos (A e B) com uma chance de 50% para cada.</p>
            default:
                return <p className="text-slate-400">Nenhuma configuração necessária para este nó.</p>;
        }
    };

    return (
         <Card className="w-80 h-full overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Configurações</h3>
            <div className="space-y-4">
                <div>
                    <p className="block text-sm font-medium text-slate-300">Nó Selecionado</p>
                    <p className="font-semibold text-white">{data.label}</p>
                </div>
                <div className="border-t border-slate-700 pt-4">
                     {renderConfig()}
                </div>
            </div>
        </Card>
    )
};

// ====================================================================================
// Flow Canvas Component
// ====================================================================================

const FlowCanvas = () => {
    const { pageParams, automations, templates, addAutomation, updateAutomation, setCurrentPage, profile } = useContext(AppContext);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<AutomationNode | null>(null);

    const [automationName, setAutomationName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = Boolean(pageParams.automationId);
    const automationId = pageParams.automationId;

    useEffect(() => {
        if (isEditing) {
            const existingAutomation = automations.find(a => a.id === pageParams.automationId);
            if (existingAutomation) {
                setAutomationName(existingAutomation.name);
                setNodes(existingAutomation.nodes || []);
                setEdges(existingAutomation.edges || []);
            }
        }
    }, [isEditing, pageParams.automationId, automations, setNodes, setEdges]);

    const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const nodeType = event.dataTransfer.getData('application/reactflow-nodetype') as 'trigger' | 'action' | 'logic';
        const specificType = event.dataTransfer.getData('application/reactflow-specifictype') as TriggerType | ActionType | LogicType;
        const label = event.dataTransfer.getData('application/reactflow-label');

        if (typeof nodeType === 'undefined' || !nodeType || !reactFlowInstance) return;

        const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const newNode: AutomationNode = {
            id: `${specificType}_${Date.now()}`,
            type: nodeType,
            position,
            data: {
                nodeType: nodeType,
                type: specificType,
                label,
                config: {},
            },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes]);

    const onNodeClick = useCallback((_: any, node: Node<NodeData>) => {
        setSelectedNode(node);
    }, []);
    
    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const onSave = async () => {
        setError(null);
        if (!automationName.trim()) return setError("O nome da automação é obrigatório.");
        const triggerNodes = nodes.filter(n => n.data.nodeType === 'trigger');
        if (triggerNodes.length === 0) return setError("A automação precisa de pelo menos um gatilho.");

        setIsSaving(true);
        const automationData = {
            name: automationName,
            status: isEditing ? (automations.find(a => a.id === pageParams.automationId)?.status || 'active') : 'active',
            nodes: nodes as AutomationNode[],
            edges,
        };
        try {
            if (isEditing) {
                await updateAutomation({ ...automationData, id: pageParams.automationId } as unknown as Automation);
            } else {
                await addAutomation(automationData as unknown as Omit<AutomationInsert, 'id' | 'user_id' | 'created_at'>);
            }
            if(!document.getElementById('automation-save-button')?.classList.contains('triggered-by-listener')){
                setCurrentPage('automations');
            }
        } catch (err: any) {
             setError(err.message || 'Ocorreu um erro ao salvar.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDragStart = (event: React.DragEvent, nodeType: string, specificType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow-nodetype', nodeType);
        event.dataTransfer.setData('application/reactflow-specifictype', specificType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.effectAllowed = 'move';
    };


    return (
        <div className="h-full flex flex-col">
             <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm z-10">
                <input
                    type="text"
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="Nome da sua Automação"
                    className="bg-transparent text-xl font-bold text-white focus:outline-none w-1/2"
                />
                 <div className="flex items-center gap-3">
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button variant="secondary" onClick={() => setCurrentPage('automations')} disabled={isSaving}>Cancelar</Button>
                    <Button id="automation-save-button" variant="primary" onClick={onSave} isLoading={isSaving}>
                        {isEditing ? 'Salvar Alterações' : 'Criar Automação'}
                    </Button>
                </div>
            </header>
            <div className="flex-grow flex relative">
                <div className="w-full h-full">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-slate-900 xyflow-react"
                    >
                        <Background color="#475569" gap={16} />
                        <Controls />
                    </ReactFlow>
                </div>
                <aside className="absolute right-0 top-0 h-full bg-slate-800/50 p-4 border-l border-slate-700 backdrop-blur-sm z-10">
                   {selectedNode ? 
                    <SettingsPanel node={selectedNode} setNodes={setNodes as any} templates={templates} profile={profile} automationId={automationId}/> 
                    : <NodeSidebar onDragStart={handleDragStart} />}
                </aside>
            </div>
        </div>
    );
};


// ====================================================================================
// Main Page Component
// ====================================================================================

const AutomationEditor: React.FC = () => {
    return (
        <div className="w-full h-full -m-8">
            <ReactFlowProvider>
                <FlowCanvas />
            </ReactFlowProvider>
        </div>
    );
};

export default AutomationEditor;
