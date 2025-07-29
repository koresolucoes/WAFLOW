import React, { useState, useEffect, useMemo, FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { fetchMetaAnalytics } from '../../services/dataService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import InfoCard from '../../components/common/InfoCard';
import { SETTINGS_ICON } from '../../components/icons';

// Tipos para os dados de análise
interface ConversationDataPoint {
    start: number;
    end: number;
    conversation: number;
    cost: number;
    conversation_category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';
}
interface TemplateDataPoint {
    template_id: string;
    template_name: string;
    sent: number;
    delivered: number;
    read: number;
}
interface AnalyticsData {
    conversation_analytics?: { data?: { data_points?: ConversationDataPoint[] } };
    template_analytics?: { data?: TemplateDataPoint[] };
}

const StatCard: FC<{ title: string; value: string; description?: string }> = ({ title, value, description }) => (
    <Card>
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {description && <p className="text-xs text-slate-500 mt-2">{description}</p>}
    </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-700 p-3 rounded-lg border border-slate-600 shadow-xl">
        <p className="label font-bold text-white">{`${label}`}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.color }}>
            {pld.name === 'cost' ? 
              `${pld.name}: ${pld.value.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}` :
              `${pld.name}: ${pld.value.toLocaleString('pt-BR')}`
            }
          </p>
        ))}
      </div>
    );
  }
  return null;
};


const MarketingDashboard: FC = () => {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [granularity, setGranularity] = useState<'DAILY' | 'MONTHLY'>('DAILY');
    
    const metaConfig = useMetaConfig();
    const { setCurrentPage, templates } = useAuthStore();
    const hasMetaConfig = metaConfig.accessToken && metaConfig.wabaId;

    useEffect(() => {
        const fetchAllAnalytics = async () => {
            if (!hasMetaConfig) {
                setError("Por favor, configure suas credenciais da Meta na página de Configurações para ver os dados.");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);
            
            try {
                const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
                const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

                const top10TemplateIds = templates
                    .filter(t => t.status === 'APPROVED' && t.meta_id)
                    .slice(0, 10)
                    .map(t => t.meta_id!);

                const [convoRes, templateRes] = await Promise.allSettled([
                    fetchMetaAnalytics({ start: startTimestamp, end: endTimestamp, granularity, type: 'conversation_analytics' }),
                    top10TemplateIds.length > 0 
                        ? fetchMetaAnalytics({ start: startTimestamp, end: endTimestamp, granularity: 'DAILY', type: 'template_analytics', template_ids: top10TemplateIds }) 
                        : Promise.resolve({ template_analytics: { data: [] } })
                ]);
                
                const convoData = convoRes.status === 'fulfilled' ? convoRes.value : {};
                const templateData = templateRes.status === 'fulfilled' ? templateRes.value : {};
                
                setAnalyticsData(Object.assign({}, convoData, templateData));

            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllAnalytics();
    }, [startDate, endDate, granularity, hasMetaConfig, templates]);
    
    const processedData = useMemo(() => {
        const convoPoints = analyticsData?.conversation_analytics?.data?.[0]?.data_points || [];
        const templatePoints = analyticsData?.template_analytics?.data || [];
        
        // Process Conversation Data
        const totalCost = convoPoints.reduce((sum, p) => sum + p.cost, 0);
        const totalConversations = convoPoints.reduce((sum, p) => sum + p.conversation, 0);

        const costByCategory = convoPoints.reduce((acc, p) => {
            const category = p.conversation_category || 'UNKNOWN';
            if (!acc[category]) acc[category] = { cost: 0, conversations: 0 };
            acc[category].cost += p.cost;
            acc[category].conversations += p.conversation;
            return acc;
        }, {} as Record<string, { cost: number; conversations: number }>);
        
        const categoryChartData = Object.entries(costByCategory).map(([name, data]) => ({ name, ...data }));
        
        // Process Template Data
        const templatePerformance = templatePoints.map(t => ({
            ...t,
            name: templates.find(tpl => tpl.meta_id === t.template_id)?.template_name || t.template_id.substring(0,10)
        }));

        return { totalCost, totalConversations, categoryChartData, templatePerformance };

    }, [analyticsData, templates]);

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-white">Painel de Marketing</h1>
            
            {error ? (
                <InfoCard variant="error">
                    <p>{error}</p>
                    {error.includes("configuradas") && 
                        <Button size="sm" className="mt-2" onClick={() => setCurrentPage('settings')}>Ir para Configurações</Button>
                    }
                </InfoCard>
            ) : null}

            <Card className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <label htmlFor="start-date" className="text-sm text-slate-400">Data de Início</label>
                        <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-700 p-2 rounded-md mt-1"/>
                    </div>
                    <div>
                        <label htmlFor="end-date" className="text-sm text-slate-400">Data de Fim</label>
                        <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-700 p-2 rounded-md mt-1"/>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant={granularity === 'DAILY' ? 'primary' : 'secondary'} onClick={() => setGranularity('DAILY')}>Diário</Button>
                    <Button variant={granularity === 'MONTHLY' ? 'primary' : 'secondary'} onClick={() => setGranularity('MONTHLY')}>Mensal</Button>
                </div>
            </Card>

            {isLoading ? <div className="text-center p-10">Carregando dados...</div> : (
                <>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <StatCard title="Custo Total (USD)" value={processedData.totalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} description="Custo total de todas as conversas no período." />
                        <StatCard title="Conversas Iniciadas" value={processedData.totalConversations.toLocaleString('pt-BR')} description="Número total de conversas pagas iniciadas." />
                    </div>
                    
                    <InfoCard variant="info">
                        <strong>Nota de Depreciação:</strong> A API `conversation_analytics` usada para custos será descontinuada pela Meta no final de 2025. Este painel será atualizado para a nova API `pricing_analytics` quando disponível.
                    </InfoCard>
                    
                    <Card>
                        <h2 className="text-lg font-semibold text-white mb-4">Análise por Categoria de Conversa</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={processedData.categoryChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" tick={{ fill: '#94a3b8' }} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8' }} width={120} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                                <Legend />
                                <Bar dataKey="cost" name="Custo (USD)" fill="#0ea5e9" />
                                <Bar dataKey="conversations" name="Conversas" fill="#a855f7" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>

                     <Card>
                        <h2 className="text-lg font-semibold text-white mb-4">Desempenho dos Top 10 Templates</h2>
                        {processedData.templatePerformance.length > 0 ? (
                             <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-600">
                                            <th className="p-3 text-sm font-semibold text-slate-400">Template</th>
                                            <th className="p-3 text-sm font-semibold text-slate-400 text-right">Enviadas</th>
                                            <th className="p-3 text-sm font-semibold text-slate-400 text-right">Entregues</th>
                                            <th className="p-3 text-sm font-semibold text-slate-400 text-right">Lidas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedData.templatePerformance.map(t => (
                                            <tr key={t.template_id} className="border-b border-slate-700/50 hover:bg-slate-800/50 text-sm">
                                                <td className="p-3 font-mono text-white">{t.name}</td>
                                                <td className="p-3 font-mono text-slate-300 text-right">{t.sent?.toLocaleString('pt-BR')}</td>
                                                <td className="p-3 font-mono text-slate-300 text-right">{t.delivered?.toLocaleString('pt-BR')}</td>
                                                <td className="p-3 font-mono text-slate-300 text-right">{t.read?.toLocaleString('pt-BR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-slate-400 p-6">Nenhum dado de template encontrado para o período. Certifique-se de que os templates usados em campanhas estão sincronizados.</p>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
};

export default MarketingDashboard;