import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';

interface DealClosingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (reason: string) => void;
    status: 'Ganho' | 'Perdido';
}

const DealClosingModal: React.FC<DealClosingModalProps> = ({ isOpen, onClose, onSave, status }) => {
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReason(''); // Reset on open
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate a short delay for better UX, then save
        setTimeout(() => {
            onSave(reason);
            setIsLoading(false);
        }, 300);
    };

    const title = status === 'Ganho' ? 'Marcar Negócio como Ganho' : 'Marcar Negócio como Perdido';
    const label = status === 'Ganho' ? 'Motivo do Ganho (Opcional)' : 'Motivo da Perda (Opcional)';
    const placeholder = status === 'Ganho' ? 'Ex: Ótima negociação, cliente satisfeito...' : 'Ex: Preço muito alto, escolheu concorrente...';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="closing_reason" className="block text-sm font-medium text-slate-300 mb-1">
                        {label}
                    </label>
                    <textarea
                        id="closing_reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        placeholder={placeholder}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isLoading}>
                        Salvar e Mover
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default DealClosingModal;
