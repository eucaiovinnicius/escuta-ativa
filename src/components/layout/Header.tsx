import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X, Bell, RefreshCw, User as UserIcon, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { isOnline, isSyncing, pendentesCount, lastSyncTime } = useSync();
  const location = useLocation();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const getBreadcrumb = () => {
    const path = location.pathname;
    const map: Record<string, string> = {
      '/admin/dashboard': 'Dashboard Geral',
      '/admin/usuarios': 'Gerenciar Usuários',
      '/admin/regioes': 'Gerenciar Regiões',
      '/admin/formulario': 'Editor de Formulário',
      '/admin/performance': 'Performance Geral',
      '/admin/metas': 'Metas da Equipe',
      '/admin/relatorios': 'Relatórios',
      '/admin/pesquisas': 'Todas as Pesquisas',
      '/equipe/desempenho': 'Desempenho da Equipe',
      '/equipe/pesquisas': 'Pesquisas da Equipe',
      '/equipe/regioes': 'Regiões',
      '/nova-pesquisa': 'Nova Pesquisa',
      '/minha-meta': 'Minha Meta',
      '/historico': 'Meu Histórico',
    };
    return map[path] || 'Início';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="size-6" />
        </button>
        <div className="flex items-center gap-2 text-xs md:text-sm overflow-hidden">
          <span className="text-slate-400 hidden sm:inline shrink-0">Escuta Ativa</span>
          <span className="text-slate-300 hidden sm:inline shrink-0">›</span>
          <span className="font-semibold text-[#1a3a5b] truncate">{getBreadcrumb()}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className={cn(
          "hidden md:flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all",
          !isOnline 
            ? "text-slate-500 bg-slate-50 border-slate-200" 
            : isSyncing
              ? "text-amber-600 bg-amber-50 border-amber-100"
              : pendentesCount > 0
                ? "text-blue-600 bg-blue-50 border-blue-100"
                : "text-emerald-600 bg-emerald-50 border-emerald-100"
        )}>
          {!isOnline ? (
            <WifiOff className="size-3" />
          ) : isSyncing ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Wifi className="size-3" />
          )}
          
          <span className="uppercase tracking-wider">
            {!isOnline 
              ? "OFFLINE" 
              : isSyncing 
                ? "SINCRONIZANDO..." 
                : pendentesCount > 0
                  ? `${pendentesCount} PENDENTES`
                  : "SINCRONIZADO"}
          </span>
        </div>

        <button className="p-2 text-slate-400 hover:text-[#1a3a5b] relative">
          <Bell className="size-5" />
          <span className="absolute top-1.5 right-1.5 size-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-100 transition-all"
          >
            <div className="size-8 rounded-full bg-[#1a3a5b]/10 border border-[#1a3a5b]/20 flex items-center justify-center text-[#1a3a5b] font-bold text-xs">
              {user?.initials}
            </div>
          </button>

          {isPopoverOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsPopoverOpen(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in duration-150">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <p className="text-sm font-bold text-slate-900">{user?.nome}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="p-2">
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cargo</p>
                    <p className="text-xs font-medium text-slate-700">{user?.cargo}</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Perfil</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#F0A500]/10 text-[#F0A500] uppercase border border-[#F0A500]/20">
                      {user?.perfil}
                    </span>
                  </div>
                </div>
                <div className="p-2 border-t border-slate-100">
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <LogOut className="size-4" />
                    Sair da Conta
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
