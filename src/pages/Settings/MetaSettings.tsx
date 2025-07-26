
import React, { useState } from 'react';
import MetaApiSettings from './MetaApiSettings';
import CustomFieldsSettings from './CustomFieldsSettings';

const TabButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            isActive
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
        }`}
    >
        {label}
    </button>
);

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('meta');

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-white">Configurações</h1>
            <div>
                <div className="border-b border-slate-700">
                    <TabButton label="API da Meta & Webhooks" isActive={activeTab === 'meta'} onClick={() => setActiveTab('meta')} />
                    <TabButton label="Campos Personalizados" isActive={activeTab === 'custom'} onClick={() => setActiveTab('custom')} />
                </div>
                <div className="pt-6">
                    {activeTab === 'meta' && <MetaApiSettings />}
                    {activeTab === 'custom' && <CustomFieldsSettings />}
                </div>
            </div>
        </div>
    );
};

export default Settings;
