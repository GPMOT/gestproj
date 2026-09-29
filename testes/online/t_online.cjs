// Teste do MODO ONLINE contra o simulador local da Supabase (supabase_local.cjs) + PostgreSQL real.
// Fase 1 (modo local): monta um conjunto de dados completo (JSON antigo + planilha + registros de todas as áreas) e exporta o backup.
// Fase 2 (online): configura a conexão, testa chave secreta recusada, login por código, perfil aguardando aprovação,
//   libera a Direção pelo SQL, envia o backup ao banco e confere tabela por tabela; grava, edita, exclui e testa conflito.
// Fase 3: segundo usuário (membro) — vê só o que as políticas do banco permitem.
const CFG = require(process.env.GPMOT_CFG || '../tela/config.cjs');
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const SB = process.env.SB_URL || 'http://localhost:54321';
const DB = process.env.PGDATABASE || 'gpmot_online';
const ESM = path.join(__dirname, 'supabase-esm.js');
const sql = q => execFileSync('psql', ['-X', '-q', '-t', '-A', '-d', DB, '-c', q], { encoding: 'utf8' }).trim();
const BK = path.join(os.tmpdir(), 'gpmot_backup_online.json');
let falhas = 0; const ok = (cond, msg, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg + (extra !== undefined ? ' — ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); if (!cond) falhas++; };
const ignorar = t => /WebSocket|realtime|ERR_CONNECTION_REFUSED|status of 40[0-9]/i.test(t);

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const nova = async () => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm', r => r.fulfill({ path: ESM, contentType: 'application/javascript' }));
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !ignorar(m.text())) errs.push('CONSOLE ' + m.text()); });
    return { ctx, pg };
  };
  const keys = await (await fetch(SB + '/__test/keys')).json();

  // ── FASE 1: dados completos no modo local ──────────────────────────
  console.log('FASE 1 — montar dados no modo local e exportar backup');
  { const { ctx, pg } = await nova();
    await pg.goto(CFG.APP); await pg.waitForTimeout(200);
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    await pg.evaluate(d => { localStorage.clear(); Local.load(); const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); seedPadrao(); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); A.nav({ t: 'projetos' }); }, old);
    if (CFG.PLANILHA) {
      const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a="importarPlanilha"]')]);
      await fc.setFiles(CFG.PLANILHA); await pg.waitForSelector('#im_ok', { timeout: 15000 }); await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(1500);
    }
    const extra = await pg.evaluate(async () => {
      const P = D.projetos.find(p => p.sigla === 'MOVER-FUNDEP') || D.projetos[0], P2 = D.projetos.find(p => p !== P);
      const ins = (t, r) => Data.insert(t, r);
      // pessoa para o segundo login: alguém que participa de P2 sem coordenar nenhum projeto
      const cand = D.pessoas.find(pe => D.alocacoes.some(a => a.pessoa_id === pe.id && a.projeto_id === P2.id) && !D.alocacoes.some(a => a.pessoa_id === pe.id && a.coordena));
      await Data.update('pessoas', cand.id, { email: 'membro.teste@ufsm.br' });
      await ins('aditivos', { projeto_id: P2.id, numero: '1º Termo Aditivo', tipo: 'prazo', data_assinatura: '2026-06-01', novo_fim: addDays(P2.fim, 90), justificativa: 'Teste online' });
      await ins('entregas', { projeto_id: P.id, titulo: 'Relatório parcial 1', prazo: '2026-12-15', status: 'pendente' });
      await ins('documentos', { projeto_id: P.id, titulo: 'Termo de outorga', url: 'https://exemplo.ufsm.br/termo.pdf' });
      await ins('pendencias', { projeto_id: P.id, titulo: 'Assinar termo aditivo', status: 'aberta' });
      const it = D.plano_itens.find(i => i.projeto_id === P.id && i.rubrica === '1.3') || D.plano_itens[0];
      if (it) await ins('despesas', { projeto_id: it.projeto_id, item_id: it.id, data: '2026-08-10', descricao: 'Compra teste', valor: 1234.56, documento: 'NF 99' });
      const inf = await ins('infra_itens', { nome: 'Dinamômetro de teste', status: 'operacional' });
      await ins('infra_itens', { nome: 'Célula de carga', status: 'operacional', pai_id: inf.id });
      await ins('infra_manutencoes', { item_id: inf.id, tipo: 'calibracao', titulo: 'Calibração anual', status: 'concluida', data_conclusao: '2026-03-01', proxima_em: '2027-03-01' });
      return { cand: cand.nome, P: P.sigla, P2: P2.sigla, reg: Object.keys(TABLES).reduce((s, t) => s + D[t].length, 0) };
    });
    console.log('  dados locais:', extra);
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => A.bkExportar())]); await dl.saveAs(BK);
    await ctx.close();
  }
  const bk = JSON.parse(fs.readFileSync(BK, 'utf8'));
  // simula dados antigos: registros criados antes de alguns campos existirem (ausentes ou vazios)
  { const T = bk.tabelas;
    delete T.projetos[0].contrapartida; delete T.projetos[1].contrapartida; T.projetos[2].contrapartida = null;
    delete T.alocacoes[0].carga_pct; delete T.alocacoes[0].nivel; delete T.alocacoes[0].status;
    delete T.cronograma[0].status; delete T.cronograma[0].ordem;
    delete T.pessoas[0].habilidades; delete T.pessoas[0].perfil_disponibilidade; T.pessoas[1].habilidades = null;
    if (T.avaliacoes && T.avaliacoes[0]) { delete T.avaliacoes[0].avaliado_em; delete T.avaliacoes[0].filtros; }
    fs.writeFileSync(BK, JSON.stringify(bk)); }

  // ── FASE 2: conexão, login e envio do backup ───────────────────────
  console.log('FASE 2 — conectar, entrar e enviar o backup ao banco');
  const { ctx, pg } = await nova();
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(() => { localStorage.clear(); location.reload(); }); await pg.waitForTimeout(300);
  const colApp = await pg.evaluate(() => Object.fromEntries(Object.entries(COLUNAS).map(([t, c]) => [t, [...c].sort().join(' ')])));
  const colDb = {}; sql("select table_name || '|' || string_agg(column_name::text, ' ' order by column_name::text) from information_schema.columns where table_schema = 'public' and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') group by table_name").split('\n').forEach(l => { const [t, c] = l.split('|'); colDb[t] = c.split(' ').sort().join(' '); });
  const difCol = [...new Set([...Object.keys(colApp), ...Object.keys(colDb)])].filter(t => colApp[t] !== colDb[t]);
  ok(difCol.length === 0, 'lista de colunas do programa (COLUNAS) igual ao esquema do banco', difCol.length ? difCol : undefined);
  await pg.evaluate(() => A.nav({ t: 'config' })); await pg.waitForTimeout(100);
  await pg.fill('#sb_url', SB); await pg.fill('#sb_key', keys.service); await pg.click('[data-a="sbConectar"]'); await pg.waitForTimeout(150);
  ok(/SECRETA/.test(await pg.textContent('#flash')), 'chave secreta (service_role) é recusada');
  await pg.fill('#sb_key', 'sb_secret_abcdefghijklmnopqrstuvwxyz'); await pg.click('[data-a="sbConectar"]'); await pg.waitForTimeout(150);
  ok(/SECRETA/.test(await pg.textContent('#flash')), 'chave sb_secret_ é recusada');
  await pg.fill('#sb_url', SB + '/rest/v1/');   // como o painel da Supabase mostra a URL da API
  await pg.fill('#sb_key', keys.anon); await pg.click('[data-a="sbConectar"]'); await pg.click('#c_yes');
  await pg.waitForSelector('#lg_email', { timeout: 10000 });
  ok(await pg.evaluate(() => SB.cfg().url) === SB, 'URL colada com /rest/v1/ é corrigida para o endereço do projeto');
  await pg.fill('#lg_email', 'Lucas@UFSM.br'); await pg.click('#lg_env'); await pg.waitForSelector('#lg_code', { timeout: 5000 });
  const code = (await (await fetch(SB + '/__test/otp?email=lucas@ufsm.br')).json()).code;
  await pg.fill('#lg_code', '000000' === code ? '111111' : '000000'); await pg.click('#lg_ok'); await pg.waitForTimeout(300);
  ok(/Código inválido/.test(await pg.textContent('#flash')), 'código errado é recusado', await pg.textContent('#flash'));
  await pg.fill('#lg_code', code); await pg.press('#lg_code', 'Enter'); await pg.waitForTimeout(800);
  ok(/aguardando aprovação/.test(await pg.textContent('#app')), 'primeiro login fica aguardando aprovação');
  ok(sql("select papel || '/' || ativo from perfis where email = 'lucas@ufsm.br'") === 'leitura/false', 'perfil criado inativo pelo gatilho do banco');
  sql("update public.perfis set papel = 'direcao', ativo = true where email = 'lucas@ufsm.br'");   // PASSO FINAL do guia
  await pg.reload(); await pg.waitForTimeout(1200);
  ok(/Online/.test(await pg.textContent('#side')), 'depois de liberado, entra direto (sessão guardada)', await pg.evaluate(() => [ME.papel, ME.email]));

  await pg.evaluate(() => A.nav({ t: 'config' })); await pg.waitForTimeout(100);
  const inp = pg.locator('label:has-text("Enviar backup ao banco") input[type=file]');
  await inp.setInputFiles(BK); await pg.waitForSelector('#im_y', { timeout: 5000 });
  const t0 = Date.now(); await pg.click('#im_y');
  await pg.waitForFunction(() => /Importação concluída|Falha/.test(document.getElementById('flash').textContent) || document.querySelector('.merr'), null, { timeout: 180000 }).catch(() => { });
  const fl = await pg.textContent('#flash'); ok(/Importação concluída/.test(fl), `backup enviado ao banco em ${((Date.now() - t0) / 1000).toFixed(1)} s`, fl);
  if (!/Importação concluída/.test(fl)) { console.log(await (await fetch(SB + '/__test/log')).text()); await b.close(); process.exit(1); }

  // conferência tabela a tabela (exceto histórico, que o banco gera sozinho, e perfis)
  const semelhantes = { rubricas: 'codigo', checklist_itens: null, gerencias: null };
  const linhas = []; let difs = 0;
  for (const t of Object.keys(bk.tabelas)) {
    if (['historico', 'perfis'].includes(t)) continue;
    const nb = (bk.tabelas[t] || []).length, ndb = +sql(`select count(*) from public.${t}`);
    const igual = nb === ndb || (t in semelhantes && ndb >= nb);
    if (!igual) difs++; if (nb || ndb) linhas.push(`${t} ${nb}→${ndb}${igual ? '' : ' ✗'}`);
  }
  ok(difs === 0, 'todas as tabelas chegaram ao banco com o mesmo número de registros', linhas.join(' · '));
  const cmp = (t, col) => { const loc = {}; (bk.tabelas[t] || []).forEach(r => loc[r.id] = r[col] == null ? null : String(r[col])); const db = {}; sql(`select id || '|' || coalesce(${col}::text, '∅') from public.${t}`).split('\n').filter(Boolean).forEach(l => { const [i, v] = l.split('|'); db[i] = v === '∅' ? null : v; });
    return Object.keys(loc).filter(i => (loc[i] === null ? null : String(Number.isNaN(+loc[i]) ? loc[i] : +loc[i])) !== (db[i] === null || db[i] === undefined ? null : String(Number.isNaN(+db[i]) ? db[i] : +db[i]))); };
  for (const [t, c] of [['projetos', 'fim'], ['projetos', 'valor_total'], ['plano_itens', 'valor_previsto'], ['despesas', 'valor'], ['cronograma', 'percentual'], ['equipe_plano', 'pessoa_id'], ['orcamento_rubricas', 'aprovado'], ['alocacoes', 'coordena']]) {
    const d = cmp(t, c); ok(d.length === 0, `${t}.${c} idêntico ao backup`, d.length ? d.slice(0, 3) : undefined);
  }
  ok(sql(`select string_agg(contrapartida::text, ',') from public.projetos where id in ('${bk.tabelas.projetos[0].id}','${bk.tabelas.projetos[1].id}','${bk.tabelas.projetos[2].id}')`) === '0.00,0.00,0.00', 'dados antigos sem contrapartida recebem o padrão 0');
  ok(await pg.evaluate(() => D.projetos.length) === bk.tabelas.projetos.length, 'o programa recarregou os dados do banco');
  // enviar o mesmo backup de novo não pode duplicar nem falhar (ex.: migração interrompida e repetida)
  const antes = sql("select string_agg(n::text, ',') from (select (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'historico' order by table_name) x");
  await pg.evaluate(() => A.nav({ t: 'config' })); await pg.waitForTimeout(100);
  await pg.locator('label:has-text("Enviar backup ao banco") input[type=file]').setInputFiles(BK); await pg.waitForSelector('#im_y'); await pg.evaluate(() => { document.getElementById('flash').textContent = ''; }); await pg.click('#im_y');
  await pg.waitForFunction(() => /Importação concluída|Falha/.test(document.getElementById('flash').textContent), null, { timeout: 180000 }).catch(() => { });
  const fl2 = await pg.textContent('#flash');
  ok(/Importação concluída/.test(fl2) && antes === sql("select string_agg(n::text, ',') from (select (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'historico' order by table_name) x"), 'reenviar o mesmo backup não duplica nada', fl2);

  // gravações no modo online
  const r = await pg.evaluate(async () => {
    const out = {}, P = D.projetos.find(p => p.sigla === 'MOVER-FUNDEP') || D.projetos[0];
    const e = await Data.insert('entregas', { projeto_id: P.id, titulo: 'Entrega online', prazo: '2026-11-30', status: 'pendente' });
    out.entrega_id_banco = !!e.id && !!e.criado_em;
    const e2 = await Data.update('entregas', e.id, { status: 'entregue' }); out.data_entrega = e2.data_entrega; out.hoje = hoje();
    const fimAntes = P.fim; await Data.insert('aditivos', { projeto_id: P.id, numero: '9º Termo Aditivo', tipo: 'prazo', data_assinatura: hoje(), novo_fim: addDays(P.fim, 30), justificativa: 'online' });
    out.aditivo = [fimAntes, byId('projetos', P.id).fim];
    const ad = D.aditivos.find(a => a.numero === '9º Termo Aditivo' && a.projeto_id === P.id); await Data.remove('aditivos', ad.id); out.desfaz = byId('projetos', P.id).fim === fimAntes;
    const pd = await Data.insert('pendencias', { projeto_id: P.id, titulo: 'Pendência online', status: 'aberta' });
    await Data.update('pendencias', pd.id, { status: 'resolvida' }); out.resolvida_em = byId('pendencias', pd.id).resolvida_em;
    await Data.remove('pendencias', pd.id); out.removida = !byId('pendencias', pd.id);
    try { await Data.insert('despesas', { projeto_id: P.id, rubrica: '1.3', data: hoje(), descricao: 'x', valor: 0 }); out.valor0 = 'aceitou'; } catch (x) { out.valor0 = x.message; }
    return out;
  });
  ok(r.entrega_id_banco, 'inclusão devolve o registro gravado pelo banco');
  ok(r.data_entrega === r.hoje, 'gatilho do banco preenche data de entrega com a data de hoje', r.data_entrega);
  ok(r.aditivo[0] !== r.aditivo[1], 'aditivo altera o fim do projeto (gatilho do banco)', r.aditivo);
  ok(r.desfaz, 'excluir o aditivo devolve o fim anterior');
  ok(r.resolvida_em === r.hoje && r.removida, 'pendência: resolvida_em preenchida e exclusão ok');
  ok(/valor|maior|zero|inválido/i.test(r.valor0), 'validação recusa despesa com valor 0', r.valor0);
  // conflito: outra pessoa altera o mesmo registro enquanto este usuário editava
  const pid = await pg.evaluate(() => D.projetos[0].id);
  sql(`update public.projetos set resumo = 'alterado por outra pessoa' where id = '${pid}'`);
  const conf = await pg.evaluate(id => Data.update('projetos', id, { resumo: 'minha edição' }).then(() => 'gravou', e => e.message), pid);
  ok(/alterado por outra pessoa/.test(conf), 'edição simultânea é detectada (não sobrescreve)', conf);
  ok(sql(`select resumo from public.projetos where id = '${pid}'`) === 'alterado por outra pessoa', 'o dado da outra pessoa foi preservado');
  // telas principais renderizam com os dados do banco
  const telas = await pg.evaluate(() => { const r = []; for (const [t, s] of [['painel'], ['projetos'], ['equipe'], ['cronograma'], ['financeiro'], ['relatorios'], ['infra'], ['config']]) { try { A.nav({ t }); r.push(t + ':ok'); } catch (e) { r.push(t + ':' + e.message); } } return r; });
  ok(telas.every(x => x.endsWith(':ok')), 'todas as janelas abrem no modo online', telas.join(' '));
  await pg.evaluate(() => A.nav({ t: 'painel' })); await pg.waitForTimeout(200); await pg.screenshot({ path: CFG.saida('online_painel.png') });

  // ── FASE 3: segundo usuário, membro ────────────────────────────────
  console.log('FASE 3 — segundo usuário (membro)');
  const u2 = await nova();
  await u2.pg.goto(CFG.APP); await u2.pg.evaluate(c => { localStorage.clear(); localStorage.setItem('gpmot2:_supabase', JSON.stringify(c)); }, { url: SB, anonKey: keys.anon }); await u2.pg.reload();
  await u2.pg.waitForSelector('#lg_email'); await u2.pg.fill('#lg_email', 'membro.teste@ufsm.br'); await u2.pg.click('#lg_env'); await u2.pg.waitForSelector('#lg_code');
  const c2 = (await (await fetch(SB + '/__test/otp?email=membro.teste@ufsm.br')).json()).code; await u2.pg.fill('#lg_code', c2); await u2.pg.click('#lg_ok'); await u2.pg.waitForTimeout(800);
  ok(sql("select pessoa_id is not null from perfis where email = 'membro.teste@ufsm.br'") === 't', 'login ligado automaticamente à pessoa de mesmo e-mail');
  sql("update public.perfis set papel = 'membro', ativo = true where email = 'membro.teste@ufsm.br'");
  // a Direção vê o novo usuário na lista de acessos
  await pg.evaluate(async () => { await SB.reload(['perfis']); A.nav({ t: 'config' }); }); ok(/membro\.teste@ufsm\.br/.test(await pg.textContent('#app')), 'Direção vê o novo login em Usuários e acessos');
  await u2.pg.reload(); await u2.pg.waitForTimeout(1200);
  const m = await u2.pg.evaluate(async () => {
    const out = { papel: ME.papel, projetos: D.projetos.length, vinculos: D.vinculos_financeiros.length, orc: D.orcamento_rubricas.length, despesas: D.despesas.length, bolsas: D.equipe_plano_bolsas.length };
    const alheio = D.projetos.find(p => !Perm.gereProjeto(p.id)) || D.projetos[0];
    try { await SB.update('projetos', alheio.id, { resumo: 'tentativa do membro' }, alheio); out.editar = 'gravou'; } catch (e) { out.editar = traduzErro(e); }
    try { await SB.remove('pessoas', { id: D.pessoas[0].id }); out.apagar = 'apagou'; } catch (e) { out.apagar = traduzErro(e); }
    return out;
  });
  ok(m.papel === 'membro' && m.projetos > 0, 'membro entra e vê os projetos', m);
  ok(m.vinculos === 0 && m.despesas === 0 && m.bolsas === 0, 'membro não recebe valores de bolsas e despesas (RLS)');
  ok(m.editar !== 'gravou', 'banco recusa o membro editar projeto que não coordena', m.editar);
  ok(m.apagar !== 'apagou', 'banco recusa o membro apagar pessoas', m.apagar);
  await u2.pg.evaluate(() => A.sair()); await u2.pg.waitForSelector('#lg_email', { timeout: 5000 }); ok(true, 'sair volta para a tela de login');

  // ── Direção permanente: o login fixo entra direto como Direção, sem aprovação ──
  console.log('FASE 4 — Direção permanente');
  const u3 = await nova();
  await u3.pg.goto(CFG.APP); await u3.pg.evaluate(c => { localStorage.clear(); localStorage.setItem('gpmot2:_supabase', JSON.stringify(c)); }, { url: SB, anonKey: keys.anon }); await u3.pg.reload();
  await u3.pg.waitForSelector('#lg_email'); await u3.pg.fill('#lg_email', 'lucas.scherer@ufsm.br'); await u3.pg.click('#lg_env'); await u3.pg.waitForSelector('#lg_code');
  const c3 = (await (await fetch(SB + '/__test/otp?email=lucas.scherer@ufsm.br')).json()).code; await u3.pg.fill('#lg_code', c3); await u3.pg.click('#lg_ok'); await u3.pg.waitForTimeout(1200);
  ok(await u3.pg.evaluate(() => ME.online && ME.papel === 'direcao'), 'login fixo entra direto como Direção no primeiro acesso');
  await u3.pg.evaluate(() => A.nav({ t: 'config' })); await u3.pg.waitForTimeout(200);
  const fx = await u3.pg.evaluate(() => { const linha = [...document.querySelectorAll('#app .fgrid')].find(d => /lucas\.scherer@ufsm\.br/.test(d.textContent)); return linha ? { txt: /Direção permanente/.test(linha.textContent), sel: linha.querySelectorAll('select')[1].disabled, chk: linha.querySelector('input[type=checkbox]').disabled } : null; });
  ok(fx && fx.txt && fx.sel && fx.chk, 'tela mostra "Direção permanente" com papel e ativo travados', fx);
  const tent = await u3.pg.evaluate(async () => { const pf = D.perfis.find(p => p.email === 'lucas.scherer@ufsm.br'); await Data.update('perfis', pf.id, { papel: 'leitura', ativo: false }).catch(() => { }); await SB.reload(['perfis']); const n = D.perfis.find(p => p.id === pf.id); return [n.papel, n.ativo]; });
  ok(tent[0] === 'direcao' && tent[1] === true, 'mesmo forçando pela API, o banco mantém Direção e ativo', tent);
  console.log(errs.length ? 'ERROS NA PÁGINA:\n' + errs.join('\n') : '  sem erros na página');
  console.log(falhas || errs.length ? `\n${falhas} verificação(ões) falharam, ${errs.length} erro(s) na página` : '\nTudo certo'); await b.close(); try { fs.unlinkSync(BK); } catch { }
  process.exit(falhas || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
