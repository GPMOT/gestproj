\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br'),('00000000-0000-0000-0000-00000000000d','Ana','ana@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br'),('10000000-0000-0000-0000-00000000000d','ana@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','ETANOL','2025-03-01','2029-02-28');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false);
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== coordenador: documentos (1 restrito) e pendências'
insert into documentos(id,projeto_id,tipo,titulo,url,restrito) values ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','contrato','Contrato FAURGS','https://drive/x',true),('70000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','plano_trabalho','Plano de trabalho v3','https://drive/y',false);
insert into documentos(projeto_id,titulo) values ('20000000-0000-0000-0000-000000000001','sem link');
insert into pendencias(id,projeto_id,titulo,responsavel_id,prazo,categoria,origem) values ('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Enviar certidões à FAURGS','00000000-0000-0000-0000-00000000000c','2025-04-01','documental','Ofício FAURGS 12/2025');
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor (membro alocado): vê só o doc não restrito; inclui relatório; não inclui restrito'
select titulo from documentos order by titulo;
insert into documentos(projeto_id,tipo,titulo,url) values ('20000000-0000-0000-0000-000000000001','relatorio','Relatório parcial 1','https://drive/r1');
insert into documentos(projeto_id,tipo,titulo,url,restrito) values ('20000000-0000-0000-0000-000000000001','outro','x','https://x',true);
update documentos set titulo='Plano alterado' where tipo='plano_trabalho';
select count(*) filter (where titulo='Plano alterado') as editou_do_coord from documentos;
\echo '== Igor responsável: resolve pendência; não muda prazo'
update pendencias set prazo='2030-01-01';
update pendencias set status='resolvida', resolucao='Enviadas por e-mail', documento_id=(select id from documentos where tipo='relatorio');
select status, resolvida_em is not null as data, resolucao from pendencias;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000d';
\echo '== Ana (não alocada): não inclui documento nem pendência; vê pendência'
insert into documentos(projeto_id,titulo,url) values ('20000000-0000-0000-0000-000000000001','x','https://x');
insert into pendencias(projeto_id,titulo) values ('20000000-0000-0000-0000-000000000001','x');
select count(*) as pend_visiveis from pendencias;
reset role;
update pendencias set status='aberta';
select titulo, atrasada, responsavel, sigla from v_pendencias_abertas;
select tabela, operacao from historico where tabela in ('documentos','pendencias') order by em;
