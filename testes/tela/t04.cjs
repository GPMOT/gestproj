const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 700 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(CFG.APP); await pg.waitForTimeout(300);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); render(); }, old);
  await pg.screenshot({ path: CFG.saida('s1_painel.png') });
  // expand all sections
  for (const t of ['projetos', 'equipe', 'tarefas', 'gerencias', 'financeiro', 'infra']) {
    const o = await pg.getAttribute(`.nv-tg[data-t="${t}"]`, 'data-o'); if (o === '0') await pg.click(`.nv-tg[data-t="${t}"]`);
  }
  const m = await pg.evaluate(() => { const n = document.getElementById('navScroll'); return { sh: n.scrollHeight, ch: n.clientHeight }; });
  console.log('nav scrollHeight/clientHeight', m);
  // scroll the nav, then the window, check independence
  await pg.hover('#navScroll'); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(200);
  const a1 = await pg.evaluate(() => [document.getElementById('navScroll').scrollTop, window.scrollY]);
  await pg.click('.nv-a[data-t="equipe"]'); await pg.waitForTimeout(150);
  await pg.hover('#app'); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(200);
  const a2 = await pg.evaluate(() => [document.getElementById('navScroll').scrollTop, window.scrollY, document.getElementById('side').getBoundingClientRect().top]);
  console.log('após rolar menu [menu, janela]:', a1, ' após navegar e rolar janela [menu, janela, topo do menu]:', a2);
  await pg.screenshot({ path: CFG.saida('s2_scroll.png') });
  // click a project sub-item
  await pg.click('.nv-s:has-text("Petrobras")'); await pg.waitForTimeout(150);
  console.log('tela:', await pg.evaluate(() => [UI.tab, siglaProjeto(UI.projeto), document.querySelector('.crumb').textContent]));
  await pg.screenshot({ path: CFG.saida('s3_proj.png') });
  await pg.click('.nv-s:has-text("Agenda de uso")'); console.log('infra sub:', await pg.evaluate(() => UI.sub.infra));
  await pg.click('.nv-s:has-text("Atrasadas")'); console.log('tarefas filtro:', await pg.evaluate(() => [UI.tab, UI.f.tfEscopo, document.querySelectorAll('.task').length]));
  await pg.click('.nv-s:has-text("Todas")'); console.log('todas:', await pg.evaluate(() => [UI.f.tfEscopo, document.querySelectorAll('.task').length]));
  // mini
  await pg.click('.nv-mini'); await pg.waitForTimeout(200); await pg.screenshot({ path: CFG.saida('s4_mini.png') }); await pg.click('.nv-mini');
  // mobile
  await pg.setViewportSize({ width: 420, height: 800 }); await pg.waitForTimeout(200); await pg.screenshot({ path: CFG.saida('s5_mobile.png') });
  await pg.click('.hamb'); await pg.waitForTimeout(300); await pg.screenshot({ path: CFG.saida('s6_mobile_menu.png') });
  await pg.click('.nv-a[data-t="cronograma"]'); await pg.waitForTimeout(300);
  console.log('mobile menu fechou após navegar:', await pg.evaluate(() => !document.body.classList.contains('nav-open')));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
