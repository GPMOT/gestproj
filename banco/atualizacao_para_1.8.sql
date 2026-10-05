-- ════════════════════════════════════════════════════════════════════
--  GPMOT/UFSM — atualização do banco para a versão 1.8 (a partir da 1.7)
--  • Nova rubrica 1.6 "Outros bens e direitos" (Custeio): natureza de despesa própria nos
--    planos do SIGITEC/Petrobras (ex.: licenças de software), que antes era somada a
--    1.4 Serviços de Terceiros
--  Como usar: no painel da Supabase, SQL Editor → New query, cole este arquivo inteiro e clique
--  em Run. Não apaga dados e pode ser executado mais de uma vez. Use o programa 2.29 ou mais novo.
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  if to_regprocedure('public.reformula_financeiro(uuid)') is null then
    raise exception 'Este banco não está na versão 1.7. Execute antes o arquivo atualizacao_para_1.7.sql.';
  end if;
end $$;

insert into public.rubricas (codigo, nome, pai, ordem) values ('1.6', 'Outros bens e direitos', '1', 11)
  on conflict (codigo) do nothing;
update public.rubricas set ordem = 12 where codigo = '2'   and ordem = 11;
update public.rubricas set ordem = 13 where codigo = '2.1' and ordem = 12;
update public.rubricas set ordem = 14 where codigo = '2.2' and ordem = 13;
