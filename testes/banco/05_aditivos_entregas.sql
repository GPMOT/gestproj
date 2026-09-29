\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim,valor_total,programa,chamada,numero_contrato,contrapartida) values ('20000000-0000-0000-0000-000000000001','GLASSI','2024-01-01','2025-12-31',557937,'Rota 2030','Linha V','FDMS 123/2024',50000);
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true);
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== Mario registra aditivo de prazo'
insert into aditivos(id,projeto_id,numero,tipo,data_assinatura,novo_fim,justificativa) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1º TA','prazo','2025-11-20','2026-12-31','Atraso na entrega do motor');
select sigla,fim,valor_total from projetos;
insert into aditivos(projeto_id,numero,tipo,novo_valor) values ('20000000-0000-0000-0000-000000000001','2º TA','valor',600000);
select numero,fim_anterior,novo_fim,valor_anterior,novo_valor from aditivos order by criado_em;
select sigla,fim,valor_total from projetos;
insert into aditivos(projeto_id,tipo) values ('20000000-0000-0000-0000-000000000001','prazo');
insert into aditivos(projeto_id,tipo,novo_fim) values ('20000000-0000-0000-0000-000000000001','prazo','2020-01-01');
\echo '== entregas'
insert into entregas(projeto_id,tipo,titulo,prazo,responsavel_id) values ('20000000-0000-0000-0000-000000000001','relatorio_parcial','1º Relatório','2026-06-30','00000000-0000-0000-0000-00000000000c'),('20000000-0000-0000-0000-000000000001','prestacao_final','Prestação de contas final','2027-02-28',null);
select titulo, atrasada, (dias_para_prazo = prazo - public.hoje()) as dias_ok from v_entregas_abertas order by prazo;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor (responsável) marca entregue; tenta criar entrega'
update entregas set status='entregue' where titulo='1º Relatório';
update entregas set status='entregue' where titulo='Prestação de contas final';
insert into entregas(projeto_id,titulo,prazo) values ('20000000-0000-0000-0000-000000000001','x','2026-01-01');
delete from aditivos;
reset role;
select titulo,status,data_entrega is not null from entregas order by prazo;
\echo '== exclusão do 2º TA desfaz valor'
delete from aditivos where numero='2º TA';
select sigla,fim,valor_total from projetos;
\echo '== Igor (responsável) tenta mudar prazo'
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
update entregas set prazo='2030-01-01' where titulo='1º Relatório';
update entregas set obs='enviado por e-mail' where titulo='1º Relatório';
