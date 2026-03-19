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
  Database
} from 'lucide-react';
import { 
  formatDistanceToNow, 
  parseISO, 
  startOfWeek, 
  addDays, 
  format, 
  isSameDay 
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
import { useSupabaseData } from '../hooks/useSupabaseData';
import { isSupabaseEnabled } from '../lib/supabase';
import { 
  getPesquisas,
  getPesquisasBySupervisor, 
  getUsuarios, 
  getMeta, 
  saveMeta,
  getPesquisasByServidor
} from '../services/storage';
import { 
  filtrarPorPeriodo, 
  calcularPesquisasHoje, 
  calcularPesquisasSemana 
} from '../utils/calculos';
import { cn } from '../lib/utils';
import { Usuario, Pesquisa } from '../types';

export function EquipeDesempenho() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "trimestre" | "tudo">("semana");
  const [showGoals, setShowGoals] = useState(false);
  const [tempMetas, setTempMetas] = useState<Record<string, number>>({});
  const [showToast, setShowToast] = useState(false);

  const { pesquisas: todasPesquisas, usuarios, isLoading, fonte } = useSupabaseData();

  // Base Data
  const pesquisasEquipeRaw = useMemo(() => {
    if (fonte === 'supabase') {
      return todasPesquisas.filter(p => {
        if (user?.perfil === 'admin') return true;
        const servidor = usuarios.find(u => u.id === p.servidor_id);
        return p.servidor_id === user?.id || servidor?.supervisor_id === user?.id;
      });
    }
    if (user?.perfil === 'admin') return getPesquisas();
    return getPesquisasBySupervisor(user?.id || '');
  }, [todasPesquisas, usuarios, user, fonte]);

  const membrosEquipe = useMemo(() => {
    if (user?.perfil === 'admin') {
      return usuarios.filter(u => (u.perfil === 'servidor' || u.perfil === 'supervisor') && u.ativo);
    }
    return usuarios.filter(u => (u.supervisor_id === user?.id || u.id === user?.id) && u.ativo);
  }, [usuarios, user]);

  const pesquisasEquipe = useMemo(() => 
    filtrarPorPeriodo(pesquisasEquipeRaw, periodo), 
    [pesquisasEquipeRaw, periodo]
  );

  // Metrics
  const metrics = useMemo(() => {
    const total = pesquisasEquipe.length;
    
    const servidoresComPesquisa = new Set(pesquisasEquipe.map(p => p.servidor_id));
    const ativos = servidoresComPesquisa.size;
    
    const media = ativos > 0 ? (total / ativos).toFixed(1) : "0";
    
    const counts: Record<string, number> = {};
    pesquisasEquipe.forEach(p => {
      counts[p.servidor_id] = (counts[p.servidor_id] || 0) + 1;
    });
    
    let destaqueId = "";
    let destaqueCount = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > destaqueCount) {
        destaqueCount = count;
        destaqueId = id;
      }
    });
    
    const destaqueNome = membrosEquipe.find(m => m.id === destaqueId)?.nome || "Nenhum";

    return { total, ativos, media, destaqueNome, destaqueCount };
  }, [pesquisasEquipe, membrosEquipe]);

  // Member Stats
  const memberStats = useMemo(() => {
    return membrosEquipe.map(membro => {
      const pesquisasMembroTotal = todasPesquisas.filter(p => p.servidor_id === membro.id);
      const pesquisasMembroPeriodo = filtrarPorPeriodo(pesquisasMembroTotal, periodo);
      const metaMembro = getMeta(membro.id);
      const percentualMeta = Math.round((pesquisasMembroPeriodo.length / metaMembro) * 100);
      const ultimaAtividade = pesquisasMembroTotal.sort((a, b) => 
        parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()
      )[0]?.timestamp;

      return {
        membro,
        count: pesquisasMembroPeriodo.length,
        meta: metaMembro,
        percentual: percentualMeta,
        hoje: calcularPesquisasHoje(pesquisasMembroTotal, membro.id),
        semana: calcularPesquisasSemana(pesquisasMembroTotal, membro.id),
        ultimaAtividade
      };
    }).sort((a, b) => b.count - a.count);
  }, [membrosEquipe, periodo, todasPesquisas]);

  // Chart Data
  const chartData = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    
    const colors = ['#1a3a5b', '#F0A500', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#06b6d4'];

    return {
      data: days.map(day => {
        const dayLabel = format(day, 'EEE', { locale: ptBR });
        const dayData: any = { name: dayLabel };
        
        membrosEquipe.forEach(membro => {
          const pesquisasMembro = todasPesquisas.filter(p => p.servidor_id === membro.id);
          const count = pesquisasMembro.filter(p => isSameDay(parseISO(p.timestamp), day)).length;
          dayData[membro.nome] = count;
        });
        
        return dayData;
      }),
      membros: membrosEquipe.map((m, i) => ({
        nome: m.nome,
        color: colors[i % colors.length]
      }))
    };
  }, [membrosEquipe, todasPesquisas]);

  const handleSaveMetas = () => {
    Object.entries(tempMetas).forEach(([id, valor]) => {
      saveMeta(id, valor as number);
    });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setTempMetas({});
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Desempenho da Equipe</h1>
          <p className="text-slate-500 text-sm">Acompanhe a produtividade e metas dos seus servidores</p>
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

      {/* Team Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          icon={BarChart3} 
          label="Total de Pesquisas" 
          value={metrics.total} 
          subValue="no período selecionado"
          color="blue"
        />
        <MetricCard 
          icon={Users} 
          label="Servidores Ativos" 
          value={metrics.ativos} 
          subValue={`de ${membrosEquipe.length} membros`}
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
          icon={Award} 
          label="Destaque" 
          value={metrics.destaqueNome.split(' ')[0]} 
          subValue={`${metrics.destaqueCount} pesquisas`}
          color="indigo"
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Comparativo Semanal</h2>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <div className="size-2 rounded-full bg-[#1a3a5b]" />
            <span>Pesquisas por dia</span>
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
              {chartData.membros.map(m => (
                <Bar 
                  key={m.nome} 
                  dataKey={m.nome} 
                  fill={m.color} 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goals Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button 
          onClick={() => setShowGoals(!showGoals)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Target className="size-5 text-amber-600" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-slate-900">Configurar Metas Semanais</h2>
              <p className="text-sm text-slate-500">Defina o objetivo de pesquisas para cada membro</p>
            </div>
          </div>
          {showGoals ? <ChevronUp className="size-5 text-slate-400" /> : <ChevronDown className="size-5 text-slate-400" />}
        </button>

        <AnimatePresence>
          {showGoals && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-6 border-t border-slate-100"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                {membrosEquipe.map(membro => (
                  <div key={membro.id} className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">{membro.nome}</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        defaultValue={getMeta(membro.id)}
                        onChange={(e) => setTempMetas(prev => ({ ...prev, [membro.id]: parseInt(e.target.value) }))}
                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Meta</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleSaveMetas}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#1a3a5b] text-white rounded-xl font-bold hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
                >
                  <Save className="size-4" />
                  Salvar Metas
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {memberStats.map((stat, index) => (
          <MemberCard 
            key={stat.membro.id} 
            stat={stat} 
            rank={index < 3 ? (index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉") : null}
            onView={() => navigate(`/equipe/pesquisas?servidor_id=${stat.membro.id}`)}
          />
        ))}
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
            <span className="font-medium">Metas atualizadas com sucesso!</span>
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

function MemberCard({ stat, rank, onView }: any) {
  const { membro, count, meta, percentual, hoje, semana, ultimaAtividade } = stat;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
      <div className="p-5 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black text-lg border-2 border-white shadow-sm relative">
              {membro.initials}
              {rank && <span className="absolute -top-1 -right-1 text-lg">{rank}</span>}
            </div>
            <div className="flex flex-col overflow-hidden">
              <h3 className="font-bold text-slate-900 truncate group-hover:text-[#1a3a5b] transition-colors">{membro.nome}</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{membro.cargo} • {membro.regiao}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">{count}</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Pesquisas</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
            <span className="text-slate-400">Progresso da Meta</span>
            <span className={cn(percentual >= 100 ? "text-emerald-600" : "text-slate-600")}>
              {percentual}% ({count}/{meta})
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentual, 100)}%` }}
              className={cn(
                "h-full transition-all",
                percentual >= 100 ? "bg-emerald-500" : "bg-[#1a3a5b]"
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-50">
          <div className="text-center">
            <p className="text-lg font-black text-slate-800">{hoje}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Hoje</p>
          </div>
          <div className="text-center border-l border-slate-100">
            <p className="text-lg font-black text-slate-800">{semana}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Semana</p>
          </div>
        </div>

        {count === 0 && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
            <AlertCircle className="size-4 text-rose-600" />
            <span className="text-xs font-bold text-rose-600">Inativo no período selecionado</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="size-3" />
            {ultimaAtividade 
              ? `Ativo ${formatDistanceToNow(parseISO(ultimaAtividade), { addSuffix: true, locale: ptBR })}`
              : 'Sem atividade registrada'
            }
          </div>
          <button 
            onClick={onView}
            className="text-xs font-bold text-[#1a3a5b] hover:underline"
          >
            Ver Pesquisas
          </button>
        </div>
      </div>
    </div>
  );
}
