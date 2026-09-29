const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1320, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(CFG.APP); await pg.waitForTimeout(400);
  await pg.screenshot({ path: CFG.saida('00_vazio.png') });
  const avisos = await pg.evaluate(d => { const { T, avisos } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim(lerSim()); render(); return avisos; }, old);
  console.log('AVISOS:\n' + avisos.join('\n'));
  console.log(JSON.stringify(await pg.evaluate(() => Object.fromEntries(Object.keys(TABLES).map(t => [t, D[t].length])))));
  for (const t of ['painel', 'projetos', 'cronograma', 'equipe', 'tarefas', 'gerencias', 'financeiro', 'prospeccao', 'infra', 'relatorios', 'config']) {
    await pg.click(`.nv-a[data-t="${t}"]`); await pg.waitForTimeout(200);
    await pg.screenshot({ path: `shots/${t}.png`, fullPage: true });
  }
  // subtabs
  await pg.click('.nv-a[data-t="equipe"]'); await pg.click('[data-a="sub"][data-v="pessoas"]'); await pg.screenshot({ path: CFG.saida('equipe_pessoas.png'), fullPage: true });
  await pg.click('.nv-a[data-t="financeiro"]'); await pg.click('[data-a="sub"][data-v="orcamento"]'); await pg.selectOption('select[data-f="finProj"]', { label: 'Petrobras' }); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('fin_orc.png'), fullPage: true });
  await pg.click('[data-a="sub"][data-v="bolsas"]'); await pg.screenshot({ path: CFG.saida('fin_bolsas.png'), fullPage: true });
  // project detail
  await pg.click('.nv-a[data-t="projetos"]'); await pg.click('button.link:has-text("Petrobras")'); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('proj_detalhe.png'), fullPage: true });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
