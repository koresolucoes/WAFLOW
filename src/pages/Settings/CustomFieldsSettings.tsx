import React, { useState, useContext } from 'react';
import { CustomFieldsContext } from '../../contexts/providers/CustomFieldsContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import AddCustomFieldModal from '../../components/common/AddCustomFieldModal';
import { PLUS_ICON, TRASH_ICON } from '../../components/icons';

const CustomFieldsSettings: React.FC = () => {
    const { definitions, deleteDefinition } = useContext(CustomFieldsContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const handleDelete = async (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este campo? Esta ação não pode ser desfeita.")) {
            try {
                await deleteDefinition(id);
            } catch (err: any) {
                alert(`Erro ao excluir: ${err.message}`);
            }
        }
    };

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Gerenciar Campos Personalizados</h2>
                        <p className="text-sm text-slate-400">Crie e gerencie campos de dados para seus contatos.</p>
                    </div>
                    <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                        <PLUS_ICON className="w-5 h-5 mr-2" />
                        Adicionar Campo
                    </Button>
                </div>
                
                <div className="bg-slate-900/50 rounded-lg">
                    {definitions.length > 0 ? (
                        <ul className="divide-y divide-slate-700/50">
                            {definitions.map(def => (
                                <li key={def.id} className="p-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-white">{def.name}</p>
                                        <p className="text-xs text-slate-400 font-mono">{def.key} - <span className="uppercase">{def.type}</span></p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(def.id)} className="text-red-400 hover:bg-red-500/10">
                                        <TRASH_ICON className="w-4 h-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-slate-400 p-6">Nenhum campo personalizado foi criado ainda.</p>
                    )}
                </div>
            </Card>

            <AddCustomFieldModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
};

export default CustomFieldsSettings;