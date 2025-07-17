


import React, { useContext, useState, useEffect, useCallback, memo, FC, useMemo, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, type Node, type Edge, type Connection, type NodeProps, useReactFlow, NodeTypes, EdgeLabelRenderer, getBezierPath, type EdgeProps as XyEdgeProps, MarkerType, BackgroundVariant } from '@xyflow/react';
import { AppContext } from '../../contexts/AppContext';
import { Automation, AutomationNode, NodeData, AutomationNodeStats, AutomationNodeLog, TriggerType, ActionType, LogicType } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { supabase } from '../../lib/supabaseClient';
import { nodeConfigs } from '../../lib/automation/nodeConfigs';
import { Json } from '../../types/database.types';
import NodeSettingsModal from './NodeSettingsModal';
import NodeStats from './NodeStats';
import NodeLogsModal from './NodeLogsModal';
import { nodeIcons } from '../../lib/automation/nodeIcons';


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
// NEW Unified Custom Node Component
// ====================================================================================

const nodeStyles = {
    base: "bg-slate-800 border-t-4 rounded-xl shadow-2xl text-white w-72 group",
    body: "p-4 space-y-2",
    header: "flex items-center gap-3",
    iconContainer: "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg",
    trigger: "border-sky-500",
    action: "border-pink-500",
    logic: "border-purple-500",
    triggerIconBg: "bg-sky-500/20",
    actionIconBg: "bg-pink-500/20",
    logicIconBg: "bg-purple-500/20",
    label: "text-base font-semibold text-slate-100",
    description: "text-xs text-slate-400 min-h-[16px]", // min-h to prevent layout shift
};

const CustomNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
    const { setNodes, setEdges } = useReactFlow();
    const { automationStats, pageParams, fetchNodeLogs } = useContext(AppContext);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [logs, setLogs] = useState<AutomationNodeLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const stats = automationStats[id];
    const nodeConfig = nodeConfigs[data.type];
    const description = nodeConfig?.description ? nodeConfig.description(data) : 'Clique para configurar.';

    const nodeTypeStyle = data.nodeType;
    const borderStyle = `${nodeStyles.base} ${nodeStyles[nodeTypeStyle]}`;
    const iconBgStyle = nodeStyles[`${nodeTypeStyle}IconBg` as keyof typeof nodeStyles];
    const IconComponent = nodeIcons[data.type] || nodeIcons.default;
    
    const handleViewLogs = async () => {
        setIsLoadingLogs(true);
        setIsLogsModalOpen(true);
        if(pageParams.automationId){
            const fetchedLogs = await fetchNodeLogs(pageParams.automationId, id);
            setLogs(fetchedLogs);
        }
        setIsLoadingLogs(false);
    };

    const handleDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
        setNodes((nds) => nds.filter((node) => node.id !== id));
    };
    
    const isLogicNode = data.nodeType === 'logic';

    return (
        <div className={borderStyle}>
             {selected && (
                <button 
                    onClick={handleDelete} 
                    className="absolute top-[-10px] right-[-10px] bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Deletar Nó"
                >
                    &times;
                </button>
            )}

            {isLogicNode ? (
                 <Handle type="target" position={Position.Top} className="!bg-slate-500" />
            ) : (
                <Handle type="target" position={Position.Left} className="!bg-slate-500" isConnectable={data.nodeType !== 'trigger'} />
            )}
           
            <div className={nodeStyles.body}>
                <div className={nodeStyles.header}>
                    <div className={`${nodeStyles.iconContainer} ${iconBgStyle}`}>
                        <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                         <h3 className={nodeStyles.label}>{data.label}</h3>
                    </div>
                </div>
                <p className={nodeStyles.description}>{description}</p>
                <NodeStats stats={stats} onViewLogs={handleViewLogs}/>
            </div>

            {data.type === 'condition' ? (
                <div className="flex justify-between relative px-5 py-2 bg-slate-900/30 rounded-b-xl">
                    <div className="text-center">
                        <Handle type="source" position={Position.Bottom} id="yes" className="!bg-green-500 !bottom-[-5px]" />
                        <span className="text-xs font-semibold text-green-400">SIM</span>
                    </div>
                    <div className="text-center">
                        <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !bottom-[-5px]" />
                        <span className="text-xs font-semibold text-red-400">NÃO</span>
                    </div>
                </div>
            ) : data.type === 'split_path' ? (
                <div className="flex justify-between relative px-5 py-2 bg-slate-900/30 rounded-b-xl">
                    <div className="text-center">
                        <Handle type="source" position={Position.Bottom} id="a" className="!bg-cyan-500 !bottom-[-5px]" />
                        <span className="text-xs font-semibold text-cyan-400">Via A</span>
                    </div>
                    <div className="text-center">
                        <Handle type="source" position={Position.Bottom} id="b" className="!bg-indigo-500 !bottom-[-5px]" />
                        <span className="text-xs font-semibold text-indigo-400">Via B</span>
                    </div>
                </div>
            ) : (
                 <Handle type="source" position={Position.Right} className="!bg-slate-500" />
            )}
            
            <NodeLogsModal isOpen={isLogsModalOpen} onClose={() => setIsLogsModalOpen(false)} nodeLabel={data.label} logs={logs} isLoading={isLoadingLogs} />
        </div>
    );
});


// ====================================================================================
// Editor Sidebar
// ====================================================================================
const Sidebar = memo(({ onAddNode, nodes }: { onAddNode: (type: string) => void; nodes: Node<NodeData>[] }) => {
    const nodeGroups = {
        Triggers: Object.entries(nodeConfigs).filter(([, c]) => c.nodeType === 'trigger'),
        Actions: Object.entries(nodeConfigs).filter(([, c]) => c.nodeType === 'action'),
        Logic: Object.entries(nodeConfigs).filter(([, c]) => c.nodeType === 'logic'),
    };

    const hasTrigger = useMemo(() => nodes.some(n => n.data.nodeType === 'trigger'), [nodes]);
    
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
                                className="p-3 text-left bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={groupName === 'Triggers' && hasTrigger}
                                title={groupName === 'Triggers' && hasTrigger ? 'A automação já possui um gatilho. Exclua o atual para adicionar um novo.' : ''}
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
    const { automations, updateAutomation, pageParams, setCurrentPage, templates, profile, fetchAutomationStats, setAutomationStats } = useContext(AppContext);
    
    const [automation, setAutomation] = useState<Automation | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSaving, setIsSaving] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);

    const { screenToFlowPosition } = useReactFlow();
    const saveTimeoutRef = useRef<number | undefined>();
    const hasFetchedStats = useRef(false);
    const isMounted = useRef(false);

    useEffect(() => {
        const currentAutomation = automations.find(a => a.id === pageParams.automationId);
        if (currentAutomation) {
            setAutomation(currentAutomation);
            if (!hasFetchedStats.current && pageParams.automationId) {
                fetchAutomationStats(pageParams.automationId);
                hasFetchedStats.current = true;
            }
        } else if (pageParams.automationId) {
            console.error(`Automação com ID ${pageParams.automationId} não encontrada.`);
        }

        if(!pageParams.automationId) return;

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
            setTimeout(() => { isMounted.current = true; }, 100);
        }
    }, [automation, setNodes, setEdges]);
    
    const saveChanges = useCallback((dataToSave: Automation) => {
        setIsSaving(true);
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = window.setTimeout(async () => {
            await updateAutomation(dataToSave);
            setIsSaving(false);
        }, 1000);
    }, [updateAutomation]);

    useEffect(() => {
        if (!isMounted.current || !automation) return;
        saveChanges({ ...automation, nodes: nodes as AutomationNode[], edges });
    }, [nodes, edges, automation, saveChanges]);


    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!automation) return;
        const newAutomation = { ...automation, name: e.target.value };
        setAutomation(newAutomation);
    };
    
    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const addNode = (type: string) => {
        if (!automation) return;
        const { label, nodeType, data: nodeData } = nodeConfigs[type];
        const position = screenToFlowPosition({ x: window.innerWidth / 2 - 200, y: 150 });

        const newNode: Node<NodeData> = {
            id: `${type}_${Date.now()}`,
            type: 'custom', // Use a single custom type
            position,
            data: {
                nodeType: nodeType,
                type: type as TriggerType | ActionType | LogicType,
                label: label,
                config: nodeData.config || {},
            },
        };
        
        setNodes((nds) => nds.concat(newNode));
    };

    const handleUpdateNodesFromModal = useCallback(async (updatedNodes: Node<NodeData>[], options?: { immediate?: boolean }) => {
        setNodes(updatedNodes);
        if (options?.immediate && automation) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            setIsSaving(true);
            await updateAutomation({ ...automation, nodes: updatedNodes as AutomationNode[], edges });
            setIsSaving(false);
        }
    }, [setNodes, automation, edges, updateAutomation]);


    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node as Node<NodeData>);
        setIsSettingsModalOpen(true);
    }, []);

    const handleCloseModal = () => {
        setIsSettingsModalOpen(false);
        setSelectedNode(null);
    };
    
    const nodeTypes: NodeTypes = React.useMemo(() => ({
        custom: CustomNode,
    }), []);

    const edgeTypes = React.useMemo(() => ({
        deletable: CustomDeletableEdge,
    }), []);
    
    const currentNodeForModal = useMemo(() => {
        return nodes.find(n => n.id === selectedNode?.id) || null;
    }, [nodes, selectedNode]);
    
    if (!automation) {
        return <div className="text-center text-white">Carregando automação...</div>;
    }

    const defaultEdgeOptions = {
      style: { strokeWidth: 2, stroke: '#0ea5e9' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
      type: 'deletable',
    };

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
                        defaultEdgeOptions={defaultEdgeOptions}
                    >
                        <Background variant={BackgroundVariant.Dots} color="#334155" gap={24} size={1} style={{ background: 'radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 50%)' }} />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                </main>
                <Sidebar onAddNode={addNode} nodes={nodes} />
            </div>
             <NodeSettingsModal 
                node={currentNodeForModal}
                isOpen={isSettingsModalOpen}
                onClose={handleCloseModal}
                nodes={nodes}
                templates={templates}
                profile={profile}
                onUpdateNodes={handleUpdateNodesFromModal}
                automationId={automation?.id}
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