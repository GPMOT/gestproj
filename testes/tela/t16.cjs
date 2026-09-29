const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
const XL = CFG.PLANILHA;
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const log = (...a) => console.log(...a);
  await pg.goto(CFG.APP); await pg.waitForTimeout(200);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Mario')).id }); A.nav({t:'projetos'}); }, old);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a="importarPlanilha"]')]);
  await fc.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 }); await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(1500);
  await pg.evaluate(async () => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'), c = cod => D.cronograma.find(x => x.projeto_id === P.id && x.codigo === cod);
    for (const [cod, pc, dt, ev] of [['2.1', 100, '2025-05-20', 'Portaria de equipe 12/2025'], ['2.5.1', 100, '2025-07-30', 'Relatório técnico RT-01'], ['2.6.1', 100, '2025-12-15', 'Modelo CAD v1'], ['2.2', 60], ['2.3', 55], ['2.4', 40], ['2.5.3', 70], ['2.6.2', 80], ['2.7.1', 50], ['3.1', 40], ['3.2', 40], ['3.3', 35], ['3.4', 35], ['3.5', 35]]) {
      const x = c(cod); if (!x) continue; await Data.update('cronograma', x.id, { percentual: pc, ...(dt ? { data_conclusao: dt, status: 'concluida', evidencia: ev } : {}) }); }
    await Data.update('cronograma', c('2.7.1').id, { obs: 'Atraso na entrega do motor monocilíndrico pelo fornecedor; previsão de chegada em nov/2026.' });
    await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 1', tipo: 'relatorio_parcial', prazo: '2026-03-31', status: 'entregue', data_entrega: '2026-03-28' });
    await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 2', tipo: 'relatorio_parcial', prazo: '2026-09-30', status: 'em_elaboracao' });
    const d1 = D.desembolsos.find(d => d.projeto_id === P.id && d.numero === 1); await Data.update('desembolsos', d1.id, { status: 'recebida', data_recebida: '2025-05-12', valor_recebido: 3859740.25, documento: 'Ofício FAURGS 45/2025' });
    const it = n => D.plano_itens.find(i => i.projeto_id === P.id && new RegExp(n).test(i.descricao));
    for (const [n, v, dt, doc] of [['^Pistões', 18000, '2026-04-10', 'NF 1123'], ['^Licença GT', 31044, '2026-05-02', 'NF 88'], ['^Computadores', 38000, '2026-06-15', 'NF 5521'], ['^Analisar', 1472191.6, '2026-07-20', 'DI 26/0012'], ['^Viagens nacionais', 4200, '2026-08-05', 'Bilhetes 3x']])
      await Data.insert('despesas', { projeto_id: P.id, item_id: it(n).id, data: dt, descricao: it(n).descricao, valor: v, documento: doc, favorecido: 'Fornecedor' });
    await Data.update('plano_itens', it('^Analisar').id, { status: 'adquirido' }); await Data.update('plano_itens', it('^Computadores').id, { status: 'adquirido' });
    const v = D.equipe_plano.find(e => e.projeto_id === P.id && /Mestrado 1/.test(e.nome_plano));
    const pe = await Data.insert('pessoas', { nome: 'Ana Beatriz Rocha', tipo: 'mestrando', ingresso: '2026-04-01' }); await Data.update('equipe_plano', v.id, { status: 'ocupada', pessoa_id: pe.id, desde: '2026-04-01' });
    await Data.insert('alocacoes', { pessoa_id: pe.id, projeto_id: P.id, nivel: 2, carga_pct: 100, papel: 'Bolsista - Mestrando', status: 'ativo' });
    await Data.insert('vinculos_financeiros', { pessoa_id: pe.id, projeto_id: P.id, vaga_id: v.id, tipo: 'bolsa', modalidade: 'Mestrado (BM)', rubrica: '1.1.1', valor_mensal: 3300, inicio: '2026-04-01', fim: '2028-03-31', status: 'ativo' });
    await Data.insert('pendencias', { projeto_id: P.id, titulo: 'Enviar certidões negativas à FAURGS', origem: 'Ofício FAURGS 12/2026', prazo: '2026-10-15', status: 'aberta' });
    await Data.insert('pendencias', { projeto_id: P.id, titulo: 'Ajustar plano de trabalho (TA 1)', status: 'resolvida', resolvida_em: '2026-06-10', resolucao: 'Plano v2 aprovado pela Fundep' });
    await Data.insert('documentos', { projeto_id: P.id, tipo: 'relatorio', titulo: 'Relatório técnico parcial 1', url: 'https://drive.google.com/x', data: '2026-03-28' });
  });
  // tela
  await pg.evaluate(() => { UI.sub.rel = 'projeto'; A.nav({ t: 'relatorios' }); }); await pg.waitForTimeout(100);
  await pg.selectOption('#rp_proj', { label: 'MOVER-FUNDEP' }); await pg.waitForTimeout(100);
  await pg.click('[data-a="rpPeriodo"][data-v="ano"]');
  await pg.fill('#rp_t1', 'No período foram concluídas a definição conceitual do ciclo Miller e o CAD preliminar da câmara Spray Guided. Iniciou-se a instrumentação da célula de testes e a aquisição do analisador de gases.');
  await pg.fill('#rp_t2', 'Atraso na entrega do motor monocilíndrico pelo fornecedor. Solução: antecipação das simulações 3D (etapa 2.6).');
  await pg.fill('#rp_t3', 'Testes preliminares no monocilíndrico (2.7.4) e início do projeto do cabeçote multicilindros (2.8).');
  await pg.check('[data-rps="despesas"]');
  await pg.screenshot({ path: CFG.saida('s1_form.png'), fullPage: true });
  await pg.click('[data-a="relProjGerar"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: CFG.saida('s2_previa.png'), fullPage: false });
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#rp_docx')]); await dl.saveAs(CFG.saida('rel_teste.docx')); log('docx:', dl.suggestedFilename());
  const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.click('#rp_md')]); await dl2.saveAs(CFG.saida('rel_teste.md'));
  await pg.click('#rp_x');
  // relatório do lab em docx
  await pg.evaluate(() => { UI.sub.rel = 'lab'; render(); }); await pg.click('[data-a="relGerar"]'); await pg.waitForTimeout(200);
  const [dl3] = await Promise.all([pg.waitForEvent('download'), pg.click('#rp_docx')]); await dl3.saveAs(CFG.saida('rel_lab.docx')); await pg.click('#rp_x');
  // membro sem financeiro
  log('membro:', await pg.evaluate(() => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP');
    const R = montarRelProjeto(P, { de: '2025-09-28', ate: '2026-09-28', secoes: Object.fromEntries(SECOES_PROJ.map(([k]) => [k, true])) }); return R.S.map(s => s.h).join(' | ') + ' || valor? ' + /Valor do projeto/.test(JSON.stringify(R)); }));
  console.log(errs.join('\n') || 'no page errors'); await b.close();
})();
