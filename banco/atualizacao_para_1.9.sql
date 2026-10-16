-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.9 (a partir da 1.8)
--  • Atividades com acompanhamento: tarefas ganham solicitante, situação (a fazer, em andamento,
--    entregue, aprovada, devolvida), relatos de horas e entrega com aprovação do solicitante
--  • Alunos (perfil Leitura) registram as próprias atividades, reportam o andamento e entregam
--  • Tarefas sem projeto nem gerência passam a ser permitidas
--  • Nova permissão de gerência "atividades_acompanhar" (relatório semanal), dada à Gerência Técnica
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo inteiro e clique
--  em Run. Não apaga dados. Use o programa 2.31 ou mais novo.
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if not exists (select 1 from public.rubricas where codigo = '1.6') then
    raise exception 'Este banco não está na versão 1.8. Execute antes o arquivo atualizacao_para_1.8.sql.';
  end if;
  if to_regclass('public.tarefa_relatos') is not null then
    raise exception 'Este banco já está na versão 1.9.';
  end if;
end $$;

alter table public.gerencias drop constraint if exists permissoes_validas;
alter table public.gerencias add constraint permissoes_validas check (permissoes <@ array[
    'projetos_criar','projetos_editar','alocacoes_gerir','tarefas_gerir','pessoas_gerir',
    'financeiro_ver','financeiro_editar','prospeccao_gerir','historico_ver',
    'infraestrutura_gerir','cronograma_gerir','financeiro_reformular','atividades_acompanhar']::text[]);
update public.gerencias set permissoes = permissoes || array['atividades_acompanhar']
 where nome = 'Gerência Técnica' and not ('atividades_acompanhar' = any(permissoes));

-- ────────────────────────────────────────────────────────────────────
-- 17. Atividades com acompanhamento (v1.9)
--     Tarefas com solicitante, prazo por semana, relatos de horas e entrega com aprovação.
--     Alunos (perfil Leitura) recebem atividades de Membros ou registram as suas, reportam o
--     andamento (horas + descrição) e entregam; o solicitante aprova ou devolve.
--     Tarefas sem solicitante continuam como antes (marcar como concluída).
-- ────────────────────────────────────────────────────────────────────
alter table public.tarefas drop constraint if exists tem_destino;   -- projeto e gerência passam a ser opcionais
alter table public.tarefas add column solicitante_id uuid references public.pessoas(id) on delete set null;
alter table public.tarefas add column situacao text not null default 'a_fazer'
  check (situacao in ('a_fazer','em_andamento','entregue','aprovada','devolvida'));
alter table public.tarefas add column entregue_em timestamptz;
alter table public.tarefas add column avaliada_em timestamptz;
alter table public.tarefas add column avaliada_por uuid;
alter table public.tarefas add column parecer text;
create index on public.tarefas (solicitante_id);
update public.tarefas set situacao = 'aprovada' where concluida and situacao <> 'aprovada';

create table public.tarefa_relatos (
  id          uuid primary key default gen_random_uuid(),
  tarefa_id   uuid not null references public.tarefas(id) on delete cascade,
  pessoa_id   uuid references public.pessoas(id) on delete set null,   -- quem trabalhou (gravado pelo banco)
  tipo        text not null default 'relato' check (tipo in ('relato','entrega')),
  data        date not null default public.hoje(),
  horas       numeric(5,2) not null check (horas > 0 and horas <= 80),
  descricao   text not null check (length(btrim(descricao)) > 0),
  criado_em   timestamptz not null default now(),
  criado_por  uuid default auth.uid()
);
create index on public.tarefa_relatos (tarefa_id);
create index on public.tarefa_relatos (pessoa_id, data);

-- é responsável pela tarefa?
create or replace function public.responsavel_tarefa(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.minha_pessoa() is not null and exists (
    select 1 from public.tarefa_responsaveis r where r.tarefa_id = p_tarefa and r.pessoa_id = public.minha_pessoa())
$$;
-- pessoas que podem ser solicitantes (perfil ativo de Direção, Membro ou Suporte), para a Leitura escolher
create or replace function public.pessoas_solicitantes()
returns table (id uuid, nome text) language sql stable security definer set search_path = public as $$
  select p.id, p.nome from public.pessoas p
   where public.tem_acesso() and p.ativo and exists (
     select 1 from public.perfis f where f.pessoa_id = p.id and f.ativo and f.papel in ('suporte','direcao','membro'))
   order by p.nome
$$;

-- fluxo: a fazer → em andamento (1º relato) → entregue (responsável) → aprovada | devolvida (solicitante)
create or replace function public.tg_tarefa_fluxo()
returns trigger language plpgsql security definer set search_path = public as $$
declare eu uuid := public.minha_pessoa(); gestor boolean; resp boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.pode_editar() then   -- Leitura registrando a própria atividade
      if new.solicitante_id is null then raise exception 'Informe o solicitante da atividade.'; end if;
      if new.solicitante_id = eu then raise exception 'O solicitante deve ser outra pessoa (quem vai conferir a entrega).'; end if;
      if not exists (select 1 from public.perfis f where f.pessoa_id = new.solicitante_id and f.ativo and f.papel in ('suporte','direcao','membro')) then
        raise exception 'O solicitante deve ser um membro do laboratório com acesso ao programa.'; end if;
      if new.gerencia_id is not null then raise exception 'Atividades registradas por alunos não pertencem a gerências.'; end if;
      new.situacao := 'a_fazer'; new.concluida := false; new.criado_por := auth.uid();
    end if;
    if new.solicitante_id is null then new.situacao := case when new.concluida then 'aprovada' else 'a_fazer' end;
    else new.concluida := new.situacao = 'aprovada'; end if;
    return new;
  end if;
  -- UPDATE
  if new.solicitante_id is null then   -- tarefa simples: só marca como concluída
    if new.concluida is distinct from old.concluida then new.situacao := case when new.concluida then 'aprovada' else 'a_fazer' end;
    elsif new.situacao is distinct from old.situacao then new.concluida := new.situacao = 'aprovada'; end if;
    return new;
  end if;
  if auth.uid() is null then new.concluida := new.situacao = 'aprovada'; return new; end if;   -- manutenção pelo painel
  gestor := public.e_direcao() or public.gere_tarefas(old.projeto_id) or (old.gerencia_id is not null and public.gerencia(old.gerencia_id))
            or (public.pode_editar() and old.criado_por = auth.uid());
  resp := public.responsavel_tarefa(old.id);
  -- "concluída" segue a situação (aprovada); não se marca à mão numa atividade com solicitante
  if new.concluida is distinct from old.concluida and new.situacao is not distinct from old.situacao then
    raise exception 'Atividade com solicitante: use Entregar (responsável) e Aprovar (solicitante).'; end if;
  if new.situacao is distinct from old.situacao then
    if new.situacao in ('aprovada','devolvida') then
      if old.situacao <> 'entregue' then raise exception 'Só uma atividade entregue pode ser aprovada ou devolvida.'; end if;
      if not (eu is not null and eu = old.solicitante_id) and not public.e_direcao() then
        raise exception 'Só o solicitante (ou a Direção) aprova ou devolve a atividade.'; end if;
      if new.situacao = 'devolvida' and coalesce(btrim(new.parecer), '') = '' then raise exception 'Ao devolver, explique o que falta no parecer.'; end if;
      new.avaliada_em := now(); new.avaliada_por := auth.uid();
    elsif new.situacao = 'entregue' then
      if not (resp or gestor) then raise exception 'Só o responsável entrega a atividade.'; end if;
      if old.situacao in ('entregue','aprovada') then raise exception 'Esta atividade já foi entregue.'; end if;
      if not exists (select 1 from public.tarefa_relatos r where r.tarefa_id = old.id and r.tipo = 'entrega') then
        raise exception 'Para entregar, informe as horas e a descrição do que foi realizado.'; end if;
      new.entregue_em := now();
    elsif new.situacao in ('a_fazer','em_andamento') then
      if old.situacao = 'aprovada' and not (public.e_direcao() or (eu is not null and eu = old.solicitante_id)) then
        raise exception 'Só o solicitante (ou a Direção) reabre uma atividade aprovada.'; end if;
      if old.situacao = 'entregue' and not (gestor or resp or (eu is not null and eu = old.solicitante_id)) then
        raise exception 'Sem permissão para reabrir esta atividade.'; end if;
    end if;
  end if;
  -- quem só é responsável (não gestor nem solicitante) não muda solicitante, título, prazo nem destino;
  -- na atividade que ele mesmo registrou, pode ajustar enquanto não entregou
  if not gestor and not public.e_direcao() and not (eu is not null and eu = old.solicitante_id)
     and not (old.criado_por = auth.uid() and old.situacao in ('a_fazer','em_andamento','devolvida')) then
    if new.solicitante_id is distinct from old.solicitante_id or new.titulo is distinct from old.titulo or new.descricao is distinct from old.descricao
       or new.prazo is distinct from old.prazo or new.inicio is distinct from old.inicio or new.projeto_id is distinct from old.projeto_id
       or new.gerencia_id is distinct from old.gerencia_id or new.prioridade is distinct from old.prioridade then
      raise exception 'O responsável não altera solicitante, descrição, prazo nem projeto da atividade: peça ao solicitante.'; end if;
  end if;
  if new.solicitante_id is distinct from old.solicitante_id and new.solicitante_id = eu and not public.pode_editar() then
    raise exception 'O solicitante deve ser outra pessoa (quem vai conferir a entrega).'; end if;
  if new.avaliada_por is distinct from old.avaliada_por and new.situacao is not distinct from old.situacao then new.avaliada_por := old.avaliada_por; end if;
  new.concluida := new.situacao = 'aprovada';
  return new;
end $$;
create trigger fluxo before insert or update on public.tarefas
  for each row execute function public.tg_tarefa_fluxo();
-- a data de conclusão acompanha a situação (mudada pelo fluxo, não só pela coluna "concluida")
drop trigger if exists marca_conclusao on public.tarefas;
create trigger marca_conclusao before insert or update on public.tarefas
  for each row execute function public.tg_tarefa_concluida();

-- relatos: autor gravado pelo banco; só o responsável relata, e não depois de entregue/aprovada
create or replace function public.tg_relato()
returns trigger language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if tg_op = 'DELETE' then
    select situacao into s from public.tarefas where id = old.tarefa_id;
    if auth.uid() is not null and s in ('entregue','aprovada') and not public.e_direcao() then
      raise exception 'Relatos de atividade entregue não podem ser apagados.'; end if;
    return old;
  end if;
  select situacao into s from public.tarefas where id = new.tarefa_id;
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if not public.e_direcao() or new.pessoa_id is null then   -- a Direção, ao restaurar um backup, mantém autor e data originais
        new.pessoa_id := public.minha_pessoa(); new.criado_por := auth.uid(); new.criado_em := now(); end if;
    else new.pessoa_id := old.pessoa_id; new.criado_por := old.criado_por; new.criado_em := old.criado_em; new.tarefa_id := old.tarefa_id; end if;
    if s in ('entregue','aprovada') and not public.e_direcao() then
      raise exception 'A atividade já foi entregue: não recebe novos relatos (o solicitante pode devolvê-la).'; end if;
  end if;
  return new;
end $$;
create trigger relato before insert or update or delete on public.tarefa_relatos
  for each row execute function public.tg_relato();
-- o 1º relato (ou um relato depois de devolvida) põe a atividade em andamento
create or replace function public.tg_relato_andamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.criado_em < now() - interval '10 minutes' then return new; end if;   -- relato antigo (restauração de backup): não mexe na situação
  update public.tarefas set situacao = 'em_andamento'
   where id = new.tarefa_id and solicitante_id is not null and situacao in ('a_fazer','devolvida');
  return new;
end $$;
create trigger relato_andamento after insert on public.tarefa_relatos
  for each row execute function public.tg_relato_andamento();

-- visibilidade: também as atividades que a pessoa registrou ou solicitou
create or replace function public.tarefa_visivel(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() or (public.tem_acesso() and exists (
    select 1 from public.tarefas t where t.id = p_tarefa and (
      (t.projeto_id is not null and public.participa(t.projeto_id))
      or t.criado_por = auth.uid()
      or (t.solicitante_id is not null and t.solicitante_id = public.minha_pessoa())
      or exists (select 1 from public.tarefa_responsaveis r where r.tarefa_id = t.id and r.pessoa_id = public.minha_pessoa()))))
$$;
-- a Leitura vê o nome de quem solicita as suas atividades
create or replace function public.pessoa_visivel(p_pessoa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_editar() or p_pessoa = public.minha_pessoa() or (public.tem_acesso() and (
       exists (select 1 from public.alocacoes a where a.pessoa_id = p_pessoa and public.participa(a.projeto_id))
    or exists (select 1 from public.equipe_plano e where e.pessoa_id = p_pessoa and public.participa(e.projeto_id))
    or exists (select 1 from public.cronograma c where c.responsavel_id = p_pessoa and public.participa(c.projeto_id))
    or exists (select 1 from public.entregas x where x.responsavel_id = p_pessoa and public.participa(x.projeto_id))
    or exists (select 1 from public.pendencias x where x.responsavel_id = p_pessoa and public.participa(x.projeto_id))
    or exists (select 1 from public.tarefa_responsaveis r where r.pessoa_id = p_pessoa and public.tarefa_visivel(r.tarefa_id))
    or exists (select 1 from public.tarefas t where t.solicitante_id = p_pessoa and public.tarefa_visivel(t.id))))
$$;

-- leitura da tarefa pelas colunas da própria linha (vale também no INSERT … RETURNING, quando a linha ainda não está gravada)
drop policy if exists tarefas_ver on public.tarefas;
create policy tarefas_ver on public.tarefas for select to authenticated
  using (public.pode_editar() or (public.tem_acesso() and (
    criado_por = auth.uid()
    or (solicitante_id is not null and solicitante_id = public.minha_pessoa())
    or (projeto_id is not null and public.participa(projeto_id))
    or public.responsavel_tarefa(id))));
-- tarefas: a Leitura registra as próprias atividades (com solicitante), atualiza as suas e apaga as que ainda não começou
drop policy if exists tarefas_incluir on public.tarefas;
create policy tarefas_incluir on public.tarefas for insert to authenticated
  with check (
    ((gerencia_id is null or public.gerencia(gerencia_id)) and
     (projeto_id is null or public.gere_tarefas(projeto_id) or public.gerencia(gerencia_id)
       or (public.pode_editar() and exists (
             select 1 from public.alocacoes a
              where a.projeto_id = tarefas.projeto_id and a.pessoa_id = public.minha_pessoa())))
     and (projeto_id is not null or gerencia_id is not null or public.pode_editar()))
    or (public.tem_acesso() and not public.pode_editar() and public.minha_pessoa() is not null
        and solicitante_id is not null and gerencia_id is null and (projeto_id is null or public.participa(projeto_id))));
drop policy if exists tarefas_editar on public.tarefas;
create policy tarefas_editar on public.tarefas for update to authenticated
  using (public.e_direcao() or public.gere_tarefas(projeto_id)
    or (gerencia_id is not null and public.gerencia(gerencia_id))
    or (public.pode_editar() and (criado_por = auth.uid() or public.responsavel_tarefa(id)))
    or (solicitante_id is not null and solicitante_id = public.minha_pessoa())
    or (public.tem_acesso() and (criado_por = auth.uid() or public.responsavel_tarefa(id))));
drop policy if exists tarefas_apagar on public.tarefas;
create policy tarefas_apagar on public.tarefas for delete to authenticated
  using (public.e_direcao() or public.gere_tarefas(projeto_id)
    or (gerencia_id is not null and public.gerencia(gerencia_id))
    or (public.pode_editar() and criado_por = auth.uid())
    or (public.tem_acesso() and criado_por = auth.uid() and situacao = 'a_fazer'
        and not exists (select 1 from public.tarefa_relatos r where r.tarefa_id = tarefas.id)));
-- quem gere a tarefa (responsáveis): também a Direção, inclusive nas tarefas sem projeto nem gerência
create or replace function public.gere_tarefa(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tarefas t where t.id = p_tarefa
    and (public.e_direcao() or public.gere_tarefas(t.projeto_id)
         or (t.gerencia_id is not null and public.gerencia(t.gerencia_id))
         or (public.pode_editar() and t.criado_por = auth.uid())))
$$;
-- responsáveis: além de quem gere a tarefa, quem a registrou pode se colocar (ou se tirar) como responsável
create policy resp_proprio on public.tarefa_responsaveis for all to authenticated
  using (pessoa_id = public.minha_pessoa() and exists (select 1 from public.tarefas t where t.id = tarefa_id and t.criado_por = auth.uid()))
  with check (pessoa_id = public.minha_pessoa() and exists (select 1 from public.tarefas t where t.id = tarefa_id and t.criado_por = auth.uid()));

alter table public.tarefa_relatos enable row level security;
create policy relatos_ver     on public.tarefa_relatos for select to authenticated using (public.tarefa_visivel(tarefa_id));
create policy relatos_incluir on public.tarefa_relatos for insert to authenticated with check (public.responsavel_tarefa(tarefa_id) or public.e_direcao());
create policy relatos_editar  on public.tarefa_relatos for update to authenticated
  using (criado_por = auth.uid() or public.e_direcao()) with check (criado_por = auth.uid() or public.e_direcao());
create policy relatos_apagar  on public.tarefa_relatos for delete to authenticated using (criado_por = auth.uid() or public.e_direcao());

grant select, insert, update, delete on public.tarefa_relatos to authenticated, service_role;
revoke truncate, references, trigger on public.tarefa_relatos from anon, authenticated;
revoke all on public.tarefa_relatos from anon;
revoke execute on function public.responsavel_tarefa(uuid), public.pessoas_solicitantes(), public.tg_tarefa_fluxo(), public.tg_relato(), public.tg_relato_andamento() from public, anon;
grant execute on function public.responsavel_tarefa(uuid), public.pessoas_solicitantes(), public.tg_tarefa_fluxo(), public.tg_relato(), public.tg_relato_andamento() to authenticated, service_role;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tarefa_relatos') then
    execute 'alter publication supabase_realtime add table public.tarefa_relatos';
  end if;
end $$;
