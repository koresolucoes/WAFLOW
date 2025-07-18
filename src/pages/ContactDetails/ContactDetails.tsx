
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Contact, DealInsert } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Modal from '../../components/common/Modal';
import { ARROW_LEFT_ICON, PLUS_ICON } from '../../components/icons';
import DealFormModal from '../../components/common/DealFormModal';

const ContactDetails: React.FC = () => {
    const { pageParams, setCurrentPage, contactDetails, fetchContactDetails, updateContact, addDeal, pipelines, stages } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [localContact, setLocalContact] = useState<Contact | null>(null);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        const loadDetails = async () => {
            if (pageParams.contactId) {
                setIsLoading(true);
                try {
                    await fetchContactDetails(pageParams.contactId);
                } catch (error) {
                    console.error("Failed to load contact details:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadDetails();
    }, [pageParams.contactId, fetchContactDetails]);

    useEffect(() => {
        if (contactDetails) {
            setLocalContact(contactDetails);
        }
    }, [contactDetails]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalContact(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if ((e.key === 'Enter' || e.key === ',') && localContact) {
            e.preventDefault();
            const newTag = tagInput.trim().toLowerCase();
            if (newTag && !localContact.tags?.includes(newTag)) {
                setLocalContact({ ...localContact, tags: [...(localContact.tags || []), newTag].sort() });
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        if (localContact) {
            setLocalContact({ ...localContact, tags: localContact.tags?.filter(t => t !== tagToRemove) || [] });
        }
    };

    const handleSave = async () => {
        if (!localContact) return;
        setIsSaving(true);
        try {
            await updateContact(localContact);
        } catch (err: any) {
            alert(`Erro ao salvar: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDeal = async (deal: Omit<DealInsert, 'user_id' | 'contact_id' >) => {
        if (!contactDetails || !user) return;
        
        try {
             await addDeal({
                ...deal,
                user_id: user.id,
                contact_id: contactDetails.id,
            });
            setIsDealModalOpen(false);
            // Re-fetch details to show the new deal
            await fetchContactDetails(contactDetails.id);
        } catch(err: any) {
            alert(`Erro ao criar negócio: ${err.message}`)
        }
    }
    
    const { user } = useContext(AppContext);

    if (isLoading) return <div className="text-center text-white">Carregando detalhes do contato...</div>;
    if (!contactDetails || !localContact) return <div className="text-center text-white">Contato não encontrado.</div>;

    const defaultPipeline = pipelines[0];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                     <Button variant="secondary" size="sm" onClick={() => setCurrentPage('contacts')}>
                        <ARROW_LEFT_ICON className="w-5 h-5"/>
                    </Button>
                    <h1 className="text-3xl font-bold text-white truncate">{contactDetails.name}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="primary" onClick={handleSave} isLoading={isSaving}>Salvar Alterações</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Coluna de Informações */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <h2 className="text-lg font-semibold text-white mb-4">Informações</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                                <input id="name" name="name" value={localContact.name} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md" />
                            </div>
                             <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-slate-400 mb-1">Telefone</label>
                                <input id="phone" name="phone" value={localContact.phone} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md" />
                            </div>
                             <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                                <input id="email" name="email" value={localContact.email || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="company" className="block text-sm font-medium text-slate-400 mb-1">Empresa</label>
                                <input id="company" name="company" value={localContact.company || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md" />
                            </div>
                        </div>
                    </Card>
                     <Card>
                        <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
                        <div className="flex flex-wrap items-center w-full bg-slate-900/50 border border-slate-700 rounded-md p-2">
                            {localContact.tags?.map(tag => (
                                <span key={tag} className="flex items-center mr-2 mb-1 px-2 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-sky-200 hover:text-white">&times;</button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleTagInputKeyDown}
                                placeholder="Adicionar tag..."
                                className="bg-transparent flex-1 text-white placeholder-slate-400 focus:outline-none min-w-[100px]"
                            />
                        </div>
                    </Card>
                </div>

                {/* Coluna de Atividades e Negócios */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                         <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-white">Negócios</h2>
                            <Button variant="secondary" size="sm" onClick={() => setIsDealModalOpen(true)}>
                                <PLUS_ICON className="w-4 h-4 mr-2" />
                                Novo Negócio
                            </Button>
                        </div>
                        {contactDetails.deals.length > 0 ? (
                            <ul className="space-y-2">
                                {contactDetails.deals.map(deal => {
                                    const stage = stages.find(s => s.id === deal.stage_id);
                                    return (
                                        <li key={deal.id} className="p-3 bg-slate-900/50 rounded-md flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-white">{deal.name}</p>
                                                <p className="text-sm text-slate-400">
                                                    Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}
                                                </p>
                                            </div>
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-400">{stage?.name || 'Etapa desconhecida'}</span>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <p className="text-slate-400 text-center py-4">Nenhum negócio associado a este contato.</p>
                        )}
                    </Card>
                </div>
            </div>
             {defaultPipeline && (
                <DealFormModal
                    isOpen={isDealModalOpen}
                    onClose={() => setIsDealModalOpen(false)}
                    onSave={handleSaveDeal}
                    pipeline={defaultPipeline}
                    stages={stages.filter(s => s.pipeline_id === defaultPipeline.id)}
                    contactName={contactDetails.name}
                />
            )}
        </div>
    );
};

export default ContactDetails;
