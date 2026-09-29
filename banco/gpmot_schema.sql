-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — Gestão de Portfólio
--  Esquema do banco de dados (PostgreSQL / Supabase) — versão 1.3
--  29/09/2026 — v1.3: Direção permanente (lucas.scherer@ufsm.br sempre Direção e ativo)
--  29/09/2026 — v1.2: permissões explícitas (regra da Supabase para projetos
--               criados desde 30/05/2026), datas no fuso de Brasília,
--               atualização em tempo real (Realtime)
--  24/09/2026 — Gerências, Infraestrutura, tipos de projeto, orçamento por rubricas,
--               dados do contrato, aditivos, entregas e cronograma físico
--
--  Como usar: no painel do Supabase, abra "SQL Editor", cole este
--  arquivo inteiro e execute. Depois siga o passo final (no fim do
--  arquivo) para liberar o primeiro usuário da Direção.
--
--  Estrutura de acesso (as funções se somam — a mesma pessoa pode ser
--  Direção, gerente de uma ou mais áreas e coordenadora de projetos)
--
--    Papel base do login (tabela perfis)
--      direcao   vê e edita tudo
--      membro    edita as próprias tarefas e o próprio cadastro
--      leitura   só consulta
--
--    Gerências (tabelas gerencias + gerencia_membros)
--      Áreas de gestão do laboratório, cadastráveis pela Direção.
--      Cada gerência tem uma lista de PERMISSÕES que valem para
--      TODOS os projetos, e tem demandas próprias (tarefas da área).
--
--    Coordenação (alocacoes.coordena)
--      Vale só para o projeto em que a pessoa é coordenadora:
--      edita o projeto e vê/edita bolsas e orçamento dele.
--
--  Valores de bolsa e orçamento: visíveis só para Direção,
--  coordenadores do projeto e gerências com permissão financeira.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists btree_gist;   -- impede reservas sobrepostas

-- ────────────────────────────────────────────────────────────────────
-- 1. Funções utilitárias
-- ────────────────────────────────────────────────────────────────────

-- Data de hoje no fuso de Brasília (o servidor da Supabase trabalha em UTC:
-- sem isto, depois das 21h o banco já estaria no dia seguinte)
create or replace function public.hoje()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Atualiza atualizado_em / atualizado_por em todo UPDATE
create or replace function public.tg_carimbo()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. Pessoas (equipe + bolsistas IC + externos, num só cadastro)
-- ────────────────────────────────────────────────────────────────────
create table public.pessoas (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null check (length(trim(nome)) > 0),
  email                  text unique,
  tipo                   text not null default 'outro' check (tipo in
                           ('docente','pesquisador','pos_doc','doutorando','mestrando',
                            'tecnico','ic','externo','outro')),
  funcao                 text,                      -- ex.: COG, COA, Controller
  curso                  text,                      -- para IC
  semestre               smallint check (semestre between 1 and 20),
  foco                   text,                      -- Experimental / Numérico / Gestão
  formacao               text,                      -- Graduado(a), Mestre(a), Doutor(a)…
  lattes                 text,                      -- link do currículo Lattes
  ingresso               date,                      -- ingresso no laboratório
  saida                  date,                      -- desligamento previsto/efetivo (abre o checklist de saída)
  habilidades            text[] not null default '{}',
  resumo                 text,                      -- "o que vai fazer"
  disponibilidade_pct    smallint not null default 100 check (disponibilidade_pct between 0 and 100),
  perfil_disponibilidade text not null default 'interno' check (perfil_disponibilidade in
                           ('interno','parcial','externo','formal','consultivo','bloqueado')),
  obs_disponibilidade    text,
  risco_sobrecarga       boolean not null default false,
  ordem                  integer not null default 0,
  ativo                  boolean not null default true,  -- desligado = sai das listas, mantém histórico
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  atualizado_por         uuid
);
create trigger carimbo before update on public.pessoas
  for each row execute function public.tg_carimbo();

-- ────────────────────────────────────────────────────────────────────
-- 3. Perfis de acesso (usuário de login ↔ pessoa ↔ papel)
-- ────────────────────────────────────────────────────────────────────
create table public.perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  pessoa_id      uuid unique references public.pessoas(id) on delete set null,
  papel          text not null default 'leitura'
                   check (papel in ('direcao','membro','leitura')),
  ativo          boolean not null default false,   -- Direção aprova cada novo usuário
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid
);
create trigger carimbo before update on public.perfis
  for each row execute function public.tg_carimbo();

-- Novo login → cria perfil inativo e liga à pessoa de mesmo e-mail
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email, pessoa_id)
  values (new.id, lower(new.email),
          (select p.id from public.pessoas p where lower(p.email) = lower(new.email) limit 1))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- Direção permanente: estes logins são sempre Direção e ativos. Garante que o
-- sistema nunca fique sem ninguém capaz de administrar os acessos.
-- Para alterar a lista, edite o e-mail abaixo e execute este bloco no SQL Editor.
create or replace function public.emails_direcao_fixa()
returns text[] language sql immutable set search_path = '' as $$
  select array['lucas.scherer@ufsm.br']::text[]
$$;

create or replace function public.tg_perfil_direcao_fixa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- bloqueia a exclusão pela tela; se o próprio login for apagado no painel da Supabase, o perfil sai junto
    if lower(old.email) = any(public.emails_direcao_fixa()) and exists (select 1 from auth.users u where u.id = old.id) then
      raise exception 'O acesso de % é da Direção permanente e não pode ser removido.', old.email;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then new.email := old.email; end if;   -- o e-mail vem do login, não se edita aqui
  if lower(new.email) = any(public.emails_direcao_fixa()) then
    new.papel := 'direcao';
    new.ativo := true;
  end if;
  return new;
end $$;
create trigger direcao_fixa before insert or update on public.perfis
  for each row execute function public.tg_perfil_direcao_fixa();
create trigger direcao_fixa_excluir before delete on public.perfis
  for each row execute function public.tg_perfil_direcao_fixa();

-- ────────────────────────────────────────────────────────────────────
-- 4. Projetos
-- ────────────────────────────────────────────────────────────────────
create table public.projetos (
  id               uuid primary key default gen_random_uuid(),
  sigla            text not null check (length(trim(sigla)) > 0),
  nome             text,
  financiador      text,
  fundacao_apoio   text,                                     -- fundação gestora da parte UFSM
  tipo             text not null default 'edital'
                     check (tipo in ('edital','servico')),   -- projeto de edital ou prestação de serviço
  programa         text,                                     -- ex.: Mover
  chamada          text,                                     -- ex.: Nucleação
  linha_tematica   text,                                     -- linha / área temática
  numero_contrato  text,                                     -- nº do convênio / contrato / termo
  data_assinatura  date,
  resumo           text,
  valor_total      numeric(14,2) not null default 0 check (valor_total >= 0),   -- aporte (parte UFSM)
  contrapartida    numeric(14,2) not null default 0 check (contrapartida >= 0), -- contrapartidas (parte UFSM)
  inicio           date not null,
  fim              date not null,
  status           text not null default 'pendente'
                     check (status in ('em_dia','atencao','critico','pendente')),
  fase             text,
  notas            text,
  placeholder      boolean not null default false,   -- dados ainda incompletos
  situacao         text not null default 'vigente'
                     check (situacao in ('vigente','encerrado','cancelado')),
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid,
  constraint periodo_valido check (fim >= inicio)
);
create trigger carimbo before update on public.projetos
  for each row execute function public.tg_carimbo();

-- ────────────────────────────────────────────────────────────────────
-- 5. Alocações (pessoa × projeto) — substitui nível, carga, notas e
--    alocações de IC que hoje ficam em estruturas separadas
-- ────────────────────────────────────────────────────────────────────
create table public.alocacoes (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references public.pessoas(id) on delete cascade,
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  nivel          smallint not null default 1 check (nivel between 0 and 3), -- 0 — ·1 Apoio ·2 Colab. ·3 Principal
  carga_pct      numeric(5,1) not null default 25 check (carga_pct between 0 and 200),
  coordena       boolean not null default false,  -- dá permissão de coordenador NESTE projeto
  papel          text,                            -- ex.: COG, CFD, Sup. Fab.
  atribuicao     text,                            -- descrição da atribuição real
  desde          date,
  status         text not null default 'ativo' check (status in ('ativo','pausado','concluido')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  unique (pessoa_id, projeto_id)
);
create index on public.alocacoes (projeto_id);
create trigger carimbo before update on public.alocacoes
  for each row execute function public.tg_carimbo();

-- ────────────────────────────────────────────────────────────────────
-- 5c. Aditivos contratuais (prorrogação de prazo, alteração de valor…)
--     Ao registrar um aditivo, o projeto recebe o novo término e/ou o
--     novo valor; os valores anteriores ficam guardados no aditivo.
-- ────────────────────────────────────────────────────────────────────
create table public.aditivos (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references public.projetos(id) on delete cascade,
  numero           text,                              -- ex.: 1º Termo Aditivo
  tipo             text not null default 'prazo'
                     check (tipo in ('prazo','valor','prazo_valor','escopo','outro')),
  data_assinatura  date,
  fim_anterior     date,
  novo_fim         date,
  valor_anterior   numeric(14,2),
  novo_valor       numeric(14,2) check (novo_valor >= 0),
  justificativa    text,
  documento        text,                              -- nº do processo / link do documento
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid,
  constraint aditivo_com_efeito check (tipo in ('escopo','outro') or novo_fim is not null or novo_valor is not null)
);
create index on public.aditivos (projeto_id);
create trigger carimbo before update on public.aditivos
  for each row execute function public.tg_carimbo();

create or replace function public.tg_aditivo_antes()
returns trigger language plpgsql as $$
declare p public.projetos;
begin
  select * into p from public.projetos where id = new.projeto_id;
  new.fim_anterior := coalesce(new.fim_anterior, p.fim);
  new.valor_anterior := coalesce(new.valor_anterior, p.valor_total);
  if new.novo_fim is not null and new.novo_fim < p.inicio then
    raise exception 'O novo término não pode ser anterior ao início do projeto';
  end if;
  return new;
end $$;
create trigger aditivo_antes before insert on public.aditivos
  for each row execute function public.tg_aditivo_antes();

create or replace function public.tg_aditivo_aplica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.projetos set
      fim = coalesce(new.novo_fim, fim),
      valor_total = coalesce(new.novo_valor, valor_total)
     where id = new.projeto_id;
    return new;
  end if;
  -- exclusão: desfaz o efeito se o projeto ainda estiver com os valores deste aditivo
  update public.projetos set
    fim = case when old.novo_fim is not null and fim = old.novo_fim then old.fim_anterior else fim end,
    valor_total = case when old.novo_valor is not null and valor_total = old.novo_valor then old.valor_anterior else valor_total end
   where id = old.projeto_id;
  return old;
end $$;
create trigger aditivo_aplica after insert or delete on public.aditivos
  for each row execute function public.tg_aditivo_aplica();

-- ────────────────────────────────────────────────────────────────────
-- 5d. Entregas e prazos (relatórios, prestações de contas, marcos)
-- ────────────────────────────────────────────────────────────────────
create table public.entregas (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references public.projetos(id) on delete cascade,
  tipo             text not null default 'relatorio_parcial' check (tipo in
                     ('relatorio_parcial','relatorio_final','prestacao_parcial','prestacao_final',
                      'marco','reuniao','outro')),
  titulo           text not null,
  prazo            date not null,
  responsavel_id   uuid references public.pessoas(id) on delete set null,
  status           text not null default 'pendente'
                     check (status in ('pendente','em_elaboracao','entregue','aprovado','dispensado')),
  data_entrega     date,
  documento        text,                              -- protocolo / link
  obs              text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid
);
create index on public.entregas (projeto_id, prazo);
create trigger carimbo before update on public.entregas
  for each row execute function public.tg_carimbo();

create or replace function public.tg_entrega_data()
returns trigger language plpgsql as $$
begin
  if new.status in ('entregue','aprovado') and new.data_entrega is null then new.data_entrega := public.hoje(); end if;
  return new;
end $$;
create trigger entrega_data before insert or update on public.entregas
  for each row execute function public.tg_entrega_data();

-- O responsável (sem gestão do projeto) só atualiza o andamento da entrega
create or replace function public.tg_protege_entrega()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.gere_projeto(old.projeto_id) then return new; end if;
  if new.titulo is distinct from old.titulo or new.tipo is distinct from old.tipo or new.prazo is distinct from old.prazo
     or new.responsavel_id is distinct from old.responsavel_id or new.projeto_id is distinct from old.projeto_id then
    raise exception 'O responsável pela entrega só atualiza situação, data de entrega, documento e observações';
  end if;
  return new;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 5d2. Documentos do projeto (links: Drive, SharePoint, SEI…) e pendências
-- ────────────────────────────────────────────────────────────────────
create table public.documentos (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  tipo            text not null default 'outro' check (tipo in
                    ('contrato','plano_trabalho','termo_aditivo','relatorio','prestacao_contas',
                     'oficio','ata','proposta','nota_fiscal','outro')),
  titulo          text not null,
  url             text,                               -- link para o arquivo
  numero          text,                               -- nº SEI / processo / protocolo
  data            date,
  versao          text,
  restrito        boolean not null default false,     -- só Direção, coordenação e financeiro veem
  aditivo_id      uuid references public.aditivos(id) on delete set null,
  entrega_id      uuid references public.entregas(id) on delete set null,
  obs             text,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid,
  constraint documento_tem_referencia check (url is not null or numero is not null)
);
create index on public.documentos (projeto_id);
create trigger carimbo before update on public.documentos
  for each row execute function public.tg_carimbo();

create table public.pendencias (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  titulo          text not null,
  descricao       text,
  categoria       text not null default 'administrativa' check (categoria in
                    ('administrativa','financeira','tecnica','documental','prestacao_contas','outra')),
  origem          text,                               -- ex.: exigência FAURGS, ofício 12/2026
  responsavel_id  uuid references public.pessoas(id) on delete set null,
  prazo           date,
  prioridade      text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  status          text not null default 'aberta' check (status in
                    ('aberta','em_andamento','aguardando','resolvida','cancelada')),
  resolucao       text,
  resolvida_em    date,
  documento_id    uuid references public.documentos(id) on delete set null,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid
);
create index on public.pendencias (projeto_id);
create index on public.pendencias (responsavel_id) where status in ('aberta','em_andamento','aguardando');
create trigger carimbo before update on public.pendencias
  for each row execute function public.tg_carimbo();
create or replace function public.tg_pendencia()
returns trigger language plpgsql as $$
begin
  if new.status = 'resolvida' and new.resolvida_em is null then new.resolvida_em := public.hoje(); end if;
  if new.status <> 'resolvida' then new.resolvida_em := null; end if;
  -- o responsável (sem ser gestor do projeto) só atualiza situação, resolução e documento
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.gere_projeto(old.projeto_id) then
    if new.titulo is distinct from old.titulo or new.prazo is distinct from old.prazo or new.responsavel_id is distinct from old.responsavel_id
       or new.projeto_id is distinct from old.projeto_id or new.prioridade is distinct from old.prioridade or new.categoria is distinct from old.categoria then
      raise exception 'O responsável pela pendência só atualiza situação, resolução e documento. Prazo e responsável são definidos pela coordenação';
    end if;
  end if;
  return new;
end $$;
create trigger pendencia before insert or update on public.pendencias
  for each row execute function public.tg_pendencia();

-- ────────────────────────────────────────────────────────────────────
-- 5e. Cronograma físico (metas / etapas / atividades)
--     Código hierárquico (1 · 1.1 · 1.1.1). Meses contados a partir do
--     início do projeto (mês 1 = mês de início), como nos editais; as
--     datas são calculadas a partir da data de início do projeto.
-- ────────────────────────────────────────────────────────────────────
create table public.cronograma (
  id                 uuid primary key default gen_random_uuid(),
  projeto_id         uuid not null references public.projetos(id) on delete cascade,
  codigo             text not null check (codigo ~ '^[0-9]+(\.[0-9]+)*$'),
  titulo             text not null,
  descricao          text,
  entrega            text,                            -- entrega prevista / resultado
  validador          text,                            -- validadores da entrega
  mes_inicio         smallint check (mes_inicio >= 1),
  mes_fim            smallint,
  responsavel_texto  text,                            -- como consta no plano (ex.: Mario/Baêta)
  responsavel_id     uuid references public.pessoas(id) on delete set null,
  percentual         smallint not null default 0 check (percentual between 0 and 100),
  status             text not null default 'planejada'
                       check (status in ('planejada','em_andamento','concluida','cancelada')),
  data_conclusao     date,
  evidencia          text,                            -- documento / link que comprova
  obs                text,
  ordem              integer not null default 0,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid,
  unique (projeto_id, codigo),
  constraint meses_validos check (mes_fim is null or mes_inicio is null or mes_fim >= mes_inicio)
);
create index on public.cronograma (projeto_id);
create trigger carimbo before update on public.cronograma
  for each row execute function public.tg_carimbo();

create or replace function public.tg_cronograma_conclusao()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida' then new.percentual := 100; end if;
  if new.percentual = 100 and new.status in ('planejada','em_andamento') then new.status := 'concluida'; end if;
  if new.percentual between 1 and 99 and new.status = 'planejada' then new.status := 'em_andamento'; end if;
  if new.status = 'concluida' and new.data_conclusao is null then new.data_conclusao := public.hoje(); end if;
  if new.status <> 'concluida' then new.data_conclusao := null; end if;
  return new;
end $$;
create trigger cronograma_conclusao before insert or update on public.cronograma
  for each row execute function public.tg_cronograma_conclusao();

create or replace function public.tg_protege_cronograma()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.gere_projeto(old.projeto_id) then return new; end if;
  if new.codigo is distinct from old.codigo or new.titulo is distinct from old.titulo
     or new.mes_inicio is distinct from old.mes_inicio or new.mes_fim is distinct from old.mes_fim
     or new.responsavel_id is distinct from old.responsavel_id or new.projeto_id is distinct from old.projeto_id
     or new.entrega is distinct from old.entrega or new.descricao is distinct from old.descricao then
    raise exception 'O responsável pela atividade só atualiza andamento, conclusão, evidência e observações';
  end if;
  return new;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 5f. Equipe do plano de trabalho (formato do edital) — posições e vagas
--     Cada linha é uma posição prevista no plano (ex.: "Bolsista de
--     Mestrado 2 (UFSM)"). Pode estar ocupada por uma pessoa ou vaga.
--     Valores de bolsa ficam em equipe_plano_bolsas (acesso financeiro).
-- ────────────────────────────────────────────────────────────────────
create table public.equipe_plano (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  ordem          int  not null default 0,
  nome_plano     text not null,                   -- como consta no plano ("Bolsista de Mestrado 1 (UFSM)")
  funcao         text,                            -- função no edital ("Bolsista - Mestrando", "Pesquisador")
  categoria      text not null default 'outro'
                   check (categoria in ('docente','pesquisador','tecnico','pos_doc','doutorando','mestrando','ic','outro')),
  formacao       text,                            -- formação exigida/declarada
  etapas         text[] not null default '{}',    -- códigos do cronograma vinculados (2.5, 2.5.1…)
  horas_semanais numeric(5,1) check (horas_semanais is null or horas_semanais between 0 and 60),
  pessoa_id      uuid references public.pessoas(id) on delete set null,
  status         text not null default 'vaga'
                   check (status in ('vaga','selecao','ocupada','encerrada','cancelada')),
  desde          date,                            -- ocupante atual desde
  requisitos     text,                            -- perfil desejado para a vaga
  selecao_prazo  date,                            -- prazo do processo seletivo
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  constraint ocupada_tem_pessoa check (status <> 'ocupada' or pessoa_id is not null),
  constraint vaga_sem_pessoa    check (status not in ('vaga','selecao') or pessoa_id is null)
);
create index on public.equipe_plano (projeto_id);
create unique index equipe_plano_pessoa_unica on public.equipe_plano (projeto_id, pessoa_id) where status = 'ocupada';
create trigger carimbo before update on public.equipe_plano
  for each row execute function public.tg_carimbo();

-- Candidatos às vagas do plano (dados pessoais: só gestores do projeto / da equipe veem)
create table public.candidatos (
  id             uuid primary key default gen_random_uuid(),
  vaga_id        uuid not null references public.equipe_plano(id) on delete cascade,
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  nome           text not null,
  email          text,
  curso          text,                            -- curso / formação
  lattes         text,
  origem         text,                            -- edital interno, indicação, PPG…
  status         text not null default 'inscrito'
                   check (status in ('inscrito','entrevista','aprovado','reprovado','desistiu','contratado')),
  nota           numeric(4,1) check (nota is null or nota between 0 and 10),
  pessoa_id      uuid references public.pessoas(id) on delete set null,   -- quando contratado
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid
);
create index on public.candidatos (vaga_id);
create trigger carimbo before update on public.candidatos
  for each row execute function public.tg_carimbo();
create or replace function public.tg_candidato_projeto()
returns trigger language plpgsql as $$
begin
  select projeto_id into new.projeto_id from public.equipe_plano where id = new.vaga_id;
  return new;
end $$;
create trigger candidato_projeto before insert or update on public.candidatos
  for each row execute function public.tg_candidato_projeto();

-- Entrada e saída de pessoas: modelo de checklist (configurável) e situação por pessoa
create table public.checklist_itens (
  id          uuid primary key default gen_random_uuid(),
  fase        text not null check (fase in ('entrada','saida')),
  nome        text not null,
  descricao   text,
  tipos       text[] not null default '{}',     -- tipos de pessoa a que se aplica (vazio = todos)
  obrigatorio boolean not null default true,
  ordem       int not null default 0,
  ativo       boolean not null default true
);
insert into public.checklist_itens (fase, nome, tipos, ordem) values
  ('entrada','Termo de compromisso / plano de atividades assinado','{ic,mestrando,doutorando,pos_doc,tecnico}',1),
  ('entrada','Cadastro na fundação de apoio para pagamento (dados enviados à fundação)','{ic,mestrando,doutorando,pos_doc,tecnico}',2),
  ('entrada','Currículo Lattes atualizado','{}',3),
  ('entrada','Acesso ao laboratório (chave / cartão / biometria)','{}',4),
  ('entrada','Treinamento de segurança do laboratório (EPI, normas, emergência)','{}',5),
  ('entrada','E-mail, grupos e pastas compartilhadas do Lab','{}',6),
  ('entrada','Apresentação às normas e rotinas do Lab','{}',7),
  ('saida','Relatório final de atividades entregue','{ic,mestrando,doutorando,pos_doc,tecnico}',1),
  ('saida','Bolsa encerrada na fundação','{ic,mestrando,doutorando,pos_doc,tecnico}',2),
  ('saida','Dados, códigos e arquivos do projeto transferidos para a pasta do Lab','{}',3),
  ('saida','Chaves, cartões e equipamentos devolvidos','{}',4),
  ('saida','Acessos removidos (pastas, e-mail, sistemas)','{}',5),
  ('saida','Declaração de participação emitida','{}',6);

create table public.pessoa_checklist (
  pessoa_id   uuid not null references public.pessoas(id) on delete cascade,
  item_id     uuid not null references public.checklist_itens(id) on delete cascade,
  feito       boolean not null default true,
  data        date not null default public.hoje(),
  obs         text,
  atualizado_por uuid,
  primary key (pessoa_id, item_id)
);

-- ────────────────────────────────────────────────────────────────────
-- 5b. Gerências (áreas de gestão do laboratório)
-- ────────────────────────────────────────────────────────────────────
-- Catálogo de permissões que uma gerência pode receber:
--   projetos_criar        cadastrar novos projetos
--   projetos_editar       editar dados e cronograma de QUALQUER projeto
--   alocacoes_gerir       alocar pessoas e ajustar carga em qualquer projeto
--   tarefas_gerir         criar/editar tarefas em qualquer projeto
--   pessoas_gerir         cadastrar/editar pessoas, bolsistas IC, disponibilidade
--   financeiro_ver        ver bolsas e orçamento de todos os projetos
--   financeiro_editar     lançar/editar bolsas e orçamento de todos os projetos
--   prospeccao_gerir      registrar e avaliar prospecções
--   historico_ver         consultar o histórico de alterações
--   infraestrutura_gerir  (reservado para o futuro módulo de infraestrutura)
create table public.gerencias (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  descricao      text,                   -- atribuições da área
  permissoes     text[] not null default '{}',
  ativa          boolean not null default true,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  constraint permissoes_validas check (permissoes <@ array[
    'projetos_criar','projetos_editar','alocacoes_gerir','tarefas_gerir','pessoas_gerir',
    'financeiro_ver','financeiro_editar','prospeccao_gerir','historico_ver',
    'infraestrutura_gerir']::text[])
);
create trigger carimbo before update on public.gerencias
  for each row execute function public.tg_carimbo();

insert into public.gerencias (nome, descricao, permissoes, ordem) values
  ('Gerência de Projetos',
   'Acompanha cronogramas, status e entregas de todo o portfólio; organiza alocações; conduz a prospecção de novos projetos.',
   array['projetos_criar','projetos_editar','alocacoes_gerir','tarefas_gerir','prospeccao_gerir'], 1),
  ('Gerência Técnica',
   'Distribui e acompanha o trabalho técnico da equipe e dos bolsistas; mantém cadastro de pessoas, habilidades e disponibilidade.',
   array['alocacoes_gerir','tarefas_gerir','pessoas_gerir'], 2),
  ('Gerência de Infraestrutura',
   'Cuida de bancos de ensaio, células de teste, instrumentação, manutenção, segurança (PPCI) e compras de infraestrutura.',
   array['infraestrutura_gerir'], 3),
  ('Gerência Financeira',
   'Controla orçamento aprovado, execução e saldo por rubrica; bolsas e pagamentos; prestação de contas com as fundações.',
   array['financeiro_ver','financeiro_editar','historico_ver'], 4);

-- Quem ocupa cada gerência (uma pessoa pode estar em várias)
create table public.gerencia_membros (
  id             uuid primary key default gen_random_uuid(),
  gerencia_id    uuid not null references public.gerencias(id) on delete cascade,
  pessoa_id      uuid not null references public.pessoas(id) on delete cascade,
  funcao         text not null default 'titular' check (funcao in ('titular','adjunto')),
  desde          date not null default public.hoje(),
  ate            date,                   -- preenchido quando deixa a função
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  constraint periodo_valido check (ate is null or ate >= desde)
);
create index on public.gerencia_membros (pessoa_id);
create trigger carimbo before update on public.gerencia_membros
  for each row execute function public.tg_carimbo();

-- ────────────────────────────────────────────────────────────────────
-- 6. Tarefas e demandas
--    Tarefa de projeto (projeto_id), demanda de gerência (gerencia_id),
--    ou ambos (ex.: prestação de contas do Petrobras pela Gerência
--    Financeira). Uma tarefa pode ter vários responsáveis.
-- ────────────────────────────────────────────────────────────────────
create table public.tarefas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid references public.projetos(id) on delete cascade,
  gerencia_id    uuid references public.gerencias(id) on delete cascade,
  atividade_id   uuid references public.cronograma(id) on delete set null,  -- atividade do cronograma físico
  prioridade     text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  titulo         text not null default '',
  descricao      text,
  inicio         date,
  prazo          date,
  concluida      boolean not null default false,
  concluida_em   timestamptz,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  constraint prazo_valido check (prazo is null or inicio is null or prazo >= inicio),
  constraint tem_destino check (projeto_id is not null or gerencia_id is not null)
);
create index on public.tarefas (projeto_id);
create index on public.tarefas (gerencia_id);
create trigger carimbo before update on public.tarefas
  for each row execute function public.tg_carimbo();

create or replace function public.tg_tarefa_concluida()
returns trigger language plpgsql as $$
begin
  if new.concluida and (tg_op = 'INSERT' or not old.concluida) then new.concluida_em := now();
  elsif not new.concluida then new.concluida_em := null;
  end if;
  return new;
end $$;
create trigger marca_conclusao before insert or update of concluida on public.tarefas
  for each row execute function public.tg_tarefa_concluida();

create table public.tarefa_responsaveis (
  tarefa_id  uuid not null references public.tarefas(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  primary key (tarefa_id, pessoa_id)
);
create index on public.tarefa_responsaveis (pessoa_id);

-- ────────────────────────────────────────────────────────────────────
-- 7. Financeiro
--    Plano de rubricas hierárquico (modelo dos projetos de edital):
--      1 Custeio  › 1.1 Pessoal (1.1.1 Bolsas · 1.1.2 CLT)
--                 › 1.2 Viagens (1.2.1 Passagens · 1.2.2 Diárias)
--                 › 1.3 Material de consumo · 1.4 Serviços de Terceiros
--                 › 1.5 Custos Administrativos
--      2 Capital  › 2.1 Material permanente · 2.2 Obras
--    Valores são lançados só nas rubricas-folha; grupos somam.
--    Por projeto e rubrica: Aprovado e Previsto (orcamento_rubricas);
--    Executado = soma das despesas lançadas; Saldo = Aprovado − Executado.
-- ────────────────────────────────────────────────────────────────────
create table public.rubricas (
  codigo  text primary key,                       -- ex.: 1.1.1
  nome    text not null,
  pai     text references public.rubricas(codigo),
  ordem   integer not null default 0,
  planos  text[] not null default '{edital,servico}'  -- tipos de projeto que usam a rubrica
);
insert into public.rubricas (codigo, nome, pai, ordem) values
  ('1',     'Custeio',                 null,  1),
  ('1.1',   'Pessoal',                 '1',   2),
  ('1.1.1', 'Bolsas',                  '1.1', 3),
  ('1.1.2', 'CLT',                     '1.1', 4),
  ('1.2',   'Viagens',                 '1',   5),
  ('1.2.1', 'Passagens',               '1.2', 6),
  ('1.2.2', 'Diárias',                 '1.2', 7),
  ('1.3',   'Material de consumo',     '1',   8),
  ('1.4',   'Serviços de Terceiros',   '1',   9),
  ('1.5',   'Custos Administrativos',  '1',  10),
  ('2',     'Capital',                 null, 11),
  ('2.1',   'Material permanente',     '2',  12),
  ('2.2',   'Obras',                   '2',  13);

-- Só rubricas-folha (sem sub-rubricas) recebem valores
create or replace function public.e_rubrica_folha(p text)
returns boolean language sql stable as $$
  select exists (select 1 from public.rubricas where codigo = p)
     and not exists (select 1 from public.rubricas where pai = p)
$$;
create or replace function public.tg_confere_rubrica()
returns trigger language plpgsql as $$
begin
  if new.rubrica is not null and not public.e_rubrica_folha(new.rubrica) then
    raise exception 'Use uma rubrica final (ex.: 1.1.1 Bolsas), não um grupo';
  end if;
  return new;
end $$;

-- Bolsas e pagamentos a pessoas (equipe ou IC)
create table public.vinculos_financeiros (
  id                uuid primary key default gen_random_uuid(),
  pessoa_id         uuid not null references public.pessoas(id) on delete restrict,
  projeto_id        uuid not null references public.projetos(id) on delete cascade,
  tipo              text not null default 'bolsa'
                      check (tipo in ('bolsa','tecnico','servico','externo','outro')),
  modalidade        text,                           -- ex.: PIBIC/CNPq, Doutor II
  rubrica           text not null default '1.1.1' references public.rubricas(codigo),
  valor_mensal      numeric(12,2) not null default 0 check (valor_mensal >= 0),
  inicio            date not null,
  fim               date not null,
  status            text not null default 'previsto'
                      check (status in ('previsto','ativo','suspenso','encerrado')),
  vaga_id           uuid references public.equipe_plano(id) on delete set null,  -- posição do plano que esta bolsa cobre
  obs               text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid,
  constraint periodo_valido check (fim >= inicio)
);
create index on public.vinculos_financeiros (projeto_id);
create index on public.vinculos_financeiros (vaga_id);
create index on public.vinculos_financeiros (pessoa_id);
create trigger carimbo before update on public.vinculos_financeiros
  for each row execute function public.tg_carimbo();
create trigger confere_rubrica before insert or update on public.vinculos_financeiros
  for each row execute function public.tg_confere_rubrica();

-- Bolsa prevista para cada posição do plano (visível só a quem vê o financeiro)
create table public.equipe_plano_bolsas (
  id             uuid primary key default gen_random_uuid(),
  vaga_id        uuid not null unique references public.equipe_plano(id) on delete cascade,
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  modalidade     text,                              -- "Mestrado (BM)", "Coord. geral (COG)"…
  rubrica        text not null default '1.1.1' references public.rubricas(codigo),
  valor_mensal   numeric(12,2) not null default 0 check (valor_mensal >= 0),
  meses          int not null default 1 check (meses between 1 and 120),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid
);
create index on public.equipe_plano_bolsas (projeto_id);
create trigger carimbo before update on public.equipe_plano_bolsas
  for each row execute function public.tg_carimbo();
create trigger confere_rubrica before insert or update on public.equipe_plano_bolsas
  for each row execute function public.tg_confere_rubrica();
create or replace function public.tg_bolsa_plano_projeto()
returns trigger language plpgsql as $$
begin
  select projeto_id into new.projeto_id from public.equipe_plano where id = new.vaga_id;  -- sempre o projeto da posição
  return new;
end $$;
create trigger bolsa_plano_projeto before insert or update on public.equipe_plano_bolsas
  for each row execute function public.tg_bolsa_plano_projeto();

-- Orçamento do projeto por rubrica: valor aprovado e valor previsto para gastos
create table public.orcamento_rubricas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  rubrica        text not null references public.rubricas(codigo),
  aprovado       numeric(14,2) not null default 0 check (aprovado >= 0),
  previsto       numeric(14,2) not null default 0 check (previsto >= 0),
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  unique (projeto_id, rubrica)
);
create trigger carimbo before update on public.orcamento_rubricas
  for each row execute function public.tg_carimbo();
create trigger confere_rubrica before insert or update on public.orcamento_rubricas
  for each row execute function public.tg_confere_rubrica();

-- Despesas (gastos executados) — somam no "Executado" da rubrica
-- Plano de aplicação: itens previstos em cada rubrica (passagens, diárias,
-- consumo, serviços, permanente, obras). Despesas podem apontar para o item.
create table public.plano_itens (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  rubrica         text not null references public.rubricas(codigo),
  numero          int  not null default 0,               -- nº do item no plano
  descricao       text not null,
  justificativa   text,
  origem          text not null default 'nacional' check (origem in ('nacional','importado')),
  quantidade      numeric(12,2) check (quantidade is null or quantidade > 0),
  valor_unitario  numeric(14,2) check (valor_unitario is null or valor_unitario >= 0),
  moeda           text not null default 'BRL',            -- BRL, USD, EUR…
  cambio          numeric(10,4) check (cambio is null or cambio > 0),
  detalhe         text,                                   -- ex.: "7 dias · 32 pessoas"
  valor_previsto  numeric(14,2) not null default 0 check (valor_previsto >= 0),  -- em R$
  status          text not null default 'previsto'
                    check (status in ('previsto','em_aquisicao','adquirido','cancelado')),
  infra_item_id   uuid,                                   -- bem cadastrado na infraestrutura (FK abaixo)
  obs             text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid
);
create index on public.plano_itens (projeto_id, rubrica);
create trigger carimbo before update on public.plano_itens
  for each row execute function public.tg_carimbo();
create trigger confere_rubrica before insert or update on public.plano_itens
  for each row execute function public.tg_confere_rubrica();

-- Desembolso: parcelas repassadas pelo financiador/fundação ao projeto
create table public.desembolsos (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  numero          int  not null check (numero > 0),
  descricao       text,                                    -- "Parcela 01"
  fundacao        text,                                    -- quem repassa (FAURGS, FATEC…)
  data_prevista   date,
  valor_previsto  numeric(14,2) not null default 0 check (valor_previsto >= 0),
  status          text not null default 'prevista' check (status in ('prevista','recebida','cancelada')),
  data_recebida   date,
  valor_recebido  numeric(14,2) check (valor_recebido is null or valor_recebido >= 0),
  documento       text,                                    -- ofício, comprovante, extrato
  obs             text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid,
  unique (projeto_id, numero),
  constraint recebida_completa check (status <> 'recebida' or (data_recebida is not null and valor_recebido > 0))
);
create trigger carimbo before update on public.desembolsos
  for each row execute function public.tg_carimbo();

-- quanto de cada rubrica vem em cada parcela (opcional; sem isso, reparte pelo aprovado)
create table public.desembolso_rubricas (
  desembolso_id   uuid not null references public.desembolsos(id) on delete cascade,
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  rubrica         text not null references public.rubricas(codigo),
  valor           numeric(14,2) not null default 0 check (valor >= 0),
  primary key (desembolso_id, rubrica)
);
create trigger confere_rubrica before insert or update on public.desembolso_rubricas
  for each row execute function public.tg_confere_rubrica();
create or replace function public.tg_desembolso_rub_projeto()
returns trigger language plpgsql as $$
begin
  select projeto_id into new.projeto_id from public.desembolsos where id = new.desembolso_id;
  return new;
end $$;
create trigger desembolso_rub_projeto before insert or update on public.desembolso_rubricas
  for each row execute function public.tg_desembolso_rub_projeto();

create table public.despesas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  rubrica        text not null references public.rubricas(codigo),
  data           date not null,                   -- data do pagamento / da despesa
  competencia    date,                            -- mês de referência (bolsas, folha)
  descricao      text not null,
  favorecido     text,                            -- fornecedor, bolsista, empresa
  documento      text,                            -- NF, recibo, empenho, OB
  valor          numeric(14,2) not null check (valor > 0),
  pessoa_id      uuid references public.pessoas(id) on delete set null,
  vinculo_id     uuid references public.vinculos_financeiros(id) on delete set null,
  item_id        uuid references public.plano_itens(id) on delete set null,   -- item do plano de aplicação
  obs            text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid
);
create index on public.despesas (projeto_id, rubrica);
create index on public.despesas (item_id);
create unique index despesa_parcela_unica on public.despesas (vinculo_id, competencia) where vinculo_id is not null;
create trigger carimbo before update on public.despesas
  for each row execute function public.tg_carimbo();
create trigger confere_rubrica before insert or update on public.despesas
  for each row execute function public.tg_confere_rubrica();
-- despesa ligada a um item do plano: mesmo projeto e a rubrica do item
create or replace function public.tg_despesa_item()
returns trigger language plpgsql as $$
declare it record;
begin
  if new.item_id is not null then
    select projeto_id, rubrica into it from public.plano_itens where id = new.item_id;
    if it.projeto_id is distinct from new.projeto_id then
      raise exception 'O item do plano de aplicação é de outro projeto';
    end if;
    new.rubrica := it.rubrica;
  end if;
  return new;
end $$;
create trigger aa_despesa_item before insert or update on public.despesas
  for each row execute function public.tg_despesa_item();
-- mudar a rubrica do item leva junto as despesas ligadas a ele
create or replace function public.tg_item_rubrica()
returns trigger language plpgsql as $$
begin
  if new.rubrica is distinct from old.rubrica then
    update public.despesas set rubrica = new.rubrica where item_id = new.id;
  end if;
  return new;
end $$;
create trigger item_rubrica after update on public.plano_itens
  for each row execute function public.tg_item_rubrica();

-- ────────────────────────────────────────────────────────────────────
-- 8. Prospecção
-- ────────────────────────────────────────────────────────────────────
create table public.prospeccoes (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  financiador      text,
  edital           text,
  valor_estimado   numeric(14,2) check (valor_estimado >= 0),
  prazo_submissao  date,
  inicio_previsto  date,
  fim_previsto     date,
  responsavel_id   uuid references public.pessoas(id) on delete set null,
  objetivo         text,
  observacoes      text,
  texto_origem     text,          -- texto colado do edital
  arquivo_origem   text,          -- nome do arquivo de origem
  situacao         text not null default 'avaliacao'
                     check (situacao in ('avaliacao','aprovada','renegociar','recusada','promovida')),
  projeto_id       uuid references public.projetos(id) on delete set null,  -- se promovida
  criado_em        timestamptz not null default now(),
  criado_por       uuid default auth.uid(),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid
);
create trigger carimbo before update on public.prospeccoes
  for each row execute function public.tg_carimbo();

-- Cada avaliação na matriz fica guardada (reavaliar não apaga a anterior)
create table public.avaliacoes (
  id              uuid primary key default gen_random_uuid(),
  prospeccao_id   uuid not null references public.prospeccoes(id) on delete cascade,
  avaliado_em     timestamptz not null default now(),
  avaliado_por    uuid default auth.uid(),
  filtros         jsonb not null default '{}',  -- {"f_align":"pass", ...}
  notas           jsonb not null default '{}',  -- {"c_lin":5, ...}
  esforcos        jsonb not null default '{}',  -- {"e_coord":3, ...}
  ia              numeric(5,1) not null check (ia between 0 and 100),
  ie              numeric(3,1) not null check (ie between 1 and 5),
  ip              numeric(6,2) not null,
  bloqueada       boolean not null default false,
  quadrante       text check (quadrante in ('max','strat','easy','no')),
  parecer         text
);
create index on public.avaliacoes (prospeccao_id, avaliado_em desc);

-- ────────────────────────────────────────────────────────────────────
-- 8b. Infraestrutura (base de trabalho da Gerência de Infraestrutura)
--     Itens (salas, células, bancos, equipamentos, instrumentos...),
--     agenda de uso por projeto, manutenções/calibrações e habilitação
--     de operadores.
-- ────────────────────────────────────────────────────────────────────
create table public.infra_itens (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null,                 -- ex.: Célula de testes 3
  codigo               text unique,                   -- código interno, ex.: CT-03
  categoria            text not null default 'equipamento' check (categoria in
                         ('laboratorio','celula_teste','banco_ensaio','bancada','equipamento',
                          'instrumento','software','veiculo','outro')),
  pai_id               uuid references public.infra_itens(id) on delete set null, -- ex.: dinamômetro dentro da célula 3
  localizacao          text,
  fabricante           text,
  modelo               text,
  numero_serie         text,
  patrimonio           text,                          -- nº de patrimônio UFSM
  projeto_aquisicao_id uuid references public.projetos(id) on delete set null,
  responsavel_id       uuid references public.pessoas(id) on delete set null,
  status               text not null default 'operacional' check (status in
                         ('operacional','restrito','em_manutencao','inoperante','desativado')),
  reservavel           boolean not null default true,  -- entra na agenda de uso
  requer_habilitacao   boolean not null default false, -- só operador habilitado pode ser responsável pelo uso
  especificacoes       jsonb not null default '{}',    -- ex.: {"potencia_max_kW": 400}
  obs                  text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       uuid,
  constraint nao_e_pai_de_si check (pai_id is null or pai_id <> id)
);
create trigger carimbo before update on public.infra_itens
  for each row execute function public.tg_carimbo();
alter table public.plano_itens add constraint plano_itens_infra_fk
  foreign key (infra_item_id) references public.infra_itens(id) on delete set null;

-- Quem está habilitado a operar cada item
create table public.infra_habilitacoes (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.infra_itens(id) on delete cascade,
  pessoa_id      uuid not null references public.pessoas(id) on delete cascade,
  nivel          text not null default 'operador' check (nivel in ('operador','supervisor','instrutor')),
  desde          date not null default public.hoje(),
  validade       date,                              -- vazio = sem vencimento
  obs            text,                              -- treinamento, certificado
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  unique (item_id, pessoa_id)
);
create trigger carimbo before update on public.infra_habilitacoes
  for each row execute function public.tg_carimbo();

-- Agenda de uso (reservas por projeto)
create table public.infra_reservas (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.infra_itens(id) on delete cascade,
  projeto_id      uuid references public.projetos(id) on delete set null,
  solicitante_id  uuid references public.pessoas(id) on delete set null,
  responsavel_id  uuid references public.pessoas(id) on delete set null, -- quem opera
  inicio          timestamptz not null,
  fim             timestamptz not null,
  finalidade      text,
  status          text not null default 'solicitada'
                    check (status in ('solicitada','confirmada','cancelada','realizada')),
  horas_uso       numeric(7,1) check (horas_uso >= 0),  -- preenchido ao marcar como realizada
  obs             text,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid,
  constraint periodo_valido check (fim > inicio),
  -- duas reservas CONFIRMADAS não podem ocupar o mesmo item no mesmo horário
  constraint sem_conflito exclude using gist
    (item_id with =, tstzrange(inicio, fim) with &&) where (status in ('confirmada','realizada'))
);
create index on public.infra_reservas (item_id, inicio);
create index on public.infra_reservas (projeto_id);
create trigger carimbo before update on public.infra_reservas
  for each row execute function public.tg_carimbo();

-- Manutenções, calibrações, inspeções
create table public.infra_manutencoes (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.infra_itens(id) on delete cascade,
  tipo            text not null check (tipo in ('preventiva','corretiva','calibracao','inspecao','seguranca')),
  titulo          text not null,
  descricao       text,
  status          text not null default 'planejada'
                    check (status in ('planejada','em_andamento','concluida','cancelada')),
  data_prevista   date,
  data_inicio     date,
  data_conclusao  date,
  proxima_em      date,                          -- próxima preventiva / validade da calibração
  executor        text,                          -- empresa ou pessoa externa
  responsavel_id  uuid references public.pessoas(id) on delete set null,
  custo           numeric(12,2) check (custo >= 0),
  projeto_id      uuid references public.projetos(id) on delete set null,  -- projeto que pagou
  documento       text,                          -- certificado, NF, OS
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid
);
create index on public.infra_manutencoes (item_id);
create trigger carimbo before update on public.infra_manutencoes
  for each row execute function public.tg_carimbo();

-- Manutenção em andamento põe o item "em manutenção"; ao concluir, volta a operacional
create or replace function public.tg_manutencao_status_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'em_andamento' and new.tipo in ('corretiva','preventiva','calibracao') then
    update public.infra_itens set status = 'em_manutencao'
     where id = new.item_id and status in ('operacional','restrito');
    if new.data_inicio is null then
      update public.infra_manutencoes set data_inicio = public.hoje() where id = new.id;
    end if;
  elsif new.status in ('concluida','cancelada') and not exists (
          select 1 from public.infra_manutencoes m
           where m.item_id = new.item_id and m.status = 'em_andamento' and m.id <> new.id) then
    update public.infra_itens set status = 'operacional'
     where id = new.item_id and status = 'em_manutencao';
    if new.status = 'concluida' and new.data_conclusao is null then
      update public.infra_manutencoes set data_conclusao = public.hoje() where id = new.id;
    end if;
  end if;
  return null;
end $$;
create trigger manutencao_status_item after insert or update of status on public.infra_manutencoes
  for each row execute function public.tg_manutencao_status_item();

-- ────────────────────────────────────────────────────────────────────
-- 9. Histórico automático de alterações
-- ────────────────────────────────────────────────────────────────────
create table public.historico (
  id           bigserial primary key,
  tabela       text not null,
  registro_id  uuid,
  operacao     text not null,           -- INSERT / UPDATE / DELETE
  usuario      uuid,
  em           timestamptz not null default now(),
  alteracoes   jsonb                    -- UPDATE: {campo: [antes, depois]}; INSERT/DELETE: registro
);
create index on public.historico (tabela, registro_id, em desc);

create or replace function public.tg_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  diff jsonb := '{}';
  k text;
  o jsonb; n jsonb;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old); n := to_jsonb(new);
    for k in select jsonb_object_keys(n) loop
      if k not in ('atualizado_em','atualizado_por') and (o->k) is distinct from (n->k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(o->k, n->k));
      end if;
    end loop;
    if diff = '{}' then return new; end if;
    insert into public.historico(tabela, registro_id, operacao, usuario, alteracoes)
      values (tg_table_name, (n->>'id')::uuid, tg_op, auth.uid(), diff);
    return new;
  elsif tg_op = 'INSERT' then
    n := to_jsonb(new);
    insert into public.historico(tabela, registro_id, operacao, usuario, alteracoes)
      values (tg_table_name, (n->>'id')::uuid, tg_op, auth.uid(), n);
    return new;
  else
    o := to_jsonb(old);
    insert into public.historico(tabela, registro_id, operacao, usuario, alteracoes)
      values (tg_table_name, (o->>'id')::uuid, tg_op, auth.uid(), o);
    return old;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['pessoas','projetos','alocacoes','tarefas',
                           'vinculos_financeiros','orcamento_rubricas','despesas','prospeccoes','perfis',
                           'gerencias','gerencia_membros','aditivos','entregas','cronograma','equipe_plano','equipe_plano_bolsas','plano_itens','desembolsos','documentos','pendencias','candidatos','pessoa_checklist','infra_itens','infra_habilitacoes',
                           'infra_reservas','infra_manutencoes']
  loop
    execute format('create trigger historico after insert or update or delete on public.%I
                    for each row execute function public.tg_historico()', t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 10. Funções de permissão (usadas pelas regras de acesso)
-- ────────────────────────────────────────────────────────────────────
create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid() and ativo
$$;

create or replace function public.minha_pessoa()
returns uuid language sql stable security definer set search_path = public as $$
  select pessoa_id from public.perfis where id = auth.uid() and ativo
$$;

create or replace function public.tem_acesso()
returns boolean language sql stable as $$
  select public.meu_papel() is not null
$$;

create or replace function public.e_direcao()
returns boolean language sql stable as $$
  select coalesce(public.meu_papel() = 'direcao', false)
$$;

create or replace function public.pode_editar()
returns boolean language sql stable as $$
  select coalesce(public.meu_papel() in ('direcao','membro'), false)
$$;

-- Permissões que o usuário tem pelas gerências que ocupa hoje
create or replace function public.minhas_permissoes()
returns text[] language sql stable security definer set search_path = public as $$
  select case when public.e_direcao() then array[
      'projetos_criar','projetos_editar','alocacoes_gerir','tarefas_gerir','pessoas_gerir',
      'financeiro_ver','financeiro_editar','prospeccao_gerir','historico_ver','infraestrutura_gerir']::text[]
    when not public.pode_editar() then '{}'::text[]
    else coalesce((
      select array_agg(distinct perm)
        from public.gerencia_membros gm
        join public.gerencias g on g.id = gm.gerencia_id and g.ativa
        cross join lateral unnest(g.permissoes) perm
       where gm.pessoa_id = public.minha_pessoa()
         and gm.desde <= public.hoje()
         and (gm.ate is null or gm.ate >= public.hoje())), '{}'::text[])
  end
$$;

create or replace function public.tem_permissao(p text)
returns boolean language sql stable as $$
  select p = any(public.minhas_permissoes())
$$;

-- É gerente (titular ou adjunto, em exercício) desta gerência?
create or replace function public.gerencia(p_gerencia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_direcao() or (public.pode_editar() and exists (
    select 1 from public.gerencia_membros gm
     where gm.gerencia_id = p_gerencia
       and gm.pessoa_id = public.minha_pessoa()
       and gm.desde <= public.hoje()
       and (gm.ate is null or gm.ate >= public.hoje())))
$$;

-- Coordena este projeto?
create or replace function public.coordena(p_projeto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() and exists (
    select 1 from public.alocacoes a
     where a.projeto_id = p_projeto
       and a.pessoa_id  = public.minha_pessoa()
       and a.coordena)
$$;

-- Está alocado (ativo) no projeto?
create or replace function public.alocado(p_projeto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.alocacoes a where a.projeto_id = p_projeto and a.pessoa_id = public.minha_pessoa() and a.status = 'ativo')
$$;

-- Gere esta pessoa? (Direção, Gerência com pessoas_gerir, ou coordena um projeto em que ela está)
create or replace function public.gere_pessoa(p_pessoa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_direcao() or public.tem_permissao('pessoas_gerir') or exists (
    select 1 from public.alocacoes a where a.pessoa_id = p_pessoa and public.coordena(a.projeto_id))
$$;

-- Coordena algum projeto?
create or replace function public.coordena_algum()
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() and exists (
    select 1 from public.alocacoes a
     where a.pessoa_id = public.minha_pessoa() and a.coordena)
$$;

-- Pode editar dados do projeto: Direção, coordenador dele ou gerência com projetos_editar
create or replace function public.gere_projeto(p_projeto uuid)
returns boolean language sql stable as $$
  select public.e_direcao() or public.coordena(p_projeto) or public.tem_permissao('projetos_editar')
$$;

create or replace function public.ve_financeiro(p_projeto uuid)
returns boolean language sql stable as $$
  select public.e_direcao() or public.coordena(p_projeto) or public.tem_permissao('financeiro_ver')
$$;

create or replace function public.edita_financeiro(p_projeto uuid)
returns boolean language sql stable as $$
  select public.e_direcao() or public.coordena(p_projeto) or public.tem_permissao('financeiro_editar')
$$;

-- Pode gerir tarefas de um projeto
create or replace function public.gere_tarefas(p_projeto uuid)
returns boolean language sql stable as $$
  select p_projeto is not null and (public.gere_projeto(p_projeto) or public.tem_permissao('tarefas_gerir'))
$$;

create trigger protege_cronograma before update on public.cronograma
  for each row execute function public.tg_protege_cronograma();
create trigger protege_entrega before update on public.entregas
  for each row execute function public.tg_protege_entrega();

-- Só a Direção define coordenadores de projeto
create or replace function public.tg_protege_coordena()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.e_direcao() then return new; end if;
  if (tg_op = 'INSERT' and new.coordena)
     or (tg_op = 'UPDATE' and new.coordena is distinct from old.coordena) then
    raise exception 'Somente a Direção pode definir coordenadores de projeto';
  end if;
  return new;
end $$;
create trigger protege_coordena before insert or update on public.alocacoes
  for each row execute function public.tg_protege_coordena();

-- Quem não gere pessoas só altera campos de trabalho no próprio cadastro
create or replace function public.tg_protege_pessoa()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.e_direcao() or public.tem_permissao('pessoas_gerir')
     or public.coordena_algum() then
    return new;
  end if;
  if new.tipo is distinct from old.tipo or new.funcao is distinct from old.funcao
     or new.email is distinct from old.email or new.ativo is distinct from old.ativo
     or new.risco_sobrecarga is distinct from old.risco_sobrecarga
     or new.ordem is distinct from old.ordem or new.saida is distinct from old.saida then
    raise exception 'Este campo só pode ser alterado pela Direção, Gerência Técnica ou Coordenação';
  end if;
  return new;
end $$;
create trigger protege_pessoa before update on public.pessoas
  for each row execute function public.tg_protege_pessoa();

-- ────────────────────────────────────────────────────────────────────
-- 11. Regras de acesso (Row Level Security)
-- ────────────────────────────────────────────────────────────────────
alter table public.pessoas              enable row level security;
alter table public.perfis               enable row level security;
alter table public.projetos             enable row level security;
alter table public.alocacoes            enable row level security;
alter table public.gerencias            enable row level security;
alter table public.aditivos             enable row level security;
alter table public.entregas             enable row level security;
alter table public.cronograma           enable row level security;
alter table public.equipe_plano         enable row level security;
alter table public.equipe_plano_bolsas  enable row level security;
alter table public.gerencia_membros     enable row level security;
alter table public.tarefas              enable row level security;
alter table public.tarefa_responsaveis  enable row level security;
alter table public.rubricas             enable row level security;
alter table public.vinculos_financeiros enable row level security;
alter table public.orcamento_rubricas   enable row level security;
alter table public.despesas             enable row level security;
alter table public.plano_itens          enable row level security;
alter table public.desembolsos          enable row level security;
alter table public.documentos           enable row level security;
alter table public.candidatos           enable row level security;
alter table public.checklist_itens      enable row level security;
alter table public.pessoa_checklist     enable row level security;
alter table public.pendencias           enable row level security;
alter table public.desembolso_rubricas  enable row level security;
alter table public.prospeccoes          enable row level security;
alter table public.avaliacoes           enable row level security;
alter table public.historico            enable row level security;

-- Perfis: cada um vê o seu; Direção vê e gerencia todos
create policy perfis_ver    on public.perfis for select to authenticated
  using (id = auth.uid() or public.e_direcao());
create policy perfis_gerir  on public.perfis for update to authenticated
  using (public.e_direcao()) with check (public.e_direcao());
create policy perfis_apagar on public.perfis for delete to authenticated
  using (public.e_direcao());

-- Pessoas
create policy pessoas_ver     on public.pessoas for select to authenticated using (public.tem_acesso());
create policy pessoas_incluir on public.pessoas for insert to authenticated
  with check (public.e_direcao() or public.tem_permissao('pessoas_gerir') or public.coordena_algum());
create policy pessoas_editar  on public.pessoas for update to authenticated
  using (public.e_direcao() or public.tem_permissao('pessoas_gerir') or public.coordena_algum()
         or (public.pode_editar() and id = public.minha_pessoa()));
create policy pessoas_apagar  on public.pessoas for delete to authenticated using (public.e_direcao());

-- Projetos
create policy projetos_ver     on public.projetos for select to authenticated using (public.tem_acesso());
create policy projetos_incluir on public.projetos for insert to authenticated
  with check (public.e_direcao() or public.tem_permissao('projetos_criar'));
create policy projetos_editar  on public.projetos for update to authenticated using (public.gere_projeto(id));
create policy projetos_apagar  on public.projetos for delete to authenticated using (public.e_direcao());

-- Alocações
create policy alocacoes_ver   on public.alocacoes for select to authenticated using (public.tem_acesso());
create policy alocacoes_gerir on public.alocacoes for all to authenticated
  using (public.gere_projeto(projeto_id) or public.tem_permissao('alocacoes_gerir'))
  with check (public.gere_projeto(projeto_id) or public.tem_permissao('alocacoes_gerir'));

-- Aditivos: todos veem; Direção, coordenação e Gerência de Projetos registram
create policy aditivos_ver   on public.aditivos for select to authenticated using (public.tem_acesso());
create policy aditivos_gerir on public.aditivos for all to authenticated
  using (public.gere_projeto(projeto_id)) with check (public.gere_projeto(projeto_id));

-- Entregas: todos veem; gestores do projeto cadastram; o responsável atualiza o andamento
-- Documentos: todos veem (os restritos só quem vê o financeiro); a equipe do projeto inclui; gestores ou o autor editam
create policy documentos_ver     on public.documentos for select to authenticated
  using (public.tem_acesso() and (not restrito or public.ve_financeiro(projeto_id) or public.gere_projeto(projeto_id)));
create policy documentos_incluir on public.documentos for insert to authenticated
  with check (public.gere_projeto(projeto_id) or (public.pode_editar() and public.alocado(projeto_id) and not restrito));
create policy documentos_editar  on public.documentos for update to authenticated
  using (public.gere_projeto(projeto_id) or (public.pode_editar() and criado_por = auth.uid()))
  with check (public.gere_projeto(projeto_id) or not restrito);
create policy documentos_apagar  on public.documentos for delete to authenticated
  using (public.gere_projeto(projeto_id) or (public.pode_editar() and criado_por = auth.uid()));
-- Pendências: todos veem; gestores do projeto criam e definem; o responsável atualiza
create policy pendencias_ver     on public.pendencias for select to authenticated using (public.tem_acesso());
create policy pendencias_incluir on public.pendencias for insert to authenticated with check (public.gere_projeto(projeto_id));
create policy pendencias_editar  on public.pendencias for update to authenticated
  using (public.gere_projeto(projeto_id) or (public.pode_editar() and responsavel_id = public.minha_pessoa()));
create policy pendencias_apagar  on public.pendencias for delete to authenticated using (public.gere_projeto(projeto_id));

-- Candidatos: só gestores do projeto, alocacoes_gerir ou pessoas_gerir
create policy candidatos_todos on public.candidatos for all to authenticated
  using (public.gere_projeto(projeto_id) or public.tem_permissao('alocacoes_gerir') or public.tem_permissao('pessoas_gerir'))
  with check (public.gere_projeto(projeto_id) or public.tem_permissao('alocacoes_gerir') or public.tem_permissao('pessoas_gerir'));
-- Checklist: modelo visível a todos, editado pela Direção / pessoas_gerir; situação: a própria pessoa vê, gestores marcam
create policy chk_itens_ver   on public.checklist_itens for select to authenticated using (public.tem_acesso());
create policy chk_itens_gerir on public.checklist_itens for all to authenticated
  using (public.e_direcao() or public.tem_permissao('pessoas_gerir')) with check (public.e_direcao() or public.tem_permissao('pessoas_gerir'));
create policy pchk_ver   on public.pessoa_checklist for select to authenticated
  using (pessoa_id = public.minha_pessoa() or public.gere_pessoa(pessoa_id));
create policy pchk_gerir on public.pessoa_checklist for all to authenticated
  using (public.gere_pessoa(pessoa_id)) with check (public.gere_pessoa(pessoa_id));

create policy entregas_ver     on public.entregas for select to authenticated using (public.tem_acesso());
create policy entregas_incluir on public.entregas for insert to authenticated with check (public.gere_projeto(projeto_id));
create policy entregas_editar  on public.entregas for update to authenticated
  using (public.gere_projeto(projeto_id) or (public.pode_editar() and responsavel_id = public.minha_pessoa()));
create policy entregas_apagar  on public.entregas for delete to authenticated using (public.gere_projeto(projeto_id));

-- Cronograma físico: todos veem; gestores do projeto planejam; o responsável atualiza o andamento
create policy crono_ver     on public.cronograma for select to authenticated using (public.tem_acesso());
create policy crono_incluir on public.cronograma for insert to authenticated with check (public.gere_projeto(projeto_id));
create policy crono_editar  on public.cronograma for update to authenticated
  using (public.gere_projeto(projeto_id) or (public.pode_editar() and responsavel_id = public.minha_pessoa()));
create policy crono_apagar  on public.cronograma for delete to authenticated using (public.gere_projeto(projeto_id));

-- Gerências: todos veem; só a Direção cria, altera permissões e nomeia gerentes
create policy gerencias_ver   on public.gerencias for select to authenticated using (public.tem_acesso());
create policy gerencias_gerir on public.gerencias for all to authenticated
  using (public.e_direcao()) with check (public.e_direcao());
create policy gmembros_ver    on public.gerencia_membros for select to authenticated using (public.tem_acesso());
create policy gmembros_gerir  on public.gerencia_membros for all to authenticated
  using (public.e_direcao()) with check (public.e_direcao());

-- Tarefas e demandas
--   de projeto: Direção, coordenador, gerência com tarefas_gerir/projetos_editar;
--               membro alocado cria as suas e edita as que criou ou é responsável
--   de gerência: gerentes daquela gerência
create policy tarefas_ver on public.tarefas for select to authenticated using (public.tem_acesso());
create policy tarefas_incluir on public.tarefas for insert to authenticated
  with check (
    (gerencia_id is null or public.gerencia(gerencia_id)) and
    (projeto_id is null or public.gere_tarefas(projeto_id) or public.gerencia(gerencia_id)
       or (public.pode_editar() and exists (
             select 1 from public.alocacoes a
              where a.projeto_id = tarefas.projeto_id and a.pessoa_id = public.minha_pessoa()))));
create policy tarefas_editar on public.tarefas for update to authenticated
  using (public.gere_tarefas(projeto_id)
    or (gerencia_id is not null and public.gerencia(gerencia_id))
    or (public.pode_editar() and (criado_por = auth.uid() or exists (
          select 1 from public.tarefa_responsaveis r
           where r.tarefa_id = tarefas.id and r.pessoa_id = public.minha_pessoa()))));
create policy tarefas_apagar on public.tarefas for delete to authenticated
  using (public.gere_tarefas(projeto_id)
    or (gerencia_id is not null and public.gerencia(gerencia_id))
    or (public.pode_editar() and criado_por = auth.uid()));

create or replace function public.gere_tarefa(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tarefas t where t.id = p_tarefa
    and (public.gere_tarefas(t.projeto_id)
         or (t.gerencia_id is not null and public.gerencia(t.gerencia_id))
         or (public.pode_editar() and t.criado_por = auth.uid())))
$$;
create policy resp_ver   on public.tarefa_responsaveis for select to authenticated using (public.tem_acesso());
create policy resp_gerir on public.tarefa_responsaveis for all to authenticated
  using (public.gere_tarefa(tarefa_id)) with check (public.gere_tarefa(tarefa_id));

-- Rubricas (tabela de referência)
create policy rubricas_ver   on public.rubricas for select to authenticated using (public.tem_acesso());
create policy rubricas_gerir on public.rubricas for all to authenticated
  using (public.e_direcao()) with check (public.e_direcao());

-- Financeiro: Direção, coordenadores do projeto e gerências com permissão financeira
create policy equipe_plano_ver   on public.equipe_plano for select to authenticated using (public.tem_acesso());
create policy equipe_plano_gerir on public.equipe_plano for all to authenticated
  using (public.gere_projeto(projeto_id) or public.tem_permissao('alocacoes_gerir'))
  with check (public.gere_projeto(projeto_id) or public.tem_permissao('alocacoes_gerir'));
create policy plano_bolsas_ver   on public.equipe_plano_bolsas for select to authenticated using (public.ve_financeiro(projeto_id));
create policy plano_bolsas_gerir on public.equipe_plano_bolsas for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));
create policy plano_itens_ver   on public.plano_itens for select to authenticated using (public.ve_financeiro(projeto_id));
create policy plano_itens_gerir on public.plano_itens for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));
create policy desembolsos_ver   on public.desembolsos for select to authenticated using (public.ve_financeiro(projeto_id));
create policy desembolsos_gerir on public.desembolsos for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));
create policy desemb_rub_ver    on public.desembolso_rubricas for select to authenticated using (public.ve_financeiro(projeto_id));
create policy desemb_rub_gerir  on public.desembolso_rubricas for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));
create policy vinculos_ver    on public.vinculos_financeiros for select to authenticated using (public.ve_financeiro(projeto_id));
create policy vinculos_gerir  on public.vinculos_financeiros for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));
create policy orcamento_ver   on public.orcamento_rubricas for select to authenticated using (public.ve_financeiro(projeto_id));
create policy orcamento_gerir on public.orcamento_rubricas for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));
create policy despesas_ver    on public.despesas for select to authenticated using (public.ve_financeiro(projeto_id));
create policy despesas_gerir  on public.despesas for all to authenticated
  using (public.edita_financeiro(projeto_id)) with check (public.edita_financeiro(projeto_id));

-- Prospecção: todos veem; Direção, Gerência de Projetos e coordenadores registram e avaliam
create or replace function public.gere_prospeccao()
returns boolean language sql stable as $$
  select public.e_direcao() or public.tem_permissao('prospeccao_gerir') or public.coordena_algum()
$$;
create policy prosp_ver    on public.prospeccoes for select to authenticated using (public.tem_acesso());
create policy prosp_gerir  on public.prospeccoes for insert to authenticated with check (public.gere_prospeccao());
create policy prosp_editar on public.prospeccoes for update to authenticated using (public.gere_prospeccao());
create policy prosp_apagar on public.prospeccoes for delete to authenticated using (public.e_direcao());

create policy aval_ver     on public.avaliacoes for select to authenticated using (public.tem_acesso());
create policy aval_incluir on public.avaliacoes for insert to authenticated with check (public.gere_prospeccao());
create policy aval_apagar  on public.avaliacoes for delete to authenticated using (public.e_direcao());

-- Histórico: Direção e gerências com historico_ver
create policy historico_ver on public.historico for select to authenticated
  using (public.tem_permissao('historico_ver'));


-- ── Regras de negócio da infraestrutura ─────────────────────────────
create or replace function public.gere_infra(p_item uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_direcao() or public.tem_permissao('infraestrutura_gerir')
      or (public.pode_editar() and exists (
            select 1 from public.infra_itens i
             where i.id = p_item and i.responsavel_id = public.minha_pessoa()))
$$;

-- Reserva: item disponível, operador habilitado; quem não gere só solicita/cancela
create or replace function public.tg_confere_reserva()
returns trigger language plpgsql as $$
declare it public.infra_itens;
begin
  select * into it from public.infra_itens where id = new.item_id;
  if new.status in ('solicitada','confirmada') then
    if not it.reservavel then
      raise exception 'O item "%" não está aberto para reservas', it.nome;
    end if;
    if it.status in ('inoperante','desativado') then
      raise exception 'O item "%" está %', it.nome, it.status;
    end if;
    if it.requer_habilitacao and not exists (
         select 1 from public.infra_habilitacoes h
          where h.item_id = it.id and h.pessoa_id = new.responsavel_id
            and h.desde <= (new.inicio at time zone 'America/Sao_Paulo')::date
            and (h.validade is null or h.validade >= (new.fim at time zone 'America/Sao_Paulo')::date)) then
      raise exception 'O responsável pelo uso não tem habilitação válida para "%"', it.nome;
    end if;
  end if;
  if auth.uid() is not null and not public.gere_infra(new.item_id) then
    if new.status not in ('solicitada','cancelada') then
      raise exception 'Somente a Gerência de Infraestrutura ou o responsável pelo item confirma reservas';
    end if;
    if tg_op = 'UPDATE' and old.status <> 'solicitada' then
      raise exception 'Reserva já confirmada: peça alteração à Gerência de Infraestrutura';
    end if;
  end if;
  return new;
end $$;
create trigger confere_reserva before insert or update on public.infra_reservas
  for each row execute function public.tg_confere_reserva();

alter table public.infra_itens        enable row level security;
alter table public.infra_habilitacoes enable row level security;
alter table public.infra_reservas     enable row level security;
alter table public.infra_manutencoes  enable row level security;

-- Itens e habilitações: todos veem; Direção, Gerência de Infraestrutura
-- (e o responsável pelo item, na edição) gerenciam
create policy infra_itens_ver     on public.infra_itens for select to authenticated using (public.tem_acesso());
create policy infra_itens_incluir on public.infra_itens for insert to authenticated
  with check (public.e_direcao() or public.tem_permissao('infraestrutura_gerir'));
create policy infra_itens_editar  on public.infra_itens for update to authenticated using (public.gere_infra(id));
create policy infra_itens_apagar  on public.infra_itens for delete to authenticated
  using (public.e_direcao() or public.tem_permissao('infraestrutura_gerir'));

create policy infra_hab_ver   on public.infra_habilitacoes for select to authenticated using (public.tem_acesso());
create policy infra_hab_gerir on public.infra_habilitacoes for all to authenticated
  using (public.gere_infra(item_id)) with check (public.gere_infra(item_id));

-- Reservas: todos veem a agenda; qualquer membro solicita; gestão confirma
create policy infra_res_ver     on public.infra_reservas for select to authenticated using (public.tem_acesso());
create policy infra_res_incluir on public.infra_reservas for insert to authenticated
  with check (public.pode_editar());
create policy infra_res_editar  on public.infra_reservas for update to authenticated
  using (public.gere_infra(item_id) or (public.pode_editar() and criado_por = auth.uid()));
create policy infra_res_apagar  on public.infra_reservas for delete to authenticated
  using (public.gere_infra(item_id));

-- Manutenções: todos veem; qualquer membro REPORTA defeito (corretiva planejada);
-- gestão planeja, executa e conclui
create policy infra_man_ver     on public.infra_manutencoes for select to authenticated using (public.tem_acesso());
create policy infra_man_incluir on public.infra_manutencoes for insert to authenticated
  with check (public.gere_infra(item_id)
              or (public.pode_editar() and tipo = 'corretiva' and status = 'planejada'));
create policy infra_man_editar  on public.infra_manutencoes for update to authenticated
  using (public.gere_infra(item_id)) with check (public.gere_infra(item_id));
create policy infra_man_apagar  on public.infra_manutencoes for delete to authenticated
  using (public.gere_infra(item_id));

-- ────────────────────────────────────────────────────────────────────
-- 12. Visões prontas para as telas
-- ────────────────────────────────────────────────────────────────────

-- Carga real: só alocações ativas em projetos vigentes (não encerrados)
create view public.v_carga_pessoa with (security_invoker = true) as
select p.id as pessoa_id, p.nome, p.tipo, p.disponibilidade_pct,
       coalesce(sum(a.carga_pct) filter (
         where a.status = 'ativo' and pr.situacao = 'vigente' and pr.fim >= public.hoje()), 0) as carga_total_pct,
       count(a.id) filter (
         where a.status = 'ativo' and pr.situacao = 'vigente' and pr.fim >= public.hoje()) as projetos_ativos
  from public.pessoas p
  left join public.alocacoes a  on a.pessoa_id = p.id
  left join public.projetos  pr on pr.id = a.projeto_id
 where p.ativo
 group by p.id;

-- Gerências com seus gerentes em exercício e demandas abertas
create view public.v_gerencias with (security_invoker = true) as
select g.id, g.nome, g.descricao, g.permissoes, g.ordem,
       coalesce((select jsonb_agg(jsonb_build_object('pessoa_id', p.id, 'nome', p.nome, 'funcao', gm.funcao)
                                  order by gm.funcao desc, p.nome)
                   from public.gerencia_membros gm join public.pessoas p on p.id = gm.pessoa_id
                  where gm.gerencia_id = g.id and gm.desde <= public.hoje()
                    and (gm.ate is null or gm.ate >= public.hoje())), '[]') as gerentes,
       (select count(*) from public.tarefas t where t.gerencia_id = g.id and not t.concluida) as demandas_abertas,
       (select count(*) from public.tarefas t where t.gerencia_id = g.id and not t.concluida
                                              and t.prazo < public.hoje()) as demandas_atrasadas
  from public.gerencias g
 where g.ativa;

-- Entregas em aberto com situação do prazo
create view public.v_entregas_abertas with (security_invoker = true) as
select e.*, p.sigla,
       (e.prazo < public.hoje()) as atrasada,
       (e.prazo - public.hoje()) as dias_para_prazo
  from public.entregas e join public.projetos p on p.id = e.projeto_id
 where e.status in ('pendente','em_elaboracao');

-- Projeto com alerta de vigência vencida
create view public.v_projetos with (security_invoker = true) as
select pr.*,
       (pr.situacao = 'vigente' and pr.fim < public.hoje()) as vigencia_vencida,
       (select count(*) from public.tarefas t
         where t.projeto_id = pr.id and not t.concluida and t.prazo < public.hoje()) as tarefas_atrasadas
  from public.projetos pr;

-- Prospecção com a avaliação mais recente
create view public.v_prospeccoes with (security_invoker = true) as
select pr.*, av.ia, av.ie, av.ip, av.bloqueada, av.quadrante, av.avaliado_em,
       (select count(*) from public.avaliacoes x where x.prospeccao_id = pr.id) as n_avaliacoes
  from public.prospeccoes pr
  left join lateral (
    select * from public.avaliacoes a where a.prospeccao_id = pr.id
     order by a.avaliado_em desc limit 1) av on true;

-- Orçamento por rubrica-folha: aprovado, previsto, executado (soma das despesas) e saldo
-- Equipe do plano: situação das posições por projeto
create view public.v_equipe_plano with (security_invoker = true) as
  select e.projeto_id,
         count(*) filter (where e.status <> 'cancelada')                as posicoes,
         count(*) filter (where e.status = 'ocupada')                   as ocupadas,
         count(*) filter (where e.status = 'vaga')                      as vagas_abertas,
         count(*) filter (where e.status = 'selecao')                   as em_selecao
    from public.equipe_plano e group by e.projeto_id;

-- Bolsas do plano: previsto no plano × meses já cobertos por vínculos (só quem vê o financeiro)
create view public.v_plano_bolsas with (security_invoker = true) as
  select b.vaga_id, b.projeto_id, e.nome_plano, e.status, e.pessoa_id, b.modalidade, b.rubrica,
         b.valor_mensal, b.meses, b.valor_mensal * b.meses as valor_total,
         coalesce(sum((extract(year from age(v.fim + 1, v.inicio)) * 12 + extract(month from age(v.fim + 1, v.inicio)))::int)
                  filter (where v.id is not null), 0) as meses_vinculados
    from public.equipe_plano_bolsas b
    join public.equipe_plano e on e.id = b.vaga_id
    left join public.vinculos_financeiros v on v.vaga_id = b.vaga_id
   group by b.id, e.id;

-- Bolsas que terminam nos próximos 90 dias (só quem vê o financeiro do projeto)
create view public.v_bolsas_vencendo with (security_invoker = true) as
  select v.*, p.nome as pessoa, pr.sigla, (v.fim - public.hoje()) as dias_restantes
    from public.vinculos_financeiros v join public.pessoas p on p.id = v.pessoa_id join public.projetos pr on pr.id = v.projeto_id
   where v.status in ('previsto','ativo') and v.fim between public.hoje() and public.hoje() + 90;

-- Pendências em aberto (para o painel)
create view public.v_pendencias_abertas with (security_invoker = true) as
  select pd.*, p.sigla, pe.nome as responsavel, (pd.prazo < public.hoje()) as atrasada
    from public.pendencias pd join public.projetos p on p.id = pd.projeto_id
    left join public.pessoas pe on pe.id = pd.responsavel_id
   where pd.status in ('aberta','em_andamento','aguardando');

-- Desembolso por projeto: previsto × recebido × executado (saldo em caixa)
create view public.v_desembolso_projeto with (security_invoker = true) as
  select p.id as projeto_id, p.sigla,
         coalesce(d.previsto, 0) as previsto, coalesce(d.recebido, 0) as recebido,
         coalesce(d.previsto, 0) - coalesce(d.recebido_prev, 0) as a_receber,
         coalesce(d.atrasadas, 0) as parcelas_atrasadas, d.proxima,
         coalesce(x.executado, 0) as executado,
         coalesce(d.recebido, 0) - coalesce(x.executado, 0) as saldo_caixa
    from public.projetos p
    left join (select projeto_id,
                      sum(valor_previsto) filter (where status <> 'cancelada') as previsto,
                      sum(valor_recebido) filter (where status = 'recebida') as recebido,
                      sum(valor_previsto) filter (where status = 'recebida') as recebido_prev,
                      count(*) filter (where status = 'prevista' and data_prevista < public.hoje()) as atrasadas,
                      min(data_prevista) filter (where status = 'prevista') as proxima
                 from public.desembolsos group by projeto_id) d on d.projeto_id = p.id
    left join (select projeto_id, sum(valor) as executado from public.despesas group by projeto_id) x on x.projeto_id = p.id
   where public.ve_financeiro(p.id) and d.projeto_id is not null;

-- Plano de aplicação com execução por item
create view public.v_plano_itens with (security_invoker = true) as
  select i.*, coalesce(sum(d.valor), 0) as executado, i.valor_previsto - coalesce(sum(d.valor), 0) as saldo, count(d.id) as n_despesas
    from public.plano_itens i left join public.despesas d on d.item_id = i.id
   group by i.id;

create view public.v_orcamento_rubricas with (security_invoker = true) as
with folhas as (
  select r.* from public.rubricas r where not exists (select 1 from public.rubricas c where c.pai = r.codigo)),
exec as (
  select projeto_id, rubrica, sum(valor) as executado, count(*) as n_despesas from public.despesas group by 1, 2)
select p.id as projeto_id, f.codigo as rubrica, f.nome, f.pai,
       coalesce(o.aprovado, 0) as aprovado, coalesce(o.previsto, 0) as previsto,
       coalesce(e.executado, 0) as executado, coalesce(e.n_despesas, 0) as n_despesas,
       coalesce(o.aprovado, 0) - coalesce(e.executado, 0) as saldo,
       coalesce(o.previsto, 0) - coalesce(e.executado, 0) as previsto_a_executar
  from public.projetos p
  cross join folhas f
  left join public.orcamento_rubricas o on o.projeto_id = p.id and o.rubrica = f.codigo
  left join exec e on e.projeto_id = p.id and e.rubrica = f.codigo
 where p.tipo = any(f.planos)
   and (o.id is not null or e.executado is not null);

-- Totais financeiros por projeto
create view public.v_orcamento_projeto with (security_invoker = true) as
select projeto_id, sum(aprovado) as aprovado, sum(previsto) as previsto,
       sum(executado) as executado, sum(saldo) as saldo
  from public.v_orcamento_rubricas group by projeto_id;

-- Alertas da infraestrutura: calibração/preventiva vencida ou vencendo em 30 dias,
-- manutenção atrasada, item parado, habilitação vencendo
create view public.v_infra_alertas with (security_invoker = true) as
select i.id as item_id, i.nome as item, 'vencimento' as tipo_alerta,
       m.tipo || ': ' || m.titulo as descricao, m.proxima_em as data_ref,
       (m.proxima_em < public.hoje()) as vencido
  from public.infra_manutencoes m join public.infra_itens i on i.id = m.item_id
 where m.status = 'concluida' and m.proxima_em is not null
   and m.proxima_em <= public.hoje() + 30 and i.status <> 'desativado'
   and not exists (select 1 from public.infra_manutencoes m2          -- já existe uma posterior
                    where m2.item_id = m.item_id and m2.tipo = m.tipo
                      and m2.status <> 'cancelada' and m2.criado_em > m.criado_em)
union all
select i.id, i.nome, 'manutencao_atrasada', m.tipo || ': ' || m.titulo, m.data_prevista, true
  from public.infra_manutencoes m join public.infra_itens i on i.id = m.item_id
 where m.status = 'planejada' and m.data_prevista < public.hoje()
union all
select i.id, i.nome, 'item_parado', 'Status: ' || i.status, null::date, true
  from public.infra_itens i where i.status in ('inoperante','em_manutencao')
union all
select i.id, i.nome, 'habilitacao', 'Habilitação de ' || p.nome, h.validade, (h.validade < public.hoje())
  from public.infra_habilitacoes h
  join public.infra_itens i on i.id = h.item_id
  join public.pessoas p on p.id = h.pessoa_id
 where h.validade is not null and h.validade <= public.hoje() + 30;

-- Horas de uso por item e projeto (para relatório e prestação de contas)
create view public.v_infra_uso_projeto with (security_invoker = true) as
select r.item_id, i.nome as item, r.projeto_id, pr.sigla as projeto,
       date_trunc('month', r.inicio at time zone 'America/Sao_Paulo')::date as mes,
       count(*) as reservas,
       sum(coalesce(r.horas_uso, extract(epoch from (r.fim - r.inicio)) / 3600.0))::numeric(9,1) as horas
  from public.infra_reservas r
  join public.infra_itens i on i.id = r.item_id
  left join public.projetos pr on pr.id = r.projeto_id
 where r.status = 'realizada'
 group by r.item_id, i.nome, r.projeto_id, pr.sigla, date_trunc('month', r.inicio at time zone 'America/Sao_Paulo');

-- ────────────────────────────────────────────────────────────────────
-- 13. Permissões de acesso pela API (Data API da Supabase)
-- ────────────────────────────────────────────────────────────────────
-- Desde 30/05/2026 as tabelas novas do esquema public não ficam mais
-- acessíveis pela API automaticamente: é preciso conceder cada permissão.
-- Só usuários logados (authenticated) recebem acesso; o que cada um vê e
-- altera continua decidido linha a linha pelas políticas (RLS) acima.
-- O papel anon (quem não fez login) não recebe nada.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Fuso horário do banco: Brasília (afeta datas exibidas por consultas diretas)
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Sao_Paulo');
exception when others then
  raise notice 'Não foi possível alterar o fuso do banco (%). As datas das regras já usam public.hoje().', sqlerrm;
end $$;

-- Atualização em tempo real: quando alguém grava, as outras telas abertas
-- recarregam sozinhas. Só existe na Supabase (publicação supabase_realtime).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'historico'
                and not exists (select 1 from pg_publication_tables pt
                                 where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = c.relname)
    loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 14. Primeiro acesso
-- ────────────────────────────────────────────────────────────────────
-- Os e-mails de public.emails_direcao_fixa() entram direto como Direção no
-- primeiro login. Os demais usuários entram inativos e são liberados pela
-- Direção em Configurações → Usuários e acessos.
