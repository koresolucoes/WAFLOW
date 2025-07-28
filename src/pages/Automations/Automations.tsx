import React, { useState, useMemo } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { PLUS_ICON, AUTOMATION_ICON, SEARCH_ICON } from '../../components/icons';
import AutomationCard from './AutomationCard';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

const Automations: React.FC = () => {
    const { automations, createAndNavigateToAutomation } = useAuthStore();
    const addToast = useUiStore(state => state.addToast);
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAutomations = useMemo(() => {
        if (!searchTerm) return automations;
        const lowercasedTerm = searchTerm.toLowerCase();
        return automations.filter(automation =>
            automation.name.toLowerCase().includes(lowercasedTerm)
        );
    }, [automations, searchTerm]);

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            await createAndNavigateToAutomation();
        } catch (error: any) {
            console.error("Falha ao criar automação:", error);
            addToast(`Não foi possível criar a automação: ${error.message}`, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h1 className="text-3xl font-bold text-white">Automações</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <SEARCH_ICON className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar automações..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                    </div>
                    <Button variant="primary" onClick={handleCreate} isLoading={isCreating}>
                        <PLUS_ICON className="w-5 h-5 mr-2" />
                        Criar Automação
                    </Button>
                </div>
            </div>
      
            {filteredAutomations.length === 0 ? (
                <Card className="text-center py-12">
                    <AUTOMATION_ICON className="w-12 h-12 mx-auto text-slate-500" />
                    <h2 className="text-xl font-semibold text-white mt-4">{searchTerm ? 'Nenhuma automação encontrada.' : 'Nenhuma automação criada ainda.'}</h2>
                    <p className="text-slate-400 mt-2 mb-6">{searchTerm ? `Sua busca por "${searchTerm}" não retornou resultados.` : 'Automatize suas tarefas repetitivas criando seu primeiro fluxo de trabalho.'}</p>
                    <Button variant="primary" onClick={handleCreate} isLoading={isCreating}>
                        Criar Primeira Automação
                    </Button>
                </Card>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAutomations.map(automation => (
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