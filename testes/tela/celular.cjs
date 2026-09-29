const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); UI.tab = 'painel'; UI.sub.painel = 'semana'; render(); }, old);
  await pg.screenshot({ path: CFG.saida('w1_mob_painel.png') });
  const larg = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); console.log('rolagem horizontal painel:', larg);
  await pg.evaluate(() => { UI.tab = 'projetos'; UI.projeto = D.projetos.find(p => p.sigla === 'GLASSI').id; UI.projAba = 'resumo'; render(); }); await pg.screenshot({ path: CFG.saida('w2_mob_projeto.png') });
  console.log('rolagem horizontal projeto:', await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
  await pg.evaluate(() => { UI.tab = 'financeiro'; UI.sub.fin = 'resumo'; render(); }); await pg.screenshot({ path: CFG.saida('w3_mob_fin.png') });
  console.log('rolagem horizontal financeiro:', await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
  console.log('linhas clicáveis sem teclado:', await pg.evaluate(() => [document.querySelectorAll('tr.click').length, document.querySelectorAll('tr.click[tabindex]').length]));
  await b.close();
})();
