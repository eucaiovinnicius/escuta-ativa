import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { initUsuarios } from './services/storage';
import { ToastProvider } from './components/ui/Toast';
import { BackToTop } from './components/ui/BackToTop';
import { DashboardSkeleton, TableSkeleton } from './components/ui/Skeletons';
import { InstallPWAPrompt } from './components/pwa/InstallPWAPrompt';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const NovaPesquisa = lazy(() => import('./pages/NovaPesquisa').then(m => ({ default: m.NovaPesquisa })));
const Historico = lazy(() => import('./pages/Historico').then(m => ({ default: m.Historico })));
const EquipePesquisas = lazy(() => import('./pages/EquipePesquisas').then(m => ({ default: m.EquipePesquisas })));
const AdminPesquisas = lazy(() => import('./pages/AdminPesquisas').then(m => ({ default: m.AdminPesquisas })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminPerformance = lazy(() => import('./pages/AdminPerformance').then(m => ({ default: m.AdminPerformance })));
const AdminRelatorios = lazy(() => import('./pages/AdminRelatorios').then(m => ({ default: m.AdminRelatorios })));
const AdminFormulario = lazy(() => import('./pages/AdminFormulario').then(m => ({ default: m.AdminFormulario })));
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios').then(m => ({ default: m.AdminUsuarios })));
const AdminRegioes = lazy(() => import('./pages/AdminRegioes').then(m => ({ default: m.AdminRegioes })));
const AdminMetas = lazy(() =>
  import('./pages/AdminMetas').then(m => ({ default: m.AdminMetas }))
);
const MinhaMetaPage = lazy(() => import('./pages/MinhaMetaPage').then(m => ({ default: m.MinhaMetaPage })));
const EquipeDesempenho = lazy(() => import('./pages/EquipeDesempenho').then(m => ({ default: m.EquipeDesempenho })));
const EquipeRegioes = lazy(() => import('./pages/EquipeRegioes').then(m => ({ default: m.EquipeRegioes })));

export default function App() {
  useEffect(() => {
    initUsuarios();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route element={<AppLayout />}>
              {/* Todos os perfis */}
              <Route path="/minha-meta" element={
                <ProtectedRoute perfisPermitidos={['admin', 'supervisor', 'servidor']}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <MinhaMetaPage />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/nova-pesquisa" element={
                <ProtectedRoute perfisPermitidos={['admin', 'supervisor', 'servidor']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <NovaPesquisa />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/historico" element={
                <ProtectedRoute perfisPermitidos={['admin', 'supervisor', 'servidor']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <Historico />
                  </Suspense>
                </ProtectedRoute>
              } />

              {/* Supervisor + Admin */}
              <Route path="/equipe/pesquisas" element={
                <ProtectedRoute perfisPermitidos={['admin', 'supervisor']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <EquipePesquisas />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/equipe/desempenho" element={
                <ProtectedRoute perfisPermitidos={['admin', 'supervisor']}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <EquipeDesempenho />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/equipe/regioes" element={
                <ProtectedRoute perfisPermitidos={['admin', 'supervisor']}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <EquipeRegioes />
                  </Suspense>
                </ProtectedRoute>
              } />

              {/* Apenas Admin */}
              <Route path="/admin/dashboard" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AdminDashboard />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/performance" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<DashboardSkeleton />}>
                    <AdminPerformance />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/relatorios" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <AdminRelatorios />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/pesquisas" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <AdminPesquisas />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/formulario" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <AdminFormulario />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/usuarios" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <AdminUsuarios />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/regioes" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <AdminRegioes />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/admin/metas" element={
                <ProtectedRoute perfisPermitidos={['admin']}>
                  <Suspense fallback={<TableSkeleton />}>
                    <AdminMetas />
                  </Suspense>
                </ProtectedRoute>
              } />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <BackToTop />
          <InstallPWAPrompt />
        </ToastProvider>
      </SyncProvider>
    </AuthProvider>
  </BrowserRouter>
  );
}
