import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Eye, 
  Calendar, 
  MapPin, 
  User as UserIcon,
  Tag,
  AlertTriangle,
  Trash2,
  FileText,
  Phone,
  Mail,
  Printer,
  MoreHorizontal,
  Database
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { Dialog } from './ui/Dialog';
import { TableSkeleton } from './ui/Skeletons';
import { 
  getPesquisas, 
  getPesquisasByServidor, 
  getPesquisasBySupervisor, 
  getUsuarios, 
  getUsuarioById,
  getPerguntas,
  deletePesquisa,
  getRegioes,
  CATEGORIAS
} from '../services/storage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { sbDeletePesquisa } from '../services/supabaseService';
import { isSupabaseEnabled } from '../lib/supabase';
import { calcularUrgencia, gerarCSV } from '../utils/calculos';
import { Pesquisa, Usuario, PerguntaFormulario } from '../types';
import { cn } from '../lib/utils';

interface PesquisasListProps {
  modo: 'proprio' | 'equipe' | 'todos';
  titulo: string;
}

interface PesquisaCardProps {
  pesquisa: Pesquisa;
  onViewDetails: () => void;
  allSurveys: Pesquisa[];
}

export const PesquisaCard = React.memo(({ pesquisa, onViewDetails, allSurveys }: PesquisaCardProps) => {
  const categoria = pesquisa.respostas['categoria_principal'] || Object.values(pesquisa.respostas)[0] || 'Outro';
  
  // Urgency calculation based on same region + category
  const urgencyCount = useMemo(() => {
    return allSurveys.filter(p => 
      p.morador.regiao === pesquisa.morador.regiao && 
      (p.respostas['categoria_principal'] === categoria || Object.values(p.respostas)[0] === categoria)
    ).length;
  }, [allSurveys, pesquisa, categoria]);

  const urgencia = calcularUrgencia(urgencyCount);
  
  const urgenciaColors = {
    "Baixa": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Média": "bg-amber-50 text-amber-600 border-amber-100",
    "Alta": "bg-orange-50 text-orange-600 border-orange-100",
    "Crítica": "bg-rose-50 text-rose-600 border-rose-100"
  };

  // Find first long text answer
  const relato = useMemo(() => {
    const values = Object.values(pesquisa.respostas) as string[];
    const text = values.find(v => v.length > 50) || '';
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  }, [pesquisa.respostas]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#1a3a5b]/5 text-[#1a3a5b] text-[10px] font-bold uppercase border border-[#1a3a5b]/10">
              {pesquisa.morador.regiao}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border border-slate-200">
              {categoria}
            </span>
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", urgenciaColors[urgencia])}>
              {urgencia}
            </span>
            <span className="ml-auto md:ml-0 text-[10px] font-medium text-slate-400">
              {format(parseISO(pesquisa.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#1a3a5b] transition-colors">
              {pesquisa.morador.nome}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Phone className="size-3" />
                {pesquisa.morador.telefone}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="size-3" />
                {pesquisa.morador.endereco}
              </div>
            </div>
          </div>

          {relato && (
            <p className="text-sm text-slate-600 italic line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-lg border-l-2 border-slate-200">
              "{relato}"
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                {pesquisa.servidor_nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <span className="text-xs font-medium text-slate-500">
                Registrado por <span className="text-slate-700 font-bold">{pesquisa.servidor_nome}</span>
              </span>
            </div>
            
            <button 
              onClick={onViewDetails}
              className="flex items-center gap-2 text-sm font-bold text-[#1a3a5b] hover:underline"
            >
              Ver Detalhes
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export function PesquisasList({ modo, titulo }: PesquisasListProps) {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error } = useToast();
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  const [selectedRegiao, setSelectedRegiao] = useState(searchParams.get('regiao') || '');
  const [selectedCategoria, setSelectedCategoria] = useState(searchParams.get('categoria') || '');
  const [selectedServidor, setSelectedServidor] = useState(searchParams.get('servidor_id') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPesquisa, setSelectedPesquisa] = useState<Pesquisa | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const { pesquisas: dbPesquisas, usuarios: dbUsuarios, isLoading: dbLoading, fonte, refresh: refreshDb } = useSupabaseData();
  const itemsPerPage = 10;

  // Initial loading simulation
  useEffect(() => {
    if (!dbLoading) {
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [dbLoading]);

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (selectedRegiao) params.regiao = selectedRegiao;
    if (selectedCategoria) params.categoria = selectedCategoria;
    if (selectedServidor) params.servidor_id = selectedServidor;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    
    setSearchParams(params, { replace: true });
    setCurrentPage(1);
  }, [debouncedSearch, selectedRegiao, selectedCategoria, selectedServidor, dateFrom, dateTo, setSearchParams]);

  // Data fetching
  const allSurveys = useMemo(() => {
    if (!user) return [];
    
    let list: Pesquisa[] = [];
    if (fonte === 'supabase') {
      list = dbPesquisas;
    } else {
      list = getPesquisas();
    }

    if (modo === 'proprio') return list.filter(p => p.servidor_id === user.id);
    if (modo === 'equipe') {
      if (user.perfil === 'admin') return list; // Admin vê tudo na lista da equipe
      
      const equipeIds = (fonte === 'supabase' ? dbUsuarios : getUsuarios())
        .filter(u => u.supervisor_id === user.id || u.id === user.id)
        .map(u => u.id);
      return list.filter(p => equipeIds.includes(p.servidor_id));
    }
    return list;
  }, [user, modo, dbPesquisas, dbUsuarios, fonte]);

  const allServidores = useMemo(() => {
    const users = fonte === 'supabase' ? dbUsuarios : getUsuarios();
    if (modo === 'equipe') return users.filter(u => u.supervisor_id === user?.id && u.perfil === 'servidor');
    return users.filter(u => u.perfil === 'servidor');
  }, [modo, user, dbUsuarios, fonte]);

  // Filtering logic
  const filteredSurveys = useMemo(() => {
    return allSurveys.filter(p => {
      // Text search
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const inMorador = p.morador.nome.toLowerCase().includes(searchLower) || 
                         p.morador.regiao.toLowerCase().includes(searchLower) ||
                         p.morador.endereco.toLowerCase().includes(searchLower);
        const inRespostas = Object.values(p.respostas).some(v => String(v).toLowerCase().includes(searchLower));
        if (!inMorador && !inRespostas) return false;
      }
      
      // Region filter
      if (selectedRegiao && p.morador.regiao !== selectedRegiao) return false;
      
      // Category filter
      if (selectedCategoria) {
        const cat = p.respostas['categoria_principal'] || Object.values(p.respostas)[0] || '';
        if (cat !== selectedCategoria) return false;
      }
      
      // Server filter
      if (selectedServidor && p.servidor_id !== selectedServidor) return false;
      
      // Date filter
      if (dateFrom || dateTo) {
        const pDate = parseISO(p.timestamp);
        if (dateFrom && pDate < startOfDay(parseISO(dateFrom))) return false;
        if (dateTo && pDate > endOfDay(parseISO(dateTo))) return false;
      }
      
      return true;
    }).sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
  }, [allSurveys, debouncedSearch, selectedRegiao, selectedCategoria, selectedServidor, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const paginatedSurveys = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSurveys.slice(start, start + itemsPerPage);
  }, [filteredSurveys, currentPage]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (selectedRegiao) count++;
    if (selectedCategoria) count++;
    if (selectedServidor) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [debouncedSearch, selectedRegiao, selectedCategoria, selectedServidor, dateFrom, dateTo]);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setSelectedRegiao('');
    setSelectedCategoria('');
    setSelectedServidor('');
    setDateFrom('');
    setDateTo('');
  }, []);

  const handleExportCSV = useCallback(() => {
    try {
      gerarCSV(filteredSurveys);
      success("Exportação concluída com sucesso!");
    } catch (e) {
      error("Falha ao exportar arquivo.");
    }
  }, [filteredSurveys, success, error]);

  const handleDelete = useCallback(async (id: string) => {
    if (fonte === 'supabase') {
      await sbDeletePesquisa(id);
      await refreshDb();
    } else {
      deletePesquisa(id);
    }
    
    setShowDeleteConfirm(null);
    setIsDrawerOpen(false);
    success("Pesquisa excluída com sucesso!");
    
    if (fonte !== 'supabase') {
      // In a real app we'd update state, here we reload to sync with storage
      setTimeout(() => window.location.reload(), 1000);
    }
  }, [success, fonte, refreshDb]);

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
          <p className="text-slate-500 text-sm">
            {filteredSurveys.length} {filteredSurveys.length === 1 ? 'pesquisa encontrada' : 'pesquisas encontradas'}
          </p>
        </div>
        
        {(isAdmin() || isSupervisor()) && (
          <button 
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="size-4" />
            Exportar CSV
          </button>
        )}
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

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nome, região, endereço ou resposta..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b] outline-none transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <select 
                value={selectedRegiao}
                onChange={(e) => setSelectedRegiao(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b] outline-none transition-all appearance-none"
              >
                <option value="">Todas as regiões</option>
                {getRegioes().map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-[140px]">
              <select 
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b] outline-none transition-all appearance-none"
              >
                <option value="">Todas as categorias</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Tag className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>

            {(modo === 'equipe' || modo === 'todos') && (
              <div className="relative flex-1 min-w-[140px]">
                <select 
                  value={selectedServidor}
                  onChange={(e) => setSelectedServidor(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b] outline-none transition-all appearance-none"
                >
                  <option value="">Todos os servidores</option>
                  {allServidores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <UserIcon className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input 
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b] outline-none transition-all"
            />
            <span className="text-slate-400">até</span>
            <input 
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 focus:border-[#1a3a5b] outline-none transition-all"
            />
          </div>

          {activeFiltersCount > 0 && (
            <button 
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-bold transition-all"
            >
              <X className="size-4" />
              Limpar ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* Surveys List */}
      <div className="grid grid-cols-1 gap-4">
        {paginatedSurveys.length > 0 ? (
          paginatedSurveys.map((p) => (
            <PesquisaCard 
              key={p.id} 
              pesquisa={p} 
              allSurveys={allSurveys}
              onViewDetails={() => {
                setSelectedPesquisa(p);
                setIsDrawerOpen(true);
              }} 
            />
          ))
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-center">
            <div className="size-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Search className="size-6 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Nenhuma pesquisa encontrada</h3>
            <p className="text-slate-500 max-w-xs">
              Tente ajustar os filtros ou termos de busca para encontrar o que procura.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-slate-500 font-medium">
            Página <span className="text-slate-900 font-bold">{currentPage}</span> de <span className="text-slate-900 font-bold">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedPesquisa && (
          <PesquisaDetailsDrawer 
            pesquisa={selectedPesquisa} 
            onClose={() => setIsDrawerOpen(false)} 
            onDelete={() => setShowDeleteConfirm(selectedPesquisa.id)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <Dialog 
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
        title="Excluir Pesquisa?"
        description="Esta ação é irreversível. Todos os dados desta pesquisa serão removidos permanentemente."
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  );
}


export function PesquisaDetailsDrawer({ pesquisa, onClose, onDelete }: { pesquisa: Pesquisa, onClose: () => void, onDelete: () => void }) {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [perguntas, setPerguntas] = useState<PerguntaFormulario[]>([]);
  const supervisor = useMemo(() => getUsuarioById(pesquisa.supervisor_id), [pesquisa.supervisor_id]);

  useEffect(() => {
    setPerguntas(getPerguntas());
  }, []);

  const categoria = pesquisa.respostas['categoria_principal'] || Object.values(pesquisa.respostas)[0] || 'Outro';
  
  // Urgency for drawer
  const urgencia = useMemo(() => {
    const all = getPesquisas();
    const count = all.filter(p => 
      p.morador.regiao === pesquisa.morador.regiao && 
      (p.respostas['categoria_principal'] === categoria || Object.values(p.respostas)[0] === categoria)
    ).length;
    return calcularUrgencia(count);
  }, [pesquisa, categoria]);

  const urgenciaColors = {
    "Baixa": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Média": "bg-amber-50 text-amber-600 border-amber-100",
    "Alta": "bg-orange-50 text-orange-600 border-orange-100",
    "Crítica": "bg-rose-50 text-rose-600 border-rose-100"
  };

  const handlePrint = () => {
    window.print();
  };

  // Check if observations should be visible
  const canSeeObservations = isAdmin() || isSupervisor() || (user?.id === pesquisa.servidor_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden print:static print:block">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm print:hidden"
        onClick={onClose}
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-hidden print:w-full print:max-w-none print:shadow-none print:h-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between print:pb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">{pesquisa.morador.nome}</h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border border-slate-200">
                {categoria}
              </span>
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", urgenciaColors[urgencia])}>
                {urgencia}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg print:hidden"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar print:overflow-visible print:p-0">
          {/* Morador Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <UserIcon className="size-3" />
              Dados do Morador
            </h3>
            <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <DetailItem label="Nome" value={pesquisa.morador.nome} />
              <DetailItem 
                label="Telefone" 
                value={pesquisa.morador.telefone} 
                link={`tel:${pesquisa.morador.telefone.replace(/\D/g, '')}`} 
              />
              {pesquisa.morador.email && (
                <DetailItem 
                  label="E-mail" 
                  value={pesquisa.morador.email} 
                  link={`mailto:${pesquisa.morador.email}`} 
                />
              )}
              <DetailItem label="Endereço" value={pesquisa.morador.endereco} />
              <DetailItem label="Região" value={pesquisa.morador.regiao} />
            </div>
          </section>

          {/* Respostas Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileText className="size-3" />
              Respostas do Questionário
            </h3>
            <div className="space-y-6">
              {perguntas.map(pergunta => {
                const resposta = pesquisa.respostas[pergunta.id];
                if (!resposta) return null;
                
                return (
                  <div key={pergunta.id} className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 leading-tight">{pergunta.texto}</p>
                    <p className="text-sm text-slate-800 bg-white border border-slate-100 p-3 rounded-lg shadow-sm">
                      {resposta}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Atendimento Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="size-3" />
              Dados do Atendimento
            </h3>
            <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <DetailItem label="Servidor" value={pesquisa.servidor_nome} />
              <DetailItem label="Supervisor" value={supervisor?.nome || 'Não informado'} />
              <DetailItem 
                label="Data do Registro" 
                value={format(parseISO(pesquisa.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
              />
              {canSeeObservations && pesquisa.atendimento.observacoes && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Observações Internas</p>
                  <p className="text-sm text-slate-600 italic">"{pesquisa.atendimento.observacoes}"</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-3 print:hidden">
          <div className="flex gap-3">
            {(isAdmin() || isSupervisor()) && (
              <button 
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Printer className="size-4" />
                Exportar PDF
              </button>
            )}
            {isAdmin() && (
              <button 
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-100 transition-all"
              >
                <Trash2 className="size-4" />
                Excluir
              </button>
            )}
          </div>
          <p className="text-[10px] text-center text-slate-400 font-medium">
            ID da Pesquisa: {pesquisa.id}
          </p>
        </div>
      </motion.div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}

function DetailItem({ label, value, link }: { label: string, value: string, link?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      {link ? (
        <a href={link} className="text-sm font-semibold text-[#1a3a5b] hover:underline flex items-center gap-1">
          {value}
          <MoreHorizontal className="size-3" />
        </a>
      ) : (
        <p className="text-sm font-semibold text-slate-800">{value}</p>
      )}
    </div>
  );
}
