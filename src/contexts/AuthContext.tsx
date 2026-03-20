import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Usuario } from '../types';
import { getUsuarios, saveUsuario } from '../services/storage';
import { sbGetUsuarios } from '../services/supabaseService';
import { isSupabaseEnabled } from '../lib/supabase';

interface AuthContextType {
  user: Usuario | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: () => boolean;
  isSupervisor: () => boolean;
  isServidor: () => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('ea_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('ea_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, senha: string): Promise<boolean> => {
    // 1. Tenta encontrar localmente primeiro (rápido para quem já usou o app)
    let allUsers = getUsuarios();
    let foundUser = allUsers.find(u => u.email === email && u.senha === senha && u.ativo);

    // 2. Se não encontrou e o Supabase está ativado, tenta buscar do banco
    // Isso resolve o problema de novos usuários que ainda não sincronizaram o cache local
    if (!foundUser && isSupabaseEnabled()) {
      try {
        const sbUsers = await sbGetUsuarios();
        if (sbUsers) {
          // Salva todos os usuários retornados no cache local
          sbUsers.forEach(u => saveUsuario(u));
          
          // Tenta encontrar novamente na lista recém baixada
          foundUser = sbUsers.find(u => u.email === email && u.senha === senha && u.ativo);
        }
      } catch (e) {
        console.error('[Auth] Erro ao buscar usuários do Supabase no login:', e);
      }
    }

    if (foundUser) {
      const { senha: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword as Usuario);
      localStorage.setItem('ea_user', JSON.stringify(userWithoutPassword));
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ea_user');
    navigate('/login');
  };

  const isAdmin = () => user?.perfil === 'admin';
  const isSupervisor = () => user?.perfil === 'supervisor';
  const isServidor = () => user?.perfil === 'servidor';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isSupervisor, isServidor, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
