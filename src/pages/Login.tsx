import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Waves, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(4, 'A senha deve ter no mínimo 4 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function Login() {
  const { user, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already logged in
  if (!authLoading && user) {
    const redirectPath = user.perfil === 'admin' 
      ? '/admin/dashboard' 
      : user.perfil === 'supervisor' 
        ? '/equipe/desempenho' 
        : '/minha-meta';
    return <Navigate to={redirectPath} replace />;
  }

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const success = await login(data.email, data.password);
      
      if (success) {
        // Redirection logic is handled by the useEffect or the Navigate above
        // But for immediate response:
        const savedUser = JSON.parse(localStorage.getItem('ea_user') || '{}');
        const path = savedUser.perfil === 'admin' 
          ? '/admin/dashboard' 
          : savedUser.perfil === 'supervisor' 
            ? '/equipe/desempenho' 
            : '/minha-meta';
        navigate(path);
      } else {
        setError('E-mail ou senha incorretos');
      }
    } catch (err) {
      setError('Ocorreu um erro ao tentar entrar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F2F5F8] min-h-screen flex items-center justify-center p-4">
      <div className="w-[420px] max-w-[90vw] bg-white rounded-2xl shadow-xl overflow-hidden border-t-[4px] border-[#F0A500] animate-in fade-in zoom-in duration-300">
        <div className="px-8 pt-10 pb-12">
          <div className="flex flex-col items-center mb-10">
            <div className="flex items-center gap-3 mb-2">
              <Waves className="text-[#1a3a5b] size-10" />
              <h1 className="text-[#1a3a5b] text-2xl font-bold tracking-tight">
                Escuta Ativa
              </h1>
            </div>
            <p className="text-slate-500 text-sm font-medium">
              Acesso restrito a agentes autorizados
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-600 text-sm animate-in slide-in-from-top-2">
              <AlertCircle className="size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="email">
                E-mail
              </label>
              <input 
                {...register('email')}
                className={cn(
                  "block w-full px-4 py-3 rounded-xl border bg-white text-slate-900 outline-none transition-all placeholder:text-slate-400",
                  errors.email ? "border-rose-300 focus:ring-rose-100" : "border-slate-300 focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b]"
                )}
                id="email" 
                placeholder="seu@email.com.br" 
              />
              {errors.email && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="password">
                Senha
              </label>
              <div className="relative">
                <input 
                  {...register('password')}
                  className={cn(
                    "block w-full px-4 py-3 rounded-xl border bg-white text-slate-900 outline-none transition-all placeholder:text-slate-400",
                    errors.password ? "border-rose-300 focus:ring-rose-100" : "border-slate-300 focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b]"
                  )}
                  id="password" 
                  placeholder="Digite sua senha" 
                  type={showPassword ? 'text' : 'password'} 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#1a3a5b] transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.password.message}</p>}
            </div>

            <div className="pt-2">
              <button 
                disabled={isSubmitting}
                className="w-full bg-[#1a3a5b] hover:bg-[#1a3a5b]/90 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:transform active:scale-[0.98] flex items-center justify-center gap-2" 
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Entrando...
                  </>
                ) : 'Entrar'}
              </button>
            </div>

            <div className="text-center mt-6">
              <a className="text-sm font-medium text-[#1a3a5b] hover:underline" href="#">
                Esqueci minha senha
              </a>
            </div>
          </form>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
            <span>Versão 2.4.0</span>
            <span className="flex items-center gap-1">
              <AlertCircle className="size-3" />
              Ambiente Seguro
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
