
import React from 'react';
import { AutomationNodeLog } from '../../types';
import Button from '../../components/common/Button';

interface NodeLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodeLabel: string;
    logs: AutomationNodeLog[];
    isLoading: boolean;
}

const StatusBadge: React.FC<{ status: AutomationNodeLog['status'] }> = ({ status }) => {
    const statusStyles = {
        success: 'bg-green-500/20 text-green-400',
        failed: 'bg-red-500/20 text-red-400',
    };
    const style = statusStyles[status] || 'bg-slate-500/20 text-slate-400';
    const text = status === 'success' ? 'Sucesso' : 'Falha';
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${style}`}>{text}</span>;
};


const NodeLogsModal: React.FC<NodeLogsModalProps> = ({ isOpen, onClose, nodeLabel, logs, isLoading }) => {
    if (!isOpen) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'medium',
        });
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className={`bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold text-white">Logs de Execução: {nodeLabel}</h3>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                </header>
                
                <main className="flex-grow p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center text-slate-300">Carregando logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">
                            Nenhum log encontrado para este nó.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map(log => (
                                <div key={log.id} className="p-3 bg-slate-900/50 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-xs font-mono text-slate-400">{formatDate(log.created_at)}</p>
                                        <StatusBadge status={log.status} />
                                    </div>
                                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{log.details}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

                 <footer className="flex-shrink-0 p-4 border-t border-slate-700 flex justify-end">
                    <Button variant="primary" onClick={onClose}>Fechar</Button>
                </footer>
            </div>
        </div>
    );
};

export default NodeLogsModal;
