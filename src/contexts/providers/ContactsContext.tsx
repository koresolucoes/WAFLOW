import React, { createContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { Contact, EditableContact, ContactWithDetails } from '../../types';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import * as contactService from '../../services/contactService';

interface ContactsContextType {
  contacts: Contact[];
  allTags: string[];
  contactDetails: ContactWithDetails | null;
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setContactDetails: React.Dispatch<React.SetStateAction<ContactWithDetails | null>>;
  addContact: (contact: EditableContact) => Promise<void>;
  updateContact: (contact: Contact) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  importContacts: (newContacts: EditableContact[]) => Promise<{ importedCount: number; skippedCount: number }>;
  fetchContactDetails: (contactId: string) => Promise<void>;
  sendDirectMessages: (message: string, recipients: Contact[]) => Promise<void>;
}

export const ContactsContext = createContext<ContactsContextType>(null!);

export const ContactsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam } = useAuthStore();
    const metaConfig = useMetaConfig();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactDetails, setContactDetails] = useState<ContactWithDetails | null>(null);

    const fetchContactDetails = useCallback(async (contactId: string) => {
        if (!user || !activeTeam) return;
        setContactDetails(null);
        try {
            const details = await contactService.fetchContactDetailsFromDb(activeTeam.id, contactId);
            setContactDetails(details);
        } catch (err) {
            console.error("Error fetching contact details:", (err as any).message || err);
            throw err;
        }
    }, [user, activeTeam]);

    const addContact = useCallback(async (contact: EditableContact) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        
        const newContact = await contactService.addContactToDb(activeTeam.id, contact);
        setContacts(prev => [newContact, ...prev]);
        
        // Post-DB side effect
        // Note: The run-trigger API needs adjustment for multi-tenancy if it hasn't been already.
        // Assuming it can derive the team from the user for now.
        fetch('/api/run-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'contact_created', userId: user.id, contactId: newContact.id })
        }).catch(err => console.error("Failed to call contact_created trigger API", err));

    }, [user, activeTeam]);
  
    const updateContact = useCallback(async (updatedContact: Contact) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        
        const oldContact = (contactDetails && contactDetails.id === updatedContact.id)
            ? contactDetails
            : contacts.find(c => c.id === updatedContact.id);

        const newContact = await contactService.updateContactInDb(activeTeam.id, updatedContact);
        setContacts(prev => prev.map(c => c.id === newContact.id ? newContact : c));
        
        if(contactDetails?.id === newContact.id) {
            setContactDetails(prev => prev ? { ...prev, ...newContact } : null)
        }

        const oldTags = new Set(oldContact?.tags || []);
        const newTags = newContact.tags || [];
        const addedTags = newTags.filter(tag => !oldTags.has(tag));

        if (addedTags.length > 0) {
            // Note: The run-trigger API needs adjustment for multi-tenancy.
            fetch('/api/run-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventType: 'tags_added', userId: user.id, contactId: newContact.id, data: { addedTags } })
            }).catch(err => console.error("Failed to call tags_added trigger API", err));
        }
    }, [user, activeTeam, contacts, contactDetails]);

    const deleteContact = useCallback(async (contactId: string) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        await contactService.deleteContactFromDb(activeTeam.id, contactId);
        setContacts(prev => prev.filter(c => c.id !== contactId));
    }, [user, activeTeam]);
    
    const importContacts = useCallback(async (newContacts: EditableContact[]): Promise<{ importedCount: number; skippedCount: number }> => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        
        const existingPhones = new Set(contacts.map(c => contactService.normalizePhoneNumber(c.phone)));
        const { imported, skippedCount } = await contactService.importContactsToDb(activeTeam.id, newContacts, existingPhones);
        
        if (imported.length > 0) {
            setContacts(prev => [...imported, ...prev].sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
            for(const contact of imported) {
                fetch('/api/run-trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventType: 'contact_created', userId: user.id, contactId: contact.id })
                }).catch(err => console.error("Failed to call contact_created trigger API for imported contact", err));
            }
        }
        return { importedCount: imported.length, skippedCount };
    }, [user, activeTeam, contacts]);
    
    const sendDirectMessages = useCallback(async (message: string, recipients: Contact[]) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        if (!metaConfig.accessToken || !metaConfig.phoneNumberId) throw new Error("Configuração da Meta ausente.");
        await contactService.sendDirectMessagesFromApi(metaConfig, activeTeam.id, message, recipients);
    }, [user, activeTeam, metaConfig]);

    const allTags = useMemo(() => {
        const tagsSet = new Set<string>();
        contacts.forEach(c => {
            if(c.tags) {
                c.tags.forEach(t => tagsSet.add(t));
            }
        });
        return Array.from(tagsSet).sort();
    }, [contacts]);

    const value = {
        contacts,
        setContacts,
        allTags,
        contactDetails,
        setContactDetails,
        addContact,
        updateContact,
        deleteContact,
        importContacts,
        fetchContactDetails,
        sendDirectMessages,
    };

    return (
        <ContactsContext.Provider value={value}>
            {children}
        </ContactsContext.Provider>
    );
};