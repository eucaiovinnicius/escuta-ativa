import React, { useState, useMemo } from 'react';
import { Target, Save, Users, TrendingUp, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getUsuarios, getMeta, saveMeta } from '../services/storage';
import { sbUpsertMeta } from '../services/supabaseService';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';

export function AdminMetas() {
  const { success } = useToast();

  const servidores = useMemo(
    () => getUsuarios().filter(u => u.perfil === 'servidor' && u.ativo),
    []
  );

  // Estado local: valor atual de cada meta (inicializa com o valor salvo)
  const [metas, setMetas] = useState<Record<string, number>>(() =>
    Object.fromEntries(servidores.map(s => [s.id, getMeta(s.id)]))
  );

  const [metaGlobal, setMetaGlobal] = useState(20);
  const [salvos, setSalvos] = useState<Record<string, boolean>>({});

  const handleChange = (id: string, valor: number) => {
    setMetas(prev => ({ ...prev, [id]: valor }));
    setSalvos(prev => ({ ...prev, [id]: false }));
  };

  const handleSalvarIndividual = async (id: string) => {
    const valor = metas[id];
    if (!valor || valor < 1) return;
    saveMeta(id, valor);
    setSalvos(prev => ({ ...prev, [id]: true }));
    success('Meta atualizada!');
    await sbUpsertMeta(id, valor).catch(() => {});
  };

  const handleAplicarGlobal = async () => {
    if (!metaGlobal || metaGlobal < 1) return;
    servidores.forEach(s => {
      saveMeta(s.id, metaGlobal);
    });
    setMetas(Object.fromEntries(servidores.map(s => [s.id, metaGlobal])));
    setSalvos(Object.fromEntries(servidores.map(s => [s.id, true])));
    success(`Meta de ${metaGlobal} pesquisas/semana aplicada para todos os servidores!`);
    await Promise.all(servidores.map(s => sbUpsertMeta(s.id, metaGlobal))).catch(() => {});
  };

  const totalServidores = servidores.length;
  const mediaGeral = totalServidores > 0
    ? Math.round((Object.values(metas) as number[]).reduce((a, b) => a + b, 0) / totalServidores)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Metas Semanais</h1>
        <p className="text-slate-500 text-sm mt-1">
          Defina quantas pesquisas cada servidor deve registrar por semana.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="size-9 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <Users className="size-4 text-blue-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servidores ativos</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalServidores}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="size-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
            <Target className="size-4 text-amber-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Média das metas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{mediaGeral} <span className="text-sm font-medium text-slate-400">/ semana</span></p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="size-9 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta total equipe</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {(Object.values(metas) as number[]).reduce((a, b) => a + b, 0)} <span className="text-sm font-medium text-slate-400">/ semana</span>
          </p>
        </div>
      </div>

      {/* Meta global */}
      <div className="bg-[#1a3a5b] rounded-2xl p-6 text-white">
        <h2 className="font-bold text-base mb-1">Aplicar meta igual para todos</h2>
        <p className="text-white/60 text-sm mb-5">
          Define o mesmo número de pesquisas por semana para todos os servidores ativos.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 flex-1 max-w-[200px]">
            <input
              type="number"
              min={1}
              max={200}
              value={metaGlobal}
              onChange={e => setMetaGlobal(parseInt(e.target.value) || 0)}
              className="w-full bg-transparent text-white font-black text-xl outline-none"
            />
            <span className="text-white/50 text-xs font-bold uppercase whitespace-nowrap">pesq/sem</span>
          </div>
          <button
            onClick={handleAplicarGlobal}
            disabled={!metaGlobal || metaGlobal < 1}
            className="flex items-center gap-2 px-6 py-3 bg-[#F0A500] text-[#1a3a5b] rounded-xl font-black text-sm hover:bg-[#F0A500]/90 transition-all disabled:opacity-40"
          >
            <CheckCircle2 className="size-4" />
            Aplicar para todos
          </button>
        </div>
      </div>

      {/* Metas individuais */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Metas individuais</h2>
          <p className="text-xs text-slate-500 mt-0.5">Edite e salve a meta de cada servidor separadamente.</p>
        </div>

        {servidores.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <div className="size-12 bg-slate-50 rounded-full flex items-center justify-center">
              <Users className="size-6 text-slate-300" />
            </div>
            <p className="font-bold text-slate-900">Nenhum servidor cadastrado</p>
            <p className="text-sm text-slate-500">Cadastre servidores em Gerenciar Usuários.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {servidores.map((servidor) => {
              const metaAtual = getMeta(servidor.id);
              const metaNova = metas[servidor.id];
              const alterado = metaNova !== metaAtual;
              const foiSalvo = salvos[servidor.id];

              return (
                <motion.div
                  key={servidor.id}
                  layout
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-all"
                >
                  {/* Avatar + info */}
                  <div className="size-10 rounded-full bg-[#1a3a5b]/10 flex items-center justify-center text-sm font-black text-[#1a3a5b] shrink-0">
                    {servidor.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{servidor.nome}</p>
                    <p className="text-xs text-slate-500">{servidor.cargo} · {servidor.regiao || 'Sem região'}</p>
                  </div>

                  {/* Meta atual (badge) */}
                  <div className="hidden sm:flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Atual</span>
                    <span className="text-sm font-black text-slate-600">{metaAtual}</span>
                  </div>

                  {/* Input nova meta */}
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={metaNova}
                      onChange={e => handleChange(servidor.id, parseInt(e.target.value) || 0)}
                      className={cn(
                        "w-20 px-3 py-2 border rounded-xl text-sm font-bold text-center outline-none focus:ring-2 transition-all",
                        alterado && !foiSalvo
                          ? "border-amber-300 bg-amber-50 text-amber-700 focus:ring-amber-200"
                          : foiSalvo
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-700 focus:ring-[#1a3a5b]/20"
                      )}
                    />
                  </div>

                  {/* Botão salvar */}
                  <button
                    onClick={() => handleSalvarIndividual(servidor.id)}
                    disabled={!alterado && !foiSalvo}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all",
                      foiSalvo
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : alterado
                          ? "bg-[#1a3a5b] text-white hover:bg-[#1a3a5b]/90 shadow-sm"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {foiSalvo
                      ? <><CheckCircle2 className="size-3.5" /> Salvo</>
                      : <><Save className="size-3.5" /> Salvar</>
                    }
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
