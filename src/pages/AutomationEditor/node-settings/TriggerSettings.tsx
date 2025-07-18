
import React, { useState, useEffect, useMemo } from 'react';
import { NodeSettingsProps } from './common';
import { supabase } from '../../../lib/supabaseClient';
import Button from '../../../components/common/Button';
import { AutomationNode } from '../../../types';
import { WEBHOOK_ICON, COPY_ICON } from '../../../components/icons';

// Simple JSON syntax highlighter component
const JsonViewer = ({ data }: { data: any }) => {
    const syntaxHighlight = (json: any) => {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, undefined, 2);
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match: string) => {
            let cls = 'text-green-400'; // number
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'text-sky-400'; // key
                } else {
                    cls = 'text-amber-400'; // string
                }
            } else if (/true|false/.test(match)) {
                cls = 'text-purple-400'; // boolean
            } else if (/null/.test(match)) {
                cls = 'text-slate-500'; // null
            }
            return `<span class="${cls}">${match}</span>`;
        });
    };

    return (
        <pre className="p-3 bg-slate-900/70 rounded-md whitespace-pre-wrap max-h-[calc(80vh-250px)] overflow-y-auto text-slate-300"
             dangerouslySetInnerHTML={{ __html: syntaxHighlight(data) }}
        />
    );
};

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void; }> = ({ label, active, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}>
        {label}
    </button>
);


const TriggerSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, profile, automationId }) => {
    const config = (node.data.config as any) || {};
    const [isListening, setIsListening] = useState(false);
    const [activeTab, setActiveTab] = useState('Parameters');
    const [activeUrlTab, setActiveUrlTab] = useState('Test URL');
    const [activeOutputView, setActiveOutputView] = useState('JSON');
    const [copied, setCopied] = useState(false);
    
    useEffect(() => {
        if (!node || !automationId) return;

        const channel = supabase
            .channel(`automation-node-update-${node.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'automations', filter: `id=eq.${automationId}` },
                (payload) => {
                    const updatedAutomation = payload.new as any;
                    if (!updatedAutomation || !Array.isArray(updatedAutomation.nodes)) return;
                    
                    const updatedNode = (updatedAutomation.nodes as AutomationNode[]).find(n => n.id === node.id);
                    const newConfig = updatedNode?.data?.config as any;

                    if (newConfig && newConfig.last_captured_data) {
                        setIsListening(false);
                        onConfigChange(newConfig);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [node, automationId, onConfigChange]);

    const handleListen = () => {
        setIsListening(true);
        onConfigChange({ ...config, last_captured_data: null }, { immediate: true });
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const webhookPath = useMemo(() => `${profile?.webhook_path_prefix || profile?.id}__${node.id}`, [profile, node.id]);
    const webhookUrl = `${window.location.origin}/api/trigger/${webhookPath}`;

    const hasCapturedData = config.last_captured_data && typeof config.last_captured_data === 'object';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 h-full">
            {/* Left Panel: Configuration */}
            <div className="p-6 border-r border-slate-700/50 flex flex-col space-y-6">
                <div className="flex items-center gap-3">
                     <div className="bg-slate-700/50 p-2 rounded-lg">
                        <WEBHOOK_ICON className="w-6 h-6 text-sky-400" />
                     </div>
                     <h3 className="text-xl font-bold text-white">Webhook</h3>
                </div>
                
                <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                    <TabButton label="Parameters" active={activeTab === 'Parameters'} onClick={() => setActiveTab('Parameters')} />
                    <TabButton label="Settings" active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} />
                    <TabButton label="Docs" active={activeTab === 'Docs'} onClick={() => setActiveTab('Docs')} />
                </div>

                {activeTab === 'Parameters' && (
                    <div className="space-y-4">
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Webhook URLs</h4>
                            <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg">
                                <TabButton label="Test URL" active={activeUrlTab === 'Test URL'} onClick={() => setActiveUrlTab('Test URL')} />
                                <TabButton label="Production URL" active={activeUrlTab === 'Production URL'} onClick={() => setActiveUrlTab('Production URL')} />
                            </div>
                            <div className="mt-2 flex items-center gap-2 bg-slate-700/50 p-2 rounded-md">
                                <span className="flex-shrink-0 text-xs font-bold bg-slate-600 text-white px-2 py-1 rounded">POST</span>
                                <input type="text" readOnly value={webhookUrl} className="w-full bg-transparent text-slate-300 font-mono text-xs" />
                                <button onClick={() => copyToClipboard(webhookUrl)} className="text-slate-400 hover:text-white" title="Copiar URL">
                                    <COPY_ICON className="w-4 h-4"/>
                                </button>
                            </div>
                            {copied && <p className="text-xs text-green-400 mt-1 text-right">Copiado!</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">HTTP Method</label>
                            <input type="text" readOnly value="POST" className="w-full bg-slate-700/50 p-2 rounded-md text-slate-400"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Path</label>
                            <input type="text" readOnly value={webhookPath} className="w-full bg-slate-700/50 p-2 rounded-md text-slate-400 font-mono text-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Authentication</label>
                            <select disabled className="w-full bg-slate-700/50 p-2 rounded-md text-slate-500 disabled:cursor-not-allowed">
                                <option>None</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Respond</label>
                            <select disabled className="w-full bg-slate-700/50 p-2 rounded-md text-slate-500 disabled:cursor-not-allowed">
                                <option>Immediately</option>
                            </select>
                        </div>
                    </div>
                )}
                
                {activeTab === 'Settings' && (
                    <div className="text-slate-400 text-center p-8">
                        <p>Configurações avançadas estarão disponíveis aqui.</p>
                    </div>
                )}

                 {activeTab === 'Docs' && (
                    <div className="text-slate-400 text-sm space-y-2">
                        <p>Para usar este gatilho, envie uma requisição <code className="bg-slate-700 px-1 rounded">POST</code> para a URL de teste ou produção.</p>
                        <p>O corpo (body) da requisição será capturado e disponibilizado como <code className="bg-slate-700 px-1 rounded">{`{{trigger.body}}`}</code> para os próximos nós.</p>
                    </div>
                )}
            </div>

            {/* Right Panel: Output */}
            <div className="p-6 bg-slate-800/20 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Output</h3>
                    <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg">
                        <TabButton label="JSON" active={activeOutputView === 'JSON'} onClick={() => setActiveOutputView('JSON')} />
                        <TabButton label="Table" active={false} onClick={() => {}} />
                        <TabButton label="Schema" active={false} onClick={() => {}} />
                    </div>
                </div>

                <div className="flex-grow">
                    {hasCapturedData ? (
                        <JsonViewer data={config.last_captured_data} />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-700 rounded-lg">
                           <Button variant="secondary" onClick={handleListen} isLoading={isListening}>
                                {isListening ? 'Aguardando Evento...' : 'Ouvir Evento de Teste'}
                            </Button>
                             <p className="text-xs text-slate-400 mt-2">
                               {isListening
                                    ? "Envie uma requisição POST para a URL de Teste para capturar dados."
                                    : "Clique para capturar uma requisição de teste e ver a saída aqui."
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TriggerSettings;
