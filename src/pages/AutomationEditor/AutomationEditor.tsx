
import React, { useContext, useState, useEffect, useCallback, memo, FC } from 'react';
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps, useReactFlow, NodeTypes, type NodeChange } from '@xyflow/react';
import { AppContext } from '../../contexts/AppContext';
import { Automation, AutomationNode, NodeData } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { supabase } from '../../lib/supabaseClient';
import { AUTOMATION_ICON } from '../../components/icons';
import NodeSettingsModal from './NodeSettingsModal';
import { nodeConfigs } from '../../lib/automation/nodeConfigs';

const initialNodes: AutomationNode[] = [];
const initialEdges: Edge[] = [];

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

const CustomNode: FC<NodeProps> = (props) => {
    const data = props.data as NodeData;
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

const ConditionNode: FC<NodeProps> = (props) => {
    const data = props.data as NodeData;
    const config = (data.config as any) || {};
    const conditionText = `${config.field || ''} ${config.operator || ''} "${config.value || ''}"`;
    return (
      <div className={`${nodeStyles.base} ${nodeStyles.logic}`}>
        <div className={`${nodeStyles.header} ${nodeStyles.logicHeader}`}>
            <AUTOMATION_ICON className="w-4 h-4" />
            Lógica
        </div>
        <div className={nodeStyles.body}>
            <p className={nodeStyles.label}>{data.label}</p>
            <p className={nodeStyles.description} title={conditionText}>
               {conditionText.length > 35 ? `${conditionText.substring(0, 32)}...` : conditionText}
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

const SplitPathNode: FC<NodeProps> = (props) => {
    const data = props.data as NodeData;
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

const LogicNodeResolver: FC<NodeProps> = (props) => {
    const data = props.data as NodeData;
    if (data.type === 'condition') return <ConditionNode {...props} />;
    if (data.type === 'split_path') return <SplitPathNode {...props} />;
    return <CustomNode {...props} />;
};

const nodeTypes: NodeTypes = {
    trigger: CustomNode,
    action: CustomNode,
    logic: LogicNodeResolver,
};


const DraggableNode = ({ nodeType, onDragStart }: { nodeType: string, onDragStart: (event: React.DragEvent, nodeData: NodeData) => void }) => {
    const config = nodeConfigs[nodeType];
    if (!config) return null;

    return (
        <div
            className="p-3 mb-2 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-grab bg-slate-800 hover:bg-slate-700 hover:border-sky-500"
            onDragStart={(event) => onDragStart(event, config.data as NodeData)}
            draggable
        >
            <p className="font-semibold text-sm">{config.label}</p>
        </div>
    );
};

const NodeSidebar = memo(({ onDragStart }: { onDragStart: (event: React.DragEvent, nodeData: NodeData) => void }) => {
    const triggerNodes = Object.keys(nodeConfigs).filter(key => nodeConfigs[key].nodeType === 'trigger');
    const actionNodes = Object.keys(nodeConfigs).filter(key => nodeConfigs[key].nodeType === 'action');
    const logicNodes = Object.keys(nodeConfigs).filter(key => nodeConfigs[key].nodeType === 'logic');

    return (
        <Card className="w-full h-full overflow-y-auto !p-4 bg-transparent shadow-none">
            <h3 className="text-xl font-bold text-white mb-4">Blocos</h3>
            <p className="text-sm text-slate-400 mb-4">Arraste os blocos para a área de trabalho para construir sua automação.</p>
            <div>
                <h4 className="font-semibold text-sky-300 mb-2">Gatilhos (Início)</h4>
                {triggerNodes.map(type => <DraggableNode key={type} nodeType={type} onDragStart={onDragStart} />)}
            </div>
            <div className="mt-6">
                <h4 className="font-semibold text-pink-300 mb-2">Ações</h4>
                {actionNodes.map(type => <DraggableNode key={type} nodeType={type} onDragStart={onDragStart} />)}
            </div>
             <div className="mt-6">
                <h4 className="font-semibold text-purple-300 mb-2">Lógica</h4>
                {logicNodes.map(type => <DraggableNode key={type} nodeType={type} onDragStart={onDragStart} />)}
            </div>
        </Card>
    );
});


const FlowCanvas = () => {
    const { pageParams, automations, templates, updateAutomation, setCurrentPage, profile } = useContext(AppContext);
    const { screenToFlowPosition } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<AutomationNode | null>(null);

    const [automationName, setAutomationName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const automationId = pageParams.automationId;

    // --- State Synchronization Effect ---
    useEffect(() => {
        if (!automationId || !automations) return;

        const currentAutomation = automations.find(a => a.id === automationId);

        if (currentAutomation) {
            setAutomationName(currentAutomation.name);
            setNodes(currentAutomation.nodes || []);
            setEdges(currentAutomation.edges || []);
            
            if (selectedNode) {
                const updatedSelectedNode = (currentAutomation.nodes || []).find(n => n.id === selectedNode.id);
                if (updatedSelectedNode) {
                     if (JSON.stringify(selectedNode) !== JSON.stringify(updatedSelectedNode)) {
                        setSelectedNode(updatedSelectedNode);
                    }
                } else {
                    setSelectedNode(null);
                }
            }
        }
    }, [automationId, automations]);

    // This effect ensures that if the modal is open, it gets the latest node data.
    useEffect(() => {
        if (selectedNode) {
            const currentAutomation = automations.find(a => a.id === automationId);
            const latestNode = currentAutomation?.nodes.find(n => n.id === selectedNode.id);
            if (latestNode && JSON.stringify(latestNode) !== JSON.stringify(selectedNode)) {
                setSelectedNode(latestNode);
            }
        }
    }, [nodes, edges, automations, selectedNode, automationId]);


    // Effect for real-time updates from Supabase.
    useEffect(() => {
        if (!automationId) return;

        const channel = supabase.channel(`automation-editor-realtime-${automationId}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'automations', 
                filter: `id=eq.${automationId}` 
            }, (payload) => {
                const updatedAutomation = payload.new as unknown as Automation;
                updateAutomation(updatedAutomation);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [automationId, updateAutomation]);
    
    // Custom handler to prevent trigger node deletion
    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            const DONT_DELETE_TRIGGER_CHANGES = changes.filter(change => {
                if (change.type === 'remove') {
                    const nodeToRemove = nodes.find(n => n.id === change.id);
                    if (nodeToRemove?.data.nodeType === 'trigger') {
                        return false; 
                    }
                }
                return true;
            });
            onNodesChange(DONT_DELETE_TRIGGER_CHANGES);
        },
        [nodes, onNodesChange]
    );

    const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        const nodeDataString = event.dataTransfer.getData('application/reactflow-nodedata');

        if (!nodeDataString) return;

        const nodeData: NodeData = JSON.parse(nodeDataString);

        if (nodeData.nodeType === 'trigger' && nodes.some(n => n.data.nodeType === 'trigger')) {
            alert("Uma automação só pode ter um gatilho.");
            return;
        }

        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const newNode: AutomationNode = {
            id: `${nodeData.type}_${Date.now()}`,
            type: nodeData.nodeType,
            position,
            data: nodeData,
        };
        setNodes((nds) => nds.concat(newNode));
    }, [screenToFlowPosition, setNodes, nodes]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node as AutomationNode), []);
    const onPaneClick = useCallback(() => setSelectedNode(null), []);
    const onNodesDelete = useCallback(() => setSelectedNode(null), []);
    
    const handlePartialUpdate = async (updatedNodes: AutomationNode[]) => {
         const automationData = {
            id: automationId,
            name: automationName,
            status: automations.find(a => a.id === automationId)?.status || 'active',
            nodes: updatedNodes,
            edges,
        };
        await updateAutomation(automationData as unknown as Automation);
    };

    const onSave = async () => {
        setError(null);
        if (!automationName.trim()) return setError("O nome da automação é obrigatório.");
        if (nodes.filter(n => n.data.nodeType === 'trigger').length !== 1) return setError("A automação precisa de exatamente um gatilho.");
        if (!automationId) return setError("ID da automação não encontrado. Não é possível salvar.");

        setIsSaving(true);
        const automationData = {
            id: automationId,
            name: automationName,
            status: automations.find(a => a.id === automationId)?.status || 'active',
            nodes,
            edges,
        };
        try {
            await updateAutomation(automationData as unknown as Automation);
            setCurrentPage('automations');
        } catch (err: any) {
             setError(err.message || 'Ocorreu um erro ao salvar.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDragStart = (event: React.DragEvent, nodeData: NodeData) => {
        event.dataTransfer.setData('application/reactflow-nodedata', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="h-full flex flex-col bg-slate-900">
             <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm z-10 shrink-0">
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
                    <Button variant="primary" onClick={onSave} isLoading={isSaving}>
                        Salvar Alterações
                    </Button>
                </div>
            </header>
            <div className="flex-grow flex relative">
                 <aside className="w-80 h-full p-4 border-r border-slate-700 bg-slate-800/50 backdrop-blur-sm z-10">
                   <NodeSidebar onDragStart={handleDragStart} />
                </aside>

                <div className="flex-grow h-full">
                    <ReactFlow
                        nodes={nodes as Node[]}
                        edges={edges}
                        onNodesChange={handleNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onNodesDelete={onNodesDelete}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-slate-900 xyflow-react"
                    >
                        <Background color="#475569" gap={16} />
                        <Controls />
                    </ReactFlow>
                </div>
            </div>
             <NodeSettingsModal
                node={selectedNode}
                isOpen={!!selectedNode}
                onClose={() => setSelectedNode(null)}
                nodes={nodes}
                templates={templates}
                profile={profile}
                onUpdateNodes={handlePartialUpdate}
            />
        </div>
    );
};

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
