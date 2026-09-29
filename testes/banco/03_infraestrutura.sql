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
insert into pessoas(id,nome,email,tipo) values ('00000000-0000-0000-0000-000000000011','Carlos','carlos@ufsm.br','ic');
set role authenticated;

\echo '=== IGOR (Gerência de Infraestrutura) cadastra itens'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
insert into infra_itens(id,nome,codigo,categoria,requer_habilitacao) values
 ('40000000-0000-0000-0000-000000000001','Célula de testes 3','CT-03','celula_teste',true);
insert into infra_itens(nome,codigo,categoria,pai_id) values
 ('Dinamômetro AVL 400 kW','DIN-01','equipamento','40000000-0000-0000-0000-000000000001');
insert into infra_habilitacoes(item_id,pessoa_id,validade) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','2027-06-30');

\echo '=== JEAN (Gerência de Projetos) — sem permissão de infraestrutura'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000e';
insert into infra_itens(nome) values ('Tentativa Jean');
insert into infra_reservas(item_id,projeto_id,responsavel_id,inicio,fim) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000e','2026-10-05 08:00-03','2026-10-05 17:00-03');
insert into infra_reservas(id,item_id,projeto_id,responsavel_id,inicio,fim,finalidade) values
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000011','2026-10-05 08:00-03','2026-10-05 17:00-03','Mapeamento motor Aramco');
update infra_reservas set status='confirmada' where id='50000000-0000-0000-0000-000000000001';

\echo '=== IGOR confirma; reserva conflitante é barrada'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
update infra_reservas set status='confirmada' where id='50000000-0000-0000-0000-000000000001';
insert into infra_reservas(item_id,projeto_id,responsavel_id,inicio,fim,status) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','2026-10-05 14:00-03','2026-10-05 20:00-03','confirmada');

\echo '=== JEAN tenta alterar reserva já confirmada'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000e';
update infra_reservas set status='cancelada' where id='50000000-0000-0000-0000-000000000001';

\echo '=== MARIO reporta defeito (ok) e tenta planejar preventiva (barrado)'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000b';
insert into infra_manutencoes(id,item_id,tipo,titulo) values
 ('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','corretiva','Vazamento no trocador de calor');
insert into infra_manutencoes(item_id,tipo,titulo) values ('40000000-0000-0000-0000-000000000001','preventiva','Troca de óleo');

\echo '=== IGOR executa a manutenção'
set request.jwt.claim.sub='10000000-0000-0000-0000-00000000000c';
update infra_manutencoes set status='em_andamento' where id='60000000-0000-0000-0000-000000000001';
select nome, status from infra_itens where codigo='CT-03';
update infra_manutencoes set status='concluida', custo=1850 where id='60000000-0000-0000-0000-000000000001';
select nome, status from infra_itens where codigo='CT-03';
select data_inicio is not null ini, data_conclusao is not null fim from infra_manutencoes where id='60000000-0000-0000-0000-000000000001';
insert into infra_manutencoes(item_id,tipo,titulo,status,proxima_em) select id,'calibracao','Calibração célula de carga','concluida',current_date+10 from infra_itens where codigo='DIN-01';
update infra_reservas set status='realizada', horas_uso=8.5 where id='50000000-0000-0000-0000-000000000001';

reset role;
\echo '=== alertas e uso'
select item, tipo_alerta, descricao, vencido from v_infra_alertas;
select item, projeto, mes, reservas, horas from v_infra_uso_projeto;
select tabela, operacao, count(*) from historico where tabela like 'infra%' group by 1,2 order by 1,2;
