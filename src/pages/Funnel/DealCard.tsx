import React, { useMemo } from 'react';
import { DealWithContact, Deal } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/common/Button';
import { EDIT_ICON, TRASH_ICON } from '../../components/icons';

interface DealCardProps {
    deal: DealWithContact;
    onDragStart: (dealId: string) => void;
    isGhost?: boolean;
    onEdit: () => void;
    onDelete: () => void;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onDragStart, isGhost, onEdit, onDelete }) => {
    const { setCurrentPage } = useAuthStore();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        onDragStart(deal.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const navigateToContact = () => {
        if(deal.contacts?.id) {
            setCurrentPage('contact-details', { contactId: deal.contacts.id });
        }
    };
    
    const stagnantDays = useMemo(() => {
        if (deal.status !== 'Aberto') return 0;
        const updatedAt = new Date(deal.updated_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - updatedAt.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }, [deal.updated_at, deal.status]);

    const isStagnant = stagnantDays > 7;

    const statusStyles = {
        Aberto: 'border-sky-500',
        Ganho: 'border-green-500',
        Perdido: 'border-red-500',
    };
    const borderWidth = deal.status !== 'Aberto' ? 'border-l-8' : 'border-l-4';
    
    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className={`p-4 bg-slate-800 rounded-lg shadow-md ${borderWidth} ${statusStyles[deal.status]} cursor-grab active:cursor-grabbing transition-opacity duration-200 ${isGhost ? 'opacity-30' : 'opacity-100'} group relative`}
        >
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-slate-400 hover:text-white" title="Editar negócio">
                    <EDIT_ICON className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-400" title="Excluir negócio">
                    <TRASH_ICON className="w-4 h-4" />
                </Button>
            </div>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-white break-words pr-12">{deal.name}</h3>
                {isStagnant && (
                     <div className="flex-shrink-0 ml-2" title={`Negócio parado nesta etapa há ${stagnantDays} dias`}>
                        <span role="img" aria-label="Alerta de estagnação">⏰</span>
                    </div>
                )}
            </div>
            <p className="text-sm text-slate-400 mt-1 hover:text-sky-400 hover:underline cursor-pointer" onClick={navigateToContact}>
                {deal.contacts?.name || 'Contato não encontrado'}
            </p>
            <p className="text-sm font-mono text-green-400 mt-2">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}
            </p>
        </div>
    );
};

export default DealCard;