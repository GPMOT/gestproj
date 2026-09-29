-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco: versão 1.2 → 1.3
--  Direção permanente: lucas.scherer@ufsm.br sempre Direção e ativo.
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este
--  arquivo inteiro e clique em Run. Pode ser executado mais de uma vez.
-- ════════════════════════════════════════════════════════════════════

-- Direção permanente: estes logins são sempre Direção e ativos. Garante que o
-- sistema nunca fique sem ninguém capaz de administrar os acessos.
-- Para alterar a lista, edite o e-mail abaixo e execute este bloco no SQL Editor.
create or replace function public.emails_direcao_fixa()
returns text[] language sql immutable set search_path = '' as $$
  select array['lucas.scherer@ufsm.br']::text[]
$$;

create or replace function public.tg_perfil_direcao_fixa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- bloqueia a exclusão pela tela; se o próprio login for apagado no painel da Supabase, o perfil sai junto
    if lower(old.email) = any(public.emails_direcao_fixa()) and exists (select 1 from auth.users u where u.id = old.id) then
      raise exception 'O acesso de % é da Direção permanente e não pode ser removido.', old.email;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then new.email := old.email; end if;   -- o e-mail vem do login, não se edita aqui
  if lower(new.email) = any(public.emails_direcao_fixa()) then
    new.papel := 'direcao';
    new.ativo := true;
  end if;
  return new;
end $$;
drop trigger if exists direcao_fixa on public.perfis;
create trigger direcao_fixa before insert or update on public.perfis
  for each row execute function public.tg_perfil_direcao_fixa();
drop trigger if exists direcao_fixa_excluir on public.perfis;
create trigger direcao_fixa_excluir before delete on public.perfis
  for each row execute function public.tg_perfil_direcao_fixa();

revoke execute on function public.emails_direcao_fixa() from public, anon;
revoke execute on function public.tg_perfil_direcao_fixa() from public, anon;
grant execute on function public.emails_direcao_fixa() to authenticated, service_role;

-- aplica agora ao perfil que já existe
update public.perfis set papel = 'direcao', ativo = true
 where lower(email) = any(public.emails_direcao_fixa());
