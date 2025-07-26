import React from 'react';
import { TimelineEvent } from '../../types';
import TimelineItemWrapper from './TimelineItemWrapper';
import { FUNNEL_ICON } from '../../components/icons';

interface TimelineDealItemProps {
    event: TimelineEvent;
    isLast: boolean;
}

const TimelineDealItem: React.FC<TimelineDealItemProps> = ({ event, isLast }) => {
    const dealName = event.data.name;
    const dealValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.data.value || 0);
    const stageName = event.data.pipeline_stages?.name || 'etapa desconhecida';

    return (
        <TimelineItemWrapper
            icon={<FUNNEL_ICON className="w-5 h-5 text-indigo-400" />}
            timestamp={event.timestamp}
            isLast={isLast}
        >
            <p className="text-sm text-slate-300">
                Negócio <span className="font-semibold text-white">'{dealName}'</span> no valor de <span className="font-semibold text-green-400">{dealValue}</span> foi criado e adicionado à etapa <span className="font-semibold text-white">'{stageName}'</span>.
            </p>
        </TimelineItemWrapper>
    );
};

export default TimelineDealItem;
