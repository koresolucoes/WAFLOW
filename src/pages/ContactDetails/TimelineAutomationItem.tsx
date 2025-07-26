import React from 'react';
import { TimelineEvent } from '../../types';
import TimelineItemWrapper from './TimelineItemWrapper';
import { AUTOMATION_ICON } from '../../components/icons';

interface TimelineAutomationItemProps {
    event: TimelineEvent;
    isLast: boolean;
}

const TimelineAutomationItem: React.FC<TimelineAutomationItemProps> = ({ event, isLast }) => {
    const statusText = event.data.status === 'success' ? 'executada com sucesso' : 'falhou';
    const textColor = event.data.status === 'success' ? 'text-green-400' : 'text-red-400';
    
    const automationName = event.data.automations?.name || 'Automação desconhecida';

    return (
        <TimelineItemWrapper
            icon={<AUTOMATION_ICON className="w-5 h-5 text-purple-400" />}
            timestamp={event.timestamp}
            isLast={isLast}
        >
            <p className="text-sm text-slate-300">
                Automação <span className="font-semibold text-white">'{automationName}'</span> foi <span className={`font-semibold ${textColor}`}>{statusText}</span>.
            </p>
            {event.data.details && (
                <p className="text-xs text-slate-400 font-mono bg-slate-900/50 p-2 rounded-md mt-1">
                    {event.data.details}
                </p>
            )}
        </TimelineItemWrapper>
    );
};

export default TimelineAutomationItem;