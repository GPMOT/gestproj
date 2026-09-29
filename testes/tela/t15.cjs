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
  // dados para a semana do Lucas
  await pg.evaluate(async () => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'), me = ME.pessoa_id;
    await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 1', tipo: 'relatorio_parcial', prazo: addDays(hoje(), 3), responsavel_id: me });
    await Data.insert('pendencias', { projeto_id: P.id, titulo: 'Enviar plano de trabalho assinado à FAURGS', prazo: addDays(hoje(), -2), responsavel_id: me });
    const c = D.cronograma.find(x => x.projeto_id === P.id && x.codigo === '2.5.3'); await Data.update('cronograma', c.id, { responsavel_id: me, percentual: 30 });
    const t = await Data.insert('tarefas', { projeto_id: P.id, titulo: 'Revisar simulação 1D do ciclo Miller', prazo: addDays(hoje(), 10) }); await Data.insert('tarefa_responsaveis', { tarefa_id: t.id, pessoa_id: me });
    const d1 = D.desembolsos.find(d => d.projeto_id === P.id && d.numero === 2); await Data.update('desembolsos', d1.id, { data_prevista: addDays(hoje(), 40) });
    await Data.update('equipe_plano', D.equipe_plano.find(e => e.projeto_id === P.id && /Mestrado 3/.test(e.nome_plano)).id, { status: 'selecao', selecao_prazo: addDays(hoje(), 12) }); });
  await pg.evaluate(() => { UI.sub.painel = 'portfolio'; A.nav({ t: 'painel' }); }); await pg.waitForTimeout(150);
  log('métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')));
  log('saúde:', await pg.evaluate(() => D.projetos.filter(p => Calc.vigente(p) || Calc.vencido(p)).map(p => { const s = Calc.saudeProjeto(p); return p.sigla + '=' + s.sinal + (s.mot.bad.concat(s.mot.warn).length ? '(' + s.mot.bad.concat(s.mot.warn).join('; ') + ')' : ''); }).join('\n  ')));
  log('eventos 60d:', await pg.evaluate(() => { const e = Calc.eventos(hoje(), addDays(hoje(), 60)); return e.length + ' · por cat ' + JSON.stringify(e.reduce((m, x) => (m[x.cat] = (m[x.cat] || 0) + 1, m), {})); }));
  await pg.screenshot({ path: CFG.saida('r1_portfolio.png'), fullPage: true });
  await pg.click('[data-a="ltLista"]'); await pg.click('[data-a="ltDias"][data-v="90"]'); await pg.waitForTimeout(100);
  const k = await pg.$eval('[data-a="alToggle"]', e => e.dataset.k); await pg.click(`[data-a="alToggle"][data-k="${k}"]`); await pg.waitForTimeout(100);
  await pg.screenshot({ path: CFG.saida('r2_portfolio_lista.png'), fullPage: true });
  // clique numa marca da linha do tempo
  await pg.click('svg g.click >> nth=0'); await pg.waitForTimeout(100); log('clique na marca →', await pg.evaluate(() => [UI.tab, UI.projeto && siglaProjeto(UI.projeto), UI.projAba]));
  // minha semana
  await pg.evaluate(() => { UI.sub.painel = 'semana'; A.nav({ t: 'painel' }); }); await pg.waitForTimeout(150);
  log('semana:', await pg.evaluate(() => Calc.minhaAgenda().map(x => (x.data || '—') + ' ' + x.tipo + ': ' + x.txt.slice(0, 40)).join('\n  ')));
  await pg.screenshot({ path: CFG.saida('r3_semana.png'), fullPage: true });
  // membro (Nicholas): semana padrão, portfolio sem colunas financeiras
  log('membro:', await pg.evaluate(() => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); UI.sub.painel = null; A.nav({ t: 'painel' });
    const semana = document.querySelector('.subtabs .chip.on').innerText; UI.sub.painel = 'portfolio'; render(); return [semana, /Execução financeira/.test(document.body.innerText), /Parcela/.test(document.body.innerText)]; }));
  await pg.screenshot({ path: CFG.saida('r4_membro_portfolio.png'), fullPage: true });
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
