#!/usr/bin/env bash
# Testes do banco num PostgreSQL LOCAL — nunca na Supabase de produção.
# Cada seção "-- @@ nome" de banco.sql roda num banco novo: simulação do login (seção 00), esquema e o roteiro do teste;
# a saída é comparada com a mesma seção de banco_esperado.txt. Linhas "ERROR:" são bloqueios ESPERADOS.
# Uso:   PGHOST=localhost PGPORT=5432 PGUSER=postgres bash banco.sh          (todos)
#        bash banco.sh 07_equipe_plano_bolsas                                (um)
#        bash banco.sh --atualizar                                           (regrava o esperado após mudança intencional)
set -u; cd "$(dirname "$0")"
DB=gpmot_teste_tmp; ATUALIZAR=0; SEL=(); TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for a in "$@"; do [ "$a" = "--atualizar" ] && ATUALIZAR=1 || SEL+=("$a"); done
secao() { awk -v n="$2" '/^-- @@ /{on=($3==n); next} on' "$1"; }
mkdir -p saida; ok=0; falha=0; : > "$TMP/novo.txt"
secao banco.sql 00_simulacao_supabase_auth > "$TMP/00_simulacao_supabase_auth.sql"
for t in $(grep '^-- @@ ' banco.sql | awk '{print $3}'); do
  [ "$t" = "00_simulacao_supabase_auth" ] && continue
  if [ ${#SEL[@]} -gt 0 ] && [[ ! " ${SEL[*]} " == *" $t "* ]]; then echo "-- @@ $t" >> "$TMP/novo.txt"; secao banco_esperado.txt "$t" >> "$TMP/novo.txt"; continue; fi
  secao banco.sql "$t" > "$TMP/$t.sql"
  psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1
  psql -q -d $DB -f "$TMP/00_simulacao_supabase_auth.sql" >/dev/null 2>&1
  if ! psql -q -d $DB -v ON_ERROR_STOP=1 -f ../banco/gpmot_schema.sql >saida/$t.esquema.log 2>&1; then echo "✗ $t — o esquema não aplicou (veja saida/$t.esquema.log)"; falha=$((falha+1)); continue; fi
  (cd "$TMP" && psql -q -d $DB -f "$t.sql" 2>&1) | grep -v -e '^NOTICE' -e '^DETAIL:  Failing row contains' > saida/$t.txt
  echo "-- @@ $t" >> "$TMP/novo.txt"; cat saida/$t.txt >> "$TMP/novo.txt"
  if [ $ATUALIZAR = 1 ]; then echo "↺ $t"; continue; fi
  if diff -q <(secao banco_esperado.txt "$t") saida/$t.txt >/dev/null; then echo "✓ $t"; ok=$((ok+1)); else echo "✗ $t — difere do esperado:"; diff <(secao banco_esperado.txt "$t") saida/$t.txt | head -20; falha=$((falha+1)); fi
done
psql -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
if [ $ATUALIZAR = 1 ]; then cp "$TMP/novo.txt" banco_esperado.txt; echo "banco_esperado.txt atualizado"; exit 0; fi
echo; echo "$ok ok, $falha com diferença"; [ $falha = 0 ]
