const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const log = (...a) => console.log(...a);
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); render(); }, old);
  const G = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'GLASSI').id);
  // 1) editar dados do contrato
  await pg.evaluate(id => A.projAbrir({ id }), G); await pg.click('.ptab[data-v="contrato"]'); await pg.click('[data-a="projEditar"]');
  await pg.fill('#fld_programa', 'Rota 2030'); await pg.fill('#fld_chamada', 'Linha V — Biocombustíveis'); await pg.fill('#fld_numero_contrato', 'FDMS 045/2023');
  await pg.fill('#fld_fundacao_apoio', 'FDMS'); await pg.fill('#fld_contrapartida', '120000'); await pg.fill('#fld_data_assinatura', '2023-12-15'); await pg.fill('#fld_resumo', 'Desenvolvimento de sistema glowplug para motor diesel/etanol.');
  await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('1) contrato:', await pg.evaluate(id => { const p = byId('projetos', id); return [p.programa, p.numero_contrato, p.contrapartida, p.data_assinatura]; }, G));
  // 2) aditivo de prazo pelo formulário
  await pg.click('[data-a="aditivoNovo"]'); await pg.fill('#fld_data_assinatura', '2025-11-20'); await pg.fill('#fld_novo_fim', '2026-12-31'); await pg.fill('#fld_justificativa', 'Atraso no recebimento do motor e dos componentes importados.'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('2) após 1º TA:', await pg.evaluate(id => { const p = byId('projetos', id); return [p.fim, Calc.vencido(p), Calc.vigenciaOriginal(p)]; }, G));
  await pg.click('[data-a="aditivoNovo"]'); await pg.selectOption('#fld_tipo', 'valor'); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  log('2) aditivo de valor sem valor → erro:', await pg.textContent('#m_err'));
  await pg.fill('#fld_novo_valor', '620000'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('2) valor:', await pg.evaluate(id => [byId('projetos', id).valor_total, Calc.valorOriginal(byId('projetos', id))], G));
  await pg.screenshot({ path: CFG.saida('g1_contrato.png'), fullPage: true });
  // 3) excluir 2º TA desfaz valor
  await pg.click('tr[data-a="aditivoEditar"] >> nth=1'); await pg.click('#m_del'); await pg.click('#c_yes'); await pg.waitForTimeout(150);
  log('3) após excluir 2º TA:', await pg.evaluate(id => [byId('projetos', id).valor_total, D.aditivos.length], G));
  // 4) série de entregas
  const V = await pg.evaluate(() => D.projetos.find(p => p.sigla === 'VCR-VW').id);
  await pg.evaluate(id => A.projAbrir({ id, aba: 'entregas' }), V); await pg.click('[data-a="entregaSerie"]'); await pg.fill('#fld_primeiro', '2025-06-30'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('4) série:', await pg.evaluate(id => D.entregas.filter(e => e.projeto_id === id).map(e => [e.titulo, e.prazo, e.status]), V));
  await pg.click('[data-a="entregaSerie"]'); await pg.fill('#fld_primeiro', '2025-06-30'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('4) repetir série → erro:', await pg.textContent('#m_err')); await pg.click('#m_cancel');
  await pg.screenshot({ path: CFG.saida('g2_entregas_proj.png'), fullPage: true });
  // 5) responsável marca entregue; outro membro não consegue
  const r = await pg.evaluate(id => { const e = D.entregas.find(x => x.projeto_id === id && x.titulo.startsWith('1º')); return { id: e.id, resp: nomePessoa(e.responsavel_id) }; }, V);
  log('5) responsável da 1ª:', r.resp);
  log('5) Nicholas (não responsável):', await pg.evaluate(eid => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); return Data.update('entregas', eid, { status: 'entregue' }).then(() => 'aceitou', e => e.message); }, r.id));
  await pg.evaluate(eid => Data.update('entregas', eid, { responsavel_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }).catch(() => 0), r.id);
  log('5) Direção passa responsabilidade a Nicholas; Nicholas marca entregue:', await pg.evaluate(async eid => {
    aplicarSim({ papel: 'direcao', pessoa_id: null }); await Data.update('entregas', eid, { responsavel_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id });
    aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); await Data.update('entregas', eid, { status: 'entregue', documento: 'https://drive.google.com/x' });
    const e = byId('entregas', eid); return [e.status, e.data_entrega]; }, r.id));
  log('5) Nicholas tenta mudar prazo (campo bloqueado na tela; no dado ele pode por ser responsável?):', await pg.evaluate(eid => Data.update('entregas', eid, { prazo: '2030-01-01' }).then(() => 'aceitou', e => e.message), r.id));
  log('5) Nicholas cria entrega → bloqueia:', await pg.evaluate(id => Data.insert('entregas', { projeto_id: id, titulo: 'x', prazo: hoje() }).then(() => 'aceitou', e => e.message), V));
  log('5) Nicholas registra aditivo → bloqueia:', await pg.evaluate(id => Data.insert('aditivos', { projeto_id: id, tipo: 'prazo', novo_fim: '2030-01-01' }).then(() => 'aceitou', e => e.message), V));
  // 6) telas
  await pg.evaluate(() => { aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Mario')).id }); A.nav({ t: 'entregas' }); });
  await pg.screenshot({ path: CFG.saida('g3_entregas.png'), fullPage: true });
  await pg.evaluate(() => A.nav({ t: 'painel' })); await pg.screenshot({ path: CFG.saida('g4_painel.png'), fullPage: true });
  await pg.evaluate(id => A.projAbrir({ id }), V); await pg.screenshot({ path: CFG.saida('g5_resumo.png'), fullPage: true });
  for (const a of ['equipe', 'tarefas', 'financeiro', 'historico']) { await pg.click(`.ptab[data-v="${a}"]`); await pg.waitForTimeout(80); }
  // 7) relatório + backup roundtrip includes new tables
  log('7) relatório:', await pg.evaluate(() => { const md = relMD(montarRelatorio()); return [/Entregas e prazos em aberto/.test(md), /original até/.test(md)]; }));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
