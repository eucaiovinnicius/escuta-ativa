import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Save, 
  Trash2, 
  ChevronUp, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  ClipboardList,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { useToast } from '../components/ui/Toast';
import { Dialog } from '../components/ui/Dialog';
import { getPerguntas, savePesquisa, getRegioes, CATEGORIAS } from '../services/storage';
import { pesquisaService } from '../services/pesquisaService';
import { uuid } from '../utils/calculos';
import { PerguntaFormulario, Pesquisa } from '../types';
import { cn } from '../lib/utils';

// --- MASK UTILS ---
const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

// --- COMPONENTS ---

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
  <div className="flex items-center gap-2 pb-4 mb-6 border-b border-gray-100">
    <div className="p-2 bg-[#1a3a5b]/5 rounded-lg">
      <Icon className="w-5 h-5 text-[#1a3a5b]" />
    </div>
    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
  </div>
);

export function NovaPesquisa() {
  const { user } = useAuth();
  const { atualizarCount, isOnline } = useSync();
  const { success, error: toastError } = useToast();
  const [perguntas, setPerguntas] = useState<PerguntaFormulario[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Load questions
  useEffect(() => {
    const all = getPerguntas();
    const active = all
      .filter(p => p.ativo)
      .sort((a, b) => a.ordem - b.ordem);
    setPerguntas(active);
  }, []);

  // Build Zod Schema dynamically
  const formSchema = useMemo(() => {
    const respostasSchema: Record<string, any> = {};
    perguntas.forEach(p => {
      if (p.obrigatoria) {
        if (p.tipo === 'checkbox') {
          respostasSchema[p.id] = z.array(z.string()).min(1, "Selecione pelo menos uma opção");
        } else {
          respostasSchema[p.id] = z.string().min(1, "Campo obrigatório");
        }
      } else {
        respostasSchema[p.id] = z.any().optional();
      }
    });

    return z.object({
      morador: z.object({
        nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
        telefone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Formato inválido: (00) 00000-0000"),
        email: z.string().email("E-mail inválido").optional().or(z.literal("")),
        endereco: z.string().min(1, "Endereço é obrigatório"),
        regiao: z.string().min(1, "Região é obrigatória"),
      }),
      respostas: z.object(respostasSchema),
      atendimento: z.object({
        data: z.string().refine(val => {
          const d = new Date(val);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return d <= today;
        }, "Data não pode ser futura"),
        observacoes: z.string().optional(),
      })
    });
  }, [perguntas]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      morador: { nome: '', telefone: '', email: '', endereco: '', regiao: '' },
      respostas: {},
      atendimento: { 
        data: new Date().toISOString().split('T')[0],
        observacoes: ''
      }
    }
  });

  // Progress calculation
  const formData = watch();
  const progress = useMemo(() => {
    const mandatoryFields: { path: string, value: any }[] = [
      { path: 'morador.nome', value: formData.morador?.nome },
      { path: 'morador.telefone', value: formData.morador?.telefone },
      { path: 'morador.endereco', value: formData.morador?.endereco },
      { path: 'morador.regiao', value: formData.morador?.regiao },
      { path: 'atendimento.data', value: formData.atendimento?.data },
    ];

    perguntas.forEach(p => {
      if (p.obrigatoria) {
        mandatoryFields.push({ 
          path: `respostas.${p.id}`, 
          value: formData.respostas?.[p.id] 
        });
      }
    });

    const filledCount = mandatoryFields.filter(f => {
      if (Array.isArray(f.value)) return f.value.length > 0;
      return !!f.value;
    }).length;

    return {
      percent: Math.round((filledCount / mandatoryFields.length) * 100),
      filled: filledCount,
      total: mandatoryFields.length
    };
  }, [formData, perguntas]);

  const onError = (errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const element = document.getElementsByName(firstError)[0];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const onSubmit = async (data: any) => {
    if (!user) return;
    setIsSubmitting(true);

    // Prepare answers (serialize checkboxes)
    const serializedRespostas: Record<string, string> = {};
    Object.entries(data.respostas).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        serializedRespostas[key] = value.join(', ');
      } else {
        serializedRespostas[key] = String(value || '');
      }
    });

    const novaPesquisa: Pesquisa = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      servidor_id: user.id,
      servidor_nome: user.nome,
      supervisor_id: user.supervisor_id || "",
      morador: data.morador,
      respostas: serializedRespostas,
      atendimento: {
        data: data.atendimento.data,
        observacoes: data.atendimento.observacoes
      },
      status: "pending_sync"
    };

    try {
      savePesquisa(novaPesquisa);
      await pesquisaService.submit(novaPesquisa);
      
      if (isOnline) {
        success("Pesquisa enviada com sucesso!");
      } else {
        success("Você está offline. Pesquisa salva localmente e será sincronizada automaticamente ao reconectar.");
      }
      
      atualizarCount();
      
      // Notifica outros componentes que há nova pesquisa
      window.dispatchEvent(new CustomEvent('pesquisa-salva'));
      
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toastError("Falha ao salvar pesquisa. Tente novamente.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    reset();
    setShowClearDialog(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
              <WifiOff className="size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Você está offline</p>
                <p className="opacity-90">As pesquisas serão salvas no seu dispositivo e enviadas automaticamente quando a conexão for restabelecida.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <div className="sticky top-0 z-20 bg-[#f6f7f8]/80 backdrop-blur-md pt-2 pb-4 mb-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-medium text-gray-600">Progresso da Pesquisa</span>
          <span className="text-sm font-bold text-[#1a3a5b]">
            {progress.filled} de {progress.total} campos obrigatórios
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-[#1a3a5b]"
            initial={{ width: 0 }}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8 pb-24">
        {/* SEÇÃO 1: DADOS DO MORADOR */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <SectionHeader icon={User} title="Dados do Morador" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('morador.nome')}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                    errors.morador?.nome ? "border-red-300 bg-red-50" : "border-gray-200"
                  )}
                  placeholder="Nome do morador"
                />
              </div>
              {errors.morador?.nome && (
                <p className="text-xs text-red-500 mt-1">{errors.morador.nome.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                Telefone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('morador.telefone')}
                  onChange={(e) => setValue('morador.telefone', formatPhone(e.target.value))}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                    errors.morador?.telefone ? "border-red-300 bg-red-50" : "border-gray-200"
                  )}
                  placeholder="(00) 00000-0000"
                />
              </div>
              {errors.morador?.telefone && (
                <p className="text-xs text-red-500 mt-1">{errors.morador.telefone.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">E-mail (opcional)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('morador.email')}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                    errors.morador?.email && "border-red-300 bg-red-50"
                  )}
                  placeholder="email@exemplo.com"
                />
              </div>
              {errors.morador?.email && (
                <p className="text-xs text-red-500 mt-1">{errors.morador.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                Região <span className="text-red-500">*</span>
              </label>
              <select
                {...register('morador.regiao')}
                className={cn(
                  "w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all appearance-none",
                  errors.morador?.regiao ? "border-red-300 bg-red-50" : "border-gray-200"
                )}
              >
                <option value="">Selecione uma região</option>
                {getRegioes().map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.morador?.regiao && (
                <p className="text-xs text-red-500 mt-1">{errors.morador.regiao.message}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                Endereço Completo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('morador.endereco')}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                    errors.morador?.endereco ? "border-red-300 bg-red-50" : "border-gray-200"
                  )}
                  placeholder="Rua, número, complemento..."
                />
              </div>
              {errors.morador?.endereco && (
                <p className="text-xs text-red-500 mt-1">{errors.morador.endereco.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* SEÇÃO 2: PERGUNTAS DINÂMICAS */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <SectionHeader icon={ClipboardList} title="Questionário" />
          
          <div className="space-y-8">
            {perguntas.map((p) => (
              <div key={p.id} className="space-y-3">
                <label className="text-base font-semibold text-gray-800 flex items-start gap-1">
                  {p.texto} {p.obrigatoria && <span className="text-red-500">*</span>}
                </label>
                
                {p.ajuda && <p className="text-sm text-gray-500 italic">{p.ajuda}</p>}

                {/* Render based on type */}
                {p.tipo === 'categoria' && (
                  <select
                    {...register(`respostas.${p.id}`)}
                    className={cn(
                      "w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                      errors.respostas?.[p.id] ? "border-red-300 bg-red-50" : "border-gray-200"
                    )}
                  >
                    <option value="">Selecione uma categoria</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}

                {p.tipo === 'texto_curto' && (
                  <input
                    {...register(`respostas.${p.id}`)}
                    placeholder={p.placeholder}
                    className={cn(
                      "w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                      errors.respostas?.[p.id] ? "border-red-300 bg-red-50" : "border-gray-200"
                    )}
                  />
                )}

                {p.tipo === 'texto_longo' && (
                  <div className="space-y-1">
                    <textarea
                      {...register(`respostas.${p.id}`)}
                      placeholder={p.placeholder}
                      rows={4}
                      className={cn(
                        "w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all resize-none",
                        errors.respostas?.[p.id] ? "border-red-300 bg-red-50" : "border-gray-200"
                      )}
                    />
                    <div className="flex justify-end">
                      <span className={cn(
                        "text-[10px] font-medium uppercase tracking-wider",
                        (formData.respostas?.[p.id]?.length || 0) < 10 && p.obrigatoria
                          ? "text-red-500"
                          : "text-gray-400"
                      )}>
                        {formData.respostas?.[p.id]?.length || 0} caracteres
                      </span>
                    </div>
                  </div>
                )}

                {p.tipo === 'radio' && (
                  <div className="grid grid-cols-1 gap-2">
                    {p.opcoes?.map(opcao => (
                      <button
                        key={opcao}
                        type="button"
                        onClick={() => setValue(`respostas.${p.id}`, opcao)}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group",
                          formData.respostas?.[p.id] === opcao
                            ? "bg-[#1a3a5b] border-[#1a3a5b] text-white shadow-md"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:border-[#1a3a5b]/30"
                        )}
                      >
                        <span className="font-medium">{opcao}</span>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                          formData.respostas?.[p.id] === opcao
                            ? "border-white bg-white/20"
                            : "border-gray-300 bg-white"
                        )}>
                          {formData.respostas?.[p.id] === opcao && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {p.tipo === 'checkbox' && (
                  <div className="grid grid-cols-1 gap-2">
                    {p.opcoes?.map(opcao => {
                      const currentValues = (formData.respostas?.[p.id] as string[]) || [];
                      const isSelected = currentValues.includes(opcao);
                      
                      return (
                        <button
                          key={opcao}
                          type="button"
                          onClick={() => {
                            const nextValues = isSelected
                              ? currentValues.filter(v => v !== opcao)
                              : [...currentValues, opcao];
                            setValue(`respostas.${p.id}`, nextValues);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between",
                            isSelected
                              ? "bg-[#1a3a5b]/5 border-[#1a3a5b] text-[#1a3a5b]"
                              : "bg-gray-50 border-gray-200 text-gray-700 hover:border-[#1a3a5b]/30"
                          )}
                        >
                          <span className="font-medium">{opcao}</span>
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                            isSelected
                              ? "border-[#1a3a5b] bg-[#1a3a5b]"
                              : "border-gray-300 bg-white"
                          )}>
                            {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {p.tipo === 'select' && (
                  <select
                    {...register(`respostas.${p.id}`)}
                    className={cn(
                      "w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                      errors.respostas?.[p.id] ? "border-red-300 bg-red-50" : "border-gray-200"
                    )}
                  >
                    <option value="">Selecione uma opção</option>
                    {p.opcoes?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}

                {errors.respostas?.[p.id] && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {(errors.respostas[p.id] as any).message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SEÇÃO 3: DADOS DO ATENDIMENTO */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <SectionHeader icon={Calendar} title="Dados do Atendimento" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Servidor Responsável</label>
              <input
                type="text"
                readOnly
                value={user?.nome || ''}
                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                Data do Atendimento <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  {...register('atendimento.data')}
                  max={new Date().toISOString().split('T')[0]}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all",
                    errors.atendimento?.data ? "border-red-300 bg-red-50" : "border-gray-200"
                  )}
                />
              </div>
              {errors.atendimento?.data && (
                <p className="text-xs text-red-500 mt-1">{errors.atendimento.data.message}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                Observações Internas <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  {...register('atendimento.observacoes')}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a3a5b] outline-none transition-all resize-none"
                  placeholder="Anotações relevantes sobre a visita..."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-[#1a3a5b] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#1a3a5b]/90 transition-all disabled:opacity-50 shadow-lg shadow-[#1a3a5b]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Finalizar Pesquisa
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => setShowClearDialog(true)}
            className="px-8 py-4 bg-white text-red-600 border border-red-100 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-5 h-5" />
            Limpar
          </button>
        </div>
      </form>

      {/* Clear Confirmation Dialog */}
      <Dialog 
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClear}
        title="Limpar Formulário?"
        description="Tem certeza? Todos os dados preenchidos serão perdidos permanentemente."
        confirmText="Sim, Limpar"
        variant="danger"
      />
    </div>
  );
}
