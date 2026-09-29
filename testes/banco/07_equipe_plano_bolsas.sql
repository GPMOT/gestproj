\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','ETANOL','2026-10-01','2030-09-30');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false);
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== coordenador cria posições e bolsas'
insert into equipe_plano(id,projeto_id,nome_plano,funcao,categoria,etapas,status,pessoa_id) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Mario Martins','Coordenador','docente','{2.5,2.5.1}','ocupada','00000000-0000-0000-0000-00000000000b'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Bolsista de Mestrado 1 (UFSM)','Bolsista - Mestrando','mestrando','{2.7}','vaga',null);
insert into equipe_plano_bolsas(vaga_id,projeto_id,modalidade,valor_mensal,meses) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Coord. geral (COG)',8313,48),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Mestrado (BM)',3300,24);
\echo '== regras: ocupada sem pessoa / vaga com pessoa / mesma pessoa em 2 posições ocupadas'
insert into equipe_plano(projeto_id,nome_plano,status) values ('20000000-0000-0000-0000-000000000001','x','ocupada');
update equipe_plano set pessoa_id='00000000-0000-0000-0000-00000000000c' where id='30000000-0000-0000-0000-000000000002';
insert into equipe_plano(projeto_id,nome_plano,status,pessoa_id) values ('20000000-0000-0000-0000-000000000001','dup','ocupada','00000000-0000-0000-0000-00000000000b');
\echo '== preenche a vaga com Igor e gera vínculo de 12 meses'
update equipe_plano set status='ocupada', pessoa_id='00000000-0000-0000-0000-00000000000c', desde='2026-10-01' where id='30000000-0000-0000-0000-000000000002';
insert into vinculos_financeiros(pessoa_id,projeto_id,vaga_id,modalidade,valor_mensal,inicio,fim) values ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Mestrado (BM)',3300,'2026-10-01','2027-09-30');
select nome_plano, valor_total, meses, meses_vinculados from v_plano_bolsas order by nome_plano;
select * from v_equipe_plano;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor (membro): vê posições, não vê bolsas, não edita'
select count(*) as posicoes_visiveis from equipe_plano;
select count(*) as bolsas_visiveis from equipe_plano_bolsas;
select count(*) as linhas_v_plano_bolsas from v_plano_bolsas;
update equipe_plano set obs='x' where id='30000000-0000-0000-0000-000000000002';
select count(*) filter (where obs='x') as editou from equipe_plano;
insert into equipe_plano(projeto_id,nome_plano) values ('20000000-0000-0000-0000-000000000001','tentativa');
reset role;
\echo '== projeto_id da bolsa segue a posição; exclusão da posição remove bolsa e desvincula'
update equipe_plano_bolsas set projeto_id=gen_random_uuid() where vaga_id='30000000-0000-0000-0000-000000000002';
select count(*) filter (where projeto_id='20000000-0000-0000-0000-000000000001') as ok_projeto from equipe_plano_bolsas;
delete from equipe_plano where id='30000000-0000-0000-0000-000000000002';
select (select count(*) from equipe_plano_bolsas) as bolsas, (select vaga_id from vinculos_financeiros) as vaga_do_vinculo;
select tabela, operacao from historico where tabela like 'equipe%' order by em limit 8;
