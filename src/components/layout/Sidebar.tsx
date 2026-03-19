import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  ClipboardList, 
  History, 
  Target, 
  FileSearch, 
  Users, 
  Map as MapIcon, 
  LayoutDashboard, 
  Database, 
  TrendingUp, 
  Settings2, 
  UserCog, 
  FileDown,
  LogOut,
  Mic,
  Menu,
  X,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import { useToast } from '../ui/Toast';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Usuario } from '../../types';

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { user, logout, isAdmin, isSupervisor } = useAuth();
  const { pendentesCount, isSyncing, sincronizar, isOnline, lastSyncTime } = useSync();
  const { success, error: toastError } = useToast();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: Event) => {
      const { sincronizadas, erros, errorMessages } = (e as CustomEvent).detail;
      if (sincronizadas > 0)
        success(`${sincronizadas} pesquisa${sincronizadas > 1 ? 's' : ''} sincronizada${sincronizadas > 1 ? 's' : ''}!`);
      if (erros > 0) {
        const msg = errorMessages && errorMessages.length > 0 ? ` Motivo: ${errorMessages[0]}` : '';
        toastError(`${erros} pesquisa${erros > 1 ? 's' : ''} não ${erros > 1 ? 'puderam' : 'pôde'} ser sincronizada${erros > 1 ? 's' : ''}.${msg}`);
      }
    };
    window.addEventListener('sync-resultado', handler);
    return () => window.removeEventListener('sync-resultado', handler);
  }, [success, toastError]);

  const menuItems = [
    { label: 'Nova Pesquisa', href: '/nova-pesquisa', icon: ClipboardList, access: ['admin', 'supervisor', 'servidor'] },
    { label: 'Meu Histórico', href: '/historico', icon: History, access: ['admin', 'supervisor', 'servidor'] },
    { label: 'Minha Meta', href: '/minha-meta', icon: Target, access: ['admin', 'supervisor', 'servidor'] },
  ];

  const teamItems = [
    { label: 'Pesquisas da Equipe', href: '/equipe/pesquisas', icon: FileSearch, access: ['admin', 'supervisor'] },
    { label: 'Desempenho', href: '/equipe/desempenho', icon: Users, access: ['admin', 'supervisor'] },
    { label: 'Regiões', href: '/equipe/regioes', icon: MapIcon, access: ['admin', 'supervisor'] },
  ];

  const adminItems = [
    { label: 'Dashboard Geral', href: '/admin/dashboard', icon: LayoutDashboard, access: ['admin'] },
    { label: 'Todas as Pesquisas', href: '/admin/pesquisas', icon: Database, access: ['admin'] },
    { label: 'Performance Geral', href: '/admin/performance', icon: TrendingUp, access: ['admin'] },
    { label: 'Metas da Equipe', href: '/admin/metas', icon: Target, access: ['admin'] },
    { label: 'Editor de Formulário', href: '/admin/formulario', icon: Settings2, access: ['admin'] },
    { label: 'Gerenciar Regiões', href: '/admin/regioes', icon: MapIcon, access: ['admin'] },
    { label: 'Gerenciar Usuários', href: '/admin/usuarios', icon: UserCog, access: ['admin'] },
    { label: 'Relatórios', href: '/admin/relatorios', icon: FileDown, access: ['admin'] },
  ];

  const filterAccess = (items: typeof menuItems) => 
    items.filter(item => user && item.access.includes(user.perfil));

  return (
    <aside 
      data-sidebar
      className={cn(
        "w-64 bg-[#1a3a5b] text-white flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 no-print",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="p-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-[#F0A500] rounded-lg p-2 flex items-center justify-center">
            <Mic className="text-[#1a3a5b] size-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none tracking-tight uppercase">Escuta Ativa</h1>
            <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Portal Admin</span>
          </div>
        </div>
        <button onClick={onClose} className="md:hidden p-1 text-white/40 hover:text-white">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
        <div className="space-y-1">
          {filterAccess(menuItems).map((item) => (
            <SidebarItem key={item.href} {...item} active={location.pathname === item.href} onClick={onClose} />
          ))}
        </div>

        {(isAdmin() || isSupervisor()) && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Equipe</p>
            {filterAccess(teamItems).map((item) => (
              <SidebarItem key={item.href} {...item} active={location.pathname === item.href} onClick={onClose} />
            ))}
          </div>
        )}

        {isAdmin() && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Administração</p>
            {filterAccess(adminItems).map((item) => (
              <SidebarItem key={item.href} {...item} active={location.pathname === item.href} onClick={onClose} />
            ))}
          </div>
        )}

        <div className="mx-3 mb-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="size-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="size-3.5 text-rose-400" />
              )}
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                isOnline ? "text-emerald-400" : "text-rose-400"
              )}>
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
            {pendentesCount > 0 && (
              <span className="bg-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-[#1a3a5b]">
                {pendentesCount}
              </span>
            )}
          </div>

          {pendentesCount > 0 && (
            <button
              onClick={sincronizar}
              disabled={isSyncing || !isOnline}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold text-[#1a3a5b] transition-all disabled:opacity-50 mb-3"
            >
              <RefreshCw className={cn("size-3", isSyncing && "animate-spin")} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
            </button>
          )}

          {lastSyncTime && (
            <p className="text-[9px] text-white/40 text-center">
              Último sync: {format(lastSyncTime, "HH:mm:ss", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-white/10 bg-[#152e48]">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-full bg-[#F0A500] flex items-center justify-center text-[#1a3a5b] font-bold text-sm">
            {user?.initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold truncate">{user?.nome}</span>
            <span className="text-[10px] text-white/60 truncate">{user?.cargo}</span>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
        >
          <LogOut className="size-4" />
          Sair do Sistema
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ label, href, icon: Icon, active, onClick }: any) {
  return (
    <NavLink
      to={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
        active 
          ? "bg-white/10 border-l-4 border-[#F0A500] text-white" 
          : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </NavLink>
  );
}
