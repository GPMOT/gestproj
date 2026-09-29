const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 700 } });
  await pg.goto(CFG.APP); await pg.waitForTimeout(300);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); render(); }, old);
  for (const t of ['projetos', 'equipe', 'tarefas', 'gerencias', 'financeiro', 'infra']) { const o = await pg.getAttribute(`.nv-tg[data-t="${t}"]`, 'data-o'); if (o === '0') await pg.click(`.nv-tg[data-t="${t}"]`); }
  await pg.hover('#navScroll'); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(200);
  const st = () => pg.evaluate(() => [document.getElementById('navScroll').scrollTop, document.getElementById('navScroll').scrollHeight, window.scrollY]);
  console.log('antes', await st());
  await pg.click('.nv-a[data-t="equipe"]'); await pg.waitForTimeout(150); console.log('após clicar Equipe', await st());
  await pg.hover('#app'); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(200); console.log('após rolar conteúdo', await st());
  await b.close();
})();
