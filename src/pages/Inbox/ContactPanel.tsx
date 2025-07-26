import React, { useContext, useState, useEffect } from 'react';
import { Contact, DealInsert } from '../../types';
import { ContactsContext } from '../../contexts/providers/ContactsContext';
import { FunnelContext } from '../../contexts/providers/FunnelContext';
import { CustomFieldsContext } from '../../contexts/providers/CustomFieldsContext';
import { NavigationContext } from '../../contexts/providers/NavigationContext';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import DealFormModal from '../../components/common/DealFormModal';
import { PLUS_ICON, X_ICON } from '../../components/icons';

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
    const { contacts, updateContact } = useContext(ContactsContext);
    const { deals, addDeal, pipelines, stages } = useContext(FunnelContext);
    const { definitions } = useContext(CustomFieldsContext);
    const { setCurrentPage } = useContext(NavigationContext);
    const user = useAuthStore(state => state.user);

    const [localContact, setLocalContact] = useState<Contact | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);

    const contact = contacts.find(c => c.id === contactId);
    
    useEffect(() => {
        setLocalContact(contact || null);
    }, [contact]);
    
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

    const handleSaveDeal = async (dealData: Omit<DealInsert, 'user_id' | 'contact_id' >) => {
         if (!user) return;
        try {
            await addDeal({ ...dealData, user_id: user.id, contact_id: contactId });
            setIsDealModalOpen(false);
        } catch(err: any) {
            alert(`Erro ao criar negócio: ${err.message}`)
        }
    };

    const hasChanges = JSON.stringify(contact) !== JSON.stringify(localContact);
    
    return (
        <>
        <aside className="w-96 flex-shrink-0 bg-slate-800 border-l border-slate-700/50 flex flex-col p-4 overflow-y-auto">
            <div className="text-center mb-4">
                 <img
                    className="h-20 w-20 rounded-full object-cover mx-auto"
                    src={`https://api.dicebear.com/8.x/initials/svg?seed=${contact.name}`}
                    alt="Avatar"
                />
                <h2 className="text-xl font-bold text-white mt-3">{contact.name}</h2>
                <Button variant="ghost" size="sm" className="mt-2 text-sky-400" onClick={() => setCurrentPage('contact-details', { contactId })}>
                    Ver Detalhes Completos
                </Button>
            </div>
            
            <div className="space-y-4">
                <Card className="bg-slate-900/50">
                    <h3 className="text-base font-semibold text-white mb-3">Informações</h3>
                    <div className="space-y-3">
                        <InfoRow label="Telefone" value={contact.phone} />
                        <InfoRow label="Email" value={contact.email} />
                        <InfoRow label="Empresa" value={contact.company} />
                    </div>
                </Card>

                 {definitions.length > 0 && (
                    <Card className="bg-slate-900/50">
                        <h3 className="text-base font-semibold text-white mb-3">Informações Adicionais</h3>
                        <div className="space-y-3">
                            {definitions.map(def => {
                                const value = (contact.custom_fields as any)?.[def.key];
                                return <InfoRow key={def.id} label={def.name} value={value} />;
                            })}
                        </div>
                    </Card>
                )}

                <Card className="bg-slate-900/50">
                    <h3 className="text-base font-semibold text-white mb-3">Tags</h3>
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
                        className="w-full mt-2 bg-slate-700 border border-slate-600 rounded-md p-1.5 text-sm text-white"
                    />
                </Card>

                <Card className="bg-slate-900/50">
                     <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-semibold text-white">Negócios</h3>
                         <Button variant="secondary" size="sm" onClick={() => setIsDealModalOpen(true)} disabled={!defaultPipeline} title={!defaultPipeline ? "Crie um funil de vendas na página 'Funil' para poder adicionar negócios." : "Adicionar Novo Negócio"}>
                            <PLUS_ICON className="w-4 h-4 mr-1" /> Novo
                        </Button>
                    </div>
                     {contactDeals.length > 0 ? (
                        <ul className="space-y-2">
                           {contactDeals.map(deal => {
                                const stage = stages.find(s => s.id === deal.stage_id);
                                return (
                                     <li key={deal.id} className="p-2 bg-slate-800 rounded-md">
                                        <p className="font-semibold text-white text-sm truncate">{deal.name}</p>
                                        <div className="flex justify-between items-center text-xs mt-1">
                                            <span className="font-mono text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}</span>
                                            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{stage?.name || '-'}</span>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-2">Nenhum negócio.</p>
                    )}
                </Card>
            </div>
            
            {hasChanges && (
                 <div className="mt-auto pt-4 sticky bottom-0 bg-slate-800">
                    <Button variant="primary" className="w-full" onClick={handleSaveChanges} isLoading={isSaving}>
                        Salvar Alterações
                    </Button>
                </div>
            )}
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
        </>
    );
};

export default ContactPanel;