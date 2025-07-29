import React, { useState, useRef, useMemo } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ContactForm from './ContactForm';
import { Contact, EditableContact } from '../../types';
import { PLUS_ICON, TRASH_ICON, CONTACTS_ICON, UPLOAD_ICON, SEND_ICON, SEARCH_ICON } from '../../components/icons';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import DirectMessageModal from './DirectMessageModal';
import InfoCard from '../../components/common/InfoCard';

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="mr-2 mb-2 inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-sky-500/20 dark:text-sky-400">
        {children}
    </span>
);

const ContactRow: React.FC<{ contact: Contact; onViewDetails: () => void; onDelete: () => void; }> = ({ contact, onViewDetails, onDelete }) => {
    return (
        <tr className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={onViewDetails}>
            <td className="p-4 font-medium text-gray-900 dark:text-white">{contact.name}</td>
            <td className="p-4 text-gray-600 dark:text-slate-300 font-mono">{contact.phone}</td>
            <td className="p-4 text-gray-600 dark:text-slate-300">{contact.email || '-'}</td>
            <td className="p-4 text-gray-600 dark:text-slate-300">{contact.company || '-'}</td>
            <td className="p-4 text-gray-600 dark:text-slate-300">
                {contact.tags?.map(tag => <Tag key={tag}>{tag}</Tag>)}
            </td>
            <td className="p-4 text-right">
                <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:bg-red-100/50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300">
                        <TRASH_ICON className="w-4 h-4" />
                    </Button>
                </div>
            </td>
        </tr>
    );
};


const Contacts: React.FC = () => {
    const { contacts, addContact, updateContact, deleteContact, importContacts, sendDirectMessages, setCurrentPage } = useAuthStore();
    const { addToast, showConfirmation } = useUiStore();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDirectMessageModalOpen, setIsDirectMessageModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isSendingDM, setIsSendingDM] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contacts;
        const lowercasedTerm = searchTerm.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(lowercasedTerm) ||
            contact.phone.toLowerCase().includes(lowercasedTerm) ||
            contact.tags?.some(tag => tag.toLowerCase().includes(lowercasedTerm))
        );
    }, [contacts, searchTerm]);

    const handleOpenForm = (contact?: Contact) => {
        setEditingContact(contact);
        setIsFormModalOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormModalOpen(false);
        setEditingContact(undefined);
    };

    const handleSaveContact = async (contact: EditableContact) => {
        setIsSaving(true);
        try {
            if (editingContact?.id) {
                await updateContact({ ...(contact as Contact), id: editingContact.id });
                addToast('Contato atualizado com sucesso!', 'success');
            } else {
                await addContact(contact);
                addToast('Contato criado com sucesso!', 'success');
            }
            handleCloseForm();
        } catch (err: any) {
            addToast(`Erro ao salvar contato: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteContact = async (contact: Contact) => {
        showConfirmation(
            'Excluir Contato',
            `Tem certeza de que deseja excluir o contato "${contact.name}"?`,
            async () => {
                try {
                    await deleteContact(contact.id);
                    addToast('Contato excluído.', 'success');
                } catch (err: any) {
                    addToast(`Erro ao excluir contato: ${err.message}`, 'error');
                }
            }
        );
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                
                const requiredHeaders = ['name', 'phone'];
                if (!requiredHeaders.every(h => headers.includes(h))) {
                    throw new Error("O arquivo CSV precisa conter as colunas 'name' e 'phone'.");
                }

                const newContacts: EditableContact[] = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                    const contactData = headers.reduce((obj, header, index) => {
                        obj[header] = values[index] || '';
                        return obj;
                    }, {} as any);
                    return {
                        name: contactData.name,
                        phone: contactData.phone,
                        email: contactData.email || null,
                        company: contactData.company || null,
                        tags: contactData.tags ? contactData.tags.split(';').map((t:string) => t.trim()).filter(Boolean) : [],
                        custom_fields: null,
                        sentiment: null
                    };
                });
                
                const { importedCount, skippedCount } = await importContacts(newContacts);
                addToast(`${importedCount} contatos importados com sucesso. ${skippedCount} duplicados foram ignorados.`, 'success');

            } catch (err: any) {
                addToast(`Erro na importação: ${err.message}`, 'error');
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };
    
    const handleSendDirectMessages = async (message: string, recipients: Contact[]) => {
        setIsSendingDM(true);
        try {
            await sendDirectMessages(message, recipients);
            addToast(`Mensagens enviadas para ${recipients.length} contatos.`, 'success');
            setIsDirectMessageModalOpen(false);
        } catch (err: any) {
             addToast(`Erro ao enviar mensagens: ${err.message}`, 'error');
        } finally {
            setIsSendingDM(false);
        }
    };

    return (
        <>
            <div className="space-y-8">
                 <div className="flex justify-between items-center flex-wrap gap-4">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contatos</h1>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <SEARCH_ICON className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar contatos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:outline-none"
                            />
                        </div>
                        <Button variant="secondary" onClick={() => setIsDirectMessageModalOpen(true)}>
                            <SEND_ICON className="w-4 h-4 mr-2" />
                            Mensagem Direta
                        </Button>
                         <Button variant="secondary" onClick={handleImportClick} isLoading={isImporting}>
                            <UPLOAD_ICON className="w-4 h-4 mr-2" />
                            Importar CSV
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                        <Button variant="primary" onClick={() => handleOpenForm()}>
                            <PLUS_ICON className="w-5 h-5 mr-2" />
                            Adicionar Contato
                        </Button>
                    </div>
                </div>

                <InfoCard>
                    <p className="text-sm">
                        Para importar, use um arquivo CSV com as colunas <strong>name</strong> e <strong>phone</strong> (obrigatórias).
                        Você também pode incluir as colunas opcionais: <strong>email</strong>, <strong>company</strong>, e <strong>tags</strong> (separadas por ponto e vírgula, ex: "vip;cliente novo").
                    </p>
                </InfoCard>

                <Card className="overflow-x-auto">
                    {filteredContacts.length > 0 ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-600">
                                    <th className="p-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Nome</th>
                                    <th className="p-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Telefone</th>
                                    <th className="p-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Email</th>
                                    <th className="p-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Empresa</th>
                                    <th className="p-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Tags</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContacts.map(contact => (
                                    <ContactRow
                                        key={contact.id}
                                        contact={contact}
                                        onViewDetails={() => setCurrentPage('contact-details', { contactId: contact.id })}
                                        onDelete={() => handleDeleteContact(contact)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    ) : (
                         <div className="text-center py-12">
                            <CONTACTS_ICON className="w-12 h-12 mx-auto text-gray-400 dark:text-slate-500" />
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">{searchTerm ? 'Nenhum contato encontrado.' : 'Nenhum contato cadastrado.'}</h2>
                            <p className="text-gray-500 dark:text-slate-400 mt-2">{searchTerm ? `Sua busca por "${searchTerm}" não retornou resultados.` : 'Adicione seu primeiro contato para começar.'}</p>
                        </div>
                    )}
                </Card>
            </div>
            
            <Modal
                isOpen={isFormModalOpen}
                onClose={handleCloseForm}
                title={editingContact ? 'Editar Contato' : 'Novo Contato'}
            >
                <ContactForm
                    contact={editingContact}
                    onSave={handleSaveContact}
                    onCancel={handleCloseForm}
                    isLoading={isSaving}
                />
            </Modal>

            <DirectMessageModal 
                isOpen={isDirectMessageModalOpen}
                onClose={() => setIsDirectMessageModalOpen(false)}
                onSend={handleSendDirectMessages}
                contacts={contacts}
                isSending={isSendingDM}
            />
        </>
    );
};

export default Contacts;