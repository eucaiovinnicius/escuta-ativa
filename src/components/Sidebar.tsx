import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  Map as MapIcon, 
  Settings, 
  LogOut,
  Mic
} from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar() {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Search, label: 'Pesquisas', path: '/pesquisas' },
    { icon: Users, label: 'Equipe', path: '/equipe' },
    { icon: MapIcon, label: 'Regiões', path: '/regioes' },
    { icon: Settings, label: 'Administração', path: '/admin' },
  ];

  return (
    <aside className="w-64 bg-[#1a3a5b] text-white flex flex-col fixed h-full z-50">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-[#F0A500] rounded-lg p-2 flex items-center justify-center">
            <Mic className="text-[#1a3a5b] size-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none tracking-tight uppercase">Escuta Ativa</h1>
            <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Portal Admin</span>
          </div>
        </div>
        
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium",
                isActive 
                  ? "bg-white/10 border-l-4 border-[#F0A500] text-white" 
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-2">
          <div className="size-10 rounded-full bg-cover bg-center border-2 border-white/20" 
               style={{ backgroundImage: `url('https://picsum.photos/seed/luciana/100/100')` }}>
          </div>
          <div className="flex flex-col overflow-hidden">
            <p className="text-sm font-semibold truncate">Luciana Rocha</p>
            <span className="text-[10px] font-bold bg-blue-500/30 text-blue-100 px-2 py-0.5 rounded uppercase w-fit tracking-wider">Supervisor</span>
          </div>
        </div>
        <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all">
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
