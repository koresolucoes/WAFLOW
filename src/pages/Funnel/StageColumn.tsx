import React, { useState } from 'react';
import { PipelineStage, DealWithContact, Deal } from '../../types';
import DealCard from './DealCard';
import { useAuthStore } from '../../stores/authStore';
import { TRASH_ICON } from '../../components/icons';
import Button from '../../components/common/Button';
import { useUiStore } from '../../stores/uiStore';

interface StageColumnProps {
    stage: PipelineStage;
    deals: DealWithContact[];
    onDragStart: (dealId: string) => void;
    onDrop: (stageId: string) => void;
    draggedDealId: string | null;
    onEditDeal: (deal: DealWithContact) => void;
    onDeleteDeal: (deal: Deal) => void;
}

const StageColumn: React.FC<StageColumnProps> = ({ stage, deals, onDragStart, onDrop, draggedDealId, onEditDeal, onDeleteDeal }) => {
    const { updateStage, deleteStage } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(stage.name);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleNameBlur = () => {
        setIsEditing(false);
        if (name.trim() && name !== stage.name) {
            updateStage(stage.id, { name: name.trim() });
        } else {
            setName(stage.name);
        }
    };
    
    const handleDelete = () => {
        if (deals.length > 0) {
            addToast(`Não é possível excluir a etapa "${stage.name}" porque ela contém ${deals.length} negócio(s). Mova-os primeiro.`, 'warning');
            return;
        }
        showConfirmation(
            'Excluir Etapa',
            `Tem certeza de que deseja excluir a etapa "${stage.name}"?`,
            async () => {
                try {
                    await deleteStage(stage.id);
                    addToast('Etapa excluída com sucesso.', 'success');
                } catch (err: any) {
                    addToast(`Erro ao excluir etapa: ${err.message}`, 'error');
                }
            }
        );
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(stage.id);
    };

    const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    
    const stageTypeStyles = {
        'Intermediária': 'border-slate-500',
        'Ganho': 'border-green-500',
        'Perdido': 'border-red-500',
    };

    return (
        <div
            className={`w-80 flex-shrink-0 h-full flex flex-col bg-slate-800/50 rounded-xl transition-colors duration-300 ${isDragOver ? 'bg-slate-700/80' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`p-4 border-b-4 ${stageTypeStyles[stage.type]} flex-shrink-0 group`}>
                <div className="flex justify-between items-center">
                    {isEditing ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                            autoFocus
                            className="bg-slate-700 text-white font-bold p-1 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    ) : (
                        <h2 onClick={() => setIsEditing(true)} className="font-bold text-white truncate cursor-pointer" title="Clique para editar">{stage.name}</h2>
                    )}
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleDelete} 
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        title="Excluir etapa"
                    >
                        <TRASH_ICON className="w-4 h-4" />
                    </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                    {deals.length} negócios • {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                </p>
            </div>
            <div className="p-2 flex-grow overflow-y-auto space-y-3">
                {deals.map(deal => (
                    <DealCard 
                        key={deal.id} 
                        deal={deal} 
                        onDragStart={onDragStart}
                        isGhost={draggedDealId === deal.id}
                        onEdit={() => onEditDeal(deal)}
                        onDelete={() => onDeleteDeal(deal)}
                    />
                ))}
            </div>
        </div>
    );
};

export default StageColumn;