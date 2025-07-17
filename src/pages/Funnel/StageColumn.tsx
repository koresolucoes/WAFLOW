
import React, { useState, useContext, useRef, useEffect } from 'react';
import { PipelineStage, DealWithContact } from '../../types';
import DealCard from './DealCard';
import { AppContext } from '../../contexts/AppContext';
import { TRASH_ICON } from '../../components/icons';

interface StageColumnProps {
    stage: PipelineStage;
    deals: DealWithContact[];
    onDragStart: (dealId: string) => void;
    onDrop: (stageId: string) => void;
    draggedDealId: string | null;
}

const StageColumn: React.FC<StageColumnProps> = ({ stage, deals, onDragStart, onDrop, draggedDealId }) => {
    const { updateStage, deleteStage } = useContext(AppContext);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [stageName, setStageName] = useState(stage.name);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
    
    const handleNameUpdate = () => {
        if (stageName.trim() && stageName !== stage.name) {
            updateStage(stage.id, stageName.trim());
        } else {
            setStageName(stage.name); // Revert if empty or unchanged
        }
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (deals.length > 0) {
            alert("Não é possível excluir uma etapa que contém negócios.");
            return;
        }
        if (window.confirm(`Tem certeza que deseja excluir a etapa "${stage.name}"?`)) {
            deleteStage(stage.id);
        }
        setIsMenuOpen(false);
    };


    const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

    return (
        <div
            className={`w-80 flex-shrink-0 h-full flex flex-col bg-slate-800/50 rounded-xl transition-colors duration-300 ${isDragOver ? 'bg-slate-700/80' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
                <div className="flex justify-between items-center">
                    {isEditing ? (
                        <input
                            type="text"
                            value={stageName}
                            onChange={(e) => setStageName(e.target.value)}
                            onBlur={handleNameUpdate}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
                            autoFocus
                            className="bg-slate-700 text-white font-bold p-1 rounded-md w-full"
                        />
                    ) : (
                        <h2 className="font-bold text-white truncate cursor-pointer" onClick={() => setIsEditing(true)}>
                            {stage.name}
                        </h2>
                    )}
                    
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 text-slate-400 hover:text-white rounded-full">•••</button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-10">
                                <button
                                    onClick={handleDelete}
                                    disabled={deals.length > 0}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <TRASH_ICON className="w-4 h-4 mr-2 inline" /> Excluir Etapa
                                </button>
                            </div>
                        )}
                    </div>
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