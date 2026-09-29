\set ON_ERROR_STOP 0
\pset footer off
-- Permissões da API (regra da Supabase desde 30/05/2026) e fuso horário
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','Petrobras','2025-04-01','2027-10-31');
\echo == anon (sem login) não acessa nenhuma tabela nem função
set role anon;
select count(*) from projetos;
select count(*) from pessoas;
select public.e_direcao();
reset role;
\echo == authenticated sem perfil ativo: tem permissão na tabela, mas o RLS não mostra nada
set role authenticated;
select count(*) as projetos_visiveis from projetos;
reset role;
\echo == todas as tabelas e visões do esquema public têm permissão para authenticated
select count(*) filter (where not has_table_privilege('authenticated', c.oid, 'select')) as sem_select,
       count(*) filter (where c.relkind = 'r' and not has_table_privilege('authenticated', c.oid, 'insert,update,delete')) as sem_escrita,
       count(*) filter (where has_table_privilege('anon', c.oid, 'select')) as anon_com_select
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','v');
\echo == data de hoje no fuso de Brasília, mesmo com a sessão em UTC
set timezone = 'UTC';
select public.hoje() = (now() at time zone 'America/Sao_Paulo')::date as hoje_brasilia;
