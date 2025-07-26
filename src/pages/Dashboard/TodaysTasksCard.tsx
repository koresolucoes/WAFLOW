import React, { useContext } from 'react';
import Card from '../../components/common/Card';
import { ActivityContext } from '../../contexts/providers/ActivityContext';
import { NavigationContext } from '../../contexts/providers/NavigationContext';
import { CALENDAR_ICON } from '../../components/icons';
import Button from '../../components/common/Button';

const TodaysTasksCard: React.FC = () => {
    const { todaysTasks } = useContext(ActivityContext);
    const { setCurrentPage } = useContext(NavigationContext);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoje';
        if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
        return date.toLocaleDateString('pt-BR');
    };

    const isOverdue = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    return (
        <Card className="flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4">Tarefas para Hoje</h2>
            {todaysTasks.length > 0 ? (
                <ul className="space-y-3 overflow-y-auto flex-grow">
                    {todaysTasks.map(task => (
                        <li 
                            key={task.id} 
                            className="p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-700/50"
                            onClick={() => setCurrentPage('contact-details', { contactId: task.contacts?.id })}
                        >
                            <p className="text-sm text-slate-200">{task.content}</p>
                            <div className="flex justify-between items-center mt-2 text-xs">
                                <span className="font-semibold text-sky-400">{task.contacts?.name}</span>
                                <span className={`flex items-center gap-1 font-mono ${isOverdue(task.due_date!) ? 'text-red-400' : 'text-slate-400'}`}>
                                    <CALENDAR_ICON className="w-3 h-3" />
                                    {formatDate(task.due_date!)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-400">
                    <CALENDAR_ICON className="w-10 h-10 mb-2 text-slate-500" />
                    <p>Nenhuma tarefa pendente para hoje.</p>
                </div>
            )}
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setCurrentPage('contacts')}>
                Ver todos os contatos
            </Button>
        </Card>
    );
};

export default TodaysTasksCard;
