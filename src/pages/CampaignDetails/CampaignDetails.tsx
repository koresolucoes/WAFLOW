import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { CampaignMessage, MessageTemplate } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { ARROW_LEFT_ICON, SEND_ICON, MAIL_CHECK_ICON, MAIL_OPEN_ICON } from '../../components/icons';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <Card className="flex items-center p-4">
        <div className="p-3 bg-slate-700 rounded-lg">
            {icon}
        </div>
        <div className="ml-4">
            <h3 className="text-sm font-medium text-slate-400">{title}</h3>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
    </Card>
);

const MessageStatusBadge: React.FC<{ status: CampaignMessage['status'] }> = ({ status }) => {
    const statusInfo = {
        sent: { text: 'Enviada', style: 'bg-sky-500/20 text-sky-400' },
        delivered: { text: 'Entregue', style: 'bg-green-500/20 text-green-400' },
        read: { text: 'Lida', style: 'bg-pink-500/20 text-pink-400' },
        failed: { text: 'Falhou', style: 'bg-red-500/20 text-red-400' },
    };
    const info = statusInfo[status] || { text: status, style: 'bg-slate-500/20 text-slate-400' };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${info.style}`}>{info.text}</span>;
};

const TemplatePreview: React.FC<{ template: MessageTemplate | null }> = ({ template }) => {
    if (!template) {
        return <p className="text-sm text-slate-400">Informações do template não disponíveis.</p>;
    }

    const header = template.components?.find(c => c.type === 'HEADER');
    const body = template.components?.find(c => c.type === 'BODY');

    return (
        <div className="p-4 bg-slate-900/50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-mono text-white">{template.template_name}</h3>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-600/50 text-slate-300">
                    {template.category}
                </span>
            </div>
            <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap space-y-2">
                {header?.text && <p className="font-bold">{header.text}</p>}
                {body?.text && <p>{body.text}</p>}
            </div>
        </div>
    );
};


const CampaignDetails: React.FC = () => {
    const { pageParams, setCurrentPage, campaignDetails, fetchCampaignDetails } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const loadDetails = async () => {
            if (pageParams.campaignId) {
                setIsLoading(true);
                try {
                    await fetchCampaignDetails(pageParams.campaignId);
                } catch (error) {
                    console.error("Failed to load campaign details:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };
        loadDetails();
    }, [pageParams.campaignId, fetchCampaignDetails]);

    const readRate = useMemo(() => {
        if (!campaignDetails || !campaignDetails.metrics.sent) return '0.0%';
        return ((campaignDetails.metrics.read / campaignDetails.metrics.sent) * 100).toFixed(1) + '%';
    }, [campaignDetails]);

    if (isLoading) {
        return <div className="text-center text-white">Carregando detalhes da campanha...</div>;
    }

    if (!campaignDetails) {
        return (
            <div className="text-center">
                <h2 className="text-xl font-semibold text-white">Campanha não encontrada.</h2>
                <p className="text-slate-400 mt-2">Não foi possível carregar os detalhes da campanha solicitada.</p>
                <Button className="mt-4" onClick={() => setCurrentPage('campaigns')}>
                    <ARROW_LEFT_ICON className="w-5 h-5 mr-2" />
                    Voltar para Campanhas
                </Button>
            </div>
        );
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return <span className="text-slate-500">-</span>;
        return new Date(dateString).toLocaleString('pt-BR', {timeZone: 'UTC'});
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white truncate pr-4">Detalhes: {campaignDetails.name}</h1>
                <Button variant="secondary" onClick={() => setCurrentPage('campaigns')}>
                    <ARROW_LEFT_ICON className="w-5 h-5 mr-2" />
                    Voltar para Campanhas
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Enviadas" value={campaignDetails.metrics.sent.toLocaleString('pt-BR')} icon={<SEND_ICON className="w-6 h-6 text-sky-400" />} />
                <StatCard title="Entregues" value={campaignDetails.metrics.delivered.toLocaleString('pt-BR')} icon={<MAIL_CHECK_ICON className="w-6 h-6 text-green-400" />} />
                <StatCard title="Lidas" value={campaignDetails.metrics.read.toLocaleString('pt-BR')} icon={<MAIL_OPEN_ICON className="w-6 h-6 text-pink-400" />} />
                <StatCard title="Taxa de Leitura" value={readRate} icon={<span className="text-amber-400 font-bold text-xl">%</span>} />
            </div>

            <Card>
                <h2 className="text-lg font-semibold text-white mb-2">Template Utilizado</h2>
                <TemplatePreview template={campaignDetails.message_templates} />
            </Card>

            <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Relatório de Envio Individual</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-600">
                                <th className="p-3 text-sm font-semibold text-slate-400">Destinatário</th>
                                <th className="p-3 text-sm font-semibold text-slate-400">Status</th>
                                <th className="p-3 text-sm font-semibold text-slate-400">Detalhes do Erro</th>
                                <th className="p-3 text-sm font-semibold text-slate-400">Entregue em</th>
                                <th className="p-3 text-sm font-semibold text-slate-400">Lido em</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaignDetails.messages.map(msg => (
                                <tr key={msg.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 text-sm">
                                    <td className="p-3 font-medium text-white">
                                        <div>{msg.contacts?.name || 'N/A'}</div>
                                        <div className="font-mono text-xs text-slate-400">{msg.contacts?.phone || 'N/A'}</div>
                                    </td>
                                    <td className="p-3"><MessageStatusBadge status={msg.status} /></td>
                                    <td className="p-3 text-red-400 font-mono text-xs max-w-xs break-words">
                                        {msg.status === 'failed' ? msg.error_message : <span className="text-slate-500">-</span>}
                                    </td>
                                    <td className="p-3 text-slate-400">{formatDate(msg.delivered_at)}</td>
                                    <td className="p-3 text-slate-400">{formatDate(msg.read_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

        </div>
    );
};

export default CampaignDetails;