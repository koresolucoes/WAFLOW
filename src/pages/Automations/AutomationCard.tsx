
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
    const { updateAutomation, deleteAutomation, setCurrentPage, templates } = useContext(AppContext);

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
        const triggerDesc = () => {
            switch (automation.trigger_type) {
                case 'new_contact_with_tag':
                    return `Quando um contato recebe a tag "${(automation.trigger_config as any).tag}"`;
                case 'message_received_with_keyword':
                    return `Quando uma mensagem contém a palavra-chave "${(automation.trigger_config as any).keyword}"`;
                default:
                    return "Gatilho desconhecido";
            }
        };

        const actionDesc = () => {
            switch (automation.action_type) {
                case 'add_tag':
                    return `adicionar a tag "${(automation.action_config as any).tag}"`;
                case 'send_template':
                    const templateId = (automation.action_config as any).template_id;
                    const template = templates.find(t => t.id === templateId);
                    return `enviar o template "${template?.template_name || 'Desconhecido'}"`;
                default:
                    return "ação desconhecida";
            }
        };

        return `${triggerDesc()}, então ${actionDesc()}.`;
    }, [automation, templates]);


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
