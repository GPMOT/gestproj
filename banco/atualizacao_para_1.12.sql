-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.12 (a partir da 1.11)
--  • Fichas de gestão da equipe (UFSM — "Ajuste de item — alteração da equipe"): cada ficha
--    importada fica registrada no projeto, com a equipe completa (sem CPF) e o que foi aplicado
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo inteiro e clique
--  em Run. Não apaga dados. Use o programa 2.34 ou mais novo.
-- ════════════════════════════════════════════════════════════════════
begin;   -- tudo ou nada: se algo falhar, o banco fica como estava
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'gere_atividades' and pronamespace = 'public'::regnamespace) then
    raise exception 'Este banco não está na versão 1.11. Execute antes os arquivos atualizacao_para_1.10.sql e atualizacao_para_1.11.sql.';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fichas_equipe') then
    raise exception 'Este banco já está na versão 1.12 (a tabela fichas_equipe já existe). Nada a fazer.';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 20. Fichas de gestão da equipe (v1.12)
--     "Autorização para execução de projeto — ajuste de item — alteração da equipe" (UFSM):
--     a cada mudança na equipe executora sai uma nova ficha com a equipe completa. O programa
--     lê a ficha, aplica as mudanças (posições do plano, alocações e bolsas) e guarda o registro.
--     O CPF dos participantes NUNCA é gravado (só se a ficha o informa, para a conferência).
-- ────────────────────────────────────────────────────────────────────
create table public.fichas_equipe (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  numero          smallint,                                -- ordem das fichas do projeto (1 = inicial)
  data            date not null default public.hoje(),     -- aprovação pela coordenação
  formulario      text,                                    -- Original / Retificador
  referencia      text,                                    -- referência da fundação (ex.: FAURGS 2.9290)
  processo        text,                                    -- nº do processo UFSM
  contrato        text,                                    -- nº do contrato UFSM/fundação
  vigencia_inicio date,
  vigencia_fim    date,
  descricao       text,                                    -- "Descrição da adequação realizada"
  documento       text,                                    -- arquivo de origem
  participantes   jsonb not null default '[]',             -- equipe completa da ficha (sem CPF)
  aprovacoes      jsonb not null default '{}',             -- datas de aprovação (coordenação, fiscal, PRA)
  alteracoes      jsonb not null default '{}',             -- o que foi aplicado no sistema
  aplicada_em     timestamptz,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  autor           text,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid,
  constraint ficha_vigencia check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio),
  constraint ficha_sem_cpf check (participantes::text !~ '(^|\D)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(\D|$)')
);
create index on public.fichas_equipe (projeto_id, data desc);
create trigger carimbo before update on public.fichas_equipe
  for each row execute function public.tg_carimbo();

-- quem importa fichas: quem gere a equipe do projeto e vê o financeiro dele (a ficha traz valores)
create or replace function public.gere_ficha_equipe(p_projeto uuid)
returns boolean language sql stable set search_path = public as $$
  select (public.gere_projeto(p_projeto) or public.tem_permissao('alocacoes_gerir')) and public.ve_financeiro(p_projeto)
$$;

create or replace function public.tg_ficha_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not (public.e_direcao() and new.criado_por is not null and new.autor is not null) then
    new.criado_por := auth.uid(); new.criado_em := now();
    new.autor := (select coalesce(p.nome, f.email) from public.perfis f left join public.pessoas p on p.id = f.pessoa_id where f.id = auth.uid());
  end if;
  return new;
end $$;
create trigger ficha_autor before insert on public.fichas_equipe
  for each row execute function public.tg_ficha_autor();
create trigger historico after insert or update or delete on public.fichas_equipe
  for each row execute function public.tg_historico();

alter table public.fichas_equipe enable row level security;
create policy fichas_ver     on public.fichas_equipe for select to authenticated using (public.ve_financeiro(projeto_id));
create policy fichas_incluir on public.fichas_equipe for insert to authenticated with check (public.gere_ficha_equipe(projeto_id));
create policy fichas_editar  on public.fichas_equipe for update to authenticated using (public.gere_ficha_equipe(projeto_id)) with check (public.gere_ficha_equipe(projeto_id));
create policy fichas_apagar  on public.fichas_equipe for delete to authenticated using (public.e_direcao());

grant select, insert, update, delete on public.fichas_equipe to authenticated, service_role;
revoke truncate, references, trigger on public.fichas_equipe from anon, authenticated;
revoke all on public.fichas_equipe from anon;
revoke execute on function public.gere_ficha_equipe(uuid), public.tg_ficha_autor() from public, anon;
grant execute on function public.gere_ficha_equipe(uuid), public.tg_ficha_autor() to authenticated, service_role;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fichas_equipe') then
    execute 'alter publication supabase_realtime add table public.fichas_equipe';
  end if;
end $$;

commit;
