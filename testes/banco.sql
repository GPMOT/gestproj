-- Testes do banco (regras, permissões e gatilhos do gpmot_schema.sql).
-- Cada seção "-- @@ nome" roda num banco novo e sua saída é comparada com a seção de mesmo nome em banco_esperado.txt.
-- A seção 00 simula o login da Supabase num PostgreSQL comum: NUNCA execute este arquivo na Supabase de verdade.

-- @@ 00_simulacao_supabase_auth
-- ════════════════════════════════════════════════════════════════════
--  SOMENTE PARA TESTES LOCAIS — NUNCA executar no Supabase de verdade.
--  Simula o mínimo do Supabase (papéis e auth.uid()) num PostgreSQL comum.
--  Não concede permissões: o próprio gpmot_schema.sql precisa concedê-las
--  (regra da Supabase para projetos criados desde 30/05/2026).
-- ════════════════════════════════════════════════════════════════════
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
-- @@ 02_gerencias_permissoes
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
-- @@ 03_infraestrutura
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
-- @@ 04_orcamento_despesas
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
-- @@ 05_aditivos_entregas
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
select sigla,fim,valor_total from v_projetos_tela;
insert into aditivos(projeto_id,numero,tipo,novo_valor) values ('20000000-0000-0000-0000-000000000001','2º TA','valor',600000);
select numero,fim_anterior,novo_fim,valor_anterior,novo_valor from v_aditivos_tela order by criado_em;
select sigla,fim,valor_total from v_projetos_tela;
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
-- @@ 06_cronograma_fisico
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
-- @@ 07_equipe_plano_bolsas
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
-- @@ 08_plano_aplicacao
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
-- @@ 09_desembolso
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
-- @@ 10_documentos_pendencias
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
-- @@ 11_candidatos_checklist
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
-- @@ 12_permissoes_api
\set ON_ERROR_STOP 0
\pset footer off
-- Permissões da API (regra da Supabase desde 30/05/2026) e fuso horário
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','Petrobras','2025-04-01','2027-10-31');
\echo == anon (sem login) não acessa nenhuma tabela nem função
set role anon;
select count(*) from projetos;
select count(*) from pessoas;
select public.e_direcao();
reset role;
\echo == authenticated sem perfil ativo: tem permissão na tabela, mas o RLS não mostra nada
set role authenticated;
select count(*) as projetos_visiveis from projetos;
reset role;
\echo == todas as tabelas e visões do esquema public têm permissão para authenticated
select count(*) filter (where not has_table_privilege('authenticated', c.oid, 'select') and c.relname not in ('projetos','aditivos')) as sem_select,
       count(*) filter (where c.relkind = 'r' and not has_table_privilege('authenticated', c.oid, 'insert,update,delete')) as sem_escrita,
       count(*) filter (where has_table_privilege('anon', c.oid, 'select')) as anon_com_select
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','v');
\echo == data de hoje no fuso de Brasília, mesmo com a sessão em UTC
set timezone = 'UTC';
select public.hoje() = (now() at time zone 'America/Sao_Paulo')::date as hoje_brasilia;
-- @@ 13_suporte_tecnico
\set ON_ERROR_STOP 0
\pset footer off
-- Suporte técnico: lucas.scherer@ufsm.br sempre Suporte técnico e ativo; só o Suporte concede esse perfil
\echo == primeiro login do e-mail fixo já entra como Suporte técnico ativo; outro e-mail entra inativo
insert into auth.users values ('10000000-0000-0000-0000-00000000000a','Lucas.Scherer@ufsm.br'),('10000000-0000-0000-0000-00000000000b','outra.direcao@ufsm.br'),('10000000-0000-0000-0000-00000000000c','ajudante@ufsm.br');
select email, papel, ativo from perfis order by email;
update perfis set papel = 'direcao', ativo = true where email = 'outra.direcao@ufsm.br';
update perfis set papel = 'membro', ativo = true where email = 'ajudante@ufsm.br';
\echo == Suporte técnico tem o mesmo acesso da Direção
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
select public.e_direcao() as irrestrito, public.e_suporte() as suporte, array_length(public.minhas_permissoes(), 1) as permissoes;
reset role;
\echo == a Direção tenta rebaixar, desativar e trocar o e-mail do login fixo (nada muda)
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update perfis set papel = 'leitura', ativo = false where email = 'lucas.scherer@ufsm.br';
update perfis set email = 'x@ufsm.br' where id = '10000000-0000-0000-0000-00000000000a';
select email, papel, ativo from perfis where id = '10000000-0000-0000-0000-00000000000a';
\echo == a Direção não pode conceder Suporte técnico
update perfis set papel = 'suporte' where email = 'ajudante@ufsm.br';
\echo == excluir o perfil fixo pela tela é bloqueado
delete from perfis where id = '10000000-0000-0000-0000-00000000000a';
reset role;
\echo == o Suporte técnico concede o perfil a outra pessoa; a Direção não consegue retirar
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
update perfis set papel = 'suporte' where email = 'ajudante@ufsm.br';
reset role;
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update perfis set papel = 'membro' where email = 'ajudante@ufsm.br';
delete from perfis where email = 'ajudante@ufsm.br';
reset role;
select email, papel from perfis where email = 'ajudante@ufsm.br';
\echo == ... mas o Suporte técnico consegue
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
update perfis set papel = 'membro' where email = 'ajudante@ufsm.br';
reset role;
select email, papel from perfis where email = 'ajudante@ufsm.br';
\echo == ninguém consegue trocar o próprio e-mail para virar Suporte técnico
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update perfis set email = 'lucas.scherer@ufsm.br', papel = 'membro' where id = '10000000-0000-0000-0000-00000000000b';
reset role;
select email, papel from perfis where id = '10000000-0000-0000-0000-00000000000b';
\echo == apagar o próprio login (painel da Supabase) remove o perfil junto; novo login volta como Suporte técnico
delete from auth.users where id = '10000000-0000-0000-0000-00000000000a';
select count(*) as perfis_restantes from perfis;
insert into auth.users values ('10000000-0000-0000-0000-0000000000aa','lucas.scherer@ufsm.br');
select email, papel, ativo from perfis where email = 'lucas.scherer@ufsm.br';
\echo == a função com a lista é acessível a quem fez login, não a anônimos
set role authenticated; select public.emails_suporte_tecnico(); reset role;
set role anon; select public.emails_suporte_tecnico(); reset role;
-- @@ 14_leitura_vice_coordenacao
\set ON_ERROR_STOP 0
\pset footer off
-- Leitura (IC iniciante): só os projetos de que participa, sem valores e sem dados pessoais de terceiros.
-- Vice-coordenação: mesmos poderes do coordenador; definida pela Direção ou pelo coordenador titular.
insert into pessoas(id,nome,email,tipo,lattes,curso) values
 ('00000000-0000-0000-0000-00000000000a','Lucas','lucas@ufsm.br','docente',null,null),
 ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br','docente','http://lattes/mario',null),
 ('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br','doutorando',null,'Eng. Mecânica'),
 ('00000000-0000-0000-0000-00000000000d','Ana','ana@ufsm.br','ic',null,'Eng. Mecânica'),
 ('00000000-0000-0000-0000-00000000000e','Bia','bia@ufsm.br','ic',null,'Eng. Química'),
 ('00000000-0000-0000-0000-00000000000f','Carlos','carlos@ufsm.br','mestrando',null,'Eng. Mecânica');
insert into auth.users values
 ('10000000-0000-0000-0000-00000000000a','lucas@ufsm.br'),('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000c','igor@ufsm.br'),('10000000-0000-0000-0000-00000000000d','ana@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000e','bia@ufsm.br'),('10000000-0000-0000-0000-00000000000f','carlos@ufsm.br');
update perfis set ativo = true, papel = 'membro';
update perfis set papel = 'direcao' where email = 'lucas@ufsm.br';
update perfis set papel = 'leitura' where email in ('ana@ufsm.br','bia@ufsm.br');
insert into projetos(id,sigla,inicio,fim) values
 ('20000000-0000-0000-0000-000000000001','P1','2025-01-01','2027-12-31'),
 ('20000000-0000-0000-0000-000000000002','P2','2025-01-01','2027-12-31');
insert into alocacoes(pessoa_id,projeto_id,coordena,status) values
 ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true,'ativo'),
 ('00000000-0000-0000-0000-00000000000d','20000000-0000-0000-0000-000000000001',false,'ativo'),
 ('00000000-0000-0000-0000-00000000000f','20000000-0000-0000-0000-000000000001',false,'ativo'),
 ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000002',false,'ativo'),
 ('00000000-0000-0000-0000-00000000000e','20000000-0000-0000-0000-000000000002',false,'concluido');
insert into cronograma(id,projeto_id,codigo,titulo,responsavel_id) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1.1','Ensaio A','00000000-0000-0000-0000-00000000000d'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','1.1','Ensaio B','00000000-0000-0000-0000-00000000000c');
insert into tarefas(id,projeto_id,titulo) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Tarefa P1'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Tarefa P2 (atribuída à Ana)'),
 ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Tarefa P2 (outra)');
insert into tarefa_responsaveis values ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000d');
insert into orcamento_rubricas(projeto_id,rubrica,aprovado) values ('20000000-0000-0000-0000-000000000001','1.3',1000);
insert into prospeccoes(nome) values ('Edital X');
insert into infra_itens(nome) values ('Dinamômetro');
\echo == Leitura (Ana, participa do P1): só o P1, suas atividades e tarefas, sem valores, prospecção ou infraestrutura
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000d';
select (select string_agg(sigla, ',' order by sigla) from projetos) as projetos,
       (select count(*) from alocacoes) as alocacoes, (select string_agg(titulo, ',' order by titulo) from cronograma) as cronograma,
       (select string_agg(titulo, ' | ' order by titulo) from tarefas) as tarefas,
       (select count(*) from orcamento_rubricas) as orcamento, (select count(*) from prospeccoes) as prospeccoes, (select count(*) from infra_itens) as infra;
\echo == Leitura: tabela de pessoas só com o próprio cadastro; na visão, colegas sem dados pessoais
select nome, email from pessoas order by nome;
select nome, email, lattes, curso from v_pessoas order by nome;
\echo == Leitura não altera nada, nem a atividade de que é responsável
update cronograma set percentual = 50 where id = '30000000-0000-0000-0000-000000000001';
select percentual from cronograma where id = '30000000-0000-0000-0000-000000000001';
reset role;
\echo == Leitura (Bia, alocação concluída no P2): não vê nenhum projeto
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
select (select count(*) from projetos) as projetos, (select count(*) from v_pessoas) as pessoas_visiveis;
reset role;
\echo == Membro (Igor): todos os projetos, sem valores; dados pessoais visíveis
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000c';
select (select string_agg(sigla, ',' order by sigla) from projetos) as projetos, (select count(*) from orcamento_rubricas) as orcamento,
       (select count(*) from v_pessoas where email is not null) as com_email, (select count(*) from prospeccoes) as prospeccoes;
reset role;
\echo == vice-coordenação: o coordenador titular (Mario) nomeia o Carlos vice do P1
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update alocacoes set vice_coordena = true where pessoa_id = '00000000-0000-0000-0000-00000000000f';
\echo == ... mas não pode nomear coordenadores
update alocacoes set coordena = true where pessoa_id = '00000000-0000-0000-0000-00000000000d';
reset role;
select p.nome, a.coordena, a.vice_coordena from alocacoes a join pessoas p on p.id = a.pessoa_id where a.projeto_id = '20000000-0000-0000-0000-000000000001' order by p.nome;
\echo == o vice (Carlos) tem os poderes do coordenador no P1: edita o projeto e vê o orçamento
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000f';
update projetos set resumo = 'editado pelo vice' where sigla = 'P1';
select (select resumo from projetos where sigla = 'P1') as resumo, (select count(*) from orcamento_rubricas) as orcamento;
\echo == ... mas não nomeia outro vice, e no P2 continua membro comum
update alocacoes set vice_coordena = true where pessoa_id = '00000000-0000-0000-0000-00000000000d';
update projetos set resumo = 'tentativa' where sigla = 'P2';
reset role;
select sigla, resumo from projetos order by sigla;
\echo == ninguém é coordenador e vice ao mesmo tempo
set request.jwt.claim.sub = '';
update alocacoes set coordena = true where pessoa_id = '00000000-0000-0000-0000-00000000000f';
-- @@ 15_protecoes_seguranca
\set ON_ERROR_STOP 0
\pset footer off
-- v1.5: valores fechados no banco para quem não tem cargo; coordenação não pode ser "sequestrada";
-- e-mail do cadastro protegido; login novo não herda cadastro já ligado; links só http(s);
-- envio de backup de valores só pela Direção; gancho de cadastro de logins; permissões da API.
insert into pessoas(id,nome,email,tipo) values
 ('00000000-0000-0000-0000-00000000000a','Lucas','lucas@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br','doutorando'),
 ('00000000-0000-0000-0000-00000000000d','Ana','ana@ufsm.br','ic'),
 ('00000000-0000-0000-0000-00000000000e','Gil','gil@ufsm.br','tecnico'),
 ('00000000-0000-0000-0000-00000000000f','Vera','vera@ufsm.br','docente');
insert into auth.users values
 ('10000000-0000-0000-0000-00000000000a','lucas@ufsm.br'),('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000c','igor@ufsm.br'),('10000000-0000-0000-0000-00000000000d','ana@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000e','gil@ufsm.br'),('10000000-0000-0000-0000-00000000000f','vera@ufsm.br');
update perfis set ativo = true, papel = 'membro';
update perfis set papel = 'direcao' where email = 'lucas@ufsm.br';
update perfis set papel = 'leitura' where email = 'ana@ufsm.br';
insert into gerencias(id,nome,permissoes) values ('50000000-0000-0000-0000-000000000001','Gerência de Pessoas','{alocacoes_gerir}');
insert into gerencia_membros(gerencia_id,pessoa_id) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000e');
insert into projetos(id,sigla,inicio,fim,valor_total,contrapartida) values
 ('20000000-0000-0000-0000-000000000001','P1','2025-01-01','2027-12-31',1000000,50000),
 ('20000000-0000-0000-0000-000000000002','P2','2025-01-01','2027-12-31',300000,0);
insert into alocacoes(id,pessoa_id,projeto_id,coordena,vice_coordena) values
 ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true,false),
 ('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000f','20000000-0000-0000-0000-000000000001',false,true),
 ('60000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false,false),
 ('60000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000d','20000000-0000-0000-0000-000000000001',false,false);
insert into aditivos(projeto_id,numero,tipo,novo_valor) values ('20000000-0000-0000-0000-000000000001','1º TA','valor',1200000);

\echo == 1. valores: quem tem cargo vê; Membro sem cargo e Leitura recebem vazio
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
select 'Direção' as quem, string_agg(sigla || '=' || coalesce(valor_total::text, 'vazio'), ' ' order by sigla) as valores,
       (select string_agg(coalesce(novo_valor::text, 'vazio'), ' ') from v_aditivos_tela) as aditivo from v_projetos_tela;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
select 'Coordenador' as quem, string_agg(sigla || '=' || coalesce(valor_total::text, 'vazio'), ' ' order by sigla) as valores,
       (select string_agg(coalesce(novo_valor::text, 'vazio'), ' ') from v_aditivos_tela) as aditivo from v_projetos_tela;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
select 'Gerente' as quem, string_agg(sigla || '=' || coalesce(valor_total::text, 'vazio'), ' ' order by sigla) as valores,
       (select string_agg(coalesce(novo_valor::text, 'vazio'), ' ') from v_aditivos_tela) as aditivo from v_projetos_tela;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000c';
select 'Membro sem cargo' as quem, string_agg(sigla || '=' || coalesce(valor_total::text, 'vazio'), ' ' order by sigla) as valores,
       (select string_agg(coalesce(novo_valor::text, 'vazio'), ' ') from v_aditivos_tela) as aditivo from v_projetos_tela;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000d';
select 'Leitura' as quem, string_agg(sigla || '=' || coalesce(valor_total::text, 'vazio'), ' ' order by sigla) as valores,
       (select string_agg(coalesce(novo_valor::text, 'vazio'), ' ') from v_aditivos_tela) as aditivo from v_projetos_tela;
\echo == 2. leitura direta das colunas de valor é recusada para todos os logins (inclusive pela visão antiga e pela função)
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000c';
select valor_total from projetos;
select novo_valor from aditivos;
select * from projetos;
select sigla, valor_total from v_projetos order by sigla;
select * from public.valores_projeto('20000000-0000-0000-0000-000000000001');
\echo == 3. a escrita de valores continua valendo para quem pode (coordenador altera o valor do seu projeto)
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update projetos set valor_total = 1300000 where id = '20000000-0000-0000-0000-000000000001' returning sigla;
select sigla, valor_total from v_projetos_tela where sigla = 'P1';
reset role;

\echo == 4. coordenação não pode ser trocada por quem não a define
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000f';
update alocacoes set pessoa_id = '00000000-0000-0000-0000-00000000000f' where id = '60000000-0000-0000-0000-000000000001';
delete from alocacoes where id = '60000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
update alocacoes set pessoa_id = '00000000-0000-0000-0000-00000000000e' where id = '60000000-0000-0000-0000-000000000001';
update alocacoes set projeto_id = '20000000-0000-0000-0000-000000000002' where id = '60000000-0000-0000-0000-000000000001';
update alocacoes set pessoa_id = '00000000-0000-0000-0000-00000000000e' where id = '60000000-0000-0000-0000-000000000002';
delete from alocacoes where id = '60000000-0000-0000-0000-000000000002';
\echo == 4b. gerência de alocações segue alocando e alterando alocações comuns
update alocacoes set carga_pct = 40 where id = '60000000-0000-0000-0000-000000000003' returning carga_pct;
\echo == 4c. o coordenador titular retira a vice-coordenação; a Direção troca o coordenador
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update alocacoes set vice_coordena = false where id = '60000000-0000-0000-0000-000000000002' returning vice_coordena;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
update alocacoes set pessoa_id = '00000000-0000-0000-0000-00000000000a' where id = '60000000-0000-0000-0000-000000000001' returning coordena;
update alocacoes set pessoa_id = '00000000-0000-0000-0000-00000000000b' where id = '60000000-0000-0000-0000-000000000001';
reset role;
select p.nome, a.coordena, a.vice_coordena from alocacoes a join pessoas p on p.id = a.pessoa_id where a.projeto_id = '20000000-0000-0000-0000-000000000001' order by p.nome;

\echo == 5. cadastro de pessoas: coordenador altera as pessoas do seu projeto, mas não o e-mail; nem pessoas de fora
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update pessoas set funcao = 'Bolsista de doutorado' where id = '00000000-0000-0000-0000-00000000000c' returning funcao;
update pessoas set email = 'atacante@x.com' where id = '00000000-0000-0000-0000-00000000000c';
update pessoas set funcao = 'Diretor?' where id = '00000000-0000-0000-0000-00000000000a' returning funcao;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000c';
update pessoas set email = 'outro@ufsm.br' where id = '00000000-0000-0000-0000-00000000000c';
update pessoas set formacao = 'Mestre' where id = '00000000-0000-0000-0000-00000000000c' returning formacao;
reset role;

\echo == 6. login novo com e-mail de cadastro que já tem login não herda o acesso (fica sem pessoa)
set request.jwt.claim.sub = '';
insert into pessoas(id,nome,email) values ('00000000-0000-0000-0000-000000000011','Novo','novo@ufsm.br');
insert into auth.users values ('10000000-0000-0000-0000-000000000011','novo@ufsm.br');
update pessoas set email = 'igor.novo@ufsm.br' where id = '00000000-0000-0000-0000-00000000000c';
insert into auth.users values ('10000000-0000-0000-0000-000000000012','igor.novo@ufsm.br');
select email, pessoa_id is not null as ligado_a_um_cadastro, ativo from perfis where email in ('novo@ufsm.br','igor.novo@ufsm.br') order by email;

\echo == 7. links só http(s)
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
insert into documentos(projeto_id,titulo,url) values ('20000000-0000-0000-0000-000000000001','Mau','javascript:alert(1)');
insert into documentos(projeto_id,titulo,url) values ('20000000-0000-0000-0000-000000000001','Bom','https://ufsm.br/x') returning titulo;
update pessoas set lattes = 'JavaScript:alert(1)' where id = '00000000-0000-0000-0000-00000000000d';
update pessoas set lattes = 'http://lattes.cnpq.br/1' where id = '00000000-0000-0000-0000-00000000000d' returning lattes;
reset role;

\echo == 8. envio de backup com valores: só Direção/Suporte, só projetos e aditivos
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000c';
select public.enviar_backup_protegido('projetos', '[{"id":"20000000-0000-0000-0000-000000000002","sigla":"P2","inicio":"2025-01-01","fim":"2027-12-31","valor_total":1}]');
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
select public.enviar_backup_protegido('perfis', '[{"id":"10000000-0000-0000-0000-00000000000c","papel":"direcao"}]');
select public.enviar_backup_protegido('projetos', '[{"id":"20000000-0000-0000-0000-000000000002","sigla":"P2","inicio":"2025-01-01","fim":"2027-12-31","valor_total":350000,"contrapartida":0},{"id":"20000000-0000-0000-0000-000000000003","sigla":"P3","inicio":"2026-01-01","fim":"2026-12-31","valor_total":10,"contrapartida":0}]') as linhas;
select sigla, valor_total from v_projetos_tela order by sigla;
reset role;

\echo == 9. gancho de cadastro de logins (quando ativado no painel)
select public.hook_antes_de_criar_usuario('{"user":{"email":"Ana@ufsm.br"}}') as cadastrada,
       public.hook_antes_de_criar_usuario('{"user":{"email":"lucas.scherer@ufsm.br"}}') as suporte,
       public.hook_antes_de_criar_usuario('{"user":{"email":"estranho@gmail.com"}}')->'error'->>'http_code' as desconhecido;
set role authenticated;
select public.hook_antes_de_criar_usuario('{"user":{"email":"x@y.z"}}');
reset role;
set role anon;
select public.ve_valores();
reset role;

\echo == 10. permissões da API
select count(*) filter (where has_table_privilege('authenticated', c.oid, 'truncate') or has_table_privilege('anon', c.oid, 'truncate')) as com_truncate,
       count(*) filter (where has_table_privilege('authenticated', c.oid, 'trigger') or has_table_privilege('authenticated', c.oid, 'references')) as com_trigger_ou_references
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v');
select c.relname, a.attname, has_column_privilege('authenticated', c.oid, a.attname, 'select') as le, has_column_privilege('authenticated', c.oid, a.attname, 'update') as altera
  from pg_class c join pg_attribute a on a.attrelid = c.oid
 where c.oid in ('public.projetos'::regclass, 'public.aditivos'::regclass) and a.attname in ('sigla','valor_total','contrapartida','numero','valor_anterior','novo_valor')
 order by 1, 2;
select count(*) as funcoes_sem_caminho_fixo from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proconfig is null and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
select count(*) filter (where has_function_privilege('anon', p.oid, 'execute')) as funcoes_para_anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
-- @@ 16_reprogramacao_cronograma
\set ON_ERROR_STOP 0
\pset footer off
-- v1.6: Direção, coordenação e gerências (cronograma_gerir) reprogramam os meses; linha de base guardada
-- na 1ª mudança; responsável só atualiza andamento; registro de reprogramações.
insert into pessoas(id,nome,email,tipo) values
 ('00000000-0000-0000-0000-00000000000a','Lucas','lucas@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000c','Igor','igor@ufsm.br','doutorando'),
 ('00000000-0000-0000-0000-00000000000d','Ana','ana@ufsm.br','ic'),
 ('00000000-0000-0000-0000-00000000000e','Gil','gil@ufsm.br','tecnico'),
 ('00000000-0000-0000-0000-00000000000f','Bia','bia@ufsm.br','mestrando');
insert into auth.users values
 ('10000000-0000-0000-0000-00000000000a','lucas@ufsm.br'),('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000c','igor@ufsm.br'),('10000000-0000-0000-0000-00000000000d','ana@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000e','gil@ufsm.br'),('10000000-0000-0000-0000-00000000000f','bia@ufsm.br');
update perfis set ativo = true, papel = 'membro';
update perfis set papel = 'direcao' where email = 'lucas@ufsm.br';
update perfis set papel = 'leitura' where email = 'ana@ufsm.br';
insert into gerencia_membros(gerencia_id,pessoa_id) select id, '00000000-0000-0000-0000-00000000000e' from gerencias where nome = 'Gerência Técnica';
insert into projetos(id,sigla,inicio,fim) values ('20000000-0000-0000-0000-000000000001','PETRO','2025-04-01','2027-09-30');
insert into alocacoes(pessoa_id,projeto_id,coordena) values
 ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true),
 ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001',false),
 ('00000000-0000-0000-0000-00000000000d','20000000-0000-0000-0000-000000000001',false);
insert into cronograma(id,projeto_id,codigo,titulo,mes_inicio,mes_fim,responsavel_id) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2.3','Teste combustível 1',6,8,'00000000-0000-0000-0000-00000000000c'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2.4','Teste combustível 2',8,10,null);
\echo == gerência (cronograma_gerir) reprograma: os meses originais ficam como linha de base
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
update cronograma set mes_inicio = 9, mes_fim = 11 where id = '30000000-0000-0000-0000-000000000001' returning codigo, mes_inicio, mes_fim, mes_inicio_base, mes_fim_base;
\echo == gerência não muda a estrutura da atividade
update cronograma set titulo = 'Outro' where id = '30000000-0000-0000-0000-000000000001';
\echo == responsável atualiza o andamento, mas não os prazos
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000c';
update cronograma set percentual = 20 where id = '30000000-0000-0000-0000-000000000001' returning percentual, status;
update cronograma set mes_fim = 14 where id = '30000000-0000-0000-0000-000000000001';
\echo == membro sem vínculo com a atividade não altera nada (nenhuma linha)
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000f';
update cronograma set mes_fim = 14 where id = '30000000-0000-0000-0000-000000000002';
\echo == coordenação reprograma de novo: a linha de base continua a original
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
update cronograma set mes_inicio = 10, mes_fim = 12 where id = '30000000-0000-0000-0000-000000000001' returning mes_inicio, mes_fim, mes_inicio_base, mes_fim_base;
\echo == só a Direção redefine a linha de base
update cronograma set mes_inicio_base = 10 where id = '30000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
update cronograma set mes_inicio_base = null, mes_fim_base = null where id = '30000000-0000-0000-0000-000000000001' returning mes_inicio_base, mes_fim_base;
\echo == registro das reprogramações: autor gravado pelo banco; motivo obrigatório; quem não pode não registra
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
insert into reprogramacoes(projeto_id,motivo,alteracoes,criado_por) values ('20000000-0000-0000-0000-000000000001','Atraso na entrega dos motores','[{"codigo":"2.3","de":[6,8],"para":[9,11]}]','10000000-0000-0000-0000-00000000000a') returning (criado_por = '10000000-0000-0000-0000-00000000000e') as autor_real, autor;
insert into reprogramacoes(projeto_id,motivo) values ('20000000-0000-0000-0000-000000000001','  ');
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000f';
insert into reprogramacoes(projeto_id,motivo) values ('20000000-0000-0000-0000-000000000001','Tentativa sem permissão');
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000d';
select motivo, alteracoes->0->>'codigo' as atividade from reprogramacoes;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
delete from reprogramacoes;
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000a';
\echo == sem a permissão cronograma_gerir, a gerência deixa de reprogramar
update gerencias set permissoes = array_remove(permissoes, 'cronograma_gerir') where nome = 'Gerência Técnica';
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
update cronograma set mes_fim = 13 where id = '30000000-0000-0000-0000-000000000002';
select count(*) as registros from reprogramacoes;
reset role;
-- @@ 17_reformulacao_financeira
\set ON_ERROR_STOP 0
\pset footer off
-- v1.7: reformulação financeira — Direção, coordenação e gerências (financeiro_reformular) registram e aplicam;
-- gerência vê orçamento, plano e desembolso, mas não bolsas nem despesas; membro sem cargo não vê nem altera.
insert into pessoas(id,nome,email,tipo) values
 ('00000000-0000-0000-0000-00000000000a','Lucas','lucas@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000b','Mario','mario@ufsm.br','docente'),
 ('00000000-0000-0000-0000-00000000000e','Gil','gil@ufsm.br','tecnico'),
 ('00000000-0000-0000-0000-00000000000f','Bia','bia@ufsm.br','mestrando');
insert into auth.users values
 ('10000000-0000-0000-0000-00000000000a','lucas@ufsm.br'),('10000000-0000-0000-0000-00000000000b','mario@ufsm.br'),
 ('10000000-0000-0000-0000-00000000000e','gil@ufsm.br'),('10000000-0000-0000-0000-00000000000f','bia@ufsm.br');
update perfis set ativo = true, papel = 'membro';
update perfis set papel = 'direcao' where email = 'lucas@ufsm.br';
insert into gerencia_membros(gerencia_id,pessoa_id) select id, '00000000-0000-0000-0000-00000000000e' from gerencias where nome = 'Gerência Técnica';
insert into projetos(id,sigla,inicio,fim,valor_total) values ('20000000-0000-0000-0000-000000000001','PETRO','2025-06-30','2027-12-26',1000);
insert into alocacoes(pessoa_id,projeto_id,coordena) values ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001',true);
insert into orcamento_rubricas(projeto_id,rubrica,aprovado,previsto) values
 ('20000000-0000-0000-0000-000000000001','1.3',600,600),('20000000-0000-0000-0000-000000000001','1.4',400,400);
insert into plano_itens(id,projeto_id,rubrica,numero,descricao,valor_previsto) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1.3',1,'Bielas',100),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','1.4',1,'Manutenção do MEV',400);
insert into despesas(projeto_id,rubrica,data,descricao,valor) values ('20000000-0000-0000-0000-000000000001','1.3','2025-08-01','Compra',50);
\echo == gerência (financeiro_reformular) vê orçamento e plano, mas não as despesas
set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000e';
select (select count(*) from orcamento_rubricas) as orcamento, (select count(*) from plano_itens) as itens, (select count(*) from despesas) as despesas;
\echo == gerência registra a reformulação submetida e, aprovada, aplica no orçamento e nos itens
insert into reformulacoes(id,projeto_id,numero,situacao,justificativa,alteracoes,remanejado) values
 ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',5,'submetida','Remanejamento para serviços','{"rubricas":[{"rubrica":"1.3","de":600,"para":500},{"rubrica":"1.4","de":400,"para":500}]}',100)
 returning numero, situacao, autor;
update orcamento_rubricas set aprovado = aprovado - 100 where rubrica = '1.3' returning rubrica, aprovado;
update orcamento_rubricas set aprovado = aprovado + 100 where rubrica = '1.4' returning rubrica, aprovado;
update plano_itens set status = 'cancelado', valor_previsto = 0 where id = '40000000-0000-0000-0000-000000000001' returning descricao, status, valor_previsto;
insert into plano_itens(projeto_id,rubrica,numero,descricao,valor_previsto) values ('20000000-0000-0000-0000-000000000001','1.4',2,'Análises químicas de acompanhamento',100) returning descricao;
update reformulacoes set situacao = 'aprovada', aplicada_em = now() where numero = 5 returning situacao, aplicada_em is not null as aplicada;
\echo == gerência não lança despesas nem apaga a reformulação
insert into despesas(projeto_id,rubrica,data,descricao,valor) values ('20000000-0000-0000-0000-000000000001','1.3','2025-08-01','x',1);
delete from reformulacoes;
\echo == membro sem cargo não vê nem registra
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000f';
select (select count(*) from orcamento_rubricas) as orcamento, (select count(*) from reformulacoes) as reformulacoes;
insert into reformulacoes(projeto_id,justificativa) values ('20000000-0000-0000-0000-000000000001','x');
update orcamento_rubricas set aprovado = 0;
\echo == coordenação vê o registro; a situação só aceita os valores previstos
set request.jwt.claim.sub = '10000000-0000-0000-0000-00000000000b';
select numero, situacao, autor, remanejado from reformulacoes;
insert into reformulacoes(projeto_id,situacao) values ('20000000-0000-0000-0000-000000000001','aceita');
reset role;
select rubrica, aprovado from orcamento_rubricas order by rubrica;
