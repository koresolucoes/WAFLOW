import React, { useState, useContext } from 'react';
import { PipelineStage, DealWithContact } from '../../types';
import DealCard from './DealCard';

interface StageColumnProps {
    stage: PipelineStage;
    deals: DealWithContact[];
    onDragStart: (dealId: string) => void;
    onDrop: (stageId: string) => void;
    draggedDealId: string | null;
}

const StageColumn: React.FC<StageColumnProps> = ({ stage, deals, onDragStart, onDrop, draggedDealId }) => {
    const [isDragOver, setIsDragOver] = useState(false);

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
            <div className={`p-4 border-b-2 ${stageTypeStyles[stage.type]} flex-shrink-0`}>
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-white truncate">{stage.name}</h2>
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
                    />
                ))}
            </div>
        </div>
    );
};

export default StageColumn;
