-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.6 (a partir da 1.5)
--  • Reprogramação de cronograma: Direção, coordenação e gerências (nova permissão
--    "cronograma_gerir", dada a todas as gerências existentes) ajustam os meses das atividades
--  • Linha de base: na primeira reprogramação, os meses originais ficam guardados
--  • Registro das reprogramações (motivo, documento e o que mudou)
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo
--  inteiro e clique em Run. Não apaga dados e pode ser executado mais de uma vez.
--  Use o programa versão 2.27 ou mais nova.
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if to_regprocedure('public.ve_valores()') is null then
    raise exception 'Este banco não está na versão 1.5. Execute antes o arquivo atualizacao_para_1.5.sql.';
  end if;
end $$;

alter table public.cronograma add column if not exists mes_inicio_base smallint;
alter table public.cronograma add column if not exists mes_fim_base smallint;

alter table public.gerencias drop constraint if exists permissoes_validas;
alter table public.gerencias add constraint permissoes_validas check (permissoes <@ array[
    'projetos_criar','projetos_editar','alocacoes_gerir','tarefas_gerir','pessoas_gerir',
    'financeiro_ver','financeiro_editar','prospeccao_gerir','historico_ver',
    'infraestrutura_gerir','cronograma_gerir']::text[]);
update public.gerencias set permissoes = permissoes || array['cronograma_gerir']
 where not ('cronograma_gerir' = any(permissoes));

-- Linha de base (plano original) do cronograma: na primeira mudança de meses de uma atividade,
-- os meses anteriores ficam guardados em mes_inicio_base / mes_fim_base. Só a Direção redefine a linha de base.
create or replace function public.tg_cronograma_base()
returns trigger language plpgsql set search_path = public as $$
declare livre boolean := auth.uid() is null or public.e_direcao();
begin
  if tg_op = 'INSERT' then
    if not livre then new.mes_inicio_base := null; new.mes_fim_base := null; end if;
    return new;
  end if;
  if old.mes_inicio_base is null and old.mes_fim_base is null
     and (new.mes_inicio is distinct from old.mes_inicio or new.mes_fim is distinct from old.mes_fim) then
    if not livre or (new.mes_inicio_base is null and new.mes_fim_base is null) then
      new.mes_inicio_base := old.mes_inicio; new.mes_fim_base := old.mes_fim;
    end if;
    return new;
  end if;
  if not livre and (new.mes_inicio_base is distinct from old.mes_inicio_base or new.mes_fim_base is distinct from old.mes_fim_base) then
    raise exception 'Somente a Direção redefine a linha de base (plano original) do cronograma';
  end if;
  return new;
end $$;

-- Quem pode mudar o quê numa atividade do cronograma:
--   Direção, coordenação e gerência com projetos_editar: tudo
--   gerência com cronograma_gerir: reprograma os meses e atualiza o andamento (não muda a estrutura)
--   responsável pela atividade: só andamento, conclusão, evidência e observações
create or replace function public.tg_protege_cronograma()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.gere_projeto(old.projeto_id) then return new; end if;
  if new.codigo is distinct from old.codigo or new.titulo is distinct from old.titulo
     or new.responsavel_id is distinct from old.responsavel_id or new.projeto_id is distinct from old.projeto_id
     or new.entrega is distinct from old.entrega or new.descricao is distinct from old.descricao
     or ((new.mes_inicio is distinct from old.mes_inicio or new.mes_fim is distinct from old.mes_fim)
         and not public.tem_permissao('cronograma_gerir')) then
    raise exception 'O responsável pela atividade só atualiza andamento, conclusão, evidência e observações';
  end if;
  return new;
end $$;

-- Pode reprogramar o cronograma do projeto: Direção, coordenação, gerência com projetos_editar ou cronograma_gerir
create or replace function public.gere_cronograma(p_projeto uuid)
returns boolean language sql stable set search_path = public as $$
  select public.gere_projeto(p_projeto) or public.tem_permissao('cronograma_gerir')
$$;

-- Registro de reprogramações (motivo, documento e o que mudou)
create or replace function public.tg_reprogramacao_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- quem registra é sempre o usuário logado (a Direção, ao restaurar um backup, mantém o autor original)
  if auth.uid() is not null and not (public.e_direcao() and new.criado_por is not null and new.autor is not null) then
    new.criado_por := auth.uid(); new.criado_em := now();
    new.autor := (select coalesce(p.nome, f.email) from public.perfis f left join public.pessoas p on p.id = f.pessoa_id where f.id = auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists cronograma_base on public.cronograma;
create trigger cronograma_base before insert or update on public.cronograma
  for each row execute function public.tg_cronograma_base();

create table if not exists public.reprogramacoes (
  id           uuid primary key default gen_random_uuid(),
  projeto_id   uuid not null references public.projetos(id) on delete cascade,
  data         date not null default public.hoje(),
  motivo       text not null check (length(trim(motivo)) >= 5),
  documento    text,                         -- ofício, e-mail ou aceite do financiador
  alteracoes   jsonb not null default '[]',  -- [{codigo, titulo, de: [ini, fim], para: [ini, fim]}]
  criado_em    timestamptz not null default now(),
  criado_por   uuid default auth.uid(),
  autor        text                          -- nome de quem registrou (gravado pelo banco)
);
create index if not exists reprogramacoes_projeto_id_data_idx on public.reprogramacoes (projeto_id, data desc);
drop trigger if exists reprogramacao_autor on public.reprogramacoes;
create trigger reprogramacao_autor before insert on public.reprogramacoes
  for each row execute function public.tg_reprogramacao_autor();
drop trigger if exists historico on public.reprogramacoes;
create trigger historico after insert or update or delete on public.reprogramacoes
  for each row execute function public.tg_historico();

drop policy if exists crono_editar on public.cronograma;
create policy crono_editar  on public.cronograma for update to authenticated
  using (public.gere_cronograma(projeto_id) or (public.pode_editar() and responsavel_id = public.minha_pessoa()));
alter table public.reprogramacoes enable row level security;
drop policy if exists repro_ver on public.reprogramacoes;
drop policy if exists repro_incluir on public.reprogramacoes;
drop policy if exists repro_apagar on public.reprogramacoes;
create policy repro_ver     on public.reprogramacoes for select to authenticated using (public.ve_projeto(projeto_id));
create policy repro_incluir on public.reprogramacoes for insert to authenticated with check (public.gere_cronograma(projeto_id));
create policy repro_apagar  on public.reprogramacoes for delete to authenticated using (public.e_direcao());

-- permissões pela API (só para os objetos novos — não reabre as colunas de valor)
grant select, insert, update, delete on public.reprogramacoes to authenticated, service_role;
revoke truncate, references, trigger on public.reprogramacoes from anon, authenticated;
revoke all on public.reprogramacoes from anon;
revoke execute on function public.tg_cronograma_base(), public.gere_cronograma(uuid), public.tg_reprogramacao_autor() from public, anon;
grant execute on function public.tg_cronograma_base(), public.gere_cronograma(uuid), public.tg_reprogramacao_autor() to authenticated, service_role;

-- atualização em tempo real também para o registro de reprogramações
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reprogramacoes') then
    execute 'alter publication supabase_realtime add table public.reprogramacoes';
  end if;
end $$;
