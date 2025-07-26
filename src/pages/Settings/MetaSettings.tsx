

import React, { useState, useEffect, useCallback } from 'react';
import { EditableProfile } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import InfoCard from '../../components/common/InfoCard';
import { COPY_ICON } from '../../components/icons';
import { useAuthStore } from '../../stores/authStore';

const MetaSettings: React.FC = () => {
    const profile = useAuthStore(state => state.profile);
    const user = useAuthStore(state => state.user);
    const updateProfile = useAuthStore(state => state.updateProfile);

    const [localConfig, setLocalConfig] = useState<EditableProfile>({
        meta_access_token: '',
        meta_waba_id: '',
        meta_phone_number_id: '',
        webhook_path_prefix: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [verifyToken, setVerifyToken] = useState('');
    const [copyStatus, setCopyStatus] = useState({ url: false, token: false });

    useEffect(() => {
        if (profile) {
            setLocalConfig({
                meta_access_token: profile.meta_access_token || '',
                meta_waba_id: profile.meta_waba_id || '',
                meta_phone_number_id: profile.meta_phone_number_id || '',
                webhook_path_prefix: profile.webhook_path_prefix || '',
            });
        }
    }, [profile]);

    useEffect(() => {
        // Gera um token seguro e URL-safe para ser usado na verificação do webhook.
        const generateToken = () => {
            const array = new Uint8Array(24); // 24 bytes de dados aleatórios
            window.crypto.getRandomValues(array);
            // Converte para uma string base64 e a torna segura para URL
            return btoa(String.fromCharCode.apply(null, Array.from(array)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        };
        setVerifyToken(generateToken());
    }, []);

    const webhookUrl = user ? `${window.location.origin}/api/webhook/${user.id}` : '';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalConfig(prev => ({ ...prev, [name]: value } as EditableProfile));
        setIsSaved(false);
        setError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const trimmedConfig: EditableProfile = {
            meta_access_token: localConfig.meta_access_token?.trim() || '',
            meta_waba_id: localConfig.meta_waba_id?.trim() || '',
            meta_phone_number_id: localConfig.meta_phone_number_id?.trim() || '',
            webhook_path_prefix: localConfig.webhook_path_prefix?.trim() || '',
        };

        if (!trimmedConfig.meta_access_token || !trimmedConfig.meta_waba_id || !trimmedConfig.meta_phone_number_id) {
            setError("Os campos da API da Meta são obrigatórios.");
            setIsSaving(false);
            return;
        }
        
        if (trimmedConfig.webhook_path_prefix && trimmedConfig.webhook_path_prefix.includes('_')) {
            setError("O prefixo do webhook de automação não pode conter underscores (_). Use hífens (-).");
            setIsSaving(false);
            return;
        }

        try {
            await updateProfile(trimmedConfig);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch(err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const copyToClipboard = (text: string, type: 'url' | 'token') => {
        if (text) {
           navigator.clipboard.writeText(text);
           setCopyStatus(prev => ({ ...prev, [type]: true }));
           setTimeout(() => setCopyStatus(prev => ({ ...prev, [type]: false })), 2000);
        }
    };

    if (!profile) return <div>Carregando...</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-white">Configurações</h1>
            
            <Card>
                <form onSubmit={handleSave} className="space-y-6">
                    <h2 className="text-lg font-semibold text-white">API da Meta (WhatsApp)</h2>
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
                            value={localConfig.meta_access_token || ''}
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
                            value={localConfig.meta_waba_id || ''}
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
                            value={localConfig.meta_phone_number_id || ''}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                            placeholder="ID do seu número de telefone"
                        />
                    </div>

                     <h2 className="text-lg font-semibold text-white pt-4 border-t border-slate-700/50">Webhook de Automação</h2>
                     <div>
                        <label htmlFor="webhook_path_prefix" className="block text-sm font-medium text-slate-300 mb-1">Prefixo do Caminho do Webhook (para Automações)</label>
                        <input
                            type="text"
                            id="webhook_path_prefix"
                            name="webhook_path_prefix"
                            value={localConfig.webhook_path_prefix || ''}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                             placeholder="Ex: minha-empresa-123"
                        />
                         <p className="text-xs text-slate-400 mt-1">Um prefixo único para suas URLs de gatilho de automação. **Não afeta o Webhook principal da Meta.** Use letras, números e hífens. **Evite underscores (_)**.</p>
                    </div>
                    
                    <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-700/50">
                        {error && <p className="text-red-400 text-sm text-right flex-1">{error}</p>}
                        {isSaved && <p className="text-green-400 text-sm">Configurações salvas com sucesso!</p>}
                        <Button type="submit" variant="primary" isLoading={isSaving}>Salvar Configurações</Button>
                    </div>
                </form>
            </Card>

            <InfoCard>
                <h3 className="text-base font-semibold text-white mb-2">Configure o Webhook na Meta</h3>
                <p className="mb-3">Para receber o status das mensagens e as respostas dos clientes, configure um Webhook no seu aplicativo da Meta com os seguintes valores:</p>
                <div className="space-y-3 font-mono text-xs bg-slate-800 p-3 rounded-md">
                    <div className="flex justify-between items-center">
                        <div>
                            <span className="font-bold text-slate-300">Sua URL de Callback Única:</span>
                            <br/> {webhookUrl || "Gerando URL..."}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webhookUrl, 'url')} disabled={!webhookUrl}>
                            {copyStatus.url ? <span className="text-green-400 text-xs">Copiado!</span> : <COPY_ICON className="w-4 h-4"/>}
                        </Button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <span className="font-bold text-slate-300">Token de Verificação:</span>
                            <p className="text-slate-400 break-all">{verifyToken || "Gerando token..."}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(verifyToken, 'token')} disabled={!verifyToken}>
                            {copyStatus.token ? <span className="text-green-400 text-xs">Copiado!</span> : <COPY_ICON className="w-4 h-4"/>}
                        </Button>
                    </div>
                </div>
                 <div className="mt-3 text-xs">
                    <p>
                        <strong>Importante:</strong> Use o <strong>Token de Verificação</strong> gerado acima em <strong>dois lugares</strong>:
                    </p>
                    <ol className="list-decimal list-inside pl-2 mt-1 space-y-1">
                        <li>No campo "Verify Token" na configuração do seu webhook na Meta.</li>
                        <li>Como o valor da variável de ambiente <code className="bg-slate-900 px-1 py-0.5 rounded">META_VERIFY_TOKEN</code> no seu projeto na Vercel.</li>
                    </ol>
                    <p className="mt-2">
                        Lembre-se também de assinar os campos de webhook <code className="bg-slate-900 px-1 py-0.5 rounded">messages</code> para que tudo funcione corretamente.
                    </p>
                 </div>
            </InfoCard>
        </div>
    );
};

export default MetaSettings;
