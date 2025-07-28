import React, { useMemo } from 'react';
import { Automation } from '../../types';
import Card from '../../components/common/Card';
import Switch from '../../components/common/Switch';
import Button from '../../components/common/Button';
import { TRASH_ICON } from '../../components/icons';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

interface AutomationCardProps {
    automation: Automation;
}

const AutomationCard: React.FC<AutomationCardProps> = ({ automation }) => {
    const { updateAutomation, deleteAutomation, setCurrentPage } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();

    const handleStatusChange = async (checked: boolean) => {
        await updateAutomation({ ...automation, status: checked ? 'active' : 'paused' });
    };

    const handleDelete = async () => {
        showConfirmation(
            'Excluir Automação',
            `Tem certeza que deseja excluir a automação "${automation.name}"?`,
            async () => {
                try {
                    await deleteAutomation(automation.id);
                    addToast('Automação excluída com sucesso.', 'success');
                } catch (err: any) {
                    addToast(`Erro ao excluir automação: ${err.message}`, 'error');
                }
            }
        );
    };
    
    const handleEdit = () => {
        setCurrentPage('automation-editor', { automationId: automation.id });
    };

    const description = useMemo(() => {
        const nodes = Array.isArray(automation.nodes) ? automation.nodes : [];
        const triggerNode = nodes.find(n => n.data.nodeType === 'trigger');
        
        if (!triggerNode) return "Automação sem gatilho.";

        return `Inicia com "${triggerNode.data.label}" e tem ${nodes.length} etapa(s).`;

    }, [automation]);


    return (
        <Card className="flex flex-col justify-between hover:border-sky-500 border border-transparent transition-colors duration-200">
            <div>
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-semibold text-white break-words">{automation.name}</h3>
                    <Switch checked={automation.status === 'active'} onChange={handleStatusChange} />
                </div>
                 <p className="text-sm text-slate-400 mt-2 h-10">{description}</p>
            </div>
             <div className="mt-6 flex justify-end items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleEdit}>
                    Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 hover:bg-red-500/10 hover:text-red-300">
                    <TRASH_ICON className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    );
};

export default AutomationCard;