const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
const XL = CFG.PLANILHA;
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const log = (...a) => console.log(...a);
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); A.nav({t:'projetos'}); }, old);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a="importarPlanilha"]')]);
  await fc.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 }); await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(1500);
  const tam = () => pg.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + localStorage.getItem(k).length) * 2; } return (n / 1024 / 1024).toFixed(2) + ' MB'; });
  log('localStorage hoje (dados reais + Mover):', await tam(), '| registros:', await pg.evaluate(() => Object.keys(TABLES).reduce((s, t) => s + D[t].length, 0)));
  // clona o Mover 25x com despesas e histórico
  const r = await pg.evaluate(() => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'); const t0 = performance.now();
    const clone = (t, fk, map) => D[t].filter(x => x.projeto_id === P.id).map(x => ({ ...x, id: newId(), projeto_id: map, ...(fk || {}) }));
    for (let k = 1; k <= 25; k++) { const np = { ...P, id: newId(), sigla: 'CLONE-' + k }; D.projetos.push(np);
      ['cronograma', 'orcamento_rubricas', 'plano_itens', 'entregas', 'pendencias', 'documentos'].forEach(t => D[t].push(...clone(t, null, np.id)));
      const eqMap = {}; D.equipe_plano.filter(x => x.projeto_id === P.id).forEach(x => { const n = { ...x, id: newId(), projeto_id: np.id, pessoa_id: null, status: 'vaga' }; eqMap[x.id] = n.id; D.equipe_plano.push(n); });
      D.desembolsos.push(...clone('desembolsos', null, np.id));
      for (let i = 0; i < 120; i++) D.despesas.push({ id: newId(), projeto_id: np.id, rubrica: ['1.3', '1.4', '2.1', '1.2.1'][i % 4], data: addDays('2025-04-01', i * 4), descricao: 'Despesa ' + i, valor: 1000 + i, criado_em: new Date().toISOString() });
      for (let i = 0; i < 200; i++) D.historico.push({ id: newId(), tabela: 'despesas', registro_id: newId(), operacao: 'INSERT', alteracoes: { valor: i, descricao: 'Despesa ' + i }, em: new Date().toISOString(), usuario: 'x' }); }
    for (let i = 0; i < 60; i++) D.pessoas.push({ ...DEFAULTS.pessoas, id: newId(), nome: 'Pessoa Teste ' + i, tipo: ['ic', 'mestrando', 'doutorando'][i % 3], ativo: true });
    D.projetos.filter(p => p.sigla.startsWith('CLONE')).forEach((p, i) => D.pessoas.slice(-60).slice(i * 2, i * 2 + 6).forEach(pe => D.alocacoes.push({ ...DEFAULTS.alocacoes, id: newId(), pessoa_id: pe.id, projeto_id: p.id, carga_pct: 30 })));
    return { ms: Math.round(performance.now() - t0), reg: Object.keys(TABLES).reduce((s, t) => s + D[t].length, 0) }; });
  log('volume simulado:', r.reg, 'registros');
  let quota = 'ok'; try { await pg.evaluate(() => Local.persistAll()); } catch (e) { quota = 'ERRO: ' + e.message.slice(0, 120); }
  log('gravar no navegador:', quota, '| tamanho:', await tam());
  const telas = [['Painel portfólio', () => { UI.tab = 'painel'; UI.sub.painel = 'portfolio'; }], ['Painel minha semana', () => { UI.tab = 'painel'; UI.sub.painel = 'semana'; }], ['Projetos (lista)', () => { UI.tab = 'projetos'; UI.projeto = null; }],
    ['Projeto › cronograma', () => { UI.tab = 'projetos'; UI.projeto = D.projetos.find(x => x.sigla === 'CLONE-3').id; UI.projAba = 'cronograma'; }], ['Projeto › financeiro/plano', () => { UI.projAba = 'financeiro'; UI.sub.projFin = 'plano'; }],
    ['Cronograma Gantt (tudo)', () => { UI.projeto = null; UI.tab = 'cronograma'; UI.sub.cron = 'gantt'; UI.f.cronZoom = 'tudo'; }], ['Carga da equipe', () => { UI.sub.cron = 'carga'; UI.f.cgTipo = 'todos'; }],
    ['Financeiro resumo', () => { UI.tab = 'financeiro'; UI.sub.fin = 'resumo'; }], ['Financeiro compras', () => { UI.sub.fin = 'compras'; }], ['Calendário bolsas', () => { UI.sub.fin = 'calendario'; }],
    ['Equipe vagas', () => { UI.tab = 'equipe'; UI.sub.equipe = 'vagas'; UI.f.vgSt = 'todas'; }], ['Equipe matriz', () => { UI.sub.equipe = 'matriz'; }]];
  for (const [nome, fn] of telas) { const ms = await pg.evaluate(f => { eval('(' + f + ')')(); const t0 = performance.now(); render(); return Math.round(performance.now() - t0); }, fn.toString()); log(`  ${nome}: ${ms} ms`); }
  const ms = await pg.evaluate(async () => { const t0 = performance.now(); await Data.insert('despesas', { projeto_id: D.projetos[0].id, rubrica: '1.3', data: hoje(), descricao: 'x', valor: 1 }); return Math.round(performance.now() - t0); }); log('  gravar 1 despesa (persistência local):', ms, 'ms');
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
