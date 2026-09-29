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
  log('avisos:', await pg.$eval('#modal-root .note', e => e.innerText.split('\n').slice(1).join(' | ') || '(nenhum)'));
  await pg.$eval('#im_plano', e => e.scrollIntoView()); await pg.screenshot({ path: CFG.saida('j1_previa.png') });
  await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(900);
  log('flash:', await pg.textContent('#flash'));
  const P = await pg.evaluate(() => D.projetos.find(x => x.sigla === 'MOVER-FUNDEP').id);
  log('plano:', await pg.evaluate(id => { const E = Calc.equipePlano(byId('projetos', id)); return JSON.stringify({ tot: E.tot, fora: E.fora.map(a => nomePessoa(a.pessoa_id)),
    rows: E.rows.map(r => [r.e.nome_plano.slice(0, 26), r.e.categoria, r.e.status, r.pessoa ? r.pessoa.nome : '-', r.e.horas_semanais, r.bolsa ? r.bolsa.modalidade.slice(0, 22) + ' ' + r.bolsa.valor_mensal + 'x' + r.bolsa.meses : '-', r.e.etapas.length].join(' | ')) }, null, 1); }, P));
  await pg.evaluate(id => A.projAbrir({ id, aba: 'equipe' }), P); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('j2_equipe.png'), fullPage: true });
  // preencher vaga com pessoa nova, bolsa 24m
  const V = await pg.evaluate(id => D.equipe_plano.find(e => e.projeto_id === id && e.nome_plano.startsWith('Bolsista de Mestrado 1')).id, P);
  await pg.click(`[data-a="vagaPreencher"][data-id="${V}"]`); await pg.waitForTimeout(100);
  log('sugestão meses:', await pg.inputValue('#fld_b_meses'));
  await pg.screenshot({ path: CFG.saida('j3_preencher.png') });
  await pg.fill('#fld_nome', 'Ana Teste da Silva'); await pg.fill('#fld_email', 'ana.teste@acad.ufsm.br'); await pg.fill('#fld_desde', '2026-10-01'); await pg.fill('#fld_b_ini', '2026-10-01'); await pg.fill('#fld_b_meses', '24');
  await pg.click('#m_ok'); await pg.waitForTimeout(300); log('flash:', await pg.textContent('#flash'));
  const st = () => pg.evaluate(v => { const r = linhaVaga(v); const al = D.alocacoes.find(a => a.pessoa_id === r.e.pessoa_id && a.projeto_id === r.e.projeto_id);
    return [r.e.status, r.pessoa && r.pessoa.nome, r.vincs.map(x => nomePessoa(x.pessoa_id) + ' ' + x.inicio + '→' + x.fim + ' ' + x.status).join('; '), 'usados ' + r.mesesVinc, 'rest ' + r.mesesRest, al ? al.carga_pct + '% ' + al.status : 'sem aloc']; }, V);
  log('após preencher:', await st());
  // liberar em 31/03/2027
  await pg.click(`[data-a="vagaLiberar"][data-id="${V}"]`); await pg.fill('#fld_saida', '2027-03-31'); await pg.click('#m_ok'); await pg.waitForTimeout(300);
  log('após liberar:', await st(), await pg.evaluate(v => byId('equipe_plano', v).obs, V));
  log('Ana alocação:', await pg.evaluate(id => { const a = D.alocacoes.find(a => a.projeto_id === id && nomePessoa(a.pessoa_id).startsWith('Ana')); return a.status; }, P));
  // substituir: sugestão deve ser 18
  await pg.click(`[data-a="vagaPreencher"][data-id="${V}"]`); log('sugestão meses substituto:', await pg.inputValue('#fld_b_meses'));
  await pg.fill('#fld_nome', 'Bruno Substituto'); await pg.fill('#fld_desde', '2027-04-01'); await pg.fill('#fld_b_ini', '2027-04-01'); await pg.fill('#fld_b_meses', '19'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('19 meses → erro:', await pg.textContent('#m_err'), '| posição após erro:', await pg.evaluate(v => byId('equipe_plano', v).status, V));
  await pg.click('#m_cancel');
  log('NOTA estado após erro parcial:', await st());
  // gerar bolsa para Mario (COG)
  const M = await pg.evaluate(id => D.equipe_plano.find(e => e.projeto_id === id && e.status === 'ocupada' && nomePessoa(e.pessoa_id).startsWith('Mario')).id, P);
  await pg.evaluate(id => A.projAbrir({ id, aba: 'equipe' }), P); await pg.click(`[data-a="vagaBolsa"][data-id="${M}"]`); log('Mario sugestão:', await pg.inputValue('#fld_inicio'), await pg.inputValue('#fld_meses'));
  await pg.click('#m_ok'); await pg.waitForTimeout(200); log('flash:', await pg.textContent('#flash'));
  // editar bolsa prevista pelo formulário
  const G = await pg.evaluate(id => D.equipe_plano.find(e => e.projeto_id === id && e.nome_plano.startsWith('Bolsista de Graduação 1')).id, P);
  await pg.click(`tr[data-a="vagaEditar"][data-id="${G}"]`); await pg.fill('#fld_b_valor', '1200'); await pg.fill('#fld_b_meses', '36'); await pg.selectOption('#fld_status', 'selecao'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('edição:', await pg.evaluate(g => { const r = linhaVaga(g); return [r.e.status, r.bolsa.valor_mensal, r.bolsa.meses]; }, G));
  log('conferência:', await pg.evaluate(() => (document.querySelector('.note.small.mb') || {}).innerText || '—'));
  // membro sem permissão
  log('Nicholas preenche:', await pg.evaluate(v => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); return Data.update('equipe_plano', v, { obs: 'x' }).then(() => 'aceitou', e => e.message); }, V));
  log('Nicholas bolsa:', await pg.evaluate(g => Data.update('equipe_plano_bolsas', D.equipe_plano_bolsas.find(b => b.vaga_id === g).id, { valor_mensal: 1 }).then(() => 'aceitou', e => e.message), G));
  await pg.evaluate(id => { render(); A.projAbrir({ id, aba: 'equipe' }); }, P); await pg.waitForTimeout(100);
  log('membro vê coluna bolsa?', await pg.evaluate(() => document.body.innerText.includes('Bolsa prevista')), '| botões:', await pg.$$eval('[data-a^="vaga"]', x => x.length));
  await pg.screenshot({ path: CFG.saida('j4_membro.png'), fullPage: true });
  // Direção: excluir posição com bolsa vinculada
  log('excluir posição:', await pg.evaluate(async v => { aplicarSim({ papel: 'direcao', pessoa_id: null }); const n = D.vinculos_financeiros.filter(x => x.vaga_id === v).length; await Data.remove('equipe_plano', v);
    return [n, D.vinculos_financeiros.filter(x => x.vaga_id === v).length, D.equipe_plano_bolsas.filter(x => x.vaga_id === v).length]; }, V));
  // reimportar
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(id => A.importarPlanilha({ projeto: id }), P)]);
  await fc2.setFiles(XL); await pg.waitForSelector('#im_ok'); await pg.click('#im_ok'); await pg.waitForTimeout(900);
  log('reimport:', await pg.textContent('#flash'), await pg.evaluate(id => [D.equipe_plano.filter(e => e.projeto_id === id).length, D.equipe_plano_bolsas.filter(e => e.projeto_id === id).length], P));
  await pg.evaluate(id => A.projAbrir({ id, aba: 'resumo' }), P); await pg.screenshot({ path: CFG.saida('j5_resumo.png') });
  await pg.evaluate(id => { A.finAbrirBolsas({ id }); }, P); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('j6_bolsas.png'), fullPage: true });
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
