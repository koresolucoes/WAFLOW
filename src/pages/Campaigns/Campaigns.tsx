import React, { useContext } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { TEMPLATE_ICON, SEND_ICON, MAIL_CHECK_ICON, MAIL_OPEN_ICON, TRASH_ICON } from '../../components/icons';
import { CampaignWithMetrics } from '../../types';
import { CampaignsContext } from '../../contexts/providers/CampaignsContext';
import { NavigationContext } from '../../contexts/providers/NavigationContext';

const CampaignCard: React.FC<{ campaign: CampaignWithMetrics; onViewDetails: () => void; onDelete: () => void; }> = ({ campaign, onViewDetails, onDelete }) => {
    const readRate = campaign.metrics.sent > 0 ? ((campaign.metrics.read / campaign.metrics.sent) * 100).toFixed(1) + '%' : '0.0%';

    const statusStyle = {
        Sent: "bg-green-500/20 text-green-400",
        Draft: "bg-yellow-500/20 text-yellow-400",
        Failed: "bg-red-500/20 text-red-400",
        Scheduled: "bg-sky-500/20 text-sky-400"
    };
    
    const sentDate = campaign.sent_at ? new Date(campaign.sent_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Não enviado';

    return (
        <Card className="flex flex-col justify-between hover:border-sky-500 border border-transparent transition-colors duration-200 group relative">
             <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="absolute top-3 right-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Excluir campanha"
            >
                <TRASH_ICON className="w-4 h-4" />
            </Button>
            <div>
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-semibold text-white break-all">{campaign.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${statusStyle[campaign.status]}`}>
                        {campaign.status}
                    </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">Enviada em {sentDate}</p>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <SEND_ICON className="w-5 h-5 text-sky-400" />
                        <div>
                            <p className="text-slate-400">Enviadas</p>
                            <p className="font-bold text-white">{campaign.metrics.sent.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <MAIL_CHECK_ICON className="w-5 h-5 text-green-400" />
                        <div>
                            <p className="text-slate-400">Entregues</p>
                            <p className="font-bold text-white">{campaign.metrics.delivered.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <MAIL_OPEN_ICON className="w-5 h-5 text-pink-400" />
                        <div>
                            <p className="text-slate-400">Lidas</p>
                            <p className="font-bold text-white">{campaign.metrics.read.toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold text-lg">%</span>
                        <div>
                            <p className="text-slate-400">Taxa de Leitura</p>
                            <p className="font-bold text-white">{readRate}</p>
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
    const { campaigns, deleteCampaign } = useContext(CampaignsContext);
    const { setCurrentPage } = useContext(NavigationContext);

    const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
        if (window.confirm(`Tem certeza de que deseja excluir a campanha "${campaignName}"? Esta ação não pode ser desfeita e excluirá todos os seus dados.`)) {
            try {
                await deleteCampaign(campaignId);
            } catch (err: any) {
                alert(`Erro ao excluir campanha: ${err.message}`);
            }
        }
    };


    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Histórico de Campanhas</h1>
                <Button variant="primary" onClick={() => setCurrentPage('templates')}>
                    <TEMPLATE_ICON className="w-5 h-5 mr-2" />
                    Criar Nova Campanha
                </Button>
            </div>
      
            {campaigns.length === 0 ? (
                <Card className="text-center py-12">
                    <h2 className="text-xl font-semibold text-white">Nenhuma campanha enviada.</h2>
                    <p className="text-slate-400 mt-2 mb-6">Crie uma campanha a partir de um template para começar.</p>
                    <Button variant="primary" onClick={() => setCurrentPage('templates')}>
                        Ir para Templates
                    </Button>
                </Card>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map(campaign => (
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
