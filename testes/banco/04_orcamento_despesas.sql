\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,tipo,inicio,fim) values ('20000000-0000-0000-0000-000000000001','Petrobras','edital','2025-04-01','2027-10-31'),('20000000-0000-0000-0000-000000000002','Ensaio X','servico','2026-01-01','2026-12-31');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true);
insert into projetos(sigla,tipo,inicio,fim) values ('Y','doacao','2026-01-01','2026-12-31');
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== Mario (coordena Petrobras)'
insert into orcamento_rubricas(projeto_id,rubrica,aprovado,previsto) values ('20000000-0000-0000-0000-000000000001','1.1.1',2554848,2400000),('20000000-0000-0000-0000-000000000001','2.1',2539054.10,2500000);
insert into orcamento_rubricas(projeto_id,rubrica,aprovado) values ('20000000-0000-0000-0000-000000000001','1.1',10);
insert into despesas(projeto_id,rubrica,data,descricao,valor) values ('20000000-0000-0000-0000-000000000001','1.1.1','2026-09-01','Bolsa set/26',5600),('20000000-0000-0000-0000-000000000001','2.1','2026-08-15','Analisador de gases',480000);
insert into despesas(projeto_id,rubrica,data,descricao,valor) values ('20000000-0000-0000-0000-000000000001','1.3','2026-08-15','zero',0);
insert into despesas(projeto_id,rubrica,data,descricao,valor) values ('20000000-0000-0000-0000-000000000002','1.3','2026-08-15','sem permissão',100);
select rubrica,nome,aprovado,previsto,executado,saldo,previsto_a_executar from v_orcamento_rubricas order by rubrica;
select * from v_orcamento_projeto;
\echo '== Igor (sem acesso)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
select count(*) despesas_visiveis from despesas;
reset role;
\echo '== parcela única'
insert into vinculos_financeiros(id,pessoa_id,projeto_id,valor_mensal,inicio,fim,status) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',5600,'2025-07-01','2026-12-31','ativo');
insert into despesas(projeto_id,rubrica,data,competencia,descricao,valor,vinculo_id) values ('20000000-0000-0000-0000-000000000001','1.1.1','2026-08-03','2026-08-01','Bolsa ago',5600,'30000000-0000-0000-0000-000000000001');
insert into despesas(projeto_id,rubrica,data,competencia,descricao,valor,vinculo_id) values ('20000000-0000-0000-0000-000000000001','1.1.1','2026-08-03','2026-08-01','Bolsa ago dup',5600,'30000000-0000-0000-0000-000000000001');
insert into vinculos_financeiros(pessoa_id,projeto_id,valor_mensal,inicio,fim,rubrica) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',1,'2025-07-01','2026-12-31','1');
