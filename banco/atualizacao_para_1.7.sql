-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.7 (a partir da 1.6)
--  • Reformulações financeiras: remanejamento entre rubricas, inclusão/exclusão/alteração de
--    itens do plano de aplicação e nova distribuição do desembolso, com registro e situação
--    (submetida, aprovada, rejeitada)
--  • Nova permissão de gerência "financeiro_reformular", dada a todas as gerências existentes:
--    vê orçamento, plano de aplicação e desembolso (não bolsas nem despesas) e registra reformulações
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo inteiro e clique
--  em Run. Não apaga dados e pode ser executado mais de uma vez. Use o programa 2.28 ou mais novo.
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if to_regprocedure('public.gere_cronograma(uuid)') is null then
    raise exception 'Este banco não está na versão 1.6. Execute antes o arquivo atualizacao_para_1.6.sql.';
  end if;
end $$;

alter table public.gerencias drop constraint if exists permissoes_validas;
alter table public.gerencias add constraint permissoes_validas check (permissoes <@ array[
    'projetos_criar','projetos_editar','alocacoes_gerir','tarefas_gerir','pessoas_gerir',
    'financeiro_ver','financeiro_editar','prospeccao_gerir','historico_ver',
    'infraestrutura_gerir','cronograma_gerir','financeiro_reformular']::text[]);
update public.gerencias set permissoes = permissoes || array['financeiro_reformular']
 where not ('financeiro_reformular' = any(permissoes));

-- ────────────────────────────────────────────────────────────────────
-- 16. Reformulações financeiras (v1.7)
--     Remanejamento entre rubricas, inclusão/exclusão/alteração de itens do plano de aplicação
--     e nova distribuição do desembolso, sempre a partir de uma solicitação ao financiador.
--     Registram: Direção, coordenação (e vice), gerência com financeiro_editar ou financeiro_reformular.
-- ────────────────────────────────────────────────────────────────────
-- vê o orçamento, o plano de aplicação e o desembolso do projeto (não bolsas nem despesas)
create or replace function public.ve_orcamento(p_projeto uuid)
returns boolean language sql stable set search_path = public as $$
  select public.ve_financeiro(p_projeto) or public.tem_permissao('financeiro_reformular')
$$;
-- registra e aplica reformulações financeiras do projeto
create or replace function public.reformula_financeiro(p_projeto uuid)
returns boolean language sql stable set search_path = public as $$
  select public.edita_financeiro(p_projeto) or public.tem_permissao('financeiro_reformular')
$$;

create table if not exists public.reformulacoes (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references public.projetos(id) on delete cascade,
  numero        smallint,                                -- 5 = "5ª reformulação"
  tipo          text not null default 'financeira' check (tipo in ('financeira','prazo','outra')),
  data          date not null default public.hoje(),     -- data da submissão ao financiador
  situacao      text not null default 'submetida' check (situacao in ('rascunho','submetida','aprovada','rejeitada')),
  documento     text,                                    -- identificação do documento (ex.: arquivo do SIGITEC)
  justificativa text,
  alteracoes    jsonb not null default '{}',             -- {rubricas: [...], itens: [...], desembolso: [...]}
  remanejado    numeric(14,2) not null default 0,        -- total movido entre rubricas
  rendimentos   numeric(14,2) not null default 0,        -- rendimentos de aplicação financeira usados
  aplicada_em   timestamptz,                             -- quando o orçamento do sistema foi atualizado
  criado_em     timestamptz not null default now(),
  criado_por    uuid default auth.uid(),
  autor         text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index if not exists reformulacoes_projeto_id_data_idx on public.reformulacoes (projeto_id, data desc);
drop trigger if exists carimbo on public.reformulacoes;
create trigger carimbo before update on public.reformulacoes
  for each row execute function public.tg_carimbo();

create or replace function public.tg_reformulacao_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not (public.e_direcao() and new.criado_por is not null and new.autor is not null) then
    new.criado_por := auth.uid(); new.criado_em := now();
    new.autor := (select coalesce(p.nome, f.email) from public.perfis f left join public.pessoas p on p.id = f.pessoa_id where f.id = auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists reformulacao_autor on public.reformulacoes;
create trigger reformulacao_autor before insert on public.reformulacoes
  for each row execute function public.tg_reformulacao_autor();
drop trigger if exists historico on public.reformulacoes;
create trigger historico after insert or update or delete on public.reformulacoes
  for each row execute function public.tg_historico();

alter table public.reformulacoes enable row level security;
drop policy if exists reform_ver on public.reformulacoes;
drop policy if exists reform_incluir on public.reformulacoes;
drop policy if exists reform_editar on public.reformulacoes;
drop policy if exists reform_apagar on public.reformulacoes;
create policy reform_ver     on public.reformulacoes for select to authenticated using (public.ve_orcamento(projeto_id));
create policy reform_incluir on public.reformulacoes for insert to authenticated with check (public.reformula_financeiro(projeto_id));
create policy reform_editar  on public.reformulacoes for update to authenticated using (public.reformula_financeiro(projeto_id)) with check (public.reformula_financeiro(projeto_id));
create policy reform_apagar  on public.reformulacoes for delete to authenticated using (public.e_direcao());

-- orçamento, plano de aplicação e distribuição do desembolso: também para quem reformula
drop policy if exists orcamento_ver on public.orcamento_rubricas;
drop policy if exists orcamento_gerir on public.orcamento_rubricas;
create policy orcamento_ver   on public.orcamento_rubricas for select to authenticated using (public.ve_orcamento(projeto_id));
create policy orcamento_gerir on public.orcamento_rubricas for all to authenticated
  using (public.reformula_financeiro(projeto_id)) with check (public.reformula_financeiro(projeto_id));
drop policy if exists plano_itens_ver on public.plano_itens;
drop policy if exists plano_itens_gerir on public.plano_itens;
create policy plano_itens_ver   on public.plano_itens for select to authenticated using (public.ve_orcamento(projeto_id));
create policy plano_itens_gerir on public.plano_itens for all to authenticated
  using (public.reformula_financeiro(projeto_id)) with check (public.reformula_financeiro(projeto_id));
drop policy if exists desembolsos_ver on public.desembolsos;
create policy desembolsos_ver   on public.desembolsos for select to authenticated using (public.ve_orcamento(projeto_id));
drop policy if exists desemb_rub_ver on public.desembolso_rubricas;
drop policy if exists desemb_rub_gerir on public.desembolso_rubricas;
create policy desemb_rub_ver    on public.desembolso_rubricas for select to authenticated using (public.ve_orcamento(projeto_id));
create policy desemb_rub_gerir  on public.desembolso_rubricas for all to authenticated
  using (public.reformula_financeiro(projeto_id)) with check (public.reformula_financeiro(projeto_id));

-- permissões pela API para os objetos novos (não reabre as colunas de valor)
grant select, insert, update, delete on public.reformulacoes to authenticated, service_role;
revoke truncate, references, trigger on public.reformulacoes from anon, authenticated;
revoke all on public.reformulacoes from anon;
revoke execute on function public.ve_orcamento(uuid), public.reformula_financeiro(uuid), public.tg_reformulacao_autor() from public, anon;
grant execute on function public.ve_orcamento(uuid), public.reformula_financeiro(uuid), public.tg_reformulacao_autor() to authenticated, service_role;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reformulacoes') then
    execute 'alter publication supabase_realtime add table public.reformulacoes';
  end if;
end $$;
