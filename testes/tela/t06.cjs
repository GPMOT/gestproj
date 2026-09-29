const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const log = (...a) => console.log(...a);
  // A) migração de dados locais da v2.0
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  const bk = JSON.parse(fs.readFileSync(CFG.BACKUP, 'utf8'));
  await pg.evaluate(bk => { localStorage.clear(); Object.entries(bk.tabelas).forEach(([t, v]) => localStorage.setItem('gpmot2:' + t, JSON.stringify(v))); localStorage.setItem('gpmot2:_seed', '2026-09-23'); }, bk);
  await pg.reload(); await pg.waitForTimeout(300);
  log('A) migração v2.0:', await pg.evaluate(() => ({ rub: D.rubricas.map(r => r.codigo).join(','), orc: D.orcamento_rubricas.map(o => [siglaProjeto(o.projeto_id), o.rubrica, o.aprovado, o.previsto]), desp: D.despesas.length, vinc: D.vinculos_financeiros.map(v => v.rubrica), tipos: [...new Set(D.projetos.map(p => p.tipo))], old: localStorage.getItem('gpmot2:orcamento_linhas') })));
  // B) importação v1
  await pg.evaluate(d => { localStorage.clear(); Local.load(); const { T, avisos } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); render(); window._av = avisos; }, old);
  log('B) v1 → orçamento:', await pg.evaluate(() => [D.orcamento_rubricas.map(o => [siglaProjeto(o.projeto_id), o.rubrica, o.aprovado, o.previsto]), window._av.filter(a => /Orçamento|Edital/.test(a))]));
  // C) projeto de edital: preencher orçamento no modelo da planilha
  const pid = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'VCR-VW').id);
  await pg.evaluate(id => A.projAbrir({ id, aba: 'financeiro' }), pid); await pg.waitForTimeout(150);
  const vals = { '1.1.1': [2554848, 2400000], '1.1.2': [447744, 447744], '1.2.1': [124000, 100000], '1.2.2': [119600, 119600], '1.3': [665367.40, 600000], '1.4': [567096.05, 567096.05], '1.5': [701770.96, 701770.96], '2.1': [2539054.10, 2600000], '2.2': [0, 0] };
  for (const [c, [ap, pr]] of Object.entries(vals)) {
    if (ap) { await pg.fill(`input[data-orc="${pid}|${c}|aprovado"]`, String(ap)); await pg.press(`input[data-orc="${pid}|${c}|aprovado"]`, 'Tab'); await pg.waitForTimeout(60); }
    if (pr) { await pg.fill(`input[data-orc="${pid}|${c}|previsto"]`, String(pr)); await pg.press(`input[data-orc="${pid}|${c}|previsto"]`, 'Tab'); await pg.waitForTimeout(60); }
  }
  log('C) foco após Tab:', await pg.evaluate(() => document.activeElement && document.activeElement.dataset.orc));
  log('C) totais:', await pg.evaluate(id => { const o = Calc.orcamento(byId('projetos', id)); return { tot: o.tot, custeio: o.rows.find(r => r.r.codigo === '1').aprovado, pessoal: o.rows.find(r => r.r.codigo === '1.1').aprovado, capital: o.rows.find(r => r.r.codigo === '2').aprovado }; }, pid));
  // D) lançar gastos pelo formulário
  await pg.click(`[data-a="despNova"][data-rubrica="2.1"]`); await pg.fill('#fld_valor', '2650000'); await pg.fill('#fld_descricao', 'Dinamômetro transiente'); await pg.fill('#fld_favorecido', 'AVL'); await pg.fill('#fld_documento', 'NF 1234'); await pg.click('#m_ok'); await pg.waitForTimeout(250);
  log('D) flash saldo negativo:', await pg.textContent('#flash'));
  await pg.click(`[data-a="despNova"][data-rubrica="1.2.1"]`); await pg.fill('#fld_valor', '3500'); await pg.fill('#fld_descricao', 'Passagens SAE Brasil'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: CFG.saida('f1_projeto_orc.png'), fullPage: true });
  log('D) 2.1 e 1.2.1:', await pg.evaluate(id => [Calc.valoresRubrica(id, '2.1'), Calc.valoresRubrica(id, '1.2.1')].map(v => [v.aprovado, v.executado, v.aprovado - v.executado]), pid));
  // E) validações
  log('E) grupo:', await pg.evaluate(id => Data.insert('despesas', { projeto_id: id, rubrica: '1.1', data: hoje(), descricao: 'x', valor: 1 }).then(() => 'aceitou', e => e.message), pid));
  log('E) valor 0:', await pg.evaluate(id => Data.insert('despesas', { projeto_id: id, rubrica: '1.3', data: hoje(), descricao: 'x', valor: 0 }).then(() => 'aceitou', e => e.message), pid));
  log('E) negativo no aprovado:', await pg.evaluate(id => { const o = D.orcamento_rubricas.find(x => x.projeto_id === id); return Data.update('orcamento_rubricas', o.id, { aprovado: -1 }).then(() => 'aceitou', e => e.message); }, pid));
  // F) despesas: filtro por rubrica ao clicar no executado + CSV
  await pg.click(`.execlink[data-rubrica="2.1"]`); await pg.waitForTimeout(150);
  log('F) tela despesas:', await pg.evaluate(() => [UI.tab, UI.sub.fin, UI.f.dpRub, document.querySelectorAll('table.t tr.click').length]));
  await pg.screenshot({ path: CFG.saida('f2_despesas.png'), fullPage: true });
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-a="despCSV"]')]); await dl.saveAs(CFG.saida('desp.csv')); log('F) CSV:', fs.readFileSync(CFG.saida('desp.csv'), 'utf8').split('\n').slice(0, 3).join(' | '));
  // G) bolsas → despesas
  const pet = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'Petrobras').id);
  await pg.evaluate(id => { UI.f.finProj = id; UI.sub.fin = 'bolsas'; render(); }, pet);
  await pg.click('[data-a="finConciliar"]'); await pg.waitForTimeout(100); await pg.click('#c_yes'); await pg.waitForTimeout(300);
  log('G) parcelas lançadas:', await pg.evaluate(id => [D.despesas.filter(d => d.projeto_id === id && d.vinculo_id).length, Calc.valoresRubrica(id, '1.1.1')], pet));
  log('G) repetir (não duplica):', await pg.evaluate(async id => { await A.finConciliar({ id }); return D.despesas.filter(d => d.projeto_id === id && d.vinculo_id).length; }, pet));
  await pg.screenshot({ path: CFG.saida('f3_bolsas.png'), fullPage: true });
  // H) tipo serviço + resumo
  await pg.evaluate(() => Data.update('projetos', D.projetos.find(p => p.sigla === 'SILENKAR').id, { tipo: 'servico' }));
  await pg.evaluate(() => { UI.sub.fin = 'resumo'; A.nav({ t: 'financeiro' }); });
  await pg.screenshot({ path: CFG.saida('f4_resumo.png'), fullPage: true });
  await pg.evaluate(() => A.nav({ t: 'projetos' })); await pg.selectOption('select[data-f="projTipo"]', 'servico'); await pg.waitForTimeout(100);
  log('H) filtro serviço:', await pg.evaluate(() => [...document.querySelectorAll('.pcard .link')].map(x => x.textContent)));
  // I) permissões
  const perm = await pg.evaluate(() => { const r = {}; const sim = (n, p) => aplicarSim({ papel: p, pessoa_id: D.pessoas.find(x => x.nome.startsWith(n)).id });
    sim('Nicholas', 'membro'); r.nicholas = D.projetos.filter(p => Perm.veFin(p.id)).length;
    sim('Mario', 'membro'); r.mario = D.projetos.filter(p => Perm.editaFin(p.id)).map(p => p.sigla);
    return r; });
  log('I) permissões:', perm);
  log('I) Mario lança gasto no Aramco:', await pg.evaluate(() => Data.insert('despesas', { projeto_id: D.projetos.find(p => p.sigla === 'Aramco').id, rubrica: '1.3', data: hoje(), descricao: 'x', valor: 10 }).then(() => 'aceitou', e => e.message)));
  // J) relatório
  await pg.evaluate(() => aplicarSim({ papel: 'direcao', pessoa_id: null }));
  const md = await pg.evaluate(() => relMD(montarRelatorio())); log('J) relatório tem orçamento por rubrica:', /VCR-VW — orçamento por rubrica/.test(md));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
