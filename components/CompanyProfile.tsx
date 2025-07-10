
import React, { useState } from 'react';
import { CompanyProfileData } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';

interface CompanyProfileProps {
  profile: CompanyProfileData;
  setProfile: React.Dispatch<React.SetStateAction<CompanyProfileData>>;
}

const ProfileInput: React.FC<{
    label: string;
    id: keyof CompanyProfileData;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <input
            type="text"
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
        />
    </div>
);

const ProfileTextarea: React.FC<{
    label: string;
    id: keyof CompanyProfileData;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
}> = ({ label, id, value, onChange, rows = 3 }) => (
     <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <textarea
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            rows={rows}
            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
        />
    </div>
);


const CompanyProfile: React.FC<CompanyProfileProps> = ({ profile, setProfile }) => {
  const [localProfile, setLocalProfile] = useState<CompanyProfileData>(profile);
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLocalProfile(prev => ({ ...prev, [name]: value }));
    setIsSaved(false);
  };
  
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(localProfile);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000); // Oculta a mensagem após 3 segundos
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Perfil da Empresa</h1>
      <Card>
        <form onSubmit={handleSave} className="space-y-6">
          <p className="text-slate-400 text-sm">Esta informação será usada pela IA para gerar conteúdo personalizado para suas campanhas.</p>
          <ProfileInput label="Nome da Empresa" id="name" value={localProfile.name} onChange={handleChange} />
          <ProfileTextarea label="Descrição da Empresa" id="description" value={localProfile.description} onChange={handleChange} />
          <ProfileTextarea label="Produtos / Serviços" id="products" value={localProfile.products} onChange={handleChange} />
          <ProfileTextarea label="Público-alvo" id="audience" value={localProfile.audience} onChange={handleChange} />
          <ProfileInput label="Tom de Voz da Marca" id="tone" value={localProfile.tone} onChange={handleChange} />
          
          <div className="flex justify-end items-center gap-4">
              {isSaved && <p className="text-green-400 text-sm">Perfil salvo com sucesso!</p>}
              <Button type="submit" variant="primary">Salvar Alterações</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CompanyProfile;
