import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Pencil, 
  Eye, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Settings2,
  Info,
  Layout
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useForm, useFieldArray } from 'react-hook-form';
import { useToast } from '../components/ui/Toast';
import { Dialog } from '../components/ui/Dialog';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPerguntas, 
  savePerguntas, 
  CATEGORIAS 
} from '../services/storage';
import { sbSavePerguntas } from '../services/supabaseService';
import { uuid } from '../utils/calculos';
import { PerguntaFormulario } from '../types';
import { cn } from '../lib/utils';

// --- Components ---

interface SortableItemProps {
  pergunta: PerguntaFormulario;
  isSelected: boolean;
  onSelect: () => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  key?: string | number;
}

function SortableQuestionItem({ pergunta, isSelected, onSelect, onToggleActive, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: pergunta.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group bg-white border rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md",
        isSelected ? "border-[#1a3a5b] ring-1 ring-[#1a3a5b]/10" : "border-slate-200",
        !pergunta.ativo && "opacity-60 bg-slate-50"
      )}
    >
      <button 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex-1 min-w-0" onClick={onSelect}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black text-slate-400 uppercase">P{pergunta.ordem}</span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{pergunta.tipo.replace('_', ' ')}</span>
          {pergunta.obrigatoria && (
            <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded uppercase border border-rose-100">Obrigatória</span>
          )}
        </div>
        <h4 className="text-sm font-bold text-slate-900 truncate">
          {pergunta.texto || <span className="text-slate-400 italic">Sem texto</span>}
        </h4>
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive(pergunta.id);
          }}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
            pergunta.ativo ? "bg-emerald-500" : "bg-slate-200"
          )}
        >
          <span className={cn(
            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
            pergunta.ativo ? "translate-x-5" : "translate-x-1"
          )} />
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="p-2 text-slate-400 hover:text-[#1a3a5b] hover:bg-[#1a3a5b]/5 rounded-lg transition-all"
        >
          <Pencil className="size-4" />
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(pergunta.id);
          }}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

// --- Main Page ---

export function AdminFormulario() {
  const navigate = useNavigate();
  const { success, error: toastError, info } = useToast();
  const [perguntas, setPerguntas] = useState<PerguntaFormulario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    setPerguntas(getPerguntas());
  }, []);

  // Selected question for editor
  const selectedPergunta = useMemo(() => 
    perguntas.find(p => p.id === selectedId), 
    [perguntas, selectedId]
  );

  // Form setup
  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = useForm<PerguntaFormulario>();
  
  const watchedOpcoes = watch("opcoes") || [];

  const appendOpcao = () => {
    const current = watch("opcoes") || [];
    setValue("opcoes", [...current, ""], { shouldDirty: true });
  };

  const removeOpcao = (index: number) => {
    const current = watch("opcoes") || [];
    setValue("opcoes", current.filter((_, i) => i !== index), { shouldDirty: true });
  };

  const tipo = watch("tipo");

  // Update form when selection changes
  useEffect(() => {
    if (selectedPergunta) {
      reset(selectedPergunta);
    }
  }, [selectedPergunta, reset]);

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle Drag End
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPerguntas((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);
        
        // Update order field
        return newArray.map((item, idx) => ({ ...(item as object), ordem: idx + 1 } as PerguntaFormulario));
      });
      setHasUnsavedChanges(true);
    }
  };

  // Actions
  const handleAddNew = () => {
    const maxOrder = perguntas.length > 0 ? Math.max(...perguntas.map(p => p.ordem)) : 0;
    const newId = uuid();
    const newPergunta: PerguntaFormulario = {
      id: newId,
      ordem: maxOrder + 1,
      texto: "",
      tipo: "texto_longo",
      obrigatoria: false,
      ativo: true,
      secao: "bairro"
    };
    setPerguntas([...perguntas, newPergunta]);
    setSelectedId(newId);
    setHasUnsavedChanges(true);
  };

  const handleToggleActive = (id: string) => {
    setPerguntas(perguntas.map(p => p.id === id ? { ...p, ativo: !p.ativo } : p));
    setHasUnsavedChanges(true);
  };

  const confirmDelete = () => {
    if (showDeleteDialog) {
      setPerguntas(perguntas.filter(p => p.id !== showDeleteDialog));
      if (selectedId === showDeleteDialog) setSelectedId(null);
      setHasUnsavedChanges(true);
      setShowDeleteDialog(null);
      success("Pergunta removida da cópia de trabalho.");
    }
  };

  const onSaveEditor = (data: PerguntaFormulario) => {
    // Validation for options
    if (["radio", "checkbox", "select"].includes(data.tipo)) {
      if (!data.opcoes || data.opcoes.length < 2) {
        toastError("Perguntas de seleção devem ter pelo menos 2 opções.");
        return;
      }
      if (data.opcoes.some(opt => !opt.trim())) {
        toastError("Todas as opções devem ter um texto preenchido.");
        return;
      }
    }

    setPerguntas(perguntas.map(p => p.id === data.id ? data : p));
    setHasUnsavedChanges(true);
    info("Alterações salvas na cópia de trabalho.");
  };

  const handlePublish = async () => {
    savePerguntas(perguntas);
    setHasUnsavedChanges(false);
    success('Formulário publicado com sucesso!');
    // Sync to Supabase in background
    sbSavePerguntas(perguntas).catch(() => {/* local já salvo */});
  };

  // Navigation Blocker (Native)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleConfirmExit = () => {
    setHasUnsavedChanges(false);
    setShowConfirmExit(false);
    navigate(-1);
  };

  const handleCancelExit = () => {
    setShowConfirmExit(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editor de Formulário</h1>
          <p className="text-slate-500 text-sm">Personalize as perguntas das visitas domiciliares</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Eye className="size-4" />
            Pré-visualizar
          </button>
          <button 
            onClick={handlePublish}
            disabled={!hasUnsavedChanges}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg",
              hasUnsavedChanges 
                ? "bg-[#1a3a5b] text-white hover:bg-[#1a3a5b]/90 shadow-[#1a3a5b]/20" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
            )}
          >
            <Save className="size-4" />
            Publicar Alterações
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-y-auto lg:overflow-hidden">
        {/* Left Panel: List */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 lg:overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Estrutura do Formulário</h3>
            <span className="text-[10px] font-bold text-slate-400">{perguntas.length} perguntas</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={perguntas.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {perguntas.map((pergunta) => (
                  <SortableQuestionItem 
                    key={pergunta.id} 
                    pergunta={pergunta} 
                    isSelected={selectedId === pergunta.id}
                    onSelect={() => setSelectedId(pergunta.id)}
                    onToggleActive={handleToggleActive}
                    onDelete={(id) => setShowDeleteDialog(id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <button 
            onClick={handleAddNew}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:border-[#1a3a5b] hover:text-[#1a3a5b] hover:bg-[#1a3a5b]/5 transition-all"
          >
            <Plus className="size-4" />
            Nova Pergunta
          </button>
        </div>

        {/* Right Panel: Editor */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {selectedPergunta ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <Settings2 className="size-5 text-[#1a3a5b]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Editando Pergunta</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {selectedPergunta.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedId(null)}
                  className="p-2 text-slate-400 hover:bg-white rounded-lg transition-all"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSaveEditor)} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Texto da Pergunta */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    Texto da Pergunta
                    <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    {...register("texto", { required: true, minLength: 5 })}
                    className={cn(
                      "w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-[#1a3a5b]/20 outline-none transition-all",
                      errors.texto ? "border-rose-300" : "border-slate-200"
                    )}
                    placeholder="Ex: Qual o maior problema do seu bairro hoje?"
                  />
                  {errors.texto && <p className="text-[10px] font-bold text-rose-500 uppercase">Mínimo 5 caracteres obrigatório</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  {/* Seção */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Seção</label>
                    <select 
                      {...register("secao")}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20"
                    >
                      <option value="morador">Dados do Morador</option>
                      <option value="bairro">Sobre o Bairro</option>
                      <option value="atendimento">Atendimento</option>
                    </select>
                  </div>

                  {/* Tipo */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Tipo de Resposta</label>
                    <select 
                      {...register("tipo")}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20"
                    >
                      <option value="texto_curto">Texto curto</option>
                      <option value="texto_longo">Texto longo</option>
                      <option value="radio">Seleção única (radio)</option>
                      <option value="checkbox">Múltipla escolha</option>
                      <option value="select">Select dropdown</option>
                      <option value="categoria">Categoria (lista fixa)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  {/* Obrigatória */}
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setValue("obrigatoria", !watch("obrigatoria"))}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        watch("obrigatoria") ? "bg-[#1a3a5b]" : "bg-slate-200"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        watch("obrigatoria") ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">Obrigatória</span>
                      <span className="text-[10px] text-slate-400">Impede o envio sem resposta</span>
                    </div>
                  </div>
                </div>

                {/* Opções (se aplicável) */}
                {["radio", "checkbox", "select"].includes(tipo) && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700">Opções de Resposta</label>
                      <button 
                        type="button"
                        onClick={appendOpcao}
                        className="text-[10px] font-black uppercase text-[#1a3a5b] hover:underline flex items-center gap-1"
                      >
                        <Plus className="size-3" />
                        Adicionar Opção
                      </button>
                    </div>

                    <div className="space-y-2">
                      {watchedOpcoes.map((opcao: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <GripVertical className="size-4 text-slate-300" />
                          <input 
                            value={opcao}
                            onChange={(e) => {
                              const current = [...(watch("opcoes") || [])];
                              current[index] = e.target.value;
                              setValue("opcoes", current, { shouldDirty: true });
                            }}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20"
                            placeholder={`Opção ${index + 1}`}
                          />
                          <button 
                            type="button"
                            onClick={() => removeOpcao(index)}
                            className="p-2 text-slate-400 hover:text-rose-600"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                      {watchedOpcoes.length < 2 && (
                        <p className="text-[10px] font-bold text-rose-500 uppercase">Mínimo 2 opções necessárias</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Outros campos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Placeholder</label>
                    <input 
                      {...register("placeholder")}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20"
                      placeholder="Texto de exemplo..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Texto de Ajuda</label>
                    <input 
                      {...register("ajuda")}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1a3a5b]/20"
                      placeholder="Dica para o servidor..."
                    />
                  </div>
                </div>

                {/* Footer do Editor */}
                <div className="pt-8 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => reset(selectedPergunta)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    <RotateCcw className="size-4" />
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 px-8 py-2.5 bg-[#1a3a5b] text-white rounded-xl font-bold text-sm hover:bg-[#1a3a5b]/90 transition-all shadow-lg shadow-[#1a3a5b]/20"
                  >
                    <CheckCircle2 className="size-4" />
                    Salvar Pergunta
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
              <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center">
                <Layout className="size-8 text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Selecione uma pergunta</h3>
                <p className="text-sm text-slate-500 max-w-xs">Escolha uma pergunta na lista ao lado para editar suas propriedades ou criar uma nova.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className={cn(
        "fixed bottom-0 left-0 md:left-64 right-0 h-12 flex items-center justify-center gap-3 px-8 text-xs font-bold uppercase tracking-widest transition-all z-30",
        hasUnsavedChanges ? "bg-amber-500 text-white" : "bg-slate-900 text-white/60"
      )}>
        {hasUnsavedChanges ? (
          <>
            <AlertCircle className="size-4" />
            Alterações não publicadas — clique em Publicar para aplicar
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4 text-emerald-400" />
            Todas as alterações publicadas
          </>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
            <div className="bg-amber-500 text-white px-8 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="size-5" />
                <span className="text-sm font-black uppercase tracking-widest">Modo Pré-visualização</span>
                <span className="text-xs font-medium opacity-80">Estas são as perguntas ainda não publicadas.</span>
              </div>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-all"
              >
                <X className="size-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12 max-w-4xl mx-auto w-full space-y-12 custom-scrollbar">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900">Nova Visita Domiciliar</h2>
                <p className="text-slate-500">Simulação do formulário com as alterações atuais.</p>
              </div>

              <div className="space-y-10">
                {perguntas.filter(p => p.ativo).map((p) => (
                  <div key={p.id} className="space-y-3">
                    <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                      {p.texto}
                      {p.obrigatoria && <span className="text-rose-500">*</span>}
                    </label>
                    {p.ajuda && <p className="text-xs text-slate-400">{p.ajuda}</p>}
                    
                    {p.tipo === 'texto_curto' && (
                      <input disabled placeholder={p.placeholder} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    )}
                    {p.tipo === 'texto_longo' && (
                      <textarea disabled placeholder={p.placeholder} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[100px]" />
                    )}
                    {p.tipo === 'radio' && (
                      <div className="space-y-2">
                        {p.opcoes?.map(opt => (
                          <div key={opt} className="flex items-center gap-3">
                            <div className="size-5 rounded-full border-2 border-slate-200" />
                            <span className="text-sm text-slate-600">{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.tipo === 'checkbox' && (
                      <div className="space-y-2">
                        {p.opcoes?.map(opt => (
                          <div key={opt} className="flex items-center gap-3">
                            <div className="size-5 rounded border-2 border-slate-200" />
                            <span className="text-sm text-slate-600">{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.tipo === 'select' && (
                      <select disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none">
                        <option>Selecione uma opção...</option>
                        {p.opcoes?.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    )}
                    {p.tipo === 'categoria' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {CATEGORIAS.map(cat => (
                          <div key={cat} className="p-3 border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-500">
                            {cat}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-12 border-t border-slate-100 flex justify-end">
                <button disabled className="px-8 py-4 bg-slate-200 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-sm cursor-not-allowed">
                  Simular Envio
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Exit Dialog */}
      <Dialog 
        isOpen={showConfirmExit}
        onClose={handleCancelExit}
        onConfirm={handleConfirmExit}
        title="Alterações não publicadas"
        description="Você tem alterações que ainda não foram publicadas. Se sair agora, elas serão perdidas na próxima vez que carregar a página."
        confirmText="Sair sem publicar"
        variant="danger"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog 
        isOpen={!!showDeleteDialog}
        onClose={() => setShowDeleteDialog(null)}
        onConfirm={confirmDelete}
        title="Excluir Pergunta?"
        description="Tem certeza que deseja excluir esta pergunta? Esta ação não pode ser desfeita na cópia de trabalho."
        confirmText="Sim, Excluir"
        variant="danger"
      />
    </div>
  );
}
