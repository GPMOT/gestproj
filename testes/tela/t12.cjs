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
  await fc.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 });
  await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.dispatchEvent('#im_ini', 'change');
  log('des ini/intervalo:', await pg.inputValue('#im_des_ini'), await pg.inputValue('#im_des_int'));
  await pg.$eval('#im_des', e => e.scrollIntoView()); await pg.screenshot({ path: CFG.saida('m1_previa.png') });
  await pg.click('#im_ok'); await pg.waitForTimeout(1500);
  log('flash:', await pg.textContent('#flash'));
  const P = await pg.evaluate(() => D.projetos.find(x => x.sigla === 'MOVER-FUNDEP').id);
  const resumo = () => pg.evaluate(id => { const R = Calc.desembolso(byId('projetos', id)); const t = R.tot;
    return JSON.stringify({ parcelas: R.parcelas.map(x => [x.d.numero, x.d.data_prevista, x.d.valor_previsto, x.st, x.dist.length, Math.round(x.distDif * 100) / 100]), previsto: t.previsto, recebido: t.recebido, executado: t.executado, caixa: t.caixa, aReceber: t.aReceber, atrasadas: t.atrasadas.length,
      rub: R.rub.map(r => [r.r.codigo, Math.round(r.previsto), Math.round(r.recebido), Math.round(r.executado), Math.round(r.caixa)].join(':')).join(' ') }); }, P);
  log('importado:', await resumo());
  // receber parcela 1 com valor parcial
  await pg.evaluate(id => { UI.sub.projFin = 'desembolso'; A.projAbrir({ id, aba: 'financeiro' }); }, P); await pg.waitForTimeout(100);
  await pg.screenshot({ path: CFG.saida('m2_antes.png'), fullPage: true });
  const D1 = await pg.evaluate(id => D.desembolsos.find(d => d.projeto_id === id && d.numero === 1).id, P);
  await pg.click(`[data-a="parcelaReceber"][data-id="${D1}"]`); await pg.fill('#fld_data_recebida', '2025-05-12'); await pg.fill('#fld_valor_recebido', '3000000'); await pg.fill('#fld_documento', 'Ofício FAURGS 123/2025'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  // gastos: capital acima do liberado
  await pg.evaluate(id => Promise.all([Data.insert('despesas', { projeto_id: id, rubrica: '2.1', data: '2025-06-10', descricao: 'Analisador de gases (sinal)', valor: 1100000 }), Data.insert('despesas', { projeto_id: id, rubrica: '1.3', data: '2025-06-10', descricao: 'Pistões', valor: 36000 })]), P);
  log('após receber 3 mi e gastar:', await resumo());
  await pg.evaluate(id => A.projAbrir({ id, aba: 'financeiro' }), P); await pg.waitForTimeout(100);
  await pg.screenshot({ path: CFG.saida('m3_depois.png'), fullPage: true });
  log('alertas tela:', await pg.$$eval('.alert', a => a.map(x => x.innerText.slice(0, 110))));
  // editar parcela 2: distribuição que não fecha → erro
  const D2 = await pg.evaluate(id => D.desembolsos.find(d => d.projeto_id === id && d.numero === 2).id, P);
  await pg.click(`tr[data-a="parcelaEditar"][data-id="${D2}"]`); await pg.fill('#fld_r_1_3', '999999'); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  log('dist errada:', await pg.textContent('#m_err')); await pg.click('#m_cancel');
  // gerar parcelas bloqueado (há recebida) — botão some
  log('botão gerar visível?', await pg.$$eval('[data-a="parcelasGerar"]', x => x.length));
  // outro projeto: gerar 4 parcelas iguais
  const G = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'GLASSI').id);
  await pg.evaluate(id => { UI.sub.projFin = 'desembolso'; A.projAbrir({ id, aba: 'financeiro' }); }, G);
  await pg.click('[data-a="parcelasGerar"]'); await pg.fill('#fld_n', '3'); await pg.fill('#fld_ini', '2024-01-15'); await pg.fill('#fld_intervalo', '6'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('GLASSI:', await pg.evaluate(id => { const R = Calc.desembolso(byId('projetos', id)); return [R.parcelas.map(x => x.d.data_prevista + ' ' + x.d.valor_previsto + ' ' + x.st).join(' | '), R.tot.aprovado, R.rub.length]; }, G));
  // painel
  await pg.evaluate(() => A.nav({ t: 'painel' })); await pg.waitForTimeout(100);
  log('painel:', await pg.$$eval('.alert', a => a.map(x => x.innerText.slice(0, 100)).filter(t => /parcela|caixa/.test(t))));
  // membro
  log('membro:', await pg.evaluate(async id => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); const r = await Data.insert('desembolsos', { projeto_id: id, numero: 9 }).then(() => 'aceitou', e => e.message); A.nav({ t: 'painel' }); return [r, [...document.querySelectorAll('.alert')].filter(x => /parcela/.test(x.innerText)).length]; }, P));
  // reimport: parcela 1 recebida não muda; parcela 2 mantém data
  await pg.evaluate(() => aplicarSim({ papel: 'direcao', pessoa_id: null }));
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(id => A.importarPlanilha({ projeto: id }), P)]);
  await fc2.setFiles(XL); await pg.waitForSelector('#im_ok'); await pg.click('#im_ok'); await pg.waitForTimeout(1500);
  log('reimport:', await resumo());
  // módulo financeiro
  await pg.evaluate(id => { UI.tab = 'financeiro'; UI.sub.fin = 'desembolso'; UI.f.finProj = id; UI.projeto = null; render(); }, P); await pg.screenshot({ path: CFG.saida('m4_modulo.png') });
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
