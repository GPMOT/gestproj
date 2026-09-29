#!/usr/bin/env bash
# Testes do banco (regras, permissões e gatilhos) num PostgreSQL LOCAL — nunca no Supabase de produção.
# Cada teste cria um banco novo, aplica a simulação do login do Supabase (00_…), o esquema (../../banco/gpmot_schema.sql)
# e o roteiro do teste; a saída é comparada com esperados/<teste>.txt.
# As linhas "ERROR:" da saída são bloqueios ESPERADOS (é o banco recusando o que deve recusar).
# Uso:   PGHOST=localhost PGPORT=5432 PGUSER=postgres ./executar.sh            (todos)
#        ./executar.sh 07_equipe_plano_bolsas                                    (um)
#        ./executar.sh --atualizar                                               (regrava os esperados após mudança intencional)
set -u; cd "$(dirname "$0")"
DB=gpmot_teste_tmp; ATUALIZAR=0; SEL=()
for a in "$@"; do [ "$a" = "--atualizar" ] && ATUALIZAR=1 || SEL+=("$a"); done
mkdir -p esperados saida; ok=0; falha=0
for f in [0-9][0-9]_*.sql; do
  t="${f%.sql}"; [ "$t" = "00_simulacao_supabase_auth" ] && continue
  if [ ${#SEL[@]} -gt 0 ] && [[ ! " ${SEL[*]} " == *" $t "* ]]; then continue; fi
  psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1
  psql -q -d $DB -f 00_simulacao_supabase_auth.sql >/dev/null 2>&1
  if ! psql -q -d $DB -v ON_ERROR_STOP=1 -f ../../banco/gpmot_schema.sql >saida/$t.esquema.log 2>&1; then echo "✗ $t — o esquema não aplicou (veja saida/$t.esquema.log)"; falha=$((falha+1)); continue; fi
  psql -q -d $DB -f "$f" 2>&1 | sed -E 's#psql:[^:]*[/\\]([^/\\:]+):#psql:\1:#' | grep -v -e '^NOTICE' -e '^DETAIL:  Failing row contains' > saida/$t.txt
  if [ $ATUALIZAR = 1 ]; then cp saida/$t.txt esperados/$t.txt; echo "↺ $t (esperado atualizado)"; continue; fi
  if diff -q esperados/$t.txt saida/$t.txt >/dev/null; then echo "✓ $t"; ok=$((ok+1)); else echo "✗ $t — difere do esperado:"; diff esperados/$t.txt saida/$t.txt | head -20; falha=$((falha+1)); fi
done
psql -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
[ $ATUALIZAR = 1 ] || echo; [ $ATUALIZAR = 1 ] || echo "$ok ok, $falha com diferença"
[ $falha = 0 ]
