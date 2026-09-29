\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','ETANOL','2026-10-01','2030-09-30');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true);
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
insert into cronograma(projeto_id,codigo,titulo) values ('20000000-0000-0000-0000-000000000001','2','Plataforma 2');
insert into cronograma(projeto_id,codigo,titulo,mes_inicio,mes_fim,responsavel_id) values ('20000000-0000-0000-0000-000000000001','2.5.1','Definição do ciclo Miller',1,12,'00000000-0000-0000-0000-00000000000c');
insert into cronograma(projeto_id,codigo,titulo,mes_inicio,mes_fim) values ('20000000-0000-0000-0000-000000000001','2.x','inválido',1,2);
insert into cronograma(projeto_id,codigo,titulo,mes_inicio,mes_fim) values ('20000000-0000-0000-0000-000000000001','2.5.2','fim antes',5,2);
insert into tarefas(projeto_id,titulo,atividade_id) select projeto_id,'Simular no GT-Power',id from cronograma where codigo='2.5.1';
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor responsável: atualiza % ok, muda meses bloqueado'
update cronograma set percentual=40 where codigo='2.5.1';
update cronograma set mes_fim=20 where codigo='2.5.1';
update cronograma set percentual=100 where codigo='2.5.1';
reset role;
select codigo,percentual,status,data_conclusao is not null as concl from cronograma order by codigo;
delete from cronograma where codigo='2.5.1'; select titulo, atividade_id from tarefas;
