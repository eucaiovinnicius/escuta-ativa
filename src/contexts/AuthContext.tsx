import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Usuario } from '../types';
import { getUsuarios } from '../services/storage';

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
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const allUsers = getUsuarios();
    const foundUser = allUsers.find(u => u.email === email && u.senha === senha && u.ativo);

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
