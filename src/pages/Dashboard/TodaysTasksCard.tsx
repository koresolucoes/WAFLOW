import React from 'react';
import Card from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import { CALENDAR_ICON } from '../../components/icons';
import Button from '../../components/common/Button';

const TodaysTasksCard: React.FC = () => {
    const { todaysTasks, setCurrentPage } = useAuthStore();

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
        <Card className="flex flex-col h-[420px]">
            <h2 className="text-lg font-semibold text-white mb-4 flex-shrink-0">Tarefas para Hoje</h2>
            {todaysTasks.length > 0 ? (
                <ul className="space-y-3 overflow-y-auto flex-grow pr-2">
                    {todaysTasks.map(task => (
                        <li 
                            key={task.id} 
                            className="p-3 bg-slate-900/50 rounded-lg"
                        >
                            <p className="text-sm text-slate-200">{task.content}</p>
                            <div className="flex justify-between items-center mt-2 text-xs">
                                <span
                                    className={`font-semibold truncate pr-2 text-left ${
                                        task.contacts?.id
                                            ? 'text-sky-400'
                                            : 'text-slate-400'
                                    }`}
                                    title={task.contacts?.id ? task.contacts.name : 'Nenhum contato associado'}
                                >
                                    {task.contacts?.name || 'Contato não associado'}
                                </span>
                                {task.due_date && (
                                    <span className={`flex items-center gap-1 font-mono ${isOverdue(task.due_date) ? 'text-red-400' : 'text-slate-400'}`}>
                                        <CALENDAR_ICON className="w-3 h-3" />
                                        {formatDate(task.due_date)}
                                    </span>
                                )}
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
            <Button variant="secondary" size="sm" className="mt-4 w-full flex-shrink-0" disabled title="Navegação desativada temporariamente">
                Ver todos os contatos
            </Button>
        </Card>
    );
};

export default TodaysTasksCard;