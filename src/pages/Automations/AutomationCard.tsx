
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Automation } from '../../types';
import Card from '../../components/common/Card';
import Switch from '../../components/common/Switch';
import Button from '../../components/common/Button';
import { TRASH_ICON } from '../../components/icons';

interface AutomationCardProps {
    automation: Automation;
}

const AutomationCard: React.FC<AutomationCardProps> = ({ automation }) => {
    const { updateAutomation, deleteAutomation, setCurrentPage } = useContext(AppContext);

    const handleStatusChange = async (checked: boolean) => {
        await updateAutomation({ ...automation, status: checked ? 'active' : 'paused' });
    };

    const handleDelete = async () => {
        if (window.confirm(`Tem certeza que deseja excluir a automação "${automation.name}"?`)) {
            await deleteAutomation(automation.id);
        }
    };
    
    const handleEdit = () => {
        setCurrentPage('automation-editor', { automationId: automation.id });
    };

    const description = useMemo(() => {
        const triggerNode = automation.nodes.find(n => n.data.nodeType === 'trigger');
        const actionNodeCount = automation.nodes.filter(n => n.data.nodeType === 'action').length;
        
        if (!triggerNode) {
            return "Automação inválida sem gatilho.";
        }

        return `Inicia com "${triggerNode.data.label}" e contém ${actionNodeCount} ação(ões).`;
    }, [automation]);


    return (
        <Card className="flex flex-col justify-between hover:border-sky-500 border border-transparent transition-colors duration-200">
            <div>
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-semibold text-white break-words">{automation.name}</h3>
                    <Switch checked={automation.status === 'active'} onChange={handleStatusChange} />
                </div>
                 <p className="text-sm text-slate-400 mt-2">{description}</p>
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