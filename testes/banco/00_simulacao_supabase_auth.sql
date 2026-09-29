-- ════════════════════════════════════════════════════════════════════
--  SOMENTE PARA TESTES LOCAIS — NUNCA executar no Supabase de verdade.
--  Simula o mínimo do Supabase (papéis e auth.uid()) num PostgreSQL comum.
--  Não concede permissões: o próprio gpmot_schema.sql precisa concedê-las
--  (regra da Supabase para projetos criados desde 30/05/2026).
-- ════════════════════════════════════════════════════════════════════
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
