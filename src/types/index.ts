export interface Usuario {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  senha: string;
  perfil: "admin" | "supervisor" | "servidor";
  initials: string;
  ativo: boolean;
  supervisor_id?: string;
  equipe?: string[];           // apenas supervisores: lista de IDs de servidores
  regiao?: string;             // apenas servidores
  meta_semanal?: number;       // apenas servidores, padrão 20
  data_criacao: string;        // ISO 8601
}

export interface Pesquisa {
  id: string;
  timestamp: string;
  servidor_id: string;
  servidor_nome: string;
  supervisor_id: string;
  morador: {
    nome: string;
    telefone: string;
    email?: string;
    endereco: string;
    regiao: string;
  };
  respostas: Record<string, string>;  // chave = pergunta_id, valor = resposta
  atendimento: {
    data: string;
    observacoes?: string;
  };
  status: "pending_sync" | "synced" | "error";
}

export interface PerguntaFormulario {
  id: string;
  ordem: number;
  texto: string;
  tipo: "texto_curto" | "texto_longo" | "radio" | "checkbox" | "select" | "categoria";
  obrigatoria: boolean;
  ativo: boolean;
  secao: "morador" | "bairro" | "atendimento";
  opcoes?: string[];
  placeholder?: string;
  ajuda?: string;
}

export interface MetaServidor {
  servidor_id: string;
  meta_semanal: number;
}

export interface Exportacao {
  id: string;
  tipo: string;
  data: string;
  usuario_nome: string;
}

export interface RadarItem {
  regiao: string;
  categoria: string;
  count: number;
  urgencia: "Baixa" | "Média" | "Alta" | "Crítica";
  dor_recente: string;
  ultima_ocorrencia: string;
}

export type KanbanFase =
  | "identificado"
  | "analisando"
  | "em_andamento"
  | "aguardando"
  | "concluido"
  | "cancelado";

export interface KanbanCard {
  id: string;
  titulo: string;
  descricao: string;
  regiao: string;
  categoria: string;
  urgencia: "Baixa" | "Média" | "Alta" | "Crítica";
  fase: KanbanFase;
  responsavel: string;
  prazo?: string;
  pesquisas_ids: string[];
  criado_em: string;
  atualizado_em: string;
  notas?: string;
}
