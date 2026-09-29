// Tela de abertura (3 s, com direitos autorais) e quadro "Sobre" nas Configurações
const CFG = require('./config.cjs');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1300, height: 800 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  let falhas = 0; const ok = (c, m, x) => { console.log((c ? '✓ ' : '✗ ') + m + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); if (!c) falhas++; };
  await pg.goto(CFG.APP); await pg.waitForTimeout(300);
  ok(await pg.locator('#abertura').count() === 0, 'testes automáticos não esperam a abertura');
  await pg.goto(CFG.APP + '?abertura=1'); await pg.waitForTimeout(500);
  const txt = await pg.textContent('#abertura');
  ok(/Software de Gestão de Portfólio de Projetos/.test(txt) && /Todos os direitos reservados/.test(txt) && /Desenvolvido por:\s*GPMOT\/UFSM/.test(txt) && /lucas\.scherer@ufsm\.br/.test(txt) && /© 2026 GPMOT — Laboratório de Motores, Combustíveis e Emissões/.test(txt), 'abertura com logotipo, direitos autorais, desenvolvedor, suporte e rodapé');
  ok(await pg.locator('#abertura .marca-logo').count() === 1, 'logotipo do GPMOT na abertura');
  await pg.screenshot({ path: CFG.saida('abertura.png') });
  await pg.waitForTimeout(2000); ok(await pg.locator('#abertura').count() === 1, 'ainda na abertura aos 2,5 s');
  await pg.waitForTimeout(1300); ok(await pg.locator('#abertura').count() === 0 && await pg.evaluate(() => UI.tab) === 'painel', 'depois de 3 s passa para o Painel');
  await pg.goto(CFG.APP + '?abertura=1'); await pg.waitForTimeout(300); await pg.click('#abertura'); await pg.waitForTimeout(700);
  ok(await pg.locator('#abertura').count() === 0, 'clicar pula a abertura');
  await pg.evaluate(() => A.nav({ t: 'config' })); await pg.waitForTimeout(200);
  const cfg = await pg.textContent('#app');
  ok(/Sobre/.test(cfg) && /Direitos|direitos reservados/.test(cfg) && /lucas\.scherer@ufsm\.br/.test(cfg) && /Laboratório de Motores, Combustíveis e Emissões/.test(cfg), 'Configurações mostram o quadro Sobre com os mesmos dados');
  console.log(errs.join('\n') || 'no page errors'); await b.close();
  process.exit(falhas || errs.length ? 1 : 0);
})();
