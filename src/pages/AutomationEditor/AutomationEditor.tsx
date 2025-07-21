
import React, { useContext, useState, useEffect, useCallback, memo, FC, useMemo, useRef, createContext } from 'react';
import { ReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge, Background, Controls, Handle, Position, type Node, type Edge, type Connection, type NodeProps, useReactFlow, NodeTypes, EdgeLabelRenderer, getBezierPath, type EdgeProps as XyEdgeProps, MarkerType, BackgroundVariant } from '@xyflow/react';
import { AppContext } from '../../contexts/AppContext';
import { Automation, AutomationNode, AutomationNodeData, AutomationNodeStats, AutomationNodeLog, TriggerType, ActionType, LogicType, AutomationStatus } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { supabase } from '../../lib/supabaseClient';
import { nodeConfigs } from '../../lib/automation/nodeConfigs';
import { Json } from '../../types/database.types';
import NodeSettingsModal from './NodeSettingsModal';
import NodeStats from './NodeStats';
import NodeLogsModal from './NodeLogsModal';
import { nodeIcons } from '../../lib/automation/nodeIcons';
import Switch from '../../components/common/Switch';
import { ALERT_TRIANGLE_ICON, ARROW_LEFT_ICON } from '../../components/icons';


const initialNodes: AutomationNode[] = [];
const initialEdges: Edge[] = [];

// Create a context to pass callbacks down to custom nodes without prop drilling
// or unstable instance mutations.
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
    base: "bg-slate-800 border-t-4 rounded-xl shadow-2xl text-white w-72 group cursor-pointer",
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

const CustomNode: FC<NodeProps<AutomationNode>> = memo(({ data, id, isConnectable }) => {
    const { onNodeLogsClick } = useContext(EditorContext)!;
    const { automationStats } = useContext(AppContext);
    const { nodeType, type, label, config } = data;
    const Icon = nodeIcons[type] || nodeIcons.default;
    const nodeConfig = nodeConfigs[type];
    const isConfigured = nodeConfig ? nodeConfig.isConfigured(data) : true;
    const description = nodeConfig ? nodeConfig.description(data) : '';

    const handleViewLogs = () => {
        onNodeLogsClick(id, label);
    };

    return (
        <div className={`${nodeStyles.base} ${nodeStyles[nodeType]}`}>
            <div className={nodeStyles.body}>
                <div className={nodeStyles.header}>
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
                <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-slate-500" />
            )}
            {type === 'condition' ? (
                <>
                    <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} isConnectable={isConnectable} className="!bg-green-500">
                         <div className="absolute -bottom-5 text-xs text-green-400">Sim</div>
                    </Handle>
                    <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} isConnectable={isConnectable} className="!bg-red-500">
                         <div className="absolute -bottom-5 text-xs text-red-400">Não</div>
                    </Handle>
                </>
            ) : type === 'split_path' ? (
                 <>
                    <Handle type="source" position={Position.Bottom} id="a" style={{ left: '30%' }} isConnectable={isConnectable} className="!bg-sky-500">
                        <div className="absolute -bottom-5 text-xs text-sky-400">A</div>
                    </Handle>
                    <Handle type="source" position={Position.Bottom} id="b" style={{ left: '70%' }} isConnectable={isConnectable} className="!bg-pink-500">
                        <div className="absolute -bottom-5 text-xs text-pink-400">B</div>
                    </Handle>
                </>
            ) : (
                <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-slate-500" />
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

const NodeList: FC<{ title: string; items: [string, any][]; onAddNode: (type: string) => void; disabled?: boolean }> = ({ title, items, onAddNode, disabled = false }) => (
    <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
        <div className="space-y-1">
            {items.map(([type, config]) => (
                <button
                    key={type}
                    onClick={() => onAddNode(type)}
                    className="w-full text-left flex items-center gap-2 p-2 rounded-md text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

const EditorSidebar: FC<{ onAddNode: (type: string) => void; hasTrigger: boolean; }> = ({ onAddNode, hasTrigger }) => {
    const triggers = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'trigger');
    const actions = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'action');
    const logic = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'logic');

    return (
        <Card className="absolute left-4 top-4 z-10 w-64 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="space-y-4">
                <NodeList title="Gatilhos" items={triggers} onAddNode={onAddNode} disabled={hasTrigger} />
                <NodeList title="Ações" items={actions} onAddNode={onAddNode} />
                <NodeList title="Lógica" items={logic} onAddNode={onAddNode} />
            </div>
        </Card>
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
    const { pageParams, automations, templates, profile, updateAutomation, fetchAutomationStats, fetchNodeLogs, setCurrentPage } = useContext(AppContext);
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
        } catch (error: any) {
            alert(`Falha ao salvar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    }, [automation, nodes, edges, updateAutomation]);
    
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
    
    const onAddNode = useCallback((type: string) => {
        const config = nodeConfigs[type];
        if (!config || !reactFlowWrapper.current) return;
        
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = screenToFlowPosition({
            x: reactFlowBounds.left + (reactFlowBounds.width / 2.5),
            y: reactFlowBounds.top + (reactFlowBounds.height / 3),
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
    // This effect loads the automation from context, but ONLY when the ID changes.
    // This prevents remote updates from overwriting local, unsaved changes (like node deletion).
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
        }
    }, [pageParams.automationId, automations, setNodes, setEdges, fetchAutomationStats]);

    // This effect handles the real-time subscription for webhook data capture.
    useEffect(() => {
        if (!automation) return;

        const channel = supabase.channel(`automation-editor-${automation.id}`);
        channel.on('broadcast', { event: 'webhook_captured' }, ({ payload }) => {
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
        return () => { supabase.removeChannel(channel); };
    }, [automation, setNodes]);
    
    // --- Memos for derived state & validation ---
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

    // --- Early return for loading state ---
    if (!automation) {
        return <div className="flex items-center justify-center h-full w-full text-center text-white">Carregando automação...</div>;
    }

    // --- Render ---
    return (
        <EditorContext.Provider value={contextValue}>
            <div className="w-full h-full bg-slate-900" ref={reactFlowWrapper}>
                <EditorSidebar onAddNode={onAddNode} hasTrigger={hasTriggerNode} />

                <div className="absolute top-4 right-4 z-10 flex items-center gap-4">
                    <input 
                    type="text" 
                    value={automation.name} 
                    onChange={(e) => setAutomation({ ...automation, name: e.target.value })} 
                    className="bg-slate-800/80 border border-slate-700 rounded-md p-2 text-white font-semibold"
                    />
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
                    className="bg-slate-900"
                    deleteKeyCode={['Backspace', 'Delete']}
                >
                    <Controls showInteractive={false} />
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#475569" />
                </ReactFlow>

                <NodeSettingsModal 
                    isOpen={isSettingsModalOpen}
                    onClose={() => {
                        setIsSettingsModalOpen(false);
                        setSelectedNodeId(null);
                    }}
                    node={selectedNode}
                    nodes={nodes}
                    templates={templates}
                    profile={profile}
                    onUpdateNodes={onUpdateNodes}
                    automationId={automation.id}
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
