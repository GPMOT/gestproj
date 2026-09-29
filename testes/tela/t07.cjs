const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); A.projAbrir({ id: D.projetos.find(p => p.sigla === 'VCR-VW').id, aba: 'financeiro' }); }, old);
  const pid = await pg.evaluate(() => UI.projeto);
  await pg.click(`input[data-orc="${pid}|1.1.1|aprovado"]`);
  for (const v of ['2.554.848,00', '2400000', '447.744', '447744,00', '124000.00', '100.000,00']) { await pg.keyboard.type(v); await pg.keyboard.press('Tab'); await pg.waitForTimeout(120); }
  console.log('foco:', await pg.evaluate(() => document.activeElement.dataset.orc));
  console.log(await pg.evaluate(id => ['1.1.1', '1.1.2', '1.2.1'].map(c => { const v = Calc.valoresRubrica(id, c); return [c, v.aprovado, v.previsto]; }), pid));
  console.log('exibição:', await pg.inputValue(`input[data-orc="${pid}|1.1.1|aprovado"]`));
  await pg.fill(`input[data-orc="${pid}|1.3|aprovado"]`, 'abc'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(150);
  console.log('inválido:', await pg.textContent('#flash'));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
