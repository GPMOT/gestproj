\set ON_ERROR_STOP 0
\pset footer off
insert into pessoas(id,nome,email,tipo) values ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br','docente'),('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br','mestrando'),('00000000-0000-0000-0000-00000000000d','Ana','ana@ufsm.br','ic');
insert into auth.users values ('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),('10000000-0000-0000-0000-00000000000c','igor@ufsm.br'),('10000000-0000-0000-0000-00000000000d','ana@ufsm.br');
update perfis set ativo=true, papel='membro';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','ETANOL','2025-03-01','2029-02-28');
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false);
insert into equipe_plano(id,projeto_id,nome_plano,categoria,requisitos,selecao_prazo,status) values ('30000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000001','Bolsista de Mestrado 2','mestrando','Eng. Mecânica, motores','2026-10-30','selecao');
set role authenticated; set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
\echo '== coordenador cadastra candidatos'
insert into candidatos(vaga_id,projeto_id,nome,email,status,nota) values ('30000000-0000-0000-0000-000000000009',gen_random_uuid(),'Bruna Candidata','bruna@x.com','entrevista',8.5),('30000000-0000-0000-0000-000000000009',gen_random_uuid(),'Carlos Candidato',null,'inscrito',null);
select nome, projeto_id='20000000-0000-0000-0000-000000000001' as projeto_ok from candidatos order by nome;
insert into candidatos(vaga_id,projeto_id,nome,nota) values ('30000000-0000-0000-0000-000000000009',gen_random_uuid(),'x',11);
\echo '== coordenador marca checklist de Igor (alocado no projeto dele)'
insert into pessoa_checklist(pessoa_id,item_id) select '00000000-0000-0000-0000-00000000000c', id from checklist_itens where fase='entrada' and ordem<=2;
\echo '== ... e não de Ana (fora dos projetos dele)'
insert into pessoa_checklist(pessoa_id,item_id) select '00000000-0000-0000-0000-00000000000d', id from checklist_itens where fase='entrada' and ordem=1;
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
\echo '== Igor (membro): não vê candidatos; vê o próprio checklist; não marca'
select count(*) as candidatos from candidatos;
select count(*) as meu_checklist from pessoa_checklist;
insert into pessoa_checklist(pessoa_id,item_id) select '00000000-0000-0000-0000-00000000000c', id from checklist_itens where fase='entrada' and ordem=3;
update checklist_itens set nome='x';
select count(*) filter (where nome='x') as mudou_modelo from checklist_itens;
reset role;
\echo '== bolsas vencendo'
insert into vinculos_financeiros(pessoa_id,projeto_id,valor_mensal,inicio,fim,status) values ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',3300,'2025-01-01',current_date+40,'ativo'),('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',8313,'2025-01-01',current_date+400,'ativo');
select pessoa, sigla, dias_restantes from v_bolsas_vencendo;
select fase, count(*) from checklist_itens group by fase order by fase;
