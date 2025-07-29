import React, { useState, useEffect } from 'react';
import { EditableProfile } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';

const ProfileInput: React.FC<{
    label: string;
    id: keyof EditableProfile;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">{label}</label>
        <input
            type="text"
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500"
        />
    </div>
);

const ProfileTextarea: React.FC<{
    label: string;
    id: keyof EditableProfile;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
}> = ({ label, id, value, onChange, rows = 3 }) => (
     <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">{label}</label>
        <textarea
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            rows={rows}
            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500"
        />
    </div>
);

const CompanyProfile: React.FC = () => {
  const profile = useAuthStore(state => state.profile);
  const updateProfile = useAuthStore(state => state.updateProfile);
  const [localProfile, setLocalProfile] = useState<EditableProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      const { id, updated_at, ...editableProfile } = profile;
      setLocalProfile(editableProfile);
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (localProfile) {
      setLocalProfile(prev => ({ ...prev!, [name]: value }));
    }
    setIsSaved(false);
    setError('');
  };
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localProfile) return;
    setIsSaving(true);
    setError('');
    try {
        await updateProfile(localProfile);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    } catch(err: any) {
        setError(err.message);
    } finally {
        setIsSaving(false);
    }
  };

  if (!localProfile) {
    return <div>Carregando perfil...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Perfil da Empresa</h1>
      <Card>
        <form onSubmit={handleSave} className="space-y-6">
          <p className="text-gray-500 dark:text-slate-400 text-sm">Esta informação será usada pela IA para gerar conteúdo personalizado para suas campanhas.</p>
          <ProfileInput label="Nome da Empresa" id="company_name" value={localProfile.company_name || ''} onChange={handleChange} />
          <ProfileTextarea label="Descrição da Empresa" id="company_description" value={localProfile.company_description || ''} onChange={handleChange} />
          <ProfileTextarea label="Produtos / Serviços" id="company_products" value={localProfile.company_products || ''} onChange={handleChange} />
          <ProfileTextarea label="Público-alvo" id="company_audience" value={localProfile.company_audience || ''} onChange={handleChange} />
          <ProfileInput label="Tom de Voz da Marca" id="company_tone" value={localProfile.company_tone || ''} onChange={handleChange} />
          
          <div className="flex justify-end items-center gap-4">
              {isSaved && <p className="text-green-500 dark:text-green-400 text-sm">Perfil salvo com sucesso!</p>}
              {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
              <Button type="submit" variant="primary" isLoading={isSaving}>Salvar Alterações</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CompanyProfile;