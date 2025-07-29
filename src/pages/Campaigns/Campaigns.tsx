import React, { useState, useMemo } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { TEMPLATE_ICON, SEND_ICON, MAIL_CHECK_ICON, MAIL_OPEN_ICON, TRASH_ICON, SEARCH_ICON } from '../../components/icons';
import { CampaignWithMetrics } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

const CampaignCard: React.FC<{ campaign: CampaignWithMetrics; onViewDetails: () => void; onDelete: () => void; }> = ({ campaign, onViewDetails, onDelete }) => {
    const readRate = campaign.metrics.sent > 0 ? ((campaign.metrics.read / campaign.metrics.sent) * 100).toFixed(1) + '%' : '0.0%';
    const isScheduledForFuture = campaign.sent_at && new Date(campaign.sent_at) > new Date();

    const statusText = campaign.status === 'Scheduled' && !isScheduledForFuture ? 'Enviando' : campaign.status;

    const statusStyle: Record<string, string> = {
        Sent: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
        Draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
        Failed: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
        Scheduled: "bg-blue-100 text-blue-700 dark:bg-sky-500/20 dark:text-sky-400",
        Enviando: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
    };
    
    const displayDate = campaign.sent_at 
        ? campaign.status === 'Scheduled'
            ? isScheduledForFuture
                ? `Agendada para ${new Date(campaign.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                : `Iniciada em ${new Date(campaign.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}`
            : `Enviada em ${new Date(campaign.sent_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}`
        : 'Não enviada';


    return (
        <Card className="flex flex-col justify-between hover:border-gray-300 dark:hover:border-sky-500 border border-transparent transition-colors duration-200 group relative">
             <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="absolute top-3 right-3 text-gray-500 hover:text-red-500 hover:bg-red-100/50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Excluir campanha"
            >
                <TRASH_ICON className="w-4 h-4" />
            </Button>
            <div>
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-all">{campaign.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${statusStyle[statusText]}`}>
                        {statusText}
                    </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{displayDate}</p>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <SEND_ICON className="w-5 h-5 text-gray-500 dark:text-sky-400" />
                        <div>
                            <p className="text-gray-500 dark:text-slate-400">Enviadas</p>
                            <p className="font-bold text-gray-800 dark:text-white">{campaign.metrics.sent.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <MAIL_CHECK_ICON className="w-5 h-5 text-green-500" />
                        <div>
                            <p className="text-gray-500 dark:text-slate-400">Entregues</p>
                            <p className="font-bold text-gray-800 dark:text-white">{campaign.metrics.delivered.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <MAIL_OPEN_ICON className="w-5 h-5 text-pink-500" />
                        <div>
                            <p className="text-gray-500 dark:text-slate-400">Lidas</p>
                            <p className="font-bold text-gray-800 dark:text-white">{campaign.metrics.read.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold text-lg">%</span>
                        <div>
                            <p className="text-gray-500 dark:text-slate-400">Taxa de Leitura</p>
                            <p className="font-bold text-gray-800 dark:text-white">{readRate}</p>
                        </div>
                    </div>
                </div>
            </div>
             <div className="mt-6">
                <Button variant="secondary" size="sm" onClick={onViewDetails} className="w-full">
                    Ver Relatório Detalhado
                </Button>
            </div>
        </Card>
    );
};

const Campaigns: React.FC = () => {
    const { campaigns, deleteCampaign, setCurrentPage } = useAuthStore();
    const { addToast, showConfirmation } = useUiStore();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCampaigns = useMemo(() => {
        if (!searchTerm) return campaigns;
        const lowercasedTerm = searchTerm.toLowerCase();
        return campaigns.filter(campaign =>
            campaign.name.toLowerCase().includes(lowercasedTerm)
        );
    }, [campaigns, searchTerm]);

    const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
        showConfirmation(
            'Excluir Campanha',
            `Tem certeza de que deseja excluir a campanha "${campaignName}"? Esta ação não pode ser desfeita e excluirá todos os seus dados.`,
            async () => {
                try {
                    await deleteCampaign(campaignId);
                    addToast(`Campanha "${campaignName}" excluída.`, 'success');
                } catch (err: any) {
                    addToast(`Erro ao excluir campanha: ${err.message}`, 'error');
                }
            }
        );
    };


    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Histórico de Campanhas</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <SEARCH_ICON className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar campanhas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:outline-none"
                        />
                    </div>
                    <Button variant="primary" onClick={() => setCurrentPage('templates')}>
                        <TEMPLATE_ICON className="w-5 h-5 mr-2" />
                        Criar Nova Campanha
                    </Button>
                </div>
            </div>
      
            {filteredCampaigns.length === 0 && campaigns.length > 0 ? (
                 <Card className="text-center py-12">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nenhuma campanha encontrada.</h2>
                    <p className="text-gray-500 dark:text-slate-400 mt-2">{`Sua busca por "${searchTerm}" não retornou resultados.`}</p>
                </Card>
            ) : campaigns.length === 0 ? (
                <Card className="text-center py-12">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nenhuma campanha enviada.</h2>
                    <p className="text-gray-500 dark:text-slate-400 mt-2 mb-6">Crie uma campanha a partir de um template para começar.</p>
                    <Button variant="primary" onClick={() => setCurrentPage('templates')}>
                        Ir para Templates
                    </Button>
                </Card>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCampaigns.map(campaign => (
                        <CampaignCard
                            key={campaign.id}
                            campaign={campaign}
                            onViewDetails={() => setCurrentPage('campaign-details', { campaignId: campaign.id })}
                            onDelete={() => handleDeleteCampaign(campaign.id, campaign.name)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Campaigns;