import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ZAPFLOW_AI_LOGO } from '../../components/icons';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const Auth: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<HCaptcha>(null);
  
  const sitekey = (import.meta as any).env.VITE_HCAPTCHA_SITEKEY;

  const handleAuth = async (e: React.FormEvent) => {
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
      if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken,
          }
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                captchaToken,
                data: {
                    company_name: 'Minha Empresa', // Default values
                }
            }
        });
        if (error) throw error;
        if (!data.user) {
            throw new Error("O registo foi bem-sucedido, mas não foram retornados dados do utilizador.");
        }
        
        // **NOVO**: Chamar a função serverless para configurar a equipa
        const setupResponse = await fetch('/api/setup-new-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id, email: data.user.email })
        });

        if (!setupResponse.ok) {
            // Se a configuração falhar, informa o utilizador. O registo já aconteceu.
            // O ideal seria ter uma transação, mas isto é uma boa prática para serverless.
            const setupError = await setupResponse.json();
            throw new Error(`O registo foi bem-sucedido, mas a configuração inicial da equipa falhou: ${setupError.message}. Por favor, contacte o suporte.`);
        }

        setMessage("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
      captcha.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="flex items-center space-x-3 mb-8">
        {ZAPFLOW_AI_LOGO}
        <span className="text-3xl font-bold text-white">ZapFlow AI</span>
      </div>
      
      <Card className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center text-white mb-2">
          {isLoginView ? 'Bem-vindo de volta!' : 'Crie sua conta'}
        </h2>
        <p className="text-center text-slate-400 mb-6">
            {isLoginView ? 'Faça login para continuar.' : 'Comece a otimizar suas campanhas.'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="my-2 flex justify-center">
             {sitekey ? (
                  <HCaptcha
                      ref={captcha}
                      sitekey={sitekey}
                      theme="dark"
                      onVerify={(token) => {
                          setCaptchaToken(token);
                          setError(null);
                      }}
                      onExpire={() => {
                          setCaptchaToken(null);
                      }}
                      onError={(err) => setError(`Erro no CAPTCHA: ${err}`)}
                  />
            ) : (
              <div className="text-center text-red-400 text-sm p-3 bg-red-500/10 rounded-md border border-red-500/30">
                O CAPTCHA não pôde ser carregado. A autenticação está desativada.
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {message && <p className="text-green-400 text-sm text-center">{message}</p>}
          <Button type="submit" className="w-full" isLoading={loading} size="lg" disabled={loading || !sitekey}>
            {isLoginView ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
                setIsLoginView(!isLoginView)
                setError(null)
                setMessage(null)
                captcha.current?.resetCaptcha();
                setCaptchaToken(null);
            }}
            className="text-sm text-sky-400 hover:underline"
          >
            {isLoginView ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
          </button>
        </div>
      </Card>
      <p className="text-xs text-slate-500 mt-8">© 2024 ZapFlow AI. Todos os direitos reservados.</p>
    </div>
  );
};

export default Auth;