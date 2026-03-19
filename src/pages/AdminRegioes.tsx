import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  Edit2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRegioes, saveRegioes, REGIOES_PADRAO } from '../services/storage';
import { sbSaveRegioes } from '../services/supabaseService';
import { useToast } from '../components/ui/Toast';
import { Dialog } from '../components/ui/Dialog';
import { cn } from '../lib/utils';

export function AdminRegioes() {
  const { success, error } = useToast();
  const [regioes, setRegioes] = useState<string[]>(() => getRegioes());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newRegiao, setNewRegiao] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);

  const handleAdd = () => {
    const trimmed = newRegiao.trim();
    if (!trimmed) return;
    if (regioes.includes(trimmed)) {
      error("Esta região já existe.");
      return;
    }
    setRegioes([...regioes, trimmed]);
    setNewRegiao("");
    setHasChanges(true);
  };

  const handleStartEdit = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    
    const newRegioes = [...regioes];
    newRegioes[editingIndex] = trimmed;
    setRegioes(newRegioes);
    setEditingIndex(null);
    setHasChanges(true);
  };

  const handleDelete = () => {
    if (showDeleteDialog === null) return;
    const newRegioes = regioes.filter((_, i) => i !== showDeleteDialog);
    setRegioes(newRegioes);
    setShowDeleteDialog(null);
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    saveRegioes(regioes);
    setHasChanges(false);
    success('Regiões salvas com sucesso!');
    // Sync to Supabase in background
    sbSaveRegioes(regioes).catch(() => {/* local já salvo */});
  };

  const handleReset = () => {
    setRegioes(REGIOES_PADRAO);
    setHasChanges(true);
    setShowResetDialog(false);
    success("Regiões restauradas para o padrão.");
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Regiões</h1>
          <p className="text-slate-500 text-sm">Adicione ou remova bairros e regiões do sistema</p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <button 
              onClick={handleSaveAll}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Save className="size-4" />
              Salvar Alterações
            </button>
          )}
          <button 
            onClick={() => setShowResetDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
          >
            <RotateCcw className="size-4" />
            Restaurar Padrão
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Adicionar Nova */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Plus className="size-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Nova Região</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome do Bairro/Região</label>
                <input 
                  type="text"
                  value={newRegiao}
                  onChange={e => setNewRegiao(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="Ex: Jardim das Flores"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/10 transition-all"
                />
              </div>
              <button 
                onClick={handleAdd}
                disabled={!newRegiao.trim()}
                className="w-full py-3 bg-[#1a3a5b] text-white rounded-xl font-bold text-sm hover:bg-[#1a3a5b]/90 disabled:opacity-50 transition-all shadow-lg shadow-[#1a3a5b]/20"
              >
                Adicionar à Lista
              </button>
            </div>
          </div>

          {hasChanges && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Você possui alterações não salvas. Clique em <strong>"Salvar Alterações"</strong> para aplicar no sistema.
              </p>
            </div>
          )}
        </div>

        {/* Lista de Regiões */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <MapPin className="size-5 text-slate-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Regiões Cadastradas</h2>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{regioes.length} regiões</span>
            </div>

            <div className="divide-y divide-slate-50">
              {regioes.map((regiao, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-xs font-black text-slate-300 w-4">{idx + 1}</span>
                    {editingIndex === idx ? (
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <input 
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                          onBlur={handleSaveEdit}
                          className="flex-1 px-3 py-1.5 bg-white border border-[#1a3a5b] rounded-lg text-sm outline-none shadow-sm"
                        />
                        <button onClick={handleSaveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <CheckCircle2 className="size-4" />
                        </button>
                        <button onClick={() => setEditingIndex(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{regiao}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleStartEdit(idx, regiao)}
                      className="p-2 text-slate-400 hover:text-[#1a3a5b] hover:bg-[#1a3a5b]/5 rounded-lg transition-all"
                      title="Editar nome"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button 
                      onClick={() => setShowDeleteDialog(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Excluir região"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {regioes.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic text-sm">
                  Nenhuma região cadastrada.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog 
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleReset}
        title="Restaurar Regiões Padrão?"
        description="Isso substituirá todas as regiões atuais pela lista padrão original. Esta ação não pode ser desfeita."
        confirmText="Sim, Restaurar"
        variant="danger"
      />

      <Dialog 
        isOpen={showDeleteDialog !== null}
        onClose={() => setShowDeleteDialog(null)}
        onConfirm={handleDelete}
        title="Excluir Região?"
        description={`Tem certeza que deseja excluir a região "${showDeleteDialog !== null ? regioes[showDeleteDialog] : ''}"?`}
        confirmText="Sim, Excluir"
        variant="danger"
      />
    </div>
  );
}
