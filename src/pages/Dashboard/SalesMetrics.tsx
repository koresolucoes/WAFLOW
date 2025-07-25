
import React, { useContext, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '../../components/common/Card';
import { FunnelContext } from '../../contexts/providers/FunnelContext';
import { CustomTooltip } from './Dashboard';
import { FUNNEL_ICON } from '../../components/icons';

const SalesMetrics: React.FC = () => {
    const { deals, stages, activePipelineId } = useContext(FunnelContext);

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
            .filter(s => s.pipeline_id === activePipelineId && s.type === 'Intermediária')
            .sort((a, b) => a.sort_order - b.sort_order);
            
        return activeStages.map(stage => ({
            name: stage.name,
            Negócios: deals.filter(d => d.stage_id === stage.id).length,
        }));
    }, [stages, deals, activePipelineId]);

    return (
        <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Métricas de Vendas (Funil)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-center">
                <div>
                    <p className="text-sm text-slate-400">Valor em Aberto</p>
                    <p className="text-2xl font-bold text-green-400">{salesKPIs.openValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                 <div>
                    <p className="text-sm text-slate-400">Ganhos este Mês</p>
                    <p className="text-2xl font-bold text-sky-400">{salesKPIs.wonValueThisMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p className="text-xs text-slate-500">{salesKPIs.wonCountThisMonth} negócios</p>
                </div>
                 <div>
                    <p className="text-sm text-slate-400">Taxa de Conversão</p>
                    <p className="text-2xl font-bold text-amber-400">{salesKPIs.conversionRate.toFixed(1)}%</p>
                </div>
            </div>
            {funnelChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={funnelChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} fontSize={12} />
                        <YAxis tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                        <Bar dataKey="Negócios" fill="#0ea5e9" name="Negócios" barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                 <div className="text-center py-10">
                    <FUNNEL_ICON className="w-12 h-12 mx-auto text-slate-600" />
                    <h3 className="text-md text-white mt-2">Nenhum dado de funil para exibir.</h3>
                    <p className="text-slate-500 text-sm mt-1">Adicione negócios ao seu funil para ver as métricas aqui.</p>
                </div>
            )}
        </Card>
    );
};

export default SalesMetrics;
