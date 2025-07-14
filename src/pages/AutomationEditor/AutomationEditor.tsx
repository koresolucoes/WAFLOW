
import React, { useContext, useState, useEffect, useMemo, useCallback, memo } from 'react';
import ReactFlow, { ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, Node, Edge, NodeProps } from '@xyflow/react';
import { AppContext } from '../../contexts/AppContext';
import { Automation, AutomationInsert, AutomationNode, NodeData, TriggerType, ActionType, MessageTemplate } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { AUTOMATION_ICON, PLUS_ICON, TRASH_ICON } from '../../components/icons';

const initialNodes: AutomationNode[] = [];
const initialEdges: Edge[] = [];

// ====================================================================================
// Custom Node Components
// ====================================================================================

const nodeStyles = {
    base: "bg-slate-800 border-2 rounded-lg shadow-xl text-white w-72",
    body: "p-4",
    header: "px-4 py-2 rounded-t-lg font-bold text-sm flex items-center gap-2",
    trigger: "border-sky-500",
    action: "border-pink-500",
    triggerHeader: "bg-sky-500/20",
    actionHeader: "bg-pink-500/20",
    label: "text-lg font-semibold",
    description: "text-xs text-slate-400 mt-1"
};

const CustomNode = memo(({ data }: NodeProps<NodeData>) => {
    const isTrigger = data.nodeType === 'trigger';

    return (
        <div className={`${nodeStyles.base} ${isTrigger ? nodeStyles.trigger : nodeStyles.action}`}>
            <div className={`${nodeStyles.header} ${isTrigger ? nodeStyles.triggerHeader : nodeStyles.actionHeader}`}>
                <AUTOMATION_ICON className="w-4 h-4" />
                {isTrigger ? 'Gatilho' : 'Ação'}
            </div>
            <div className={nodeStyles.body}>
                <p className={nodeStyles.label}>{data.label}</p>
                <p className={nodeStyles.description}>Tipo: {data.type}</p>
            </div>
            {!isTrigger && <Handle type="target" position={Position.Left} className="!bg-slate-400" />}
            <Handle type="source" position={Position.Right} className="!bg-slate-400" />
        </div>
    );
});

const nodeTypes = {
    trigger: (props: NodeProps<NodeData>) => <CustomNode {...props} />,
    action: (props: NodeProps<NodeData>) => <CustomNode {...props} />,
};

// ====================================================================================
// Sidebar & Settings Panel Components
// ====================================================================================

const DraggableNode = ({ type, label, onDragStart }: { type: 'trigger' | 'action', label: string, onDragStart: (event: React.DragEvent, nodeType: string, type: string) => void }) => (
    <div
        className="p-3 mb-2 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-grab bg-slate-800 hover:bg-slate-700 hover:border-sky-500"
        onDragStart={(event) => onDragStart(event, type, label)}
        draggable
    >
        <p className="font-semibold">{label}</p>
    </div>
);

const NodeSidebar = ({ onDragStart }: { onDragStart: (event: React.DragEvent, nodeType: string, typeName: string) => void }) => (
    <Card className="w-80">
        <h3 className="text-xl font-bold text-white mb-4">Blocos</h3>
        <p className="text-sm text-slate-400 mb-4">Arraste os blocos para a área de trabalho para construir sua automação.</p>
        <div>
            <h4 className="font-semibold text-sky-300 mb-2">Gatilhos</h4>
            <DraggableNode type="trigger" label="Contato com Tag" onDragStart={(e, type) => onDragStart(e, type, 'new_contact_with_tag')} />
            <DraggableNode type="trigger" label="Mensagem com Palavra-chave" onDragStart={(e, type) => onDragStart(e, type, 'message_received_with_keyword')} />
        </div>
        <div className="mt-6">
            <h4 className="font-semibold text-pink-300 mb-2">Ações</h4>
            <DraggableNode type="action" label="Enviar Template" onDragStart={(e, type) => onDragStart(e, type, 'send_template')} />
            <DraggableNode type="action" label="Adicionar Tag" onDragStart={(e, type) => onDragStart(e, type, 'add_tag')} />
        </div>
    </Card>
);

const SettingsPanel = ({ node, setNodes, templates }: { node: AutomationNode, setNodes: React.Dispatch<React.SetStateAction<AutomationNode[]>>, templates: MessageTemplate[] }) => {
    const { data, id } = node;

    const updateNodeConfig = (key: string, value: any) => {
        setNodes(nds => nds.map(n => {
            if (n.id === id) {
                const oldConfig = (typeof n.data.config === 'object' && n.data.config && !Array.isArray(n.data.config)) ? n.data.config : {};
                return { ...n, data: { ...n.data, config: { ...oldConfig, [key]: value } } };
            }
            return n;
        }));
    };

    const renderConfig = () => {
        const config = data.config as any || {};
        switch (data.type) {
            case 'new_contact_with_tag':
            case 'add_tag':
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
            default:
                return <p className="text-slate-400">Nenhuma configuração necessária para este nó.</p>;
        }
    };

    return (
         <Card className="w-80">
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
    const { pageParams, automations, templates, addAutomation, updateAutomation, setCurrentPage } = useContext(AppContext);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<AutomationNode | null>(null);

    const [automationName, setAutomationName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = Boolean(pageParams.automationId);

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
        const type = event.dataTransfer.getData('application/reactflow-nodetype');
        const label = event.dataTransfer.getData('application/reactflow-label');
        const specificType = event.dataTransfer.getData('application/reactflow-specifictype');

        if (typeof type === 'undefined' || !type || !reactFlowInstance) return;

        const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const newNode: AutomationNode = {
            id: `node_${Date.now()}`,
            type,
            position,
            data: {
                nodeType: type as 'trigger' | 'action',
                type: specificType as TriggerType | ActionType,
                label,
                config: {},
            },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes]);

    const onNodeClick = useCallback((_: any, node: AutomationNode) => {
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
            status: 'active', // Default status
            nodes: nodes as AutomationNode[],
            edges,
        };
        try {
            if (isEditing) {
                await updateAutomation({ ...automationData, id: pageParams.automationId } as unknown as Automation);
            } else {
                await addAutomation(automationData as unknown as Omit<AutomationInsert, 'id' | 'user_id' | 'created_at'>);
            }
            setCurrentPage('automations');
        } catch (err: any) {
             setError(err.message || 'Ocorreu um erro ao salvar.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDragStart = (event: React.DragEvent, nodeType: string, specificType: string) => {
        const label = event.currentTarget.textContent || 'Novo Nó';
        event.dataTransfer.setData('application/reactflow-nodetype', nodeType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.setData('application/reactflow-specifictype', specificType);
        event.dataTransfer.effectAllowed = 'move';
    };


    return (
        <div className="h-full flex flex-col">
             <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm">
                <input
                    type="text"
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="Nome da sua Automação"
                    className="bg-transparent text-xl font-bold text-white focus:outline-none"
                />
                 <div className="flex items-center gap-3">
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <Button variant="secondary" onClick={() => setCurrentPage('automations')} disabled={isSaving}>Cancelar</Button>
                    <Button variant="primary" onClick={onSave} isLoading={isSaving}>
                        {isEditing ? 'Salvar Alterações' : 'Criar Automação'}
                    </Button>
                </div>
            </header>
            <div className="flex-grow flex">
                <div className="w-[calc(100%-320px)] h-full">
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
                <aside className="w-80 h-full bg-slate-800/50 p-4 border-l border-slate-700 overflow-y-auto">
                   {selectedNode ? <SettingsPanel node={selectedNode} setNodes={setNodes as any} templates={templates} /> : <NodeSidebar onDragStart={handleDragStart} />}
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
