import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Usuario } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  perfisPermitidos?: Usuario['perfil'][];
}

export function ProtectedRoute({ children, perfisPermitidos }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3a5b]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (perfisPermitidos && !perfisPermitidos.includes(user.perfil)) {
    // Redirection logic based on profile
    if (user.perfil === 'servidor') {
      return <Navigate to="/minha-meta" replace />;
    }
    if (user.perfil === 'supervisor') {
      return <Navigate to="/equipe/desempenho" replace />;
    }
    // Default for admin or others
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
