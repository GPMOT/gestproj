const CFG = require('./config.cjs');
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1320, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto(CFG.APP); await pg.waitForTimeout(300);
  await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); render(); }, old);
  const log = (...a) => console.log(...a);
  // 1. novo projeto via formulário
  await pg.click('.nv-a[data-t="projetos"]'); await pg.click('[data-a="projNovo"]');
  await pg.fill('#fld_sigla', 'HIDRO-X'); await pg.fill('#fld_nome', 'Hidrogênio em motores pesados'); await pg.fill('#fld_valor_total', '1250000');
  await pg.fill('#fld_inicio', '2026-11-01'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('erro esperado (sem término):', await pg.textContent('#m_err'));
  await pg.fill('#fld_fim', '2028-10-31'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('projeto criado, detalhe aberto:', await pg.textContent('.title[style]'));
  // 2. alocar pessoa como coordenadora
  await pg.click('.ptab[data-v="equipe"]'); await pg.click('[data-a="alocNova"]'); await pg.selectOption('#fld_pessoa_id', { label: 'Lucas Giuliani Scherer' }); await pg.selectOption('#fld_nivel', '3'); await pg.fill('#fld_papel', 'COG'); await pg.check('#fld_coordena'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('alocação:', await pg.evaluate(() => D.alocacoes.filter(a => a.projeto_id === UI.projeto).map(a => [nomePessoa(a.pessoa_id), a.nivel, a.carga_pct, a.coordena])));
  // 3. tarefa com dois responsáveis
  await pg.click('.ptab[data-v="tarefas"]'); await pg.click('[data-a="tarefaNova"][data-projeto]'); await pg.fill('#fld_titulo', 'Especificar banco de H2'); await pg.fill('#fld_inicio', '2026-11-03'); await pg.fill('#fld_prazo', '2026-12-15');
  await pg.check('#fld_responsaveis input[value="' + await pg.evaluate(() => D.pessoas.find(p => p.nome.startsWith('Lucas')).id) + '"]');
  await pg.check('#fld_responsaveis input[value="' + await pg.evaluate(() => D.pessoas.find(p => p.nome.startsWith('Ivan')).id) + '"]');
  await pg.click('#m_ok'); await pg.waitForTimeout(150);
  log('tarefa:', await pg.evaluate(() => { const t = D.tarefas.find(t => t.titulo === 'Especificar banco de H2'); return [t.projeto_id === UI.projeto, Calc.responsaveis(t.id).map(p => p.nome)]; }));
  await pg.screenshot({ path: CFG.saida('t3_proj_novo.png'), fullPage: true });
  // 4. toggle tarefa
  await pg.click('.task input[type=checkbox]'); await pg.waitForTimeout(100);
  log('concluída:', await pg.evaluate(() => { const t = D.tarefas.find(t => t.titulo === 'Especificar banco de H2'); return [t.concluida, !!t.concluida_em]; }));
  // 5. busca mantém foco
  await pg.click('.nv-a[data-t="equipe"]'); await pg.click('[data-a="sub"][data-v="pessoas"]'); await pg.type('#peBusca', 'gt-power', { delay: 30 });
  log('busca pessoas (foco mantido):', await pg.evaluate(() => [document.activeElement.id, document.querySelectorAll('table.t tr.click').length]));
  // 6. matriz de decisão
  await pg.click('.nv-a[data-t="prospeccao"]');
  await pg.fill('#subTexto', 'Chamada Pública FINEP 05/2026 - Motores a hidrogênio para veículos pesados\nFinanciador: FINEP\nValor total: R$ 2.400.000,00\nPrazo de submissão: 30/11/2026\nVigência: 01/03/2027 a 28/02/2030\nObjetivo: desenvolver motor de combustão a hidrogênio com bolsas para alunos e ensaios em dinamômetro.');
  await pg.click('[data-a="prExtrair"]'); await pg.waitForTimeout(150);
  log('extração:', await pg.evaluate(() => ['nome', 'financiador', 'valor_estimado', 'prazo_submissao', 'inicio_previsto', 'fim_previsto'].map(k => (document.getElementById('fld_' + k) || {}).value)));
  await pg.click('#m_ok'); await pg.waitForTimeout(250);
  await pg.screenshot({ path: CFG.saida('t3_matriz.png') });
  log('botão salvar habilitado (filtros sugeridos):', await pg.evaluate(() => !document.getElementById('dm_save').disabled));
  await pg.click('#dm_save'); await pg.waitForTimeout(200);
  log('avaliação:', await pg.evaluate(() => { const p = D.prospeccoes[D.prospeccoes.length - 1]; const a = Calc.ultimaAvaliacao(p.id); return [p.nome, a && Math.round(a.ia), a && a.quadrante]; }));
  // 7. promover
  const pid = await pg.evaluate(() => D.prospeccoes[D.prospeccoes.length - 1].id);
  await pg.click(`[data-a="prPromover"][data-id="${pid}"]`); await pg.fill('#fld_sigla', 'H2-PESADOS'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
  log('promovida:', await pg.evaluate(id => { const p = byId('prospeccoes', id); return [p.situacao, siglaProjeto(p.projeto_id)]; }, pid));
  // 8. infra: cadastro e agenda
  await pg.click('.nv-a[data-t="infra"]'); await pg.click('[data-a="itemNovo"]'); await pg.fill('#fld_nome', 'Célula de testes 1'); await pg.fill('#fld_codigo', 'CT-01'); await pg.selectOption('#fld_categoria', 'celula_teste'); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  await pg.click('[data-a="resNova"]'); await pg.selectOption('#fld_item_id', { label: 'Célula de testes 1' }); await pg.selectOption('#fld_projeto_id', { label: 'Petrobras' }); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  await pg.click('[data-a="sub"][data-v="agenda"]'); await pg.click('[data-a="semana"][data-v="7"]'); await pg.waitForTimeout(100);
  await pg.screenshot({ path: CFG.saida('t3_agenda.png'), fullPage: true });
  // 9. gerência detalhe
  await pg.click('.nv-a[data-t="gerencias"]'); await pg.click('button.link:has-text("Gerência Financeira")'); await pg.click('[data-a="gerMembroNovo"]'); await pg.selectOption('#fld_pessoa_id', { label: 'Thompson Lanzanova' }); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  await pg.click('[data-a="tarefaNova"][data-gerencia]'); await pg.fill('#fld_titulo', 'Relatório trimestral FAURGS'); await pg.fill('#fld_prazo', '2026-09-10'); await pg.click('#m_ok'); await pg.waitForTimeout(100);
  await pg.screenshot({ path: CFG.saida('t3_gerencia.png'), fullPage: true });
  // 10. relatório + backup
  await pg.click('.nv-a[data-t="relatorios"]'); await pg.click('[data-a="sub"][data-v="lab"]'); await pg.click('[data-a="relGerar"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: CFG.saida('t3_relatorio.png') });
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#rp_md')]); await dl.saveAs(CFG.saida('rel.md'));
  await pg.click('#rp_x');
  await pg.click('.nv-a[data-t="config"]');
  const [bk] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-a="bkExportar"]')]); await bk.saveAs(CFG.BACKUP);
  await pg.screenshot({ path: CFG.saida('t3_config.png'), fullPage: true });
  // 11. restaurar backup em navegador limpo
  const pg2 = await (await b.newContext()).newPage(); pg2.on('pageerror', e => errs.push('PG2 ' + e.message));
  await pg2.goto(CFG.APP); await pg2.waitForTimeout(200);
  await pg2.click('.nv-a[data-t="config"]');
  const inputs = await pg2.$$('input[type=file]'); await inputs[0].setInputFiles(CFG.BACKUP); await pg2.waitForTimeout(300);
  await pg2.click('#im_y'); await pg2.waitForTimeout(300);
  log('restaurado:', await pg2.evaluate(() => [D.projetos.length, D.pessoas.length, D.tarefas.length, D.infra_itens.length, D.avaliacoes.length]));
  log('original :', await pg.evaluate(() => [D.projetos.length, D.pessoas.length, D.tarefas.length, D.infra_itens.length, D.avaliacoes.length]));
  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
