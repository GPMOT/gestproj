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
  const P = await pg.evaluate(() => D.projetos.find(x => x.sigla === 'MOVER-FUNDEP').id);
  log('checklist itens:', await pg.evaluate(() => D.checklist_itens.length));
  // Vagas
  await pg.evaluate(() => { UI.tab = 'equipe'; UI.sub.equipe = 'vagas'; render(); }); await pg.waitForTimeout(100);
  log('abas equipe:', await pg.$$eval('.subtabs .chip', x => x.map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')));
  log('vagas listadas:', await pg.$$eval('[data-a="vagaPreencher"]', x => x.length));
  await pg.screenshot({ path: CFG.saida('q1_vagas.png'), fullPage: true });
  const V = await pg.evaluate(id => D.equipe_plano.find(e => e.projeto_id === id && e.nome_plano.startsWith('Bolsista de Mestrado 2')).id, P);
  await pg.click(`[data-a="vagaSelecao"][data-id="${V}"]`); await pg.fill('#fld_requisitos', 'Eng. Mecânica; interesse em motores; MATLAB'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('vaga após abrir seleção:', await pg.evaluate(v => [byId('equipe_plano', v).status, byId('equipe_plano', v).selecao_prazo], V));
  for (const [n, e, st, nota] of [['Bruna Candidata', 'bruna.c@acad.ufsm.br', 'aprovado', '9.2'], ['Carlos Candidato', '', 'entrevista', '7.5'], ['Diego Candidato', '', 'inscrito', '']]) {
    await pg.click(`[data-a="candNovo"][data-vaga="${V}"]`); await pg.fill('#fld_nome', n); if (e) await pg.fill('#fld_email', e); await pg.fill('#fld_curso', 'Eng. Mecânica'); await pg.selectOption('#fld_status', st); if (nota) await pg.fill('#fld_nota', nota); await pg.click('#m_ok'); await pg.waitForTimeout(120);
  }
  await pg.screenshot({ path: CFG.saida('q2_candidatos.png'), fullPage: true });
  const C = await pg.evaluate(() => D.candidatos.find(c => c.nome.startsWith('Bruna')).id);
  await pg.click(`[data-a="candContratar"][data-id="${C}"]`); await pg.waitForTimeout(100);
  log('preencher pré:', await pg.inputValue('#fld_nome'), await pg.inputValue('#fld_email'));
  await pg.fill('#fld_desde', '2026-10-01'); await pg.fill('#fld_b_ini', '2026-10-01'); await pg.click('#m_ok'); await pg.waitForTimeout(250);
  log('flash:', await pg.textContent('#flash'));
  const B = await pg.evaluate(() => D.pessoas.find(p => p.nome.startsWith('Bruna')));
  log('Bruna:', B.tipo, B.ingresso, B.curso, '| candidatos:', await pg.evaluate(() => D.candidatos.map(c => c.nome.split(' ')[0] + ':' + c.status).join(' ')));
  // entrada e saída
  await pg.evaluate(() => { UI.sub.equipe = 'transicao'; render(); }); await pg.waitForTimeout(100);
  log('em integração:', await pg.$$eval('.card .link.bold', x => x.map(e => e.innerText).join(', ')));
  const chk = await pg.$$(`input[data-chk^="${B.id}|"]`); log('itens Bruna:', chk.length);
  await pg.click(`input[data-chk^="${B.id}|"] >> nth=0`); await pg.waitForTimeout(150); await pg.click(`input[data-chk^="${B.id}|"] >> nth=1`); await pg.waitForTimeout(150);
  log('marcados:', await pg.evaluate(id => D.pessoa_checklist.filter(r => r.pessoa_id === id).length, B.id));
  await pg.screenshot({ path: CFG.saida('q3_transicao.png'), fullPage: true });
  // bolsas
  await pg.evaluate(async id => { const pe = D.pessoas.find(p => p.nome.startsWith('Jean')); await Data.insert('vinculos_financeiros', { pessoa_id: pe.id, projeto_id: id, tipo: 'tecnico', rubrica: '1.1.2', modalidade: 'CLT', valor_mensal: 9328, inicio: '2025-03-01', fim: addDays(hoje(), 20), status: 'ativo' }); }, P);
  await pg.evaluate(() => { UI.sub.equipe = 'bolsas'; render(); }); await pg.waitForTimeout(100);
  log('bolsas métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')));
  await pg.screenshot({ path: CFG.saida('q4_bolsas.png'), fullPage: true });
  // ficha
  await pg.evaluate(id => A.pessoaAbrir({ id }), B.id); await pg.waitForTimeout(100); await pg.screenshot({ path: CFG.saida('q5_ficha.png'), fullPage: true });
  log('ficha tem posição/checklist:', await pg.evaluate(() => [/posições no plano/i.test(document.body.innerText), /integração \(entrada\)/i.test(document.body.innerText)]));
  // membro não marca checklist, não vê candidatos
  log('membro:', await pg.evaluate(async bid => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id });
    const r = await Data.insert('pessoa_checklist', { pessoa_id: bid, item_id: D.checklist_itens[3].id }).then(() => 'aceitou', e => e.message);
    UI.tab = 'equipe'; UI.pessoa = null; UI.sub.equipe = 'vagas'; render(); return [r, document.querySelectorAll('[data-a="vgCand"]').length, document.querySelectorAll('[data-a="vagaPreencher"]').length, SUBS_EQUIPE().map(x => x[0]).join(',')]; }, B.id));
  // liberar Bruna → desligamento
  await pg.evaluate(() => aplicarSim({ papel: 'direcao', pessoa_id: null }));
  await pg.evaluate(id => A.projAbrir({ id, aba: 'equipe' }), P);
  await pg.click(`[data-a="vagaLiberar"][data-id="${V}"]`); log('saida_lab marcado:', await pg.$eval('#fld_saida_lab', e => e.checked)); await pg.fill('#fld_saida', '2027-03-31'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('Bruna saída:', await pg.evaluate(id => byId('pessoas', id).saida, B.id));
  await pg.evaluate(() => { UI.tab = 'equipe'; UI.sub.equipe = 'transicao'; render(); });
  log('transição:', await pg.evaluate(() => Calc.emTransicao().map(x => x.pe.nome.split(' ')[0] + ':' + x.fase + ':' + x.falta).join(' ')));
  // concluir saída: marcar todos e inativar
  await pg.evaluate(async id => { const pe = byId('pessoas', id); for (const x of Calc.checklistPessoa(pe, 'saida')) if (!x.reg) await Data.insert('pessoa_checklist', { pessoa_id: id, item_id: x.i.id, data: hoje() }); render(); }, B.id);
  await pg.click(`[data-a="pessoaInativar"][data-id="${B.id}"]`); await pg.click('#c_yes'); await pg.waitForTimeout(200);
  log('Bruna ativo:', await pg.evaluate(id => byId('pessoas', id).ativo, B.id));
  // configurar itens
  await pg.click('[data-a="chkConfig"]'); await pg.click('[data-a="chkItemNovo"][data-fase="entrada"]'); await pg.fill('#fld_nome', 'Cadastro no SIE / matrícula no PPG'); await pg.check('#fld_tipos input[value="mestrando"]'); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  log('itens entrada:', await pg.evaluate(() => D.checklist_itens.filter(i => i.fase === 'entrada').length));
  // painel
  await pg.evaluate(() => A.nav({ t: 'painel' })); log('painel:', await pg.$$eval('.alert', a => a.map(x => x.innerText.slice(0, 70)).filter(t => /Bolsa de|seleção|integração|desligamento/.test(t))));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
