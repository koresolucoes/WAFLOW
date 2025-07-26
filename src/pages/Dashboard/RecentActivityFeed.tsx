
import React from 'react';
import Card from '../../components/common/Card';
import { DashboardData, GlobalActivityEvent } from '../../services/dataService';
import { CONTACTS_ICON, CAMPAIGN_ICON, FUNNEL_ICON } from '../../components/icons';

interface RecentActivityFeedProps {
    data: DashboardData | null;
    isLoading: boolean;
}

const ActivityIcon: React.FC<{ type: GlobalActivityEvent['type'] }> = ({ type }) => {
    const icons = {
        NEW_CONTACT: <CONTACTS_ICON className="w-4 h-4 text-sky-400" />,
        CAMPAIGN_SENT: <CAMPAIGN_ICON className="w-4 h-4 text-pink-400" />,
        DEAL_WON: <FUNNEL_ICON className="w-4 h-4 text-green-400" />,
        DEAL_LOST: <FUNNEL_ICON className="w-4 h-4 text-red-400" />,
    };
    return (
        <div className="w-8 h-8 flex-shrink-0 bg-slate-700 rounded-full flex items-center justify-center">
            {icons[type]}
        </div>
    );
};

const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ data, isLoading }) => {
    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " anos atrás";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses atrás";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " dias atrás";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas atrás";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos atrás";
        return "agora mesmo";
    };

    return (
        <Card className="flex flex-col h-[420px]">
            <h2 className="text-lg font-semibold text-white mb-4 flex-shrink-0">Atividades Recentes</h2>
            <div className="flex-grow overflow-y-auto pr-2">
                {isLoading ? (
                     <p className="text-center text-xs text-slate-500 pt-10">Carregando atividades...</p>
                ) : !data || data.activityFeed.length === 0 ? (
                    <div className="text-center text-slate-500 pt-10">
                        <p>Nenhuma atividade recente para mostrar.</p>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {data.activityFeed.map(event => (
                            <li key={event.id} className="flex items-start gap-3">
                                <ActivityIcon type={event.type} />
                                <div>
                                    <p className="text-sm text-slate-200">
                                        <span className="font-semibold">{event.title}:</span> {event.description}
                                        {event.type === 'DEAL_WON' && (
                                            <span className="text-green-400 font-mono text-xs ml-1">
                                                (+{event.value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">{formatTimeAgo(event.timestamp)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Card>
    );
};

export default RecentActivityFeed;
