import React, { useState, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, ChevronRight, ChevronLeft,
  MapPin, Tag, Calendar, User, AlertTriangle,
  CheckCircle2, Clock, XCircle, Search, Filter, X
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { KanbanCard, KanbanFase } from '../types';
import { uuid } from '../utils/calculos';
import { Dialog } from './ui/Dialog';
import { cn } from '../lib/utils';

const FASES: { id: KanbanFase; label: string; cor: string; icone: React.ReactNode }[] = [
  { id: "identificado", label: "Identificado",  cor: "bg-slate-100 border-slate-200",   icone: <AlertTriangle className="size-4 text-slate-500" /> },
  { id: "analisando",   label: "Analisando",    cor: "bg-blue-50 border-blue-200",      icone: <Search className="size-4 text-blue-500" /> },
  { id: "em_andamento", label: "Em Andamento",  cor: "bg-amber-50 border-amber-200",    icone: <Clock className="size-4 text-amber-500" /> },
  { id: "aguardando",   label: "Aguardando",    cor: "bg-purple-50 border-purple-200",  icone: <Filter className="size-4 text-purple-500" /> },
  { id: "concluido",    label: "Concluído",     cor: "bg-emerald-50 border-emerald-200",icone: <CheckCircle2 className="size-4 text-emerald-500" /> },
  { id: "cancelado",    label: "Cancelado",     cor: "bg-rose-50 border-rose-200",      icone: <XCircle className="size-4 text-rose-500" /> },
];

const URGENCIA_COLORS: Record<string, string> = {
  "Crítica": "bg-rose-50 text-rose-600 border-rose-100",
  "Alta":    "bg-orange-50 text-orange-600 border-orange-100",
  "Média":   "bg-amber-50 text-amber-600 border-amber-100",
  "Baixa":   "bg-emerald-50 text-emerald-600 border-emerald-100",
};

interface KanbanBoardProps {
  cards: KanbanCard[];
  onSave: (card: KanbanCard) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, fase: KanbanFase) => void;
  initialCardData?: Partial<KanbanCard> | null;
  openModalOnMount?: boolean;
  onModalClose?: () => void;
}

export function KanbanBoard({ cards, onSave, onDelete, onMove, initialCardData, openModalOnMount, onModalClose }: KanbanBoardProps) {
  const [showModal, setShowModal] = useState(!!openModalOnMount);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filtroFase, setFiltroFase] = useState<KanbanFase | "todas">("todas");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todas");
  const [busca, setBusca] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const cardsFiltrados = useMemo(() => cards.filter(c => {
    if (filtroFase !== "todas" && c.fase !== filtroFase) return false;
    if (filtroUrgencia !== "todas" && c.urgencia !== filtroUrgencia) return false;
    if (busca) {
      const b = busca.toLowerCase();
      if (!c.titulo.toLowerCase().includes(b) && !c.descricao.toLowerCase().includes(b) &&
          !c.regiao.toLowerCase().includes(b) && !c.categoria.toLowerCase().includes(b) &&
          !c.responsavel.toLowerCase().includes(b)) return false;
    }
    return true;
  }), [cards, filtroFase, filtroUrgencia, busca]);

  const cardsPorFase = useMemo(() => {
    const map: Record<KanbanFase, KanbanCard[]> = {
      identificado: [], analisando: [], em_andamento: [], aguardando: [], concluido: [], cancelado: []
    };
    cardsFiltrados.forEach(c => map[c.fase].push(c));
    return map;
  }, [cardsFiltrados]);

  const stats = useMemo(() => ({
    total: cards.length,
    ativos: cards.filter(c => c.fase !== "concluido" && c.fase !== "cancelado").length,
    criticos: cards.filter(c => c.urgencia === "Crítica" && c.fase !== "concluido" && c.fase !== "cancelado").length,
    concluidos: cards.filter(c => c.fase === "concluido").length,
  }), [cards]);

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCard(null);
    onModalClose?.();
  };

  return (
    <div className="space-y-6">
      {/* Topo: stats + controles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          {[
            { valor: stats.total,      label: "Total",      cor: "text-slate-900" },
            { valor: stats.ativos,     label: "Em Aberto",  cor: "text-amber-600" },
            { valor: stats.criticos,   label: "Críticos",   cor: "text-rose-600" },
            { valor: stats.concluidos, label: "Concluídos", cor: "text-emerald-600" },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <div className="text-center">
                <p className={cn("text-2xl font-black", s.cor)}>{s.valor}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</p>
              </div>
              {i < arr.length - 1 && <div className="w-px h-8 bg-slate-200" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text" placeholder="Buscar..." value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 outline-none w-full sm:w-44"
            />
          </div>
          <select value={filtroUrgencia} onChange={e => setFiltroUrgencia(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20">
            <option value="todas">Todas urgências</option>
            <option value="Crítica">Crítica</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>
          <select value={filtroFase} onChange={e => setFiltroFase(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20">
            <option value="todas">Todas as fases</option>
            {FASES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          {(busca || filtroUrgencia !== "todas" || filtroFase !== "todas") && (
            <button onClick={() => { setBusca(""); setFiltroUrgencia("todas"); setFiltroFase("todas"); }}
              className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all">
              <X className="size-4" />
            </button>
          )}
          <button onClick={() => { setEditingCard(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2 bg-[#1a3a5b] text-white rounded-lg text-sm font-bold hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20">
            <Plus className="size-4" /> Nova Ação
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {FASES.map(fase => {
            const cardsNaFase = cardsPorFase[fase.id];
            return (
              <div key={fase.id} className={cn("w-[280px] sm:w-72 flex-shrink-0 flex flex-col rounded-2xl border-2 overflow-hidden", fase.cor)}>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {fase.icone}
                    <span className="text-sm font-bold text-slate-700">{fase.label}</span>
                  </div>
                  <span className="size-6 rounded-full bg-white/80 flex items-center justify-center text-[10px] font-black text-slate-600 border border-slate-200">
                    {cardsNaFase.length}
                  </span>
                </div>

                <div className="flex-1 p-3 space-y-3 min-h-[120px]">
                  <AnimatePresence>
                    {cardsNaFase.map(card => {
                      const faseIds = FASES.map(f => f.id);
                      const faseIdx = faseIds.indexOf(card.fase);
                      return (
                        <motion.div key={card.id} layout
                          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
                          {/* Header do card */}
                          <div className="px-4 pt-3 flex items-center justify-between">
                            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase border", URGENCIA_COLORS[card.urgencia])}>
                              {card.urgencia}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => { setEditingCard(card); setShowModal(true); }}
                                className="p-1 text-slate-400 hover:text-[#1a3a5b] rounded transition-all">
                                <Edit2 className="size-3" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(card.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-all">
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>

                          {/* Corpo do card (clicável para expandir) */}
                          <div className="p-4 pt-2 cursor-pointer"
                            onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug mb-2">{card.titulo}</h4>
                            <div className="flex flex-wrap gap-2 mb-1">
                              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><MapPin className="size-3" />{card.regiao}</span>
                              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><Tag className="size-3" />{card.categoria}</span>
                            </div>

                            <AnimatePresence>
                              {expandedCard === card.id && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mt-3 space-y-2">
                                  <p className="text-xs text-slate-600 leading-relaxed border-l-2 border-slate-100 pl-3 italic">{card.descricao}</p>
                                  {card.responsavel && (
                                    <div className="flex items-center gap-2">
                                      <div className="size-5 rounded-full bg-[#1a3a5b]/10 flex items-center justify-center">
                                        <User className="size-3 text-[#1a3a5b]" />
                                      </div>
                                      <span className="text-xs font-medium text-slate-600">{card.responsavel}</span>
                                    </div>
                                  )}
                                  {card.prazo && (
                                    <div className={cn("flex items-center gap-1.5 text-xs font-medium",
                                      isPast(parseISO(card.prazo)) && card.fase !== "concluido" ? "text-rose-600" :
                                      isToday(parseISO(card.prazo)) ? "text-amber-600" : "text-slate-500")}>
                                      <Calendar className="size-3" />
                                      {isPast(parseISO(card.prazo)) && card.fase !== "concluido" ? "⚠ Vencido: " :
                                       isToday(parseISO(card.prazo)) ? "⏰ Vence hoje: " : "Prazo: "}
                                      {format(parseISO(card.prazo), "dd/MM/yyyy")}
                                    </div>
                                  )}
                                  {card.notas && (
                                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">{card.notas}</p>
                                  )}
                                  {card.pesquisas_ids.length > 0 && (
                                    <p className="text-[10px] text-slate-400">{card.pesquisas_ids.length} pesquisa(s) vinculada(s)</p>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Footer: navegação entre fases */}
                          <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-slate-50">
                            <span className="text-[9px] text-slate-400 font-medium">
                              {format(parseISO(card.atualizado_em), "dd/MM HH:mm")}
                            </span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => faseIdx > 0 && onMove(card.id, faseIds[faseIdx - 1])}
                                disabled={faseIdx === 0}
                                className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20 rounded transition-all"
                                title="Fase anterior">
                                <ChevronLeft className="size-3.5" />
                              </button>
                              <button onClick={() => faseIdx < faseIds.length - 1 && onMove(card.id, faseIds[faseIdx + 1])}
                                disabled={faseIdx === faseIds.length - 1}
                                className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20 rounded transition-all"
                                title="Próxima fase">
                                <ChevronRight className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {cardsNaFase.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-slate-200/70 rounded-xl flex items-center justify-center">
                      <p className="text-[10px] font-medium text-slate-300">Nenhuma ação</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal criar/editar */}
      <AnimatePresence>
        {showModal && (
          <KanbanCardModal
            card={editingCard}
            initialData={!editingCard ? initialCardData : null}
            onSave={card => { onSave(card); handleCloseModal(); }}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão */}
      <Dialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { onDelete(deleteConfirmId); setDeleteConfirmId(null); } }}
        title="Excluir ação?"
        description="Esta ação será removida permanentemente. As pesquisas vinculadas não são afetadas."
        confirmText="Sim, Excluir"
        variant="danger"
      />
    </div>
  );
}

// ─── Modal de criar / editar card ──────────────────────────────────────────

interface KanbanCardModalProps {
  card: KanbanCard | null;
  initialData?: Partial<KanbanCard> | null;
  onSave: (card: KanbanCard) => void;
  onClose: () => void;
}

function KanbanCardModal({ card, initialData, onSave, onClose }: KanbanCardModalProps) {
  const now = new Date().toISOString();
  const [form, setForm] = useState({
    titulo:      card?.titulo      ?? initialData?.titulo      ?? "",
    descricao:   card?.descricao   ?? initialData?.descricao   ?? "",
    regiao:      card?.regiao      ?? initialData?.regiao      ?? "",
    categoria:   card?.categoria   ?? initialData?.categoria   ?? "",
    urgencia:    card?.urgencia    ?? initialData?.urgencia    ?? "Média" as KanbanCard["urgencia"],
    fase:        card?.fase        ?? "identificado" as KanbanFase,
    responsavel: card?.responsavel ?? "",
    prazo:       card?.prazo       ?? "",
    notas:       card?.notas       ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.titulo.trim())      e.titulo      = "Obrigatório";
    if (!form.descricao.trim())   e.descricao   = "Obrigatório";
    if (!form.regiao.trim())      e.regiao      = "Obrigatório";
    if (!form.categoria.trim())   e.categoria   = "Obrigatório";
    if (!form.responsavel.trim()) e.responsavel = "Obrigatório";
    if (Object.keys(e).length) { setErrors(e); return; }

    onSave({
      id:           card?.id ?? uuid(),
      titulo:       form.titulo,
      descricao:    form.descricao,
      regiao:       form.regiao,
      categoria:    form.categoria,
      urgencia:     form.urgencia,
      fase:         form.fase,
      responsavel:  form.responsavel,
      prazo:        form.prazo || undefined,
      notas:        form.notas || undefined,
      pesquisas_ids: card?.pesquisas_ids ?? [],
      criado_em:    card?.criado_em ?? now,
      atualizado_em: now,
    });
  };

  const inputCls = (field: string) => cn(
    "w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20 transition-all",
    errors[field] ? "border-rose-300 bg-rose-50" : "border-slate-200"
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{card ? "Editar Ação" : "Nova Ação"}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Título <span className="text-rose-500">*</span></label>
            <input value={form.titulo} onChange={e => set("titulo", e.target.value)}
              placeholder="Ex: Resolver alagamentos no Centro" className={inputCls("titulo")} />
            {errors.titulo && <p className="text-xs text-rose-500">{errors.titulo}</p>}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Descrição / Problema <span className="text-rose-500">*</span></label>
            <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)}
              placeholder="Descreva o problema identificado nas pesquisas..." rows={3}
              className={cn(inputCls("descricao"), "resize-none")} />
            {errors.descricao && <p className="text-xs text-rose-500">{errors.descricao}</p>}
          </div>

          {/* Região + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Região <span className="text-rose-500">*</span></label>
              <input value={form.regiao} onChange={e => set("regiao", e.target.value)}
                placeholder="Ex: Centro" className={inputCls("regiao")} />
              {errors.regiao && <p className="text-xs text-rose-500">{errors.regiao}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Categoria <span className="text-rose-500">*</span></label>
              <input value={form.categoria} onChange={e => set("categoria", e.target.value)}
                placeholder="Ex: Infraestrutura" className={inputCls("categoria")} />
              {errors.categoria && <p className="text-xs text-rose-500">{errors.categoria}</p>}
            </div>
          </div>

          {/* Urgência + Fase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Urgência</label>
              <select value={form.urgencia} onChange={e => set("urgencia", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20">
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
                <option value="Crítica">Crítica</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Fase Inicial</label>
              <select value={form.fase} onChange={e => set("fase", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20">
                {FASES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* Responsável + Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Responsável <span className="text-rose-500">*</span></label>
              <input value={form.responsavel} onChange={e => set("responsavel", e.target.value)}
                placeholder="Nome do responsável" className={inputCls("responsavel")} />
              {errors.responsavel && <p className="text-xs text-rose-500">{errors.responsavel}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Prazo (opcional)</label>
              <input type="date" value={form.prazo} onChange={e => set("prazo", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20" />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Notas de Acompanhamento (opcional)</label>
            <textarea value={form.notas} onChange={e => set("notas", e.target.value)}
              placeholder="Atualizações, contatos realizados, próximos passos..." rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20 resize-none transition-all" />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit}
            className="px-8 py-2.5 bg-[#1a3a5b] text-white rounded-xl font-bold text-sm hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20">
            {card ? "Salvar Alterações" : "Criar Ação"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
