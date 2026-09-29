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
  await pg.$eval('#im_itens', e => e.scrollIntoView()); await pg.screenshot({ path: CFG.saida('k1_previa.png') });
  await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(1200);
  log('flash:', await pg.textContent('#flash'));
  const P = await pg.evaluate(() => D.projetos.find(x => x.sigla === 'MOVER-FUNDEP').id);
  log('plano:', await pg.evaluate(id => { const A_ = Calc.planoAplicacao(byId('projetos', id)); return JSON.stringify({ tot: A_.tot, g: A_.grupos.filter(g => g.itens.length || g.aprovado).map(g => [g.r.codigo, g.itens.length, g.previstoItens, g.aprovado, g.dif]) }); }, P));
  await pg.evaluate(id => { A.projAbrir({ id, aba: 'financeiro' }); }, P); await pg.click('[data-a="sub"][data-v="plano"]'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: CFG.saida('k2_plano.png'), fullPage: true });
  // lançar gasto num item (Pistões) pelo botão
  const IT = await pg.evaluate(id => D.plano_itens.find(i => i.projeto_id === id && /^Pistões/.test(i.descricao)).id, P);
  await pg.click(`[data-a="despNova"][data-item="${IT}"]`); await pg.waitForTimeout(100);
  log('form: rubrica', await pg.inputValue('#fld_rubrica'), 'bloqueada', await pg.$eval('#fld_rubrica', e => e.disabled), '| descr', await pg.inputValue('#fld_descricao'));
  await pg.fill('#fld_valor', '18000'); await pg.fill('#fld_documento', 'NF 1234'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  // gasto pelo botão geral escolhendo o item → rubrica acompanha
  await pg.click('.toolbar [data-a="despNova"]'); await pg.selectOption('#fld_item_id', IT); log('rubrica após escolher item:', await pg.inputValue('#fld_rubrica'));
  await pg.fill('#fld_valor', '20000'); await pg.fill('#fld_descricao', 'Lote 2 de pistões'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('item:', await pg.evaluate(it => { const r = Calc.planoAplicacao(byId('projetos', byId('plano_itens', it).projeto_id)).grupos.find(g => g.r.codigo === '1.3').itens.find(x => x.i.id === it); return [r.executado, r.saldo]; }, IT));
  log('rubrica 1.3:', await pg.evaluate(id => { const v = Calc.valoresRubrica(id, '1.3'); return [v.aprovado, v.executado]; }, P));
  // mudar rubrica do item → despesas acompanham
  await pg.evaluate(it => Data.update('plano_itens', it, { rubrica: '1.4' }), IT);
  log('despesas após mudar rubrica do item:', await pg.evaluate(it => D.despesas.filter(d => d.item_id === it).map(d => d.rubrica).join(','), IT));
  await pg.evaluate(it => Data.update('plano_itens', it, { rubrica: '1.3' }), IT);
  // despesa com item de outro projeto
  log('item de outro projeto:', await pg.evaluate(it => Data.insert('despesas', { projeto_id: D.projetos.find(p => p.sigla === 'GLASSI').id, rubrica: '1.3', data: hoje(), descricao: 'x', valor: 1, item_id: it }).then(() => 'aceitou', e => e.message), IT));
  // ver despesas filtradas por item
  await pg.evaluate(id => A.projAbrir({ id, aba: 'financeiro' }), P); await pg.click(`.execlink[data-item="${IT}"]`); await pg.waitForTimeout(150);
  log('lista filtrada:', await pg.$$eval('table.t tr.click', r => r.length), await pg.textContent('.note.mb'));
  await pg.screenshot({ path: CFG.saida('k3_despesas_item.png') });
  // novo item manual em USD com cálculo automático
  await pg.evaluate(id => A.itemPlanoNovo({ projeto: id, rubrica: '2.1' }), P);
  await pg.fill('#fld_descricao', 'Sonda lambda banda larga'); await pg.selectOption('#fld_moeda', 'USD'); await pg.fill('#fld_quantidade', '2'); await pg.fill('#fld_valor_unitario', '1500'); await pg.fill('#fld_cambio', '5.4');
  await pg.click('#m_ok'); await pg.waitForTimeout(150);
  const S = await pg.evaluate(id => D.plano_itens.find(i => i.projeto_id === id && /^Sonda/.test(i.descricao)), P);
  log('item USD:', S.numero, S.valor_previsto, S.origem, S.moeda);
  // analisador adquirido → infraestrutura
  const AN = await pg.evaluate(id => D.plano_itens.find(i => i.projeto_id === id && /^Analisa/.test(i.descricao)).id, P);
  await pg.evaluate(a => Data.update('plano_itens', a, { status: 'adquirido' }), AN);
  await pg.evaluate(id => { UI.sub.projFin = 'plano'; A.projAbrir({ id, aba: 'financeiro' }); }, P); await pg.waitForTimeout(100);
  await pg.click(`[data-a="itemParaInfra"][data-id="${AN}"]`); await pg.fill('#fld_codigo', 'AN-02'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('infra:', await pg.evaluate(a => { const i = byId('plano_itens', a), inf = byId('infra_itens', i.infra_item_id); return [inf.nome, inf.codigo, inf.categoria, siglaProjeto(inf.projeto_aquisicao_id)]; }, AN));
  await pg.screenshot({ path: CFG.saida('k4_plano_depois.png'), fullPage: true });
  // membro não vê
  log('membro:', await pg.evaluate(async id => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); const r = await Data.insert('plano_itens', { projeto_id: id, rubrica: '1.3', descricao: 'x' }).then(() => 'aceitou', e => e.message); render(); A.projAbrir({ id, aba: 'financeiro' }); return [Perm.veFin(id), r, document.querySelectorAll('.ptab[data-v="financeiro"]').length]; }, P));
  // reimportar não duplica
  await pg.evaluate(() => aplicarSim({ papel: 'direcao', pessoa_id: null }));
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(id => A.importarPlanilha({ projeto: id }), P)]);
  await fc2.setFiles(XL); await pg.waitForSelector('#im_ok'); await pg.click('#im_ok'); await pg.waitForTimeout(1200);
  log('reimport itens:', await pg.evaluate(id => [D.plano_itens.filter(i => i.projeto_id === id).length, byId('plano_itens', D.plano_itens.find(i => /^Analisa/.test(i.descricao)).id).status], P));
  // excluir item mantém despesas
  log('excluir item:', await pg.evaluate(async it => { await Data.remove('plano_itens', it); return D.despesas.filter(d => /pistões/i.test(d.descricao)).map(d => [d.rubrica, d.item_id]); }, IT));
  // módulo Financeiro › Plano de aplicação
  await pg.evaluate(id => { UI.tab = 'financeiro'; UI.sub.fin = 'plano'; UI.f.finProj = id; UI.projeto = null; render(); }, P); await pg.screenshot({ path: CFG.saida('k5_modulo.png') });
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
