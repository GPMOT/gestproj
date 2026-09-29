#!/usr/bin/env bash
# recria o banco de teste, sobe o simulador e roda o teste online
set -u; cd "$(dirname "$0")"
export PGDATABASE=${PGDATABASE:-gpmot_online}
pkill -f "^node supabase_local" 2>/dev/null; sleep 0.3
if curl -s -o /dev/null http://localhost:${SB_PORT:-54321}/; then echo "A porta ${SB_PORT:-54321} está ocupada por outro programa"; exit 1; fi
psql -X -q -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$PGDATABASE'" >/dev/null
psql -X -q -d postgres -c "drop database if exists $PGDATABASE" -c "create database $PGDATABASE" 2>&1 | grep -v NOTICE
psql -X -q -d $PGDATABASE -f ../banco/00_simulacao_supabase_auth.sql
psql -X -q -d $PGDATABASE -v ON_ERROR_STOP=1 -f ../../banco/gpmot_schema.sql 2>&1 | grep -v -e '^$' -e NOTICE
node supabase_local.cjs > simulador.log 2>&1 & SIM=$!; sleep 1
node t_online.cjs; R=$?
kill $SIM 2>/dev/null; exit $R
