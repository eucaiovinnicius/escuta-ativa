import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  History,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  format, 
  parseISO, 
  isSameDay, 
  startOfWeek, 
  addDays, 
  subDays, 
  endOfWeek, 
  isWithinInterval,
  formatDistanceToNow
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { getPesquisasByServidor, getMeta } from '../services/storage';
import { 
  calcularPesquisasHoje, 
  calcularPesquisasSemana, 
  calcularVariacao 
} from '../utils/calculos';
import { cn } from '../lib/utils';
import { Pesquisa } from '../types';

export function MinhaMetaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [meta, setMeta] = useState(20);
  const [animatedOffset, setAnimatedOffset] = useState(339.3); // Circumference for r=54

  // Load data
  const loadData = () => {
    if (!user) return;
    const p = getPesquisasByServidor(user.id);
    const m = getMeta(user.id);
    setPesquisas(p);
    setMeta(m);
  };

  useEffect(() => {
    loadData();
  }, [user, location.key]);

  // Calculations
  const stats = useMemo(() => {
    if (!user) return null;
    
    const hoje = calcularPesquisasHoje(pesquisas, user.id);
    const semana = calcularPesquisasSemana(pesquisas, user.id);
    
    // Semana passada
    const now = new Date();
    const startLastWeek = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
    const endLastWeek = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
    
    const semanaPassadaCount = pesquisas.filter(p => 
      p.servidor_id === user.id && 
      isWithinInterval(parseISO(p.timestamp), { start: startLastWeek, end: endLastWeek })
    ).length;

    const variacao = calcularVariacao(semana, semanaPassadaCount);
    const percentual = Math.round((semana / meta) * 100);
    
    // Chart data (last 7 days - current week Mon-Sun)
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    const dadosGrafico = Array.from({ length: 7 }).map((_, i) => {
      const dia = addDays(startOfCurrentWeek, i);
      const count = pesquisas.filter(p => 
        p.servidor_id === user.id && 
        isSameDay(parseISO(p.timestamp), dia)
      ).length;
      
      return {
        dia: format(dia, "EEE", { locale: ptBR }),
        count,
        isToday: isSameDay(dia, now)
      };
    });

    const ultimasPesquisas = [...pesquisas]
      .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
      .slice(0, 3);

    return {
      hoje,
      semana,
      variacao,
      percentual,
      dadosGrafico,
      ultimasPesquisas,
      total: pesquisas.length
    };
  }, [pesquisas, meta, user]);

  // Animate circular progress
  useEffect(() => {
    if (stats) {
      const circumference = 2 * Math.PI * 54;
      const offset = circumference * (1 - Math.min(stats.percentual, 100) / 100);
      const timer = setTimeout(() => setAnimatedOffset(offset), 100);
      return () => clearTimeout(timer);
    }
  }, [stats]);

  if (!user || !stats) return null;

  if (pesquisas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
        <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center">
          <BarChart3 className="size-10 text-slate-300" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Nenhuma pesquisa registrada ainda</h2>
          <p className="text-slate-500 max-w-xs mx-auto">Comece registrando sua primeira pesquisa de campo para acompanhar suas metas.</p>
        </div>
        <button 
          onClick={() => navigate('/nova-pesquisa')}
          className="flex items-center gap-2 px-8 py-3 bg-[#1a3a5b] text-white rounded-xl font-bold hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
        >
          <Plus className="size-5" />
          Registrar Primeira Pesquisa
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Minha Meta</h1>
        <p className="text-slate-500 text-sm">Acompanhe seu desempenho e progresso semanal</p>
      </div>

      {/* Main Progress Card */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
        <div className="relative size-32 flex items-center justify-center">
          <svg className="size-32 -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="10"
            />
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="transparent"
              stroke="#1a3a5b"
              strokeWidth="10"
              strokeDasharray="339.3"
              strokeDashoffset={animatedOffset}
              strokeLinecap="round"
              className="transition-all duration-[600ms] ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900">{stats.percentual}%</span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left space-y-4">
          <div>
            <div className="flex items-baseline justify-center md:justify-start gap-2">
              <span className="text-5xl font-black text-slate-900">{stats.semana}</span>
              <span className="text-slate-400 font-bold">/ {meta} pesquisas esta semana</span>
            </div>
            
            <div className="mt-4">
              {stats.percentual < 70 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">
                  <AlertCircle className="size-3.5" />
                  Faltam {meta - stats.semana} pesquisas para a meta
                </div>
              ) : stats.percentual < 100 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                  <TrendingUp className="size-3.5" />
                  Quase lá! Faltam {meta - stats.semana} pesquisas
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
                  <CheckCircle2 className="size-3.5" />
                  Meta atingida! Parabéns
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pesquisas hoje</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-900">{stats.hoje}</span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <Calendar className="size-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Esta semana</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-900">{stats.semana}</span>
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg",
              stats.variacao.direcao === "up" ? "text-emerald-600 bg-emerald-50" : 
              stats.variacao.direcao === "down" ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-50"
            )}>
              {stats.variacao.direcao === "up" ? <TrendingUp className="size-3" /> : 
               stats.variacao.direcao === "down" ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
              {stats.variacao.percentual}%
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total registrado</p>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <History className="size-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-900">Atividade nos últimos 7 dias</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Semana Atual</span>
        </div>
        
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dadosGrafico}>
              <XAxis 
                dataKey="dia" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xl">
                        {payload[0].value} pesquisas
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stats.dadosGrafico.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isToday ? '#1a3a5b' : '#e2e8f0'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Surveys */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Últimos Registros</h3>
          <button 
            onClick={() => navigate('/historico')}
            className="text-[10px] font-black text-[#1a3a5b] uppercase tracking-widest hover:underline flex items-center gap-1"
          >
            Ver histórico completo
            <ChevronRight className="size-3" />
          </button>
        </div>
        
        <div className="divide-y divide-slate-100">
          {stats.ultimasPesquisas.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-all">
              <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 border-2 border-white shadow-sm">
                {p.morador.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{p.morador.nome}</p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {p.morador.regiao} · {p.respostas['categoria_principal'] || Object.values(p.respostas)[0] || 'Geral'}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                {formatDistanceToNow(parseISO(p.timestamp), { locale: ptBR, addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Action */}
      <button 
        onClick={() => navigate('/nova-pesquisa')}
        className="w-full py-4 bg-[#1a3a5b] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
      >
        <Plus className="size-5" />
        Registrar Nova Pesquisa
      </button>
    </div>
  );
}
