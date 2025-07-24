
import React, { createContext, useState, useCallback, ReactNode, useContext, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Contact, EditableContact, ContactWithDetails, Deal } from '../../types';
import { TablesInsert, TablesUpdate } from '../../types/database.types';
import { AuthContext } from './AuthContext';

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
}

export const ContactsContext = createContext<ContactsContextType>(null!);

const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // 1. Strip all non-numeric characters.
    let digits = phone.replace(/\D/g, '');

    // 2. Remove the optional leading '0' for DDD.
    if (digits.length > 10 && digits.startsWith('0')) {
        digits = digits.substring(1);
    }

    // 3. Handle country code (55 for Brazil).
    // If it has 10 or 11 digits, it's likely a local number (DDD + number). Prepend 55.
    if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
    }
    
    // 4. Add the '9' for mobiles if missing (full old number is 12 digits: 55 + DDD + 8-digit number)
    if (digits.length === 12 && digits.startsWith('55')) {
        const areaCode = digits.substring(2, 4);
        const numberPart = digits.substring(4);
        if (parseInt(areaCode) >= 11) {
             digits = `55${areaCode}9${numberPart}`;
        }
    }
    
    return digits;
};


export const ContactsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactDetails, setContactDetails] = useState<ContactWithDetails | null>(null);

    const fetchContactDetails = useCallback(async (contactId: string) => {
        if (!user) return;
        setContactDetails(null);
        try {
            const { data: contactData, error: contactError } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .eq('user_id', user.id)
                .single();

            if (contactError || !contactData) {
                throw contactError || new Error("Contato não encontrado ou acesso negado.");
            }

            const { data: dealsData, error: dealsError } = await supabase
                .from('deals')
                .select('*')
                .eq('contact_id', contactId);
            
            if (dealsError) throw dealsError;
            
            setContactDetails({
                ...(contactData as unknown as Contact),
                deals: (dealsData as unknown as Deal[]) || []
            });

        } catch (err) {
            console.error("Error fetching contact details:", (err as any).message || err);
            throw err;
        }
    }, [user]);

    const addContact = useCallback(async (contact: EditableContact) => {
        if (!user) throw new Error("User not authenticated.");
        const payload: TablesInsert<'contacts'> = { ...contact, phone: normalizePhoneNumber(contact.phone), user_id: user.id };
        const { data, error } = await supabase.from('contacts').insert(payload).select().single();
        if (error) throw error;
        if(data) {
          const newContact = data as unknown as Contact;
          setContacts(prev => [newContact, ...prev]);
          
          fetch('/api/run-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'contact_created', userId: user.id, contactId: newContact.id })
          }).catch(err => console.error("Failed to call contact_created trigger API", err));
        }
    }, [user]);
  
    const updateContact = useCallback(async (updatedContact: Contact) => {
        if (!user) throw new Error("User not authenticated.");
        
        const oldContact = (contactDetails && contactDetails.id === updatedContact.id)
            ? contactDetails
            : contacts.find(c => c.id === updatedContact.id);

        const updatePayload: TablesUpdate<'contacts'> = {
            name: updatedContact.name,
            phone: normalizePhoneNumber(updatedContact.phone),
            email: updatedContact.email,
            company: updatedContact.company,
            tags: updatedContact.tags,
            custom_fields: updatedContact.custom_fields,
        };

        const { data, error } = await supabase
            .from('contacts')
            .update(updatePayload)
            .eq('id', updatedContact.id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        if(data) {
            const newContact = data as unknown as Contact;
            setContacts(prev => prev.map(c => c.id === newContact.id ? newContact : c));
            
            if(contactDetails?.id === newContact.id) {
                setContactDetails(prev => prev ? { ...prev, ...newContact } : null)
            }

            const oldTags = new Set(oldContact?.tags || []);
            const newTags = newContact.tags || [];
            const addedTags = newTags.filter(tag => !oldTags.has(tag));

            if (addedTags.length > 0) {
                fetch('/api/run-trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventType: 'tags_added', userId: user.id, contactId: newContact.id, data: { addedTags } })
                }).catch(err => console.error("Failed to call tags_added trigger API", err));
            }
        }
    }, [user, contacts, contactDetails]);

    const deleteContact = useCallback(async (contactId: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { error } = await supabase.from('contacts').delete().eq('id', contactId).eq('user_id', user.id);
        if (error) throw error;
        setContacts(prev => prev.filter(c => c.id !== contactId));
    }, [user]);
    
    const importContacts = useCallback(async (newContacts: EditableContact[]): Promise<{ importedCount: number; skippedCount: number }> => {
        if (!user) throw new Error("User not authenticated.");
        
        const existingPhones = new Set(contacts.map(c => normalizePhoneNumber(c.phone)));
        const contactsToInsert: TablesInsert<'contacts'>[] = [];
        let skippedCount = 0;
        
        newContacts.forEach(contact => {
            const sanitizedPhone = normalizePhoneNumber(contact.phone);
            if (sanitizedPhone && !existingPhones.has(sanitizedPhone)) {
                contactsToInsert.push({ ...contact, phone: sanitizedPhone, user_id: user.id, custom_fields: contact.custom_fields || null });
                existingPhones.add(sanitizedPhone);
            } else {
                skippedCount++;
            }
        });

        if (contactsToInsert.length > 0) {
            const { data, error } = await supabase.from('contacts').insert(contactsToInsert).select();
            if (error) throw error;
            if(data) {
                const newContactList = data as unknown as Contact[];
                setContacts(prev => [...newContactList, ...prev].sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
                for(const contact of newContactList) {
                    fetch('/api/run-trigger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eventType: 'contact_created', userId: user.id, contactId: contact.id })
                    }).catch(err => console.error("Failed to call contact_created trigger API for imported contact", err));
                }
            }
        }
        return { importedCount: contactsToInsert.length, skippedCount: skippedCount };
    }, [user, contacts]);
    
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
    };

    return (
        <ContactsContext.Provider value={value}>
            {children}
        </ContactsContext.Provider>
    );
};