import React, { useContext, useState, useEffect, useCallback, memo, FC, useMemo, useRef, createContext } from 'react';
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, type Node, type Edge, type Connection, type NodeProps, useReactFlow, NodeTypes, EdgeLabelRenderer, getBezierPath, type EdgeProps as XyEdgeProps, MarkerType, BackgroundVariant } from '@xyflow/react';
import { Automation, AutomationNode, AutomationNodeData, AutomationNodeStats, AutomationNodeLog, TriggerType, ActionType, LogicType, AutomationStatus } from '../../types';
import Button from '../../components/common/Button';
import { supabase } from '../../lib/supabaseClient';
import { nodeConfigs } from '../../lib/automation/nodeConfigs';
import NodeSettingsModal from './NodeSettingsModal';
import NodeStats from './NodeStats';
import NodeLogsModal from './NodeLogsModal';
import { nodeIcons } from '../../lib/automation/nodeIcons';
import Switch from '../../components/common/Switch';
import { ALERT_TRIANGLE_ICON, ARROW_LEFT_ICON, TRASH_ICON } from '../../components/icons';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

const initialNodes: AutomationNode[] = [];
const initialEdges: Edge[] = [];

const EditorContext = createContext<{
    onNodeLogsClick: (nodeId: string, nodeLabel: string) => void;
} | null>(null);


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
            className="w-5 h-5 bg-slate-200 dark:bg-slate-700 hover:bg-red-500 text-slate-800 dark:text-white flex items-center justify-center rounded-full text-xs font-mono transition-colors duration-150 opacity-0 group-hover:opacity-100"
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
    base: "relative bg-white dark:bg-slate-800 border-t-4 rounded-xl shadow-xl dark:shadow-2xl text-slate-900 dark:text-white w-72 group cursor-pointer",
    body: "p-4 space-y-2",
    header: "flex items-center gap-3",
    iconContainer: "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg",
    trigger: "border-slate-500 dark:border-sky-500",
    action: "border-pink-500",
    logic: "border-purple-500",
    triggerIconBg: "bg-slate-100 dark:bg-sky-500/20",
    actionIconBg: "bg-pink-100 dark:bg-pink-500/20",
    logicIconBg: "bg-purple-100 dark:bg-purple-500/20",
    label: "text-base font-semibold text-slate-800 dark:text-slate-100",
    description: "text-xs text-slate-500 dark:text-slate-400 min-h-[16px]",
};

const CustomNode: FC<NodeProps<AutomationNode>> = memo(({ data, id, isConnectable }) => {
    const { onNodeLogsClick } = useContext(EditorContext)!;
    const { automationStats } = useAuthStore();
    const { setNodes } = useReactFlow();
    const { nodeType, type, label } = data;
    const Icon = nodeIcons[type] || nodeIcons.default;
    const nodeConfig = nodeConfigs[type];
    const isConfigured = nodeConfig ? nodeConfig.isConfigured(data) : true;
    const description = nodeConfig ? nodeConfig.description(data) : '';

    const handleViewLogs = () => {
        onNodeLogsClick(id, label);
    };
    
    const handleDeleteNode = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nds) => nds.filter((node) => node.id !== id));
    };


    return (
        <div className={`${nodeStyles.base} ${nodeStyles[nodeType]}`}>
             <button
                onClick={handleDeleteNode}
                className="absolute top-2 right-2 p-1 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Deletar nó"
            >
                <TRASH_ICON className="w-4 h-4" />
            </button>
            <div className={nodeStyles.body}>
                <div className="relative flex items-center gap-3">
                    <div className={`${nodeStyles.iconContainer} ${nodeStyles[`${nodeType}IconBg`]}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className={nodeStyles.label}>{label}</span>
                     {!isConfigured && (
                        <span title="Nó não configurado" className="absolute -top-2 -right-2 flex h-5 w-5">
                           <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500 items-center justify-center">
                                <ALERT_TRIANGLE_ICON className="h-3 w-3 text-white"/>
                           </span>
                        </span>
                    )}
                </div>
                <p className={nodeStyles.description}>{description}</p>
                 <NodeStats stats={automationStats[id]} onViewLogs={handleViewLogs} />
            </div>
            
            {/* Handles */}
            {nodeType !== 'trigger' && (
                <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-slate-400 dark:!bg-slate-500" />
            )}
            {type === 'condition' ? (
                <>
                    <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} isConnectable={isConnectable} className="!bg-green-500">
                         <div className="absolute -bottom-5 text-xs text-green-500 dark:text-green-400">Sim</div>
                    </Handle>
                    <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} isConnectable={isConnectable} className="!bg-red-500">
                         <div className="absolute -bottom-5 text-xs text-red-500 dark:text-red-400">Não</div>
                    </Handle>
                </>
            ) : type === 'split_path' ? (
                 <>
                    <Handle type="source" position={Position.Bottom} id="a" style={{ left: '30%' }} isConnectable={isConnectable} className="!bg-sky-500">
                        <div className="absolute -bottom-5 text-xs text-slate-600 dark:text-sky-400">A</div>
                    </Handle>
                    <Handle type="source" position={Position.Bottom} id="b" style={{ left: '70%' }} isConnectable={isConnectable} className="!bg-pink-500">
                        <div className="absolute -bottom-5 text-xs text-slate-600 dark:text-pink-400">B</div>
                    </Handle>
                </>
            ) : (
                <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-slate-400 dark:!bg-slate-500" />
            )}
        </div>
    );
});


const nodeTypes: NodeTypes = {
    triggerNode: CustomNode,
    actionNode: CustomNode,
    logicNode: CustomNode,
};

const edgeTypes = {
    deletable: CustomDeletableEdge,
};

const NodeList: FC<{ title: string; items: [string, any][]; onAddNode: (type: string, e: React.MouseEvent) => void; disabled?: boolean }> = ({ title, items, onAddNode, disabled = false }) => (
    <div>
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-2">{title}</h3>
        <div className="space-y-1">
            {items.map(([type, config]) => (
                <button
                    key={type}
                    onMouseDown={(e) => onAddNode(type, e)}
                    className="w-full text-left flex items-center gap-2 p-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={disabled}
                    title={disabled ? "A automação já possui um gatilho. Remova o existente para adicionar um novo." : ""}
                >
                    <IconForType type={type} nodeType={config.nodeType} />
                    <span className="text-sm">{config.label}</span>
                </button>
            ))}
        </div>
    </div>
);

const EditorSidebar: FC<{ onAddNode: (type: string, e: React.MouseEvent) => void; hasTrigger: boolean; }> = ({ onAddNode, hasTrigger }) => {
    const triggers = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'trigger');
    const actions = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'action');
    const logic = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'logic');

    return (
        <aside className="w-72 flex-shrink-0 bg-white/50 dark:bg-slate-800/50 p-4 flex flex-col border-r border-slate-200 dark:border-slate-700/50 overflow-y-auto">
            <div className="space-y-6">
                <NodeList title="Gatilhos" items={triggers} onAddNode={onAddNode} disabled={hasTrigger} />
                <NodeList title="Ações" items={actions} onAddNode={onAddNode} />
                <NodeList title="Lógica" items={logic} onAddNode={onAddNode} />
            </div>
            <div className="mt-auto pt-4 text-center text-xs text-slate-500">
                © 2024 ZapFlow AI
            </div>
        </aside>
    );
};

const IconForType: FC<{ type: string, nodeType: string}> = ({ type, nodeType }) => {
    const Icon = nodeIcons[type] || nodeIcons.default;
    return (
        <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md ${nodeStyles[`${nodeType}IconBg`]}`}>
            <Icon className="w-4 h-4" />
        </div>
    );
};

// Main Component
const AutomationEditor: FC = () => {
    // --- Hooks ---
    const { 
        automations, 
        updateAutomation, 
        fetchAutomationStats, 
        fetchNodeLogs, 
        templates, 
        allTags, 
        profile, 
        pageParams, 
        setCurrentPage,
        pipelines,
        stages
    } = useAuthStore();
    const addToast = useUiStore(state => state.addToast);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    
    const [automation, setAutomation] = useState<Automation | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // --- State for Modals ---
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [logModalData, setLogModalData] = useState<{label: string, logs: AutomationNodeLog[]}>({label: '', logs: []});
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    const loadedAutomationId = useRef<string | null>(null);
    
    // --- Handlers ---
    const handleSave = useCallback(async (updatedNodes = nodes, updatedEdges = edges) => {
        if (!automation) return;
        setIsSaving(true);
        const automationToSave: Automation = {
            ...automation,
            nodes: updatedNodes.map(n => {
                const { selected, dragging, positionAbsolute, ...rest } = n as any;
                return rest;
            }),
            edges: updatedEdges,
        };
        try {
            await updateAutomation(automationToSave);
            addToast('Automação salva com sucesso!', 'success');
        } catch (error: any) {
            addToast(`Falha ao salvar: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [automation, nodes, edges, updateAutomation, addToast]);
    
    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'deletable', markerEnd: { type: MarkerType.ArrowClosed } }, eds)), [setEdges]);

    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        setIsSettingsModalOpen(true);
    }, []);
    
    const handleNodeLogsClick = useCallback(async (nodeId: string, nodeLabel: string) => {
        if (!automation) return;
        setIsLogsModalOpen(true);
        setIsLogsLoading(true);
        setLogModalData({ label: nodeLabel, logs: [] });
        try {
            const logs = await fetchNodeLogs(automation.id, nodeId);
            setLogModalData({ label: nodeLabel, logs });
        } finally {
            setIsLogsLoading(false);
        }
    }, [automation, fetchNodeLogs]);
    
    const contextValue = useMemo(() => ({ onNodeLogsClick: handleNodeLogsClick }), [handleNodeLogsClick]);

    const onUpdateNodes = useCallback(async (updatedNodes: AutomationNode[], options?: { immediate?: boolean }) => {
        setNodes(updatedNodes);
        if(options?.immediate) {
            await handleSave(updatedNodes, edges);
        }
    }, [setNodes, edges, handleSave]);
    
    const onAddNode = useCallback((type: string, event: React.MouseEvent) => {
        const config = nodeConfigs[type];
        if (!config || !reactFlowWrapper.current) return;
        
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const newNode: AutomationNode = {
            id: `${type}-${Date.now()}`,
            type: `${config.nodeType}Node`,
            position,
            data: { ...config.data, label: config.label } as AutomationNodeData,
        };
        setNodes((nds) => nds.concat(newNode));
    }, [screenToFlowPosition, setNodes]);

    // --- Effects ---
    useEffect(() => {
        const currentAutomation = automations.find(a => a.id === pageParams.automationId);
        if (currentAutomation) {
            if (loadedAutomationId.current !== pageParams.automationId) {
                setAutomation(currentAutomation);
                setNodes(currentAutomation.nodes || []);
                setEdges(currentAutomation.edges || []);
                fetchAutomationStats(currentAutomation.id);
                loadedAutomationId.current = pageParams.automationId;
            }
        } else {
             const foundAutomation = automations.find(a => a.id === loadedAutomationId.current)
             if(foundAutomation) setAutomation(foundAutomation)
        }
    }, [pageParams.automationId, automations, setNodes, setEdges, fetchAutomationStats]);

    useEffect(() => {
        if (!automation) return;

        // Channel for webhook data capture
        const webhookChannel = supabase.channel(`automation-editor-${automation.id}`);
        webhookChannel.on('broadcast', { event: 'webhook_captured' }, ({ payload }) => {
            if (payload.nodeId) {
                setNodes(nds => nds.map(n => {
                    if (n.id === payload.nodeId) {
                        const oldConfig = n.data.config && typeof n.data.config === 'object' ? n.data.config : {};
                        return { ...n, data: { ...n.data, config: { ...oldConfig, last_captured_data: payload.data, is_listening: false }}};
                    }
                    return n;
                }));
            }
        }).subscribe();

        // Channel for real-time stat updates
        const statsChannel = supabase.channel(`automation-stats-${automation.id}`);
        statsChannel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'automation_node_stats',
                filter: `automation_id=eq.${automation.id}`,
            },
            () => {
                // Refetch all stats for this automation to update the UI
                fetchAutomationStats(automation.id);
            }
        ).subscribe();

        return () => {
            supabase.removeChannel(webhookChannel);
            supabase.removeChannel(statsChannel);
        };
    }, [automation, setNodes, fetchAutomationStats]);
    
    const selectedNode = useMemo(() => {
        if (!selectedNodeId) return null;
        return nodes.find(n => n.id === selectedNodeId) as AutomationNode || null;
    }, [nodes, selectedNodeId]);

    const hasTriggerNode = useMemo(() => nodes.some(n => n.data.nodeType === 'trigger'), [nodes]);

    const validationState = useMemo(() => {
        if (!hasTriggerNode) {
            return { isValid: false, reason: 'A automação precisa de um nó de gatilho para ser ativada.' };
        }
        const unconfiguredNode = nodes.find(n => {
            const config = nodeConfigs[n.data.type];
            return config && !config.isConfigured(n.data);
        });
        if (unconfiguredNode) {
            return { isValid: false, reason: `O nó "${unconfiguredNode.data.label}" não está configurado corretamente.` };
        }
        return { isValid: true, reason: '' };
    }, [nodes, hasTriggerNode]);

    if (!automation) {
        return <div className="flex items-center justify-center h-full w-full text-center text-white">Carregando automação...</div>;
    }

    return (
        <EditorContext.Provider value={contextValue}>
            <div className="w-full h-full flex bg-slate-100 dark:bg-slate-900 overflow-hidden">
                <EditorSidebar onAddNode={onAddNode} hasTrigger={hasTriggerNode} />

                <div className="flex-1 flex flex-col">
                    <header className="flex-shrink-0 flex items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
                        <input 
                            type="text" 
                            value={automation.name} 
                            onChange={(e) => setAutomation({ ...automation, name: e.target.value })} 
                            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 text-slate-900 dark:text-white font-semibold"
                        />
                        <div className="flex items-center gap-4">
                            <div title={!validationState.isValid ? validationState.reason : (automation.status === 'active' ? 'Desativar Automação' : 'Ativar Automação')}>
                                <Switch 
                                    checked={automation.status === 'active'} 
                                    onChange={(checked) => setAutomation({ ...automation, status: checked ? 'active' : 'paused' })} 
                                    disabled={!validationState.isValid}
                                />
                            </div>
                            <Button variant="secondary" onClick={() => setCurrentPage('automations')}><ARROW_LEFT_ICON className="w-4 h-4 mr-2"/> Voltar</Button>
                            <Button onClick={() => handleSave()} isLoading={isSaving}>Salvar Automação</Button>
                        </div>
                    </header>

                    <main className="flex-1" ref={reactFlowWrapper}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={handleNodeClick}
                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}
                            fitView
                            className="automation-editor"
                            deleteKeyCode={['Backspace', 'Delete']}
                        >
                            <Controls showInteractive={false} />
                            <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="bg-slate-100 dark:bg-slate-900" />
                        </ReactFlow>
                    </main>
                </div>

                <NodeSettingsModal 
                    isOpen={isSettingsModalOpen}
                    onClose={() => {
                        setIsSettingsModalOpen(false);
                        setSelectedNodeId(null);
                    }}
                    node={selectedNode}
                    nodes={nodes}
                    onUpdateNodes={onUpdateNodes}
                    automationId={automation.id}
                    templates={templates}
                    allTags={allTags}
                    profile={profile}
                    pipelines={pipelines}
                    stages={stages}
                />
                <NodeLogsModal
                    isOpen={isLogsModalOpen}
                    onClose={() => setIsLogsModalOpen(false)}
                    nodeLabel={logModalData.label}
                    logs={logModalData.logs}
                    isLoading={isLogsLoading}
                />
            </div>
        </EditorContext.Provider>
    );
};

const AutomationEditorPage: FC = () => {
    return (
        <ReactFlowProvider>
            <AutomationEditor />
        </ReactFlowProvider>
    );
};

export default memo(AutomationEditorPage);