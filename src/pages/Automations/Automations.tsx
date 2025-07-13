
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { PLUS_ICON, AUTOMATION_ICON } from '../../components/icons';
import AutomationCard from './AutomationCard';

const Automations: React.FC = () => {
    const { automations, setCurrentPage } = useContext(AppContext);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Automações</h1>
                <Button variant="primary" onClick={() => setCurrentPage('automation-editor')}>
                    <PLUS_ICON className="w-5 h-5 mr-2" />
                    Criar Automação
                </Button>
            </div>
      
            {automations.length === 0 ? (
                <Card className="text-center py-12">
                    <AUTOMATION_ICON className="w-12 h-12 mx-auto text-slate-500" />
                    <h2 className="text-xl font-semibold text-white mt-4">Nenhuma automação criada ainda.</h2>
                    <p className="text-slate-400 mt-2 mb-6">Automatize suas tarefas repetitivas criando seu primeiro fluxo de trabalho.</p>
                    <Button variant="primary" onClick={() => setCurrentPage('automation-editor')}>
                        Criar Primeira Automação
                    </Button>
                </Card>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {automations.map(automation => (
                        <AutomationCard
                            key={automation.id}
                            automation={automation}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Automations;
