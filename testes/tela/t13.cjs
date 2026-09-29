const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const log = (...a) => console.log(...a);
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); }, old);
  const G = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'GLASSI').id);
  // aditivo + entrega entregue para o checklist
  await pg.evaluate(async id => { await Data.insert('aditivos', { projeto_id: id, numero: '1º Termo Aditivo', tipo: 'prazo', novo_fim: '2026-12-31', data_assinatura: '2025-11-20' });
    await Data.insert('entregas', { projeto_id: id, titulo: 'Relatório parcial 1', tipo: 'relatorio_parcial', prazo: '2025-06-30', status: 'entregue' }); }, G);
  await pg.evaluate(id => A.projAbrir({ id, aba: 'docs' }), G); await pg.waitForTimeout(100);
  log('checklist inicial:', await pg.evaluate(id => Calc.checklistDocs(byId('projetos', id)).map(c => (c.ok ? '✓ ' : '✗ ') + c.txt).join(' | '), G));
  // + adicionar contrato pelo checklist
  await pg.click('[data-a="docNovo"][data-tipo="contrato"]'); log('contrato pré:', await pg.inputValue('#fld_titulo'), await pg.$eval('#fld_restrito', e => e.checked));
  await pg.fill('#fld_url', 'drive.google.com/x'); await pg.click('#m_ok'); await pg.waitForTimeout(100); log('link sem https:', await pg.textContent('#m_err'));
  await pg.fill('#fld_url', 'https://drive.google.com/file/d/abc'); await pg.fill('#fld_numero', '23081.012345/2023-11'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  // TA pelo checklist
  await pg.click('[data-a="docNovo"][data-tipo="termo_aditivo"]'); log('TA pré:', await pg.inputValue('#fld_titulo'), await pg.inputValue('#fld_data'));
  await pg.fill('#fld_numero', 'SEI 4455667'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  // pendência
  await pg.click('[data-a="pendNova"]'); await pg.fill('#fld_titulo', 'Enviar certidões negativas à FDMS'); await pg.fill('#fld_origem', 'Ofício FDMS 12/2026');
  const nich = await pg.evaluate(() => D.pessoas.find(p => p.nome.startsWith('Nicholas')).id);
  const naEquipe = await pg.evaluate(([id, n]) => D.alocacoes.some(a => a.projeto_id === id && a.pessoa_id === n && a.status === 'ativo'), [G, nich]);
  log('Nicholas na equipe GLASSI?', naEquipe);
  const opt = await pg.$$eval('#fld_responsavel_id option', o => o.map(x => x.value).filter(Boolean)); await pg.selectOption('#fld_responsavel_id', naEquipe ? nich : opt[0]);
  await pg.fill('#fld_prazo', '2026-09-01'); await pg.selectOption('#fld_prioridade', 'alta'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: CFG.saida('n1_docs.png'), fullPage: true });
  log('aba badge:', await pg.$eval('.ptab[data-v="docs"]', e => e.innerText));
  const PD = await pg.evaluate(() => D.pendencias[0]);
  // responsável: resolve; não muda prazo
  log('resp muda prazo:', await pg.evaluate(async pd => { aplicarSim({ papel: 'membro', pessoa_id: pd.responsavel_id }); return Data.update('pendencias', pd.id, { prazo: '2030-01-01' }).then(() => 'aceitou', e => e.message); }, PD));
  await pg.evaluate(id => A.nav({ t: 'painel' }), G); await pg.waitForTimeout(100);
  log('painel minhas pendências:', await pg.evaluate(() => /pendências sob minha/i.test(document.body.innerText)), '| alerta:', await pg.$$eval('.alert', a => a.filter(x => /pendência/.test(x.innerText)).length));
  await pg.screenshot({ path: CFG.saida('n2_painel.png') });
  await pg.evaluate(id => A.projAbrir({ id, aba: 'docs' }), G); await pg.waitForTimeout(100);
  log('resp vê contrato restrito?', await pg.evaluate(() => document.body.innerText.includes('Contrato —')));
  const resp = await pg.evaluate(() => ({ papel: ME.papel, pessoa: ME.pessoa_id }));
  await pg.click(`[data-a="pendResolver"][data-id="${PD.id}"]`); await pg.fill('#fld_resolucao', 'Certidões enviadas por e-mail em 20/09'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('resolvida:', await pg.evaluate(id => { const x = byId('pendencias', id); return [x.status, x.resolvida_em, x.resolucao]; }, PD.id));
  // membro alocado inclui relatório (não restrito); tenta restrito
  log('membro inclui:', await pg.evaluate(async id => { const e = D.entregas.find(x => x.projeto_id === id && x.titulo === 'Relatório parcial 1');
    const a = await Data.insert('documentos', { projeto_id: id, tipo: 'relatorio', titulo: 'Relatório parcial 1', url: 'https://drive/r1', entrega_id: e.id }).then(() => 'ok', e => e.message);
    const r = await Data.insert('documentos', { projeto_id: id, tipo: 'outro', titulo: 'x', url: 'https://x', restrito: true }).then(() => 'aceitou restrito', e => e.message); return [a, r]; }, G));
  log('checklist final:', await pg.evaluate(id => Calc.checklistDocs(byId('projetos', id)).map(c => (c.ok ? '✓ ' : '✗ ') + c.txt).join(' | '), G));
  // não alocado
  log('não alocado:', await pg.evaluate(async id => { const out = D.pessoas.find(p => !D.alocacoes.some(a => a.projeto_id === id && a.pessoa_id === p.id)); aplicarSim({ papel: 'membro', pessoa_id: out.id });
    return Data.insert('documentos', { projeto_id: id, titulo: 'x', url: 'https://x' }).then(() => 'aceitou', e => e.message); }, G));
  // excluir entrega → documento fica sem vínculo; filtros
  await pg.evaluate(() => aplicarSim({ papel: 'direcao', pessoa_id: null }));
  await pg.evaluate(id => { UI.f.pdSt = 'resolvidas'; A.projAbrir({ id, aba: 'docs' }); }, G); await pg.screenshot({ path: CFG.saida('n3_docs_final.png'), fullPage: true });
  log('rel:', await pg.evaluate(() => relMD(montarRelatorio()).length > 0));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
