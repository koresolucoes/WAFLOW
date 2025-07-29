import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ZAPFLOW_AI_LOGO, GOOGLE_ICON } from '../../components/icons';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useUiStore } from '../../stores/uiStore';

type AuthView = 'login' | 'signup' | 'reset_password';

const Auth: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<HCaptcha>(null);
  const theme = useUiStore(state => state.theme);
  
  const sitekey = (import.meta as any).env.VITE_HCAPTCHA_SITEKEY;

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!sitekey) {
        setError("A chave do site hCaptcha não está configurada. A autenticação está desativada.");
        setLoading(false);
        return;
    }

    if (!captchaToken) {
        setError("Por favor, complete o CAPTCHA para continuar.");
        setLoading(false);
        return;
    }

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
        if (error) throw error;
      } else if (view === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { captchaToken, data: { company_name: 'Minha Empresa' } } });
        if (error) throw error;
        setMessage("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
      } else if (view === 'reset_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin, captchaToken });
        if (error) throw error;
        setMessage("Instruções para redefinição de senha enviadas para o seu e-mail.");
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
      captcha.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  };
  
  const handleOAuthLogin = async (provider: 'google') => {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) {
          setError(error.message);
          setLoading(false);
      }
  };

  const switchView = (newView: AuthView) => {
      setEmail('');
      setPassword('');
      setError(null);
      setMessage(null);
      captcha.current?.resetCaptcha();
      setCaptchaToken(null);
      setView(newView);
  };

  const titles = {
      login: 'Bem-vindo de volta!',
      signup: 'Crie sua conta',
      reset_password: 'Redefinir Senha'
  };
  const descriptions = {
      login: 'Faça login para continuar.',
      signup: 'Comece a otimizar suas campanhas.',
      reset_password: 'Digite seu e-mail para receber as instruções.'
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="flex items-center space-x-3 mb-8">
        {ZAPFLOW_AI_LOGO}
        <span className="text-3xl font-bold text-gray-900 dark:text-white">ZapFlow AI</span>
      </div>
      
      <Card className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
          {titles[view]}
        </h2>
        <p className="text-center text-gray-500 dark:text-slate-400 mb-6">
            {descriptions[view]}
        </p>

        {view !== 'reset_password' && (
             <>
                <Button variant="secondary" className="w-full mb-4 border border-gray-300 dark:border-slate-600" onClick={() => handleOAuthLogin('google')} disabled={loading}>
                    <GOOGLE_ICON className="w-5 h-5 mr-3"/>
                    Continuar com Google
                </Button>
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-300 dark:border-slate-600" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-800 px-2 text-gray-500 dark:text-slate-400">Ou continue com</span>
                    </div>
                </div>
             </>
        )}
       

        <form onSubmit={handlePasswordAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1" htmlFor="email">E-mail</label>
            <input id="email" className="w-full bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {view !== 'reset_password' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1" htmlFor="password">Senha</label>
                <input id="password" className="w-full bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-white" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
          )}
          
          {view === 'login' && (
            <div className="text-right">
                <button type="button" onClick={() => switchView('reset_password')} className="text-xs text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:underline">Esqueceu a senha?</button>
            </div>
          )}

          <div className="my-2 flex justify-center">
             {sitekey ? (
                  <HCaptcha ref={captcha} sitekey={sitekey} theme={theme} onVerify={(token) => { setCaptchaToken(token); setError(null); }} onExpire={() => setCaptchaToken(null)} onError={(err) => setError(`Erro no CAPTCHA: ${err}`)} />
            ) : (
              <div className="text-center text-red-500 dark:text-red-400 text-sm p-3 bg-red-100/50 dark:bg-red-500/10 rounded-md border border-red-200 dark:border-red-500/30">
                O CAPTCHA não pôde ser carregado. A autenticação está desativada.
              </div>
            )}
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
          {message && <p className="text-green-500 dark:text-green-400 text-sm text-center">{message}</p>}
          <Button type="submit" className="w-full" isLoading={loading} size="lg" disabled={loading || !sitekey}>
            {view === 'login' ? 'Entrar' : view === 'signup' ? 'Cadastrar' : 'Enviar Instruções'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => switchView(view === 'login' ? 'signup' : 'login')} className="text-sm text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:underline">
            {view === 'login' ? 'Não tem uma conta? Cadastre-se' : view === 'signup' ? 'Já tem uma conta? Faça login' : 'Lembrou a senha? Voltar para o Login'}
          </button>
        </div>
      </Card>
      <p className="text-xs text-gray-500 dark:text-slate-500 mt-8">© 2024 ZapFlow AI. Todos os direitos reservados.</p>
    </div>
  );
};

export default Auth;