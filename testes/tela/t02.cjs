const CFG = require('./config.cjs');
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
