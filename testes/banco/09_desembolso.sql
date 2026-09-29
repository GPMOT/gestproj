\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','ETANOL','2025-03-01','2029-02-28');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false);
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== coordenador cria 2 parcelas com distribuição'
insert into desembolsos(id,projeto_id,numero,descricao,fundacao,data_prevista,valor_previsto) values
 ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'Parcela 01','FAURGS','2025-03-01',3859740.25),
 ('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',2,'Parcela 02','FAURGS','2027-03-01',3859740.25);
insert into desembolso_rubricas(desembolso_id,projeto_id,rubrica,valor) values ('60000000-0000-0000-0000-000000000001',gen_random_uuid(),'2.1',1269527.05),('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1.3',332683.70);
select rubrica, valor, projeto_id='20000000-0000-0000-0000-000000000001' as projeto_certo from desembolso_rubricas;
insert into desembolso_rubricas(desembolso_id,projeto_id,rubrica,valor) values ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1',1);
\echo '== regras: recebida sem data/valor; número repetido'
update desembolsos set status='recebida' where numero=1;
insert into desembolsos(projeto_id,numero) values ('20000000-0000-0000-0000-000000000001',1);
\echo '== recebe parcela 1 e lança gasto'
update desembolsos set status='recebida', data_recebida='2025-05-10', valor_recebido=3859740.25 where numero=1;
insert into despesas(projeto_id,rubrica,data,descricao,valor) values ('20000000-0000-0000-0000-000000000001','1.3','2025-06-01','Pistões',36000);
select previsto, recebido, a_receber, parcelas_atrasadas, proxima, executado, saldo_caixa from v_desembolso_projeto;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor (membro): não vê nem altera'
select count(*) as parcelas from desembolsos; select count(*) as view from v_desembolso_projeto;
insert into desembolsos(projeto_id,numero) values ('20000000-0000-0000-0000-000000000001',9);
reset role;
select tabela, operacao from historico where tabela='desembolsos' order by em;
delete from desembolsos where numero=1; select count(*) as distrib_restante from desembolso_rubricas;
