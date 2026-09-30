// Testes de tela (Playwright + Chromium). Cada teste roda num processo próprio.
// Uso:  node tela.cjs                  → todos (t01…t19)
//       node tela.cjs t09 t14          → só alguns
//       node tela.cjs desempenho       → volume de dados e tempo de cada tela (diagnóstico)
//       node tela.cjs celular          → largura de celular (diagnóstico)
// Linhas "CONSOLE ErroRegra: …" são validações provocadas de propósito pelo teste — não são falhas.
// Caminhos usados pelos testes de tela. Tudo é relativo a esta pasta:
//   Software de Gestão/
//     gpmot-portfolio-26-09-23.json          ← dados do programa antigo (entrada dos testes)
//     H - Fundep_..._revisao_final.xlsx      ← planilha do edital (tem CPFs: NÃO copiar para o código-fonte)
//     codigo-fonte/app/gpmot.html            ← programa montado por build.cjs
//     codigo-fonte/testes/saida/             ← capturas de tela e logs gerados (pode apagar)
// Para usar outros arquivos: defina GPMOT_DADOS_V1 e/ou GPMOT_PLANILHA com o caminho completo.
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const RAIZ = path.resolve(__dirname, '..');
const PASTA = path.resolve(RAIZ, '..');
const SAIDA = path.join(__dirname, 'saida'); fs.mkdirSync(SAIDA, { recursive: true });
const achar = re => { try { const f = fs.readdirSync(PASTA).find(n => re.test(n) && !n.startsWith('~$')); return f ? path.join(PASTA, f) : null; } catch { return null; } };
const DADOS_V1 = process.env.GPMOT_DADOS_V1 || achar(/^gpmot-portfolio.*\.json$/i);
const PLAN_ORIG = process.env.GPMOT_PLANILHA || achar(/fundep.*\.xlsx$/i);
// O navegador de testes não anexa arquivos cujo caminho tem acento ("Gestão"): usa uma cópia temporária
// fora do código-fonte (a planilha tem dados pessoais), apagada ao fim do teste.
let PLANILHA = null;
if (PLAN_ORIG) { PLANILHA = path.join(require('os').tmpdir(), `gpmot_planilha_${process.pid}.xlsx`); fs.copyFileSync(PLAN_ORIG, PLANILHA);
  process.on('exit', () => { try { fs.unlinkSync(PLANILHA); } catch { } }); }
if (!DADOS_V1) throw new Error('Não encontrei o JSON do programa antigo (gpmot-portfolio-*.json) na pasta Software de Gestão. Defina GPMOT_DADOS_V1.');
// arquivo de backup gerado pelo t03 e reutilizado pelo t06 (caminho sem acento, fora do código-fonte)
const BACKUP = path.join(require('os').tmpdir(), 'gpmot_backup_teste.json');
const CFG = { BACKUP, APP: pathToFileURL(path.join(RAIZ, 'app', 'gpmot.html')).href, DADOS_V1, PLANILHA, SAIDA, saida: n => path.join(SAIDA, n) };

const TESTES = {
't01': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1320, height: 900 } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(CFG.APP); await pg.waitForTimeout(400);
    await pg.screenshot({ path: CFG.saida('00_vazio.png') });
    const avisos = await pg.evaluate(d => { const { T, avisos } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim(lerSim()); render(); return avisos; }, old);
    console.log('AVISOS:\n' + avisos.join('\n'));
    console.log(JSON.stringify(await pg.evaluate(() => Object.fromEntries(Object.keys(TABLES).map(t => [t, D[t].length])))));
    for (const t of ['painel', 'projetos', 'cronograma', 'equipe', 'tarefas', 'gerencias', 'financeiro', 'prospeccao', 'infra', 'relatorios', 'config']) {
      await pg.click(`.nv-a[data-t="${t}"]`); await pg.waitForTimeout(200);
      await pg.screenshot({ path: `shots/${t}.png`, fullPage: true });
    }
    // subtabs
    await pg.click('.nv-a[data-t="equipe"]'); await pg.click('[data-a="sub"][data-v="pessoas"]'); await pg.screenshot({ path: CFG.saida('equipe_pessoas.png'), fullPage: true });
    await pg.click('.nv-a[data-t="financeiro"]'); await pg.click('[data-a="sub"][data-v="orcamento"]'); await pg.selectOption('select[data-f="finProj"]', { label: 'Petrobras' }); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('fin_orc.png'), fullPage: true });
    await pg.click('[data-a="sub"][data-v="bolsas"]'); await pg.screenshot({ path: CFG.saida('fin_bolsas.png'), fullPage: true });
    // project detail
    await pg.click('.nv-a[data-t="projetos"]'); await pg.click('button.link:has-text("Petrobras")'); await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('proj_detalhe.png'), fullPage: true });
    console.log(errs.join('\n') || 'no errors');
    await b.close();
  })();
},
't02': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1320, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(CFG.APP); await pg.waitForTimeout(300);
    await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim(lerSim()); render(); }, old);
    const R = async (label, fn) => { try { const r = await pg.evaluate(fn); console.log('OK  ', label, r === undefined ? '' : JSON.stringify(r)); } catch (e) { console.log('ERR ', label, e.message.split('\n')[0].slice(0, 220)); } };
    const sim = (nome, papel) => pg.evaluate(([n, p]) => { const pe = D.pessoas.find(x => x.nome.startsWith(n)); aplicarSim({ pessoa_id: pe ? pe.id : null, papel: p }); render(); return ME; }, [nome, papel]);
    const P = n => `D.projetos.find(p=>p.sigla===${JSON.stringify(n)}).id`, PE = n => `D.pessoas.find(p=>p.nome.startsWith(${JSON.stringify(n)})).id`, G = n => `D.gerencias.find(g=>g.nome===${JSON.stringify(n)}).id`;
    const ev = s => new Function('return (async()=>{' + s + '})()');

    console.log('--- DIREÇÃO: estrutura');
    await R('excluir projeto teste', ev(`const id=${P('teste')}; await Data.remove('projetos',id); return D.projetos.length`));
    await R('encerrar GLASSI', ev(`await Data.update('projetos',${P('GLASSI')},{situacao:'encerrado'}); return Calc.carga(${PE('Mario')})`));
    await R('data inválida bloqueada', ev(`await Data.update('projetos',${P('FUTSE')},{fim:'2026-02-31'})`));
    await R('fim < início bloqueado', ev(`await Data.update('projetos',${P('FUTSE')},{fim:'2020-01-01'})`));
    await R('nomear gerentes', ev(`await Data.insert('gerencia_membros',{gerencia_id:${G('Gerência Financeira')},pessoa_id:${PE('Thompson')},desde:'2026-01-01'});
       await Data.insert('gerencia_membros',{gerencia_id:${G('Gerência de Infraestrutura')},pessoa_id:${PE('Igor')},desde:'2026-01-01'});
       await Data.insert('gerencia_membros',{gerencia_id:${G('Gerência de Projetos')},pessoa_id:${PE('Jean')},desde:'2026-01-01'});
       await Data.insert('gerencia_membros',{gerencia_id:${G('Gerência Financeira')},pessoa_id:${PE('R. B.')},desde:'2024-01-01',ate:'2025-12-31'}); return D.gerencia_membros.length`));
    await R('infra: itens', ev(`const c=await Data.insert('infra_itens',{nome:'Célula de testes 3',codigo:'CT-03',categoria:'celula_teste',requer_habilitacao:true,responsavel_id:${PE('Roberto')}});
       await Data.insert('infra_itens',{nome:'Dinamômetro AVL',codigo:'DIN-01',pai_id:c.id,reservavel:false});
       await Data.insert('infra_itens',{nome:'Bancada de fluxo',codigo:'BF-01',categoria:'bancada'});
       await Data.insert('infra_habilitacoes',{item_id:c.id,pessoa_id:${PE('Ivan')},desde:'2025-01-01',validade:'2026-10-10'}); return D.infra_itens.length`));
    await R('hierarquia circular bloqueada', ev(`const c=D.infra_itens.find(i=>i.codigo==='CT-03'), d=D.infra_itens.find(i=>i.codigo==='DIN-01'); await Data.update('infra_itens',c.id,{pai_id:d.id})`));

    console.log('--- NICHOLAS (membro sem gestão, alocado em VCR/Aramco/CNPq)');
    await sim('Nicholas', 'membro');
    await R('vê financeiro?', () => ({ tab: tabVisivel('financeiro'), perms: Perm.minhas() }));
    await R('cria tarefa em VCR-VW (alocado)', ev(`const t=await Data.insert('tarefas',{projeto_id:${P('VCR-VW')},titulo:'Rodar ciclo WLTP',prazo:'2026-09-01'}); await Data.insert('tarefa_responsaveis',{tarefa_id:t.id,pessoa_id:${PE('Nicholas')}}); return t.titulo`));
    await R('cria tarefa em Petrobras (não alocado) → bloqueia', ev(`await Data.insert('tarefas',{projeto_id:${P('Petrobras')},titulo:'x'})`));
    await R('edita projeto → bloqueia', ev(`await Data.update('projetos',${P('VCR-VW')},{fase:'x'})`));
    await R('solicita reserva CT-03 com operador Ivan', ev(`const r=await Data.insert('infra_reservas',{item_id:D.infra_itens.find(i=>i.codigo==='CT-03').id,projeto_id:${P('VCR-VW')},responsavel_id:${PE('Ivan')},inicio:'2026-10-05T11:00:00Z',fim:'2026-10-05T20:00:00Z'}); return r.status`));
    await R('reserva com operador não habilitado → bloqueia', ev(`await Data.insert('infra_reservas',{item_id:D.infra_itens.find(i=>i.codigo==='CT-03').id,responsavel_id:${PE('Nicholas')},inicio:'2026-10-06T11:00:00Z',fim:'2026-10-06T20:00:00Z'})`));
    await R('tenta confirmar → bloqueia', ev(`const r=D.infra_reservas[0]; await Data.update('infra_reservas',r.id,{status:'confirmada'})`));
    await R('reporta defeito', ev(`const m=await Data.insert('infra_manutencoes',{item_id:D.infra_itens.find(i=>i.codigo==='BF-01').id,tipo:'corretiva',status:'planejada',titulo:'Vazamento'}); return m.status`));
    await R('planeja preventiva → bloqueia', ev(`await Data.insert('infra_manutencoes',{item_id:D.infra_itens.find(i=>i.codigo==='BF-01').id,tipo:'preventiva',status:'planejada',titulo:'x'})`));
    await R('edita próprio cadastro (habilidades)', ev(`await Data.update('pessoas',${PE('Nicholas')},{habilidades:['GT-Power']}); return 'ok'`));
    await R('muda própria função → bloqueia', ev(`await Data.update('pessoas',${PE('Nicholas')},{funcao:'Chefe'})`));

    console.log('--- MARIO (membro, coordena FUTSE/Petrobras/VCR)');
    await sim('Mario', 'membro');
    await R('projetos com financeiro visível', () => D.projetos.filter(p => Perm.veFin(p.id)).map(p => p.sigla));
    await R('edita Petrobras (coordena)', ev(`await Data.update('projetos',${P('Petrobras')},{fase:'Infra — aguardando motor P7'}); return 'ok'`));
    await R('edita Aramco → bloqueia', ev(`await Data.update('projetos',${P('Aramco')},{fase:'x'})`));
    await R('se faz coordenador de Aramco → bloqueia', ev(`const a=D.alocacoes.find(a=>a.pessoa_id===${PE('Mario')}&&a.projeto_id===${P('Aramco')}); await Data.update('alocacoes',a.id,{coordena:true})`));
    await R('lança orçamento Petrobras', ev(`await Data.insert('orcamento_rubricas',{projeto_id:${P('Petrobras')},rubrica:'1.3',aprovado:80000,previsto:60000}); return Calc.totaisOrc(${P('Petrobras')})`));
    await R('lança gasto Petrobras', ev(`await Data.insert('despesas',{projeto_id:${P('Petrobras')},rubrica:'1.3',data:hoje(),descricao:'Diesel S10',valor:1200}); return Calc.valoresRubrica(${P('Petrobras')},'1.3').executado`));
    await R('conciliar bolsas Petrobras', ev(`const pid=${P('Petrobras')}; const antes=D.despesas.length; for (const v of D.vinculos_financeiros.filter(v=>v.projeto_id===pid)) for (const c of Calc.competenciasPagas(v)) await Data.insert('despesas',{projeto_id:pid,rubrica:v.rubrica,data:Calc.primeiroDiaUtil(c),competencia:c,descricao:'b',valor:v.valor_mensal,vinculo_id:v.id}); return D.despesas.length-antes`));
    await R('cria pessoa (coordenador pode)', ev(`const p=await Data.insert('pessoas',{nome:'Novo Bolsista',tipo:'ic'}); return p.nome`));

    console.log('--- THOMPSON (Gerência Financeira)');
    await sim('Thompson', 'membro');
    await R('projetos com financeiro visível', () => D.projetos.filter(p => Perm.veFin(p.id)).length + ' de ' + D.projetos.length);
    await R('lança bolsa IC no FUTSE (não coordena)', ev(`const v=await Data.insert('vinculos_financeiros',{pessoa_id:${PE('Carlos')},projeto_id:${P('FUTSE')},rubrica:'1.1.1',valor_mensal:700,inicio:'2026-03-01',fim:'2027-02-28',status:'ativo'}); return Calc.mesesPagos(v)`));
    await R('cria demanda na Financeira', ev(`const t=await Data.insert('tarefas',{gerencia_id:${G('Gerência Financeira')},projeto_id:${P('Petrobras')},titulo:'Prestação de contas parcial',prazo:'2026-10-30'}); return t.titulo`));
    await R('cria demanda na Infra → bloqueia', ev(`await Data.insert('tarefas',{gerencia_id:${G('Gerência de Infraestrutura')},titulo:'x'})`));

    console.log('--- HAUSEN (mandato financeiro encerrado)');
    await sim('R. B.', 'membro');
    await R('financeiro visível', () => D.projetos.filter(p => Perm.veFin(p.id)).map(p => p.sigla));

    console.log('--- IGOR (Gerência de Infraestrutura)');
    await sim('Igor', 'membro');
    await R('confirma reserva', ev(`const r=D.infra_reservas[0]; await Data.update('infra_reservas',r.id,{status:'confirmada'}); return D.infra_reservas[0].status`));
    await R('reserva conflitante confirmada → bloqueia', ev(`await Data.insert('infra_reservas',{item_id:D.infra_itens.find(i=>i.codigo==='CT-03').id,responsavel_id:${PE('Ivan')},inicio:'2026-10-05T15:00:00Z',fim:'2026-10-05T22:00:00Z',status:'confirmada'})`));
    await R('manutenção em andamento → item em manutenção', ev(`const m=D.infra_manutencoes[0]; await Data.update('infra_manutencoes',m.id,{status:'em_andamento'}); return D.infra_itens.find(i=>i.codigo==='BF-01').status`));
    await R('concluir → operacional', ev(`const m=D.infra_manutencoes[0]; await Data.update('infra_manutencoes',m.id,{status:'concluida',custo:1200}); return [D.infra_itens.find(i=>i.codigo==='BF-01').status, D.infra_manutencoes[0].data_conclusao]`));
    await R('calibração vencendo gera alerta', ev(`await Data.insert('infra_manutencoes',{item_id:D.infra_itens.find(i=>i.codigo==='DIN-01').id,tipo:'calibracao',status:'concluida',titulo:'Célula de carga',proxima_em:addDays(hoje(),12)}); return Calc.alertasInfra().map(a=>a.txt)`));
    await R('realizar reserva', ev(`const r=D.infra_reservas[0]; await Data.update('infra_reservas',r.id,{status:'realizada',horas_uso:8.5}); return 'ok'`));
    await R('vê financeiro?', () => tabVisivel('financeiro'));

    console.log('--- LEITURA');
    await pg.evaluate(() => { aplicarSim({ pessoa_id: null, papel: 'leitura' }); render(); });
    await R('cria tarefa → bloqueia', ev(`await Data.insert('tarefas',{gerencia_id:${G('Gerência Técnica')},titulo:'x'})`));
    await R('botões de edição na aba projetos', async () => { A.tab({ t: 'projetos' }); return document.querySelectorAll('[data-a="projNovo"],[data-a="projEditar"]').length; });

    console.log('--- DIREÇÃO: exclusão de pessoa com bolsa (restrict)');
    await pg.evaluate(() => { aplicarSim({ pessoa_id: null, papel: 'direcao' }); render(); });
    await R('excluir Carlos (tem bolsa) → bloqueia', ev(`await Data.remove('pessoas',${PE('Carlos')})`));
    await R('histórico registrado', () => D.historico.length);
    await R('persistência após recarregar', async () => 'pending');
    await pg.reload(); await pg.waitForTimeout(300);
    await R('após reload', () => ({ proj: D.projetos.length, res: D.infra_reservas.map(r => r.status), ger: D.gerencia_membros.length }));
    console.log(errs.join('\n') || 'no page errors');
    await b.close();
  })();
},
't03': () => {
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
    await pg.fill('#fld_sigla', 'HIDRO-X'); await pg.fill('#fld_nome', 'Hidrogênio em motores pesados');
    await pg.fill('#fld_inicio', '2026-11-01'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
    log('erro esperado (sem término):', await pg.textContent('#m_err'));
    await pg.fill('#fld_fim', '2028-10-31'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
    log('projeto criado, detalhe aberto:', await pg.textContent('.title[style]'));
    // valores do contrato: só na aba Financeiro do projeto
    await pg.evaluate(() => A.projValores({ id: UI.projeto })); await pg.fill('#fld_valor_total', '1250000'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
    log('valor do contrato (Financeiro):', await pg.evaluate(() => byId('projetos', UI.projeto).valor_total));
    // 2. alocar pessoa como coordenadora
    await pg.click('.ptab[data-v="equipe"]'); await pg.click('[data-a="alocNova"]'); await pg.selectOption('#fld_pessoa_id', { label: 'Lucas Giuliani Scherer' }); await pg.selectOption('#fld_nivel', '3'); await pg.fill('#fld_papel', 'COG'); await pg.selectOption('#fld__coord', 'coord'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
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
},
't04': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 700 } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.goto(CFG.APP); await pg.waitForTimeout(300);
    await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); render(); }, old);
    await pg.screenshot({ path: CFG.saida('s1_painel.png') });
    // expand all sections
    for (const t of ['projetos', 'equipe', 'tarefas', 'gerencias', 'financeiro', 'infra']) {
      const o = await pg.getAttribute(`.nv-tg[data-t="${t}"]`, 'data-o'); if (o === '0') await pg.click(`.nv-tg[data-t="${t}"]`);
    }
    const m = await pg.evaluate(() => { const n = document.getElementById('navScroll'); return { sh: n.scrollHeight, ch: n.clientHeight }; });
    console.log('nav scrollHeight/clientHeight', m);
    // scroll the nav, then the window, check independence
    await pg.hover('#navScroll'); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(200);
    const a1 = await pg.evaluate(() => [document.getElementById('navScroll').scrollTop, window.scrollY]);
    await pg.click('.nv-a[data-t="equipe"]'); await pg.waitForTimeout(150);
    await pg.hover('#app'); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(200);
    const a2 = await pg.evaluate(() => [document.getElementById('navScroll').scrollTop, window.scrollY, document.getElementById('side').getBoundingClientRect().top]);
    console.log('após rolar menu [menu, janela]:', a1, ' após navegar e rolar janela [menu, janela, topo do menu]:', a2);
    await pg.screenshot({ path: CFG.saida('s2_scroll.png') });
    // click a project sub-item
    await pg.click('.nv-s:has-text("Petrobras")'); await pg.waitForTimeout(150);
    console.log('tela:', await pg.evaluate(() => [UI.tab, siglaProjeto(UI.projeto), document.querySelector('.crumb').textContent]));
    await pg.screenshot({ path: CFG.saida('s3_proj.png') });
    await pg.click('.nv-s:has-text("Agenda de uso")'); console.log('infra sub:', await pg.evaluate(() => UI.sub.infra));
    await pg.click('.nv-s:has-text("Atrasadas")'); console.log('tarefas filtro:', await pg.evaluate(() => [UI.tab, UI.f.tfEscopo, document.querySelectorAll('.task').length]));
    await pg.click('.nv-s:has-text("Todas")'); console.log('todas:', await pg.evaluate(() => [UI.f.tfEscopo, document.querySelectorAll('.task').length]));
    // mini
    await pg.click('.nv-mini'); await pg.waitForTimeout(200); await pg.screenshot({ path: CFG.saida('s4_mini.png') }); await pg.click('.nv-mini');
    // mobile
    await pg.setViewportSize({ width: 420, height: 800 }); await pg.waitForTimeout(200); await pg.screenshot({ path: CFG.saida('s5_mobile.png') });
    await pg.click('.hamb'); await pg.waitForTimeout(300); await pg.screenshot({ path: CFG.saida('s6_mobile_menu.png') });
    await pg.click('.nv-a[data-t="cronograma"]'); await pg.waitForTimeout(300);
    console.log('mobile menu fechou após navegar:', await pg.evaluate(() => !document.body.classList.contains('nav-open')));
    console.log(errs.join('\n') || 'no page errors'); await b.close();
  })();
},
't05': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 700 } });
    await pg.goto(CFG.APP); await pg.waitForTimeout(300);
    await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); render(); }, old);
    for (const t of ['projetos', 'equipe', 'tarefas', 'gerencias', 'financeiro', 'infra']) { const o = await pg.getAttribute(`.nv-tg[data-t="${t}"]`, 'data-o'); if (o === '0') await pg.click(`.nv-tg[data-t="${t}"]`); }
    await pg.hover('#navScroll'); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(200);
    const st = () => pg.evaluate(() => [document.getElementById('navScroll').scrollTop, document.getElementById('navScroll').scrollHeight, window.scrollY]);
    console.log('antes', await st());
    await pg.click('.nv-a[data-t="equipe"]'); await pg.waitForTimeout(150); console.log('após clicar Equipe', await st());
    await pg.hover('#app'); await pg.mouse.wheel(0, 600); await pg.waitForTimeout(200); console.log('após rolar conteúdo', await st());
    await b.close();
  })();
},
't06': () => {
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
},
't07': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(CFG.APP); await pg.waitForTimeout(200);
    await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); A.projAbrir({ id: D.projetos.find(p => p.sigla === 'VCR-VW').id, aba: 'financeiro' }); }, old);
    const pid = await pg.evaluate(() => UI.projeto);
    await pg.click(`input[data-orc="${pid}|1.1.1|aprovado"]`);
    for (const v of ['2.554.848,00', '2400000', '447.744', '447744,00', '124000.00', '100.000,00']) { await pg.keyboard.type(v); await pg.keyboard.press('Tab'); await pg.waitForTimeout(120); }
    console.log('foco:', await pg.evaluate(() => document.activeElement.dataset.orc));
    console.log(await pg.evaluate(id => ['1.1.1', '1.1.2', '1.2.1'].map(c => { const v = Calc.valoresRubrica(id, c); return [c, v.aprovado, v.previsto]; }), pid));
    console.log('exibição:', await pg.inputValue(`input[data-orc="${pid}|1.1.1|aprovado"]`));
    await pg.fill(`input[data-orc="${pid}|1.3|aprovado"]`, 'abc'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(150);
    console.log('inválido:', await pg.textContent('#flash'));
    console.log(errs.join('\n') || 'no page errors'); await b.close();
  })();
},
't08': () => {
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
    await pg.fill('#fld_fundacao_apoio', 'FDMS'); await pg.fill('#fld_data_assinatura', '2023-12-15'); await pg.fill('#fld_resumo', 'Desenvolvimento de sistema glowplug para motor diesel/etanol.');
    await pg.click('#m_ok'); await pg.waitForTimeout(150);
    await pg.evaluate(id => A.projValores({ id }), G); await pg.fill('#fld_contrapartida', '120000'); await pg.click('#m_ok'); await pg.waitForTimeout(150);
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
},
't09': () => {
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
},
't10': () => {
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
    await pg.click(`tr[data-a="vagaEditar"][data-id="${G}"]`); await pg.selectOption('#fld_status', 'selecao'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
    // o valor da bolsa prevista é editado no Financeiro › Plano de aplicação
    await pg.evaluate(g => A.bolsaPlanoEditar({ id: g }), G); await pg.fill('#fld_valor_mensal', '1200'); await pg.fill('#fld_meses', '36'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
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
},
't11': () => {
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
},
't12': () => {
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
},
't13': () => {
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
},
't14': () => {
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
},
't15': () => {
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
    // dados para a semana do Lucas
    await pg.evaluate(async () => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'), me = ME.pessoa_id;
      await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 1', tipo: 'relatorio_parcial', prazo: addDays(hoje(), 3), responsavel_id: me });
      await Data.insert('pendencias', { projeto_id: P.id, titulo: 'Enviar plano de trabalho assinado à FAURGS', prazo: addDays(hoje(), -2), responsavel_id: me });
      const c = D.cronograma.find(x => x.projeto_id === P.id && x.codigo === '2.5.3'); await Data.update('cronograma', c.id, { responsavel_id: me, percentual: 30 });
      const t = await Data.insert('tarefas', { projeto_id: P.id, titulo: 'Revisar simulação 1D do ciclo Miller', prazo: addDays(hoje(), 10) }); await Data.insert('tarefa_responsaveis', { tarefa_id: t.id, pessoa_id: me });
      const d1 = D.desembolsos.find(d => d.projeto_id === P.id && d.numero === 2); await Data.update('desembolsos', d1.id, { data_prevista: addDays(hoje(), 40) });
      await Data.update('equipe_plano', D.equipe_plano.find(e => e.projeto_id === P.id && /Mestrado 3/.test(e.nome_plano)).id, { status: 'selecao', selecao_prazo: addDays(hoje(), 12) }); });
    await pg.evaluate(() => { UI.sub.painel = 'portfolio'; A.nav({ t: 'painel' }); }); await pg.waitForTimeout(150);
    log('métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')));
    log('saúde:', await pg.evaluate(() => D.projetos.filter(p => Calc.vigente(p) || Calc.vencido(p)).map(p => { const s = Calc.saudeProjeto(p); return p.sigla + '=' + s.sinal + (s.mot.bad.concat(s.mot.warn).length ? '(' + s.mot.bad.concat(s.mot.warn).join('; ') + ')' : ''); }).join('\n  ')));
    log('eventos 60d:', await pg.evaluate(() => { const e = Calc.eventos(hoje(), addDays(hoje(), 60)); return e.length + ' · por cat ' + JSON.stringify(e.reduce((m, x) => (m[x.cat] = (m[x.cat] || 0) + 1, m), {})); }));
    await pg.screenshot({ path: CFG.saida('r1_portfolio.png'), fullPage: true });
    await pg.click('[data-a="ltLista"]'); await pg.click('[data-a="ltDias"][data-v="90"]'); await pg.waitForTimeout(100);
    const k = await pg.$eval('[data-a="alToggle"]', e => e.dataset.k); await pg.click(`[data-a="alToggle"][data-k="${k}"]`); await pg.waitForTimeout(100);
    await pg.screenshot({ path: CFG.saida('r2_portfolio_lista.png'), fullPage: true });
    // clique numa marca da linha do tempo
    await pg.click('svg g.click >> nth=0'); await pg.waitForTimeout(100); log('clique na marca →', await pg.evaluate(() => [UI.tab, UI.projeto && siglaProjeto(UI.projeto), UI.projAba]));
    // minha semana
    await pg.evaluate(() => { UI.sub.painel = 'semana'; A.nav({ t: 'painel' }); }); await pg.waitForTimeout(150);
    log('semana:', await pg.evaluate(() => Calc.minhaAgenda().map(x => (x.data || '—') + ' ' + x.tipo + ': ' + x.txt.slice(0, 40)).join('\n  ')));
    await pg.screenshot({ path: CFG.saida('r3_semana.png'), fullPage: true });
    // membro (Nicholas): semana padrão, portfolio sem colunas financeiras
    log('membro:', await pg.evaluate(() => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); UI.sub.painel = null; A.nav({ t: 'painel' });
      const semana = document.querySelector('.subtabs .chip.on').innerText; UI.sub.painel = 'portfolio'; render(); return [semana, /Execução financeira/.test(document.body.innerText), /Parcela/.test(document.body.innerText)]; }));
    await pg.screenshot({ path: CFG.saida('r4_membro_portfolio.png'), fullPage: true });
    console.log(errs.join('\n') || 'no page errors'); await b.close();
  })();
},
't16': () => {
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
},
't17': () => {
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
    await pg.evaluate(async () => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'), G = D.projetos.find(x => x.sigla === 'GLASSI');
      await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 1', tipo: 'relatorio_parcial', prazo: '2026-03-31', status: 'entregue', data_entrega: '2026-03-28' });
      await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 2', tipo: 'relatorio_parcial', prazo: '2026-09-15' });
      await Data.insert('entregas', { projeto_id: P.id, titulo: 'Relatório técnico parcial 3', tipo: 'relatorio_parcial', prazo: '2027-03-31' });
      const d1 = D.desembolsos.find(d => d.projeto_id === P.id && d.numero === 1); await Data.update('desembolsos', d1.id, { status: 'recebida', data_recebida: '2025-05-12', valor_recebido: 3859740.25 });
      await Data.insert('aditivos', { projeto_id: G.id, numero: '1º TA', tipo: 'prazo', novo_fim: '2027-06-30', data_assinatura: '2025-11-20' });
      for (const [c, pc] of [['2.1', 100], ['2.2', 60], ['2.5.1', 100], ['2.5.3', 70], ['2.6.1', 100]]) { const x = D.cronograma.find(y => y.projeto_id === P.id && y.codigo === c); await Data.update('cronograma', x.id, { percentual: pc }); }
      UI.tab = 'cronograma'; UI.sub.cron = 'gantt'; UI.f.cronAbertos = new Set([P.id]); render(); });
    await pg.waitForTimeout(150); await pg.screenshot({ path: CFG.saida('u1_gantt.png'), fullPage: true });
    log('linhas svg:', await pg.$$eval('svg text[data-a="cronAbrirProj"]', x => x.length), '| marcos entrega:', await pg.$$eval('svg rect[transform]', x => x.length));
    await pg.click('[data-a="cronZoom"][data-v="tudo"]'); await pg.waitForTimeout(100); await pg.screenshot({ path: CFG.saida('u2_gantt_tudo.png'), fullPage: true });
    await pg.click('svg text[data-a="cronAbrirProj"] >> nth=0'); await pg.waitForTimeout(80);
    await pg.click('svg g[data-a="projAbrir"] >> nth=0'); log('clique barra →', await pg.evaluate(() => [UI.tab, siglaProjeto(UI.projeto)]));
    await pg.evaluate(() => { UI.tab = 'cronograma'; UI.projeto = null; UI.sub.cron = 'carga'; render(); }); await pg.waitForTimeout(100);
    log('carga linhas:', await pg.$$eval('table.t tr', x => x.length), '| sobrecarga:', await pg.$$eval('td', x => x.filter(e => /!$/.test(e.innerText)).length));
    await pg.screenshot({ path: CFG.saida('u3_carga.png'), fullPage: true });
    log('membro:', await pg.evaluate(() => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); UI.sub.cron = 'gantt'; UI.f.cronMeus = true; render(); return [document.querySelectorAll('svg text[data-a="cronAbrirProj"]').length, document.querySelectorAll('svg circle[r="5.5"]').length]; }));
    console.log(errs.join('\n') || 'no page errors'); await b.close();
  })();
},
't18': () => {
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
    await pg.evaluate(async () => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP');
      const d1 = D.desembolsos.find(d => d.projeto_id === P.id && d.numero === 1); await Data.update('desembolsos', d1.id, { status: 'recebida', data_recebida: '2025-05-12', valor_recebido: 3859740.25 });
      const it = n => D.plano_itens.find(i => i.projeto_id === P.id && new RegExp(n).test(i.descricao));
      for (const [n, v, dt] of [['^Pistões', 18000, '2026-04-10'], ['^Licença GT', 31044, '2026-05-02'], ['^Computadores', 38000, '2026-06-15'], ['^Analisar', 1472191.6, '2026-07-20'], ['^Viagens nacionais', 4200, '2026-08-05']]) await Data.insert('despesas', { projeto_id: P.id, item_id: it(n).id, data: dt, descricao: it(n).descricao, valor: v });
      await Data.update('plano_itens', it('^Analisar').id, { status: 'adquirido' }); await Data.update('plano_itens', it('^Contador').id, { status: 'em_aquisicao' });
      for (const e of D.equipe_plano.filter(e => e.projeto_id === P.id && e.status === 'ocupada')) { const r = linhaVaga(e.id); if (r.bolsa) await criarBolsaVaga(r, e.pessoa_id, '2026-06-01', 24, 'ativo'); }
      UI.tab = 'financeiro'; UI.sub.fin = 'resumo'; render(); });
    await pg.waitForTimeout(150);
    log('métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')));
    log('MOVER linha:', await pg.evaluate(() => [...document.querySelectorAll('tr.click')].find(r => /MOVER/.test(r.innerText)).innerText.replace(/\s+/g, ' ')));
    await pg.screenshot({ path: CFG.saida('v1_resumo.png'), fullPage: true });
    await pg.evaluate(() => { UI.sub.fin = 'compras'; render(); }); await pg.waitForTimeout(100);
    log('compras métricas:', await pg.$$eval('.metric', m => m.map(x => x.innerText.replace(/\n/g, ': ')).join(' | ')), '| linhas', await pg.$$eval('tr[data-a="itemPlanoEditar"]', x => x.length));
    await pg.click('[data-a="cpStatus"][data-v="em_aquisicao"] >> nth=0'); await pg.waitForTimeout(100);
    await pg.selectOption('[data-f="cpGrupo"]', '2.1'); await pg.waitForTimeout(100);
    log('permanente pendentes:', await pg.$$eval('tr[data-a="itemPlanoEditar"]', x => x.map(r => r.innerText.split('\n')[2]).join(' / ')));
    await pg.screenshot({ path: CFG.saida('v2_compras.png'), fullPage: true });
    await pg.evaluate(() => { UI.sub.fin = 'calendario'; render(); }); await pg.waitForTimeout(100);
    log('calendário linhas:', await pg.$$eval('table.t tr', x => x.length), '| vencidas:', await pg.$$eval('td', x => x.filter(e => e.innerText === '!').length));
    await pg.screenshot({ path: CFG.saida('v3_calendario.png'), fullPage: true });
    await pg.click('[data-a="finConciliarTodos"]'); await pg.click('#c_yes'); await pg.waitForTimeout(400);
    log('após lançar: vencidas', await pg.$$eval('td', x => x.filter(e => e.innerText === '!').length), '| lançadas', await pg.$$eval('td', x => x.filter(e => e.innerText === '✓').length));
    // sidebar subs
    log('sidebar fin:', await pg.$$eval('.nv-sub a, .nv-sub button, [data-g="fin"]', x => x.map(e => e.innerText.trim()).filter(Boolean).slice(0, 10).join(' | ')));
    // membro sem acesso
    log('membro:', await pg.evaluate(() => { aplicarSim({ papel: 'membro', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Nicholas')).id }); UI.sub.fin = 'compras'; render(); return document.querySelector('#app').innerText.slice(0, 120).replace(/\n/g, ' '); }));
    console.log(errs.join('\n') || 'no page errors'); await b.close();
  })();
},
't19': () => {
  // Tela de abertura (1 s, com direitos autorais) e quadro "Sobre" nas Configurações
  const { chromium } = require('playwright');
  (async () => {
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1300, height: 800 } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    let falhas = 0; const ok = (c, m, x) => { console.log((c ? '✓ ' : '✗ ') + m + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); if (!c) falhas++; };
    await pg.goto(CFG.APP); await pg.waitForTimeout(300);
    ok(await pg.locator('#abertura').count() === 0, 'testes automáticos não esperam a abertura');
    await pg.goto(CFG.APP + '?abertura=1'); await pg.waitForTimeout(300);
    const txt = await pg.textContent('#abertura');
    ok(/Software de Gestão de Portfólio de Projetos/.test(txt) && /Todos os direitos reservados/.test(txt) && /Desenvolvido por:\s*GPMOT\/UFSM/.test(txt) && /lucas\.scherer@ufsm\.br/.test(txt) && /© 2026 GPMOT — Laboratório de Motores, Combustíveis e Emissões/.test(txt), 'abertura com logotipo, direitos autorais, desenvolvedor, suporte e rodapé');
    ok(await pg.locator('#abertura .marca-logo').count() === 1, 'logotipo do GPMOT na abertura');
    await pg.screenshot({ path: CFG.saida('abertura.png') });
    ok(await pg.locator('#abertura').count() === 1, 'ainda na abertura aos 0,3 s');
    await pg.waitForTimeout(1300); ok(await pg.locator('#abertura').count() === 0 && await pg.evaluate(() => UI.tab) === 'painel', 'depois de 1 s passa para o Painel');
    await pg.goto(CFG.APP + '?abertura=1'); await pg.waitForTimeout(150); await pg.click('#abertura'); await pg.waitForTimeout(600);
    ok(await pg.locator('#abertura').count() === 0, 'clicar pula a abertura');
    await pg.evaluate(() => A.nav({ t: 'sobre' })); await pg.waitForTimeout(200);
    const cfg = await pg.textContent('#app');
    ok(/direitos reservados/.test(cfg) && /lucas\.scherer@ufsm\.br/.test(cfg) && /Laboratório de Motores, Combustíveis e Emissões/.test(cfg) && await pg.locator('#app .marca-logo').count() === 1, 'janela Sobre com os mesmos dados da abertura');
    ok(await pg.locator('#side .nv-a:has-text("Sobre")').count() === 1, 'Sobre aparece no menu');
    await pg.evaluate(() => A.nav({ t: 'config' })); ok(!/Todos os direitos reservados/.test(await pg.textContent('#app')), 'Configurações não repetem o Sobre');
    console.log(errs.join('\n') || 'no page errors'); await b.close();
    process.exit(falhas || errs.length ? 1 : 0);
  })();
},
't20': () => {
  // Perfis: Suporte técnico, Leitura (só os projetos de que participa, sem valores nem dados pessoais) e vice-coordenação
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1300, height: 850 } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ErroRegra/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
    let falhas = 0; const ok = (c, m, x) => { console.log((c ? '✓ ' : '✗ ') + m + (x !== undefined ? ' — ' + JSON.stringify(x) : '')); if (!c) falhas++; };
    await pg.goto(CFG.APP); await pg.waitForTimeout(200);
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    await pg.evaluate(d => { localStorage.clear(); Local.load(); const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); seedPadrao(); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); }, old);
    const antes = await pg.evaluate(() => ({ proj: D.projetos.length, pes: D.pessoas.length, ls: localStorage.getItem('gpmot2:projetos').length }));
    // um bolsista com alocação ativa em algum projeto (mas não em todos)
    const alvo = await pg.evaluate(() => { const ps = D.pessoas.filter(p => { const n = D.projetos.filter(pr => D.alocacoes.some(a => a.projeto_id === pr.id && a.pessoa_id === p.id && ['ativo', 'pausado'].includes(a.status))).length; return n > 0 && n < D.projetos.length; });
      const p = ps.find(x => x.tipo === 'ic') || ps[0]; if (!p.email) { p.email = 'ic.teste@ufsm.br'; Local.persist('pessoas'); } return { id: p.id, nome: p.nome, n: D.projetos.filter(pr => D.alocacoes.some(a => a.projeto_id === pr.id && a.pessoa_id === p.id && ['ativo', 'pausado'].includes(a.status))).length }; });
    await pg.evaluate(id => { aplicarSim({ papel: 'leitura', pessoa_id: id }); A.nav({ t: 'painel' }); }, alvo.id); await pg.waitForTimeout(200);
    const v = await pg.evaluate(eu => ({ proj: D.projetos.length, fin: D.orcamento_rubricas.length + D.vinculos_financeiros.length + D.despesas.length, prosp: D.prospeccoes.length, infra: D.infra_itens.length,
      menu: [...document.querySelectorAll('#side .nv-a')].map(x => x.textContent.trim().replace(/\d+$/, '').trim()),
      emailsTerceiros: D.pessoas.filter(p => p.id !== eu && p.email).length, pessoas: D.pessoas.length, proprio: !!(D.pessoas.find(p => p.id === eu) || {}).email }), alvo.id);
    ok(v.proj === alvo.n, `Leitura vê só os ${alvo.n} projeto(s) de que participa`, { de: antes.proj, ve: v.proj });
    ok(v.fin === 0 && v.prosp === 0 && v.infra === 0, 'Leitura não recebe valores, prospecção nem infraestrutura');
    ok(!v.menu.some(m => /Prospecção|Infraestrutura|Gerências|Financeiro|Relatórios|Configurações/.test(m)) && v.menu.some(m => /Sobre/.test(m)), 'menu da Leitura sem Prospecção, Infraestrutura, Gerências, Financeiro, Relatórios e Configurações (com Sobre)', v.menu);
    ok(v.emailsTerceiros === 0 && v.proprio && v.pessoas < antes.pes, 'Leitura vê só as pessoas dos seus projetos, sem e-mail de terceiros; o próprio cadastro completo', { pessoas: v.pessoas });
    const telas = await pg.evaluate(() => ['painel', 'projetos', 'entregas', 'cronograma', 'equipe', 'tarefas', 'sobre', 'relatorios', 'config', 'infra'].map(t => { try { A.nav({ t }); return t + '→' + UI.tab; } catch (e) { return t + ':' + e.message; } }));
    ok(telas.every(x => x.includes('→')) && ['infra→painel', 'relatorios→painel', 'config→painel', 'sobre→sobre'].every(x => telas.includes(x)), 'telas da Leitura abrem; Infraestrutura, Relatórios e Configurações voltam ao Painel', telas);
    await pg.evaluate(() => render()); await pg.click('#side [data-a="trocarUsuario"]'); await pg.waitForTimeout(150);
    ok(await pg.locator('#tu_r').count() === 1, 'no modo local, a Leitura troca de usuário pela janela do botão (sem precisar das Configurações)'); await pg.click('#tu_n');
    const grava = await pg.evaluate(async () => { try { await Data.update('projetos', D.projetos[0].id, { resumo: 'x' }); return 'gravou'; } catch (e) { return e.message; } });
    ok(grava !== 'gravou', 'Leitura não altera nada', grava);
    await pg.screenshot({ path: CFG.saida('leitura.png') });
    await pg.evaluate(() => { aplicarSim({ papel: 'direcao', pessoa_id: null }); render(); });
    const depois = await pg.evaluate(() => ({ proj: D.projetos.length, pes: D.pessoas.length, ls: localStorage.getItem('gpmot2:projetos').length }));
    ok(depois.proj === antes.proj && depois.pes === antes.pes && depois.ls === antes.ls, 'ao voltar para a Direção, todos os dados estão lá (nada foi apagado)', depois);
    // Suporte técnico
    await pg.evaluate(() => { aplicarSim({ papel: 'suporte', pessoa_id: null }); A.nav({ t: 'config' }); });
    ok(await pg.evaluate(() => Perm.dir() && Perm.suporte() && Perm.minhas().length === PERMISSOES.length && D.projetos.length > 0), 'Suporte técnico tem acesso irrestrito');
    ok(await pg.evaluate(() => [...document.querySelectorAll('#sim_r option')].some(o => o.value === 'suporte' && /Suporte técnico/.test(o.textContent))), 'papel Suporte técnico disponível');
    // vice-coordenação: a Direção nomeia; o vice tem poderes de coordenação no projeto
    const pj = await pg.evaluate(() => { const p = D.projetos.find(pr => D.alocacoes.filter(a => a.projeto_id === pr.id && !a.coordena).length >= 2 && D.alocacoes.some(a => a.projeto_id === pr.id && a.coordena)); return { id: p.id, sigla: p.sigla,
      titular: D.alocacoes.find(a => a.projeto_id === p.id && a.coordena).pessoa_id, outros: D.alocacoes.filter(a => a.projeto_id === p.id && !a.coordena).map(a => ({ id: a.id, pessoa: a.pessoa_id })) }; });
    await pg.evaluate(() => aplicarSim({ papel: 'direcao', pessoa_id: null }));
    await pg.evaluate(id => A.alocEditar({ id }), pj.outros[0].id); await pg.waitForTimeout(150);
    await pg.selectOption('#fld__coord', 'vice'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(id => byId('alocacoes', id).vice_coordena === true && byId('alocacoes', id).coordena === false, pj.outros[0].id), `Direção nomeia vice-coordenador no ${pj.sigla}`);
    ok(await pg.evaluate(id => nomesCoordenacao(id).includes('(vice)'), pj.id), 'a coordenação do projeto mostra o vice');
    const vice = await pg.evaluate(o => { aplicarSim({ papel: 'membro', pessoa_id: o.pessoa }); return { gere: Perm.gereProjeto(o.pid), fin: Perm.veFin(o.pid), titular: Perm.coordenaTitular(o.pid) }; }, { pessoa: pj.outros[0].pessoa, pid: pj.id });
    ok(vice.gere && vice.fin && !vice.titular, 'o vice tem os poderes de coordenação no projeto (e não é titular)', vice);
    const viceNomeia = await pg.evaluate(async o => { try { await Data.update('alocacoes', o.aid, { vice_coordena: true }); return 'nomeou'; } catch (e) { return e.message; } }, { aid: pj.outros[1].id });
    ok(/vice-coordenação/.test(viceNomeia), 'o vice não nomeia outro vice', viceNomeia);
    await pg.evaluate(o => aplicarSim({ papel: 'membro', pessoa_id: o }), pj.titular);
    await pg.evaluate(id => A.alocEditar({ id }), pj.outros[1].id); await pg.waitForTimeout(150);
    const campo = await pg.evaluate(() => { const el = document.getElementById('fld__coord'); return el ? !el.disabled : false; });
    ok(campo, 'o coordenador titular pode indicar o vice no próprio projeto');
    await pg.selectOption('#fld__coord', 'coord'); await pg.click('#m_ok'); await pg.waitForTimeout(200);
    ok(/Somente a Direção pode definir coordenadores/.test(await pg.textContent('.merr, #flash').catch(() => '')) || await pg.evaluate(id => !byId('alocacoes', id).coordena, pj.outros[1].id), 'o titular não nomeia outro coordenador');
    await pg.evaluate(() => closeModal && closeModal());
    // valores de projeto: quem tem cargo (Direção, Suporte, gerência, coordenação/vice) vê como antes;
    // Membro sem cargo e Leitura só veriam valores nas janelas financeiras (às quais não têm acesso)
    const varre = () => { const re = /R\$\s?[\d.,]+|\d+,\d+ ?mi\b/g, fora = [];
      const conta = n => { const m = document.getElementById('app').innerText.match(re); if (m) fora.push(n + ': ' + m.slice(0, 2).join(' ')); };
      for (const t of ['painel', 'projetos', 'entregas', 'cronograma', 'prospeccao', 'tarefas', 'gerencias', 'infra', 'relatorios', 'config', 'sobre']) { UI.projeto = null; A.nav({ t }); if (UI.tab === t) conta(t); }
      UI.sub.painel = 'portfolio'; A.nav({ t: 'painel' }); conta('painel/portfólio');
      for (const v of ['matriz', 'pessoas', 'vagas', 'bolsas', 'entrada']) { UI.sub.equipe = v; A.nav({ t: 'equipe' }); conta('equipe/' + v); }
      for (const p of D.projetos) for (const aba of ['resumo', 'contrato', 'cronograma', 'entregas', 'docs', 'equipe', 'tarefas']) { A.projAbrir({ id: p.id, aba }); conta(p.sigla + '/' + aba); }
      UI.projeto = null; return fora; };
    const semCargo = await pg.evaluate(() => D.pessoas.find(pe => !D.alocacoes.some(a => a.pessoa_id === pe.id && (a.coordena || a.vice_coordena)) && !D.gerencia_membros.some(g => g.pessoa_id === pe.id) && D.alocacoes.some(a => a.pessoa_id === pe.id && a.status === 'ativo')).id);
    const rMembro = await pg.evaluate(new Function('id', `aplicarSim({ papel: 'membro', pessoa_id: id }); const r = { ve: Perm.veValores(), fora: (${varre.toString()})() }; return r;`), semCargo);
    ok(!rMembro.ve && !rMembro.fora.length, 'Membro sem cargo não vê valores de projeto fora do Financeiro', rMembro.fora.slice(0, 4));
    const rLeitura = await pg.evaluate(new Function('id', `aplicarSim({ papel: 'leitura', pessoa_id: id }); const r = { ve: Perm.veValores(), fora: (${varre.toString()})() }; aplicarSim({ papel: 'direcao', pessoa_id: null }); return r;`), alvo.id);
    ok(!rLeitura.ve && !rLeitura.fora.length, 'Leitura não vê valores de projeto', rLeitura.fora.slice(0, 4));
    const rDir = await pg.evaluate(() => { aplicarSim({ papel: 'direcao', pessoa_id: null }); UI.sub.painel = 'portfolio'; A.nav({ t: 'painel' }); const painel = /Valor dos vigentes/.test(document.getElementById('app').innerText);
      A.projAbrir({ id: D.projetos.find(p => p.valor_total > 0).id, aba: 'contrato' }); const contrato = /Aporte \(UFSM\)/.test(document.getElementById('app').innerText); UI.projeto = null; return { painel, contrato }; });
    ok(rDir.painel && rDir.contrato, 'Direção continua vendo os valores como antes (Painel e Contrato)', rDir);
    const rCoord = await pg.evaluate(o => { aplicarSim({ papel: 'membro', pessoa_id: o }); const r = Perm.veValores(); aplicarSim({ papel: 'direcao', pessoa_id: null }); return r; }, pj.titular);
    ok(rCoord, 'coordenador (membro com cargo) vê valores como antes');
    console.log(errs.join('\n') || 'no page errors'); await b.close();
    process.exit(falhas || errs.length ? 1 : 0);
  })();
},
'desempenho': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  const XL = CFG.PLANILHA;
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    const log = (...a) => console.log(...a);
    await pg.goto(CFG.APP); await pg.waitForTimeout(200);
    await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); Local.persistAll(); aplicarSim({ papel: 'direcao', pessoa_id: null }); A.nav({t:'projetos'}); }, old);
    const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a="importarPlanilha"]')]);
    await fc.setFiles(XL); await pg.waitForSelector('#im_ok', { timeout: 15000 }); await pg.fill('#im_sigla', 'MOVER-FUNDEP'); await pg.fill('#im_ini', '2025-03-01'); await pg.click('#im_ok'); await pg.waitForTimeout(1500);
    const tam = () => pg.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + localStorage.getItem(k).length) * 2; } return (n / 1024 / 1024).toFixed(2) + ' MB'; });
    log('localStorage hoje (dados reais + Mover):', await tam(), '| registros:', await pg.evaluate(() => Object.keys(TABLES).reduce((s, t) => s + D[t].length, 0)));
    // clona o Mover 25x com despesas e histórico
    const r = await pg.evaluate(() => { const P = D.projetos.find(x => x.sigla === 'MOVER-FUNDEP'); const t0 = performance.now();
      const clone = (t, fk, map) => D[t].filter(x => x.projeto_id === P.id).map(x => ({ ...x, id: newId(), projeto_id: map, ...(fk || {}) }));
      for (let k = 1; k <= 25; k++) { const np = { ...P, id: newId(), sigla: 'CLONE-' + k }; D.projetos.push(np);
        ['cronograma', 'orcamento_rubricas', 'plano_itens', 'entregas', 'pendencias', 'documentos'].forEach(t => D[t].push(...clone(t, null, np.id)));
        const eqMap = {}; D.equipe_plano.filter(x => x.projeto_id === P.id).forEach(x => { const n = { ...x, id: newId(), projeto_id: np.id, pessoa_id: null, status: 'vaga' }; eqMap[x.id] = n.id; D.equipe_plano.push(n); });
        D.desembolsos.push(...clone('desembolsos', null, np.id));
        for (let i = 0; i < 120; i++) D.despesas.push({ id: newId(), projeto_id: np.id, rubrica: ['1.3', '1.4', '2.1', '1.2.1'][i % 4], data: addDays('2025-04-01', i * 4), descricao: 'Despesa ' + i, valor: 1000 + i, criado_em: new Date().toISOString() });
        for (let i = 0; i < 200; i++) D.historico.push({ id: newId(), tabela: 'despesas', registro_id: newId(), operacao: 'INSERT', alteracoes: { valor: i, descricao: 'Despesa ' + i }, em: new Date().toISOString(), usuario: 'x' }); }
      for (let i = 0; i < 60; i++) D.pessoas.push({ ...DEFAULTS.pessoas, id: newId(), nome: 'Pessoa Teste ' + i, tipo: ['ic', 'mestrando', 'doutorando'][i % 3], ativo: true });
      D.projetos.filter(p => p.sigla.startsWith('CLONE')).forEach((p, i) => D.pessoas.slice(-60).slice(i * 2, i * 2 + 6).forEach(pe => D.alocacoes.push({ ...DEFAULTS.alocacoes, id: newId(), pessoa_id: pe.id, projeto_id: p.id, carga_pct: 30 })));
      return { ms: Math.round(performance.now() - t0), reg: Object.keys(TABLES).reduce((s, t) => s + D[t].length, 0) }; });
    log('volume simulado:', r.reg, 'registros');
    let quota = 'ok'; try { await pg.evaluate(() => Local.persistAll()); } catch (e) { quota = 'ERRO: ' + e.message.slice(0, 120); }
    log('gravar no navegador:', quota, '| tamanho:', await tam());
    const telas = [['Painel portfólio', () => { UI.tab = 'painel'; UI.sub.painel = 'portfolio'; }], ['Painel minha semana', () => { UI.tab = 'painel'; UI.sub.painel = 'semana'; }], ['Projetos (lista)', () => { UI.tab = 'projetos'; UI.projeto = null; }],
      ['Projeto › cronograma', () => { UI.tab = 'projetos'; UI.projeto = D.projetos.find(x => x.sigla === 'CLONE-3').id; UI.projAba = 'cronograma'; }], ['Projeto › financeiro/plano', () => { UI.projAba = 'financeiro'; UI.sub.projFin = 'plano'; }],
      ['Cronograma Gantt (tudo)', () => { UI.projeto = null; UI.tab = 'cronograma'; UI.sub.cron = 'gantt'; UI.f.cronZoom = 'tudo'; }], ['Carga da equipe', () => { UI.sub.cron = 'carga'; UI.f.cgTipo = 'todos'; }],
      ['Financeiro resumo', () => { UI.tab = 'financeiro'; UI.sub.fin = 'resumo'; }], ['Financeiro compras', () => { UI.sub.fin = 'compras'; }], ['Calendário bolsas', () => { UI.sub.fin = 'calendario'; }],
      ['Equipe vagas', () => { UI.tab = 'equipe'; UI.sub.equipe = 'vagas'; UI.f.vgSt = 'todas'; }], ['Equipe matriz', () => { UI.sub.equipe = 'matriz'; }]];
    for (const [nome, fn] of telas) { const ms = await pg.evaluate(f => { eval('(' + f + ')')(); const t0 = performance.now(); render(); return Math.round(performance.now() - t0); }, fn.toString()); log(`  ${nome}: ${ms} ms`); }
    const ms = await pg.evaluate(async () => { const t0 = performance.now(); await Data.insert('despesas', { projeto_id: D.projetos[0].id, rubrica: '1.3', data: hoje(), descricao: 'x', valor: 1 }); return Math.round(performance.now() - t0); }); log('  gravar 1 despesa (persistência local):', ms, 'ms');
    console.log(errs.join('\n') || 'no page errors'); await b.close();
  })();
},
'celular': () => {
  const { chromium } = require('playwright'); const fs = require('fs');
  (async () => {
    const old = JSON.parse(fs.readFileSync(CFG.DADOS_V1, 'utf8'));
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await pg.goto(CFG.APP); await pg.waitForTimeout(200);
    await pg.evaluate(d => { const { T } = converterV1(d); Object.keys(TABLES).forEach(t => D[t] = T[t] || []); aplicarSim({ papel: 'direcao', pessoa_id: D.pessoas.find(p => p.nome.startsWith('Lucas')).id }); UI.tab = 'painel'; UI.sub.painel = 'semana'; render(); }, old);
    await pg.screenshot({ path: CFG.saida('w1_mob_painel.png') });
    const larg = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); console.log('rolagem horizontal painel:', larg);
    await pg.evaluate(() => { UI.tab = 'projetos'; UI.projeto = D.projetos.find(p => p.sigla === 'GLASSI').id; UI.projAba = 'resumo'; render(); }); await pg.screenshot({ path: CFG.saida('w2_mob_projeto.png') });
    console.log('rolagem horizontal projeto:', await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
    await pg.evaluate(() => { UI.tab = 'financeiro'; UI.sub.fin = 'resumo'; render(); }); await pg.screenshot({ path: CFG.saida('w3_mob_fin.png') });
    console.log('rolagem horizontal financeiro:', await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
    console.log('linhas clicáveis sem teclado:', await pg.evaluate(() => [document.querySelectorAll('tr.click').length, document.querySelectorAll('tr.click[tabindex]').length]));
    await b.close();
  })();
},
};

// ── execução ──────────────────────────────────────────────────────────
module.exports = { CFG };
const { spawnSync } = require('child_process');
if (require.main !== module) { /* usado como módulo pelo online.cjs */ }
else if (process.argv[2] === '--um') { TESTES[process.argv[3]](); }
else {
  const pedidos = process.argv.slice(2);
  const lista = pedidos.length ? Object.keys(TESTES).filter(t => pedidos.some(p => t.startsWith(p))) : Object.keys(TESTES).filter(t => /^t\d+$/.test(t));
  let falhas = 0;
  for (const t of lista) {
    const ini = Date.now(), r = spawnSync(process.execPath, [__filename, '--um', t], { encoding: 'utf8', timeout: 240000 });
    const saida = (r.stdout || '') + (r.stderr || '');
    const problema = r.status !== 0 || /PAGEERR|TimeoutError|Error:/.test(saida.replace(/CONSOLE ErroRegra:.*/g, ''));
    fs.writeFileSync(path.join(SAIDA, t + '.log'), saida);
    console.log(`${problema ? '✗ FALHOU' : '✓ ok    '}  ${t}  (${((Date.now() - ini) / 1000).toFixed(1)} s)`);
    if (problema) { falhas++; console.log(saida.split('\n').filter(l => /PAGEERR|Error|Timeout|✗/.test(l)).slice(0, 6).map(l => '      ' + l).join('\n')); }
  }
  console.log(`\n${lista.length - falhas} de ${lista.length} testes ok. Logs e capturas em testes/saida/`);
  process.exit(falhas ? 1 : 0);
}
