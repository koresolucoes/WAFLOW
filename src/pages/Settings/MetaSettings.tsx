

import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Profile } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import InfoCard from '../../components/common/InfoCard';
import { COPY_ICON } from '../../components/icons';

const MetaSettings: React.FC = () => {
    const { profile, updateProfile } = useContext(AppContext);
    const [localConfig, setLocalConfig] = useState({
        meta_access_token: '',
        meta_waba_id: '',
        meta_phone_number_id: '',
        meta_webhook_verify_token: '',
        webhook_path_prefix: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (profile) {
            setLocalConfig({
                meta_access_token: profile.meta_access_token || '',
                meta_waba_id: profile.meta_waba_id || '',
                meta_phone_number_id: profile.meta_phone_number_id || '',
                meta_webhook_verify_token: profile.meta_webhook_verify_token || 'seu_token_secreto_aqui',
                webhook_path_prefix: profile.webhook_path_prefix || '',
            });
        }
    }, [profile]);

    const webhookUrl = `${window.location.origin}/api/webhook`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalConfig(prev => ({ ...prev, [name]: value }));
        setIsSaved(false);
        setError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!localConfig.meta_access_token || !localConfig.meta_waba_id || !localConfig.meta_phone_number_id || !localConfig.meta_webhook_verify_token || !localConfig.webhook_path_prefix) {
            setError("Todos os campos são obrigatórios.");
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            await updateProfile(localConfig as Partial<Profile>);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch(err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    if (!profile) return <div>Carregando...</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-white">Configurações</h1>
            
            <Card>
                <h2 className="text-lg font-semibold text-white mb-4">API da Meta (WhatsApp)</h2>
                <form onSubmit={handleSave} className="space-y-6">
                    <p className="text-slate-400 text-sm">
                        Insira suas credenciais da API do WhatsApp Business para conectar sua conta.
                        Você pode encontrá-las no seu <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">painel de aplicativos da Meta</a>.
                    </p>

                    <div>
                        <label htmlFor="meta_access_token" className="block text-sm font-medium text-slate-300 mb-1">Token de Acesso</label>
                        <input
                            type="password"
                            id="meta_access_token"
                            name="meta_access_token"
                            value={localConfig.meta_access_token}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                            placeholder="Cole seu token aqui"
                        />
                    </div>

                    <div>
                        <label htmlFor="meta_waba_id" className="block text-sm font-medium text-slate-300 mb-1">ID da conta do WhatsApp Business (WABA ID)</label>
                        <input
                            type="text"
                            id="meta_waba_id"
                            name="meta_waba_id"
                            value={localConfig.meta_waba_id}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                            placeholder="ID da sua conta business"
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="meta_phone_number_id" className="block text-sm font-medium text-slate-300 mb-1">ID do número de telefone</label>
                        <input
                            type="text"
                            id="meta_phone_number_id"
                            name="meta_phone_number_id"
                            value={localConfig.meta_phone_number_id}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                            placeholder="ID do seu número de telefone"
                        />
                    </div>
                    
                    <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-700/50">
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        {isSaved && <p className="text-green-400 text-sm">Configurações salvas com sucesso!</p>}
                        <Button type="submit" variant="primary" isLoading={isSaving}>Salvar Configurações da Meta</Button>
                    </div>
                </form>
            </Card>

            <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Configurações de Webhook</h2>
                <div className="space-y-6">
                     <div>
                        <label htmlFor="webhook_path_prefix" className="block text-sm font-medium text-slate-300 mb-1">Prefixo do Caminho do Webhook</label>
                        <input
                            type="text"
                            id="webhook_path_prefix"
                            name="webhook_path_prefix"
                            value={localConfig.webhook_path_prefix}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                        />
                         <p className="text-xs text-slate-400 mt-1">Um prefixo único para as URLs de webhook das suas automações. Use apenas letras, números e hífens.</p>
                    </div>

                     <div>
                        <label htmlFor="meta_webhook_verify_token" className="block text-sm font-medium text-slate-300 mb-1">Token Secreto de Verificação do Webhook da Meta</label>
                        <input
                            type="text"
                            id="meta_webhook_verify_token"
                            name="meta_webhook_verify_token"
                            value={localConfig.meta_webhook_verify_token}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                            placeholder="Crie e cole um token secreto forte"
                        />
                         <p className="text-xs text-slate-400 mt-1">Este token é usado para garantir que as requisições de status de mensagem vêm da Meta.</p>
                    </div>
                    <InfoCard>
                        <p>Para receber o status das mensagens e as respostas dos clientes, configure um Webhook no seu aplicativo da Meta com os seguintes valores:</p>
                        <div className="mt-3 space-y-2 font-mono text-xs bg-slate-800 p-3 rounded-md">
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="font-bold text-slate-300">URL de Callback:</span>
                                    <br/> {webhookUrl}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webhookUrl)}><COPY_ICON className="w-4 h-4"/></Button>
                            </div>
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="font-bold text-slate-300">Token de Verificação:</span>
                                    <br/> {localConfig.meta_webhook_verify_token}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(localConfig.meta_webhook_verify_token)}><COPY_ICON className="w-4 h-4"/></Button>
                            </div>
                        </div>
                         <p className="mt-3 text-xs"><strong>Importante:</strong> Você deve salvar estas configurações aqui para que o webhook funcione. O Token de Verificação aqui deve ser o mesmo usado no seu painel da Meta e na variável de ambiente `META_VERIFY_TOKEN` no servidor.</p>
                    </InfoCard>

                    <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-700/50">
                        <Button type="submit" variant="primary" isLoading={isSaving}>Salvar Configurações de Webhook</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default MetaSettings;