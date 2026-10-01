-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.5 (a partir da 1.4)
--  Proteções de segurança:
--  • valores de projetos e aditivos fechados no banco para Membro sem cargo e Leitura
--    (o programa passa a ler pelas visões v_projetos_tela e v_aditivos_tela)
--  • coordenação e vice não podem ser trocadas nem retiradas por quem não as define
--  • e-mail do cadastro de pessoas só muda pela Direção ou gerência que gere pessoas;
--    coordenação edita só as pessoas dos seus projetos
--  • login novo não "herda" um cadastro que já tem login
--  • links (documentos e Lattes) só http/https
--  • envio de backup com valores só pela Direção / Suporte técnico
--  • gancho opcional para aceitar novos logins só de quem está cadastrado em Pessoas
--  • permissões da API endurecidas (sem TRUNCATE, nada para quem não fez login,
--    funções com caminho de busca fixo)
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo
--  inteiro e clique em Run. Não apaga dados e pode ser executado mais de uma vez.
--  IMPORTANTE: depois de executar, use o programa versão 2.25 ou mais nova
--  (as versões anteriores não conseguem mais ler os projetos).
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if to_regprocedure('public.e_suporte()') is null then
    raise exception 'Este banco não está na versão 1.4. Execute antes o arquivo atualizacao_para_1.4.sql.';
  end if;
end $$;

-- Novo login → cria perfil inativo e liga à pessoa de mesmo e-mail
-- (só se esse cadastro ainda não tiver login: um e-mail trocado no cadastro não "herda" o acesso de ninguém)
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email, pessoa_id)
  values (new.id, lower(new.email),
          (select p.id from public.pessoas p
            where lower(p.email) = lower(new.email)
              and not exists (select 1 from public.perfis f where f.pessoa_id = p.id)
            limit 1))
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.tg_aditivo_antes()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- Só a Direção define, troca ou retira coordenadores; a vice-coordenação pode ser definida,
-- trocada ou retirada pela Direção ou pelo coordenador titular do projeto.
-- (Trocar a pessoa ou o projeto de uma alocação de coordenação também conta como definir.)
create or replace function public.tg_protege_coordena()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.e_direcao() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.coordena then
      raise exception 'Somente a Direção pode retirar o coordenador do projeto';
    end if;
    if old.vice_coordena and not public.coordena_titular(old.projeto_id) then
      raise exception 'Somente a Direção ou o coordenador do projeto podem retirar a vice-coordenação';
    end if;
    return old;
  end if;
  if (tg_op = 'INSERT' and new.coordena)
     or (tg_op = 'UPDATE' and (new.coordena is distinct from old.coordena
         or (old.coordena and (new.pessoa_id is distinct from old.pessoa_id or new.projeto_id is distinct from old.projeto_id)))) then
    raise exception 'Somente a Direção pode definir coordenadores de projeto';
  end if;
  if ((tg_op = 'INSERT' and new.vice_coordena)
      or (tg_op = 'UPDATE' and (new.vice_coordena is distinct from old.vice_coordena
          or (old.vice_coordena and (new.pessoa_id is distinct from old.pessoa_id or new.projeto_id is distinct from old.projeto_id)))))
     and not (public.coordena_titular(new.projeto_id) and (tg_op = 'INSERT' or public.coordena_titular(old.projeto_id))) then
    raise exception 'Somente a Direção ou o coordenador do projeto podem definir a vice-coordenação';
  end if;
  return new;
end $$;
drop trigger if exists protege_coordena on public.alocacoes;
create trigger protege_coordena before insert or update or delete on public.alocacoes
  for each row execute function public.tg_protege_coordena();

-- Cadastro de pessoas: Direção e gerência com pessoas_gerir alteram tudo; a coordenação altera
-- as pessoas dos seus projetos, menos o e-mail (ele liga o cadastro ao login); os demais só
-- alteram campos de trabalho no próprio cadastro
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
     or new.ordem is distinct from old.ordem or new.saida is distinct from old.saida then
    raise exception 'Este campo só pode ser alterado pela Direção, Gerência Técnica ou Coordenação';
  end if;
  return new;
end $$;

drop policy if exists pessoas_editar on public.pessoas;
create policy pessoas_editar  on public.pessoas for update to authenticated
  using (public.gere_pessoa(id) or (public.pode_editar() and id = public.minha_pessoa()));

-- ────────────────────────────────────────────────────────────────────
-- 15. Proteções adicionais (v1.5)
-- ────────────────────────────────────────────────────────────────────
-- 15a. Valores dos projetos e aditivos: só quem tem cargo os lê pelo banco
--      (Direção, Suporte técnico, gerentes em exercício, coordenação e vice).
--      Para Membro sem cargo e Leitura o banco devolve esses campos vazios,
--      mesmo para quem tente consultar a API diretamente, fora do programa.
create or replace function public.ve_valores()
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_direcao() or (public.pode_editar() and (public.coordena_algum() or exists (
    select 1 from public.gerencia_membros gm
      join public.gerencias g on g.id = gm.gerencia_id and g.ativa
     where gm.pessoa_id = public.minha_pessoa()
       and gm.desde <= public.hoje()
       and (gm.ate is null or gm.ate >= public.hoje()))))
$$;

create or replace function public.valores_projeto(p_id uuid, out valor_total numeric, out contrapartida numeric)
language sql stable security definer set search_path = public as $$
  select p.valor_total, p.contrapartida from public.projetos p
   where p.id = p_id and public.ve_valores() and public.ve_projeto(p_id)
$$;

create or replace function public.valores_aditivo(p_id uuid, out valor_anterior numeric, out novo_valor numeric)
language sql stable security definer set search_path = public as $$
  select a.valor_anterior, a.novo_valor from public.aditivos a
   where a.id = p_id and public.ve_valores() and public.ve_projeto(a.projeto_id)
$$;

-- Como o programa lê projetos e aditivos (as regras de acesso de cada linha continuam valendo)
drop view if exists public.v_projetos;
create or replace view public.v_projetos_tela with (security_invoker = true) as
select p.id, p.sigla, p.nome, p.financiador, p.fundacao_apoio, p.tipo, p.programa, p.chamada,
       p.linha_tematica, p.numero_contrato, p.data_assinatura, p.resumo,
       v.valor_total, v.contrapartida,
       p.inicio, p.fim, p.status, p.fase, p.notas, p.placeholder, p.situacao, p.ordem,
       p.criado_em, p.atualizado_em, p.atualizado_por
  from public.projetos p
  left join lateral public.valores_projeto(p.id) v on true;

create or replace view public.v_aditivos_tela with (security_invoker = true) as
select a.id, a.projeto_id, a.numero, a.tipo, a.data_assinatura, a.fim_anterior, a.novo_fim,
       v.valor_anterior, v.novo_valor,
       a.justificativa, a.documento, a.criado_em, a.atualizado_em, a.atualizado_por
  from public.aditivos a
  left join lateral public.valores_aditivo(a.id) v on true;

-- Projeto com alerta de vigência vencida (valores mascarados como acima)
create view public.v_projetos with (security_invoker = true) as
select pr.*,
       (pr.situacao = 'vigente' and pr.fim < public.hoje()) as vigencia_vencida,
       (select count(*) from public.tarefas t
         where t.projeto_id = pr.id and not t.concluida and t.prazo < public.hoje()) as tarefas_atrasadas
  from public.v_projetos_tela pr;

-- Envio de backup ao banco (Direção e Suporte técnico) das tabelas com valores protegidos
create or replace function public.enviar_backup_protegido(p_tabela text, p_linhas jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare cols text; upd text; n integer;
begin
  if not public.e_direcao() then
    raise exception 'Somente a Direção ou o Suporte técnico enviam backup ao banco' using errcode = '42501';
  end if;
  if p_tabela is null or p_tabela not in ('projetos', 'aditivos') then
    raise exception 'Tabela não permitida: %', p_tabela;
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) = 0 then return 0; end if;
  select string_agg(quote_ident(a.attname), ',' order by a.attnum),
         string_agg(format('%1$I = excluded.%1$I', a.attname), ',' order by a.attnum) filter (where a.attname <> 'id')
    into cols, upd
    from pg_attribute a
   where a.attrelid = format('public.%I', p_tabela)::regclass and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('criado_em', 'atualizado_em', 'atualizado_por')
     and exists (select 1 from jsonb_array_elements(p_linhas) x where x ? a.attname);
  execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) on conflict (id) do update set %3$s',
                 p_tabela, cols, upd) using p_linhas;
  get diagnostics n = row_count;
  return n;
end $$;

-- 15b. Links: só endereços web (http/https) — impede links que executam código ao clicar.
--      "not valid": não reprova registros antigos; vale para toda inclusão e alteração.
do $$ begin
  alter table public.documentos add constraint documentos_url_web check (url is null or url = '' or url ~* '^https?://') not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pessoas add constraint pessoas_lattes_web check (lattes is null or lattes = '' or lattes ~* '^https?://') not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.candidatos add constraint candidatos_lattes_web check (lattes is null or lattes = '' or lattes ~* '^https?://') not valid;
exception when duplicate_object then null; end $$;

-- 15c. Cadastro de novos logins (OPCIONAL — só passa a valer quando ativado no painel:
--      Authentication → Hooks → "Before User Created" → Postgres → public.hook_antes_de_criar_usuario).
--      Com ele ativo, só cria login quem já está cadastrado (ativo) em Pessoas com o mesmo e-mail,
--      além dos e-mails do Suporte técnico. Quem não está cadastrado nem chega à lista de liberação.
create or replace function public.hook_antes_de_criar_usuario(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e text := lower(coalesce(event->'user'->>'email', ''));
begin
  if e <> '' and (e = any(public.emails_suporte_tecnico())
                  or exists (select 1 from public.pessoas p where lower(p.email) = e and p.ativo)) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403,
    'message', 'Este e-mail não está cadastrado no GPMOT. Peça à Direção para incluir você em Pessoas antes do primeiro acesso.'));
end $$;

-- 15d. Permissões pela API, endurecidas
--   • funções: nenhuma para quem não fez login; as regras usam as demais como o próprio usuário
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.hook_antes_de_criar_usuario(jsonb) from public, anon, authenticated;
do $$ begin
  grant execute on function public.hook_antes_de_criar_usuario(jsonb) to supabase_auth_admin;
exception when undefined_object then null; end $$;   -- papel só existe na Supabase
--   • visões novas: só consulta
grant select on public.v_projetos_tela, public.v_aditivos_tela, public.v_projetos to authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger on public.v_projetos_tela, public.v_aditivos_tela, public.v_projetos from authenticated, service_role;
--   • valores: a leitura direta das colunas de valor fica fechada (escrita continua valendo pelas regras de cada linha)
do $$
declare t text; prot text[]; cols text;
begin
  for t, prot in select * from (values ('projetos', array['valor_total','contrapartida']),
                                       ('aditivos', array['valor_anterior','novo_valor'])) v(t, p) loop
    execute format('revoke select on public.%I from authenticated', t);
    select string_agg(quote_ident(attname), ', ' order by attnum) into cols
      from pg_attribute where attrelid = format('public.%I', t)::regclass and attnum > 0 and not attisdropped and attname <> all(prot);
    execute format('grant select (%s) on public.%I to authenticated', cols, t);
  end loop;
end $$;
--   • nada de TRUNCATE (ignora as regras de linha), REFERENCES ou TRIGGER para os papéis da API
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon;
do $$ begin
  revoke create on schema public from public, anon, authenticated;
exception when others then null; end $$;
--   • objetos criados no futuro também não ficam abertos para quem não fez login
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
--   • toda função do esquema com caminho de busca fixo (evita sequestro de nomes)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and p.proconfig is null
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    begin
      execute format('alter function %s set search_path = public, pg_temp', f.sig);
    exception when insufficient_privilege then
      raise notice 'Função % não é deste esquema do GPMOT (outro dono) — mantida como está.', f.sig;
    end;
  end loop;
end $$;
-- ATENÇÃO: se no futuro executar de novo "grant select ... on all tables" para authenticated,
-- execute também o bloco "valores" acima, para fechar outra vez as colunas de valor.
