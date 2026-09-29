\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email,tipo) values
 ('00000000-0000-0000-0000-00000000000a','Lucas','lucas@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br','doutorando'),
 ('00000000-0000-0000-0000-00000000000d','Thompson','thompson@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000e','Jean','jean@ufsm.br','pos_doc'),
 ('00000000-0000-0000-0000-00000000000f','Hausen','hausen@ufsm.br','docente');
insert into auth.users values
 ('10000000-0000-0000-0000-00000000000a','lucas@ufsm.br'),('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000c','igor@ufsm.br'),('10000000-0000-0000-0000-00000000000d','thompson@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000e','jean@ufsm.br'),('10000000-0000-0000-0000-00000000000f','hausen@ufsm.br');
update perfis set ativo=true, papel='membro'; update perfis set papel='direcao' where email='lucas@ufsm.br';
insert into projetos(id,sigla,inicio,fim) values
 ('20000000-0000-0000-0000-000000000001','Petrobras','2025-04-01','2027-10-31'),
 ('20000000-0000-0000-0000-000000000002','Aramco','2025-01-01','2026-12-31');
insert into alocacoes(pessoa_id,projeto_id,coordena) values
 ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),
 ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000002',false);
insert into vinculos_financeiros(pessoa_id,projeto_id,valor_mensal,inicio,fim) values
 ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',5600,'2025-07-01','2026-12-31'),
 ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000002',3100,'2025-07-01','2026-12-31');
-- gerentes: Thompson financeiro, Jean projetos, Igor infraestrutura, Hausen financeiro (mandato encerrado), Mario técnico + coordena Petrobras
insert into gerencia_membros(gerencia_id,pessoa_id,desde,ate)
 select g.id, p.id, d::date, a::date from (values
  ('Gerência Financeira','Thompson','2026-01-01',null),
  ('Gerência de Projetos','Jean','2026-01-01',null),
  ('Gerência de Infraestrutura','Igor','2026-01-01',null),
  ('Gerência Financeira','Hausen','2024-01-01','2025-12-31'),
  ('Gerência Técnica','Mario','2026-01-01',null)) v(g,p,d,a)
 join gerencias g on g.nome=v.g join pessoas p on p.nome=v.p;
insert into gerencias(nome,permissoes) values ('Gerência X',array['voar']);
set role authenticated;

\echo '=== permissões de cada um'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000d'; select 'Thompson' quem, minhas_permissoes();
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000e'; select 'Jean' quem, minhas_permissoes();
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c'; select 'Igor' quem, minhas_permissoes();
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000f'; select 'Hausen' quem, minhas_permissoes();
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b'; select 'Mario' quem, minhas_permissoes();

\echo '=== THOMPSON (Gerência Financeira, não coordena nada)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000d';
select count(*) as vinculos_visiveis_esperado_2 from vinculos_financeiros;
update vinculos_financeiros set valor_mensal=3200 where valor_mensal=3100;
update projetos set fase='x' where sigla='Aramco';
select count(*) historico_visivel_maior_0 from historico;
insert into tarefas(gerencia_id,titulo,prazo) select id,'Prestação de contas Petrobras','2026-10-30' from gerencias where nome='Gerência Financeira';
insert into tarefas(gerencia_id,titulo) select id,'Tentativa em Infra' from gerencias where nome='Gerência de Infraestrutura';

\echo '=== JEAN (Gerência de Projetos)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000e';
select count(*) as vinculos_visiveis_esperado_0 from vinculos_financeiros;
update projetos set fase='Em execução (Jean)' where sigla='Aramco';
insert into projetos(sigla,inicio,fim) values ('Novo','2026-10-01','2028-09-30');
delete from projetos where sigla='Novo';
insert into alocacoes(pessoa_id,projeto_id) values ('00000000-0000-0000-0000-00000000000e','20000000-0000-0000-0000-000000000002');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000e','20000000-0000-0000-0000-000000000001',true);
insert into gerencia_membros(gerencia_id,pessoa_id) select id,'00000000-0000-0000-0000-00000000000e' from gerencias where nome='Gerência Financeira';

\echo '=== IGOR (Gerência de Infraestrutura + membro Aramco)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
select count(*) as vinculos_visiveis_esperado_0 from vinculos_financeiros;
insert into tarefas(gerencia_id,titulo,prazo) select id,'Manutenção célula 3','2026-09-01' from gerencias where nome='Gerência de Infraestrutura';
insert into tarefas(gerencia_id,titulo) select id,'Tentativa na Financeira' from gerencias where nome='Gerência Financeira';
update tarefas set concluida=true where titulo='Prestação de contas Petrobras';
insert into projetos(sigla,inicio,fim) values ('Igor','2026-10-01','2028-09-30');

\echo '=== HAUSEN (mandato financeiro encerrado)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000f';
select count(*) as vinculos_visiveis_esperado_0 from vinculos_financeiros;

\echo '=== MARIO (Gerência Técnica + coordena Petrobras)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
select count(*) as vinculos_visiveis_esperado_1 from vinculos_financeiros;
update pessoas set risco_sobrecarga=true where nome='Igor';
update gerencias set permissoes=array['financeiro_ver'] where nome='Gerência Técnica';
select count(*) historico_visivel_esperado_0 from historico;

reset role;
\echo '=== resultado'
select sigla, fase from projetos order by sigla;
select nome, risco_sobrecarga from pessoas where nome='Igor';
select nome, gerentes, demandas_abertas, demandas_atrasadas from v_gerencias order by ordem;
