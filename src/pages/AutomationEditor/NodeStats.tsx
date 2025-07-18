
import React from 'react';
import { AutomationNodeStats } from '../../types';
import Button from '../../components/common/Button';

interface NodeStatsProps {
    stats: AutomationNodeStats | undefined;
    onViewLogs: () => void;
}

const NodeStats: React.FC<NodeStatsProps> = ({ stats, onViewLogs }) => {
    const successCount = stats?.success_count || 0;
    const errorCount = stats?.error_count || 0;
    const hasRuns = successCount > 0 || errorCount > 0;

    return (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
            <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-green-400" title="Execuções com sucesso">
                    ✅
                    <span className="font-mono">{successCount}</span>
                </span>
                <span className="flex items-center gap-1 text-red-400" title="Execuções com erro">
                    ❌
                    <span className="font-mono">{errorCount}</span>
                </span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onViewLogs(); }}
                    disabled={!hasRuns}
                    title={hasRuns ? "Ver logs de execução" : "Nenhum log disponível"}
                >
                    Ver Logs
                </Button>
            </div>
        </div>
    );
};

export default NodeStats;
