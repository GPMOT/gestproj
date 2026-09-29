\set ON_ERROR_STOP 0
\pset footer off
-- Direção permanente: lucas.scherer@ufsm.br é sempre Direção e ativo
\echo == primeiro login do e-mail fixo já entra como Direção ativa; outro e-mail entra inativo
insert into auth.users values ('10000000-0000-0000-0000-00000000000a','Lucas.Scherer@ufsm.br'),('10000000-0000-0000-0000-00000000000b','outra.direcao@ufsm.br');
select email, papel, ativo from perfis order by email;
update perfis set papel = 'direcao', ativo = true where email = 'outra.direcao@ufsm.br';
\echo == outra pessoa da Direção tenta rebaixar, desativar e trocar o e-mail do login fixo
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update perfis set papel = 'leitura', ativo = false where email = 'lucas.scherer@ufsm.br';
update perfis set email = 'x@ufsm.br' where id = '10000000-0000-0000-0000-00000000000a';
select email, papel, ativo from perfis where id = '10000000-0000-0000-0000-00000000000a';
\echo == excluir o perfil fixo pela tela é bloqueado
delete from perfis where id = '10000000-0000-0000-0000-00000000000a';
\echo == ninguém consegue trocar o próprio e-mail para virar Direção permanente
update perfis set email = 'lucas.scherer@ufsm.br', papel = 'membro' where id = '10000000-0000-0000-0000-00000000000b';
select email, papel from perfis where id = '10000000-0000-0000-0000-00000000000b';
reset role;
select count(*) as perfis_restantes from perfis;
\echo == apagar o próprio login (painel da Supabase) remove o perfil junto; novo login volta como Direção
delete from auth.users where id = '10000000-0000-0000-0000-00000000000a';
select count(*) as perfis_restantes from perfis;
insert into auth.users values ('10000000-0000-0000-0000-0000000000aa','lucas.scherer@ufsm.br');
select email, papel, ativo from perfis where email = 'lucas.scherer@ufsm.br';
\echo == a função com a lista é acessível a quem fez login, não a anônimos
set role authenticated; select public.emails_direcao_fixa(); reset role;
set role anon; select public.emails_direcao_fixa(); reset role;
