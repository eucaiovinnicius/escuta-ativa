import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  Target, 
  Award, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  AlertCircle, 
  Clock,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Search,
  UserCheck,
  Zap,
  Database
} from 'lucide-react';
import { 
  formatDistanceToNow, 
  parseISO, 
  startOfWeek, 
  addDays, 
  format, 
  isSameDay,
  differenceInDays,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { DashboardSkeleton } from '../components/ui/Skeletons';
import { 
  getMeta, 
  saveMeta,
  getPesquisasByServidor,
  getUsuarioById
} from '../services/storage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { isSupabaseEnabled } from '../lib/supabase';
import { 
  filtrarPorPeriodo, 
  calcularPesquisasHoje, 
  calcularPesquisasSemana 
} from '../utils/calculos';
import { cn } from '../lib/utils';
import { Usuario, Pesquisa } from '../types';

export function AdminPerformance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "trimestre" | "tudo">("mes");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");
  const [globalMeta, setGlobalMeta] = useState<number>(20);
  const [tempMetas, setTempMetas] = useState<Record<string, number>>({});
  const [showToast, setShowToast] = useState(false);
  const [showGoalsCard, setShowGoalsCard] = useState(false);

  const { pesquisas: todasPesquisas, usuarios, fonte } = useSupabaseData();

  // Base Data
  const todosServidores = useMemo(() => 
    usuarios.filter(u => u.perfil === "servidor"), 
    [usuarios]
  );
  const todosSupervisores = useMemo(() => 
    usuarios.filter(u => u.perfil === "supervisor" || u.perfil === "admin"), 
    [usuarios]
  );

  const pesquisasFiltradas = useMemo(() => 
    filtrarPorPeriodo(todasPesquisas, periodo), 
    [todasPesquisas, periodo]
  );

  // General Metrics
  const metrics = useMemo(() => {
    const total = pesquisasFiltradas.length;
    const servidoresAtivos = new Set(pesquisasFiltradas.map(p => p.servidor_id)).size;
    const media = servidoresAtivos > 0 ? (total / servidoresAtivos).toFixed(1) : "0";
    
    return { total, ativos: servidoresAtivos, media };
  }, [pesquisasFiltradas]);

  // Days in period for daily average
  const diasPeriodo = useMemo(() => {
    if (periodo === "hoje") return 1;
    if (periodo === "semana") return 7;
    if (periodo === "mes") return 30;
    if (periodo === "trimestre") return 90;
    if (periodo === "tudo") {
      if (todasPesquisas.length === 0) return 1;
      const dates = todasPesquisas.map(p => parseISO(p.timestamp).getTime());
      const min = Math.min(...dates);
      const diff = differenceInDays(new Date(), new Date(min)) + 1;
      return diff > 0 ? diff : 1;
    }
    return 30;
  }, [periodo, todasPesquisas]);

  // Server Ranking & Stats
  const serverStats = useMemo(() => {
    return todosServidores.map(servidor => {
      const pesquisasServidorTotal = getPesquisasByServidor(servidor.id);
      const pesquisasServidorPeriodo = filtrarPorPeriodo(pesquisasServidorTotal, periodo);
      const meta = getMeta(servidor.id);
      const percentualMeta = Math.round((pesquisasServidorPeriodo.length / meta) * 100);
      const mediaDiaria = (pesquisasServidorPeriodo.length / diasPeriodo).toFixed(1);
      const supervisor = getUsuarioById(servidor.supervisor_id || "");
      const ultimaAtividade = pesquisasServidorTotal.sort((a, b) => 
        parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()
      )[0]?.timestamp;

      return {
        servidor,
        count: pesquisasServidorPeriodo.length,
        meta,
        percentualMeta,
        mediaDiaria,
        supervisorNome: supervisor?.nome || "—",
        ultimaAtividade,
        semana: calcularPesquisasSemana(pesquisasServidorTotal, servidor.id)
      };
    }).sort((a, b) => b.count - a.count);
  }, [todosServidores, periodo, diasPeriodo]);

  // Chart Data
  const chartData = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    
    const colors = ['#1a3a5b', '#F0A500', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#06b6d4'];

    const filteredServers = selectedSupervisor === "all" 
      ? todosServidores 
      : todosServidores.filter(s => s.supervisor_id === selectedSupervisor);

    // Limit to top 5 for readability
    const topServers = filteredServers
      .map(s => ({ 
        id: s.id, 
        nome: s.nome, 
        total: getPesquisasByServidor(s.id).length 
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      data: days.map(day => {
        const dayLabel = format(day, 'EEE', { locale: ptBR });
        const dayData: any = { name: dayLabel };
        
        topServers.forEach(servidor => {
          const pesquisas = getPesquisasByServidor(servidor.id);
          const count = pesquisas.filter(p => isSameDay(parseISO(p.timestamp), day)).length;
          dayData[servidor.nome] = count;
        });
        
        return dayData;
      }),
      servidores: topServers.map((s, i) => ({
        nome: s.nome,
        color: colors[i % colors.length]
      }))
    };
  }, [todosServidores, selectedSupervisor]);

  const handleApplyGlobalMeta = () => {
    todosServidores.forEach(s => saveMeta(s.id, globalMeta));
    success("Meta global atualizada com sucesso!");
  };

  const handleSaveIndividualMeta = (id: string) => {
    const valor = tempMetas[id];
    if (valor !== undefined) {
      saveMeta(id, valor);
      success("Meta individual atualizada!");
    }
  };

  // Dados já disponíveis via localStorage desde o início
  // Supabase atualiza em background automaticamente

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Geral</h1>
          <p className="text-slate-500 text-sm">Monitoramento de produtividade de todos os servidores</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
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

      {/* General Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          icon={BarChart3} 
          label="Total de Pesquisas" 
          value={metrics.total} 
          subValue="no período"
          color="blue"
        />
        <MetricCard 
          icon={UserCheck} 
          label="Servidores Ativos" 
          value={metrics.ativos} 
          subValue={`de ${todosServidores.length} totais`}
          color="amber"
        />
        <MetricCard 
          icon={TrendingUp} 
          label="Média por Ativo" 
          value={metrics.media} 
          subValue="pesquisas / servidor"
          color="emerald"
        />
        <MetricCard 
          icon={Zap} 
          label="Tempo Médio" 
          value="Em breve" 
          subValue="integração backend"
          color="indigo"
        />
      </div>

      {/* Ranking Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Ranking de Produtividade</h2>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Top Servidores</p>
        </div>
        <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide">
          {serverStats.map((stat, index) => (
            <div key={stat.servidor.id} className="min-w-[280px] sm:min-w-0 sm:flex-1">
              <RankingCard 
                stat={stat} 
                position={index + 1}
                onView={() => navigate(`/admin/pesquisas?servidor_id=${stat.servidor.id}`)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-lg font-bold text-slate-900">Comparativo de Produtividade</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase">Filtrar por Supervisor:</span>
            <div className="relative">
              <select 
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
              >
                <option value="all">Todos os supervisores</option>
                {todosSupervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#94a3b8' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#94a3b8' }} 
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
              {chartData.servidores.map(s => (
                <Bar 
                  key={s.nome} 
                  dataKey={s.nome} 
                  fill={s.color} 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Tabela Detalhada de Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servidor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Supervisor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Região</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Esta Semana</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Média/Dia</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Meta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">% Meta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden lg:table-cell">Última Atividade</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {serverStats.map((stat) => (
                <tr key={stat.servidor.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {stat.servidor.initials}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{stat.servidor.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 hidden sm:table-cell">{stat.supervisorNome}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">
                    <button 
                      onClick={() => navigate(`/admin/pesquisas?regiao=${stat.servidor.regiao}`)}
                      className="hover:text-[#1a3a5b] hover:underline"
                    >
                      {stat.servidor.regiao || "—"}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => navigate(`/admin/pesquisas?servidor_id=${stat.servidor.id}`)}
                      className="text-sm font-black text-slate-900 hover:text-[#1a3a5b] hover:underline"
                    >
                      {stat.count}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700 hidden sm:table-cell">{stat.semana}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">{stat.mediaDiaria}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 hidden sm:table-cell">{stat.meta}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase border",
                      stat.percentualMeta >= 100 ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      stat.percentualMeta >= 70 ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-rose-50 text-rose-600 border-rose-100"
                    )}>
                      {stat.percentualMeta}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-400 font-medium hidden lg:table-cell">
                    {stat.ultimaAtividade 
                      ? formatDistanceToNow(parseISO(stat.ultimaAtividade), { addSuffix: true, locale: ptBR })
                      : "—"
                    }
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate(`/admin/pesquisas?servidor_id=${stat.servidor.id}`)}
                      className="p-2 text-slate-400 hover:text-[#1a3a5b] hover:bg-[#1a3a5b]/5 rounded-lg transition-all"
                    >
                      <ExternalLink className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goals Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button 
          onClick={() => setShowGoalsCard(!showGoalsCard)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Target className="size-5 text-amber-600" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-slate-900">Configurar Metas da Equipe</h2>
              <p className="text-sm text-slate-500">Gerencie os objetivos individuais e globais</p>
            </div>
          </div>
          {showGoalsCard ? <ChevronUp className="size-5 text-slate-400" /> : <ChevronDown className="size-5 text-slate-400" />}
        </button>

        <AnimatePresence>
          {showGoalsCard && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-6 border-t border-slate-100"
            >
              <div className="py-6 space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900">Meta Padrão (Global)</h3>
                    <p className="text-xs text-slate-500">Aplica o mesmo valor para todos os servidores ativos</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      value={globalMeta}
                      onChange={(e) => setGlobalMeta(parseInt(e.target.value))}
                      className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3a5b]/20"
                    />
                    <button 
                      onClick={handleApplyGlobalMeta}
                      className="px-4 py-2 bg-[#1a3a5b] text-white rounded-lg font-bold text-sm hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/10"
                    >
                      Aplicar para todos
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servidor</th>
                        <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Meta Atual</th>
                        <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nova Meta</th>
                        <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {todosServidores.map(s => (
                        <tr key={s.id}>
                          <td className="py-3">
                            <span className="text-sm font-bold text-slate-700">{s.nome}</span>
                          </td>
                          <td className="py-3">
                            <span className="text-sm text-slate-500 font-medium">{getMeta(s.id)}</span>
                          </td>
                          <td className="py-3">
                            <input 
                              type="number"
                              placeholder="Novo valor"
                              onChange={(e) => setTempMetas(prev => ({ ...prev, [s.id]: parseInt(e.target.value) }))}
                              className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                          </td>
                          <td className="py-3 text-right">
                            <button 
                              onClick={() => handleSaveIndividualMeta(s.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            >
                              <Save className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50"
          >
            <CheckCircle2 className="size-5" />
            <span className="font-medium">Meta atualizada com sucesso!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, subValue, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600"
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className={cn("size-10 rounded-xl flex items-center justify-center mb-4", colors[color])}>
        <Icon className="size-5" />
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900">{value}</span>
        <span className="text-[10px] font-medium text-slate-400">{subValue}</span>
      </div>
    </div>
  );
}

function RankingCard({ stat, position, onView }: any) {
  const { servidor, count, meta, percentualMeta, mediaDiaria, supervisorNome, ultimaAtividade } = stat;
  const rankEmoji = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : position;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <Award className="size-16 text-slate-900" />
      </div>
      
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black text-sm border-2 border-white shadow-sm">
              {servidor.initials}
            </div>
            <div className="flex flex-col overflow-hidden">
              <h3 className="font-bold text-slate-900 truncate group-hover:text-[#1a3a5b] transition-colors">{servidor.nome}</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{servidor.regiao || "—"}</span>
            </div>
          </div>
          <span className="text-2xl font-black text-slate-200 group-hover:text-[#1a3a5b]/10 transition-colors">{rankEmoji}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-black text-slate-900">{count}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Pesquisas</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-900">{mediaDiaria}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Média/Dia</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Meta</span>
            <span>{percentualMeta}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentualMeta, 100)}%` }}
              className={cn(
                "h-full",
                percentualMeta >= 100 ? "bg-emerald-500" : "bg-[#1a3a5b]"
              )}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Supervisor</span>
            <span className="text-xs font-medium text-slate-700">{supervisorNome}</span>
          </div>
          <button 
            onClick={onView}
            className="p-2 text-[#1a3a5b] hover:bg-[#1a3a5b]/5 rounded-lg transition-all"
          >
            <ExternalLink className="size-4" />
          </button>
        </div>

        {count === 0 && (
          <div className="flex items-center gap-2 p-2 bg-rose-50 rounded-lg border border-rose-100">
            <AlertCircle className="size-3 text-rose-600" />
            <span className="text-[10px] font-bold text-rose-600">Inativo no período</span>
          </div>
        )}
      </div>
    </div>
  );
}
