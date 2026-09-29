const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
const XL = CFG.PLANILHA;
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const log = (...a) => console.log(...a);
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); A.nav({t:'projetos'}); }, old);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a="importarPlanilha"]')]);
  await fc.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 }); await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(1500);
  await pg.evaluate(async () => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP');
    const d1 = D.desembolsos.find(d => d.projeto_id === P.id && d.numero === 1); await Data.update('desembolsos', d1.id, { status: 'recebida', data_recebida: '2025-05-12', valor_recebido: 3859740.25 });
    const it = n => D.plano_itens.find(i => i.projeto_id === P.id && new RegExp(n).test(i.descricao));
    for (const [n, v, dt] of [['^Pistões', 18000, '2026-04-10'], ['^Licença GT', 31044, '2026-05-02'], ['^Computadores', 38000, '2026-06-15'], ['^Analisar', 1472191.6, '2026-07-20'], ['^Viagens nacionais', 4200, '2026-08-05']]) await Data.insert('despesas', { projeto_id: P.id, item_id: it(n).id, data: dt, descricao: it(n).descricao, valor: v });
    await Data.update('plano_itens', it('^Analisar').id, { status: 'adquirido' }); await Data.update('plano_itens', it('^Contador').id, { status: 'em_aquisicao' });
    for (const e of D.equipe_plano.filter(e => e.projeto_id === P.id && e.status === 'ocupada')) { const r = linhaVaga(e.id); if (r.bolsa) await criarBolsaVaga(r, e.pessoa_id, '2026-06-01', 24, 'ativo'); }
    UI.tab = 'financeiro'; UI.sub.fin = 'resumo'; render(); });
  await pg.waitForTimeout(150);
  log('métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')));
  log('MOVER linha:', await pg.evaluate(() => [...document.querySelectorAll('tr.click')].find(r => /MOVER/.test(r.innerText)).innerText.replace(/\s+/g, ' ')));
  await pg.screenshot({ path: CFG.saida('v1_resumo.png'), fullPage: true });
  await pg.evaluate(() => { UI.sub.fin = 'compras'; render(); }); await pg.waitForTimeout(100);
  log('compras métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')), '| linhas', await pg.$$eval('tr[data-a="itemPlanoEditar"]', x => x.length));
  await pg.click('[data-a="cpStatus"][data-v="em_aquisicao"] >> nth=0'); await pg.waitForTimeout(100);
  await pg.selectOption('[data-f="cpGrupo"]', '2.1'); await pg.waitForTimeout(100);
  log('permanente pendentes:', await pg.$$eval('tr[data-a="itemPlanoEditar"]', x => x.map(r => r.innerText.split('\n')[2]).join(' / ')));
  await pg.screenshot({ path: CFG.saida('v2_compras.png'), fullPage: true });
  await pg.evaluate(() => { UI.sub.fin = 'calendario'; render(); }); await pg.waitForTimeout(100);
  log('calendário linhas:', await pg.$$eval('table.t tr', x => x.length), '| vencidas:', await pg.$$eval('td', x => x.filter(e => e.innerText === '!').length));
  await pg.screenshot({ path: CFG.saida('v3_calendario.png'), fullPage: true });
  await pg.click('[data-a="finConciliarTodos"]'); await pg.click('#c_yes'); await pg.waitForTimeout(400);
  log('após lançar: vencidas', await pg.$$eval('td', x => x.filter(e => e.innerText === '!').length), '| lançadas', await pg.$$eval('td', x => x.filter(e => e.innerText === '✓').length));
  // sidebar subs
  log('sidebar fin:', await pg.$$eval('.nv-sub a, .nv-sub button, [data-g="fin"]', x => x.map(e => e.innerText.trim()).filter(Boolean).slice(0, 10).join(' | ')));
  // membro sem acesso
  log('membro:', await pg.evaluate(() => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); UI.sub.fin = 'compras'; render(); return document.querySelector('#app').innerText.slice(0, 120).replace(/\n/g, ' '); }));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
