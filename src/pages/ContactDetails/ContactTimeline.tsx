import React from 'react';
import { TimelineEvent } from '../../types';
import Card from '../../components/common/Card';
import TimelineMessageItem from './TimelineMessageItem';
import TimelineAutomationItem from './TimelineAutomationItem';
import TimelineDealItem from './TimelineDealItem';

interface ContactTimelineProps {
    events: TimelineEvent[];
    isLoading: boolean;
}

const ContactTimeline: React.FC<ContactTimelineProps> = ({ events, isLoading }) => {
    return (
        <Card>
            <h2 className="text-lg font-semibold text-white mb-4">Linha do Tempo</h2>
            {isLoading ? (
                <div className="text-center text-slate-400 py-8">Carregando atividades...</div>
            ) : events.length === 0 ? (
                <div className="text-center text-slate-400 py-8">Nenhuma atividade registrada para este contato.</div>
            ) : (
                <div className="relative space-y-6">
                    {events.map((event, index) => {
                        switch (event.type) {
                            case 'MESSAGE':
                                return <TimelineMessageItem key={event.id} event={event} isLast={index === events.length - 1} />;
                            case 'AUTOMATION_RUN':
                                return <TimelineAutomationItem key={event.id} event={event} isLast={index === events.length - 1} />;
                            case 'DEAL_CREATED':
                                return <TimelineDealItem key={event.id} event={event} isLast={index === events.length - 1} />;
                            default:
                                return null;
                        }
                    })}
                </div>
            )}
        </Card>
    );
};

export default ContactTimeline;
