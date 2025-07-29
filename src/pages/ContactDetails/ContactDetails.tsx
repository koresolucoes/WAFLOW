import React, { useEffect, useState } from 'react';
import { Contact, DealInsert, Json, TimelineEvent } from '../../types';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { ARROW_LEFT_ICON, PLUS_ICON } from '../../components/icons';
import AddCustomFieldModal from '../../components/common/AddCustomFieldModal';
import Activities from './Activities';
import { useAuthStore } from '../../stores/authStore';
import { fetchContactTimeline } from '../../services/contactService';
import DealFormModal from '../../components/common/DealFormModal';
import { useUiStore } from '../../stores/uiStore';

const ContactDetails: React.FC = () => {
    const { 
        pageParams, 
        setCurrentPage,
        contactDetails, 
        fetchContactDetails, 
        updateContact,
        definitions,
        deals, 
        addDeal, 
        pipelines, 
        stages,
        user,
        activeTeam
    } = useAuthStore();
    const addToast = useUiStore(state => state.addToast);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [localContact, setLocalContact] = useState<Contact | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [isTimelineLoading, setIsTimelineLoading] = useState(true);

    const loadData = async () => {
        if (pageParams.contactId && activeTeam) {
            setIsTimelineLoading(true);
            try {
                const timelineData = await fetchContactTimeline(activeTeam.id, pageParams.contactId);
                setTimelineEvents(timelineData);
            } catch (error) {
                console.error("Failed to load timeline:", error);
            } finally {
                setIsTimelineLoading(false);
            }
        }
    };
    
    useEffect(() => {
        const loadDetails = async () => {
            if (pageParams.contactId) {
                setIsLoading(true);
                try {
                    await fetchContactDetails(pageParams.contactId);
                    await loadData(); // Load timeline and activities
                } catch (error) {
                    console.error("Failed to load contact details:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadDetails();
    }, [pageParams.contactId, fetchContactDetails, activeTeam]);

    useEffect(() => {
        if (contactDetails) {
            setLocalContact(contactDetails);
        }
    }, [contactDetails]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalContact(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleCustomFieldChange = (key: string, value: string | number) => {
        setLocalContact(prev => {
            if (!prev) return null;
            const newCustomFields: Json = {
                ...(prev.custom_fields as object || {}),
                [key]: value
            };
            return { ...prev, custom_fields: newCustomFields };
        });
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
            addToast('Contato salvo com sucesso!', 'success');
        } catch (err: any) {
            addToast(`Erro ao salvar: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDeal = async (dealData: Omit<DealInsert, 'team_id' | 'contact_id' >) => {
        if (!user || !pageParams.contactId) return;
        try {
            await addDeal({ ...dealData, contact_id: pageParams.contactId });
            setIsDealModalOpen(false);
            addToast('Negócio criado com sucesso!', 'success');
        } catch (err: any) {
            addToast(`Erro ao criar negócio: ${err.message}`, 'error');
        }
    };

    if (isLoading) return <div className="text-center text-gray-800 dark:text-white">Carregando detalhes do contato...</div>;
    if (!contactDetails || !localContact) return <div className="text-center text-gray-800 dark:text-white">Contato não encontrado.</div>;

    const contactDeals = deals.filter(d => d.contact_id === contactDetails.id);
    const defaultPipeline = pipelines[0];

    const baseInputClass = "w-full bg-gray-100 dark:bg-slate-700 p-2 rounded-md text-gray-900 dark:text-white border border-gray-200 dark:border-slate-600";

    return (
        <>
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" size="sm" onClick={() => setCurrentPage('contacts')}>
                            <ARROW_LEFT_ICON className="w-5 h-5"/>
                        </Button>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white truncate">{contactDetails.name}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="primary" onClick={handleSave} isLoading={isSaving}>Salvar Alterações</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Coluna de Informações */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Nome</label>
                                    <input id="name" name="name" value={localContact.name} onChange={handleChange} className={baseInputClass} />
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Telefone</label>
                                    <input id="phone" name="phone" value={localContact.phone} onChange={handleChange} className={baseInputClass} />
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Email</label>
                                    <input id="email" name="email" value={localContact.email || ''} onChange={handleChange} className={baseInputClass} />
                                </div>
                                <div>
                                    <label htmlFor="company" className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Empresa</label>
                                    <input id="company" name="company" value={localContact.company || ''} onChange={handleChange} className={baseInputClass} />
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h2>
                            <div className="flex flex-wrap items-center w-full bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-md p-2">
                                {localContact.tags?.map(tag => (
                                    <span key={tag} className="flex items-center mr-2 mb-1 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-sky-500/20 dark:text-sky-300">
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-blue-700 dark:text-sky-200 hover:text-blue-900 dark:hover:text-white">&times;</button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    placeholder="Adicionar tag..."
                                    className="bg-transparent flex-1 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none min-w-[100px]"
                                />
                            </div>
                        </Card>
                        <Card>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Adicionais</h2>
                                <Button variant="ghost" size="sm" onClick={() => setIsCustomFieldModalOpen(true)}>
                                    <PLUS_ICON className="w-4 h-4 mr-1"/> Novo Campo
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {definitions.length > 0 ? definitions.map(def => {
                                    const customFields = (localContact.custom_fields || {}) as { [key: string]: any };
                                    const value = customFields[def.key] ?? '';
                                    
                                    const renderInput = () => {
                                        switch (def.type) {
                                            case 'NUMERO':
                                                return <input type="number" value={value} onChange={e => handleCustomFieldChange(def.key, e.target.valueAsNumber || 0)} className={baseInputClass} />;
                                            case 'DATA':
                                                const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
                                                return <input type="date" value={dateValue} onChange={e => handleCustomFieldChange(def.key, e.target.value)} className={baseInputClass} />;
                                            case 'LISTA':
                                                return (
                                                    <select value={value} onChange={e => handleCustomFieldChange(def.key, e.target.value)} className={baseInputClass}>
                                                        <option value="">Selecione...</option>
                                                        {def.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                );
                                            case 'TEXTO':
                                            default:
                                                return <input type="text" value={value} onChange={e => handleCustomFieldChange(def.key, e.target.value)} className={baseInputClass} />;
                                        }
                                    };
                                    
                                    return (
                                        <div key={def.id}>
                                            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">{def.name}</label>
                                            {renderInput()}
                                        </div>
                                    );
                                }) : <p className="text-sm text-center text-gray-500 dark:text-slate-400 py-4">Nenhum campo adicional criado.</p>}
                            </div>
                        </Card>
                    </div>

                    {/* Coluna de Atividades e Negócios */}
                    <div className="lg:col-span-2 space-y-6">
                        <Activities contactId={pageParams.contactId} onDataChange={loadData} />
                        <Card>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Negócios</h2>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsDealModalOpen(true)}
                                    disabled={!defaultPipeline}
                                    title={!defaultPipeline ? "Crie um funil de vendas na página 'Funil' para poder adicionar negócios." : "Adicionar Novo Negócio"}
                                >
                                    <PLUS_ICON className="w-4 h-4 mr-1" /> Novo Negócio
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {contactDeals.length > 0 ? (
                                    contactDeals.map(deal => {
                                        const stage = stages.find(s => s.id === deal.stage_id);
                                        return (
                                            <div key={deal.id} className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                                                <p className="font-semibold text-gray-900 dark:text-white truncate">{deal.name}</p>
                                                <div className="flex justify-between items-center text-sm mt-1">
                                                    <span className="font-mono text-green-600 dark:text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}</span>
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300">{stage?.name || '-'}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-center text-gray-500 dark:text-slate-400 py-4">Nenhum negócio associado a este contato.</p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
            
            <AddCustomFieldModal
                isOpen={isCustomFieldModalOpen}
                onClose={() => setIsCustomFieldModalOpen(false)}
            />

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
        </>
    );
};

export default ContactDetails;