\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','ETANOL','2026-10-01','2030-09-30'),('20000000-0000-0000-0000-000000000002','OUTRO','2026-10-01','2030-09-30');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false);
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== coordenador cria itens'
insert into plano_itens(id,projeto_id,rubrica,numero,descricao,origem,quantidade,valor_unitario,moeda,cambio,valor_previsto) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2.1',1,'Analisador de gases','importado',1,277772,'USD',5.3,1472191.60),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','1.3',1,'Pistões customizados','nacional',12,3000,'BRL',null,36000);
insert into plano_itens(projeto_id,rubrica,descricao) values ('20000000-0000-0000-0000-000000000001','1','grupo não pode');
\echo '== despesa ligada ao item herda a rubrica (mesmo digitando outra)'
insert into despesas(projeto_id,rubrica,data,descricao,valor,item_id) values ('20000000-0000-0000-0000-000000000001','1.4','2026-11-10','Lote 1 de pistões',18000,'40000000-0000-0000-0000-000000000002');
select rubrica, valor from despesas;
reset role;
\echo '== item de outro projeto é recusado'
insert into despesas(projeto_id,rubrica,data,descricao,valor,item_id) values ('20000000-0000-0000-0000-000000000002','1.3','2026-11-10','x',1,'40000000-0000-0000-0000-000000000002');
\echo '== mudar a rubrica do item leva as despesas'
update plano_itens set rubrica='1.4' where id='40000000-0000-0000-0000-000000000002';
select rubrica from despesas;
update plano_itens set rubrica='1.3' where id='40000000-0000-0000-0000-000000000002';
select descricao, valor_previsto, executado, saldo, n_despesas from v_plano_itens order by descricao;
\echo '== vincular ao item de infraestrutura'
insert into infra_itens(id,nome,projeto_aquisicao_id) values ('50000000-0000-0000-0000-000000000001','Analisador de gases','20000000-0000-0000-0000-000000000001');
update plano_itens set infra_item_id='50000000-0000-0000-0000-000000000001', status='adquirido' where id='40000000-0000-0000-0000-000000000001';
delete from infra_itens; select infra_item_id is null as desligado from plano_itens where numero=1 and rubrica='2.1';
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor (membro): não vê itens nem despesas, não insere'
select count(*) as itens_visiveis from plano_itens;
select count(*) as view_visivel from v_plano_itens;
insert into plano_itens(projeto_id,rubrica,descricao) values ('20000000-0000-0000-0000-000000000001','1.3','tentativa');
reset role;
\echo '== apagar item mantém a despesa (sem item)'
delete from plano_itens where id='40000000-0000-0000-0000-000000000002'; select descricao, rubrica, item_id from despesas;
