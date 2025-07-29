import React, { useMemo } from 'react';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import { DashboardData } from '../../services/dataService';
import { AUTOMATION_ICON } from '../../components/icons';

interface AutomationAnalyticsProps {
    data: DashboardData | null;
    isLoading: boolean;
}

const AutomationAnalytics: React.FC<AutomationAnalyticsProps> = ({ data, isLoading }) => {
    const { automations, setCurrentPage } = useAuthStore();

    const stats = useMemo(() => {
        if (!data) return { successRate: '0.0%', totalRuns: 0, mostActive: [] };
        const successRate = data.totalRunsLast7Days > 0
            ? ((data.successfulRunsLast7Days / data.totalRunsLast7Days) * 100).toFixed(1) + '%'
            : '0.0%';
        
        return {
            successRate,
            totalRuns: data.totalRunsLast7Days,
            mostActive: data.mostActiveAutomations,
        };
    }, [data]);

    const activeAutomationsCount = useMemo(() => {
        return automations.filter(a => a.status === 'active').length;
    }, [automations]);
    
    return (
        <Card className="flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4">Análise de Automações</h2>
            
            <div className="grid grid-cols-3 gap-4 text-center mb-4 p-3 bg-slate-900/50 rounded-lg">
                <div>
                    <p className="text-2xl font-bold text-pink-400">{activeAutomationsCount}</p>
                    <p className="text-xs text-slate-400">Ativas</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-white">{stats.totalRuns}</p>
                    <p className="text-xs text-slate-400">Execuções (7d)</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-green-400">{stats.successRate}</p>
                    <p className="text-xs text-slate-400">Sucesso (7d)</p>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Mais Ativas (Últimos 7 dias)</h3>
                 {isLoading ? (
                    <p className="text-center text-xs text-slate-500">Carregando...</p>
                ) : stats.mostActive.length > 0 ? (
                    <ul className="space-y-2">
                        {stats.mostActive.map(item => (
                            <li
                                key={item.automation_id}
                                className="flex justify-between items-center p-2 bg-slate-800 rounded-md text-sm"
                                title={item.automations?.name}
                            >
                                <span className="font-medium text-slate-200 truncate pr-2">{item.automations?.name}</span>
                                <span className="font-mono font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">{item.count}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center py-6">
                        <AUTOMATION_ICON className="w-10 h-10 mx-auto text-slate-600"/>
                        <p className="text-sm text-slate-500 mt-2">Nenhuma automação executada nos últimos 7 dias.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default AutomationAnalytics;