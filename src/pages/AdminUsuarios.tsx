import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  UserCheck, 
  UserX, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  UserCog,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  ArrowRight,
  Database
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  isWithinInterval, 
  subDays, 
  startOfDay, 
  endOfDay 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/ui/Toast';
import { Dialog } from '../components/ui/Dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  getUsuarios, 
  saveUsuario, 
  toggleStatusUsuario, 
  deleteUsuario, 
  getPesquisasByServidor,
  getRegioes,
  getUsuarioById
} from '../services/storage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { 
  sbSaveUsuario, 
  sbToggleStatusUsuario, 
  sbDeleteUsuario 
} from '../services/supabaseService';
import { isSupabaseEnabled } from '../lib/supabase';
import { Usuario } from '../types';
import { cn } from '../lib/utils';
import { uuid } from '../utils/calculos';

// --- Types & Schemas ---

const userSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  cargo: z.string().min(1, "Cargo é obrigatório"),
  email: z.string().email("Email inválido"),
  perfil: z.enum(["admin", "supervisor", "servidor"]),
  supervisor_id: z.string().optional().nullable(),
  regiao: z.string().optional().nullable(),
  meta_semanal: z.number().min(1, "Mínimo 1").optional().default(20),
  senha: z.string().min(4, "Mínimo 4 caracteres")
});

type UserFormData = {
  nome: string;
  cargo: string;
  email: string;
  perfil: "admin" | "supervisor" | "servidor";
  supervisor_id?: string | null;
  regiao?: string | null;
  meta_semanal?: number;
  senha: string;
};

// --- Constants ---

const PALAVRAS = [
  "Azul", "Campo", "Forte", "Norte", "Verde", "Luz", "Sol", "Rio", "Mar", "Terra",
  "Vida", "Paz", "Amor", "Céu", "Flor", "Vento", "Pedra", "Ouro", "Prata", "Bronze"
];

const gerarSenhaProvisoria = () => {
  const p1 = PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  const p2 = PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)];
  return `${p1}${num}${p2}`;
};

// --- Components ---

export function AdminUsuarios() {
  const { success, error: toastError, warning } = useToast();
  const { usuarios: dbUsuarios, isLoading, fonte, refresh: refreshDb } = useSupabaseData();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<"todos" | "ativos" | "inativos" | "pendentes">("todos");
  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("all");
  const [pagina, setPagina] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState<string | null>(null);

  const itensPorPagina = 10;

  // Load data
  const refreshData = () => {
    if (fonte === 'supabase') {
      setUsuarios(dbUsuarios);
    } else {
      setUsuarios(getUsuarios());
    }
  };

  useEffect(() => {
    refreshData();
  }, [dbUsuarios, fonte]);

  // Filtered & Sorted Users
  const filteredUsers = useMemo(() => {
    let result = [...usuarios];

    // Aba filter
    if (abaAtiva === "ativos") result = result.filter(u => u.ativo);
    if (abaAtiva === "inativos") result = result.filter(u => !u.ativo);
    if (abaAtiva === "pendentes") {
      const sevenDaysAgo = subDays(new Date(), 7);
      result = result.filter(u => parseISO(u.data_criacao) >= sevenDaysAgo);
    }

    // Search filter
    if (busca) {
      const b = busca.toLowerCase();
      result = result.filter(u => 
        u.nome.toLowerCase().includes(b) || 
        u.email.toLowerCase().includes(b)
      );
    }

    // Perfil filter
    if (filtroPerfil !== "all") {
      result = result.filter(u => u.perfil === filtroPerfil);
    }

    // Sorting: Admin > Supervisor > Servidor, then alphabetical
    const perfilOrder = { admin: 0, supervisor: 1, servidor: 2 };
    return result.sort((a, b) => {
      if (perfilOrder[a.perfil] !== perfilOrder[b.perfil]) {
        return perfilOrder[a.perfil] - perfilOrder[b.perfil];
      }
      return a.nome.localeCompare(b.nome);
    });
  }, [usuarios, abaAtiva, busca, filtroPerfil]);

  // Pagination
  const totalPaginas = Math.ceil(filteredUsers.length / itensPorPagina);
  const paginatedUsers = filteredUsers.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina
  );

  // Metrics
  const metrics = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter(u => u.ativo).length;
    const taxaAtividade = total > 0 ? Math.round((ativos / total) * 100) : 0;
    const novos30 = usuarios.filter(u => parseISO(u.data_criacao) >= subDays(new Date(), 30)).length;
    
    const breakdown = {
      admin: usuarios.filter(u => u.perfil === "admin").length,
      supervisor: usuarios.filter(u => u.perfil === "supervisor").length,
      servidor: usuarios.filter(u => u.perfil === "servidor").length,
    };

    return { total, ativos, taxaAtividade, novos30, breakdown };
  }, [usuarios]);

  // Handlers
  const handleToggleStatus = async (id: string) => {
    const u = usuarios.find(u => u.id === id);
    if (u?.ativo) {
      setShowDeactivateDialog(id);
    } else {
      if (fonte === 'supabase') {
        await sbToggleStatusUsuario(id, true);
        await refreshDb();
      } else {
        toggleStatusUsuario(id);
        refreshData();
      }
      success("Usuário reativado com sucesso!");
    }
    setOpenDropdownId(null);
  };

  const confirmDeactivate = async () => {
    if (showDeactivateDialog) {
      if (fonte === 'supabase') {
        await sbToggleStatusUsuario(showDeactivateDialog, false);
        await refreshDb();
      } else {
        toggleStatusUsuario(showDeactivateDialog);
        refreshData();
      }
      success("Usuário desativado com sucesso!");
      setShowDeactivateDialog(null);
    }
  };

  const confirmDelete = async () => {
    if (showDeleteDialog) {
      if (fonte === 'supabase') {
        await sbDeleteUsuario(showDeleteDialog);
        await refreshDb();
      } else {
        deleteUsuario(showDeleteDialog);
        refreshData();
      }
      success("Usuário excluído com sucesso!");
      setShowDeleteDialog(null);
    }
  };

  const handleDelete = (id: string) => {
    const pesquisas = getPesquisasByServidor(id);
    if (pesquisas.length > 0) {
      warning(`Não é possível excluir — ${pesquisas.length} pesquisas vinculadas.`);
      return;
    }
    setShowDeleteDialog(id);
    setOpenDropdownId(null);
  };

  const handleOpenModal = (user: Usuario | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
    setOpenDropdownId(null);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Usuários</h1>
          <p className="text-slate-500 text-sm">Controle de acessos e permissões do sistema</p>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1a3a5b] text-white rounded-xl font-bold text-sm hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
        >
          <UserPlus className="size-4" />
          Novo Usuário
        </button>
      </div>

      {isSupabaseEnabled() && (
        <div className={cn(
          "flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-lg w-fit",
          fonte === 'supabase'
            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
            : "bg-amber-50 text-amber-600 border border-amber-100"
        )}>
          <Database className="size-3" />
          {fonte === 'supabase' ? 'Dados em tempo real (Supabase)' : 'Dados locais (offline)'}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <UserCheck className="size-5 text-emerald-600" />
            </div>
            <span className="text-2xl font-black text-slate-900">{metrics.taxaAtividade}%</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Taxa de Atividade</p>
          <p className="text-xs text-slate-500">{metrics.ativos} de {metrics.total} usuários ativos</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <UserPlus className="size-5 text-blue-600" />
            </div>
            <span className="text-2xl font-black text-slate-900">{metrics.novos30}</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Novas Contas</p>
          <p className="text-xs text-slate-500">Usuários criados nos últimos 30 dias</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-slate-50 rounded-lg">
              <Users className="size-5 text-slate-600" />
            </div>
            <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Usuários</p>
          <p className="text-[10px] text-slate-500 font-medium">
            {metrics.breakdown.admin} admins • {metrics.breakdown.supervisor} supervisores • {metrics.breakdown.servidor} servidores
          </p>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl">
            <TabButton 
              active={abaAtiva === "todos"} 
              onClick={() => { setAbaAtiva("todos"); setPagina(1); }}
              label="Todos"
              count={usuarios.length}
            />
            <TabButton 
              active={abaAtiva === "ativos"} 
              onClick={() => { setAbaAtiva("ativos"); setPagina(1); }}
              label="Ativos"
              count={usuarios.filter(u => u.ativo).length}
            />
            <TabButton 
              active={abaAtiva === "inativos"} 
              onClick={() => { setAbaAtiva("inativos"); setPagina(1); }}
              label="Inativos"
              count={usuarios.filter(u => !u.ativo).length}
            />
            <TabButton 
              active={abaAtiva === "pendentes"} 
              onClick={() => { setAbaAtiva("pendentes"); setPagina(1); }}
              label="Pendentes"
              count={usuarios.filter(u => parseISO(u.data_criacao) >= subDays(new Date(), 7)).length}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar por nome ou email..."
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 w-full md:w-64"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <select 
                value={filtroPerfil}
                onChange={(e) => { setFiltroPerfil(e.target.value); setPagina(1); }}
                className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer"
              >
                <option value="all">Todos os Perfis</option>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="servidor">Servidor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Usuário</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Cargo / Perfil</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Último Acesso</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 border-2 border-white shadow-sm">
                        {u.initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{u.nome}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{u.cargo}</span>
                      <PerfilBadge perfil={u.perfil} />
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className={cn("size-2 rounded-full", u.ativo ? "bg-emerald-500" : "bg-slate-300")} />
                      <span className={cn("text-xs font-bold", u.ativo ? "text-emerald-600" : "text-slate-400")}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-[10px] text-slate-400 font-medium">
                      criado em {format(parseISO(u.data_criacao), "dd/MM/yy")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button 
                      onClick={() => setOpenDropdownId(openDropdownId === u.id ? null : u.id)}
                      className="p-2 text-slate-400 hover:text-[#1a3a5b] hover:bg-[#1a3a5b]/5 rounded-lg transition-all"
                    >
                      <MoreVertical className="size-4" />
                    </button>

                    <AnimatePresence>
                      {openDropdownId === u.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-6 top-12 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden"
                          >
                            <DropdownItem icon={Edit2} label="Editar" onClick={() => handleOpenModal(u)} />
                            <DropdownItem 
                              icon={u.ativo ? UserX : UserCheck} 
                              label={u.ativo ? "Desativar" : "Reativar"} 
                              onClick={() => handleToggleStatus(u.id)}
                              variant={u.ativo ? "danger" : "success"}
                            />
                            <div className="h-px bg-slate-100 my-1" />
                            <DropdownItem icon={Trash2} label="Excluir" onClick={() => handleDelete(u.id)} variant="danger" />
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))}
              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPaginas > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Mostrando {(pagina - 1) * itensPorPagina + 1} - {Math.min(pagina * itensPorPagina, filteredUsers.length)} de {filteredUsers.length}
            </span>
            <div className="flex items-center gap-2">
              <button 
                disabled={pagina === 1}
                onClick={() => setPagina(p => p - 1)}
                className="p-2 text-slate-400 hover:text-[#1a3a5b] disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="size-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                  <button 
                    key={p}
                    onClick={() => setPagina(p)}
                    className={cn(
                      "size-8 rounded-lg text-xs font-bold transition-all",
                      pagina === p ? "bg-[#1a3a5b] text-white" : "text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button 
                disabled={pagina === totalPaginas}
                onClick={() => setPagina(p => p + 1)}
                className="p-2 text-slate-400 hover:text-[#1a3a5b] disabled:opacity-30 transition-all"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <UserModal 
            user={editingUser} 
            supervisors={usuarios.filter(u => u.perfil === 'supervisor')}
            onClose={() => setIsModalOpen(false)} 
            onSuccess={(msg) => {
              refreshData();
              success(msg);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        isOpen={!!showDeleteDialog}
        onClose={() => setShowDeleteDialog(null)}
        onConfirm={confirmDelete}
        title="Excluir Usuário?"
        description="Tem certeza que deseja excluir este usuário permanentemente? Esta ação não pode ser desfeita."
        confirmText="Sim, Excluir"
        variant="danger"
      />

      {/* Deactivate Confirmation Dialog */}
      <Dialog 
        isOpen={!!showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(null)}
        onConfirm={confirmDeactivate}
        title="Desativar Usuário?"
        description="O usuário perderá o acesso ao sistema imediatamente, mas seus dados e pesquisas serão preservados."
        confirmText="Sim, Desativar"
        variant="danger"
      />
    </div>
  );
}

// --- Sub-components ---

function TabButton({ active, onClick, label, count }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
        active ? "bg-white text-[#1a3a5b] shadow-sm" : "text-slate-400 hover:text-slate-600"
      )}
    >
      {label}
      <span className={cn(
        "px-1.5 py-0.5 rounded-md text-[10px]",
        active ? "bg-[#1a3a5b]/10 text-[#1a3a5b]" : "bg-slate-200 text-slate-500"
      )}>
        {count}
      </span>
    </button>
  );
}

function PerfilBadge({ perfil }: { perfil: string }) {
  const configs: any = {
    admin: { label: "ADMINISTRADOR", color: "bg-slate-900 text-white" },
    supervisor: { label: "SUPERVISOR", color: "bg-blue-100 text-blue-700" },
    servidor: { label: "SERVIDOR", color: "bg-amber-100 text-amber-700" }
  };
  const config = configs[perfil] || configs.servidor;
  return (
    <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider", config.color)}>
      {config.label}
    </span>
  );
}

function DropdownItem({ icon: Icon, label, onClick, variant = "default" }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-xs font-bold transition-all",
        variant === "danger" ? "text-rose-600 hover:bg-rose-50" : 
        variant === "success" ? "text-emerald-600 hover:bg-emerald-50" :
        "text-slate-600 hover:bg-slate-50"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function UserModal({ user, supervisors, onClose, onSuccess }: { user: Usuario | null, supervisors: Usuario[], onClose: () => void, onSuccess: (msg: string) => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [senhaProvisoria] = useState(() => gerarSenhaProvisoria());
  const { usuarios: dbUsuarios, fonte, refresh: refreshDb } = useSupabaseData();
  const allSupervisors = supervisors;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: user ? {
      nome: user.nome,
      cargo: user.cargo,
      email: user.email,
      perfil: user.perfil,
      supervisor_id: user.supervisor_id,
      regiao: user.regiao,
      meta_semanal: user.meta_semanal || 20,
      senha: user.senha
    } : {
      perfil: "servidor",
      meta_semanal: 20,
      senha: senhaProvisoria
    }
  });

  const perfil = watch("perfil");

  const onSubmit = async (data: UserFormData) => {
    const currentUsuarios = fonte === 'supabase' ? dbUsuarios : getUsuarios();

    // Verificar email duplicado
    const duplicate = currentUsuarios.find(
      u => u.email.toLowerCase() === data.email.toLowerCase() && u.id !== user?.id
    );
    if (duplicate) {
      toastError('Este email já está cadastrado no sistema.');
      return;
    }

    const newUser: Usuario = {
      id: user?.id || uuid(),
      nome: data.nome,
      cargo: data.cargo,
      email: data.email,
      senha: data.senha,
      perfil: data.perfil,
      initials: data.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      ativo: user ? user.ativo : true,
      data_criacao: user ? user.data_criacao : new Date().toISOString(),
      supervisor_id: data.perfil === 'servidor' && data.supervisor_id
        ? data.supervisor_id
        : undefined,
      regiao: data.perfil === 'servidor' ? (data.regiao || undefined) : undefined,
      meta_semanal: data.perfil === 'servidor' ? (data.meta_semanal || 20) : undefined,
      equipe: data.perfil === 'supervisor' ? (user?.equipe || []) : undefined,
    };

    try {
      if (fonte === 'supabase') {
        await sbSaveUsuario(newUser);
        await refreshDb();
      } else {
        saveUsuario(newUser);
      }
      // Também salva sempre no localStorage como cache
      saveUsuario(newUser);

      onSuccess(user ? 'Usuário atualizado com sucesso!' : `Usuário criado! Email: ${data.email}`);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      toastError('Erro ao salvar. Tente novamente.');
    }
  };

  const copyPassword = () => {
    const pass = watch("senha");
    navigator.clipboard.writeText(pass);
    toastSuccess("Senha copiada para a área de transferência!");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              {user ? <UserCog className="size-5 text-[#1a3a5b]" /> : <UserPlus className="size-5 text-[#1a3a5b]" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user ? `Editar ${user.nome}` : "Novo Usuário"}</h2>
              <p className="text-xs text-slate-500">Preencha as informações de acesso</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-white rounded-lg transition-all">
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome Completo</label>
              <input 
                {...register("nome")}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 transition-all",
                  errors.nome ? "border-rose-300" : "border-slate-200"
                )}
                placeholder="Ex: João Silva"
              />
              {errors.nome && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargo</label>
              <input 
                {...register("cargo")}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 transition-all",
                  errors.cargo ? "border-rose-300" : "border-slate-200"
                )}
                placeholder="Ex: Agente de Campo"
              />
              {errors.cargo && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.cargo.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
              <input 
                {...register("email")}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 transition-all",
                  errors.email ? "border-rose-300" : "border-slate-200"
                )}
                placeholder="joao@exemplo.com"
              />
              {errors.email && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Perfil de Acesso</label>
              <select 
                {...register("perfil")}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 appearance-none cursor-pointer"
              >
                <option value="servidor">Servidor</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          {perfil === "servidor" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Supervisor <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <select 
                  {...register("supervisor_id")}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10"
                >
                  <option value="">Sem supervisor (definir depois)</option>
                  {allSupervisors.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Região</label>
                <select 
                  {...register("regiao")}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10"
                >
                  <option value="">Selecione...</option>
                  {getRegioes().map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Meta Semanal</label>
                <input 
                  type="number"
                  {...register("meta_semanal", { valueAsNumber: true })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10"
                />
              </div>
            </motion.div>
          )}

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha de Acesso</label>
              {!user && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Gerada automaticamente</span>}
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                {...register("senha")}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-all"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button 
                  type="button"
                  onClick={copyPassword}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8 flex items-center justify-end gap-3 border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-8 py-2.5 bg-[#1a3a5b] text-white rounded-xl font-bold text-sm hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
            >
              {user ? "Salvar Alterações" : "Criar Usuário"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
