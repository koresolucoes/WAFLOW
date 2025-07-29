

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../stores/authStore';
import { WebhookLog } from '../../types';
import Card from '../../components/common/Card';
import JsonTreeView from '../AutomationEditor/node-settings/JsonTreeView';

const WebhookInspector: React.FC = () => {
    const { user, activeTeam } = useAuthStore();
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        if (!user || !activeTeam) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('webhook_logs')
            .select('*')
            .eq('team_id', activeTeam.id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            console.error("Error fetching webhook logs:", error);
        } else {
            setLogs(data as unknown as WebhookLog[]);
        }
        setIsLoading(false);
    }, [user, activeTeam]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        if (!user || !activeTeam) return;
        const channel = supabase
            .channel('webhook-logs-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'webhook_logs', filter: `team_id=eq.${activeTeam.id}` },
                (payload) => {
                    const newLog = payload.new as WebhookLog;
                    setLogs(prev => [newLog, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, activeTeam]);

    const handleSelectLog = (log: WebhookLog) => {
        setSelectedLog(log.id === selectedLog?.id ? null : log);
    };

    return (
        <div className="space-y-8 h-full flex flex-col">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex-shrink-0">Webhook Inspector</h1>
            <Card className="flex-grow overflow-hidden flex flex-col">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 flex-shrink-0">
                    Visualize em tempo real as requisições que chegam nos seus endpoints de webhook (Meta e Gatilhos de Automação). Os 50 eventos mais recentes são exibidos.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden">
                    {/* Log List */}
                    <div className="md:col-span-1 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-lg overflow-y-auto">
                        {isLoading ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-4">Carregando...</p>
                        ) : logs.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-center text-slate-500 dark:text-slate-400 p-4">Nenhum evento de webhook recebido ainda.</p>
                            </div>
                        ) : (
                            <ul>
                                {logs.map(log => (
                                    <li key={log.id}>
                                        <button
                                            onClick={() => handleSelectLog(log)}
                                            className={`w-full text-left p-3 rounded-md mb-2 transition-colors ${selectedLog?.id === log.id ? 'bg-slate-200 dark:bg-sky-500/20' : 'hover:bg-slate-200/70 dark:hover:bg-slate-700/50'}`}
                                        >
                                            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                                <span className={`font-semibold ${log.source === 'meta_message' ? 'text-green-500' : 'text-purple-500'}`}>{log.source}</span>
                                                <span>{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                                            </div>
                                            <p className="font-mono text-sm text-slate-800 dark:text-slate-200 mt-1 truncate">{log.path}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {/* Payload Viewer */}
                    <div className="md:col-span-2 bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg overflow-y-auto">
                         <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Payload</h3>
                        {selectedLog ? (
                            <JsonTreeView data={selectedLog.payload || { error: 'Payload Vazio' }} onSelect={() => {}} selectedPath="" />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-slate-500">Selecione um evento para ver o payload.</p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default WebhookInspector;