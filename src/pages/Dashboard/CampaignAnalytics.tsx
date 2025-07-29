import React, { useMemo } from 'react';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import { CAMPAIGN_ICON } from '../../components/icons';

const CampaignAnalytics: React.FC = () => {
    const { campaigns, setCurrentPage } = useAuthStore();

    const stats = useMemo(() => {
        if (campaigns.length === 0) {
            return {
                totalSent: 0,
                overallReadRate: '0.0%',
                totalCampaigns: 0,
            };
        }
        
        const totalSent = campaigns.reduce((sum, c) => sum + c.metrics.sent, 0);
        const totalRead = campaigns.reduce((sum, c) => sum + c.metrics.read, 0);

        const overallReadRate = totalSent > 0
            ? ((totalRead / totalSent) * 100).toFixed(1) + '%'
            : '0.0%';

        return {
            totalSent,
            overallReadRate,
            totalCampaigns: campaigns.length,
        };
    }, [campaigns]);

    const mostRecentCampaigns = useMemo(() => {
        return [...campaigns]
            .filter(c => c.sent_at)
            .sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime())
            .slice(0, 3);
    }, [campaigns]);

    return (
        <Card className="flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4">Análise de Campanhas</h2>

            <div className="grid grid-cols-3 gap-4 text-center mb-4 p-3 bg-slate-900/50 rounded-lg">
                <div>
                    <p className="text-2xl font-bold text-sky-400">{stats.totalCampaigns}</p>
                    <p className="text-xs text-slate-400">Campanhas</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-white">{stats.totalSent.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-slate-400">Enviadas</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-pink-400">{stats.overallReadRate}</p>
                    <p className="text-xs text-slate-400">Taxa de Leitura</p>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Últimas Campanhas Enviadas</h3>
                {mostRecentCampaigns.length > 0 ? (
                    <ul className="space-y-2">
                        {mostRecentCampaigns.map(campaign => {
                            const readRate = campaign.metrics.sent > 0 ? ((campaign.metrics.read / campaign.metrics.sent) * 100).toFixed(1) + '%' : '0.0%';
                            return (
                                <li
                                    key={campaign.id}
                                    className="flex justify-between items-center p-2 bg-slate-800 rounded-md text-sm"
                                    title={campaign.name}
                                >
                                    <span className="font-medium text-slate-200 truncate pr-2">{campaign.name}</span>
                                    <span className="font-mono font-semibold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">{readRate}</span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="text-center py-6">
                        <CAMPAIGN_ICON className="w-10 h-10 mx-auto text-slate-600"/>
                        <p className="text-sm text-slate-500 mt-2">Nenhuma campanha enviada ainda.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default CampaignAnalytics;