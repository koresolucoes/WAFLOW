import React, { useState, useEffect } from 'react';
import { EditableContact } from '../../types';
import Button from '../../components/common/Button';

interface ContactFormProps {
  contact?: EditableContact;
  onSave: (contact: EditableContact) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ContactForm: React.FC<ContactFormProps> = ({ contact, onSave, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState<EditableContact & { tags: string[] }>({
    name: '',
    phone: '',
    email: '',
    company: '',
    tags: [],
    custom_fields: null,
    sentiment: null,
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (contact) {
      setFormData({
        ...contact,
        tags: contact.tags || [],
        email: contact.email || '',
        company: contact.company || ''
      });
    } else {
      setFormData({ name: '', phone: '', email: '', company: '', tags: [], custom_fields: null, sentiment: null });
    }
  }, [contact]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !formData.tags.includes(newTag)) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag].sort() }));
      }
      setTagInput('');
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Nome e telefone são obrigatórios.");
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Nome Completo</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">Número de Telefone</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          placeholder="ex: +5511987654321"
          className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            placeholder="contato@exemplo.com"
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-slate-300 mb-1">Empresa</label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company || ''}
            onChange={handleChange}
            placeholder="Nome da Empresa"
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>
      <div>
          <label htmlFor="tags" className="block text-sm font-medium text-slate-300 mb-1">Tags (pressione Enter para adicionar)</label>
          <div className="flex flex-wrap items-center w-full bg-slate-700 border border-slate-600 rounded-md p-2">
              {formData.tags.map(tag => (
                  <span key={tag} className="flex items-center mr-2 mb-1 px-2 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-sky-200 hover:text-white">
                          &times;
                      </button>
                  </span>
              ))}
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
                placeholder="vip, novo-cliente..."
                className="bg-transparent flex-1 text-white placeholder-slate-400 focus:outline-none min-w-[100px]"
            />
          </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>Salvar Contato</Button>
      </div>
    </form>
  );
};

export default ContactForm;