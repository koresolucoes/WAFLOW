





import React, { useContext, useState, useEffect, useCallback, memo, FC, useMemo, useRef } from 'react';
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

const CustomNode: FC<NodeProps<AutomationNode>> = memo(({ data, id, isConnectable }) => {
    const { onNodeClick, onNodeLogsClick } = useReactFlow() as any; // Using any to avoid creating a new type for this
    const { automationStats } = useContext(AppContext);
    const { nodeType, type, label, config } = data;
    const Icon = nodeIcons[type] || nodeIcons.default;
    const nodeConfig = nodeConfigs[type];
    const isConfigured = nodeConfig ? nodeConfig.isConfigured(data) : true;
    const description = nodeConfig ? nodeConfig.description(data) : '';

    const handleNodeClick = () => {
        onNodeClick(id);
    };

    const handleViewLogs = () => {
        onNodeLogsClick(id, label);
    };

    return (
        <div className={`${nodeStyles.base} ${nodeStyles[nodeType]}`} onClick={handleNodeClick}>
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


const EditorSidebar: FC<{ onAddNode: (type: string) => void }> = ({ onAddNode }) => {
    const triggers = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'trigger');
    const actions = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'action');
    const logic = Object.entries(nodeConfigs).filter(([_, v]) => v.nodeType === 'logic');

    return (
        <Card className="absolute left-4 top-4 z-10 w-64 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="space-y-4">
                <NodeList title="Gatilhos" items={triggers} onAddNode={onAddNode} />
                <NodeList title="Ações" items={actions} onAddNode={onAddNode} />
                <NodeList title="Lógica" items={logic} onAddNode={onAddNode} />
            </div>
        </Card>
    );
};

const NodeList: FC<{ title: string, items: [string, any][], onAddNode: (type: string) => void }> = ({ title, items, onAddNode }) => (
    <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
        <div className="space-y-1">
            {items.map(([type, config]) => (
                <button
                    key={type}
                    onClick={() => onAddNode(type)}
                    className="w-full text-left flex items-center gap-2 p-2 rounded-md text-slate-300 hover:bg-slate-700 transition-colors"
                >
                    <IconForType type={type} nodeType={config.nodeType} />
                    <span className="text-sm">{config.label}</span>
                </button>
            ))}
        </div>
    </div>
);

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
    const { pageParams, automations, templates, profile, updateAutomation, fetchAutomationStats, fetchNodeLogs, setAutomationStats, setCurrentPage } = useContext(AppContext);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition, fitView } = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    
    const [automation, setAutomation] = useState<Automation | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<AutomationNode | null>(null);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [selectedNodeLogs, setSelectedNodeLogs] = useState<AutomationNodeLog[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);

    useEffect(() => {
        const currentAutomation = automations.find(a => a.id === pageParams.automationId);
        setAutomation(currentAutomation || null);
        if (currentAutomation) {
            setNodes(currentAutomation.nodes || []);
            setEdges(currentAutomation.edges || []);
            fetchAutomationStats(currentAutomation.id);

            const channel = supabase.channel(`automation-editor-${currentAutomation.id}`);
            channel.on('broadcast', { event: 'webhook_captured' }, ({ payload }) => {
                console.log('Webhook data captured!', payload);
                if (payload.nodeId) {
                    setNodes(nds => nds.map(n => {
                        if (n.id === payload.nodeId) {
                            return { ...n, data: { ...n.data, config: { ...n.data.config, last_captured_data: payload.data, is_listening: false }}};
                        }
                        return n;
                    }));
                }
            }).subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [pageParams.automationId, automations, setNodes, setEdges, fetchAutomationStats]);

    const handleSave = async (updatedNodes = nodes, updatedEdges = edges) => {
        if (!automation) return;
        setIsSaving(true);
        const automationToSave: Automation = {
            ...automation,
            nodes: updatedNodes.map(({ ...n }) => { delete n.selected; delete n.dragging; delete n.positionAbsolute; return n; }),
            edges: updatedEdges,
        };
        try {
            await updateAutomation(automationToSave);
        } catch (error: any) {
            alert(`Falha ao salvar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'deletable', markerEnd: { type: MarkerType.ArrowClosed } }, eds)), [setEdges]);

    const onAddNode = useCallback((type: string) => {
        const config = nodeConfigs[type];
        if (!config || !reactFlowWrapper.current) return;
        
        // Prevent multiple trigger nodes
        if (config.nodeType === 'trigger' && nodes.some(n => n.data.nodeType === 'trigger')) {
            alert("Uma automação pode ter apenas um gatilho.");
            return;
        }

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
    }, [screenToFlowPosition, nodes, setNodes]);

    const handleNodeClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setSelectedNode(node);
            setIsSettingsModalOpen(true);
        }
    };
    
    const handleNodeLogsClick = async (nodeId: string, nodeLabel: string) => {
        if (!automation) return;
        setSelectedNode({ id: nodeId, data: { label: nodeLabel } } as any);
        setIsLogsModalOpen(true);
        setIsLogsLoading(true);
        try {
            const logs = await fetchNodeLogs(automation.id, nodeId);
            setSelectedNodeLogs(logs);
        } finally {
            setIsLogsLoading(false);
        }
    };
    
    const onUpdateNodes = useCallback(async (updatedNodes: AutomationNode[], options?: { immediate?: boolean }) => {
        setNodes(updatedNodes);
        if(options?.immediate) {
            await handleSave(updatedNodes);
        }
    }, [setNodes, handleSave]);


    const handleAutomationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (automation) setAutomation({ ...automation, name: e.target.value });
    };

    const handleAutomationStatusChange = (checked: boolean) => {
        if (automation) setAutomation({ ...automation, status: checked ? 'active' : 'paused' });
    };
    
    if (!automation) {
        return <div className="text-center text-white">Carregando automação...</div>;
    }
    
    (useReactFlow() as any).onNodeClick = handleNodeClick;
    (useReactFlow() as any).onNodeLogsClick = handleNodeLogsClick;


    return (
        <div className="w-full h-full bg-slate-900" ref={reactFlowWrapper}>
            <EditorSidebar onAddNode={onAddNode} />

            <div className="absolute top-4 right-4 z-10 flex items-center gap-4">
                <input type="text" value={automation.name} onChange={handleAutomationNameChange} className="bg-slate-800/80 border border-slate-700 rounded-md p-2 text-white font-semibold"/>
                <Switch checked={automation.status === 'active'} onChange={handleAutomationStatusChange} />
                <Button variant="secondary" onClick={() => setCurrentPage('automations')}><ARROW_LEFT_ICON className="w-4 h-4 mr-2"/> Voltar</Button>
                <Button onClick={() => handleSave()} isLoading={isSaving}>Salvar Automação</Button>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                className="bg-slate-900"
            >
                <Controls showInteractive={false} />
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#475569" />
            </ReactFlow>

             <NodeSettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
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
                nodeLabel={selectedNode?.data.label || ''}
                logs={selectedNodeLogs}
                isLoading={isLogsLoading}
            />
        </div>
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
