import React, { useContext, useState, useRef } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ContactForm from './ContactForm';
import { Contact, EditableContact } from '../../types';
import { PLUS_ICON, TRASH_ICON, CONTACTS_ICON, UPLOAD_ICON, FILE_TEXT_ICON, SEND_ICON } from '../../components/icons';
import { ContactsContext } from '../../contexts/providers/ContactsContext';
import { NavigationContext } from '../../contexts/providers/NavigationContext';
import DirectMessageModal from './DirectMessageModal';

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="mr-2 mb-2 inline-block px-2 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-400">
        {children}
    </span>
);

const ContactRow: React.FC<{ contact: Contact; onViewDetails: () => void; onDelete: () => void; }> = ({ contact, onViewDetails, onDelete }) => {
    return (
        <tr className="border-b border-slate-700 hover:bg-slate-800/50 cursor-pointer" onClick={onViewDetails}>
            <td className="p-4 font-medium text-white">{contact.name}</td>
            <td className="p-4 text-slate-300 font-mono">{contact.phone}</td>
            <td className="p-4 text-slate-300">{contact.email || '-'}</td>
            <td className="p-4 text-slate-300">{contact.company || '-'}</td>
            <td className="p-4 text-slate-300">
                {contact.tags?.map(tag => <Tag key={tag}>{tag}</Tag>)}
            </td>
            <td className="p-4 text-right">
                <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:bg-red-500/10 hover:text-red-300">
                        <TRASH_ICON className="w-4 h-4" />
                    </Button>
                </div>
            </td>
        </tr>
    );
};


const Contacts: React.FC = () => {
    const { contacts, addContact, deleteContact, importContacts, sendDirectMessages } = useContext(ContactsContext);
    const { setCurrentPage } = useContext(NavigationContext);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isDirectMessageModalOpen, setIsDirectMessageModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOpenFormModal = () => {
        setIsFormModalOpen(true);
    };

    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
    };

    const handleSaveContact = async (contact: EditableContact) => {
        setIsLoading(true);
        try {
            // A edição agora é feita na página de detalhes
            await addContact(contact);
            handleCloseFormModal();
        } catch(err: any) {
            alert(`Erro ao salvar contato: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDeleteContact = async (contactId: string) => {
        if (window.confirm("Tem certeza de que deseja excluir este contato? Esta ação não pode ser desfeita.")) {
            try {
                await deleteContact(contactId);
            } catch (err: any) {
                alert(`Erro ao deletar contato: ${err.message}`);
            }
        }
    };

    const handleTriggerImport = () => {
        setIsImportModalOpen(false);
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoading(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const newContacts: EditableContact[] = [];
            
            const startIndex = lines[0].toLowerCase().includes('nome') ? 1 : 0;
            
            for (let i = startIndex; i < lines.length; i++) {
                const [name, phone, email, company, tagsStr] = lines[i].split(',');
                if (name && phone) {
                    const tags = tagsStr ? tagsStr.trim().split(';').map(t => t.trim()).filter(Boolean) : [];
                    newContacts.push({ name: name.trim(), phone: phone.trim(), email: email?.trim() || '', company: company?.trim() || '', tags, custom_fields: null, inbox_status: 'Aberta' });
                }
            }

            if (newContacts.length > 0) {
                try {
                    const { importedCount, skippedCount } = await importContacts(newContacts);
                    alert(`${importedCount} contatos importados com sucesso. ${skippedCount} contatos ignorados por serem duplicados.`);
                } catch(err: any) {
                    alert(`Erro ao importar contatos: ${err.message}`)
                }
            } else {
                alert("Nenhum contato válido encontrado no arquivo. Verifique se o formato é 'nome,telefone,email,empresa,tags'.");
            }
            
            if(event.target) event.target.value = '';
            setIsLoading(false);
        };
        reader.readAsText(file);
    };

    const handleSendDirect = async (message: string, recipients: Contact[]) => {
        setIsLoading(true);
        try {
            await sendDirectMessages(message, recipients);
            alert(`Mensagem enviada para ${recipients.length} contatos. Verifique a Caixa de Entrada para o status de envio.`);
            setIsDirectMessageModalOpen(false);
        } catch (err: any) {
            alert(`Erro ao enviar mensagens: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Contatos</h1>
                <div className="space-x-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                    />
                     <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} isLoading={isLoading}>
                        <UPLOAD_ICON className="w-5 h-5 mr-2" />
                        Importar CSV
                    </Button>
                     <Button variant="secondary" onClick={() => setIsDirectMessageModalOpen(true)}>
                        <SEND_ICON className="w-5 h-5 mr-2" />
                        Enviar Mensagem
                    </Button>
                    <Button variant="primary" onClick={handleOpenFormModal}>
                        <PLUS_ICON className="w-5 h-5 mr-2" />
                        Adicionar Contato
                    </Button>
                </div>
            </div>
      
            <Card className="overflow-x-auto">
                {contacts.length > 0 ? (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-600">
                                <th className="p-4 text-sm font-semibold text-slate-400">Nome</th>
                                <th className="p-4 text-sm font-semibold text-slate-400">Telefone</th>
                                <th className="p-4 text-sm font-semibold text-slate-400">Email</th>
                                <th className="p-4 text-sm font-semibold text-slate-400">Empresa</th>
                                <th className="p-4 text-sm font-semibold text-slate-400">Tags</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.map(contact => (
                                <ContactRow
                                    key={contact.id}
                                    contact={contact}
                                    onViewDetails={() => setCurrentPage('contact-details', { contactId: contact.id })}
                                    onDelete={() => handleDeleteContact(contact.id)}
                                />
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-12">
                        <CONTACTS_ICON className="w-12 h-12 mx-auto text-slate-500" />
                        <h2 className="text-xl font-semibold text-white mt-4">Nenhum contato adicionado.</h2>
                        <p className="text-slate-400 mt-2 mb-6">Comece adicionando seu primeiro contato ou importe uma lista de um arquivo CSV.</p>
                        <Button variant="primary" onClick={handleOpenFormModal}>
                            Adicionar Primeiro Contato
                        </Button>
                    </div>
                )}
            </Card>

            <Modal
                isOpen={isFormModalOpen}
                onClose={handleCloseFormModal}
                title="Adicionar Novo Contato"
            >
                <ContactForm
                    onSave={handleSaveContact}
                    onCancel={handleCloseFormModal}
                    isLoading={isLoading}
                />
            </Modal>

            <Modal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Como Importar Contatos via CSV"
            >
                <div className="space-y-4 text-slate-300">
                    <p>Para importar seus contatos, prepare um arquivo <code>.csv</code> com as seguintes colunas, nesta ordem:</p>
                    <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li><strong>nome:</strong> O nome completo do contato.</li>
                        <li><strong>telefone:</strong> O número do WhatsApp no formato internacional (ex: <code>5511999998888</code>).</li>
                        <li><strong>email:</strong> (Opcional) O email do contato.</li>
                        <li><strong>empresa:</strong> (Opcional) O nome da empresa do contato.</li>
                        <li><strong>tags:</strong> (Opcional) Uma ou mais tags para segmentação, separadas por ponto e vírgula (<code>;</code>).</li>
                    </ol>

                    <div className="p-4 bg-slate-900/50 rounded-lg">
                        <div className='flex items-center gap-2 mb-2'>
                          <FILE_TEXT_ICON className="w-5 h-5 text-sky-400"/>
                          <p className="font-semibold">Exemplo: <code>meus_contatos.csv</code></p>
                        </div>
                        <pre className="text-xs font-mono whitespace-pre-wrap text-slate-400">
                            <code>
                                nome,telefone,email,empresa,tags<br/>
                                Ana Silva,5511987654321,ana.silva@email.com,Empresa X,vip;cliente-antigo<br/>
                                Bruno Costa,5521912345678,bruno@email.com,Empresa Y,novo-cliente<br/>
                                Carla Dias,5531955554444,,,
                            </code>
                        </pre>
                    </div>

                    <p className="text-sm text-slate-400">
                        <strong>Atenção:</strong> A primeira linha (cabeçalho) é opcional e será ignorada. Contatos com números de telefone que já existem na sua lista não serão importados para evitar duplicatas.
                    </p>
                </div>
                <div className="mt-6 flex justify-end">
                    <Button variant="primary" onClick={handleTriggerImport}>
                        <UPLOAD_ICON className="w-5 h-5 mr-2" />
                        Selecionar Arquivo CSV
                    </Button>
                </div>
            </Modal>
            
            <DirectMessageModal
                isOpen={isDirectMessageModalOpen}
                onClose={() => setIsDirectMessageModalOpen(false)}
                onSend={handleSendDirect}
                contacts={contacts}
                isSending={isLoading}
            />

        </div>
    );
};

export default Contacts;
