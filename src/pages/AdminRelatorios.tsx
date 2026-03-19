import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingUp, 
  Mic, 
  Database, 
  History,
  CheckCircle2,
  Printer,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { 
  getPesquisas, 
  getUsuarios, 
  getExportacoes, 
  saveExportacao, 
  getBackupData,
  getPesquisasByServidor,
  getRegioes,
  CATEGORIAS,
  getMeta,
  getPerguntas
} from '../services/storage';
import { 
  filtrarPorPeriodo, 
  gerarCSV, 
  gerarRadarUrgencias,
  calcularVariacao,
  calcularPesquisasPeriodoAnterior
} from '../utils/calculos';
import { cn } from '../lib/utils';
import { Pesquisa, Exportacao, RadarItem } from '../types';

export function AdminRelatorios() {
  const { user } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Filter states for Card 1
  const [periodo, setPeriodo] = useState<string>("mes");
  const [regiao, setRegiao] = useState<string>("all");
  const [categoria, setCategoria] = useState<string>("all");
  const [servidor, setServidor] = useState<string>("all");

  // Local state for editable fields
  const [propostasAcao, setPropostasAcao] = useState<Record<string, string>>({});
  const [sugestoesPauta, setSugestoesPauta] = useState<Record<string, string>>({});
  const briefingRef = useRef<HTMLDivElement>(null);
  const [semanaRelatorio] = useState(() => {
    const hoje = new Date();
    return format(hoje, "'Semana de' dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  });

  // Base Data
  const todasPesquisas = useMemo(() => getPesquisas(), []);
  const todosServidores = useMemo(() => getUsuarios().filter(u => u.perfil === "servidor"), []);
  const exportacoes = useMemo(() => getExportacoes(), [showToast]);

  // Filtered Data for Card 1
  const pesquisasFiltradas = useMemo(() => {
    let filtered = filtrarPorPeriodo(todasPesquisas, periodo as any);
    if (regiao !== "all") filtered = filtered.filter(p => p.morador.regiao === regiao);
    if (categoria !== "all") filtered = filtered.filter(p => p.respostas['categoria_principal'] === categoria || Object.values(p.respostas)[0] === categoria);
    if (servidor !== "all") filtered = filtered.filter(p => p.servidor_id === servidor);
    return filtered;
  }, [todasPesquisas, periodo, regiao, categoria, servidor]);

  // Radar for Card 2
  const radarDores = useMemo(() => gerarRadarUrgencias(todasPesquisas), [todasPesquisas]);

  // Briefing for Card 4
  const briefingDores = useMemo(() => 
    gerarRadarUrgencias(filtrarPorPeriodo(todasPesquisas, "semana")).slice(0, 5), 
    [todasPesquisas]
  );

  const registerExport = (tipo: string) => {
    if (!user) return;
    const exp: Exportacao = {
      id: crypto.randomUUID(),
      tipo,
      data: new Date().toISOString(),
      usuario_nome: user.nome
    };
    saveExportacao(exp);
    setToastMsg(`Exportação "${tipo}" realizada com sucesso!`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleGerarPDF = () => {
    if (!briefingRef.current) return;

    const conteudo = briefingRef.current.innerHTML;
    const estilos = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #0f172a; padding: 40px; }
        .briefing-header { border-bottom: 3px solid #1a3a5b; padding-bottom: 20px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
        .briefing-title { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; color: #1a3a5b; }
        .briefing-subtitle { font-size: 13px; color: #64748b; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .briefing-logo { font-size: 11px; color: #94a3b8; text-align: right; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .dor-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; break-inside: avoid; }
        .dor-numero { display: inline-flex; width: 32px; height: 32px; background: #1a3a5b; color: white; border-radius: 50%; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; margin-right: 12px; }
        .dor-regiao { font-size: 10px; color: #F0A500; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
        .dor-categoria { font-size: 20px; font-weight: 800; color: #0f172a; margin: 4px 0 12px; }
        .dor-ocorrencias { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
        .dor-urgencia-Crítica { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
        .dor-urgencia-Alta { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
        .dor-urgencia-Média { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
        .dor-urgencia-Baixa { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
        .dor-relato { font-size: 13px; color: #475569; font-style: italic; border-left: 3px solid #e2e8f0; padding-left: 12px; margin-bottom: 16px; line-height: 1.6; }
        .pauta-label { font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
        .pauta-texto { font-size: 13px; color: #1e293b; line-height: 1.6; min-height: 40px; border: 1px dashed #e2e8f0; border-radius: 8px; padding: 10px 12px; }
        .briefing-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .vazio { text-align: center; padding: 60px 20px; color: #94a3b8; font-style: italic; }
      </style>
    `;

    const janela = window.open('', '_blank', 'width=900,height=700');
    if (!janela) return;

    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Briefing Social Media — ${semanaRelatorio}</title>${estilos}</head><body>${conteudo}</body></html>`);
    janela.document.close();
    janela.onload = () => {
      janela.print();
    };

    registerExport('Briefing Social Media');
  };

  const exportExcel = (dados: any[], fileName: string) => {
    let linhas: any[];

    // Se for array de Pesquisa (tem campo morador)
    if (dados.length > 0 && dados[0].morador !== undefined) {
      const perguntas = getPerguntas();
      const getTextoPergunta = (key: string) => {
        const p = perguntas.find(p => p.id === key);
        return p ? p.texto : key;
      };

      const todasChavesRespostas = new Set<string>();
      dados.forEach(p => Object.keys(p.respostas || {}).forEach(k => todasChavesRespostas.add(k)));
      const chavesRespostas = Array.from(todasChavesRespostas).sort();

      linhas = dados.map(p => {
        const row: any = {
          'ID':          p.id,
          'Data':        format(parseISO(p.timestamp), 'dd/MM/yyyy HH:mm'),
          'Servidor':    p.servidor_nome,
          'Região':      p.morador.regiao,
          'Morador':     p.morador.nome,
          'Telefone':    p.morador.telefone,
          'Endereço':    p.morador.endereco,
          'Observações': p.atendimento?.observacoes || '',
          'Status':      p.status,
        };

        chavesRespostas.forEach(k => {
          row[getTextoPergunta(k)] = String(p.respostas?.[k] || '').replace(/\n/g, ' ');
        });

        return row;
      });
    } else {
      // Para RadarItem, performance, etc — usar como está
      linhas = dados;
    }

    const worksheet = XLSX.utils.json_to_sheet(linhas);

    // Ajustar largura das colunas automaticamente
    const colWidths = Object.keys(linhas[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    registerExport(fileName);
  };

  const exportCSV = (data: any[], fileName: string) => {
    gerarCSV(data, `${fileName}.csv`);
    registerExport(fileName);
  };

  const handleBackup = () => {
    const data = getBackupData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup_escuta_ativa_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    link.click();
    registerExport("Backup Completo (JSON)");
  };

  return (
    <div className="space-y-8 pb-12 print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Relatórios e Exportações</h1>
        <p className="text-slate-500 text-sm">Gere documentos e planilhas para análise e backup</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
        {/* Card 1: Relatório Completo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="size-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Relatório Completo de Pesquisas</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Período</label>
              <select value={periodo} onChange={e => setPeriodo(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none">
                <option value="hoje">Hoje</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mês</option>
                <option value="trimestre">Últimos 3 meses</option>
                <option value="tudo">Tudo</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Região</label>
              <select value={regiao} onChange={e => setRegiao(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none">
                <option value="all">Todas as regiões</option>
                {getRegioes().map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none">
                <option value="all">Todas as categorias</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Servidor</label>
              <select value={servidor} onChange={e => setServidor(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none">
                <option value="all">Todos os servidores</option>
                {todosServidores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button 
              onClick={() => exportCSV(pesquisasFiltradas, `pesquisas_${format(new Date(), 'yyyy-MM-dd')}`)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              <Download className="size-4" />
              Exportar CSV
            </button>
            <button 
              onClick={() => exportExcel(pesquisasFiltradas, `pesquisas_${format(new Date(), 'yyyy-MM-dd')}`)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet className="size-4" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Card 2: Relatório de Dores */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 flex flex-col">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg">
              <AlertTriangle className="size-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Relatório de Dores por Região</h2>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[200px] border border-slate-100 rounded-xl scrollbar-hide">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase">Região</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase">Dor Principal</th>
                  <th className="px-3 py-2 font-bold text-slate-400 uppercase">Proposta de Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {radarDores.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-bold text-slate-700">{item.regiao}</td>
                    <td className="px-3 py-2 text-slate-600">{item.categoria}</td>
                    <td className="px-3 py-2">
                      <input 
                        type="text" 
                        placeholder="Descreva a ação..."
                        value={propostasAcao[`${item.regiao}-${item.categoria}`] || ""}
                        onChange={e => setPropostasAcao(prev => ({ ...prev, [`${item.regiao}-${item.categoria}`]: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-rose-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button 
              onClick={() => {
                const data = radarDores.map(item => ({
                  ...item,
                  proposta_acao: propostasAcao[`${item.regiao}-${item.categoria}`] || ""
                }));
                exportCSV(data, `dores_regiao_${format(new Date(), 'yyyy-MM-dd')}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              <Download className="size-4" />
              Exportar CSV
            </button>
            <button 
              onClick={() => {
                const data = radarDores.map(item => ({
                  ...item,
                  proposta_acao: propostasAcao[`${item.regiao}-${item.categoria}`] || ""
                }));
                exportExcel(data, `dores_regiao_${format(new Date(), 'yyyy-MM-dd')}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
            >
              <FileSpreadsheet className="size-4" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Card 3: Performance da Equipe */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="size-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Performance da Equipe</h2>
          </div>
          
          <p className="text-sm text-slate-500">Gere um relatório detalhado com as métricas de produtividade e metas de todos os servidores ativos.</p>

          <div className="pt-4 flex items-center gap-3">
            <button 
              onClick={() => {
                const data = todosServidores.map(s => {
                  const p = getPesquisasByServidor(s.id);
                  return {
                    nome: s.nome,
                    regiao: s.regiao,
                    total_pesquisas: p.length,
                    meta_semanal: getMeta(s.id),
                    percentual_meta: Math.round((p.length / getMeta(s.id)) * 100)
                  };
                });
                exportCSV(data, `performance_equipe_${format(new Date(), 'yyyy-MM-dd')}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
            >
              <Download className="size-4" />
              Exportar CSV
            </button>
            <button 
              onClick={() => {
                const data = todosServidores.map(s => {
                  const p = getPesquisasByServidor(s.id);
                  return {
                    nome: s.nome,
                    regiao: s.regiao,
                    total_pesquisas: p.length,
                    meta_semanal: getMeta(s.id),
                    percentual_meta: Math.round((p.length / getMeta(s.id)) * 100)
                  };
                });
                exportExcel(data, `performance_equipe_${format(new Date(), 'yyyy-MM-dd')}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a3a5b] text-white rounded-xl font-bold text-sm hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
            >
              <FileSpreadsheet className="size-4" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Card 5: Backup */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <History className="size-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Backup Completo do Sistema</h2>
          </div>
          
          <p className="text-sm text-white/60 leading-relaxed">Baixe todos os dados do sistema (usuários, pesquisas, metas e perguntas) em um único arquivo JSON para segurança ou migração.</p>

          <div className="pt-4">
            <button 
              onClick={handleBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-white/90 transition-all"
            >
              <Download className="size-4" />
              Baixar JSON de Backup
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: Briefing Social Media */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Mic className="size-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Briefing para Social Media</h2>
              <p className="text-sm text-slate-500">Top 5 dores da semana — sugestão de pauta para comunicação</p>
            </div>
          </div>
          <button
            onClick={handleGerarPDF}
            disabled={briefingDores.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="size-4" />
            Gerar PDF
          </button>
        </div>

        {briefingDores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="size-12 bg-slate-50 rounded-full flex items-center justify-center">
              <Mic className="size-6 text-slate-300" />
            </div>
            <p className="font-bold text-slate-900">Nenhuma dor registrada esta semana</p>
            <p className="text-sm text-slate-500">As dores aparecerão aqui quando pesquisas forem registradas.</p>
          </div>
        ) : (
          <div ref={briefingRef}>
            {/* Cabeçalho do briefing (aparece no PDF) */}
            <div className="briefing-header" style={{ display: 'none' }}>
              <div>
                <div className="briefing-title">Briefing de Campo</div>
                <div className="briefing-subtitle">{semanaRelatorio}</div>
              </div>
              <div className="briefing-logo">Escuta Ativa<br />Portal Admin</div>
            </div>

            <div className="space-y-4">
              {briefingDores.map((item, idx) => (
                <div key={idx} className="dor-card p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="dor-numero size-8 rounded-full bg-[#1a3a5b] text-white flex items-center justify-center text-sm font-black shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="dor-regiao text-[10px] font-black text-amber-500 uppercase tracking-widest">
                          {item.regiao}
                        </div>
                        <div className="dor-categoria text-lg font-bold text-slate-900">{item.categoria}</div>
                        <div className="dor-ocorrencias text-[10px] text-slate-400 font-bold uppercase">
                          {item.count} ocorrência{item.count !== 1 ? 's' : ''}
                        </div>
                        <span className={cn(
                          `dor-urgencia-${item.urgencia}`,
                          'px-2 py-0.5 rounded-full text-[9px] font-black uppercase border',
                          item.urgencia === 'Crítica' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          item.urgencia === 'Alta'    ? 'bg-orange-50 text-orange-600 border-orange-100' :
                          item.urgencia === 'Média'   ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-emerald-50 text-emerald-600 border-emerald-100'
                        )}>
                          {item.urgencia}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-black text-slate-900">{item.count}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">casos</div>
                    </div>
                  </div>

                  {item.dor_recente && (
                    <div className="dor-relato text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3 leading-relaxed">
                      "{item.dor_recente.slice(0, 180)}{item.dor_recente.length > 180 ? '...' : ''}"
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="pauta-label text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      💬 Sugestão de Pauta para Social Media
                    </label>
                    <textarea
                      placeholder="Ex: Gravar vídeo no local do problema, acionar secretaria X, story com enquete..."
                      value={sugestoesPauta[`${item.regiao}-${item.categoria}`] || ''}
                      onChange={e => setSugestoesPauta(prev => ({
                        ...prev,
                        [`${item.regiao}-${item.categoria}`]: e.target.value
                      }))}
                      rows={2}
                      className="pauta-texto w-full bg-white border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 resize-none transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé do briefing (aparece no PDF) */}
            <div className="briefing-footer" style={{ display: 'none' }}>
              <span>Escuta Ativa © {new Date().getFullYear()}</span>
              <span>{semanaRelatorio}</span>
            </div>
          </div>
        )}
      </div>

      {/* Export History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <History className="size-5 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">Histórico de Exportações</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Tipo</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Data</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Quem exportou</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exportacoes.map((exp) => (
                <tr key={exp.id}>
                  <td className="px-6 py-4 font-bold text-slate-700">{exp.tipo}</td>
                  <td className="px-6 py-4 text-slate-500">{format(parseISO(exp.data), "dd/MM/yyyy HH:mm")}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{exp.usuario_nome}</td>
                </tr>
              ))}
              {exportacoes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">Nenhuma exportação realizada ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 print:hidden"
          >
            <CheckCircle2 className="size-5" />
            <span className="font-medium">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
