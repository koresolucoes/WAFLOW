import React, { useState, useEffect } from 'react';
import { Contact, DealInsert } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import DealFormModal from '../../components/common/DealFormModal';
import AddCustomFieldModal from '../../components/common/AddCustomFieldModal';
import { PLUS_ICON, X_ICON } from '../../components/icons';
import ActivityItem from '../ContactDetails/ActivityItem';

const InfoRow: React.FC<{ label: string, value: string | null | undefined }> = ({ label, value }) => (
    <div>
        <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</h4>
        <p className="text-sm text-white truncate">{value || '-'}</p>
    </div>
);

const Tag: React.FC<{ children: React.ReactNode, onRemove: () => void }> = ({ children, onRemove }) => (
    <span className="flex items-center mr-2 mb-2 px-2 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300">
        {children}
        <button type="button" onClick={onRemove} className="ml-1.5 p-0.5 rounded-full text-sky-200 hover:bg-black/20">
            <X_ICON className="w-3 h-3" />
        </button>
    </span>
);

const ContactPanel: React.FC<{ contactId: string }> = ({ contactId }) => {
    const { 
        contacts, 
        updateContact,
        deals, 
        addDeal, 
        pipelines, 
        stages,
        definitions,
        setCurrentPage,
        activitiesForContact, 
        fetchActivitiesForContact, 
        activityLoading,
        user,
        activeTeam,
        conversations,
        allTeamMembers,
        assignConversation
    } = useAuthStore();

    const [localContact, setLocalContact] = useState<Contact | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);

    const contact = contacts.find(c => c.id === contactId);
    const conversation = conversations.find(c => c.contact.id === contactId);
    
    useEffect(() => {
        setLocalContact(contact || null);
    }, [contact]);
    
    useEffect(() => {
        if (contactId) {
            fetchActivitiesForContact(contactId);
        }
    }, [contactId, fetchActivitiesForContact]);


    const contactDeals = deals.filter(d => d.contact_id === contactId);
    const defaultPipeline = pipelines[0];

    if (!contact || !localContact) {
        return <aside className="w-96 flex-shrink-0 bg-slate-800 border-l border-slate-700/50" />;
    }

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

    const handleSaveChanges = async () => {
        if (!localContact) return;
        setIsSaving(true);
        try {
            await updateContact(localContact);
        } catch (error: any) {
            alert(`Falha ao salvar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDeal = async (dealData: Omit<DealInsert, 'team_id' | 'contact_id' >) => {
         if (!user || !activeTeam) return;
        try {
            await addDeal({ ...dealData, contact_id: contactId });
            setIsDealModalOpen(false);
        } catch(err: any) {
            alert(`Erro ao criar negócio: ${err.message}`)
        }
    };

    const handleAssigneeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const assigneeId = e.target.value === 'null' ? null : e.target.value;
        try {
            await assignConversation(contactId, assigneeId);
        } catch (error) {
            alert(`Falha ao atribuir a conversa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    };

    const hasChanges = JSON.stringify(contact) !== JSON.stringify(localContact);
    
    const handleActivityDataChange = () => {
        fetchActivitiesForContact(contactId);
    };

    return (
        <>
            <aside className="w-96 flex-shrink-0 bg-slate-800 border-l border-slate-700/50 flex flex-col p-4 overflow-y-auto">
                <div className="text-center mb-4">
                    <img
                        className="h-20 w-20 rounded-full object-cover mx-auto"
                        src={`https://api.dicebear.com/8.x/initials/svg?seed=${contact.name}`}
                        alt="Avatar"
                    />
                    <h3 className="text-xl font-bold text-white mt-2">{contact.name}</h3>
                    <Button variant="ghost" size="sm" className="mt-1" onClick={() => setCurrentPage('contact-details', { contactId })}>
                        Ver Perfil Completo
                    </Button>
                </div>

                <div className="space-y-4">
                    <InfoRow label="Telefone" value={contact.phone} />
                    <InfoRow label="Email" value={contact.email} />
                    <div>
                        <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Atribuído a</h4>
                        <select
                            value={conversation?.assignee_id || 'null'}
                            onChange={handleAssigneeChange}
                            className="w-full bg-slate-700 p-2 rounded-md text-sm"
                        >
                            <option value="null">Ninguém</option>
                            {allTeamMembers.map(member => (
                                <option key={member.user_id} value={member.user_id}>{member.email}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/50">
                     <h3 className="text-md font-semibold text-white mb-2">Tags</h3>
                     <div className="flex flex-wrap items-center">
                        {localContact.tags?.map(tag => (
                            <Tag key={tag} onRemove={() => removeTag(tag)}>{tag}</Tag>
                        ))}
                     </div>
                     <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagInputKeyDown}
                        placeholder="Adicionar tag..."
                        className="w-full bg-slate-700 p-2 mt-2 rounded-md text-sm"
                    />
                </div>

                {hasChanges && (
                    <div className="mt-auto pt-4">
                        <Button variant="primary" className="w-full" onClick={handleSaveChanges} isLoading={isSaving}>
                            Salvar Alterações
                        </Button>
                    </div>
                )}
                 
                 {/* Deals section in Panel */}
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-md font-semibold text-white">Negócios</h3>
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => setIsDealModalOpen(true)}
                            disabled={!defaultPipeline}
                            title={!defaultPipeline ? "Crie um funil de vendas para adicionar negócios." : "Novo Negócio"}
                        >
                            <PLUS_ICON className="w-4 h-4" />
                        </Button>
                    </div>
                     <div className="space-y-2">
                        {contactDeals.length > 0 ? (
                            contactDeals.map(deal => {
                                const stage = stages.find(s => s.id === deal.stage_id);
                                return (
                                    <div key={deal.id} className="p-2 bg-slate-700/50 rounded-md text-sm">
                                        <p className="font-semibold text-white truncate">{deal.name}</p>
                                        <div className="flex justify-between items-center text-xs mt-1">
                                            <span className="font-mono text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{stage?.name || '-'}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-xs text-slate-500 py-2">Nenhum negócio.</p>
                        )}
                    </div>
                </div>

                {/* Activities in Panel */}
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <h3 className="text-md font-semibold text-white mb-2">Atividades Recentes</h3>
                     <div className="space-y-3 max-h-60 overflow-y-auto">
                        {activityLoading ? <p className="text-xs text-slate-400">Carregando...</p> : 
                            activitiesForContact.length > 0 ? (
                                activitiesForContact.slice(0, 5).map(activity => (
                                    <ActivityItem key={activity.id} activity={activity} onDataChange={handleActivityDataChange} />
                                ))
                            ) : (
                                <p className="text-center text-xs text-slate-500 py-2">Nenhuma atividade.</p>
                            )
                        }
                     </div>
                </div>
                
            </aside>
            {defaultPipeline && (
                <DealFormModal
                    isOpen={isDealModalOpen}
                    onClose={() => setIsDealModalOpen(false)}
                    onSave={handleSaveDeal}
                    pipeline={defaultPipeline}
                    stages={stages.filter(s => s.pipeline_id === defaultPipeline.id)}
                    contactName={contact.name}
                />
            )}
             <AddCustomFieldModal
                isOpen={isCustomFieldModalOpen}
                onClose={() => setIsCustomFieldModalOpen(false)}
            />
        </>
    );
};

export default ContactPanel;
