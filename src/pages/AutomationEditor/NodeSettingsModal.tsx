
import React, { useMemo } from 'react';
import { AutomationNode, MessageTemplate, Profile } from '../../types';
import Button from '../../components/common/Button';
import { getContextVariables } from './node-settings/common';
import { nodeConfigs } from '../../lib/automation/nodeConfigs';


interface NodeSettingsModalProps {
    node: AutomationNode | null;
    isOpen: boolean;
    onClose: () => void;
    nodes: AutomationNode[];
    templates: MessageTemplate[];
    profile: Profile | null;
    onUpdateNodes: (nodes: AutomationNode[], options?: { immediate?: boolean }) => Promise<void>;
    automationId?: string;
}

const NodeSettingsModal: React.FC<NodeSettingsModalProps> = ({ 
    node, 
    isOpen, 
    onClose, 
    nodes, 
    templates, 
    profile, 
    onUpdateNodes,
    automationId
}) => {
    
    const availableVariables = useMemo(() => getContextVariables(nodes), [nodes]);

    if (!isOpen || !node) return null;

    const { data } = node;
    const nodeConfig = nodeConfigs[data.type];

    if (!nodeConfig) {
        console.warn(`Configuração não encontrada para o tipo de nó: ${data.type}`);
        return null;
    }

    const SettingsComponent = nodeConfig.SettingsComponent;

    const handleConfigChange = (updatedConfig: any, options?: { immediate?: boolean }) => {
        if (!node) return;
        const updatedNodes = nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, config: updatedConfig } } : n);
        onUpdateNodes(updatedNodes, options);
    };
    
    const hasCapturedWebhookData = node.data.type === 'webhook_received' && !!(node.data.config as any)?.last_captured_data;
    const showVariablesPanel = ['action', 'logic'].includes(node.data.nodeType) || hasCapturedWebhookData;

    const gridColsClass = showVariablesPanel ? 'md:grid-cols-2' : 'md:grid-cols-1';
    const modalWidthClass = showVariablesPanel ? 'max-w-4xl' : 'max-w-lg';

    const renderVariablesPanel = () => {
       if (!showVariablesPanel) return null;

       return (
           <div className="max-h-[70vh] overflow-y-auto">
               <h4 className="text-lg font-semibold text-white">Variáveis Disponíveis</h4>
                {node.data.nodeType !== 'trigger' && (
                    <p className="text-sm text-slate-400 mb-3">
                        Clique em um campo de texto e use o seletor para inserir uma variável.
                    </p>
                )}
                 {(node.data.type === 'webhook_received' && hasCapturedWebhookData) && (
                     <p className="text-sm text-slate-400 mb-3">
                        Estas são as variáveis que foram capturadas e que podem ser usadas em outros nós.
                    </p>
                 )}

               <div className="space-y-2 pr-2">
                   {availableVariables.length > 0 ? availableVariables.map(group => (
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
                   )) : (
                       <p className="text-slate-400 text-sm">Nenhuma variável disponível. Configure um gatilho de Webhook e capture dados para ver as variáveis.</p>
                   )}
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
                className={`bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full ${modalWidthClass} max-h-[90vh] flex flex-col transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold text-white">{data.label}</h3>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                </header>
                
                <main className={`flex-grow p-6 overflow-y-auto grid grid-cols-1 ${gridColsClass} gap-8`}>
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-white">Configurações</h4>
                        <SettingsComponent 
                           node={node}
                           onConfigChange={handleConfigChange}
                           availableVariables={availableVariables}
                           templates={templates}
                           profile={profile}
                           automationId={automationId}
                        />
                    </div>
                    
                    {showVariablesPanel && (
                        <div className="space-y-4">
                            {renderVariablesPanel()}
                        </div>
                    )}
                </main>

                <footer className="flex-shrink-0 p-4 border-t border-slate-700 flex justify-end">
                    <Button variant="primary" onClick={onClose}>Fechar</Button>
                </footer>
            </div>
        </div>
    );
};

export default NodeSettingsModal;
