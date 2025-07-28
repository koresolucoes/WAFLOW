import React from 'react';
import { ContactActivity } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { NOTE_ICON, CALENDAR_ICON, TRASH_ICON, CHECK_SQUARE_ICON } from '../../components/icons';
import Button from '../../components/common/Button';

interface ActivityItemProps {
    activity: ContactActivity;
    onDataChange: () => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity, onDataChange }) => {
    const { updateActivity, deleteActivity } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();
    const isTask = activity.type === 'TAREFA';

    const handleToggleComplete = async () => {
        if (!isTask) return;
        await updateActivity(activity.id, { is_completed: !activity.is_completed });
        onDataChange();
    };

    const handleDelete = async () => {
        showConfirmation(
            'Excluir Atividade',
            "Tem certeza que deseja excluir esta atividade?",
            async () => {
                try {
                    await deleteActivity(activity.id);
                    onDataChange();
                    addToast('Atividade excluída.', 'success');
                } catch (err: any) {
                    addToast(`Erro ao excluir atividade: ${err.message}`, 'error');
                }
            }
        );
    };
    
    const formatDate = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const isOverdue = isTask && !activity.is_completed && activity.due_date && new Date(activity.due_date) < new Date();

    return (
        <div className="p-3 bg-slate-900/50 rounded-lg flex items-start gap-3 group">
            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${isTask ? 'bg-indigo-500/20' : 'bg-amber-500/20'}`}>
                {isTask ? <CALENDAR_ICON className="w-4 h-4 text-indigo-400" /> : <NOTE_ICON className="w-4 h-4 text-amber-400" />}
            </div>
            <div className="flex-grow">
                <p className={`text-sm text-slate-200 ${activity.is_completed ? 'line-through text-slate-500' : ''}`}>
                    {activity.content}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span>Criado em {formatDate(activity.created_at)}</span>
                    {isTask && activity.due_date && (
                        <span className={`font-semibold ${isOverdue ? 'text-red-400' : ''}`}>
                            Vence em {formatDate(activity.due_date)}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isTask && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleToggleComplete} 
                        className={activity.is_completed ? 'text-green-400' : 'text-slate-400'}
                        title={activity.is_completed ? "Marcar como pendente" : "Marcar como concluída"}
                    >
                        <CHECK_SQUARE_ICON className="w-4 h-4" />
                    </Button>
                )}
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDelete} 
                    className="text-slate-400 hover:text-red-400"
                    title="Excluir"
                >
                    <TRASH_ICON className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default ActivityItem;