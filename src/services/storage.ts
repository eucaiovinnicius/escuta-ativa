import { Usuario, Pesquisa, MetaServidor, PerguntaFormulario, Exportacao, KanbanCard, KanbanFase } from '../types';

const KEYS = {
  USUARIOS: "ea_usuarios",
  PESQUISAS: "ea_pesquisas",
  METAS: "ea_metas",
  PERGUNTAS: "ea_perguntas",
  EXPORTACOES: "ea_exportacoes",
  REGIOES: "ea_regioes",
  KANBAN: "ea_kanban",
};

export const CATEGORIAS = [
  "Infraestrutura", "Saúde", "Segurança", "Educação",
  "Saneamento", "Mobilidade", "Meio Ambiente", "Assistência Social", "Outro"
];

export const REGIOES_PADRAO = [
  "Centro", "Vila Nova", "Jardim América", "Parque Industrial", "Zona Sul", "Outro"
];

export const PERGUNTAS_PADRAO: PerguntaFormulario[] = [
  { id: "p1", ordem: 1, secao: "bairro", tipo: "categoria", obrigatoria: true, ativo: true,
    texto: "Qual o maior problema do seu bairro hoje?" },
  { id: "p2", ordem: 2, secao: "bairro", tipo: "texto_longo", obrigatoria: true, ativo: true,
    texto: "Descreva o problema em detalhes", placeholder: "Conte com mais detalhes..." },
  { id: "p3", ordem: 3, secao: "bairro", tipo: "radio", obrigatoria: true, ativo: true,
    texto: "Há quanto tempo esse problema existe?",
    opcoes: ["Menos de 6 meses", "6 meses a 1 ano", "1 a 3 anos", "Mais de 3 anos"] },
  { id: "p4", ordem: 4, secao: "bairro", tipo: "texto_longo", obrigatoria: false, ativo: true,
    texto: "Já tentou resolver ou denunciar? O que aconteceu?",
    placeholder: "Conte o que já foi feito..." },
  { id: "p5", ordem: 5, secao: "bairro", tipo: "texto_longo", obrigatoria: true, ativo: true,
    texto: "O que mais melhoraria sua qualidade de vida aqui?" },
  { id: "p6", ordem: 6, secao: "bairro", tipo: "radio", obrigatoria: true, ativo: true,
    texto: "Participaria de reuniões comunitárias?",
    opcoes: ["Sim, com certeza", "Talvez", "Não tenho disponibilidade"] },
  { id: "p7", ordem: 7, secao: "bairro", tipo: "texto_longo", obrigatoria: false, ativo: true,
    texto: "Mais algum problema a registrar?" }
];

// Helper to get from localStorage
const get = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

// Helper to set to localStorage
const set = (key: string, value: any): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// --- USUARIOS ---
export const getUsuarios = (): Usuario[] => get(KEYS.USUARIOS, []);

export const getUsuarioById = (id: string): Usuario | undefined => 
  getUsuarios().find(u => u.id === id);

export const saveUsuario = (u: Usuario): void => {
  const users = getUsuarios();
  const index = users.findIndex(user => user.id === u.id);
  if (index >= 0) {
    users[index] = u;
  } else {
    users.push(u);
  }
  set(KEYS.USUARIOS, users);
};

export const toggleStatusUsuario = (id: string): void => {
  const users = getUsuarios();
  const user = users.find(u => u.id === id);
  if (user) {
    user.ativo = !user.ativo;
    set(KEYS.USUARIOS, users);
  }
};

export const deleteUsuario = (id: string): void => {
  const users = getUsuarios().filter(u => u.id !== id);
  set(KEYS.USUARIOS, users);
};

export const initUsuarios = (): void => {
  const users = getUsuarios();
  const adminEmail = "caiovinnicius1210@gmail.com";
  const existingAdmin = users.find(u => u.email === adminEmail);

  if (!existingAdmin) {
    const admin: Usuario = {
      id: "1",
      nome: "Caio Vinnicius",
      cargo: "Administrador",
      email: adminEmail,
      senha: "admin",
      perfil: "admin",
      initials: "CV",
      ativo: true,
      data_criacao: new Date().toISOString()
    };
    saveUsuario(admin);
  } else if (existingAdmin.senha !== "admin" || existingAdmin.perfil !== "admin") {
    existingAdmin.senha = "admin";
    existingAdmin.perfil = "admin";
    saveUsuario(existingAdmin);
  }
};

// --- PESQUISAS ---
export const getPesquisas = (): Pesquisa[] => get(KEYS.PESQUISAS, []);

export const getPesquisasByServidor = (servidor_id: string): Pesquisa[] =>
  getPesquisas().filter(p => p.servidor_id === servidor_id);

export const getPesquisasBySupervisor = (supervisor_id: string): Pesquisa[] => {
  const supervisor = getUsuarioById(supervisor_id);
  if (!supervisor || !supervisor.equipe) return [];
  const equipeIds = [...supervisor.equipe, supervisor_id];
  return getPesquisas().filter(p => equipeIds.includes(p.servidor_id));
};

export const getPesquisasPendentes = (): Pesquisa[] =>
  getPesquisas().filter(p => p.status === "pending_sync");

export const savePesquisa = (p: Pesquisa): void => {
  const surveys = getPesquisas();
  const index = surveys.findIndex(s => s.id === p.id);
  if (index >= 0) {
    surveys[index] = p;
  } else {
    surveys.push(p);
  }
  set(KEYS.PESQUISAS, surveys);
};

export const deletePesquisa = (id: string): void => {
  const surveys = getPesquisas().filter(s => s.id !== id);
  set(KEYS.PESQUISAS, surveys);
};

export const markAsSynced = (id: string): void => {
  const surveys = getPesquisas();
  const survey = surveys.find(s => s.id === id);
  if (survey) {
    survey.status = "synced";
    set(KEYS.PESQUISAS, surveys);
  }
};

export const markAsError = (id: string): void => {
  const surveys = getPesquisas();
  const survey = surveys.find(s => s.id === id);
  if (survey) {
    survey.status = "error";
    set(KEYS.PESQUISAS, surveys);
  }
};

// --- METAS ---
export const getMetas = (): MetaServidor[] => get<MetaServidor[]>(KEYS.METAS, []);

export const getMeta = (servidor_id: string): number => {
  const metas = getMetas();
  const meta = metas.find(m => m.servidor_id === servidor_id);
  return meta ? meta.meta_semanal : 20;
};

export const saveMeta = (servidor_id: string, valor: number): void => {
  const metas = getMetas();
  const index = metas.findIndex(m => m.servidor_id === servidor_id);
  if (index >= 0) {
    metas[index].meta_semanal = valor;
  } else {
    metas.push({ servidor_id, meta_semanal: valor });
  }
  set(KEYS.METAS, metas);
};

// --- PERGUNTAS ---
export const getPerguntas = (): PerguntaFormulario[] => {
  const perguntas = get<PerguntaFormulario[]>(KEYS.PERGUNTAS, []);
  return perguntas.length > 0 ? perguntas : PERGUNTAS_PADRAO;
};

export const savePerguntas = (perguntas: PerguntaFormulario[]): void => {
  set(KEYS.PERGUNTAS, perguntas);
};

// --- REGIOES ---
export const getRegioes = (): string[] => {
  const data = localStorage.getItem(KEYS.REGIOES);
  if (!data) return REGIOES_PADRAO;
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : REGIOES_PADRAO;
  } catch (e) {
    return REGIOES_PADRAO;
  }
};

export const saveRegioes = (regioes: string[]): void => {
  set(KEYS.REGIOES, regioes);
};

// --- EXPORTACOES ---
export const getExportacoes = (): Exportacao[] => get(KEYS.EXPORTACOES, []);

export const saveExportacao = (exp: Exportacao): void => {
  const exps = getExportacoes();
  exps.unshift(exp); // Newest first
  if (exps.length > 20) exps.pop(); // Keep last 20
  set(KEYS.EXPORTACOES, exps);
};

// --- KANBAN ---
export const getKanbanCards = (): KanbanCard[] => {
  const data = localStorage.getItem("ea_kanban");
  return data ? JSON.parse(data) : [];
};

export const saveKanbanCard = (card: KanbanCard): void => {
  const cards = getKanbanCards();
  const index = cards.findIndex(c => c.id === card.id);
  if (index >= 0) {
    cards[index] = card;
  } else {
    cards.push(card);
  }
  localStorage.setItem("ea_kanban", JSON.stringify(cards));
};

export const deleteKanbanCard = (id: string): void => {
  const cards = getKanbanCards().filter(c => c.id !== id);
  localStorage.setItem("ea_kanban", JSON.stringify(cards));
};

export const moveKanbanCard = (id: string, novaFase: KanbanFase): void => {
  const cards = getKanbanCards();
  const card = cards.find(c => c.id === id);
  if (card) {
    card.fase = novaFase;
    card.atualizado_em = new Date().toISOString();
    localStorage.setItem("ea_kanban", JSON.stringify(cards));
  }
};

// --- BACKUP ---
export const getBackupData = () => ({
  usuarios: getUsuarios(),
  pesquisas: getPesquisas(),
  metas: getMetas(),
  perguntas: getPerguntas(),
  exportacoes: getExportacoes(),
});
