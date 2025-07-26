import React, { useContext, useMemo } from 'react';
import { DealWithContact } from '../../types';
import { NavigationContext } from '../../contexts/providers/NavigationContext';

interface DealCardProps {
    deal: DealWithContact;
    onDragStart: (dealId: string) => void;
    isGhost?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onDragStart, isGhost }) => {
    const { setCurrentPage } = useContext(NavigationContext);

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
            className={`p-4 bg-slate-800 rounded-lg shadow-md ${borderWidth} ${statusStyles[deal.status]} cursor-grab active:cursor-grabbing transition-opacity duration-200 ${isGhost ? 'opacity-30' : 'opacity-100'}`}
        >
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-white break-words">{deal.name}</h3>
                {isStagnant && (
                     <div className="flex-shrink-0 ml-2" title={`Negócio parado nesta etapa há ${stagnantDays} dias`}>
                        <span role="img" aria-label="Alerta de estagnação">⏰</span>
                    </div>
                )}
            </div>
            <p className="text-sm text-slate-400 mt-1 hover:text-sky-400 hover:underline" onClick={navigateToContact}>
                {deal.contacts?.name || 'Contato não encontrado'}
            </p>
            <p className="text-sm font-mono text-green-400 mt-2">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}
            </p>
        </div>
    );
};

export default DealCard;
