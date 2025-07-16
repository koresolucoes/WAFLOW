
import React, { useContext, useState, useEffect, useCallback, memo, FC } from 'react';
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps, useReactFlow, NodeTypes, NodeChange, applyNodeChanges, EdgeLabelRenderer, getBezierPath, type EdgeProps as XyEdgeProps } from '@xyflow/react';
import { AppContext } from '../../contexts/AppContext';
import { Automation, AutomationNode, NodeData, AutomationNodeStats, AutomationNodeLog, TriggerType, ActionType, LogicType } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { supabase } from '../../lib/supabaseClient';
import { AUTOMATION_ICON } from '../../components/icons';
import NodeSettingsModal from './NodeSettingsModal';
import { nodeConfigs } from '../../lib/automation/nodeConfigs';
import { Json } from '../../types/database.types';
import NodeStats from './NodeStats';
import NodeLogsModal from './NodeLogsModal';

const initialNodes: AutomationNode[] = [];
const initialEdges: Edge[] = [];

// ====================================================================================
// Custom Edge Component
// ====================================================================================
const CustomDeletableEdge: FC<XyEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((es) => es.filter((e) => e.id !== id));
  };

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan group"
        >
          <button
            className="w-5 h-5 bg-slate-700 hover:bg-red-500 flex items-center justify-center rounded-full text-white text-xs font-mono transition-colors duration-150 opacity-0 group-hover:opacity-100"
            onClick={onEdgeClick}
            title="Deletar conexão"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// ====================================================================================
// Custom Node Components
// ====================================================================================

const nodeStyles = {
    base: "bg-slate-800 border-2 rounded-lg shadow-xl text-white w-72",
    body: "p-4",
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

const CustomNode: FC<NodeProps<AutomationNode>> = ({ id, data, selected }) => {
    const { deleteElements } = useReactFlow();
    const { automationStats, pageParams, fetchNodeLogs } = useContext(AppContext);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [logs, setLogs] = useState<AutomationNodeLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const isTrigger = data.nodeType === 'trigger';
    const stats = automationStats[id];

    const nodeTypeStyle = data.nodeType;
    const headerStyle = `${nodeStyles.header} ${nodeStyles[`${nodeTypeStyle}Header`]}`;
    const borderStyle = `${nodeStyles.base} ${nodeStyles[nodeTypeStyle]}`;
    
    const handleViewLogs = async () => {
        setIsLoadingLogs(true);
        setIsLogsModalOpen(true);
        const fetchedLogs = await fetchNodeLogs(pageParams.automationId, id);
        setLogs(fetchedLogs);
        setIsLoadingLogs(false);
    };

    return (
        <div className={`${borderStyle} relative group`}>
            {!isTrigger && selected && (
                <button 
                    onClick={(event) => {
                        event.stopPropagation();
                        deleteElements({ nodes: [{ id }] });
                    }} 
                    className="absolute top-[-10px] right-[-10px] bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 z-10"
                    aria-label="Deletar Nó"
                >
                    &times;
                </button>
            )}
            <Handle type="target" position={Position.Left} className="!bg-slate-500" isConnectable={!isTrigger} />
            <div className={headerStyle}>
                <AUTOMATION_ICON className="w-4 h-4" />
                <span>{data.label}</span>
            </div>
            <div className={nodeStyles.body}>
                <p className={nodeStyles.description}>Clique para configurar este nó.</p>
                <NodeStats stats={stats} onViewLogs={handleViewLogs}/>
            </div>
            <Handle type="source" position={Position.Right} className="!bg-slate-500" />
            <NodeLogsModal isOpen={isLogsModalOpen} onClose={() => setIsLogsModalOpen(false)} nodeLabel={data.label} logs={logs} isLoading={isLoadingLogs} />
        </div>
    );
};


const ConditionNode: FC<NodeProps<AutomationNode>> = ({ id, data, selected }) => {
    const { deleteElements } = useReactFlow();
    const { automationStats, pageParams, fetchNodeLogs } = useContext(AppContext);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [logs, setLogs] = useState<AutomationNodeLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const stats = automationStats[id];

    const isTrigger = data.nodeType === 'trigger';

    const handleViewLogs = async () => {
        setIsLoadingLogs(true);
        setIsLogsModalOpen(true);
        const fetchedLogs = await fetchNodeLogs(pageParams.automationId, id);
        setLogs(fetchedLogs);
        setIsLoadingLogs(false);
    };

    return (
        <div className={`${nodeStyles.base} ${nodeStyles.logic} relative group`}>
            {selected && (
                 <button 
                    onClick={(event) => {
                        event.stopPropagation();
                        deleteElements({ nodes: [{ id }] });
                    }} 
                    className="absolute top-[-10px] right-[-10px] bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 z-10"
                    aria-label="Deletar Nó"
                >
                    &times;
                </button>
            )}
            <Handle type="target" position={Position.Top} className="!bg-slate-500" />
            
            <div className={`${nodeStyles.header} ${nodeStyles.logicHeader}`}>
                <AUTOMATION_ICON className="w-4 h-4" />
                <span>{data.label}</span>
            </div>
            
            <div className={`${nodeStyles.body} text-center`}>
                <p className={nodeStyles.description}>Clique para configurar as regras de condição.</p>
                <NodeStats stats={stats} onViewLogs={handleViewLogs}/>
            </div>

            <div className="flex justify-between relative px-5 py-2">
                <div className="text-center">
                    <Handle type="source" position={Position.Bottom} id="yes" className="!bg-green-500 !bottom-[-5px]" />
                    <span className="text-xs font-semibold text-green-400">SIM</span>
                </div>
                <div className="text-center">
                    <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !bottom-[-5px]" />
                    <span className="text-xs font-semibold text-red-400">NÃO</span>
                </div>
            </div>
             <NodeLogsModal isOpen={isLogsModalOpen} onClose={() => setIsLogsModalOpen(false)} nodeLabel={data.label} logs={logs} isLoading={isLoadingLogs} />
        </div>
    );
};

// ====================================================================================
// Editor Sidebar
// ====================================================================================
const Sidebar: React.FC<{ onAddNode: (type: string) => void }> = memo(({ onAddNode }) => {
    const nodeGroups = {
        Triggers: Object.entries(nodeConfigs).filter(([, c]) => c.nodeType === 'trigger'),
        Actions: Object.entries(nodeConfigs).filter(([, c]) => c.nodeType === 'action'),
        Logic: Object.entries(nodeConfigs).filter(([, c]) => c.nodeType === 'logic'),
    };
    
    return (
        <Card className="w-80 h-full flex-shrink-0 overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Adicionar Etapa</h2>
            {Object.entries(nodeGroups).map(([groupName, configs]) => (
                <div key={groupName} className="mb-4">
                    <h3 className="font-semibold text-sky-300 mb-2">{groupName}</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {configs.map(([type, config]) => (
                            <button
                                key={type}
                                onClick={() => onAddNode(config.data.type as string)}
                                className="p-3 text-left bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-white"
                            >
                                {config.label}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </Card>
    );
});

// ====================================================================================
// Main Editor Component
// ====================================================================================

const Editor: React.FC = () => {
    const { automations, updateAutomation, pageParams, setCurrentPage, templates, profile, fetchAutomationStats, automationStats, fetchNodeLogs, setAutomationStats } = useContext(AppContext);
    
    const [automation, setAutomation] = useState<Automation | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSaving, setIsSaving] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<AutomationNode | null>(null);

    const { setViewport, screenToFlowPosition, deleteElements } = useReactFlow();
    const saveTimeoutRef = React.useRef<NodeJS.Timeout>();
    const hasFetchedStats = React.useRef(false);

    useEffect(() => {
        const currentAutomation = automations.find(a => a.id === pageParams.automationId);
        if (currentAutomation) {
            setAutomation(currentAutomation);
            // Initialize stats for this automation if not present
            if (!hasFetchedStats.current) {
                fetchAutomationStats(currentAutomation.id);
                hasFetchedStats.current = true;
            }
        } else if (pageParams.automationId) {
            console.error(`Automação com ID ${pageParams.automationId} não encontrada.`);
        }

        // Real-time subscription for stats
        const channel = supabase
            .channel(`automation-stats-${pageParams.automationId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'automation_node_stats', 
                filter: `automation_id=eq.${pageParams.automationId}` 
            }, 
            (payload) => {
                const newStat = payload.new as AutomationNodeStats;
                if (newStat && newStat.node_id) {
                    setAutomationStats(prev => ({ ...prev, [newStat.node_id]: newStat }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            hasFetchedStats.current = false;
        };

    }, [automations, pageParams.automationId, fetchAutomationStats, setAutomationStats]);

    useEffect(() => {
        if (automation) {
            setNodes(automation.nodes || []);
            setEdges(automation.edges || []);
        }
    }, [automation, setNodes, setEdges]);
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!automation) return;
        const newAutomation = { ...automation, name: e.target.value };
        setAutomation(newAutomation);
        saveChanges(newAutomation);
    };

    const saveChanges = useCallback((dataToSave: Automation) => {
        setIsSaving(true);
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(async () => {
            await updateAutomation(dataToSave);
            setIsSaving(false);
        }, 1000);
    }, [updateAutomation]);
    
    const onConnect = useCallback((params: any) => {
        if (!automation) return;
        const newEdge = { ...params, type: 'deletable' };
        const newEdges = addEdge(newEdge, edges);
        setEdges(newEdges);
        saveChanges({ ...automation, nodes, edges: newEdges });
    }, [automation, edges, nodes, saveChanges, setEdges]);

    const addNode = (type: string) => {
        if (!automation) return;

        const { label, nodeType, data: nodeData } = nodeConfigs[type];

        const position = screenToFlowPosition({
            x: 350,
            y: 150,
        });

        const newNode: AutomationNode = {
            id: `${type}_${Date.now()}`,
            type: nodeType,
            position,
            data: {
                nodeType: nodeType,
                type: type as TriggerType | ActionType | LogicType,
                label: label,
                config: nodeData.config || {},
            },
        };
        
        const newNodes = [...nodes, newNode];
        setNodes(newNodes);
        saveChanges({ ...automation, nodes: newNodes, edges });
    };

    const handleUpdateNodes = useCallback(async (updatedNodes: AutomationNode[]) => {
        if (!automation) return;
        setNodes(updatedNodes);
        saveChanges({ ...automation, nodes: updatedNodes, edges });
    }, [automation, edges, saveChanges, setNodes]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: AutomationNode) => {
        setSelectedNode(node);
        setIsSettingsModalOpen(true);
    }, []);

    const handleCloseModal = () => {
        setIsSettingsModalOpen(false);
        setSelectedNode(null);
    };
    
    const nodeTypes: NodeTypes = React.useMemo(() => ({
        trigger: CustomNode,
        action: CustomNode,
        logic: ConditionNode,
    }), []);

    const edgeTypes = React.useMemo(() => ({
        deletable: CustomDeletableEdge,
    }), []);
    
    if (!automation) {
        return <div className="text-center text-white">Carregando automação...</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 p-4 border-b border-slate-700/50 flex items-center justify-between">
                <input
                    type="text"
                    value={automation.name}
                    onChange={handleNameChange}
                    className="bg-transparent text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-md px-2 py-1"
                />
                <div className="flex items-center gap-4">
                    <span className={`text-sm ${isSaving ? 'text-yellow-400' : 'text-green-400'}`}>
                        {isSaving ? 'Salvando...' : 'Salvo'}
                    </span>
                    <Button variant="secondary" onClick={() => setCurrentPage('automations')}>Voltar</Button>
                </div>
            </header>
            <div className="flex-grow flex">
                <main className="flex-grow h-full relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        onNodeClick={onNodeClick}
                        fitView
                        className="bg-slate-900"
                    >
                        <Background color="#475569" gap={16} />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                </main>
                <Sidebar onAddNode={addNode} />
            </div>
             <NodeSettingsModal 
                node={selectedNode}
                isOpen={isSettingsModalOpen}
                onClose={handleCloseModal}
                nodes={nodes}
                templates={templates}
                profile={profile}
                onUpdateNodes={handleUpdateNodes}
             />
        </div>
    );
};

const AutomationEditor: React.FC = () => {
    return (
        <ReactFlowProvider>
            <Editor />
        </ReactFlowProvider>
    );
};

export default AutomationEditor;
