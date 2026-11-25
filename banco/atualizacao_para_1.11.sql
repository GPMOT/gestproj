-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.11 (a partir da 1.10)
--  • Atividades podem ser canceladas (com motivo) pelo solicitante ou por quem as registrou
--  • A gestão das atividades (Direção e gerências com tarefas_gerir ou atividades_acompanhar)
--    edita, cancela e apaga atividades e relatos, inclusive os já entregues ou aprovados
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo inteiro e clique
--  em Run. Não apaga dados. Use o programa 2.33 ou mais novo.
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pessoas' and column_name = 'meta_horas_semana') then
    raise exception 'Este banco não está na versão 1.10. Execute antes o arquivo atualizacao_para_1.10.sql.';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 19. Cancelamento e exclusão de atividades (v1.11)
--     O solicitante ou quem registrou a atividade a edita e cancela (com motivo); a gestão das
--     atividades (Direção e gerências com tarefas_gerir ou atividades_acompanhar) também edita,
--     cancela e apaga atividades e relatos, inclusive as já entregues ou aprovadas.
-- ────────────────────────────────────────────────────────────────────
alter table public.tarefas drop constraint if exists tarefas_situacao_check;
alter table public.tarefas add constraint tarefas_situacao_check
  check (situacao in ('a_fazer','em_andamento','entregue','aprovada','devolvida','cancelada'));

-- gere as atividades de todo o laboratório
create or replace function public.gere_atividades()
returns boolean language sql stable set search_path = public as $$
  select public.e_direcao() or public.tem_permissao('tarefas_gerir') or public.tem_permissao('atividades_acompanhar')
$$;

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
    else new.concluida := new.situacao in ('aprovada','cancelada'); end if;
    return new;
  end if;
  -- UPDATE
  if new.solicitante_id is null then   -- tarefa simples: só marca como concluída
    if new.concluida is distinct from old.concluida then new.situacao := case when new.concluida then 'aprovada' else 'a_fazer' end;
    elsif new.situacao is distinct from old.situacao then new.concluida := new.situacao = 'aprovada'; end if;
    return new;
  end if;
  if auth.uid() is null then new.concluida := new.situacao in ('aprovada','cancelada'); return new; end if;   -- manutenção pelo painel
  gestor := public.e_direcao() or public.gere_tarefas(old.projeto_id) or (old.gerencia_id is not null and public.gerencia(old.gerencia_id))
            or (public.pode_editar() and old.criado_por = auth.uid()) or public.gere_atividades();
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
    elsif new.situacao = 'cancelada' then
      if old.situacao = 'aprovada' then raise exception 'Atividade aprovada não pode ser cancelada (reabra-a antes).'; end if;
      if not (gestor or (eu is not null and eu = old.solicitante_id) or old.criado_por = auth.uid()) then
        raise exception 'Só o solicitante, quem registrou a atividade ou quem gere as atividades pode cancelá-la.'; end if;
      if coalesce(btrim(new.parecer), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
      new.avaliada_em := now(); new.avaliada_por := auth.uid();
    elsif new.situacao in ('a_fazer','em_andamento') then
      if old.situacao = 'cancelada' and not (gestor or (eu is not null and eu = old.solicitante_id) or old.criado_por = auth.uid()) then
        raise exception 'Só o solicitante, quem registrou a atividade ou quem gere as atividades pode reativá-la.'; end if;
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
  new.concluida := new.situacao in ('aprovada','cancelada');
  return new;
end $$;

create or replace function public.tg_relato()
returns trigger language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if tg_op = 'DELETE' then
    select situacao into s from public.tarefas where id = old.tarefa_id;
    if auth.uid() is not null and s in ('entregue','aprovada') and not public.gere_atividades() then
      raise exception 'Relatos de atividade entregue não podem ser apagados.'; end if;
    return old;
  end if;
  select situacao into s from public.tarefas where id = new.tarefa_id;
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if not public.e_direcao() or new.pessoa_id is null then   -- a Direção, ao restaurar um backup, mantém autor e data originais
        new.pessoa_id := public.minha_pessoa(); new.criado_por := auth.uid(); new.criado_em := now(); end if;
    else new.pessoa_id := old.pessoa_id; new.criado_por := old.criado_por; new.criado_em := old.criado_em; new.tarefa_id := old.tarefa_id; end if;
    if s = 'cancelada' and not public.e_direcao() then raise exception 'A atividade foi cancelada: não recebe relatos.'; end if;
    if s in ('entregue','aprovada') and not public.e_direcao() then
      raise exception 'A atividade já foi entregue: não recebe novos relatos (o solicitante pode devolvê-la).'; end if;
  end if;
  return new;
end $$;

-- quem gere a tarefa (responsáveis): também o solicitante (membro) e a gestão das atividades
create or replace function public.gere_tarefa(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tarefas t where t.id = p_tarefa
    and (public.e_direcao() or public.gere_atividades() or public.gere_tarefas(t.projeto_id)
         or (t.gerencia_id is not null and public.gerencia(t.gerencia_id))
         or (public.pode_editar() and (t.criado_por = auth.uid() or (t.solicitante_id is not null and t.solicitante_id = public.minha_pessoa())))))
$$;

drop policy if exists tarefas_editar on public.tarefas;
create policy tarefas_editar on public.tarefas for update to authenticated
  using (public.e_direcao() or public.gere_atividades() or public.gere_tarefas(projeto_id)
    or (gerencia_id is not null and public.gerencia(gerencia_id))
    or (public.pode_editar() and (criado_por = auth.uid() or public.responsavel_tarefa(id)))
    or (solicitante_id is not null and solicitante_id = public.minha_pessoa())
    or (public.tem_acesso() and (criado_por = auth.uid() or public.responsavel_tarefa(id))));
drop policy if exists tarefas_apagar on public.tarefas;
create policy tarefas_apagar on public.tarefas for delete to authenticated
  using (public.e_direcao() or public.gere_atividades() or public.gere_tarefas(projeto_id)
    or (gerencia_id is not null and public.gerencia(gerencia_id))
    or (public.pode_editar() and criado_por = auth.uid())
    or (public.tem_acesso() and criado_por = auth.uid() and situacao = 'a_fazer'
        and not exists (select 1 from public.tarefa_relatos r where r.tarefa_id = tarefas.id)));
drop policy if exists relatos_editar on public.tarefa_relatos;
create policy relatos_editar  on public.tarefa_relatos for update to authenticated
  using (criado_por = auth.uid() or public.gere_atividades()) with check (criado_por = auth.uid() or public.gere_atividades());
drop policy if exists relatos_apagar on public.tarefa_relatos;
create policy relatos_apagar  on public.tarefa_relatos for delete to authenticated using (criado_por = auth.uid() or public.gere_atividades());

revoke execute on function public.gere_atividades() from public, anon;
grant execute on function public.gere_atividades() to authenticated, service_role;
