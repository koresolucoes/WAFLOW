
import React, { useState, useEffect, useMemo } from 'react';
import { NodeSettingsProps } from './common';
import Button from '../../../components/common/Button';
import { COPY_ICON, PLUS_ICON, TRASH_ICON } from '../../../components/icons';
import JsonTreeView from './JsonTreeView';

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void; disabled?: boolean }> = ({ label, active, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed`}>
        {label}
    </button>
);

const TriggerSettings: React.FC<NodeSettingsProps> = ({ node, onConfigChange, profile }) => {
    const config = (node.data.config as any) || {};
    const isListening = config.is_listening || false;
    const [activeTab, setActiveTab] = useState('Parameters');
    const [copied, setCopied] = useState(false);
    const [selectedPath, setSelectedPath] = useState('');

    const hasCapturedData = useMemo(() => config.last_captured_data && typeof config.last_captured_data === 'object', [config.last_captured_data]);
    
    useEffect(() => {
        if (hasCapturedData) {
            setActiveTab('Mapping');
        } else {
            setActiveTab('Parameters');
        }
    }, [hasCapturedData]);


    const handleListen = () => {
        onConfigChange({ ...config, last_captured_data: null, data_mapping: [], is_listening: true }, { immediate: true });
        setActiveTab('Parameters');
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const webhookPath = useMemo(() => `${profile?.webhook_path_prefix || profile?.id}__${node.id}`, [profile, node.id]);
    const webhookUrl = `${window.location.origin}/api/trigger/${webhookPath}`;

    const updateMapping = (updater: (draft: any[]) => any[]) => {
        const currentMapping = config.data_mapping || [];
        const newMapping = updater(JSON.parse(JSON.stringify(currentMapping)));
        onConfigChange({ ...config, data_mapping: newMapping });
    };

    const handleSetMapping = (destination: string, destinationKey?: string) => {
        if (!selectedPath) return;
        updateMapping(draft => {
            const existingIndex = draft.findIndex((m: any) => m.destination === destination && (destination === 'custom_field' ? m.destination_key === destinationKey : true));
            const newRule = { source: `{{${selectedPath}}}`, destination, destination_key: destinationKey };
            if (existingIndex > -1) {
                draft[existingIndex] = newRule;
            } else {
                draft.push(newRule);
            }
            return draft;
        });
        setSelectedPath('');
    };

    const handleAddTagMapping = () => {
        if (!selectedPath) return;
        updateMapping(draft => {
            draft.push({ source: `{{${selectedPath}}}`, destination: 'tag' });
            return draft;
        });
        setSelectedPath('');
    };
    
    const handleAddCustomFieldMapping = () => {
         updateMapping(draft => {
            draft.push({ source: '', destination: 'custom_field', destination_key: '' });
            return draft;
        });
    };

    const handleCustomFieldMappingChange = (index: number, field: 'source' | 'destination_key', value: string) => {
         updateMapping(draft => {
            draft[index][field] = value;
            return draft;
        });
    };

    const handleRemoveMapping = (index: number) => {
        updateMapping(draft => {
            draft.splice(index, 1);
            return draft;
        });
    };

    const getMappingValue = (destination: string, destinationKey?: string) => {
        const mapping = (config.data_mapping || []).find((m: any) => m.destination === destination && (destination === 'custom_field' ? m.destination_key === destinationKey : true));
        return mapping?.source || '';
    };

    const tagMappings = useMemo(() => (config.data_mapping || []).map((m:any, i:number) => ({...m, originalIndex: i})).filter((m: any) => m.destination === 'tag'), [config.data_mapping]);
    const customFieldMappings = useMemo(() => (config.data_mapping || []).map((m:any, i:number) => ({...m, originalIndex: i})).filter((m: any) => m.destination === 'custom_field'), [config.data_mapping]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 h-full gap-4">
            {/* Left Panel */}
            <div className="p-4 border-r border-slate-700/50 flex flex-col space-y-4">
                <div className="flex-shrink-0 flex items-center gap-2 border-b border-slate-700/50 pb-4">
                    <TabButton label="Parameters" active={activeTab === 'Parameters'} onClick={() => setActiveTab('Parameters')} />
                    <TabButton label="Mapping" active={activeTab === 'Mapping'} onClick={() => setActiveTab('Mapping')} disabled={!hasCapturedData} />
                    <TabButton label="Docs" active={activeTab === 'Docs'} onClick={() => setActiveTab('Docs')} />
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {activeTab === 'Parameters' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-2">Webhook URL</h4>
                                <div className="flex items-center gap-2 bg-slate-700/50 p-2 rounded-md">
                                    <span className="flex-shrink-0 text-xs font-bold bg-slate-600 text-white px-2 py-1 rounded">POST</span>
                                    <input type="text" readOnly value={webhookUrl} className="w-full bg-transparent text-slate-300 font-mono text-xs" />
                                    <button onClick={() => copyToClipboard(webhookUrl)} className="text-slate-400 hover:text-white" title="Copiar URL">
                                        {copied ? <span className="text-green-400 text-xs">Copiado!</span> : <COPY_ICON className="w-4 h-4"/>}
                                    </button>
                                </div>
                            </div>
                             <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-700 rounded-lg">
                               <Button variant="secondary" onClick={handleListen} isLoading={isListening}>
                                    {isListening ? 'Aguardando Evento...' : 'Ouvir Evento de Teste'}
                                </Button>
                                 <p className="text-xs text-slate-400 mt-2">
                                   {isListening
                                        ? "Envie uma requisição para a URL para capturar dados."
                                        : "Clique para redefinir e capturar uma nova requisição de teste."
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                     {activeTab === 'Mapping' && hasCapturedData && (
                        <div className="space-y-4">
                             <h4 className="text-md font-semibold text-slate-200">Mapeamento de Dados</h4>
                             <p className="text-xs text-slate-400">Clique em um campo na árvore de dados à direita e, em seguida, mapeie-o para os campos de contato abaixo.</p>
                             {selectedPath && <p className="text-xs text-sky-300 font-mono p-2 bg-sky-500/10 rounded-md">Selecionado: {selectedPath}</p>}
                             
                            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg">
                                <h5 className="font-semibold text-slate-300 text-sm">Campos Padrão do Contato</h5>
                                <div className="flex items-center gap-2">
                                    <input type="text" readOnly value={getMappingValue('name')} placeholder="Nome do Contato" className="w-full bg-slate-700 p-2 rounded-md text-slate-300 font-mono text-xs"/>
                                    <Button size="sm" variant="secondary" onClick={() => handleSetMapping('name')} disabled={!selectedPath}>Mapear</Button>
                                </div>
                                 <div className="flex items-center gap-2">
                                    <input type="text" readOnly value={getMappingValue('phone')} placeholder="Telefone do Contato" className="w-full bg-slate-700 p-2 rounded-md text-slate-300 font-mono text-xs"/>
                                    <Button size="sm" variant="secondary" onClick={() => handleSetMapping('phone')} disabled={!selectedPath}>Mapear</Button>
                                </div>
                            </div>

                            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg">
                                <h5 className="font-semibold text-slate-300 text-sm">Adicionar como Tags</h5>
                                {tagMappings.map((mapping: any) => (
                                     <div key={mapping.originalIndex} className="flex items-center gap-2">
                                        <input type="text" readOnly value={mapping.source} className="w-full bg-slate-700 p-2 rounded-md text-slate-300 font-mono text-xs"/>
                                        <button onClick={() => handleRemoveMapping(mapping.originalIndex)} className="text-slate-400 hover:text-red-400"><TRASH_ICON className="w-4 h-4"/></button>
                                     </div>
                                ))}
                                <Button size="sm" variant="ghost" onClick={handleAddTagMapping} disabled={!selectedPath}><PLUS_ICON className="w-4 h-4 mr-1"/> Mapear campo como Tag</Button>
                            </div>

                            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg">
                                <h5 className="font-semibold text-slate-300 text-sm">Mapear para Campos Personalizados</h5>
                                {customFieldMappings.map((mapping: any) => (
                                     <div key={mapping.originalIndex} className="p-2 border border-slate-700 rounded-md space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input type="text" value={mapping.destination_key} onChange={e => handleCustomFieldMappingChange(mapping.originalIndex, 'destination_key', e.target.value)} placeholder="Nome do Campo" className="w-full bg-slate-700 p-2 rounded-md text-slate-300 text-xs"/>
                                             <button onClick={() => handleRemoveMapping(mapping.originalIndex)} className="text-slate-400 hover:text-red-400"><TRASH_ICON className="w-4 h-4"/></button>
                                        </div>
                                        <input type="text" value={mapping.source} onChange={e => handleCustomFieldMappingChange(mapping.originalIndex, 'source', e.target.value)} placeholder="Fonte do Valor (Ex: {{body.product.id}})" className="w-full bg-slate-700 p-2 rounded-md text-slate-300 font-mono text-xs"/>
                                     </div>
                                ))}
                                <Button size="sm" variant="ghost" onClick={handleAddCustomFieldMapping}><PLUS_ICON className="w-4 h-4 mr-1"/> Adicionar Campo</Button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'Docs' && (
                        <div className="text-slate-400 text-sm space-y-2">
                            <p>Envie uma requisição <code className="bg-slate-700 px-1 rounded">POST</code> para a URL para acionar a automação. Na primeira vez, use o modo "Ouvir Evento de Teste" para capturar a estrutura dos seus dados.</p>
                            <p>Depois de capturar, vá para a aba "Mapping" para mapear os dados recebidos para os campos de contato, tags e campos personalizados.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel */}
            <div className="p-4 bg-slate-800/20 flex flex-col">
                <div className="flex-shrink-0 flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Output</h3>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {hasCapturedData ? (
                        <JsonTreeView data={config.last_captured_data} onSelect={setSelectedPath} selectedPath={selectedPath} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-center p-4 border-2 border-dashed border-slate-700 rounded-lg">
                            <p className="text-sm text-slate-400">Os dados capturados aparecerão aqui.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TriggerSettings;
