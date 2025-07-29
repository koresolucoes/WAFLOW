import React, { useState } from 'react';
import MetaApiSettings from './MetaApiSettings';
import CustomFieldsSettings from './CustomFieldsSettings';
import CannedResponsesSettings from './CannedResponsesSettings';
import TeamSettings from './TeamSettings';
import AccountSettings from './AccountSettings';

const TabButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            isActive
                ? 'border-blue-500 text-blue-600 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'
        }`}
    >
        {label}
    </button>
);

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('meta');

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
            <div>
                <div className="border-b border-gray-200 dark:border-slate-700 flex flex-wrap">
                    <TabButton label="API da Meta & Webhooks" isActive={activeTab === 'meta'} onClick={() => setActiveTab('meta')} />
                    <TabButton label="Campos Personalizados" isActive={activeTab === 'custom'} onClick={() => setActiveTab('custom')} />
                    <TabButton label="Respostas Rápidas" isActive={activeTab === 'canned'} onClick={() => setActiveTab('canned')} />
                    <TabButton label="Equipe" isActive={activeTab === 'team'} onClick={() => setActiveTab('team')} />
                    <TabButton label="Conta" isActive={activeTab === 'account'} onClick={() => setActiveTab('account')} />
                </div>
                <div className="pt-6">
                    {activeTab === 'meta' && <MetaApiSettings />}
                    {activeTab === 'custom' && <CustomFieldsSettings />}
                    {activeTab === 'canned' && <CannedResponsesSettings />}
                    {activeTab === 'team' && <TeamSettings />}
                    {activeTab === 'account' && <AccountSettings />}
                </div>
            </div>
        </div>
    );
};

export default Settings;