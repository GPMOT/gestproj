-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.10 (a partir da 1.9)
--  • Meta semanal de horas por pessoa (cadastro), usada no relatório semanal das atividades
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo inteiro e clique
--  em Run. Não apaga dados. Use o programa 2.32 ou mais novo.
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if to_regclass('public.tarefa_relatos') is null then
    raise exception 'Este banco não está na versão 1.9. Execute antes o arquivo atualizacao_para_1.9.sql.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pessoas' and column_name = 'meta_horas_semana') then
    raise exception 'Este banco já está na versão 1.10.';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 18. Meta semanal de horas (v1.10)
--     Horas por semana esperadas de cada pessoa nas atividades (relatório semanal).
--     Sem meta no cadastro, o programa usa as horas semanais das posições que a pessoa ocupa
--     na equipe do plano de trabalho. Definem: Direção, gerência com pessoas_gerir e coordenação.
-- ────────────────────────────────────────────────────────────────────
alter table public.pessoas add column meta_horas_semana numeric(4,1)
  check (meta_horas_semana is null or (meta_horas_semana >= 0 and meta_horas_semana <= 60));

create or replace function public.tg_protege_pessoa()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.e_direcao() or public.tem_permissao('pessoas_gerir') then
    return new;
  end if;
  if new.email is distinct from old.email then
    raise exception 'O e-mail do cadastro só pode ser alterado pela Direção ou pela gerência que gere pessoas (ele liga o cadastro ao login)';
  end if;
  if public.gere_pessoa(new.id) then return new; end if;
  if new.tipo is distinct from old.tipo or new.funcao is distinct from old.funcao
     or new.ativo is distinct from old.ativo
     or new.risco_sobrecarga is distinct from old.risco_sobrecarga
     or new.ordem is distinct from old.ordem or new.saida is distinct from old.saida
     or new.meta_horas_semana is distinct from old.meta_horas_semana then
    raise exception 'Este campo só pode ser alterado pela Direção, Gerência Técnica ou Coordenação';
  end if;
  return new;
end $$;

-- a visão das pessoas (Leitura) passa a trazer a meta semanal (coluna nova, no fim)
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
       p.ordem, p.ativo, p.criado_em, p.atualizado_em, p.atualizado_por,
       p.meta_horas_semana
  from public.pessoas p
 cross join lateral (select public.pode_editar() or p.id = public.minha_pessoa() as completo) x
 where public.pessoa_visivel(p.id);
