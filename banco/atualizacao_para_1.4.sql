-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.4 (a partir da 1.2 ou da 1.3)
--  • Perfil Suporte técnico (acesso irrestrito); lucas.scherer@ufsm.br passa a ser Suporte técnico
--  • Leitura: só os projetos de que participa e as próprias tarefas, sem valores
--    e sem dados pessoais de terceiros (visão v_pessoas)
--  • Vice-coordenação de projeto (mesmos poderes do coordenador)
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo
--  inteiro e clique em Run. Não apaga dados e pode ser executado mais de uma vez.
-- ════════════════════════════════════════════════════════════════════

-- 1. Novo papel e nova coluna
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check check (papel in ('suporte','direcao','membro','leitura'));
alter table public.alocacoes add column if not exists vice_coordena boolean not null default false;
do $$ begin
  alter table public.alocacoes add constraint alocacao_coord_ou_vice check (not (coordena and vice_coordena));
exception when duplicate_object then null; end $$;

-- 2. Suporte técnico (substitui a "Direção permanente" da versão 1.3)
drop trigger if exists direcao_fixa on public.perfis;
drop trigger if exists direcao_fixa_excluir on public.perfis;
drop function if exists public.tg_perfil_direcao_fixa();
drop function if exists public.emails_direcao_fixa();
drop trigger if exists perfil_protegido on public.perfis;
drop trigger if exists perfil_protegido_excluir on public.perfis;

-- Suporte técnico: estes logins são sempre "Suporte técnico" e ativos — acesso irrestrito,
-- igual ao da Direção. Garante que o sistema nunca fique sem ninguém capaz de administrar.
-- Só quem é Suporte técnico concede, altera ou remove esse perfil.
-- Para alterar a lista, edite o e-mail abaixo e execute este bloco no SQL Editor.
create or replace function public.emails_suporte_tecnico()
returns text[] language sql immutable set search_path = '' as $$
  select array['lucas.scherer@ufsm.br']::text[]
$$;

create or replace function public.tg_perfil_protegido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fixo boolean;
  quem text := (select p.papel from public.perfis p where p.id = auth.uid() and p.ativo);
begin
  if tg_op = 'DELETE' then
    -- a exclusão pela tela é bloqueada; se o próprio login for apagado no painel da Supabase, o perfil sai junto
    if old.papel = 'suporte' and exists (select 1 from auth.users u where u.id = old.id)
       and (lower(old.email) = any(public.emails_suporte_tecnico()) or (auth.uid() is not null and coalesce(quem, '') <> 'suporte')) then
      raise exception 'O acesso de % é do Suporte técnico e não pode ser removido por aqui.', old.email;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then new.email := old.email; end if;   -- o e-mail vem do login, não se edita aqui
  fixo := lower(new.email) = any(public.emails_suporte_tecnico());
  if fixo then
    new.papel := 'suporte';
    new.ativo := true;
    return new;
  end if;
  -- só o Suporte técnico concede ou retira o perfil de Suporte técnico
  if auth.uid() is not null and coalesce(quem, '') <> 'suporte'
     and (new.papel = 'suporte' or (tg_op = 'UPDATE' and old.papel = 'suporte' and (new.papel <> 'suporte' or new.ativo is distinct from old.ativo))) then
    raise exception 'Somente o Suporte técnico pode conceder ou alterar o perfil de Suporte técnico.';
  end if;
  return new;
end $$;
create trigger perfil_protegido before insert or update on public.perfis
  for each row execute function public.tg_perfil_protegido();
create trigger perfil_protegido_excluir before delete on public.perfis
  for each row execute function public.tg_perfil_protegido();

-- 3. Funções de permissão

create or replace function public.e_suporte()
returns boolean language sql stable as $$
  select coalesce(public.meu_papel() = 'suporte', false)
$$;

-- Direção e Suporte técnico têm acesso irrestrito
create or replace function public.e_direcao()
returns boolean language sql stable as $$
  select coalesce(public.meu_papel() in ('direcao','suporte'), false)
$$;

create or replace function public.pode_editar()
returns boolean language sql stable as $$
  select coalesce(public.meu_papel() in ('suporte','direcao','membro'), false)
$$;

-- Participa do projeto: alocação ativa ou pausada, ou vaga do plano de trabalho ocupada por ele
create or replace function public.participa(p_projeto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.minha_pessoa() is not null and (
    exists (select 1 from public.alocacoes a where a.projeto_id = p_projeto and a.pessoa_id = public.minha_pessoa() and a.status in ('ativo','pausado'))
    or exists (select 1 from public.equipe_plano e where e.projeto_id = p_projeto and e.pessoa_id = public.minha_pessoa()))
$$;

-- Vê o projeto: Suporte, Direção e Membros veem todos; Leitura só os projetos de que participa
create or replace function public.ve_projeto(p_projeto uuid)
returns boolean language sql stable as $$
  select public.pode_editar() or (public.tem_acesso() and public.participa(p_projeto))
$$;

-- Tarefa visível: para a Leitura, só as dos seus projetos e as atribuídas a ela
create or replace function public.tarefa_visivel(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() or (public.tem_acesso() and exists (
    select 1 from public.tarefas t where t.id = p_tarefa and (
      (t.projeto_id is not null and public.participa(t.projeto_id))
      or exists (select 1 from public.tarefa_responsaveis r where r.tarefa_id = t.id and r.pessoa_id = public.minha_pessoa()))))
$$;

-- Pessoa visível: para a Leitura, só ela mesma e quem aparece nos seus projetos e tarefas
create or replace function public.pessoa_visivel(p_pessoa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() or p_pessoa = public.minha_pessoa() or (public.tem_acesso() and (
       exists (select 1 from public.alocacoes a where a.pessoa_id = p_pessoa and public.participa(a.projeto_id))
    or exists (select 1 from public.equipe_plano e where e.pessoa_id = p_pessoa and public.participa(e.projeto_id))
    or exists (select 1 from public.cronograma c where c.responsavel_id = p_pessoa and public.participa(c.projeto_id))
    or exists (select 1 from public.entregas x where x.responsavel_id = p_pessoa and public.participa(x.projeto_id))
    or exists (select 1 from public.pendencias x where x.responsavel_id = p_pessoa and public.participa(x.projeto_id))
    or exists (select 1 from public.tarefa_responsaveis r where r.pessoa_id = p_pessoa and public.tarefa_visivel(r.tarefa_id))))
$$;


-- Coordena este projeto? (coordenador ou vice-coordenador: mesmos poderes)
create or replace function public.coordena(p_projeto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() and exists (
    select 1 from public.alocacoes a
     where a.projeto_id = p_projeto
       and a.pessoa_id  = public.minha_pessoa()
       and (a.coordena or a.vice_coordena))
$$;

-- É o coordenador titular do projeto?
create or replace function public.coordena_titular(p_projeto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() and exists (
    select 1 from public.alocacoes a
     where a.projeto_id = p_projeto and a.pessoa_id = public.minha_pessoa() and a.coordena)
$$;


-- Coordena (ou é vice de) algum projeto?
create or replace function public.coordena_algum()
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() and exists (
    select 1 from public.alocacoes a
     where a.pessoa_id = public.minha_pessoa() and (a.coordena or a.vice_coordena))
$$;


-- Só a Direção define coordenadores; a vice-coordenação pode ser definida
-- pela Direção ou pelo coordenador titular do projeto
create or replace function public.tg_protege_coordena()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.e_direcao() then return new; end if;
  if (tg_op = 'INSERT' and new.coordena)
     or (tg_op = 'UPDATE' and new.coordena is distinct from old.coordena) then
    raise exception 'Somente a Direção pode definir coordenadores de projeto';
  end if;
  if ((tg_op = 'INSERT' and new.vice_coordena)
      or (tg_op = 'UPDATE' and new.vice_coordena is distinct from old.vice_coordena))
     and not public.coordena_titular(new.projeto_id) then
    raise exception 'Somente a Direção ou o coordenador do projeto podem definir a vice-coordenação';
  end if;
  return new;
end $$;

-- 4. Quem vê o quê
drop policy if exists pessoas_ver on public.pessoas;
create policy pessoas_ver on public.pessoas for select to authenticated using (public.pode_editar() or id = public.minha_pessoa());
drop policy if exists projetos_ver on public.projetos;
create policy projetos_ver on public.projetos for select to authenticated using (public.ve_projeto(id));
drop policy if exists alocacoes_ver on public.alocacoes;
create policy alocacoes_ver on public.alocacoes for select to authenticated using (public.ve_projeto(projeto_id));
drop policy if exists aditivos_ver on public.aditivos;
create policy aditivos_ver on public.aditivos for select to authenticated using (public.ve_projeto(projeto_id));
drop policy if exists documentos_ver on public.documentos;
create policy documentos_ver on public.documentos for select to authenticated using (public.ve_projeto(projeto_id) and (not restrito or public.ve_financeiro(projeto_id) or public.gere_projeto(projeto_id)));
drop policy if exists pendencias_ver on public.pendencias;
create policy pendencias_ver on public.pendencias for select to authenticated using (public.ve_projeto(projeto_id));
drop policy if exists entregas_ver on public.entregas;
create policy entregas_ver on public.entregas for select to authenticated using (public.ve_projeto(projeto_id));
drop policy if exists crono_ver on public.cronograma;
create policy crono_ver on public.cronograma for select to authenticated using (public.ve_projeto(projeto_id));
drop policy if exists equipe_plano_ver on public.equipe_plano;
create policy equipe_plano_ver on public.equipe_plano for select to authenticated using (public.ve_projeto(projeto_id));
drop policy if exists tarefas_ver on public.tarefas;
create policy tarefas_ver on public.tarefas for select to authenticated using (public.tarefa_visivel(id));
drop policy if exists resp_ver on public.tarefa_responsaveis;
create policy resp_ver on public.tarefa_responsaveis for select to authenticated using (public.pode_editar() or pessoa_id = public.minha_pessoa() or public.tarefa_visivel(tarefa_id));
drop policy if exists prosp_ver on public.prospeccoes;
create policy prosp_ver on public.prospeccoes for select to authenticated using (public.pode_editar());
drop policy if exists aval_ver on public.avaliacoes;
create policy aval_ver on public.avaliacoes for select to authenticated using (public.pode_editar());
drop policy if exists infra_itens_ver on public.infra_itens;
create policy infra_itens_ver on public.infra_itens for select to authenticated using (public.pode_editar());
drop policy if exists infra_hab_ver on public.infra_habilitacoes;
create policy infra_hab_ver on public.infra_habilitacoes for select to authenticated using (public.pode_editar());
drop policy if exists infra_res_ver on public.infra_reservas;
create policy infra_res_ver on public.infra_reservas for select to authenticated using (public.pode_editar());
drop policy if exists infra_man_ver on public.infra_manutencoes;
create policy infra_man_ver on public.infra_manutencoes for select to authenticated using (public.pode_editar());

-- 5. Cadastro de pessoas lido pelo programa

-- Cadastro de pessoas como o programa lê: para a Leitura, só as pessoas dos seus
-- projetos, e sem dados pessoais (e-mail, Lattes, curso, semestre, ingresso, saída,
-- resumo e observações) — exceto o próprio cadastro. Os demais perfis veem tudo.
create or replace view public.v_pessoas with (security_barrier = true) as
select p.id, p.nome,
       case when x.completo then p.email end as email,
       p.tipo, p.funcao,
       case when x.completo then p.curso end as curso,
       case when x.completo then p.semestre end as semestre,
       p.foco, p.formacao,
       case when x.completo then p.lattes end as lattes,
       case when x.completo then p.ingresso end as ingresso,
       case when x.completo then p.saida end as saida,
       p.habilidades,
       case when x.completo then p.resumo end as resumo,
       p.disponibilidade_pct, p.perfil_disponibilidade,
       case when x.completo then p.obs_disponibilidade end as obs_disponibilidade,
       case when x.completo then p.risco_sobrecarga else false end as risco_sobrecarga,
       p.ordem, p.ativo, p.criado_em, p.atualizado_em, p.atualizado_por
  from public.pessoas p
 cross join lateral (select public.pode_editar() or p.id = public.minha_pessoa() as completo) x
 where public.pessoa_visivel(p.id);

-- 6. Permissões da API
revoke all on public.v_pessoas from anon;
grant select on public.v_pessoas to authenticated, service_role;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- 7. Aplica agora ao perfil que já existe
update public.perfis set papel = 'suporte', ativo = true
 where lower(email) = any(public.emails_suporte_tecnico());
