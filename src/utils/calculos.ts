import { Pesquisa, RadarItem } from '../types';
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays, 
  isWithinInterval,
  parseISO,
  isSameDay,
  format
} from 'date-fns';
import { getPerguntas } from '../services/storage';

export const uuid = (): string => 
  Date.now().toString(36) + Math.random().toString(36).substring(2);

export const calcularUrgencia = (count: number): "Baixa" | "Média" | "Alta" | "Crítica" => {
  if (count >= 10) return "Crítica";
  if (count >= 6) return "Alta";
  if (count >= 3) return "Média";
  return "Baixa";
};

export const filtrarPorPeriodo = (
  pesquisas: Pesquisa[], 
  periodo: "hoje" | "semana" | "mes" | "trimestre" | "tudo"
): Pesquisa[] => {
  const now = new Date();
  
  switch (periodo) {
    case "hoje":
      return pesquisas.filter(p => isSameDay(parseISO(p.timestamp), now));
    case "semana":
      return pesquisas.filter(p => isWithinInterval(parseISO(p.timestamp), {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      }));
    case "mes":
      return pesquisas.filter(p => isWithinInterval(parseISO(p.timestamp), {
        start: startOfMonth(now),
        end: endOfMonth(now)
      }));
    case "trimestre":
      return pesquisas.filter(p => isWithinInterval(parseISO(p.timestamp), {
        start: subDays(now, 90),
        end: now
      }));
    case "tudo":
    default:
      return pesquisas;
  }
};

export const calcularPesquisasHoje = (pesquisas: Pesquisa[], servidor_id: string): number => {
  const hoje = startOfDay(new Date());
  return pesquisas.filter(p => 
    p.servidor_id === servidor_id && 
    isSameDay(parseISO(p.timestamp), hoje)
  ).length;
};

export const calcularPesquisasSemana = (pesquisas: Pesquisa[], servidor_id: string): number => {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return pesquisas.filter(p => 
    p.servidor_id === servidor_id && 
    isWithinInterval(parseISO(p.timestamp), { start, end })
  ).length;
};

export const calcularPesquisasPeriodoAnterior = (
  pesquisas: Pesquisa[], 
  periodo: "hoje" | "semana" | "mes" | "trimestre"
): number => {
  const now = new Date();
  let start: Date, end: Date;

  switch (periodo) {
    case "hoje":
      start = startOfDay(subDays(now, 1));
      end = endOfDay(subDays(now, 1));
      break;
    case "semana":
      start = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      end = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      break;
    case "mes":
      start = startOfMonth(subDays(now, 30));
      end = endOfMonth(subDays(now, 30));
      break;
    case "trimestre":
      start = subDays(now, 180);
      end = subDays(now, 90);
      break;
  }

  return pesquisas.filter(p => isWithinInterval(parseISO(p.timestamp), { start, end })).length;
};

export const calcularVariacao = (atual: number, anterior: number): { percentual: number, direcao: "up" | "down" | "stable" } => {
  if (anterior === 0) return { percentual: atual > 0 ? 100 : 0, direcao: atual > 0 ? "up" : "stable" };
  const percentual = Math.round(((atual - anterior) / anterior) * 100);
  let direcao: "up" | "down" | "stable" = "stable";
  if (percentual > 0) direcao = "up";
  if (percentual < 0) direcao = "down";
  return { percentual: Math.abs(percentual), direcao };
};

export const gerarRadarUrgencias = (pesquisas: Pesquisa[]): RadarItem[] => {
  const grupos: Record<string, Pesquisa[]> = {};

  pesquisas.forEach(p => {
    const categoria = p.respostas['categoria_principal'] || 'Outro';
    const chave = `${p.morador.regiao}|${categoria}`;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(p);
  });

  const radar: RadarItem[] = Object.entries(grupos).map(([chave, items]) => {
    const [regiao, categoria] = chave.split('|');
    const sortedItems = [...items].sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    const dor_recente = sortedItems[0].respostas['descricao_problema'] || '';
    const ultima_ocorrencia = sortedItems[0].timestamp;
    const count = items.length;

    return {
      regiao,
      categoria,
      count,
      urgencia: calcularUrgencia(count),
      dor_recente,
      ultima_ocorrencia
    };
  });

  const ordemUrgencia = { "Crítica": 0, "Alta": 1, "Média": 2, "Baixa": 3 };
  return radar.sort((a, b) => ordemUrgencia[a.urgencia] - ordemUrgencia[b.urgencia]);
};

export const calcularTopCategorias = (pesquisas: Pesquisa[]): { categoria: string, count: number }[] => {
  const counts: Record<string, number> = {};
  pesquisas.forEach(p => {
    const cat = p.respostas['categoria_principal'] || 'Outro';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([categoria, count]) => ({ categoria, count }))
    .sort((a, b) => b.count - a.count);
};

export const gerarCSV = (dados: any[], nomeArquivo?: string): void => {
  if (dados.length === 0) return;

  const isPesquisa = dados[0]?.morador !== undefined;
  let headers: string[];
  let rows: string[][];

  if (isPesquisa) {
    const perguntas = getPerguntas();
    const getTextoPergunta = (key: string) => {
      // Se for id p1, p2... mapeia, se não usa a própria chave (caso venha do Supabase já mapeada)
      const p = perguntas.find(p => p.id === key);
      return p ? p.texto : key;
    };

    // Coletar todas as chaves de respostas existentes nos dados e ignora pular "categoria_principal" se quiser, ou formata
    const todasChavesRespostas = new Set<string>();
    dados.forEach(p => Object.keys(p.respostas || {}).forEach(k => todasChavesRespostas.add(k)));
    const chavesRespostas = Array.from(todasChavesRespostas).sort();

    headers = [
      'ID', 'Data Registro', 'Servidor', 'Supervisor',
      'Região', 'Morador', 'Telefone', 'Email', 'Endereço',
      'Data Atendimento', 'Observações',
      ...chavesRespostas.map(k => getTextoPergunta(k)),
      'Status'
    ];

    rows = dados.map(p => [
      p.id,
      format(parseISO(p.timestamp), 'dd/MM/yyyy HH:mm'),
      p.servidor_nome,
      p.supervisor_id || '',
      p.morador?.regiao || '',
      p.morador?.nome || '',
      p.morador?.telefone || '',
      p.morador?.email || '',
      p.morador?.endereco || '',
      p.atendimento?.data || '',
      (p.atendimento?.observacoes || '').replace(/\n/g, ' '),
      ...chavesRespostas.map(k => String(p.respostas?.[k] || '').replace(/\n/g, ' ')),
      p.status,
    ]);
  } else {
    headers = Object.keys(dados[0]);
    rows = dados.map(d => Object.values(d).map(v => String(v ?? '')));
  }

  const escape = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(','))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo || `export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
