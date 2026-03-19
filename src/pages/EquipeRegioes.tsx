import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  ChevronRight, 
  AlertTriangle, 
  Users, 
  Clock, 
  BarChart3,
  TrendingUp,
  Tag
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getRegioes 
} from '../services/storage';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { 
  calcularTopCategorias, 
  gerarRadarUrgencias 
} from '../utils/calculos';
import { cn } from '../lib/utils';
import { Pesquisa } from '../types';

export function EquipeRegioes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { pesquisas: todasPesquisas, usuarios, fonte } = useSupabaseData();

  // Base Data
  const pesquisasEquipe = useMemo(() => {
    if (fonte === 'supabase') {
      return todasPesquisas.filter(p => {
        if (user?.perfil === 'admin') return true;
        const servidor = usuarios.find(u => u.id === p.servidor_id);
        return p.servidor_id === user?.id || servidor?.supervisor_id === user?.id;
      });
    }
    
    return todasPesquisas.filter(p => {
      if (user?.perfil === 'admin') return true;
      const servidor = usuarios.find(u => u.id === p.servidor_id);
      return p.servidor_id === user?.id || servidor?.supervisor_id === user?.id;
    });
  }, [user, todasPesquisas, usuarios, fonte]);
  // Group by region
  const regionStats = useMemo(() => {
    const stats: Record<string, Pesquisa[]> = {};
    
    // Initialize with all regions
    getRegioes().forEach(r => stats[r] = []);
    
    pesquisasEquipe.forEach(p => {
      if (!stats[p.morador.regiao]) stats[p.morador.regiao] = [];
      stats[p.morador.regiao].push(p);
    });

    const maxCount = Math.max(...Object.values(stats).map(arr => arr.length), 1);

    return Object.entries(stats).map(([regiao, pesquisas]) => {
      const count = pesquisas.length;
      const topCat = count > 0 ? calcularTopCategorias(pesquisas)[0]?.categoria : "Nenhuma";
      const servidores = Array.from(new Set(pesquisas.map(p => p.servidor_nome)));
      const ultima = count > 0 
        ? [...pesquisas].sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())[0].timestamp 
        : null;

      return {
        regiao,
        count,
        percentualBarra: (count / maxCount) * 100,
        categoriaPrincipal: topCat,
        servidores,
        ultimaPesquisa: ultima
      };
    }).sort((a, b) => b.count - a.count);
  }, [pesquisasEquipe]);

  // Urgency Radar
  const radarUrgencias = useMemo(() => 
    gerarRadarUrgencias(pesquisasEquipe), 
    [pesquisasEquipe]
  );

  const urgenciaColors = {
    "Baixa": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Média": "bg-amber-50 text-amber-600 border-amber-100",
    "Alta": "bg-orange-50 text-orange-600 border-orange-100",
    "Crítica": "bg-rose-50 text-rose-600 border-rose-100"
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Regiões da Equipe</h1>
        <p className="text-slate-500 text-sm">Distribuição geográfica e focos de urgência</p>
      </div>

      {/* Region Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {regionStats.map((stat) => (
          <RegionCard 
            key={stat.regiao} 
            stat={stat} 
            onView={() => navigate(`/equipe/pesquisas?regiao=${stat.regiao}`)}
          />
        ))}
      </div>

      {/* Urgency Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg">
              <AlertTriangle className="size-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Radar de Urgências</h2>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {radarUrgencias.length} focos identificados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Região</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ocorrências</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Urgência</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {radarUrgencias.map((item, idx) => (
                <tr 
                  key={`${item.regiao}-${item.categoria}-${idx}`}
                  onClick={() => navigate(`/equipe/pesquisas?regiao=${item.regiao}&categoria=${item.categoria}`)}
                  className="hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-700">{item.regiao}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag className="size-3 text-slate-400" />
                      <span className="text-sm text-slate-600">{item.categoria}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="size-3 text-slate-400" />
                      <span className="text-sm font-black text-slate-900">{item.count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black uppercase border",
                      urgenciaColors[item.urgencia]
                    )}>
                      {item.urgencia}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-[#1a3a5b] group-hover:translate-x-1 transition-all" />
                  </td>
                </tr>
              ))}
              {radarUrgencias.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    Nenhuma urgência crítica detectada no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RegionCard({ stat, onView }: any) {
  const { regiao, count, percentualBarra, categoriaPrincipal, servidores, ultimaPesquisa } = stat;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1a3a5b]/5 rounded-xl">
              <MapPin className="size-5 text-[#1a3a5b]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#1a3a5b] transition-colors">{regiao}</h3>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">{count}</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Registros</p>
          </div>
        </div>

        {count > 0 ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Volume Relativo</span>
                <span>{Math.round(percentualBarra)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentualBarra}%` }}
                  className="h-full bg-[#1a3a5b]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 py-4 border-y border-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <TrendingUp className="size-3 text-slate-400" />
                  <span>Principal Demanda:</span>
                </div>
                <span className="text-xs font-bold text-slate-700">{categoriaPrincipal}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Users className="size-3 text-slate-400" />
                  <span>Servidores:</span>
                </div>
                <div className="flex -space-x-2">
                  {servidores.slice(0, 3).map((nome: string, i: number) => (
                    <div 
                      key={nome} 
                      className="size-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600"
                      title={nome}
                    >
                      {nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                    </div>
                  ))}
                  {servidores.length > 3 && (
                    <div className="size-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">
                      +{servidores.length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="size-3" />
                {ultimaPesquisa 
                  ? `Última ${formatDistanceToNow(parseISO(ultimaPesquisa), { addSuffix: true, locale: ptBR })}`
                  : 'Sem registros'
                }
              </div>
              <button 
                onClick={onView}
                className="text-xs font-bold text-[#1a3a5b] hover:underline flex items-center gap-1"
              >
                Ver Pesquisas
                <ChevronRight className="size-3" />
              </button>
            </div>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <div className="size-10 bg-slate-50 rounded-full flex items-center justify-center">
              <MapPin className="size-5 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400 italic">Sem registros nesta região</p>
          </div>
        )}
      </div>
    </div>
  );
}
