
import React, { useContext } from 'react';
import { DealWithContact } from '../../types';
import { AppContext } from '../../contexts/AppContext';

interface DealCardProps {
    deal: DealWithContact;
    onDragStart: (dealId: string) => void;
    isGhost?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onDragStart, isGhost }) => {
    const { setCurrentPage } = useContext(AppContext);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        onDragStart(deal.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const navigateToContact = () => {
        if(deal.contacts?.id) {
            setCurrentPage('contact-details', { contactId: deal.contacts.id });
        }
    };
    
    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className={`p-4 bg-slate-800 rounded-lg shadow-md border-l-4 border-sky-500 cursor-grab active:cursor-grabbing transition-opacity duration-200 ${isGhost ? 'opacity-30' : 'opacity-100'}`}
        >
            <h3 className="font-bold text-white break-words">{deal.name}</h3>
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
