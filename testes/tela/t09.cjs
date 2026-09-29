const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
const XL = CFG.PLANILHA;
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push('CONSOLE ' + m.text()); });
  const log = (...a) => console.log(...a);
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); A.nav({t:'projetos'}); }, old);
  // abrir importador
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a="importarPlanilha"]')]);
  await fc.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 });
  await pg.screenshot({ path: CFG.saida('i1_previa.png'), fullPage: false });
  const info = await pg.evaluate(() => ({ nsel: document.querySelector('#im_nsel').textContent, eq: document.querySelectorAll('.im-eq').length, eqck: document.querySelectorAll('.im-eq:checked').length, sigla: document.querySelector('#im_sigla').value,
    sel: [...document.querySelectorAll('.im-at:checked')].map(x => x.dataset.cod).join(' ') , txt: document.querySelector('#modal-root .kv').innerText.replace(/\n/g,' | ') }));
  log('prévia:', JSON.stringify(info, null, 1));
  await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01');
  await pg.click('#im_ok'); await pg.waitForTimeout(800);
  log('flash:', await pg.textContent('#flash'));
  const P = await pg.evaluate(() => { const p = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'); const o = Calc.orcamento(p); const c = Calc.cronograma(p);
    return { id: p.id, p: [p.nome, p.programa, p.chamada, p.inicio, p.fim, p.valor_total, p.fundacao_apoio, p.financiador], orcTot: o.tot, entT: D.entregas.filter(e=>e.projeto_id===p.id).map(e=>e.titulo+' '+e.prazo),
      aloc: D.alocacoes.filter(a => a.projeto_id === p.id).map(a => nomePessoa(a.pessoa_id) + (a.coordena ? '*' : '')).join('; '), crono: c.rows.length, folhas: c.tot.folhas, pct: c.tot.pct, prev: c.tot.prev,
      comResp: D.cronograma.filter(x => x.projeto_id === p.id && x.responsavel_id).length, ent: D.entregas.filter(e => e.projeto_id === p.id).length }; });
  log('projeto:', JSON.stringify(P, null, 1));
  await pg.screenshot({ path: CFG.saida('i2_cronograma.png'), fullPage: true });
  // 2ª importação no mesmo projeto: não deve duplicar
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(id => A.importarPlanilha({ projeto: id }), P.id)]);
  await fc2.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 });
  log('destino pré-selecionado:', await pg.$eval('#im_dest', s => s.value === '' ? 'novo' : 'existente'));
  await pg.click('#im_ok'); await pg.waitForTimeout(800);
  log('reimport:', await pg.evaluate(id => [D.cronograma.filter(x => x.projeto_id === id).length, D.orcamento_rubricas.filter(x => x.projeto_id === id).length, D.alocacoes.filter(x => x.projeto_id === id).length], P.id));
  // importar em projeto existente (GLASSI)
  const G = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'GLASSI').id);
  const [fc3] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(id => A.importarPlanilha({ projeto: id }), G)]);
  await fc3.setFiles(XL); await pg.waitForSelector('#im_ok'); await pg.click('#im_nenhuma'); await pg.check('.im-at[data-cod="2.1"]'); await pg.click('#im_ok'); await pg.waitForTimeout(600);
  log('GLASSI:', await pg.evaluate(id => { const p = byId('projetos', id); return [p.programa, p.nome, D.cronograma.filter(x => x.projeto_id === id).map(x => x.codigo).join(',')]; }, G));
  // UI cronograma: filtros, gantt, editar
  await pg.evaluate(id => A.projAbrir({ id, aba: 'cronograma' }), P.id); await pg.waitForTimeout(150);
  for (const f of ['atual', 'atrasadas', 'concluidas', 'todas']) { const el = await pg.$(`[data-a="cronFiltro"][data-f="${f}"]`) ; if (el) { await el.click(); await pg.waitForTimeout(60); } }
  log('svg gantt:', await pg.$$eval('.crtg svg, svg', s => s.length));
  // responsável atualiza %; outro membro não
  const R2 = await pg.evaluate(async id => { const a0 = D.cronograma.find(x => x.projeto_id === id && x.mes_inicio); await Data.update('cronograma', a0.id, { responsavel_id: D.pessoas.find(p => p.nome.startsWith('Roberto')).id }); const a = byId('cronograma', a0.id); return a ? { id: a.id, resp: a.responsavel_id, n: nomePessoa(a.responsavel_id) } : null; }, P.id);
  log('atividade c/ resp:', R2 && R2.n);
  if (R2) {
    log('resp atualiza %:', await pg.evaluate(r => { aplicarSim({ papel: 'membro', pessoa_id: r.resp }); return Data.update('cronograma', r.id, { percentual: 50 }).then(x => x.status, e => e.message); }, R2));
    log('resp muda meses:', await pg.evaluate(r => Data.update('cronograma', r.id, { mes_fim: 40 }).then(() => 'aceitou', e => e.message), R2));
    log('resp 100%:', await pg.evaluate(r => Data.update('cronograma', r.id, { percentual: 100 }).then(x => [x.status, x.data_conclusao], e => e.message), R2));
    log('outro membro:', await pg.evaluate(r => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.id !== r.resp && p.nome.startsWith('Nicholas')).id }); return Data.update('cronograma', r.id, { percentual: 10 }).then(() => 'aceitou', e => e.message); }, R2));
  }
  // vínculo tarefa ↔ atividade e exclusão
  log('tarefa vinc:', await pg.evaluate(async id => { aplicarSim({ papel: 'direcao', pessoa_id: null }); const a = D.cronograma.find(x => x.projeto_id === id && x.mes_inicio);
    const t = await Data.insert('tarefas', { projeto_id: id, titulo: 'Tarefa teste', atividade_id: a.id }); await Data.remove('cronograma', a.id); return byId('tarefas', t.id).atividade_id; }, P.id));
  await pg.evaluate(id => A.projAbrir({ id, aba: 'cronograma' }), P.id); await pg.click('[data-a="atividadeNova"]'); await pg.waitForTimeout(100);
  await pg.screenshot({ path: CFG.saida('i3_form.png') }); await pg.click('#m_cancel'); await pg.click('[data-a="sub"][data-v="gantt"]'); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('i6_gantt.png'), fullPage: true }); await pg.click('[data-a="sub"][data-v="tabela"]');
  await pg.evaluate(id => A.projAbrir({ id, aba: 'resumo' }), P.id); await pg.screenshot({ path: CFG.saida('i4_resumo.png'), fullPage: true });
  await pg.evaluate(id => A.projAbrir({ id, aba: 'financeiro' }), P.id); await pg.screenshot({ path: CFG.saida('i5_fin.png'), fullPage: true });
  log('rel:', await pg.evaluate(() => /Cronograma/i.test(relMD(montarRelatorio()))));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
