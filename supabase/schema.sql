-- ─── Habilitar extensão UUID ─────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── USUÁRIOS ────────────────────────────────────────────────
create table if not exists usuarios (
  id            text primary key,
  nome          text not null,
  cargo         text not null,
  email         text not null unique,
  senha         text not null,
  perfil        text not null check (perfil in ('admin','supervisor','servidor')),
  initials      text not null,
  ativo         boolean not null default true,
  supervisor_id text references usuarios(id) on delete set null,
  equipe        jsonb default '[]',
  regiao        text,
  meta_semanal  integer default 20,
  data_criacao  timestamptz not null default now()
);

-- ─── PESQUISAS ───────────────────────────────────────────────
create table if not exists pesquisas (
  id                text primary key,
  timestamp         timestamptz not null,
  servidor_id       text not null references usuarios(id) on delete cascade,
  servidor_nome     text not null,
  supervisor_id     text,
  morador_nome      text not null,
  morador_telefone  text not null,
  morador_email     text,
  morador_endereco  text not null,
  morador_regiao    text not null,
  respostas         jsonb not null default '{}',
  atendimento_data  date not null,
  atendimento_obs   text,
  status            text not null default 'synced'
                    check (status in ('pending_sync','synced','error')),
  criado_em         timestamptz not null default now()
);

create index if not exists idx_pesquisas_servidor_id on pesquisas(servidor_id);
create index if not exists idx_pesquisas_timestamp   on pesquisas(timestamp desc);
create index if not exists idx_pesquisas_regiao      on pesquisas(morador_regiao);
create index if not exists idx_pesquisas_status      on pesquisas(status);

-- ─── METAS ───────────────────────────────────────────────────
create table if not exists metas (
  servidor_id   text primary key references usuarios(id) on delete cascade,
  meta_semanal  integer not null default 20,
  atualizado_em timestamptz not null default now()
);

-- ─── PERGUNTAS DO FORMULÁRIO ─────────────────────────────────
create table if not exists perguntas (
  id          text primary key,
  ordem       integer not null,
  texto       text not null,
  tipo        text not null check (tipo in (
                'texto_curto','texto_longo','radio',
                'checkbox','select','categoria')),
  obrigatoria boolean not null default false,
  ativo       boolean not null default true,
  secao       text not null check (secao in ('morador','bairro','atendimento')),
  opcoes      jsonb,
  placeholder text,
  ajuda       text
);

-- ─── REGIÕES ─────────────────────────────────────────────────
create table if not exists regioes (
  nome       text primary key,
  criado_em  timestamptz not null default now()
);

-- ─── KANBAN ──────────────────────────────────────────────────
create table if not exists kanban_cards (
  id            text primary key,
  titulo        text not null,
  descricao     text not null,
  regiao        text not null,
  categoria     text not null,
  urgencia      text not null check (urgencia in ('Baixa','Média','Alta','Crítica')),
  fase          text not null check (fase in (
                  'identificado','analisando','em_andamento',
                  'aguardando','concluido','cancelado')),
  responsavel   text not null,
  prazo         date,
  pesquisas_ids jsonb not null default '[]',
  notas         text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_kanban_fase     on kanban_cards(fase);
create index if not exists idx_kanban_urgencia on kanban_cards(urgencia);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table usuarios     enable row level security;
alter table pesquisas    enable row level security;
alter table metas        enable row level security;
alter table perguntas    enable row level security;
alter table regioes      enable row level security;
alter table kanban_cards enable row level security;

-- Políticas abertas com anon key (autenticação gerenciada pelo app)
drop policy if exists "allow_all" on usuarios;
drop policy if exists "allow_all" on pesquisas;
drop policy if exists "allow_all" on metas;
drop policy if exists "allow_all" on perguntas;
drop policy if exists "allow_all" on regioes;
drop policy if exists "allow_all" on kanban_cards;

create policy "allow_all" on usuarios     for all using (true) with check (true);
create policy "allow_all" on pesquisas    for all using (true) with check (true);
create policy "allow_all" on metas        for all using (true) with check (true);
create policy "allow_all" on perguntas    for all using (true) with check (true);
create policy "allow_all" on regioes      for all using (true) with check (true);
create policy "allow_all" on kanban_cards for all using (true) with check (true);
