import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Map, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Eye, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X,
  Calendar,
  Plus,
  Database
} from 'lucide-react';
import { 
  format, 
  subDays, 
  parseISO, 
  isSameDay, 
  startOfDay, 
  endOfDay,
  differenceInDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Area, 
  AreaChart 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPesquisas,
  getUsuarios,
  getMeta, 
  getRegioes 
} from '../services/storage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { isSupabaseEnabled } from '../lib/supabase';
import { 
  filtrarPorPeriodo, 
  calcularVariacao, 
  gerarRadarUrgencias, 
  calcularTopCategorias,
  calcularPesquisasPeriodoAnterior
} from '../utils/calculos';
import { cn } from '../lib/utils';
import { Pesquisa, RadarItem } from '../types';
import { PesquisaCard, PesquisaDetailsDrawer } from '../components/PesquisasList';
import { useToast } from '../components/ui/Toast';
import { DashboardSkeleton } from '../components/ui/Skeletons';
import { KanbanBoard } from '../components/KanbanBoard';
import { getKanbanCards, saveKanbanCard, deleteKanbanCard, moveKanbanCard } from '../services/storage';
import { KanbanCard, KanbanFase } from '../types';

type Periodo = "hoje" | "semana" | "mes" | "trimestre" | "tudo";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [radarFilter, setRadarFilter] = useState<"Tudo" | "Críticas" | "Altas">("Tudo");
  const [radarPage, setRadarPage] = useState(1);
  const [selectedRadarItem, setSelectedRadarItem] = useState<RadarItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState<"visao_geral" | "plano_acoes">("visao_geral");
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>(() => getKanbanCards());
  const [cardParaCriarDe, setCardParaCriarDe] = useState<Partial<KanbanCard> | null>(null);

  const { pesquisas: todasPesquisas, usuarios, fonte, error: dbError } = useSupabaseData();

  const handleSaveCard = (card: KanbanCard) => {
    saveKanbanCard(card);
    setKanbanCards(getKanbanCards());
    success("Ação salva com sucesso!");
  };

  const handleDeleteCard = (id: string) => {
    deleteKanbanCard(id);
    setKanbanCards(getKanbanCards());
    success("Ação removida.");
  };

  const handleMoveCard = (id: string, novaFase: KanbanFase) => {
    moveKanbanCard(id, novaFase);
    setKanbanCards(getKanbanCards());
  };

  const regioes = useMemo(() => getRegioes(), []);
  
  const pesquisasFiltradas = useMemo(() => 
    filtrarPorPeriodo(todasPesquisas, periodo), 
    [todasPesquisas, periodo]
  );

  const countAnterior = useMemo(() => {
    if (periodo === "tudo") return 0;
    return calcularPesquisasPeriodoAnterior(todasPesquisas, periodo as any);
  }, [todasPesquisas, periodo]);

  // Metric 1: Total
  const totalVariacao = useMemo(() => 
    calcularVariacao(pesquisasFiltradas.length, countAnterior),
    [pesquisasFiltradas.length, countAnterior]
  );

  // Metric 2: Urgências
  const radarFull = useMemo(() => gerarRadarUrgencias(pesquisasFiltradas), [pesquisasFiltradas]);
  const criticasCount = useMemo(() => radarFull.filter(r => r.urgencia === "Crítica").length, [radarFull]);

  // Metric 3: Bairros
  const regioesComPesquisa = useMemo(() => 
    new Set(pesquisasFiltradas.map(p => p.morador.regiao)), 
    [pesquisasFiltradas]
  );

  // Metric 4: Meta Mensal
  const metaMetrics = useMemo(() => {
    const servidoresAtivos = usuarios.filter(u => u.perfil === 'servidor' && u.ativo);
    const somaMetasMensais = servidoresAtivos.reduce((acc, u) => acc + (getMeta(u.id) * 4), 0);
    const pesquisasMes = filtrarPorPeriodo(todasPesquisas, "mes").length;
    const percentual = somaMetasMensais > 0 ? Math.round((pesquisasMes / somaMetasMensais) * 100) : 0;
    return { somaMetasMensais, pesquisasMes, percentual };
  }, [usuarios, todasPesquisas]);

  // Chart Data: Last 30 days
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const dateLabel = format(date, 'dd MMM', { locale: ptBR });
      const dateISO = format(date, 'yyyy-MM-dd');
      
      const countAtual = todasPesquisas.filter(p => isSameDay(parseISO(p.timestamp), date)).length;
      
      const dateAnterior = subDays(date, 30);
      const countAnterior = todasPesquisas.filter(p => isSameDay(parseISO(p.timestamp), dateAnterior)).length;
      
      data.push({
        name: dateLabel,
        fullDate: format(date, "dd 'de' MMMM", { locale: ptBR }),
        Atual: countAtual,
        Anterior: countAnterior
      });
    }
    return data;
  }, [todasPesquisas]);

  // Categories Panel
  const topCategorias = useMemo(() => calcularTopCategorias(pesquisasFiltradas), [pesquisasFiltradas]);
  const maxCatCount = useMemo(() => Math.max(...topCategorias.map(c => c.count), 1), [topCategorias]);

  // Radar Table Filtering & Pagination
  const filteredRadar = useMemo(() => {
    if (radarFilter === "Tudo") return radarFull;
    if (radarFilter === "Críticas") return radarFull.filter(r => r.urgencia === "Crítica");
    return radarFull.filter(r => r.urgencia === "Alta");
  }, [radarFull, radarFilter]);

  const radarItemsPerPage = 5;
  const totalRadarPages = Math.ceil(filteredRadar.length / radarItemsPerPage);
  const paginatedRadar = useMemo(() => {
    const start = (radarPage - 1) * radarItemsPerPage;
    return filteredRadar.slice(start, start + radarItemsPerPage);
  }, [filteredRadar, radarPage]);

  const handlePrint = () => {
    window.print();
  };

  // Dados já disponíveis via localStorage desde o início
  // Supabase atualiza em background automaticamente

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 pb-12 print:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Administrativo</h1>
          <p className="text-slate-500 text-sm">Visão consolidada de todas as pesquisas e demandas</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer className="size-4" />
            Exportar PDF
          </button>
          
          <div className="relative">
            <select 
              value={periodo}
              onChange={(e) => {
                setPeriodo(e.target.value as Periodo);
                setRadarPage(1);
              }}
              className="pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-[#1a3a5b]/20 outline-none appearance-none cursor-pointer shadow-sm"
            >
              <option value="hoje">Hoje</option>
              <option value="semana">Esta semana</option>
              <option value="mes">Este mês</option>
              <option value="trimestre">Últimos 3 meses</option>
              <option value="tudo">Tudo</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
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

      {/* Abas */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setAbaAtiva("visao_geral")}
          className={cn(
            "px-5 py-2 rounded-lg text-sm font-bold transition-all",
            abaAtiva === "visao_geral" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setAbaAtiva("plano_acoes")}
          className={cn(
            "px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            abaAtiva === "plano_acoes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Plano de Ações
          {kanbanCards.filter(c => c.fase !== "concluido" && c.fase !== "cancelado").length > 0 && (
            <span className="size-5 rounded-full bg-[#1a3a5b] text-white text-[10px] font-black flex items-center justify-center">
              {kanbanCards.filter(c => c.fase !== "concluido" && c.fase !== "cancelado").length}
            </span>
          )}
        </button>
      </div>

      {abaAtiva === "visao_geral" && (
        <>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div 
          onClick={() => navigate('/admin/pesquisas')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BarChart3 className="size-5 text-blue-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total de Pesquisas</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-900">{pesquisasFiltradas.length}</span>
            {periodo !== "tudo" && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
                totalVariacao.direcao === "up" ? "text-emerald-600 bg-emerald-50" : 
                totalVariacao.direcao === "down" ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-50"
              )}>
                {totalVariacao.direcao === "up" ? <ArrowUpRight className="size-3" /> : 
                 totalVariacao.direcao === "down" ? <ArrowDownRight className="size-3" /> : null}
                {totalVariacao.percentual}%
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Urgências */}
        <div 
          onClick={() => navigate('/admin/pesquisas')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="size-10 rounded-xl bg-rose-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <AlertTriangle className="size-5 text-rose-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Urgências Críticas</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-900">{criticasCount}</span>
            {criticasCount > 0 && (
              <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-1 rounded-lg animate-pulse">
                Requer ação imediata
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Bairros */}
        <div 
          onClick={() => navigate('/admin/pesquisas')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Map className="size-5 text-amber-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bairros Atendidos</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-900">
              {regioesComPesquisa.size}/{regioes.length}
            </span>
            {regioesComPesquisa.size < regioes.length && (
              <span className="text-[10px] font-bold text-slate-400">
                Faltam {regioes.length - regioesComPesquisa.size} bairros
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Meta */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
            <Target className="size-5 text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Meta Mensal (Geral)</p>
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-slate-900">{metaMetrics.percentual}%</span>
              <span className="text-[10px] font-bold text-slate-400">{metaMetrics.pesquisasMes}/{metaMetrics.somaMetasMensais}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(metaMetrics.percentual, 100)}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900">Volume de Participação</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-[#1a3a5b]" />
                  <span className="text-xs font-medium text-slate-500">Atual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-slate-200" />
                  <span className="text-xs font-medium text-slate-500">Anterior</span>
                </div>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAtual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a3a5b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#1a3a5b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-2xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-900 mb-2">{payload[0].payload.fullDate}</p>
                            <div className="space-y-1">
                              {payload.map((p: any) => (
                                <div key={p.name} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <div className="size-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                    <span className="text-[10px] font-medium text-slate-500">{p.name}</span>
                                  </div>
                                  <span className="text-xs font-black text-slate-900">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Atual" 
                    stroke="#1a3a5b" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorAtual)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Anterior" 
                    stroke="#e2e8f0" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Radar Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-lg">
                  <AlertTriangle className="size-5 text-rose-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Radar de Urgências</h2>
              </div>
              
              <div className="flex items-center bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
                {(["Tudo", "Críticas", "Altas"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => {
                      setRadarFilter(f);
                      setRadarPage(1);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                      radarFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Data/Hora</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bairro</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRadar.map((item, idx) => (
                    <tr 
                      key={`${item.regiao}-${item.categoria}-${idx}`}
                      className={cn(
                        "hover:bg-slate-50 transition-all group",
                        item.urgencia === "Crítica" && "bg-rose-50/30"
                      )}
                    >
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">
                            {format(parseISO(item.ultima_ocorrencia), "dd/MM/yyyy")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {format(parseISO(item.ultima_ocorrencia), "HH:mm")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">{item.regiao}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{item.categoria}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase border",
                          item.urgencia === "Crítica" ? "bg-rose-50 text-rose-600 border-rose-100" :
                          item.urgencia === "Alta" ? "bg-orange-50 text-orange-600 border-orange-100" :
                          item.urgencia === "Média" ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          {item.urgencia}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              setSelectedRadarItem(item);
                              setIsDrawerOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-[#1a3a5b] hover:bg-[#1a3a5b]/5 rounded-lg transition-all"
                            title="Ver pesquisas"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              setCardParaCriarDe({
                                titulo: `${item.categoria} — ${item.regiao}`,
                                descricao: item.dor_recente,
                                regiao: item.regiao,
                                categoria: item.categoria,
                                urgencia: item.urgencia,
                              });
                              setAbaAtiva("plano_acoes");
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Criar plano de ação"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedRadar.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                        Nenhuma urgência encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalRadarPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  {radarPage} de {totalRadarPages} urgências
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={radarPage === 1}
                    onClick={() => setRadarPage(prev => prev - 1)}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button 
                    disabled={radarPage === totalRadarPages}
                    onClick={() => setRadarPage(prev => prev + 1)}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categories Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Demandas por Categoria</h2>
              <button 
                onClick={() => navigate('/admin/pesquisas')}
                className="text-xs font-bold text-[#1a3a5b] hover:underline"
              >
                Ver todas
              </button>
            </div>
            
            <div className="space-y-6">
              {topCategorias.map((cat) => (
                <div key={cat.categoria} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-700">{cat.categoria}</span>
                    <span className="font-black text-slate-900">{cat.count}</span>
                  </div>
                  <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.count / maxCatCount) * 100}%` }}
                      className="h-full bg-[#1a3a5b]"
                    />
                  </div>
                </div>
              ))}
              {topCategorias.length === 0 && (
                <p className="text-sm text-slate-400 italic text-center py-8">Nenhum dado disponível</p>
              )}
            </div>
          </div>

          {/* Quick Actions / Info */}
          <div className="bg-[#1a3a5b] p-6 rounded-2xl text-white shadow-xl shadow-[#1a3a5b]/20">
            <h3 className="text-lg font-bold mb-2">Relatório Consolidado</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              Os dados apresentados refletem as visitas domiciliares realizadas no período de {periodo}.
            </p>
            <button 
              onClick={() => navigate('/admin/relatorios')}
              className="w-full py-3 bg-white text-[#1a3a5b] rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center gap-2"
            >
              <Download className="size-4" />
              Gerar Relatório Completo
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {abaAtiva === "plano_acoes" && (
        <KanbanBoard
          cards={kanbanCards}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onMove={handleMoveCard}
          initialCardData={cardParaCriarDe}
          openModalOnMount={!!cardParaCriarDe}
          onModalClose={() => setCardParaCriarDe(null)}
        />
      )}

      {/* Group Details Drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedRadarItem && (
          <RadarGroupDrawer 
            item={selectedRadarItem} 
            onClose={() => setIsDrawerOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:p-0, .print\\:p-0 * { visibility: visible; }
          .print\\:p-0 { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          aside, header { display: none !important; }
        }
      `}} />
    </div>
  );
}

function RadarGroupDrawer({ item, onClose }: { item: RadarItem, onClose: () => void }) {
  const navigate = useNavigate();
  const todasPesquisas = useMemo(() => getPesquisas(), []);
  const [selectedPesquisa, setSelectedPesquisa] = useState<Pesquisa | null>(null);

  const pesquisasGrupo = useMemo(() => {
    return todasPesquisas.filter(p => 
      p.morador.regiao === item.regiao && 
      (p.respostas['categoria_principal'] === item.categoria || Object.values(p.respostas)[0] === item.categoria)
    ).sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
  }, [todasPesquisas, item]);
  
  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full sm:max-w-[600px] bg-slate-50 h-full shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{item.regiao}</h2>
            <p className="text-sm text-slate-500 font-medium">{item.categoria} • {item.count} ocorrências</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pesquisas Relacionadas</h3>
            <button 
              onClick={() => navigate(`/admin/pesquisas?regiao=${item.regiao}&categoria=${item.categoria}`)}
              className="text-xs font-bold text-[#1a3a5b] hover:underline"
            >
              Ver no histórico completo
            </button>
          </div>
          
          <div className="space-y-4">
            {pesquisasGrupo.map(p => (
              <PesquisaCard 
                key={p.id} 
                pesquisa={p} 
                onViewDetails={() => setSelectedPesquisa(p)} 
                allSurveys={todasPesquisas}
              />
            ))}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedPesquisa && (
          <PesquisaDetailsDrawer 
            pesquisa={selectedPesquisa} 
            onClose={() => setSelectedPesquisa(null)} 
            onDelete={() => {
              setSelectedPesquisa(null);
              // In a real app we'd refresh the list
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
