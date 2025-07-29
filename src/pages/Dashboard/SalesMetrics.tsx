import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import { CustomTooltip } from './Dashboard';
import { FUNNEL_ICON } from '../../components/icons';
import { useUiStore } from '../../stores/uiStore';

const SalesMetrics: React.FC = () => {
    const { deals, stages, activePipelineId } = useAuthStore();
    const { theme } = useUiStore();

    const salesKPIs = useMemo(() => {
        const relevantDeals = deals.filter(d => d.pipeline_id === activePipelineId);
        const openDeals = relevantDeals.filter(d => d.status === 'Aberto');
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const wonDealsThisMonth = relevantDeals.filter(d => 
            d.status === 'Ganho' && d.closed_at && new Date(d.closed_at) >= startOfMonth
        );
        
        const wonDeals = relevantDeals.filter(d => d.status === 'Ganho');
        const lostDeals = relevantDeals.filter(d => d.status === 'Perdido');
        const totalClosed = wonDeals.length + lostDeals.length;

        return {
            openValue: openDeals.reduce((sum, d) => sum + (d.value || 0), 0),
            wonCountThisMonth: wonDealsThisMonth.length,
            wonValueThisMonth: wonDealsThisMonth.reduce((sum, d) => sum + (d.value || 0), 0),
            conversionRate: totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0,
        };
    }, [deals, activePipelineId]);

    const funnelChartData = useMemo(() => {
        const activeStages = stages
            .filter(s => s.pipeline_id === activePipelineId)
            .sort((a, b) => a.sort_order - b.sort_order);
            
        return activeStages.map(stage => ({
            name: stage.name,
            Negócios: deals.filter(d => d.stage_id === stage.id).length,
            fill: stage.type === 'Ganho' ? '#22c55e' : stage.type === 'Perdido' ? '#ef4444' : '#64748b', // slate-500
        }));
    }, [stages, deals, activePipelineId]);

    return (
        <Card>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Métricas de Vendas (Funil)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-center">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Valor em Aberto</p>
                    <p className="text-2xl font-bold text-green-400">{salesKPIs.openValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                 <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Ganhos este Mês</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-sky-400">{salesKPIs.wonValueThisMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{salesKPIs.wonCountThisMonth} negócios</p>
                </div>
                 <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Taxa de Conversão</p>
                    <p className="text-2xl font-bold text-amber-400">{salesKPIs.conversionRate.toFixed(1)}%</p>
                </div>
            </div>
            {funnelChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={funnelChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : 'rgba(100, 116, 139, 0.2)'} />
                        <XAxis dataKey="name" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} fontSize={12} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} />
                        <Bar dataKey="Negócios" name="Negócios" barSize={40}>
                            {funnelChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                 <div className="text-center py-10">
                    <FUNNEL_ICON className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600" />
                    <h3 className="text-md text-slate-800 dark:text-white mt-2">Nenhum dado de funil para exibir.</h3>
                    <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">Adicione negócios ao seu funil para ver as métricas aqui.</p>
                </div>
            )}
        </Card>
    );
};

export default SalesMetrics;