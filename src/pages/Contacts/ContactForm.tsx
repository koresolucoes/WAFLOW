import React, { useState, useEffect } from 'react';
import { EditableContact } from '../../types';
import Button from '../../components/common/Button';
import { useUiStore } from '../../stores/uiStore';

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
  const addToast = useUiStore(state => state.addToast);

  useEffect(() => {
    if (contact) {
      setFormData({
        ...(contact as any),
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
      addToast("Nome e telefone são obrigatórios.", 'warning');
      return;
    }
    onSave(formData);
  };

  const inputClasses = "w-full bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500";
  const labelClasses = "block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className={labelClasses}>Nome Completo</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className={inputClasses}
        />
      </div>
      <div>
        <label htmlFor="phone" className={labelClasses}>Número de Telefone</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          placeholder="ex: +5511987654321"
          className={inputClasses}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className={labelClasses}>E-mail</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            placeholder="contato@exemplo.com"
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="company" className={labelClasses}>Empresa</label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company || ''}
            onChange={handleChange}
            placeholder="Nome da Empresa"
            className={inputClasses}
          />
        </div>
      </div>
      <div>
          <label htmlFor="tags" className={labelClasses}>Tags (pressione Enter para adicionar)</label>
          <div className="flex flex-wrap items-center w-full bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2">
              {formData.tags.map(tag => (
                  <span key={tag} className="flex items-center mr-2 mb-1 px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700 dark:bg-sky-500/20 dark:text-sky-300">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-gray-600 dark:text-sky-200 hover:text-black dark:hover:text-white">
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
                className="bg-transparent flex-1 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none min-w-[100px]"
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