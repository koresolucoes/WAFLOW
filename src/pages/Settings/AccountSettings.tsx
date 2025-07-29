import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import InfoCard from '../../components/common/InfoCard';

const AccountSettings: React.FC = () => {
    const { user } = useAuthStore();
    const { addToast } = useUiStore();

    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingEmail(true);
        setEmailError('');

        const { error } = await supabase.auth.updateUser({ email: newEmail });

        if (error) {
            setEmailError(error.message);
        } else {
            addToast('E-mail de confirmação enviado para o endereço antigo e o novo.', 'success');
            setNewEmail('');
        }
        setIsUpdatingEmail(false);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        if (newPassword !== confirmPassword) {
            setPasswordError('As senhas não correspondem.');
            return;
        }

        setIsUpdatingPassword(true);

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            setPasswordError(error.message);
        } else {
            addToast('Senha atualizada com sucesso!', 'success');
            setNewPassword('');
            setConfirmPassword('');
        }
        setIsUpdatingPassword(false);
    };
    
    const baseInputClass = "w-full bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white";

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alterar E-mail</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 mb-4">
                    Seu e-mail de login atual é: <span className="font-semibold text-gray-800 dark:text-white">{user?.email}</span>
                </p>
                <InfoCard variant="info" className="mb-4">
                    Para alterar seu e-mail, você precisará confirmar a alteração em ambos os endereços, o antigo e o novo.
                </InfoCard>
                <form onSubmit={handleUpdateEmail} className="space-y-3">
                    <div>
                        <label htmlFor="newEmail" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Novo E-mail</label>
                        <input
                            type="email"
                            id="newEmail"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            required
                            className={baseInputClass}
                        />
                    </div>
                     {emailError && <p className="text-red-500 dark:text-red-400 text-sm">{emailError}</p>}
                    <div className="flex justify-end">
                        <Button type="submit" variant="primary" isLoading={isUpdatingEmail}>Atualizar E-mail</Button>
                    </div>
                </form>
            </Card>

            <Card>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alterar Senha</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 mb-4">
                    Para sua segurança, recomendamos o uso de uma senha forte e única.
                </p>
                <form onSubmit={handleUpdatePassword} className="space-y-3">
                     <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Nova Senha</label>
                        <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            className={baseInputClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            className={baseInputClass}
                        />
                    </div>
                    {passwordError && <p className="text-red-500 dark:text-red-400 text-sm">{passwordError}</p>}
                    <div className="flex justify-end">
                        <Button type="submit" variant="primary" isLoading={isUpdatingPassword}>Atualizar Senha</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AccountSettings;