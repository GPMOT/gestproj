
/* ════════════════════════════════════════════════════════════════════
   ENTREGAS E PRAZOS (todos os projetos)
   ════════════════════════════════════════════════════════════════════ */
VIEWS.entregas = () => {
  const f = UI.f, st = f.entSt || 'abertas', tp = f.entTipo || '', pj = f.entProj || '', q = norm(f.entBusca);
  let list = D.entregas.filter(e => (st === 'todas' || (st === 'abertas' ? Calc.entregaAberta(e) : st === 'atrasadas' ? Calc.entregaAtrasada(e) : !Calc.entregaAberta(e)))
    && (!tp || e.tipo === tp || (tp === 'relatorios' && e.tipo.startsWith('relatorio')) || (tp === 'prestacoes' && e.tipo.startsWith('prestacao')))
    && (!pj || e.projeto_id === pj) && (!q || norm(e.titulo + ' ' + siglaProjeto(e.projeto_id) + ' ' + nomePessoa(e.responsavel_id)).includes(q)));
  list.sort(st === 'concluidas' ? (a, b) => String(b.prazo).localeCompare(String(a.prazo)) : byName('prazo'));
  const t = hoje(), atr = D.entregas.filter(Calc.entregaAtrasada).length;
  const n = d => D.entregas.filter(e => Calc.entregaAberta(e) && e.prazo >= t && e.prazo <= addDays(t, d)).length;
  const grupos = {}; list.forEach(e => { const k = Calc.entregaAtrasada(e) ? '0-atrasadas' : e.prazo.slice(0, 7); (grupos[k] = grupos[k] || []).push(e); });
  const sel = (k, opts, v) => `<select data-f="${k}" style="width:auto">${opts.map(([o, l]) => `<option value="${o}"${v === o ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<div class="metrics">${[['Atrasadas', atr, atr ? 'color:var(--red)' : ''], ['Próximos 15 dias', n(15)], ['Próximos 30 dias', n(30)], ['Próximos 90 dias', n(90)], ['Em aberto (total)', D.entregas.filter(Calc.entregaAberta).length]].map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row">
    ${sel('entSt', [['abertas', 'Em aberto'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Entregues / aprovadas / dispensadas'], ['todas', 'Todas']], st)}
    ${sel('entTipo', [['', 'Todos os tipos'], ['relatorios', 'Relatórios técnicos'], ['prestacoes', 'Prestações de contas'], ...TIPOS_ENTREGA.filter(x => !/^(relatorio|prestacao)/.test(x[0]))], tp)}
    ${sel('entProj', [['', 'Todos os projetos'], ...optProjetos()], pj)}
    <input id="entBusca" data-f="entBusca" placeholder="Buscar…" value="${esc(f.entBusca || '')}" style="min-width:160px"></div>
    <span class="small muted">Cadastre as entregas na página de cada projeto (aba Entregas e prazos)</span></div>
  ${list.length ? Object.keys(grupos).sort().map(k => `<div class="sec">${k === '0-atrasadas' ? '<span style="color:var(--red)">Atrasadas</span>' : fmtMes(k + '-01')}</div><div class="card tw" style="padding:4px 8px">${tabelaEntregas(grupos[k], { proj: true })}</div>`).join('')
    : '<div class="empty">Nenhuma entrega neste filtro.</div>'}`;
};

/* ════════════════════════════════════════════════════════════════════
   GERÊNCIAS
   ════════════════════════════════════════════════════════════════════ */
A.gerAbrir = d => { UI.tab = 'gerencias'; UI.gerencia = d.id; window.scrollTo(0, 0); render(); };
A.gerVoltar = () => { UI.gerencia = null; render(); };
VIEWS.gerencias = () => {
  if (UI.gerencia && byId('gerencias', UI.gerencia)) return gerenciaDetalhe(byId('gerencias', UI.gerencia));
  const list = D.gerencias.slice().sort(by('ordem'));
  return `<div class="toolbar"><div class="small muted" style="max-width:720px">Áreas de gestão do laboratório. Cada gerência tem permissões que valem para <b>todos</b> os projetos e demandas próprias. A mesma pessoa pode ocupar várias gerências e também coordenar projetos.</div>
    ${Perm.dir() ? `<button class="btn-p" data-a="gerNova">+ Nova gerência</button>` : ''}</div>
  <div class="grid">${list.map(g => {
    const gs = Calc.gerentes(g.id);
    const dem = D.tarefas.filter(t => t.gerencia_id === g.id && !t.concluida), atr = dem.filter(Calc.atrasada);
    return `<div class="card" style="${g.ativa ? '' : 'opacity:.55'}">
      <div class="between mb"><button class="link" style="font-size:15px" data-a="gerAbrir" data-id="${g.id}">${esc(g.nome)}</button>${g.ativa ? '' : badge('inativa', 'b-gray')}</div>
      <div class="small muted mb">${esc(g.descricao || '')}</div>
      <div class="small mb"><b>Gerentes:</b> ${gs.length ? gs.map(gm => esc(nomePessoa(gm.pessoa_id)) + (gm.funcao === 'adjunto' ? ' (adj.)' : '')).join(', ') : '<span class="faint">ninguém nomeado</span>'}</div>
      <div class="small mb"><b>Demandas:</b> ${dem.length} aberta(s)${atr.length ? ` · <b style="color:var(--red)">${atr.length} atrasada(s)</b>` : ''}</div>
      <div>${(g.permissoes || []).map(p => `<span class="tag" title="${esc(lbl(PERMISSOES, p))}">${esc(p)}</span>`).join('') || '<span class="small faint">sem permissões especiais</span>'}</div></div>`;
  }).join('')}</div>`;
};
function camposGerencia() {
  return [{ k: 'nome', l: 'Nome', req: true }, { k: 'ordem', l: 'Ordem de exibição', t: 'number' },
  { k: 'descricao', l: 'Atribuições da área', t: 'textarea' },
  { k: 'permissoes', l: 'Permissões (valem para todos os projetos)', t: 'multi', opts: PERMISSOES },
  { k: 'ativa', l: 'Gerência ativa', t: 'check' }];
}
A.gerNova = () => form({ title: 'Nova gerência', fields: camposGerencia(), values: { ativa: true, ordem: D.gerencias.length + 1, permissoes: [] }, onSave: x => Data.insert('gerencias', { ...x, ordem: x.ordem ?? 0 }) });
A.gerEditar = d => { const g = byId('gerencias', d.id); form({ title: 'Editar gerência', fields: camposGerencia(), values: g, onSave: x => Data.update('gerencias', g.id, { ...x, ordem: x.ordem ?? 0 }),
  onDelete: async () => { await Data.remove('gerencias', g.id); UI.gerencia = null; }, deleteConfirm: `Excluir a ${g.nome}?\nAs demandas dela e o registro de gerentes serão apagados. Para desativar sem perder o histórico, desmarque "Gerência ativa".` }); };
function camposGerente(gm) {
  return [{ k: 'pessoa_id', l: 'Pessoa', t: 'select', req: true, opts: optPessoas(p => p.tipo !== 'ic'), ro: !!gm },
  { k: 'funcao', l: 'Função', t: 'select', blank: false, opts: [['titular', 'Titular'], ['adjunto', 'Adjunto']] },
  { k: 'desde', l: 'Início do mandato', t: 'date', req: true }, { k: 'ate', l: 'Término (vazio = em exercício)', t: 'date' }];
}
A.gerMembroNovo = d => form({ title: 'Nomear gerente', fields: camposGerente(null), values: { funcao: 'titular', desde: hoje() }, onSave: x => Data.insert('gerencia_membros', { ...x, gerencia_id: d.id }) });
A.gerMembroEditar = d => { const gm = byId('gerencia_membros', d.id); form({ title: 'Mandato — ' + nomePessoa(gm.pessoa_id), fields: camposGerente(gm), values: gm,
  onSave: x => { delete x.pessoa_id; return Data.update('gerencia_membros', gm.id, x); }, onDelete: () => Data.remove('gerencia_membros', gm.id), deleteLabel: 'Apagar registro',
  deleteConfirm: 'Apagar este registro de mandato? (Para encerrar o mandato mantendo o histórico, preencha a data de término.)' }); };
function gerenciaDetalhe(g) {
  const todos = D.gerencia_membros.filter(gm => gm.gerencia_id === g.id).sort((a, b) => String(b.desde).localeCompare(String(a.desde)));
  const atuais = Calc.gerentes(g.id).map(x => x.id);
  const dem = D.tarefas.filter(t => t.gerencia_id === g.id);
  const fs = UI.f.gerDem || 'abertas';
  const lista = dem.filter(t => fs === 'todas' || (fs === 'abertas' ? !t.concluida : t.concluida));
  const atalho = (g.permissoes || []).includes('infraestrutura_gerir') ? `<button class="btn-s" data-a="tab" data-t="infra">Infraestrutura →</button>` : (g.permissoes || []).includes('financeiro_ver') ? `<button class="btn-s" data-a="tab" data-t="financeiro">Financeiro →</button>` : (g.permissoes || []).includes('prospeccao_gerir') ? `<button class="btn-s" data-a="tab" data-t="prospeccao">Prospecção →</button>` : '';
  return `<div class="between mb"><div class="row"><button class="btn-s" data-a="gerVoltar">← Gerências</button><span class="title" style="font-size:18px">${esc(g.nome)}</span>${atalho}</div>
    ${Perm.dir() ? `<button data-a="gerEditar" data-id="${g.id}">✎ Editar gerência</button>` : ''}</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    <div class="card"><div class="small mb">${esc(g.descricao || '')}</div><div class="sec" style="margin-top:6px">Permissões</div>
      ${(g.permissoes || []).length ? g.permissoes.map(p => `<div class="small">✓ ${esc(lbl(PERMISSOES, p))}</div>`).join('') : '<div class="small faint">Nenhuma permissão especial — gerencia apenas as próprias demandas.</div>'}</div>
    <div class="card"><div class="between mb"><span class="bold">Gerentes</span>${Perm.dir() ? `<button class="btn-s" data-a="gerMembroNovo" data-id="${g.id}">+ nomear</button>` : ''}</div>
      ${todos.length ? todos.map(gm => `<div class="between small mb" style="${atuais.includes(gm.id) ? '' : 'opacity:.55'}"><span><b>${esc(nomePessoa(gm.pessoa_id))}</b> · ${gm.funcao} · ${fmtD(gm.desde)} → ${gm.ate ? fmtD(gm.ate) : 'em exercício'}</span>
        ${Perm.dir() ? `<button class="btn-s" data-a="gerMembroEditar" data-id="${gm.id}">✎</button>` : ''}</div>`).join('') : '<div class="empty">Ninguém nomeado.</div>'}</div>
  </div>
  <div class="sec between"><span>Demandas da gerência</span><div class="row">
    <select data-f="gerDem" style="width:auto">${[['abertas', 'Abertas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(([v, l]) => `<option value="${v}"${fs === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${Perm.gerencia(g.id) ? `<button class="btn-s" data-a="tarefaNova" data-gerencia="${g.id}">+ demanda</button>` : ''}</div></div>
  <div class="card">${listaTarefas(lista, { ger: false, vazio: 'Nenhuma demanda.' })}</div>
  <div class="mt">${ganttTarefas(lista.filter(t => !t.concluida), t => t.projeto_id ? siglaProjeto(t.projeto_id) : '')}</div>`;
}

/* ════════════════════════════════════════════════════════════════════
   TAREFAS (visão unificada)
   ════════════════════════════════════════════════════════════════════ */
VIEWS.tarefas = () => {
  const f = UI.f;
  if (f.tfEscopo === undefined) f.tfEscopo = ME.pessoa_id ? 'minhas' : '';
  const esc_ = f.tfEscopo, st = f.tfStatus || 'abertas', q = norm(f.tfBusca);
  let list = D.tarefas.slice();
  if (esc_ === 'minhas') list = list.filter(t => D.tarefa_responsaveis.some(r => r.tarefa_id === t.id && r.pessoa_id === ME.pessoa_id));
  if (esc_ === 'atrasadas') list = list.filter(Calc.atrasada);
  if (esc_ === 'semresp') list = list.filter(t => !D.tarefa_responsaveis.some(r => r.tarefa_id === t.id));
  if (st !== 'todas') list = list.filter(t => st === 'abertas' ? !t.concluida : t.concluida);
  if (f.tfProjeto) list = list.filter(t => t.projeto_id === f.tfProjeto);
  if (f.tfGerencia) list = list.filter(t => t.gerencia_id === f.tfGerencia);
  if (f.tfPessoa) list = list.filter(t => D.tarefa_responsaveis.some(r => r.tarefa_id === t.id && r.pessoa_id === f.tfPessoa));
  if (q) list = list.filter(t => norm(t.titulo + ' ' + (t.descricao || '')).includes(q));
  const sel = (k, opts, ph) => `<select data-f="${k}" style="width:auto">${[['', ph], ...opts].map(([v, l]) => `<option value="${esc(v)}"${(f[k] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const vis = UI.sub.tarefas || 'lista';
  return `<div class="toolbar"><div class="row">
    ${sel('tfEscopo', [['minhas', 'Minhas'], ['atrasadas', 'Atrasadas'], ['semresp', 'Sem responsável']], 'Todas')}
    <select data-f="tfStatus" style="width:auto">${[['abertas', 'Abertas'], ['concluidas', 'Concluídas'], ['todas', 'Abertas + concluídas']].map(([v, l]) => `<option value="${v}"${st === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${sel('tfProjeto', optProjetos(), 'Todos os projetos')} ${sel('tfGerencia', optGerencias(), 'Todas as gerências')} ${sel('tfPessoa', optPessoas(), 'Qualquer responsável')}
    <input id="tfBusca" data-f="tfBusca" placeholder="Buscar…" value="${esc(f.tfBusca || '')}" style="min-width:140px"></div>
    <div class="row"><button class="chip${vis === 'lista' ? ' on' : ''}" data-a="sub" data-g="tarefas" data-v="lista">Lista</button><button class="chip${vis === 'gantt' ? ' on' : ''}" data-a="sub" data-g="tarefas" data-v="gantt">Gantt</button>
    ${Perm.podeEditar() ? `<button class="btn-p" data-a="tarefaNova">+ Nova tarefa</button>` : ''}</div></div>
  <div class="small muted mb">${list.length} tarefa(s)</div>
  ${vis === 'lista' ? `<div class="card">${listaTarefas(list)}</div>` : ganttTarefas(list)}`;
};

/* ════════════════════════════════════════════════════════════════════
   FINANCEIRO — orçamento por rubricas, despesas e bolsas
   ════════════════════════════════════════════════════════════════════ */
A.finAbrir = d => { UI.tab = 'financeiro'; UI.f.finProj = d.id; UI.sub.fin = 'orcamento'; UI.projeto = null; window.scrollTo(0, 0); render(); };
const SUBS_FIN = [['resumo', 'Resumo geral'], ['compras', 'Compras e aquisições'], ['calendario', 'Calendário de bolsas'], ['orcamento', 'Orçamento por rubrica'], ['plano', 'Plano de aplicação'], ['desembolso', 'Desembolso'], ['despesas', 'Despesas'], ['bolsas', 'Bolsas e pagamentos']];
const GERAIS_FIN = ['resumo', 'compras', 'calendario'];
VIEWS.financeiro = () => {
  const projs = D.projetos.filter(p => Perm.veFin(p.id)).sort(byName('sigla'));
  if (!projs.length) return '<div class="empty">Você não tem acesso ao financeiro de nenhum projeto.</div>';
  const sub = UI.sub.fin || 'resumo';
  let pid = UI.f.finProj; if (!projs.some(p => p.id === pid)) pid = UI.f.finProj = projs[0].id;
  const head = `<div class="toolbar"><div class="subtabs" style="margin:0">${SUBS_FIN.map(([k, l]) => `<button class="chip${sub === k ? ' on' : ''}" data-a="sub" data-g="fin" data-v="${k}">${l}</button>`).join('')}</div>
    ${!GERAIS_FIN.includes(sub) ? `<select data-f="finProj" style="width:auto">${TIPOS_PROJ.map(([tp, tl]) => { const ps = projs.filter(p => (p.tipo || 'edital') === tp); return ps.length ? `<optgroup label="${tl}">${ps.map(p => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>${esc(p.sigla)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>` : ''}</div>`;
  if (sub === 'resumo') return head + finResumo(projs);
  if (sub === 'compras') return head + finCompras(projs);
  if (sub === 'calendario') return head + finCalendario(projs);
  const p = byId('projetos', pid);
  return head + (sub === 'orcamento' ? finOrcamento(p) : sub === 'plano' ? finPlano(p) : sub === 'desembolso' ? finDesembolso(p) : sub === 'despesas' ? finDespesas(p) : finBolsas(p));
};
/* ── Financeiro › Resumo geral (todos os projetos visíveis) ── */
function finResumo(projs) {
  const t = hoje(), ini12 = addMeses(t, -11);
  const L = projs.map(p => {
    const o = Calc.totaisOrc(p.id), temD = D.desembolsos.some(d => d.projeto_id === p.id), ds = temD ? Calc.desembolso(p).tot : null;
    const pessoal = D.vinculos_financeiros.filter(v => v.projeto_id === p.id && ['ativo', 'previsto'].includes(v.status) && v.fim >= t && v.inicio <= addDays(t, 31)).reduce((s, v) => s + num(v.valor_mensal), 0);
    const prox = ds && ds.proxima ? ds.proxima.d : null;
    const mesesAteProx = prox && prox.data_prevista ? Math.max(0, Calc.mesesPeriodo(t, prox.data_prevista)) : null;
    const cobertura = ds && pessoal > 0 ? ds.caixa / pessoal : null;
    const tempo = p.inicio && p.fim ? Math.max(0, Math.min(100, Math.round((toDate(t) - toDate(p.inicio)) / (toDate(p.fim) - toDate(p.inicio)) * 100))) : null;
    const al = [];
    if (ds && ds.caixa < -0.005) al.push(['bad', 'caixa negativo']);
    if (ds && ds.atrasadas.length) al.push(['bad', `${ds.atrasadas.length} parcela(s) atrasada(s)`]);
    if (ds && ds.rubricasNeg.length) al.push(['warn', `${ds.rubricasNeg.length} rubrica(s) acima do liberado`]);
    if (cobertura != null && mesesAteProx != null && cobertura < mesesAteProx) al.push(['warn', `caixa cobre ${cobertura.toFixed(1).replace('.', ',')} mês(es) de bolsas; próxima parcela em ${mesesAteProx}`]);
    const rubNeg = Calc.orcamento(p).rows.filter(x => x.folha && x.executado > x.aprovado + 0.005).length; if (rubNeg) al.push(['bad', `${rubNeg} rubrica(s) acima do aprovado`]);
    const aLancar = D.vinculos_financeiros.filter(v => v.projeto_id === p.id && num(v.valor_mensal) > 0).reduce((s, v) => s + Calc.competenciasPagas(v).filter(c => !D.despesas.some(x => x.vinculo_id === v.id && x.competencia === c)).length, 0);
    if (aLancar) al.push(['warn', `${aLancar} parcela(s) de bolsa a lançar`]);
    return { p, o, ds, pessoal, prox, cobertura, tempo, al };
  });
  const T = L.reduce((a, x) => { a.ap += x.o.aprovado; a.ex += x.o.executado; if (x.ds) { a.rec += x.ds.recebido; a.cx += x.ds.caixa; a.ar += x.ds.aReceber; } a.pes += x.pessoal; return a; }, { ap: 0, ex: 0, rec: 0, cx: 0, ar: 0, pes: 0 });
  const mets = [['Aprovado (projetos visíveis)', fmtBRL(T.ap)], ['Executado', fmtBRL(T.ex)], ['Recebido', fmtBRL(T.rec)], ['Saldo em caixa', fmtBRL(T.cx), T.cx < 0 ? 'color:var(--red)' : ''], ['A receber', fmtBRL(T.ar)], ['Bolsas e pessoal / mês', fmtBRL(T.pes)]];
  const linhas = L.map(x => { const p = x.p, o = x.o;
    return `<tr class="click" data-a="finAbrir" data-id="${p.id}"><td><b>${esc(p.sigla)}</b> ${badgeTipo(p)}${p.situacao !== 'vigente' ? ' ' + badge(lbl(SITUACAO_PROJ, p.situacao), 'b-gray') : ''}<div class="small muted">${esc([p.financiador, p.fundacao_apoio].filter(Boolean).join(' · '))}</div></td>
      <td class="num">${o.aprovado ? fmtBRL(o.aprovado) : `<span class="faint small">não lançado</span>${num(p.valor_total) ? `<div class="small muted">contrato ${fmtBRL(p.valor_total)}</div>` : ''}`}</td>
      <td style="white-space:nowrap">${o.aprovado ? barraExec(o.executado, o.aprovado) + `<div class="small muted">${fmtBRL(o.executado)}${x.tempo != null ? ` · tempo ${x.tempo}%` : ''}</div>` : `<span class="small">${fmtBRL(o.executado)}</span>`}</td>
      <td class="num">${x.ds ? fmtBRL(x.ds.recebido) : '<span class="faint">—</span>'}</td>
      <td class="num" style="font-weight:700;color:${x.ds && x.ds.caixa < 0 ? 'var(--red)' : 'inherit'}">${x.ds ? fmtBRL(x.ds.caixa) : '<span class="faint">—</span>'}</td>
      <td class="small">${x.prox ? `${fmtD(x.prox.data_prevista) || 'sem data'}<div class="muted">${fmtBRL(x.prox.valor_previsto)}</div>` : '<span class="faint">—</span>'}</td>
      <td class="num">${x.pessoal ? fmtBRL(x.pessoal) : '<span class="faint">—</span>'}${x.cobertura != null ? `<div class="small muted">cobre ${x.cobertura >= 24 ? '24+' : x.cobertura.toFixed(1).replace('.', ',')} mês(es)</div>` : ''}</td>
      <td class="small">${x.al.length ? x.al.map(([c, h]) => `<div style="color:${c === 'bad' ? 'var(--red)' : 'var(--yellow-txt)'}">${c === 'bad' ? '●' : '▲'} ${esc(h)}</div>`).join('') : '<span style="color:var(--green-txt)">✓ em ordem</span>'}</td></tr>`; }).join('');
  // execução mensal (últimos 12 meses) — barras, uma série
  const meses = []; for (let i = 0; i < 12; i++) meses.push(addMeses(ini12, i));
  const ids = new Set(projs.map(p => p.id));
  const porMes = meses.map(m => { const f = addDays(addMeses(m, 1), -1), ds = D.despesas.filter(d => ids.has(d.projeto_id) && d.data >= m && d.data <= f); return { m, v: ds.reduce((s, d) => s + num(d.valor), 0), n: ds.length }; });
  const max = Math.max(1, ...porMes.map(x => x.v)), W = 760, H = 170, B = 22, top = 16, bw = (W - 50) / 12;
  const escala = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : v >= 1e3 ? Math.round(v / 1e3) + ' mil' : Math.round(v);
  const grade = [0.5, 1].map(f => `<line x1="44" x2="${W}" y1="${top + (H - top - B) * (1 - f)}" y2="${top + (H - top - B) * (1 - f)}" stroke="#eeebe4"/><text x="40" y="${top + (H - top - B) * (1 - f) + 4}" font-size="10" text-anchor="end" fill="#8a8984">${escala(max * f)}</text>`).join('');
  const barras = porMes.map((x, i) => { const h = x.v / max * (H - top - B), bx = 50 + i * bw + bw * 0.18, by = H - B - h;
    return `<g><title>${esc(`${MESES[+x.m.slice(5, 7) - 1]}/${x.m.slice(0, 4)}: ${fmtBRL2(x.v)} em ${x.n} lançamento(s)`)}</title><rect x="${50 + i * bw}" y="${top}" width="${bw}" height="${H - top - B}" fill="transparent"/>${h > 0 ? `<path d="M${bx},${H - B} V${by + Math.min(4, h)} q0,-4 4,-4 h${bw * 0.64 - 8} q4,0 4,4 V${H - B} Z" fill="#2a78d6"/>` : ''}
      <text x="${50 + i * bw + bw / 2}" y="${H - 6}" font-size="10.5" text-anchor="middle" fill="#5f5e5a">${MESES[+x.m.slice(5, 7) - 1]}${x.m.slice(5, 7) === '01' || i === 0 ? '/' + x.m.slice(2, 4) : ''}</text></g>`; }).join('');
  const grafico = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" role="img" aria-label="Execução mensal">${grade}<line x1="44" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="#d0cec8"/>${barras}</svg>`;
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:17px;${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Projeto</th><th class="num">Aprovado</th><th>Execução</th><th class="num">Recebido</th><th class="num">Caixa</th><th>Próxima parcela</th><th class="num">Bolsas / mês</th><th>Situação</th></tr>${linhas}
    <tr class="total"><td>Total (${projs.length})</td><td class="num">${fmtBRL(T.ap)}</td><td>${T.ap ? barraExec(T.ex, T.ap) : ''}</td><td class="num">${fmtBRL(T.rec)}</td><td class="num">${fmtBRL(T.cx)}</td><td></td><td class="num">${fmtBRL(T.pes)}</td><td></td></tr></table></div>
  <div class="small muted mt">Caixa = recebido − executado (só projetos com parcelas de desembolso cadastradas). “Cobre N meses” = caixa ÷ bolsas e pessoal por mês — se for menor que o prazo até a próxima parcela, aparece em atenção.</div>
  <div class="card mt"><div class="between mb"><span class="bold">Execução mensal — últimos 12 meses</span><span class="small muted">total ${fmtBRL(porMes.reduce((s, x) => s + x.v, 0))} · passe o mouse nas barras</span></div>${grafico}</div>`;
}

/* ── Financeiro › Compras e aquisições (itens do plano de aplicação de todos os projetos) ── */
const GRUPOS_COMPRA = [['', 'Todas as rubricas'], ['1.2', 'Viagens (passagens e diárias)'], ['1.3', 'Material de consumo'], ['1.4', 'Serviços de terceiros'], ['2.1', 'Material permanente'], ['2.2', 'Obras']];
function finCompras(projs) {
  const fs = UI.f.cpSt || 'pendentes', fg = UI.f.cpGrupo || '', fp = UI.f.cpProj || '', q = norm(UI.f.cpBusca || ''), ids = new Set(projs.map(p => p.id));
  const ex = {}; D.despesas.forEach(d => { if (d.item_id) ex[d.item_id] = (ex[d.item_id] || 0) + num(d.valor); });
  const todos = D.plano_itens.filter(i => ids.has(i.projeto_id));
  const lista = todos.filter(i => (fs === 'todos' ? i.status !== 'cancelado' : fs === 'pendentes' ? ['previsto', 'em_aquisicao'].includes(i.status) : i.status === fs)
    && (!fg || i.rubrica === fg || i.rubrica.startsWith(fg + '.')) && (!fp || i.projeto_id === fp) && (!q || norm(i.descricao + ' ' + (i.justificativa || '')).includes(q)))
    .sort((a, b) => ({ em_aquisicao: 0, previsto: 1, adquirido: 2, cancelado: 3 }[a.status] - { em_aquisicao: 0, previsto: 1, adquirido: 2, cancelado: 3 }[b.status]) || num(b.valor_previsto) - num(a.valor_previsto));
  const pend = todos.filter(i => ['previsto', 'em_aquisicao'].includes(i.status));
  const imp = pend.filter(i => i.origem === 'importado');
  const mets = [['Itens a adquirir', pend.filter(i => i.status === 'previsto').length], ['Em aquisição', pend.filter(i => i.status === 'em_aquisicao').length], ['Valor pendente', fmtBRL(pend.reduce((s, i) => s + num(i.valor_previsto) - (ex[i.id] || 0), 0))], ['Importações pendentes', `${imp.length} · ${fmtBRL(imp.reduce((s, i) => s + num(i.valor_previsto), 0))}`]];
  const linhas = lista.map(i => { const pode = Perm.editaFin(i.projeto_id), st = ST_ITEM[i.status], e = ex[i.id] || 0;
    return `<tr${pode ? ` class="click" data-a="itemPlanoEditar" data-id="${i.id}"` : ''}><td><b>${esc(siglaProjeto(i.projeto_id))}</b></td><td class="small">${esc(i.rubrica)}${i.numero ? ' · ' + i.numero : ''}</td>
      <td><b>${esc(i.descricao)}</b>${i.origem === 'importado' ? ' ' + badge('importado' + (i.moeda && i.moeda !== 'BRL' ? ' ' + i.moeda : ''), 'b-blue') : ''}${i.detalhe ? `<div class="small muted">${esc(i.detalhe)}</div>` : ''}</td>
      <td class="num">${fmtBRL(i.valor_previsto)}</td><td class="num">${e ? fmtBRL(e) : '<span class="faint">—</span>'}</td><td>${badge(st[0], st[1])}</td>
      <td style="white-space:nowrap">${pode ? `${i.status === 'previsto' ? `<button class="btn-s" data-a="cpStatus" data-id="${i.id}" data-v="em_aquisicao">Iniciar compra</button>` : ''}${i.status === 'em_aquisicao' ? `<button class="btn-s" data-a="cpStatus" data-id="${i.id}" data-v="adquirido">Adquirido</button>` : ''} <button class="btn-s" data-a="despNova" data-projeto="${i.projeto_id}" data-item="${i.id}">+ gasto</button>` : ''}</td></tr>`; }).join('');
  const projsC = [...new Set(todos.map(i => i.projeto_id))].map(id => byId('projetos', id)).filter(Boolean).sort(byName('sigla'));
  return `<div class="metrics">${mets.map(([k, v]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:17px">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row">${[['pendentes', 'A adquirir / em aquisição'], ['em_aquisicao', 'Em aquisição'], ['adquirido', 'Adquiridos'], ['todos', 'Todos']].map(([k, l]) => `<button class="chip${fs === k ? ' on' : ''}" data-a="cpFiltro" data-v="${k}">${l}</button>`).join('')}
    <select data-f="cpGrupo" style="width:auto">${GRUPOS_COMPRA.map(([k, l]) => `<option value="${k}"${fg === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <select data-f="cpProj" style="width:auto"><option value="">Todos os projetos</option>${projsC.map(p => `<option value="${p.id}"${fp === p.id ? ' selected' : ''}>${esc(p.sigla)}</option>`).join('')}</select>
    <input id="cpBusca" data-f="cpBusca" placeholder="Buscar item…" value="${esc(UI.f.cpBusca || '')}" style="min-width:180px"></div><span class="small muted">${lista.length} item(ns)</span></div>
  <div class="card tw" style="padding:4px 8px">${lista.length ? `<table class="t"><tr><th>Projeto</th><th>Rubrica</th><th>Item</th><th class="num">Previsto</th><th class="num">Executado</th><th>Situação</th><th></th></tr>${linhas}</table>`
    : `<div class="empty">${todos.length ? 'Nenhum item com esses filtros.' : 'Nenhum item de plano de aplicação cadastrado nos projetos visíveis.'}</div>`}</div>
  <div class="small muted mt">Os itens vêm do Plano de aplicação de cada projeto. “Iniciar compra” marca o item como em aquisição (cotação, licitação, importação); ao receber, marque como adquirido — equipamentos adquiridos podem ser cadastrados na Infraestrutura pelo plano de aplicação do projeto.</div>`;
}
A.cpFiltro = d => { UI.f.cpSt = d.v; render(); };
A.cpStatus = d => run(async () => { await Data.update('plano_itens', d.id, { status: d.v }); flash(d.v === 'adquirido' ? '✓ Item marcado como adquirido' : '✓ Compra iniciada'); render(); });

/* ── Financeiro › Calendário de bolsas (parcelas mensais de todos os vínculos) ── */
function finCalendario(projs) {
  const t = hoje(), ids = new Set(projs.map(p => p.id)), ini = addMeses(t, -3), meses = []; for (let i = 0; i < 12; i++) meses.push(addMeses(ini, i));
  const vs = D.vinculos_financeiros.filter(v => ids.has(v.projeto_id) && v.status !== 'suspenso' && num(v.valor_mensal) > 0 && v.inicio <= addDays(addMeses(meses[11], 1), -1) && v.fim >= meses[0])
    .sort((a, b) => nomePessoa(a.pessoa_id).localeCompare(nomePessoa(b.pessoa_id)));
  const venc = new Map(vs.map(v => [v.id, new Set(Calc.competenciasPagas(v))]));
  const estado = (v, m) => { if (m < v.inicio.slice(0, 8) + '01' || m > v.fim) return null;
    if (D.despesas.some(x => x.vinculo_id === v.id && x.competencia === m)) return 'lancada';
    if (venc.get(v.id).has(m)) return 'vencida';
    return v.status === 'encerrado' ? null : 'prevista'; };
  const tot = meses.map(m => vs.reduce((s, v) => s + (estado(v, m) ? num(v.valor_mensal) : 0), 0));
  const pendTot = vs.reduce((s, v) => s + meses.filter(m => estado(v, m) === 'vencida').length, 0);
  const corE = { lancada: ['#eaf3de', '#27500a', '✓'], vencida: ['#faeeda', '#633806', '!'], prevista: ['#f5f4f0', '#5f5e5a', ''] };
  const podeAlgum = projs.some(p => Perm.editaFin(p.id));
  const linhas = vs.map(v => `<tr><td style="white-space:nowrap"><button class="link" data-a="pessoaAbrir" data-id="${v.pessoa_id}">${esc(nomePessoa(v.pessoa_id))}</button><div class="small muted">${esc(siglaProjeto(v.projeto_id))} · ${esc(v.modalidade || lbl(TIPOS_VINC, v.tipo))} · ${fmtBRL(v.valor_mensal)}</div></td>
    ${meses.map(m => { const e = estado(v, m); if (!e) return '<td></td>'; const [bg, fg, ic] = corE[e];
      return `<td style="background:${bg};color:${fg};text-align:center;font-size:12px" title="${esc(`${nomePessoa(v.pessoa_id)} · ${MESES[+m.slice(5, 7) - 1]}/${m.slice(0, 4)} · ${e === 'lancada' ? 'lançada' : e === 'vencida' ? 'vencida, a lançar' : 'prevista'}`)}">${ic}</td>`; }).join('')}</tr>`).join('');
  return `<div class="toolbar"><div class="row small" style="gap:12px">${[['lancada', 'lançada como despesa'], ['vencida', 'vencida, a lançar'], ['prevista', 'prevista']].map(([k, l]) => `<span class="row" style="gap:4px"><span style="display:inline-block;width:22px;height:14px;background:${corE[k][0]};color:${corE[k][1]};border-radius:3px;text-align:center;font-size:11px;line-height:14px">${corE[k][2]}</span>${l}</span>`).join('')}</div>
    ${podeAlgum ? `<button class="btn-p" data-a="finConciliarTodos" ${pendTot ? '' : 'disabled'}>Lançar parcelas vencidas${pendTot ? ` (${pendTot})` : ''}</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${vs.length ? `<table class="t"><tr><th>Bolsista / projeto</th>${meses.map(m => `<th style="text-align:center;min-width:48px${m.slice(0, 7) === t.slice(0, 7) ? ';color:var(--blue)' : ''}">${MESES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}</th>`).join('')}</tr>${linhas}
    <tr class="total"><td>Total do mês <span class="small muted" style="font-weight:400">(R$ mil)</span></td>${tot.map(v => `<td class="num" style="text-align:center;font-size:12px" title="${fmtBRL2(v)}">${v ? (v / 1e3).toFixed(1).replace('.', ',') : ''}</td>`).join('')}</tr></table>` : '<div class="empty">Nenhuma bolsa ou pagamento mensal nos projetos visíveis.</div>'}</div>
  <div class="small muted mt">Três meses para trás e nove à frente. Parcela vencida = competência já iniciada (até o 1º dia útil do mês) de bolsa ativa ou encerrada ainda não lançada como despesa. “Lançar parcelas vencidas” gera as despesas de todos os projetos em que você edita o financeiro, sem duplicar.</div>`;
}
const escalaK = v => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + ' mi' : 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + ' mil';
A.finConciliarTodos = async () => {
  const novos = [];
  D.vinculos_financeiros.filter(v => Perm.editaFin(v.projeto_id) && num(v.valor_mensal) > 0).forEach(v => Calc.competenciasPagas(v).forEach(c => { if (!D.despesas.some(x => x.vinculo_id === v.id && x.competencia === c)) novos.push([v, c]); }));
  if (!novos.length) { flash('Nenhuma parcela vencida pendente de lançamento'); return; }
  const tot = novos.reduce((s, [v]) => s + num(v.valor_mensal), 0), nP = new Set(novos.map(([v]) => v.projeto_id)).size;
  if (!await confirmar(`Lançar ${novos.length} parcela(s) de bolsas/pagamentos como despesas (${fmtBRL2(tot)}) em ${nP} projeto(s)?\n\nCada parcela vencida vira uma despesa na rubrica do vínculo, com a competência do mês.`)) return;
  await run(async () => { for (const [v, c] of novos) { const nome = nomePessoa(v.pessoa_id);
    await Data.insert('despesas', { projeto_id: v.projeto_id, rubrica: v.rubrica || '1.1.1', data: Calc.primeiroDiaUtil(c), competencia: c, valor: num(v.valor_mensal), pessoa_id: v.pessoa_id, vinculo_id: v.id, favorecido: nome, descricao: `${lbl(TIPOS_VINC, v.tipo)}${v.modalidade ? ' ' + v.modalidade : ''} — ${nome} — ${fmtMes(c)}` }); }
    flash(`✓ ${novos.length} parcela(s) lançada(s)`); render(); });
};

/* tabela de orçamento no formato do modelo: grupos somam as rubricas finais */
function orcTabela(p) {
  const { rows, tot } = Calc.orcamento(p), pode = Perm.editaFin(p.id);
  const inp = (x, campo) => pode && x.folha
    ? `<input class="cin" id="orc_${p.id}_${x.r.codigo}_${campo}" type="text" inputmode="decimal" data-orc="${p.id}|${x.r.codigo}|${campo}" value="${x[campo] ? fmtNum2(x[campo]) : ''}" placeholder="0,00" title="Aceita 1.234,56 ou 1234.56">`
    : fmtBRL2(x[campo]);
  const linhas = rows.map(x => {
    const cls = x.folha ? '' : (x.nivel === 0 ? 'grp grp0' : 'grp');
    const wPrev = x.previsto > x.aprovado + 0.005, wEx = x.executado > x.previsto + 0.005 && x.previsto > 0, bEx = x.executado > x.aprovado + 0.005;
    const ex = x.folha && x.n ? `<span class="execlink" data-a="despVer" data-projeto="${p.id}" data-rubrica="${x.r.codigo}" title="${x.n} despesa(s) — ver lançamentos">${fmtBRL2(x.executado)}</span>` : fmtBRL2(x.executado);
    return `<tr class="${cls}"><td class="cod">${esc(x.r.codigo)}</td><td style="padding-left:${8 + x.nivel * 18}px">${esc(x.r.nome)}</td>
      <td class="num">${inp(x, 'aprovado')}</td>
      <td class="num${wPrev ? ' warn' : ''}" ${wPrev ? 'title="Previsto maior que o aprovado"' : ''}>${inp(x, 'previsto')}</td>
      <td class="num${bEx ? ' bad' : wEx ? ' warn' : ''}" ${bEx ? 'title="Executado maior que o aprovado"' : wEx ? 'title="Executado já passou do previsto"' : ''}>${ex}</td>
      <td class="num" style="font-weight:${x.folha ? 600 : 700};color:${x.saldo < -0.005 ? 'var(--red)' : 'inherit'}">${fmtBRL2(x.saldo)}</td>
      <td style="white-space:nowrap">${x.aprovado ? barraExec(x.executado, x.aprovado) : ''}</td>
      ${pode ? `<td>${x.folha ? `<button class="btn-s" tabindex="-1" data-a="despNova" data-projeto="${p.id}" data-rubrica="${x.r.codigo}" title="Lançar gasto nesta rubrica">+ gasto</button>` : ''}</td>` : ''}</tr>`;
  }).join('');
  const avisos = [];
  if (tot.aprovado && Math.abs(tot.aprovado - num(p.valor_total)) > 0.5) avisos.push(`A soma aprovada nas rubricas (${fmtBRL2(tot.aprovado)}) difere do valor total do projeto (${fmtBRL2(p.valor_total)}).`);
  if (rows.some(x => x.folha && x.previsto > x.aprovado + 0.005)) avisos.push('Há rubricas com previsto maior que o aprovado (em amarelo).');
  if (rows.some(x => x.folha && x.executado > x.aprovado + 0.005)) avisos.push('Há rubricas com gasto acima do aprovado (em vermelho) — verifique remanejamento.');
  return `<div class="card tw" style="padding:4px 8px"><table class="t orc"><tr><th>Código</th><th>Rubrica</th><th class="num">Aprovado</th><th class="num">Previsto</th><th class="num">Executado</th><th class="num">Saldo</th><th>Execução</th>${pode ? '<th></th>' : ''}</tr>
    ${linhas}
    <tr class="total"><td></td><td>Total</td><td class="num">${fmtBRL2(tot.aprovado)}</td><td class="num">${fmtBRL2(tot.previsto)}</td><td class="num">${fmtBRL2(tot.executado)}</td><td class="num" style="color:${tot.saldo < 0 ? 'var(--red)' : 'inherit'}">${fmtBRL2(tot.saldo)}</td><td>${tot.aprovado ? barraExec(tot.executado, tot.aprovado) : ''}</td>${pode ? '<td></td>' : ''}</tr></table></div>
  ${pode ? '<div class="small muted mt">Digite Aprovado e Previsto direto nas células das rubricas finais; os grupos (Custeio, Pessoal, Viagens, Capital) somam sozinhos. O Executado vem das despesas lançadas.</div>' : ''}
  ${avisos.map(a => `<div class="alert warn mt">${esc(a)}</div>`).join('')}`;
}
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset || !el.dataset.orc) return;
  const [pid, cod, campo] = el.dataset.orc.split('|');
  const v = el.value.trim() === '' ? 0 : lerValorBR(el.value);
  run(async () => {
    if (!(v >= 0)) { const t = el.value; el.value = ''; falha(`Valor inválido: "${t}". Use, por exemplo, 1.234,56.`); }
    const o = D.orcamento_rubricas.find(x => x.projeto_id === pid && x.rubrica === cod);
    if (o) { if (num(o[campo]) === v) return; await Data.update('orcamento_rubricas', o.id, { [campo]: v }); }
    else if (v > 0) await Data.insert('orcamento_rubricas', { projeto_id: pid, rubrica: cod, [campo]: v });
    setTimeout(render, 0);   // deixa o foco seguir para a próxima célula antes de redesenhar
    flash(`✓ ${Calc.rotuloRubrica(cod)} · ${campo}: ${fmtBRL2(v)}`);
  });
});
const fmtNum2 = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function lerValorBR(txt) {
  let t = String(txt).replace(/R\$|\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');   // 1.234.567 sem centavos
  const n = Number(t); return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function finOrcamento(p) {
  const t = Calc.totaisOrc(p.id);
  return `<div class="metrics">${[['Valor contratado', fmtBRL(p.valor_total)], ['Aprovado', fmtBRL(t.aprovado)], ['Previsto', fmtBRL(t.previsto)], ['Executado', fmtBRL(t.executado)], ['Saldo', fmtBRL(t.saldo), t.saldo < 0 ? 'color:var(--red)' : 'color:var(--green-txt)']].map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:17px;${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row">${badgeTipo(p)}<span class="small muted">${esc(p.nome || '')} · Fundação de apoio: <b>${esc(p.fundacao_apoio || 'não informada')}</b></span></div>
    <div class="row"><button class="btn-s" data-a="projAbrir" data-id="${p.id}">abrir projeto</button>${Perm.editaFin(p.id) ? `<button class="btn-p" data-a="despNova" data-projeto="${p.id}">+ Lançar gasto</button>` : ''}</div></div>
  ${orcTabela(p)}`;
}

/* despesas (gastos executados) */
A.despVer = d => { UI.tab = 'financeiro'; UI.sub.fin = 'despesas'; UI.f.finProj = d.projeto; UI.f.dpItem = d.item || ''; UI.f.dpRub = d.item ? '' : d.rubrica || ''; UI.projeto = null; window.scrollTo(0, 0); render(); };
function finDespesas(p) {
  const f = UI.f, rub = f.dpRub || '', de = f.dpDe || '', ate = f.dpAte || '', q = norm(f.dpBusca);
  const it = f.dpItem ? byId('plano_itens', f.dpItem) : null; if (!it) f.dpItem = '';
  const list = D.despesas.filter(d => d.projeto_id === p.id && (!it || d.item_id === it.id) && (!rub || d.rubrica === rub) && (!de || d.data >= de) && (!ate || d.data <= ate)
    && (!q || norm([d.descricao, d.favorecido, d.documento, d.obs].join(' ')).includes(q))).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criado_em).localeCompare(String(a.criado_em)));
  const total = list.reduce((s, d) => s + num(d.valor), 0);
  const pode = Perm.editaFin(p.id);
  const v = rub ? Calc.valoresRubrica(p.id, rub) : null;
  return `<div class="toolbar"><div class="row">
      <select data-f="dpRub" style="width:auto"><option value="">Todas as rubricas</option>${Calc.folhas(p).map(r => `<option value="${r.codigo}"${rub === r.codigo ? ' selected' : ''}>${esc(r.codigo + ' ' + r.nome)}</option>`).join('')}</select>
      <label class="row small">de <input type="date" data-f="dpDe" value="${esc(de)}" style="width:auto;min-width:0"></label>
      <label class="row small">até <input type="date" data-f="dpAte" value="${esc(ate)}" style="width:auto;min-width:0"></label>
      <input id="dpBusca" data-f="dpBusca" placeholder="Descrição, favorecido, documento…" value="${esc(f.dpBusca || '')}" style="min-width:200px"></div>
    <div class="row"><button class="btn-s" data-a="despCSV" data-projeto="${p.id}">⬇ CSV</button>${pode ? `<button class="btn-p" data-a="despNova" data-projeto="${p.id}" data-rubrica="${rub}">+ Lançar gasto</button>` : ''}</div></div>
  ${it ? `<div class="note mb">Item do plano: <b>${esc(it.numero + ' · ' + it.descricao)}</b> (${esc(Calc.rotuloRubrica(it.rubrica))}) · previsto <b>${fmtBRL2(it.valor_previsto)}</b> · executado <b>${fmtBRL2(list.reduce((s, d) => s + num(d.valor), 0))}</b> <button class="link" data-a="dpItemLimpa">mostrar todas</button></div>` : ''}
  ${v ? `<div class="note mb">${esc(Calc.rotuloRubrica(rub))}: aprovado <b>${fmtBRL2(v.aprovado)}</b> · previsto <b>${fmtBRL2(v.previsto)}</b> · executado <b>${fmtBRL2(v.executado)}</b> · saldo <b style="color:${v.aprovado - v.executado < 0 ? 'var(--red)' : 'var(--green-txt)'}">${fmtBRL2(v.aprovado - v.executado)}</b></div>` : ''}
  <div class="card tw" style="padding:4px 8px">${list.length ? `<table class="t"><tr><th>Data</th><th>Rubrica</th><th>Descrição</th><th>Favorecido</th><th>Documento</th><th class="num">Valor</th></tr>
    ${list.map(d => `<tr class="${pode ? 'click' : ''}" ${pode ? `data-a="despEditar" data-id="${d.id}"` : ''}><td class="small" style="white-space:nowrap">${fmtD(d.data)}</td><td class="small">${esc(Calc.rotuloRubrica(d.rubrica))}</td>
      <td>${esc(d.descricao)}${d.item_id && byId('plano_itens', d.item_id) ? ` <span class="b b-gray" title="Item do plano de aplicação">item ${esc(String(byId('plano_itens', d.item_id).numero || ''))}</span>` : ''}${d.vinculo_id ? ' <span class="b b-gray" title="Parcela gerada a partir do vínculo de bolsa">bolsa</span>' : ''}${d.obs ? `<div class="small muted">${esc(d.obs)}</div>` : ''}</td><td class="small">${esc(d.favorecido || (d.pessoa_id ? nomePessoa(d.pessoa_id) : ''))}</td><td class="small">${esc(d.documento || '')}</td><td class="num">${fmtBRL2(d.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="5">Total (${list.length} lançamento(s))</td><td class="num">${fmtBRL2(total)}</td></tr></table>`
      : `<div class="empty">Nenhuma despesa ${rub || de || ate || q ? 'com esses filtros' : 'lançada neste projeto'}.</div>`}</div>`;
}
function camposDespesa(p, d) {
  const projs = D.projetos.filter(x => Perm.editaFin(x.id)).sort(byName('sigla')).map(x => [x.id, x.sigla]);
  return [
    { k: 'projeto_id', l: 'Projeto', t: 'select', req: true, blank: false, opts: projs, ro: !!d || !!p },
    { k: 'rubrica', l: 'Rubrica', t: 'select', opts: Calc.folhas(p || byId('projetos', (d || {}).projeto_id)).map(r => { const v = p ? Calc.valoresRubrica(p.id, r.codigo) : null; return [r.codigo, `${r.codigo} ${r.nome}${v ? ' — saldo ' + fmtBRL(v.aprovado - v.executado) : ''}`]; }) },
    { k: 'item_id', l: 'Item do plano de aplicação', t: 'select', blank: '— nenhum —', full: true, hide: !D.plano_itens.some(i => i.projeto_id === (p || byId('projetos', (d || {}).projeto_id) || {}).id),
      opts: D.plano_itens.filter(i => i.projeto_id === (p || byId('projetos', (d || {}).projeto_id) || {}).id && (i.status !== 'cancelado' || (d && d.item_id === i.id))).sort((a, b) => Calc.codCmp(a.rubrica, b.rubrica) || a.numero - b.numero)
        .map(i => [i.id, `${i.rubrica} · ${i.numero || ''} ${i.descricao.length > 60 ? i.descricao.slice(0, 58) + '…' : i.descricao} — previsto ${fmtBRL(i.valor_previsto)}`]), help: 'Se escolher um item, a rubrica é a do item' },
    { k: 'data', l: 'Data da despesa', t: 'date', req: true }, { k: 'valor', l: 'Valor (R$)', t: 'money', req: true, min: 0.01 },
    { k: 'descricao', l: 'Descrição', req: true, full: true, ph: 'Ex.: Compra de analisador de gases; Diárias viagem SAE Brasil' },
    { k: 'favorecido', l: 'Favorecido (fornecedor, bolsista, empresa)' }, { k: 'documento', l: 'Documento (NF, recibo, OB)' },
    { k: 'competencia', l: 'Competência (mês de referência)', t: 'date', help: 'Opcional — use para bolsas e folha' },
    { k: 'pessoa_id', l: 'Pessoa (se for pagamento a pessoa)', t: 'select', opts: optPessoas() },
    { k: 'obs', l: 'Observação', t: 'textarea', rows: 2 }];
}
/* ao escolher o item, a rubrica acompanha */
const sincItemRubrica = () => { const it = document.getElementById('fld_item_id'), rb = document.getElementById('fld_rubrica'); if (!it || !rb) return;
  const f = () => { const i = byId('plano_itens', it.value); rb.disabled = !!i; if (i) rb.value = i.rubrica; }; it.addEventListener('change', f); f(); };
function avisaSaldo(pid, rub) {
  const v = Calc.valoresRubrica(pid, rub);
  if (v.executado > v.aprovado + 0.005) setTimeout(() => flash(`Atenção: ${Calc.rotuloRubrica(rub)} ficou com saldo negativo (${fmtBRL2(v.aprovado - v.executado)}).`, true), 50);
}
A.despNova = d => {
  const p = byId('projetos', d.projeto || UI.f.finProj);
  form({ title: 'Lançar gasto' + (p ? ' — ' + p.sigla : ''), fields: camposDespesa(p, null), values: { projeto_id: p && p.id, rubrica: d.item ? byId('plano_itens', d.item).rubrica : d.rubrica || null, item_id: d.item || null, data: hoje(), descricao: d.item ? byId('plano_itens', d.item).descricao : null },
    onSave: async x => { x.projeto_id = x.projeto_id || (p && p.id); if (x.item_id) x.rubrica = byId('plano_itens', x.item_id).rubrica; if (!x.rubrica) falha('Escolha a rubrica ou o item.'); const n = await Data.insert('despesas', x); avisaSaldo(x.projeto_id, n.rubrica);
      const it = x.item_id && byId('plano_itens', x.item_id); if (it && it.status === 'previsto' && Perm.editaFin(it.projeto_id)) await Data.update('plano_itens', it.id, { status: 'em_aquisicao' }); }, okMsg: '✓ Gasto lançado', onOpen: sincItemRubrica });
};
A.despEditar = d => {
  const x0 = byId('despesas', d.id), p = byId('projetos', x0.projeto_id);
  form({ title: 'Despesa — ' + p.sigla, fields: camposDespesa(p, x0), values: x0,
    intro: x0.vinculo_id ? '<div class="note mb small">Parcela gerada automaticamente a partir de um vínculo de bolsa. Se excluir, ela volta a ser gerada na próxima conciliação enquanto o vínculo estiver ativo.</div>' : '',
    onSave: async x => { delete x.projeto_id; if (x.item_id) x.rubrica = byId('plano_itens', x.item_id).rubrica; const n = await Data.update('despesas', x0.id, x); avisaSaldo(p.id, n.rubrica); },
    onOpen: sincItemRubrica, onDelete: () => Data.remove('despesas', x0.id), deleteConfirm: `Excluir a despesa "${x0.descricao}" (${fmtBRL2(x0.valor)})?` });
};
A.despCSV = d => {
  const p = byId('projetos', d.projeto);
  const lst = D.despesas.filter(x => x.projeto_id === p.id).sort(byName('data'));
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Código', 'Rubrica', 'Descrição', 'Favorecido', 'Documento', 'Competência', 'Valor'].join(';'),
    ...lst.map(x => [fmtD(x.data), x.rubrica, (D.rubricas.find(r => r.codigo === x.rubrica) || {}).nome, x.descricao, x.favorecido || (x.pessoa_id ? nomePessoa(x.pessoa_id) : ''), x.documento, x.competencia ? fmtMes(x.competencia) : '', String(num(x.valor).toFixed(2)).replace('.', ',')].map(c).join(';'))];
  baixar(`despesas-${rSlug(p.sigla)}-${hoje()}.csv`, '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
};
const rSlug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* bolsas e pagamentos a pessoas */
A.finConciliar = async d => {
  const pid = d.id, novos = [];
  D.vinculos_financeiros.filter(v => v.projeto_id === pid && num(v.valor_mensal) > 0).forEach(v => {
    Calc.competenciasPagas(v).forEach(c => { if (!D.despesas.some(x => x.vinculo_id === v.id && x.competencia === c)) novos.push([v, c]); });
  });
  if (!novos.length) { flash('Nenhuma parcela vencida pendente de lançamento'); return; }
  const tot = novos.reduce((s, [v]) => s + num(v.valor_mensal), 0);
  if (!await confirmar(`Lançar ${novos.length} parcela(s) de bolsas/pagamentos como despesas (${fmtBRL2(tot)})?\n\nCada parcela vencida (até o 1º dia útil do mês) vira uma despesa na rubrica do vínculo, com a competência do mês. Parcelas já lançadas não são duplicadas.`)) return;
  for (const [v, c] of novos) {
    const nome = nomePessoa(v.pessoa_id);
    await Data.insert('despesas', { projeto_id: pid, rubrica: v.rubrica || '1.1.1', data: Calc.primeiroDiaUtil(c), competencia: c, valor: num(v.valor_mensal), pessoa_id: v.pessoa_id, vinculo_id: v.id, favorecido: nome,
      descricao: `${lbl(TIPOS_VINC, v.tipo)}${v.modalidade ? ' ' + v.modalidade : ''} — ${nome} — ${fmtMes(c)}` });
  }
  render(); flash(`✓ ${novos.length} parcela(s) lançada(s) como despesa`);
};
function tabelaVinculos(list, o = {}) {
  if (!list.length) return '<div class="empty">Nenhum vínculo financeiro.</div>';
  return `<table class="t"><tr>${o.pessoa !== false ? '<th>Pessoa</th>' : ''}${o.projeto !== false ? '<th>Projeto</th>' : ''}<th>Tipo</th><th>Rubrica</th><th class="num">R$/mês</th><th>Período</th><th class="num">Total</th><th class="num">Parcelas vencidas / lançadas</th><th>Status</th></tr>
  ${list.map(v => { const pode = Perm.editaFin(v.projeto_id); const venc = Calc.mesesPagos(v), lanc = D.despesas.filter(x => x.vinculo_id === v.id).length;
    return `<tr class="${pode ? 'click' : ''}" ${pode ? `data-a="vincEditar" data-id="${v.id}"` : ''}>${o.pessoa !== false ? `<td><b>${esc(nomePessoa(v.pessoa_id))}</b></td>` : ''}${o.projeto !== false ? `<td>${esc(siglaProjeto(v.projeto_id))}</td>` : ''}
      <td class="small">${esc(lbl(TIPOS_VINC, v.tipo))}${v.modalidade ? ' · ' + esc(v.modalidade) : ''}${v.vaga_id && byId('equipe_plano', v.vaga_id) ? `<div class="muted">${esc(byId('equipe_plano', v.vaga_id).nome_plano)}</div>` : ''}</td><td class="small">${esc(Calc.rotuloRubrica(v.rubrica))}</td><td class="num">${fmtBRL2(v.valor_mensal)}</td><td class="small">${fmtMes(v.inicio)} → ${fmtMes(v.fim)} (${Calc.mesesVinculo(v)} m)</td>
      <td class="num">${fmtBRL(Calc.totalVinculo(v))}</td><td class="num small" style="${lanc < venc ? 'color:var(--yellow-txt);font-weight:700' : ''}">${venc} / ${lanc}</td><td>${badgeOf(ST_VINC, v.status)}</td></tr>`; }).join('')}</table>`;
}
function finBolsas(p) {
  const list = D.vinculos_financeiros.filter(v => v.projeto_id === p.id).sort((a, b) => nomePessoa(a.pessoa_id).localeCompare(nomePessoa(b.pessoa_id)));
  const ativo = list.filter(v => v.status === 'ativo').reduce((s, v) => s + num(v.valor_mensal), 0);
  const pend = list.reduce((s, v) => s + Calc.competenciasPagas(v).filter(c => !D.despesas.some(x => x.vinculo_id === v.id && x.competencia === c)).length, 0);
  const porRub = {}; list.filter(v => v.status !== 'suspenso').forEach(v => porRub[v.rubrica] = (porRub[v.rubrica] || 0) + Calc.totalVinculo(v));
  return `<div class="toolbar"><div class="row">${badge('Ativos: ' + fmtBRL2(ativo) + '/mês', 'b-green')}${pend ? badge(pend + ' parcela(s) vencida(s) a lançar', 'b-yellow') : ''}</div>
    <div class="row">${Perm.editaFin(p.id) ? `<button data-a="finConciliar" data-id="${p.id}" ${pend ? '' : 'disabled'}>Lançar parcelas vencidas</button><button class="btn-p" data-a="vincNovo" data-projeto="${p.id}">+ Bolsa / pagamento</button>` : ''}</div></div>
  <div class="card tw" style="padding:4px 8px">${tabelaVinculos(list, { projeto: false })}</div>
  ${Object.keys(porRub).length ? `<div class="note mt small">Comprometido pelos vínculos: ${Object.entries(porRub).map(([r, v]) => { const x = Calc.valoresRubrica(p.id, r); return `<b>${esc(Calc.rotuloRubrica(r))}</b> ${fmtBRL(v)} (previsto na rubrica: ${fmtBRL(x.previsto)}${v > x.previsto + 0.5 ? ' — <span style="color:var(--red)">acima do previsto</span>' : ''})`; }).join(' · ')}</div>` : ''}
  <div class="small muted mt">Parcela vencida = mês de competência já iniciado (até o 1º dia útil), para vínculos ativos ou encerrados. “Lançar parcelas vencidas” gera uma despesa por mês na rubrica do vínculo, sem duplicar.</div>`;
}
function camposVinc(pid) {
  const p = byId('projetos', pid);
  return [{ k: 'pessoa_id', l: 'Pessoa (equipe ou IC)', t: 'select', req: true, opts: optPessoas() },
  { k: 'tipo', l: 'Tipo', t: 'select', blank: false, opts: TIPOS_VINC }, { k: 'modalidade', l: 'Modalidade (ex.: PIBIC/CNPq, Doutor II)' },
  { k: 'rubrica', l: 'Rubrica', t: 'select', blank: false, req: true, opts: Calc.folhas(p).map(r => [r.codigo, r.codigo + ' ' + r.nome]) },
  { k: 'valor_mensal', l: 'Valor mensal (R$)', t: 'money', req: true, min: 0 },
  { k: 'inicio', l: 'Início', t: 'date', req: true }, { k: 'fim', l: 'Fim', t: 'date', req: true },
  { k: 'status', l: 'Status', t: 'select', blank: false, opts: Object.entries(ST_VINC).map(([k, v]) => [k, v[0]]) },
  { k: 'vaga_id', l: 'Posição do plano de trabalho', t: 'select', blank: '— nenhuma —', hide: !D.equipe_plano.some(e => e.projeto_id === pid), opts: D.equipe_plano.filter(e => e.projeto_id === pid).sort(by('ordem')).map(e => [e.id, e.nome_plano + (e.pessoa_id ? ' — ' + nomePessoa(e.pessoa_id) : ' (vaga)')]), help: 'Conta os meses desta bolsa no saldo da posição' },
  { k: 'obs', l: 'Observação', t: 'textarea', rows: 2 }];
}
A.vincNovo = d => form({ title: 'Nova bolsa / pagamento — ' + siglaProjeto(d.projeto), fields: camposVinc(d.projeto), values: { tipo: 'bolsa', rubrica: '1.1.1', status: 'previsto' }, onSave: x => Data.insert('vinculos_financeiros', { ...x, projeto_id: d.projeto }) });
A.vincEditar = d => { const v = byId('vinculos_financeiros', d.id); form({ title: 'Bolsa / pagamento — ' + nomePessoa(v.pessoa_id), fields: camposVinc(v.projeto_id), values: v, onSave: x => Data.update('vinculos_financeiros', v.id, x),
  onDelete: () => Data.remove('vinculos_financeiros', v.id), deleteConfirm: 'Excluir este vínculo? As despesas já lançadas a partir dele continuam no orçamento (sem o vínculo).' }); };

/* ════════════════════════════════════════════════════════════════════
   PROSPECÇÃO — matriz de decisão, funil e extração de editais
   ════════════════════════════════════════════════════════════════════ */
const DM_FILTERS = [
  { id: 'f_align', q: 'Alinhamento técnico mínimo', d: 'O tema está dentro das competências centrais do lab?' },
  { id: 'f_resp', q: 'Responsável técnico claro', d: 'Existe alguém capaz de liderar o projeto de verdade?' },
  { id: 'f_infra', q: 'Infraestrutura disponível', d: 'Há banco, instrumentação, software e equipe para executar?' },
  { id: 'f_prazo', q: 'Prazo compatível', d: 'O cronograma é executável sem comprometer projetos já assumidos?' },
  { id: 'f_recurso', q: 'Contrapartida / recurso mínimo', d: 'Cobre custos reais, bolsas, insumos, manutenção e gestão?' },
  { id: 'f_risco', q: 'Risco reputacional aceitável', d: 'NÃO há chance relevante de não entregar ou entregar mal?' }];
const DM_BLOCKS = [
  { name: 'Alinhamento estratégico', weight: 30, crit: [{ id: 'c_lin', lbl: 'Aderência às linhas centrais do laboratório', w: 15 }, { id: 'c_part', lbl: 'Importância estratégica do parceiro/edital', w: 10 }, { id: 'c_sin', lbl: 'Sinergia com projetos em andamento', w: 5 }] },
  { name: 'Retorno técnico/acadêmico/institucional', weight: 25, crit: [{ id: 'c_inov', lbl: 'Potencial de inovação tecnológica', w: 10 }, { id: 'c_form', lbl: 'Potencial de formação de alunos', w: 5 }, { id: 'c_pub', lbl: 'Publicação / propriedade intelectual / demonstração', w: 5 }, { id: 'c_inst', lbl: 'Fortalecimento institucional UFSM/GPMOT', w: 5 }] },
  { name: 'Sustentabilidade financeira e operacional', weight: 25, crit: [{ id: 'c_vol', lbl: 'Volume de recursos', w: 7 }, { id: 'c_eq', lbl: 'Recursos para equipe', w: 8 }, { id: 'c_man', lbl: 'Recursos para infraestrutura, manutenção e insumos', w: 5 }, { id: 'c_cp', lbl: 'Baixa necessidade de contrapartida não financiada', w: 5 }] },
  { name: 'Risco e capacidade de execução', weight: 20, crit: [{ id: 'c_deq', lbl: 'Disponibilidade de equipe', w: 7 }, { id: 'c_dinf', lbl: 'Disponibilidade de infraestrutura', w: 5 }, { id: 'c_rtec', lbl: 'Baixo risco técnico', w: 4 }, { id: 'c_radm', lbl: 'Baixo risco administrativo/jurídico', w: 2 }, { id: 'c_rrep', lbl: 'Baixo risco reputacional', w: 2 }] }];
const DM_EFFORTS = [
  { id: 'e_coord', lbl: 'Carga de coordenação / pessoas-chave', d: 'horas do coordenador e gargalo em uma pessoa só' },
  { id: 'e_team', lbl: 'Carga de equipe técnica/pesquisa', d: 'engenheiros, pesquisadores, técnicos, bolsistas necessários' },
  { id: 'e_infra', lbl: 'Carga de infraestrutura', d: 'banco dinamométrico, analisadores/emissões, CFD/GT-Power' },
  { id: 'e_adm', lbl: 'Complexidade administrativa', d: 'compras/importações críticas, dependência de terceiros' }];
const DM_ALL = DM_BLOCKS.flatMap(b => b.crit);
const QUAD = { max: ['Prioridade máxima', 'b-green', '#3b6d11'], strat: ['Estratégico — aceitar poucos', 'b-blue', '#1a5ca8'], easy: ['Só se fácil e útil', 'b-yellow', '#ba7517'], no: ['Recusar', 'b-red', '#c43030'] };
const dmIA = sc => DM_ALL.reduce((s, c) => s + num(sc[c.id]) * c.w, 0) / 5;
const dmIE = ef => DM_EFFORTS.reduce((s, e) => s + num(ef[e.id]), 0) / DM_EFFORTS.length;
const dmQuad = (ia, ie) => ia >= 65 ? (ie >= 3 ? 'strat' : 'max') : (ie >= 3 ? 'no' : 'easy');
const dmClass = ia => ia >= 80 ? ['Prioridade alta — submeter / executar', 'ok'] : ia >= 65 ? ['Submeter apenas se houver capacidade ou parceria forte', 'warn'] : ia >= 50 ? ['Renegociar escopo, prazo ou orçamento', 'warn'] : ['Recusar ou não priorizar', 'bad'];

function abrirMatriz(pr) {
  const ult = Calc.ultimaAvaliacao(pr.id);
  const sug = !ult && (pr.texto_origem || pr.objetivo) ? submissionMatrixSuggestions({ name: pr.nome, title: pr.edital, funder: pr.financiador, objective: pr.objetivo, notes: pr.observacoes, raw: pr.texto_origem, value: pr.valor_estimado, lead: pr.responsavel_id }) : {};
  const st = { filtros: { ...((ult && ult.filtros) || sug.filters || {}) }, notas: {}, esforcos: {} };
  DM_ALL.forEach(c => st.notas[c.id] = num((ult && ult.notas[c.id]) || (sug.scores && sug.scores[c.id]) || 3));
  DM_EFFORTS.forEach(e => st.esforcos[e.id] = num((ult && ult.esforcos[e.id]) || (sug.efforts && sug.efforts[e.id]) || 3));
  const html = `<div class="between mb"><div><div class="small muted">GPMOT · Apoio à decisão de portfólio</div><h3 style="margin:2px 0">Matriz de decisão — ${esc(pr.nome)}</h3></div><button class="btn-s" id="dm_x">✕</button></div>
    <div class="note mb"><b>Regra interna:</b> nenhum projeto é aceito apenas porque há oportunidade de submissão. Cada projeto precisa demonstrar alinhamento estratégico, capacidade real de execução, sustentabilidade financeira e contribuição para formação, produção tecnológica ou consolidação institucional.${ult ? `<br>Partindo da última avaliação (${fmtDT(ult.avaliado_em)}). Salvar cria uma nova avaliação; a anterior fica no histórico.` : sug.scores ? '<br>Notas sugeridas automaticamente a partir do texto do edital — revise.' : ''}</div>
    <div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);gap:16px">
      <div>
        <div class="sec" style="margin-top:0">01 · Filtro eliminatório</div>
        ${DM_FILTERS.map(f => `<div class="between crit"><div class="small"><b>${esc(f.q)}</b><br><span class="muted">${esc(f.d)}</span></div><div class="seg" data-fid="${f.id}"><button data-v="pass" class="${st.filtros[f.id] === 'pass' ? 'pass' : ''}">Passa</button><button data-v="fail" class="${st.filtros[f.id] === 'fail' ? 'fail' : ''}">Reprova</button></div></div>`).join('')}
        <div class="sec">02 · Matriz de atratividade (nota 1–5)</div>
        ${DM_BLOCKS.map(b => `<div class="bold small mt">${esc(b.name)} <span class="faint">· peso ${b.weight}</span></div>${b.crit.map(c => `<div class="crit"><div class="top"><span class="lbl">${esc(c.lbl)} <span class="faint">p${c.w}</span></span><span class="val" id="dmv_${c.id}">${st.notas[c.id]}</span></div><input type="range" min="1" max="5" step="1" value="${st.notas[c.id]}" data-c="${c.id}"></div>`).join('')}`).join('')}
        <div class="sec">03 · Esforço de execução (1 leve · 5 consome o laboratório)</div>
        ${DM_EFFORTS.map(e => `<div class="crit"><div class="top"><span class="lbl">${esc(e.lbl)}<br><span class="small faint">${esc(e.d)}</span></span><span class="val" id="dmv_${e.id}" style="color:var(--yellow)">${st.esforcos[e.id]}</span></div><input type="range" min="1" max="5" step="1" value="${st.esforcos[e.id]}" data-e="${e.id}"></div>`).join('')}
      </div>
      <div><div class="card" style="position:sticky;top:0">
        <div id="dm_verd" style="font-size:18px;font-weight:800">—</div><div id="dm_sub" class="small muted mb">—</div>
        <div class="metrics" style="grid-template-columns:repeat(3,1fr)"><div class="metric"><div class="k">Atratividade</div><div class="v" id="dm_ia">—</div></div><div class="metric"><div class="k">Esforço</div><div class="v" id="dm_ie">—</div></div><div class="metric"><div class="k">Prioridade</div><div class="v" id="dm_ip">—</div></div></div>
        <div id="dm_quad" class="mb"></div><div id="dm_al"></div>
        <label class="fl mt">Parecer / justificativa</label><textarea id="dm_par" rows="3"></textarea>
        <div class="mactions"><button id="dm_cancel">Cancelar</button><button class="btn-p" id="dm_save">Salvar avaliação</button></div>
      </div></div></div>`;
  openModal(html, { wide: true, sticky: true, noFocus: true });
  const root = document.getElementById('modal-root');
  const q = s => root.querySelector(s);
  const compute = () => {
    const ia = dmIA(st.notas), ie = dmIE(st.esforcos), ip = ie ? ia / ie : 0;
    const answered = DM_FILTERS.filter(f => st.filtros[f.id]).length, failed = DM_FILTERS.filter(f => st.filtros[f.id] === 'fail');
    const bloq = failed.length > 0, qk = dmQuad(ia, ie), cl = dmClass(ia);
    q('#dm_ia').textContent = ia.toFixed(0); q('#dm_ie').textContent = ie.toFixed(1); q('#dm_ip').textContent = ip.toFixed(1);
    q('#dm_verd').textContent = bloq ? 'BLOQUEADO' : cl[0].split('—')[0].trim().toUpperCase();
    q('#dm_verd').style.color = bloq || cl[1] === 'bad' ? 'var(--red)' : cl[1] === 'ok' ? 'var(--green)' : 'var(--yellow)';
    q('#dm_sub').textContent = bloq ? 'Reprovado no filtro eliminatório — não deve seguir.' : cl[0];
    q('#dm_quad').innerHTML = bloq ? badge('eliminado', 'b-red') : badge(QUAD[qk][0], QUAD[qk][1]);
    const al = [];
    if (answered < DM_FILTERS.length && !bloq) al.push(['warn', `Responda os 6 critérios do filtro (${answered}/6).`]);
    failed.forEach(f => al.push(['bad', `Falha eliminatória: "${f.q}".`]));
    if (!bloq && ia >= 80 && ie >= 4) al.push(['warn', 'Alta atratividade, mas esforço muito alto: aceitar só com equipe/recurso dedicado.']);
    if (!bloq && ia >= 65 && ie < 3) al.push(['ok', 'Boa atratividade com esforço baixo: candidato a prioridade máxima.']);
    if (!bloq && ia < 50 && ie < 3) al.push(['warn', 'Atratividade baixa, mas barato: aceitar só se trouxer relacionamento, recurso ou publicação rápida.']);
    if (!bloq && ia < 65 && ie >= 4) al.push(['bad', 'Baixa atratividade e esforço alto: forte candidato a recusa ou renegociação.']);
    q('#dm_al').innerHTML = al.map(([c, m]) => `<div class="alert ${c}">${esc(m)}</div>`).join('');
    q('#dm_save').disabled = answered < DM_FILTERS.length;
    return { ia, ie, ip, bloqueada: bloq, quadrante: bloq ? null : qk };
  };
  root.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.onclick = () => {
    st.filtros[seg.dataset.fid] = b.dataset.v; seg.querySelectorAll('button').forEach(x => x.className = ''); b.className = b.dataset.v; compute();
  }));
  root.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => {
    if (r.dataset.c) { st.notas[r.dataset.c] = +r.value; q('#dmv_' + r.dataset.c).textContent = r.value; }
    else { st.esforcos[r.dataset.e] = +r.value; q('#dmv_' + r.dataset.e).textContent = r.value; }
    compute();
  });
  q('#dm_x').onclick = q('#dm_cancel').onclick = closeModal;
  q('#dm_save').onclick = () => run(async () => {
    const r = compute();
    await Data.insert('avaliacoes', { prospeccao_id: pr.id, filtros: st.filtros, notas: st.notas, esforcos: st.esforcos, ia: +r.ia.toFixed(1), ie: +r.ie.toFixed(1), ip: +r.ip.toFixed(2), bloqueada: r.bloqueada, quadrante: r.quadrante, parecer: q('#dm_par').value.trim() || null });
    closeModal(); render(); flash('✓ Avaliação salva');
  });
  compute();
}
VIEWS.prospeccao = () => {
  const gere = Perm.gereProspeccao();
  const fs = UI.f.prFiltro || 'ativos';
  let list = D.prospeccoes.slice();
  if (fs === 'ativos') list = list.filter(p => ['avaliacao', 'aprovada', 'renegociar'].includes(p.situacao));
  else if (fs !== 'todas') list = list.filter(p => p.situacao === fs);
  const aval = p => Calc.ultimaAvaliacao(p.id);
  list.sort((a, b) => { const A1 = aval(a), B1 = aval(b); const ab = A1 && A1.bloqueada ? 1 : 0, bb = B1 && B1.bloqueada ? 1 : 0; return ab - bb || num(B1 && B1.ip) - num(A1 && A1.ip); });
  const cont = k => D.prospeccoes.filter(p => p.situacao === k).length;
  return `<div class="metrics">${[['Total', D.prospeccoes.length], ...Object.entries(PIPE).map(([k, v]) => [v[0], cont(k)])].map(([k, v]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:19px">${v}</div></div>`).join('')}</div>
  ${gere ? painelSubmissao() : ''}
  <div class="toolbar"><div class="subtabs" style="margin:0">${[['ativos', 'Em andamento'], ...Object.entries(PIPE).map(([k, v]) => [k, v[0]]), ['todas', 'Todas']].map(([k, l]) => `<button class="chip${fs === k ? ' on' : ''}" data-a="prFiltro" data-v="${k}">${l}</button>`).join('')}</div>
    ${gere ? `<button class="btn-p" data-a="prNova">+ Nova prospecção</button>` : ''}</div>
  ${list.length ? `<div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Prospecção</th><th>Financiador</th><th>Prazo submissão</th><th>Filtro</th><th class="num">IA</th><th class="num">IE</th><th class="num">IP</th><th>Quadrante</th><th>Situação</th><th></th></tr>
    ${list.map(p => { const a = aval(p); const nA = D.avaliacoes.filter(x => x.prospeccao_id === p.id).length;
      return `<tr><td style="min-width:200px;max-width:340px"><button class="link" data-a="prEditar" data-id="${p.id}">${esc(p.nome)}</button>${p.projeto_id ? ' ' + badge('→ ' + siglaProjeto(p.projeto_id), 'b-blue') : ''}${nA > 1 ? ` <span class="small faint" title="avaliações registradas">(${nA} aval.)</span>` : ''}</td>
        <td class="small" title="${esc(p.financiador || '')}" style="max-width:180px">${esc((p.financiador || '—').length > 60 ? p.financiador.slice(0, 58) + '…' : (p.financiador || '—'))}</td><td class="small">${p.prazo_submissao ? fmtD(p.prazo_submissao) : '—'}</td>
        <td>${!a ? badge('a avaliar', 'b-yellow') : a.bloqueada ? badge('bloqueado', 'b-red') : badge('passou', 'b-green')}</td>
        <td class="num">${a && !a.bloqueada ? Math.round(a.ia) : '—'}</td><td class="num">${a && !a.bloqueada ? num(a.ie).toFixed(1) : '—'}</td><td class="num" style="font-weight:700;color:#a8500f">${a && !a.bloqueada ? num(a.ip).toFixed(1) : '—'}</td>
        <td>${a && !a.bloqueada && a.quadrante ? badge(QUAD[a.quadrante][0], QUAD[a.quadrante][1]) : '—'}</td>
        <td>${gere ? `<select onchange="run(()=>Data.update('prospeccoes','${p.id}',{situacao:this.value}).then(render))" style="width:auto;font-size:12px;padding:3px 5px">${Object.entries(PIPE).map(([k, v]) => `<option value="${k}"${p.situacao === k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select>` : badgeOf(PIPE, p.situacao)}</td>
        <td style="white-space:nowrap">${gere ? `<button class="btn-s" data-a="prAvaliar" data-id="${p.id}">${a ? 'Reavaliar' : 'Avaliar'}</button> ${!p.projeto_id && (Perm.dir() || Perm.tem('projetos_criar')) ? `<button class="btn-s" data-a="prPromover" data-id="${p.id}">Promover →</button>` : ''}` : ''} ${nA ? `<button class="btn-s" data-a="prHist" data-id="${p.id}">histórico</button>` : ''}</td></tr>`; }).join('')}</table></div>` : '<div class="empty">Nenhuma prospecção neste filtro.</div>'}
  <div class="card mt"><div class="bold mb">Mapa 2×2 — atratividade × esforço</div>${graficoProsp(list)}</div>`;
};
A.prFiltro = d => { UI.f.prFiltro = d.v; render(); };
A.prAvaliar = d => abrirMatriz(byId('prospeccoes', d.id));
A.prHist = d => {
  const p = byId('prospeccoes', d.id);
  const av = D.avaliacoes.filter(a => a.prospeccao_id === p.id).sort((a, b) => String(b.avaliado_em).localeCompare(String(a.avaliado_em)));
  mostrar('Avaliações — ' + p.nome, `<table class="t"><tr><th>Data</th><th>Por</th><th>Filtro</th><th class="num">IA</th><th class="num">IE</th><th class="num">IP</th><th>Quadrante</th><th>Parecer</th></tr>${av.map(a => `<tr><td class="small">${fmtDT(a.avaliado_em)}</td><td class="small">${esc(quem(a.avaliado_por))}</td><td>${a.bloqueada ? badge('bloqueado', 'b-red') : badge('passou', 'b-green')}</td><td class="num">${Math.round(a.ia)}</td><td class="num">${num(a.ie).toFixed(1)}</td><td class="num">${num(a.ip).toFixed(1)}</td><td class="small">${a.quadrante ? esc(QUAD[a.quadrante][0]) : '—'}</td><td class="small">${esc(a.parecer || '')}</td></tr>`).join('')}</table>`, true);
};
function camposProsp() {
  return [{ k: 'nome', l: 'Nome / sigla', req: true }, { k: 'financiador', l: 'Financiador / parceiro' },
  { k: 'edital', l: 'Edital / chamada', full: true }, { k: 'valor_estimado', l: 'Valor estimado (R$)', t: 'money', min: 0 },
  { k: 'prazo_submissao', l: 'Prazo de submissão', t: 'date' }, { k: 'inicio_previsto', l: 'Início previsto', t: 'date' }, { k: 'fim_previsto', l: 'Término previsto', t: 'date' },
  { k: 'responsavel_id', l: 'Responsável', t: 'select', opts: optPessoas(p => p.tipo !== 'ic') },
  { k: 'situacao', l: 'Situação', t: 'select', blank: false, opts: Object.entries(PIPE).map(([k, v]) => [k, v[0]]) },
  { k: 'objetivo', l: 'Objetivo / resumo', t: 'textarea' }, { k: 'observacoes', l: 'Observações', t: 'textarea' }];
}
A.prNova = (d, el, pre) => form({ title: 'Nova prospecção', fields: camposProsp(), values: pre || { situacao: 'avaliacao' },
  after: pre && pre.texto_origem ? '<div class="small muted mt">Campos pré-preenchidos a partir do texto — revise antes de salvar.</div>' : '',
  okLabel: 'Salvar e avaliar na matriz',
  onSave: async x => { const p = await Data.insert('prospeccoes', { ...x, texto_origem: pre && pre.texto_origem || null, arquivo_origem: pre && pre.arquivo_origem || null }); UI.subTexto = ''; UI.subArquivo = ''; setTimeout(() => abrirMatriz(p), 50); }, okMsg: false });
A.prEditar = d => { const p = byId('prospeccoes', d.id); const gere = Perm.gereProspeccao();
  form({ title: 'Prospecção — ' + p.nome, fields: camposProsp().map(f => ({ ...f, ro: !gere })), values: p, onSave: gere ? x => Data.update('prospeccoes', p.id, x) : null,
    onDelete: Perm.dir() ? () => Data.remove('prospeccoes', p.id) : null, deleteConfirm: 'Excluir esta prospecção e todas as suas avaliações?' }); };
A.prPromover = d => {
  const p = byId('prospeccoes', d.id), a = Calc.ultimaAvaliacao(p.id);
  A.projNovo({}, null, { sigla: p.nome.slice(0, 40), nome: p.edital || p.nome, financiador: p.financiador, valor_total: p.valor_estimado || 0, inicio: p.inicio_previsto || hoje(), fim: p.fim_previsto || null, status: 'pendente', situacao: 'vigente', fase: 'Prospecção aprovada', placeholder: true,
    notas: a ? `Origem: prospecção. IA ${Math.round(a.ia)}/100 · IE ${num(a.ie).toFixed(1)} · IP ${num(a.ip).toFixed(1)} — ${a.quadrante ? QUAD[a.quadrante][0] : 'bloqueada'} (avaliada em ${fmtD(String(a.avaliado_em).slice(0, 10))}).` : 'Origem: prospecção (sem avaliação na matriz).', _prospeccao: p.id });
};
function painelSubmissao() {
  return `<div class="card mb"><div class="between"><div><div class="bold">Nova submissão a partir de edital</div><div class="small muted">Cole o texto do edital/proposta (ou carregue um .txt) para pré-preencher a prospecção.</div></div>
    <input type="file" accept=".txt,.md,.csv" id="subFile" style="width:auto;font-size:12px" onchange="lerArquivoSubmissao(this.files[0])"></div>
    ${UI.subArquivo ? `<div class="small muted mt">Arquivo: ${esc(UI.subArquivo)}</div>` : ''}
    <textarea id="subTexto" rows="3" class="mt" placeholder="Cole aqui o texto do edital…" oninput="UI.subTexto=this.value">${esc(UI.subTexto || '')}</textarea>
    <div class="row mt"><button class="btn-p" data-a="prExtrair">Pré-preencher campos</button><button data-a="prLimpar">Limpar</button><span class="small faint">PDF/Word: copie o texto e cole acima.</span></div></div>`;
}
function lerArquivoSubmissao(f) {
  if (!f) return; if (/\.(pdf|docx?|xlsx?)$/i.test(f.name)) { flash('Para PDF/Word, abra o arquivo, copie o texto e cole na caixa.', true); return; }
  const r = new FileReader(); r.onload = () => { UI.subTexto = String(r.result || ''); UI.subArquivo = f.name; render(); flash('Arquivo carregado'); }; r.readAsText(f);
}
function prazoSubmissaoISO(txt) {
  const linhas = normalizeText(txt).split(/\n+/).filter(l => /(prazo|data limite|submiss|encerramento)/i.test(l));
  for (const l of linhas) { const m = l.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; const iso = `${y}-${pad2(+m[2])}-${pad2(+m[1])}`; if (isDate(iso)) return iso; } }
  return null;
}
const ymIni = ym => /^\d{4}-\d{2}$/.test(ym || '') ? ym + '-01' : null;
const ymFim = ym => /^\d{4}-\d{2}$/.test(ym || '') ? lastDayOfMonth(+ym.slice(0, 4), +ym.slice(5, 7)) : null;
A.prExtrair = () => {
  const txt = UI.subTexto || ''; if (!txt.trim()) { flash('Cole um texto antes', true); return; }
  const s = extractSubmissionFromText(txt);
  const l1 = (txt.split(/\n/).map(x => x.trim()).find(x => x.length >= 8) || '');
  A.prNova({}, null, { nome: (l1.length <= 120 ? l1 : (s.title || s.name || '')).slice(0, 120), financiador: s.funder, edital: s.title, valor_estimado: s.value || null, prazo_submissao: prazoSubmissaoISO(txt) || ymIni(s.deadline), inicio_previsto: ymIni(s.start), fim_previsto: ymFim(s.end), objetivo: s.objective, observacoes: s.notes, situacao: 'avaliacao', texto_origem: txt, arquivo_origem: UI.subArquivo || null });
};
A.prLimpar = () => { UI.subTexto = ''; UI.subArquivo = ''; render(); };
A.projTexto = () => {
  openModal(`<h3>Importar projeto de texto</h3><div class="small muted mb">Cole o texto de contrato, plano de trabalho ou planilha. A extração é local e aproximada; você revisa antes de salvar.</div>
    <textarea id="pt_txt" rows="10"></textarea><div class="mactions"><button id="pt_c">Cancelar</button><button class="btn-p" id="pt_ok">Extrair e revisar</button></div>`);
  document.getElementById('pt_c').onclick = closeModal;
  document.getElementById('pt_ok').onclick = () => {
    const r = extractProjectFromText(document.getElementById('pt_txt').value);
    closeModal();
    A.projNovo({}, null, { sigla: r.name, nome: r.fullName, financiador: r.funder, fundacao_apoio: r.supportFoundation, valor_total: r.value, inicio: ymIni(r.start), fim: ymFim(r.end), status: { green: 'em_dia', yellow: 'atencao', red: 'critico', gray: 'pendente' }[r.status] || 'pendente', situacao: 'vigente', fase: r.phase, notas: r.notes, placeholder: true });
  };
};
function graficoProsp(list) {
  const W = 820, H = 380, m = { l: 56, r: 20, t: 20, b: 44 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const x = ie => m.l + ((ie - 1) / 4) * pw, y = ia => m.t + (1 - (ia - 20) / 80) * ph, xT = x(3), yT = y(65);
  const pts = list.map(p => [p, Calc.ultimaAvaliacao(p.id)]).filter(([p, a]) => a && !a.bloqueada);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:'Segoe UI',sans-serif">
    <rect x="${m.l}" y="${m.t}" width="${xT - m.l}" height="${yT - m.t}" fill="#eaf3de" opacity=".6"/><rect x="${xT}" y="${m.t}" width="${m.l + pw - xT}" height="${yT - m.t}" fill="#e6f1fb" opacity=".6"/>
    <rect x="${m.l}" y="${yT}" width="${xT - m.l}" height="${m.t + ph - yT}" fill="#faeeda" opacity=".6"/><rect x="${xT}" y="${yT}" width="${m.l + pw - xT}" height="${m.t + ph - yT}" fill="#fcebeb" opacity=".6"/>
    <text x="${(m.l + xT) / 2}" y="${m.t + 16}" fill="#27500a" font-size="10.5" text-anchor="middle">PRIORIDADE MÁXIMA</text><text x="${(xT + m.l + pw) / 2}" y="${m.t + 16}" fill="#0c447c" font-size="10.5" text-anchor="middle">ESTRATÉGICO · POUCOS</text>
    <text x="${(m.l + xT) / 2}" y="${m.t + ph - 8}" fill="#854f0b" font-size="10.5" text-anchor="middle">SÓ SE FÁCIL E ÚTIL</text><text x="${(xT + m.l + pw) / 2}" y="${m.t + ph - 8}" fill="#a32d2d" font-size="10.5" text-anchor="middle">RECUSAR</text>
    <line x1="${m.l}" y1="${m.t + ph}" x2="${m.l + pw}" y2="${m.t + ph}" stroke="#c8c6c0"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + ph}" stroke="#c8c6c0"/>
    ${[1, 2, 3, 4, 5].map(v => `<text x="${x(v)}" y="${m.t + ph + 16}" fill="#9a9893" font-size="10" text-anchor="middle">${v}</text>`).join('')}
    ${[20, 50, 65, 80, 100].map(v => `<text x="${m.l - 8}" y="${y(v) + 4}" fill="#9a9893" font-size="10" text-anchor="end">${v}</text>`).join('')}
    <text x="${m.l + pw / 2}" y="${H - 6}" fill="#7a7975" font-size="11" text-anchor="middle">ESFORÇO DE EXECUÇÃO →</text>
    <text transform="translate(14 ${m.t + ph / 2}) rotate(-90)" fill="#7a7975" font-size="11" text-anchor="middle">ATRATIVIDADE →</text>
    ${pts.map(([p, a]) => `<g><circle cx="${x(num(a.ie))}" cy="${y(num(a.ia))}" r="6" fill="${(QUAD[a.quadrante] || QUAD.easy)[2]}" stroke="#fff" stroke-width="2"><title>${esc(p.nome)} — IA ${Math.round(a.ia)}, IE ${num(a.ie).toFixed(1)}</title></circle><text x="${x(num(a.ie)) + (num(a.ie) > 4 ? -9 : 9)}" y="${y(num(a.ia)) + 4}" fill="#5f5e5a" font-size="11" text-anchor="${num(a.ie) > 4 ? 'end' : 'start'}">${esc(p.nome.length > 28 ? p.nome.slice(0, 27) + '…' : p.nome)}</text></g>`).join('')}
    ${pts.length ? '' : `<text x="${m.l + pw / 2}" y="${m.t + ph / 2}" fill="#aaa" font-size="12.5" text-anchor="middle">avalie prospecções para vê-las aqui</text>`}</svg>`;
}

/* ════════════════════════════════════════════════════════════════════
   INFRAESTRUTURA
   ════════════════════════════════════════════════════════════════════ */
VIEWS.infra = () => {
  const sub = UI.sub.infra || 'itens';
  const al = Calc.alertasInfra();
  return `<div class="toolbar"><div class="subtabs" style="margin:0">${[['itens', 'Itens'], ['agenda', 'Agenda de uso'], ['manut', 'Manutenções'], ['hab', 'Habilitações'], ['uso', 'Horas por projeto']].map(([k, l]) => `<button class="chip${sub === k ? ' on' : ''}" data-a="sub" data-g="infra" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="row">${Perm.podeEditar() ? `<button data-a="manDefeito">⚠ Reportar defeito</button><button data-a="resNova">+ Reservar</button>` : ''}${Perm.gereInfraGeral() ? `<button class="btn-p" data-a="itemNovo">+ Item</button>` : ''}</div></div>
  ${al.length && sub === 'itens' ? `<div class="card mb">${al.map(a => `<div class="alert ${a.grave ? 'bad' : 'warn'}">${esc(a.txt)}</div>`).join('')}</div>` : ''}
  ${{ itens: infraItens, agenda: infraAgenda, manut: infraManut, hab: infraHab, uso: infraUso }[sub]()}`;
};
function arvoreItens() {
  const out = [], vis = new Set();
  const add = (it, nivel) => { if (vis.has(it.id)) return; vis.add(it.id); out.push([it, nivel]); D.infra_itens.filter(c => c.pai_id === it.id).sort(byName('nome')).forEach(c => add(c, nivel + 1)); };
  D.infra_itens.filter(i => !i.pai_id || !byId('infra_itens', i.pai_id)).sort(byName('nome')).forEach(i => add(i, 0));
  D.infra_itens.forEach(i => add(i, 0));
  return out;
}
function proximaManut(itemId) {
  const ms = D.infra_manutencoes.filter(m => m.item_id === itemId && m.status !== 'cancelada');
  const datas = ms.map(m => m.status === 'concluida' ? m.proxima_em : m.data_prevista).filter(Boolean).sort();
  return datas.find(d => d >= addDays(hoje(), -365)) || null;
}
function infraItens() {
  const inat = !!UI.f.itInat;
  const rows = arvoreItens().filter(([i]) => inat || i.status !== 'desativado');
  if (!D.infra_itens.length) return `<div class="empty">Nenhum item cadastrado. ${Perm.gereInfraGeral() ? 'Comece pelas salas/células e depois cadastre os equipamentos dentro delas.' : ''}</div>`;
  return `<div class="row small mb"><label class="row"><input type="checkbox" data-f="itInat" ${inat ? 'checked' : ''}> mostrar desativados</label></div>
  <div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Item</th><th>Código</th><th>Categoria</th><th>Local</th><th>Responsável</th><th>Situação</th><th>Reservas</th><th>Próx. manutenção</th></tr>
  ${rows.map(([i, n]) => { const pm = proximaManut(i.id);
    return `<tr class="click" data-a="itemAbrir" data-id="${i.id}"><td style="padding-left:${8 + n * 20}px">${n ? '<span class="faint">└ </span>' : ''}<b>${esc(i.nome)}</b></td><td class="small">${esc(i.codigo || '')}</td><td class="small">${esc(lbl(CAT_INFRA, i.categoria))}</td>
      <td class="small">${esc(i.localizacao || '')}</td><td class="small">${esc(i.responsavel_id ? nomePessoa(i.responsavel_id) : '—')}</td><td>${badgeOf(ST_INFRA, i.status)}</td>
      <td class="small">${i.reservavel ? 'sim' : '<span class="faint">não</span>'}${i.requer_habilitacao ? ' · 🔒 habilitação' : ''}</td><td class="small" style="${pm && pm < hoje() ? 'color:var(--red);font-weight:600' : ''}">${fmtD(pm)}</td></tr>`; }).join('')}</table></div>`;
}
function camposItem(it) {
  const excl = new Set(); if (it) { const mark = id => { excl.add(id); D.infra_itens.filter(c => c.pai_id === id).forEach(c => mark(c.id)); }; mark(it.id); }
  return [{ k: 'nome', l: 'Nome', req: true }, { k: 'codigo', l: 'Código interno (ex.: CT-03)' },
  { k: 'categoria', l: 'Categoria', t: 'select', blank: false, opts: CAT_INFRA },
  { k: 'pai_id', l: 'Fica dentro de', t: 'select', blank: '— (item principal) —', opts: D.infra_itens.filter(i => !excl.has(i.id)).sort(byName('nome')).map(i => [i.id, i.nome]) },
  { k: 'localizacao', l: 'Localização' }, { k: 'responsavel_id', l: 'Responsável', t: 'select', opts: optPessoas() },
  { k: 'status', l: 'Situação', t: 'select', blank: false, opts: Object.entries(ST_INFRA).map(([k, v]) => [k, v[0]]) },
  { k: 'fabricante', l: 'Fabricante' }, { k: 'modelo', l: 'Modelo' }, { k: 'numero_serie', l: 'Nº de série' }, { k: 'patrimonio', l: 'Patrimônio UFSM' },
  { k: 'projeto_aquisicao_id', l: 'Adquirido pelo projeto', t: 'select', opts: optProjetos() },
  { k: 'reservavel', l: 'Entra na agenda de reservas', t: 'check' }, { k: 'requer_habilitacao', l: 'Exige operador habilitado', t: 'check' },
  { k: 'obs', l: 'Observações / especificações', t: 'textarea' }];
}
A.itemNovo = () => form({ title: 'Novo item de infraestrutura', fields: camposItem(null), values: { categoria: 'equipamento', status: 'operacional', reservavel: true }, onSave: x => Data.insert('infra_itens', x) });
A.itemEditar = d => { const i = byId('infra_itens', d.id); form({ title: 'Editar — ' + i.nome, fields: camposItem(i), values: i, onSave: x => Data.update('infra_itens', i.id, x),
  onDelete: Perm.gereInfraGeral() ? () => Data.remove('infra_itens', i.id) : null, deleteConfirm: `Excluir ${i.nome}?\nReservas, manutenções e habilitações dele serão apagadas. Para tirar de uso mantendo o histórico, mude a situação para "Desativado".` }); };
A.itemAbrir = d => {
  const i = byId('infra_itens', d.id), gere = Perm.gereInfra(i.id);
  const habs = D.infra_habilitacoes.filter(h => h.item_id === i.id);
  const mans = D.infra_manutencoes.filter(m => m.item_id === i.id).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  const res = D.infra_reservas.filter(r => r.item_id === i.id && r.status !== 'cancelada' && r.fim >= new Date().toISOString()).sort(byName('inicio'));
  const filhos = D.infra_itens.filter(c => c.pai_id === i.id);
  mostrar(i.nome, `<div class="row mb">${badgeOf(ST_INFRA, i.status)}<span class="small muted">${esc(lbl(CAT_INFRA, i.categoria))}${i.codigo ? ' · ' + esc(i.codigo) : ''}</span>
      <span style="margin-left:auto" class="row">${gere ? `<button class="btn-s" data-a="itemEditar" data-id="${i.id}">✎ Editar</button><button class="btn-s" data-a="manNova" data-item="${i.id}">+ Manutenção</button><button class="btn-s" data-a="habNova" data-item="${i.id}">+ Habilitação</button>` : ''}
      ${i.reservavel && Perm.podeEditar() ? `<button class="btn-s" data-a="resNova" data-item="${i.id}">Reservar</button>` : ''}</span></div>
    <div class="kv mb"><span class="k">Dentro de</span><span>${esc(i.pai_id ? (byId('infra_itens', i.pai_id) || {}).nome : '—')}</span>
      ${filhos.length ? `<span class="k">Contém</span><span>${filhos.map(f => esc(f.nome)).join(', ')}</span>` : ''}
      <span class="k">Localização</span><span>${esc(i.localizacao || '—')}</span><span class="k">Responsável</span><span>${esc(i.responsavel_id ? nomePessoa(i.responsavel_id) : '—')}</span>
      <span class="k">Fabricante / modelo</span><span>${esc([i.fabricante, i.modelo].filter(Boolean).join(' · ') || '—')}</span><span class="k">Série / patrimônio</span><span>${esc([i.numero_serie, i.patrimonio].filter(Boolean).join(' · ') || '—')}</span>
      <span class="k">Adquirido por</span><span>${esc(i.projeto_aquisicao_id ? siglaProjeto(i.projeto_aquisicao_id) : '—')}</span>
      <span class="k">Reservas</span><span>${i.reservavel ? 'aberto à agenda' : 'não reservável'}${i.requer_habilitacao ? ' · exige operador habilitado' : ''}</span></div>
    ${i.obs ? `<div class="note mb">${esc(i.obs)}</div>` : ''}
    <div class="sec">Operadores habilitados (${habs.length})</div>${habs.length ? habs.map(h => `<div class="between small mb"><span>${esc(nomePessoa(h.pessoa_id))} · ${esc(lbl(NIVEL_HAB, h.nivel))} · desde ${fmtD(h.desde)}${h.validade ? ' até ' + fmtD(h.validade) : ''}${h.validade && h.validade < hoje() ? ' ' + badge('vencida', 'b-red') : ''}</span>${gere ? `<button class="btn-s" data-a="habEditar" data-id="${h.id}">✎</button>` : ''}</div>`).join('') : '<div class="small faint">Ninguém habilitado.</div>'}
    <div class="sec">Próximas reservas</div>${res.length ? res.slice(0, 10).map(r => `<div class="small mb">${fmtDT(r.inicio)} → ${fmtDT(r.fim)} · ${esc(r.projeto_id ? siglaProjeto(r.projeto_id) : 'sem projeto')} · ${esc(nomePessoa(r.responsavel_id))} ${badgeOf(ST_RES, r.status)}</div>`).join('') : '<div class="small faint">Nenhuma.</div>'}
    <div class="sec">Manutenções (${mans.length})</div>${mans.length ? mans.slice(0, 12).map(m => `<div class="between small mb"><span>${badgeOf(ST_MAN, m.status)} <b>${esc(lbl(TIPO_MAN, m.tipo))}</b> — ${esc(m.titulo)} · ${fmtD(m.data_conclusao || m.data_inicio || m.data_prevista)}${m.proxima_em ? ' · próxima ' + fmtD(m.proxima_em) : ''}${m.custo ? ' · ' + fmtBRL2(m.custo) : ''}</span>${gere ? `<button class="btn-s" data-a="manEditar" data-id="${m.id}">✎</button>` : ''}</div>`).join('') : '<div class="small faint">Nenhuma.</div>'}`, true);
};
/* agenda */
function segunda(iso) { const d = toDate(iso); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return isoOf(d); }
A.semana = d => { UI.semana = d.v === 'hoje' ? segunda(hoje()) : addDays(UI.semana || segunda(hoje()), +d.v); render(); };
function infraAgenda() {
  const ini = UI.semana || segunda(hoje()); const dias = [...Array(7)].map((_, i) => addDays(ini, i));
  const itens = D.infra_itens.filter(i => i.reservavel && i.status !== 'desativado').sort(byName('nome'));
  const DS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const pend = D.infra_reservas.filter(r => r.status === 'solicitada' && Perm.gereInfra(r.item_id)).sort(byName('inicio'));
  const cel = (it, dia) => D.infra_reservas.filter(r => r.item_id === it.id && r.status !== 'cancelada' && isoOf(new Date(r.inicio)) <= dia && isoOf(new Date(r.fim)) >= dia).sort(byName('inicio'))
    .map(r => { const cls = r.status === 'solicitada' ? 'sol' : r.status === 'realizada' ? 'real' : 'conf'; const hi = new Date(r.inicio), hf = new Date(r.fim);
      return `<span class="rv ${cls}" data-a="resEditar" data-id="${r.id}" title="${esc(`${ST_RES[r.status][0]} · ${r.projeto_id ? siglaProjeto(r.projeto_id) : ''} · ${nomePessoa(r.responsavel_id)} · ${r.finalidade || ''}`)}">${pad2(hi.getHours())}:${pad2(hi.getMinutes())}–${pad2(hf.getHours())}:${pad2(hf.getMinutes())} ${esc(r.projeto_id ? siglaProjeto(r.projeto_id) : '')}</span>`; }).join('');
  return `${pend.length ? `<div class="card mb"><div class="bold mb">Solicitações aguardando confirmação (${pend.length})</div>${pend.map(r => `<div class="between small mb"><span>${fmtDT(r.inicio)} → ${fmtDT(r.fim)} · <b>${esc((byId('infra_itens', r.item_id) || {}).nome)}</b> · ${esc(r.projeto_id ? siglaProjeto(r.projeto_id) : 'sem projeto')} · operador ${esc(nomePessoa(r.responsavel_id))}${r.finalidade ? ' · ' + esc(r.finalidade) : ''}</span>
      <span class="row"><button class="btn-s btn-p" data-a="resStatus" data-id="${r.id}" data-v="confirmada">Confirmar</button><button class="btn-s" data-a="resStatus" data-id="${r.id}" data-v="cancelada">Recusar</button></span></div>`).join('')}</div>` : ''}
  <div class="toolbar"><div class="row"><button class="btn-s" data-a="semana" data-v="-7">◀</button><button class="btn-s" data-a="semana" data-v="hoje">Esta semana</button><button class="btn-s" data-a="semana" data-v="7">▶</button>
    <b class="small">${fmtD(dias[0])} a ${fmtD(dias[6])}</b></div><div class="row small"><span class="rv sol">solicitada</span><span class="rv conf">confirmada</span><span class="rv real">realizada</span></div></div>
  ${itens.length ? `<div class="tw"><div class="week" style="grid-template-columns:170px repeat(7,minmax(96px,1fr));min-width:860px">
    <div class="wh"></div>${dias.map((d, i) => `<div class="wh" style="${d === hoje() ? 'color:var(--red)' : ''}">${DS[i]} ${d.slice(8)}/${d.slice(5, 7)}</div>`).join('')}
    ${itens.map(it => `<div class="wi">${esc(it.nome)}${it.status !== 'operacional' ? '<br>' + badgeOf(ST_INFRA, it.status) : ''}</div>${dias.map(d => `<div>${cel(it, d)}</div>`).join('')}`).join('')}</div></div>` : '<div class="empty">Nenhum item reservável cadastrado.</div>'}`;
}
function camposReserva(r) {
  const gestorDe = id => Perm.gereInfra(id);
  const podeGerir = r ? gestorDe(r.item_id) : Perm.gereInfraGeral();
  return [{ k: 'item_id', l: 'Item', t: 'select', req: true, opts: D.infra_itens.filter(i => i.reservavel && i.status !== 'desativado').sort(byName('nome')).map(i => [i.id, i.nome + (i.requer_habilitacao ? ' 🔒' : '')]), ro: !!r },
  { k: 'projeto_id', l: 'Projeto', t: 'select', opts: optProjetos(true), blank: '— sem projeto —' },
  { k: 'inicio', l: 'Início', t: 'datetime', req: true }, { k: 'fim', l: 'Fim', t: 'datetime', req: true },
  { k: 'responsavel_id', l: 'Operador responsável pelo uso', t: 'select', req: true, opts: optPessoas(), help: 'Em itens 🔒 precisa ter habilitação válida' },
  { k: 'status', l: 'Status', t: 'select', blank: false, opts: Object.entries(ST_RES).filter(([k]) => podeGerir || ['solicitada', 'cancelada'].includes(k)).map(([k, v]) => [k, v[0]]) },
  { k: 'horas_uso', l: 'Horas efetivas de uso (ao realizar)', t: 'number', min: 0, step: 0.5 },
  { k: 'finalidade', l: 'Finalidade', full: true }, { k: 'obs', l: 'Observações', t: 'textarea', rows: 2 }];
}
A.resNova = d => {
  const base = new Date(); base.setDate(base.getDate() + 1); base.setHours(8, 0, 0, 0); const fim = new Date(base); fim.setHours(17);
  form({ title: 'Reservar infraestrutura', fields: camposReserva(null), values: { item_id: d.item || null, inicio: base.toISOString(), fim: fim.toISOString(), responsavel_id: ME.pessoa_id, status: Perm.gereInfraGeral() ? 'confirmada' : 'solicitada' },
    onSave: x => Data.insert('infra_reservas', { ...x, solicitante_id: ME.pessoa_id || null }), okMsg: '✓ Reserva registrada' });
};
A.resEditar = d => { const r = byId('infra_reservas', d.id); const pode = Perm.gereInfra(r.item_id) || (Perm.podeEditar() && r.criado_por === ME.uid && r.status === 'solicitada');
  form({ title: 'Reserva — ' + (byId('infra_itens', r.item_id) || {}).nome, fields: camposReserva(r).map(f => ({ ...f, ro: f.ro || !pode })), values: r,
    intro: `<div class="small muted mb">Solicitada por ${esc(nomePessoa(r.solicitante_id))} em ${fmtDT(r.criado_em)}</div>`,
    onSave: pode ? x => { delete x.item_id; return Data.update('infra_reservas', r.id, x); } : null,
    onDelete: Perm.gereInfra(r.item_id) ? () => Data.remove('infra_reservas', r.id) : null }); };
A.resStatus = async d => { await Data.update('infra_reservas', d.id, { status: d.v }); render(); flash(d.v === 'confirmada' ? '✓ Reserva confirmada' : 'Reserva recusada'); };
/* manutenções */
function camposManut(m, itemId) {
  const gere = m ? Perm.gereInfra(m.item_id) : (itemId ? Perm.gereInfra(itemId) : Perm.gereInfraGeral());
  return [{ k: 'item_id', l: 'Item', t: 'select', req: true, opts: D.infra_itens.sort(byName('nome')).map(i => [i.id, i.nome]), ro: !!m },
  { k: 'tipo', l: 'Tipo', t: 'select', blank: false, opts: gere ? TIPO_MAN : TIPO_MAN.filter(t => t[0] === 'corretiva') },
  { k: 'titulo', l: 'Título', req: true, full: true },
  { k: 'status', l: 'Status', t: 'select', blank: false, opts: Object.entries(ST_MAN).map(([k, v]) => [k, v[0]]), ro: !gere },
  { k: 'data_prevista', l: 'Data prevista', t: 'date', hide: !gere }, { k: 'data_inicio', l: 'Início', t: 'date', hide: !gere }, { k: 'data_conclusao', l: 'Conclusão', t: 'date', hide: !gere },
  { k: 'proxima_em', l: 'Próxima em (preventiva / validade da calibração)', t: 'date', hide: !gere },
  { k: 'executor', l: 'Executor (empresa ou pessoa)', hide: !gere }, { k: 'responsavel_id', l: 'Responsável interno', t: 'select', opts: optPessoas(), hide: !gere },
  { k: 'custo', l: 'Custo (R$)', t: 'money', min: 0, hide: !gere }, { k: 'projeto_id', l: 'Pago pelo projeto', t: 'select', opts: optProjetos(), hide: !gere },
  { k: 'documento', l: 'Documento (OS, certificado, NF)', hide: !gere }, { k: 'descricao', l: 'Descrição', t: 'textarea' }];
}
A.manNova = d => form({ title: 'Nova manutenção', fields: camposManut(null, d.item), values: { item_id: d.item || null, tipo: 'preventiva', status: 'planejada' }, onSave: x => Data.insert('infra_manutencoes', { ...x, status: x.status || 'planejada' }) });
A.manDefeito = () => form({ title: 'Reportar defeito', intro: '<div class="small muted mb">Registra uma manutenção corretiva para a Gerência de Infraestrutura avaliar.</div>',
  fields: [{ k: 'item_id', l: 'Item', t: 'select', req: true, opts: D.infra_itens.sort(byName('nome')).map(i => [i.id, i.nome]) }, { k: 'titulo', l: 'O que aconteceu?', req: true }, { k: 'descricao', l: 'Detalhes', t: 'textarea' }],
  onSave: x => Data.insert('infra_manutencoes', { ...x, tipo: 'corretiva', status: 'planejada' }), okMsg: '✓ Defeito reportado' });
A.manEditar = d => { const m = byId('infra_manutencoes', d.id); const gere = Perm.gereInfra(m.item_id);
  form({ title: 'Manutenção — ' + (byId('infra_itens', m.item_id) || {}).nome, fields: camposManut(m).map(f => ({ ...f, ro: f.ro || !gere })), values: m,
    onSave: gere ? x => { delete x.item_id; return Data.update('infra_manutencoes', m.id, x); } : null, onDelete: gere ? () => Data.remove('infra_manutencoes', m.id) : null }); };
function infraManut() {
  const fs = UI.f.manSt || 'abertas';
  const list = D.infra_manutencoes.filter(m => fs === 'todas' || (fs === 'abertas' ? ['planejada', 'em_andamento'].includes(m.status) : m.status === fs))
    .sort((a, b) => String(a.data_prevista || a.criado_em).localeCompare(String(b.data_prevista || b.criado_em)));
  return `<div class="toolbar"><select data-f="manSt" style="width:auto">${[['abertas', 'Abertas'], ['concluida', 'Concluídas'], ['todas', 'Todas']].map(([v, l]) => `<option value="${v}"${fs === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${Perm.gereInfraGeral() ? `<button class="btn-p" data-a="manNova">+ Manutenção</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${list.length ? `<table class="t"><tr><th>Item</th><th>Tipo</th><th>Título</th><th>Status</th><th>Prevista</th><th>Concluída</th><th>Próxima</th><th class="num">Custo</th><th>Projeto</th></tr>
  ${list.map(m => `<tr class="click" data-a="manEditar" data-id="${m.id}"><td><b>${esc((byId('infra_itens', m.item_id) || {}).nome || '')}</b></td><td class="small">${esc(lbl(TIPO_MAN, m.tipo))}</td><td>${esc(m.titulo)}</td><td>${badgeOf(ST_MAN, m.status)}</td>
    <td class="small" style="${m.status === 'planejada' && m.data_prevista && m.data_prevista < hoje() ? 'color:var(--red);font-weight:600' : ''}">${fmtD(m.data_prevista)}</td><td class="small">${fmtD(m.data_conclusao)}</td><td class="small">${fmtD(m.proxima_em)}</td><td class="num small">${m.custo ? fmtBRL2(m.custo) : ''}</td><td class="small">${esc(m.projeto_id ? siglaProjeto(m.projeto_id) : '')}</td></tr>`).join('')}</table>` : '<div class="empty">Nenhuma manutenção.</div>'}</div>`;
}
/* habilitações */
function camposHab(h, itemId) {
  return [{ k: 'item_id', l: 'Item', t: 'select', req: true, opts: D.infra_itens.sort(byName('nome')).map(i => [i.id, i.nome + (i.requer_habilitacao ? ' 🔒' : '')]), ro: !!h },
  { k: 'pessoa_id', l: 'Pessoa', t: 'select', req: true, opts: optPessoas(), ro: !!h },
  { k: 'nivel', l: 'Nível', t: 'select', blank: false, opts: NIVEL_HAB }, { k: 'desde', l: 'Desde', t: 'date', req: true }, { k: 'validade', l: 'Validade (vazio = sem vencimento)', t: 'date' },
  { k: 'obs', l: 'Treinamento / certificado', t: 'textarea', rows: 2 }];
}
A.habNova = d => form({ title: 'Nova habilitação', fields: camposHab(null), values: { item_id: d.item || null, nivel: 'operador', desde: hoje() }, onSave: x => Data.insert('infra_habilitacoes', x) });
A.habEditar = d => { const h = byId('infra_habilitacoes', d.id); form({ title: 'Habilitação — ' + nomePessoa(h.pessoa_id), fields: camposHab(h), values: h,
  onSave: x => { delete x.item_id; delete x.pessoa_id; return Data.update('infra_habilitacoes', h.id, x); }, onDelete: () => Data.remove('infra_habilitacoes', h.id) }); };
function infraHab() {
  const list = D.infra_habilitacoes.slice().sort((a, b) => ((byId('infra_itens', a.item_id) || {}).nome || '').localeCompare((byId('infra_itens', b.item_id) || {}).nome || '') || nomePessoa(a.pessoa_id).localeCompare(nomePessoa(b.pessoa_id)));
  return `<div class="toolbar"><span class="small muted">Itens marcados com 🔒 só podem ser reservados com operador habilitado.</span>${Perm.gereInfraGeral() ? `<button class="btn-p" data-a="habNova">+ Habilitação</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${list.length ? `<table class="t"><tr><th>Item</th><th>Pessoa</th><th>Nível</th><th>Desde</th><th>Validade</th><th>Obs.</th></tr>${list.map(h => { const it = byId('infra_itens', h.item_id) || {}; const pode = Perm.gereInfra(h.item_id);
    return `<tr class="${pode ? 'click' : ''}" ${pode ? `data-a="habEditar" data-id="${h.id}"` : ''}><td><b>${esc(it.nome)}</b>${it.requer_habilitacao ? ' 🔒' : ''}</td><td>${esc(nomePessoa(h.pessoa_id))}</td><td class="small">${esc(lbl(NIVEL_HAB, h.nivel))}</td><td class="small">${fmtD(h.desde)}</td>
      <td class="small">${h.validade ? fmtD(h.validade) + (h.validade < hoje() ? ' ' + badge('vencida', 'b-red') : h.validade <= addDays(hoje(), 30) ? ' ' + badge('vence logo', 'b-yellow') : '') : 'sem vencimento'}</td><td class="small">${esc(h.obs || '')}</td></tr>`; }).join('')}</table>` : '<div class="empty">Nenhuma habilitação registrada.</div>'}</div>`;
}
function infraUso() {
  const acc = {};
  D.infra_reservas.filter(r => r.status === 'realizada').forEach(r => {
    const k = [r.item_id, r.projeto_id || '', String(r.inicio).slice(0, 7)].join('|');
    acc[k] = acc[k] || { item: r.item_id, proj: r.projeto_id, mes: String(r.inicio).slice(0, 7), n: 0, h: 0 }; acc[k].n++; acc[k].h += Calc.horasReserva(r);
  });
  const rows = Object.values(acc).sort((a, b) => b.mes.localeCompare(a.mes));
  return `<div class="small muted mb">Soma das reservas marcadas como realizadas (horas efetivas, quando informadas). Útil para relatórios e prestação de contas.</div>
  <div class="card tw" style="padding:4px 8px">${rows.length ? `<table class="t"><tr><th>Mês</th><th>Item</th><th>Projeto</th><th class="num">Reservas</th><th class="num">Horas</th></tr>${rows.map(r => `<tr><td>${fmtMes(r.mes + '-01')}</td><td>${esc((byId('infra_itens', r.item) || {}).nome || '')}</td><td>${esc(r.proj ? siglaProjeto(r.proj) : 'sem projeto')}</td><td class="num">${r.n}</td><td class="num">${r.h.toFixed(1)}</td></tr>`).join('')}</table>` : '<div class="empty">Nenhuma reserva realizada ainda.</div>'}</div>`;
}

/* ── Plano de aplicação: itens previstos por rubrica × execução ──────── */
/* bolsas/pessoal previstos nas posições da equipe do plano — valores só aqui (Financeiro) */
function bolsasPlanoRubrica(p, cod, pode) {
  const vagas = D.equipe_plano.filter(e => e.projeto_id === p.id).sort((a, b) => num(a.ordem) - num(b.ordem));
  const com = vagas.map(e => ({ e, b: D.equipe_plano_bolsas.find(q => q.vaga_id === e.id) })).filter(x => x.b && x.b.rubrica === cod);
  const sem = cod === '1.1.1' && pode ? vagas.filter(e => !D.equipe_plano_bolsas.some(q => q.vaga_id === e.id) && !['encerrada', 'cancelada'].includes(e.status)) : [];
  if (!com.length && !sem.length) return '';
  const tot = com.reduce((s, x) => s + num(x.b.valor_mensal) * num(x.b.meses), 0);
  return `<tr><td></td><td colspan="${pode ? 8 : 7}" class="small"><div class="muted mb">Bolsas/pessoal previstos nas posições da <button class="link" data-a="projAbrir" data-id="${p.id}" data-aba="equipe">equipe do plano de trabalho</button>${com.length ? `: <b>${fmtBRL2(tot)}</b>` : ''}</div>
    ${com.map(({ e, b }) => `<div class="row mb ${pode ? 'click' : ''}" ${pode ? `data-a="bolsaPlanoEditar" data-id="${e.id}"` : ''} style="gap:10px"><span style="min-width:220px"><b>${esc(e.nome_plano)}</b>${e.pessoa_id ? ` <span class="muted">· ${esc(nomePessoa(e.pessoa_id))}</span>` : ''}</span><span class="muted">${esc(b.modalidade || 'bolsa')}</span><span>${fmtBRL2(b.valor_mensal)}/mês × ${b.meses} = <b>${fmtBRL2(num(b.valor_mensal) * num(b.meses))}</b></span></div>`).join('')}
    ${sem.length ? `<div class="muted">Posições sem bolsa prevista: ${sem.map(e => `<button class="link" data-a="bolsaPlanoEditar" data-id="${e.id}">${esc(e.nome_plano)} +</button>`).join(' · ')}</div>` : ''}</td></tr>`;
}
A.bolsaPlanoEditar = d => {
  const e = byId('equipe_plano', d.id), b = D.equipe_plano_bolsas.find(q => q.vaga_id === e.id), pid = e.projeto_id;
  const folhas = D.rubricas.filter(r => r.codigo.startsWith('1.1') && !D.rubricas.some(x => x.pai === r.codigo)).sort(by('ordem'));
  form({ title: 'Bolsa prevista — ' + e.nome_plano, fields: [
      { k: 'modalidade', l: 'Modalidade', ph: 'ex.: Mestrado (BM), Coord. geral (COG)' },
      { k: 'valor_mensal', l: 'Valor mensal (R$)', t: 'money', min: 0, req: true },
      { k: 'meses', l: 'Duração (meses)', t: 'number', min: 1, max: 120, req: true },
      { k: 'rubrica', l: 'Rubrica', t: 'select', blank: false, opts: folhas.map(r => [r.codigo, r.codigo + ' ' + r.nome]) }],
    values: b || { rubrica: '1.1.1', meses: 12 },
    onSave: x => b ? Data.update('equipe_plano_bolsas', b.id, x) : Data.insert('equipe_plano_bolsas', { ...x, vaga_id: e.id, projeto_id: pid }),
    onDelete: b ? () => Data.remove('equipe_plano_bolsas', b.id) : null, deleteLabel: 'Retirar a bolsa prevista', deleteConfirm: 'Retirar a bolsa prevista desta posição?' });
};
function finPlano(p) {
  const { grupos, tot } = Calc.planoAplicacao(p), pode = Perm.editaFin(p.id), fs = UI.f.paSt || 'todos';
  const eqB = Calc.equipePlano(p).tot.porRubrica;
  const passa = x => fs === 'todos' || (fs === 'pendentes' ? ['previsto', 'em_aquisicao'].includes(x.i.status) : x.i.status === fs);
  const moeda = i => i.moeda && i.moeda !== 'BRL' ? `${esc(i.moeda)} ${fmtNum2(i.valor_unitario)} × câmbio ${String(i.cambio ?? '?').replace('.', ',')}` : fmtBRL2(i.valor_unitario);
  const blocos = grupos.filter(g => g.itens.length || g.aprovado || g.executado || eqB[g.r.codigo] || (pode && g.r.codigo === '1.1.1' && D.equipe_plano.some(e => e.projeto_id === p.id))).map(g => {
    const its = g.itens.filter(passa);
    const aviso = g.itens.length && Math.abs(g.dif) > 0.5 ? `<span class="small" style="color:var(--yellow-txt)" title="Soma dos itens ≠ aprovado na rubrica">⚠ itens ${g.dif > 0 ? 'acima' : 'abaixo'} do aprovado em ${fmtBRL2(Math.abs(g.dif))}</span>` : '';
    const head = `<tr class="grp"><td class="cod">${esc(g.r.codigo)}</td><td colspan="2"><b>${esc(g.r.nome)}</b> <span class="small muted">· ${g.itens.length} item(ns)</span> ${aviso}</td>
      <td class="num" style="white-space:nowrap">${fmtBRL(g.aprovado)}</td><td class="num small muted" style="white-space:nowrap">${g.itens.length ? fmtBRL(g.previstoItens) : ''}</td><td class="num">${g.n ? `<span class="execlink" data-a="despVer" data-projeto="${p.id}" data-rubrica="${g.r.codigo}">${fmtBRL(g.executado)}</span>` : fmtBRL(0)}</td>
      <td class="num" style="color:${g.aprovado - g.executado < -0.005 ? 'var(--red)' : 'inherit'}">${fmtBRL(g.aprovado - g.executado)}</td><td></td>${pode ? `<td>${g.r.codigo.startsWith('1.1') ? '' : `<button class="btn-s" data-a="itemPlanoNovo" data-projeto="${p.id}" data-rubrica="${g.r.codigo}">+ item</button>`}</td>` : ''}</tr>`;
    const bolsas = bolsasPlanoRubrica(p, g.r.codigo, pode);
    const linhas = its.map(x => { const i = x.i, st = ST_ITEM[i.status] || [i.status, 'b-gray'];
      const infra = i.infra_item_id && byId('infra_itens', i.infra_item_id) ? ` <button class="link small" data-a="itemInfraVer" data-id="${i.infra_item_id}" title="Ver na Infraestrutura">🔧 ${esc(byId('infra_itens', i.infra_item_id).codigo || 'infraestrutura')}</button>` : '';
      const podeInfra = pode && Perm.gereInfraGeral() && g.r.codigo.startsWith('2.1') && i.status === 'adquirido' && !i.infra_item_id;
      return `<tr class="${pode ? 'click' : ''}${i.status === 'cancelado' ? ' faint' : ''}" ${pode ? `data-a="itemPlanoEditar" data-id="${i.id}"` : ''}>
        <td class="small muted" style="text-align:right">${i.numero || ''}</td>
        <td><b>${esc(i.descricao)}</b>${i.origem === 'importado' ? ' ' + badge('importado', 'b-blue') : ''}${infra}${i.justificativa ? `<div class="small muted" title="${esc(i.justificativa)}">${esc(i.justificativa.length > 110 ? i.justificativa.slice(0, 108) + '…' : i.justificativa)}</div>` : ''}</td>
        <td class="small" style="white-space:nowrap">${i.quantidade != null ? String(num(i.quantidade)).replace('.', ',') + ' × ' : ''}${i.valor_unitario != null ? moeda(i) : ''}${i.detalhe ? `<div class="muted">${esc(i.detalhe)}</div>` : ''}</td>
        <td></td><td class="num">${fmtBRL(i.valor_previsto)}</td>
        <td class="num">${x.executado ? `<span class="execlink" data-a="despVer" data-projeto="${p.id}" data-item="${i.id}">${fmtBRL(x.executado)}</span>` : '<span class="faint">—</span>'}</td>
        <td class="num" style="color:${x.saldo < -0.005 ? 'var(--red)' : 'inherit'}">${fmtBRL(x.saldo)}</td><td>${badge(st[0], st[1])}</td>
        ${pode ? `<td style="white-space:nowrap">${i.status !== 'cancelado' ? `<button class="btn-s" data-a="despNova" data-projeto="${p.id}" data-item="${i.id}">+ gasto</button>` : ''}${podeInfra ? ` <button class="btn-s" data-a="itemParaInfra" data-id="${i.id}" title="Cadastrar o bem na Infraestrutura">→ infra</button>` : ''}</td>` : ''}</tr>`; }).join('');
    const sem = g.itens.length && g.semItem ? `<tr><td></td><td colspan="4" class="small muted">Gastos lançados na rubrica sem item do plano</td><td class="num small">${fmtBRL(g.semItem)}</td><td colspan="${pode ? 3 : 2}"></td></tr>` : '';
    return head + bolsas + linhas + sem;
  }).join('');
  const orcT = Calc.totaisOrc(p.id);
  const mets = [['Itens previstos', tot.itens], ['Valor dos itens', fmtBRL(tot.previsto)], ['Executado nos itens', fmtBRL(tot.executadoItens)], ['Adquiridos', `${tot.adquiridos} de ${tot.itens}`], ['Em aquisição', tot.emAquisicao]];
  return `<div class="metrics">${mets.map(([k, v]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:17px">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row">${[['todos', 'Todos'], ['pendentes', 'A adquirir'], ['em_aquisicao', 'Em aquisição'], ['adquirido', 'Adquiridos'], ['cancelado', 'Cancelados']].map(([k, l]) => `<button class="chip${fs === k ? ' on' : ''}" data-a="paFiltro" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="row">${pode ? `<button class="btn-s" data-a="importarPlanilha" data-projeto="${p.id}">Importar da planilha do edital…</button><button class="btn-p" data-a="itemPlanoNovo" data-projeto="${p.id}">+ Item</button>` : ''}</div></div>
  ${blocos ? `<div class="card tw" style="padding:4px 8px"><table class="t orc"><tr><th style="width:36px">Nº</th><th>Item</th><th>Quantidade × unitário</th><th class="num">Aprovado</th><th class="num">Previsto</th><th class="num">Executado</th><th class="num">Saldo</th><th>Situação</th>${pode ? '<th></th>' : ''}</tr>${blocos}
    <tr class="total"><td></td><td colspan="2">Total dos itens</td><td class="num" title="Aprovado no projeto (todas as rubricas)">${fmtBRL(orcT.aprovado)}</td><td class="num">${fmtBRL(tot.previsto)}</td><td class="num">${fmtBRL(tot.executadoItens)}</td><td class="num">${fmtBRL(tot.previsto - tot.executadoItens)}</td><td colspan="${pode ? 2 : 1}"></td></tr></table></div>`
    : `<div class="card empty">Nenhum item no plano de aplicação.${pode ? ' Importe a planilha do edital ou cadastre os itens previstos (passagens, diárias, material, serviços, equipamentos).' : ''}</div>`}
  <div class="small muted mt">Os itens detalham o que foi aprovado em cada rubrica. Ao lançar um gasto, escolha o item para acompanhar a execução item a item; o saldo da rubrica continua valendo para o controle do orçamento.</div>`;
}
A.paFiltro = d => { UI.f.paSt = d.v; render(); };
function camposItemPlano(p) {
  return [
    { k: 'rubrica', l: 'Rubrica', t: 'select', req: true, blank: false, opts: Calc.folhas(p).filter(r => !r.codigo.startsWith('1.1')).map(r => [r.codigo, r.codigo + ' ' + r.nome]) },
    { k: 'numero', l: 'Nº no plano', t: 'number', min: 0 },
    { k: 'descricao', l: 'Descrição do item', req: true, full: true },
    { k: 'justificativa', l: 'Finalidade / justificativa', t: 'textarea', rows: 2 },
    { k: 'origem', l: 'Origem', t: 'select', blank: false, opts: [['nacional', 'Nacional'], ['importado', 'Importado']] },
    { k: 'moeda', l: 'Moeda', t: 'select', blank: false, opts: MOEDAS },
    { k: 'quantidade', l: 'Quantidade', t: 'number', min: 0, step: 'any' },
    { k: 'valor_unitario', l: 'Valor unitário (na moeda)', t: 'money', min: 0 },
    { k: 'cambio', l: 'Câmbio (R$ por unidade da moeda)', t: 'number', step: 'any', min: 0, help: 'Só para moeda estrangeira' },
    { k: 'valor_previsto', l: 'Valor previsto (R$)', t: 'money', min: 0, help: 'Vazio = quantidade × unitário × câmbio' },
    { k: 'detalhe', l: 'Detalhe (ex.: 7 dias · 32 pessoas)' },
    { k: 'status', l: 'Situação', t: 'select', blank: false, opts: Object.entries(ST_ITEM).map(([k, v]) => [k, v[0]]) },
    { k: 'obs', l: 'Observações', t: 'textarea', rows: 2 }];
}
A.itemPlanoNovo = d => {
  const p = byId('projetos', d.projeto);
  const prox = cod => Math.max(0, ...D.plano_itens.filter(i => i.projeto_id === p.id && i.rubrica === cod).map(i => num(i.numero))) + 1;
  const rub = d.rubrica || '1.3';
  form({ title: 'Novo item do plano de aplicação — ' + p.sigla, wide: true, fields: camposItemPlano(p), values: { rubrica: rub, numero: prox(rub), origem: 'nacional', moeda: 'BRL', quantidade: 1, status: 'previsto' },
    onSave: x => Data.insert('plano_itens', { ...x, projeto_id: p.id, numero: x.numero ?? prox(x.rubrica) }) });
};
A.itemPlanoEditar = d => {
  const i = byId('plano_itens', d.id), p = byId('projetos', i.projeto_id);
  const ds = D.despesas.filter(x => x.item_id === i.id).sort(byName('data'));
  const after = ds.length ? `<div class="sec">Gastos lançados neste item</div><table class="t small"><tr><th>Data</th><th>Descrição</th><th>Documento</th><th class="num">Valor</th></tr>${ds.map(x => `<tr><td>${fmtD(x.data)}</td><td>${esc(x.descricao)}</td><td>${esc(x.documento || '')}</td><td class="num">${fmtBRL2(x.valor)}</td></tr>`).join('')}</table>` : '';
  form({ title: `Item ${i.numero || ''} — ${i.descricao}`, wide: true, fields: camposItemPlano(p), values: i, after,
    onSave: x => Data.update('plano_itens', i.id, x),
    onDelete: () => Data.remove('plano_itens', i.id), deleteLabel: 'Excluir item',
    deleteConfirm: ds.length ? `Excluir este item? Os ${ds.length} gasto(s) lançados nele continuam na rubrica, sem o item.` : 'Excluir este item do plano de aplicação?' });
};
A.itemParaInfra = d => {
  const i = byId('plano_itens', d.id), p = byId('projetos', i.projeto_id);
  form({ title: 'Cadastrar na Infraestrutura', okLabel: 'Cadastrar',
    intro: `<div class="note small mb">Cria o bem no módulo de Infraestrutura, ligado ao projeto ${esc(p.sigla)} (aquisição) e a este item do plano.</div>`,
    fields: [{ k: 'nome', l: 'Nome', req: true, full: true }, { k: 'codigo', l: 'Código interno (ex.: AN-02)' }, { k: 'patrimonio', l: 'Nº de patrimônio UFSM' },
      { k: 'categoria', l: 'Categoria', t: 'select', blank: false, opts: [['equipamento', 'Equipamento'], ['instrumento', 'Instrumento'], ['bancada', 'Bancada'], ['software', 'Software'], ['veiculo', 'Veículo'], ['outro', 'Outro']] },
      { k: 'localizacao', l: 'Localização' }, { k: 'responsavel_id', l: 'Responsável', t: 'select', opts: optPessoas() }],
    values: { nome: i.descricao, categoria: /software|licen/i.test(i.descricao) ? 'software' : /sensor|analis|medidor|contador|sonda|oscilosc|balan[çc]a/i.test(i.descricao) ? 'instrumento' : 'equipamento' },
    onSave: async x => { const it = await Data.insert('infra_itens', { ...x, projeto_aquisicao_id: p.id, status: 'operacional', obs: `Adquirido pelo projeto ${p.sigla} — item ${i.numero || ''} do plano de aplicação` }); await Data.update('plano_itens', i.id, { infra_item_id: it.id }); },
    okMsg: '✓ Bem cadastrado na Infraestrutura' });
};
A.itemInfraVer = d => { UI.tab = 'infra'; UI.sub.infra = 'itens'; UI.projeto = null; render(); A.itemAbrir({ id: d.id }); };

A.dpItemLimpa = () => { UI.f.dpItem = ''; render(); };

/* ── Desembolso: parcelas do financiador × recebido × executado (caixa) ── */
A.finDesemb = d => { UI.sub.projFin = 'desembolso'; A.projAbrir({ id: d.id, aba: 'financeiro' }); };
function finDesembolso(p) {
  const { parcelas, rub, tot } = Calc.desembolso(p), pode = Perm.editaFin(p.id);
  const cor = v => v < -0.005 ? 'var(--red)' : 'inherit';
  const mets = [['Aprovado', fmtBRL(tot.aprovado)], ['Previsto nas parcelas', fmtBRL(tot.previsto)], ['Recebido', fmtBRL(tot.recebido)], ['Executado', fmtBRL(tot.executado)],
    ['Saldo em caixa', fmtBRL(tot.caixa), tot.caixa < -0.005 ? 'color:var(--red)' : 'color:var(--green-txt)'], ['A receber', fmtBRL(tot.aReceber)]];
  const al = [];
  tot.atrasadas.forEach(x => al.push(['bad', `Parcela ${x.d.numero} (${fmtBRL2(x.d.valor_previsto)}) prevista para ${fmtD(x.d.data_prevista)} ainda não foi recebida.`]));
  if (parcelas.length && tot.caixa < -0.005) al.push(['bad', `Gastos (${fmtBRL2(tot.executado)}) acima do recebido (${fmtBRL2(tot.recebido)}) — o projeto está sem caixa.`]);
  tot.rubricasNeg.forEach(x => al.push(['warn', `${esc(x.r.codigo + ' ' + x.r.nome)}: executado ${fmtBRL2(x.executado)} acima do liberado ${fmtBRL2(x.recebido)} (${fmtBRL2(x.caixa)}).`]));
  if (parcelas.length && tot.aprovado && Math.abs(tot.previsto - tot.aprovado) > 1) al.push(['warn', `As parcelas somam ${fmtBRL2(tot.previsto)}, mas o aprovado nas rubricas é ${fmtBRL2(tot.aprovado)}.`]);
  parcelas.filter(x => x.dist.length && Math.abs(x.distDif) > 1).forEach(x => al.push(['warn', `A distribuição por rubrica da parcela ${x.d.numero} soma ${fmtBRL2(x.somaDist)}, diferente do valor da parcela (${fmtBRL2(x.d.valor_previsto)}).`]));
  const linhasP = parcelas.map(x => { const d = x.d, st = ST_DESEMB[x.st];
    return `<tr class="${pode ? 'click' : ''}${x.st === 'cancelada' ? ' faint' : ''}" ${pode ? `data-a="parcelaEditar" data-id="${d.id}"` : ''}><td class="small muted" style="text-align:right">${d.numero}</td>
      <td><b>${esc(d.descricao || 'Parcela ' + String(d.numero).padStart(2, '0'))}</b><div class="small muted">${esc([d.fundacao, x.dist.length ? 'distribuição por rubrica informada' : 'repartida pelo aprovado'].filter(Boolean).join(' · '))}</div></td>
      <td class="small">${fmtD(d.data_prevista) || '—'}</td><td class="num">${fmtBRL2(d.valor_previsto)}</td>
      <td class="small">${fmtD(d.data_recebida) || ''}</td><td class="num">${d.status === 'recebida' ? fmtBRL2(d.valor_recebido) : ''}</td>
      <td>${badge(st[0], st[1])}</td><td style="white-space:nowrap">${pode && ['prevista', 'atrasada'].includes(x.st) ? `<button class="btn-s" data-a="parcelaReceber" data-id="${d.id}">Registrar recebimento</button>` : ''}${d.documento ? `<div class="small muted">${esc(d.documento)}</div>` : ''}</td></tr>`; }).join('');
  const linhasR = rub.map(x => `<tr><td class="cod">${esc(x.r.codigo)}</td><td>${esc(x.r.nome)}</td><td class="num">${fmtBRL(x.aprovado)}</td><td class="num">${fmtBRL(x.previsto)}</td><td class="num">${fmtBRL(x.recebido)}</td>
      <td class="num">${fmtBRL(x.executado)}</td><td class="num" style="font-weight:600;color:${cor(x.caixa)}">${fmtBRL(x.caixa)}</td><td class="num muted">${fmtBRL(x.aLiberar)}</td><td style="white-space:nowrap">${x.recebido ? barraExec(x.executado, x.recebido) : ''}</td></tr>`).join('');
  const tr = rub.reduce((a, x) => { ['aprovado', 'previsto', 'recebido', 'executado', 'caixa', 'aLiberar'].forEach(k => a[k] += x[k]); return a; }, { aprovado: 0, previsto: 0, recebido: 0, executado: 0, caixa: 0, aLiberar: 0 });
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:17px;${s || ''}">${v}</div></div>`).join('')}</div>
  ${al.map(([c, h]) => `<div class="alert ${c} mb">${h}</div>`).join('')}
  <div class="toolbar"><span class="sec" style="margin:0">Parcelas${tot.proxima ? ` <span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:400">· próxima: nº ${tot.proxima.d.numero} em ${fmtD(tot.proxima.d.data_prevista) || 'data não definida'}</span>` : ''}</span>
    <div class="row">${pode ? `<button class="btn-s" data-a="importarPlanilha" data-projeto="${p.id}">Importar da planilha do edital…</button>${parcelas.some(x => x.st !== 'prevista' && x.st !== 'atrasada') ? '' : `<button class="btn-s" data-a="parcelasGerar" data-projeto="${p.id}">Gerar parcelas…</button>`}<button class="btn-p" data-a="parcelaNova" data-projeto="${p.id}">+ Parcela</button>` : ''}</div></div>
  ${parcelas.length ? `<div class="card tw" style="padding:4px 8px"><table class="t"><tr><th style="width:30px">Nº</th><th>Parcela</th><th>Prevista para</th><th class="num">Valor previsto</th><th>Recebida em</th><th class="num">Valor recebido</th><th>Situação</th><th></th></tr>${linhasP}
    <tr class="total"><td></td><td colspan="2">Total</td><td class="num">${fmtBRL2(tot.previsto)}</td><td></td><td class="num">${fmtBRL2(tot.recebido)}</td><td colspan="2"></td></tr></table></div>
  <div class="sec">Caixa por rubrica</div>
  <div class="card tw" style="padding:4px 8px"><table class="t orc"><tr><th>Código</th><th>Rubrica</th><th class="num">Aprovado</th><th class="num">Nas parcelas</th><th class="num">Liberado</th><th class="num">Executado</th><th class="num">Saldo em caixa</th><th class="num">A liberar</th><th>Uso do liberado</th></tr>${linhasR}
    <tr class="total"><td></td><td>Total</td><td class="num">${fmtBRL(tr.aprovado)}</td><td class="num">${fmtBRL(tr.previsto)}</td><td class="num">${fmtBRL(tr.recebido)}</td><td class="num">${fmtBRL(tr.executado)}</td><td class="num" style="color:${cor(tr.caixa)}">${fmtBRL(tr.caixa)}</td><td class="num">${fmtBRL(tr.aLiberar)}</td><td></td></tr></table></div>
  <div class="small muted mt">Liberado = parte de cada parcela recebida que cabe à rubrica (pela distribuição informada ou, sem ela, proporcional ao aprovado). Saldo em caixa = liberado − executado.</div>`
    : `<div class="card empty">Nenhuma parcela cadastrada.${pode ? ' Importe o cronograma de desembolso da planilha do edital, gere parcelas iguais ou cadastre cada parcela.' : ''}</div>`}`;
}
function camposParcela(p, d) {
  const folhas = Calc.folhas(p).filter(r => Calc.valoresRubrica(p.id, r.codigo).aprovado || (d && D.desembolso_rubricas.some(x => x.desembolso_id === d.id && x.rubrica === r.codigo)));
  return [
    { k: 'numero', l: 'Nº da parcela', t: 'number', min: 1, req: true }, { k: 'descricao', l: 'Descrição', ph: 'ex.: Parcela 01' },
    { k: 'fundacao', l: 'Repassada por (fundação / financiador)' }, { k: 'data_prevista', l: 'Data prevista', t: 'date' },
    { k: 'valor_previsto', l: 'Valor previsto (R$)', t: 'money', min: 0, req: true },
    { k: 'status', l: 'Situação', t: 'select', blank: false, opts: [['prevista', 'Prevista'], ['recebida', 'Recebida'], ['cancelada', 'Cancelada']] },
    { k: 'data_recebida', l: 'Recebida em', t: 'date' }, { k: 'valor_recebido', l: 'Valor recebido (R$)', t: 'money', min: 0 },
    { k: 'documento', l: 'Documento (ofício, extrato, comprovante)' }, { k: 'obs', l: 'Observações', t: 'textarea', rows: 2 },
    { t: 'sec', k: '_s', l: 'Distribuição por rubrica (opcional — vazio reparte pelo aprovado)' },
    ...folhas.map(r => ({ k: 'r_' + r.codigo.replace(/\./g, '_'), l: `${r.codigo} ${r.nome}`, t: 'money', min: 0 }))];
}
async function salvarParcela(p, d, x) {
  const dist = {}; Object.keys(x).filter(k => k.startsWith('r_')).forEach(k => { const v = num(x[k]); if (v > 0) dist[k.slice(2).replace(/_/g, '.')] = v; delete x[k]; }); delete x._s;
  const soma = Object.values(dist).reduce((s, v) => s + v, 0);
  if (Object.keys(dist).length && Math.abs(soma - num(x.valor_previsto)) > 1) falha(`A distribuição por rubrica soma ${fmtBRL2(soma)}, mas a parcela é de ${fmtBRL2(x.valor_previsto)}. Ajuste os valores ou deixe a distribuição vazia.`);
  const row = d ? await Data.update('desembolsos', d.id, x) : await Data.insert('desembolsos', { ...x, projeto_id: p.id });
  await Data.removeWhere('desembolso_rubricas', { desembolso_id: row.id });
  for (const [rubrica, valor] of Object.entries(dist)) await Data.insert('desembolso_rubricas', { desembolso_id: row.id, projeto_id: p.id, rubrica, valor });
  return row;
}
const valoresDist = d => { const v = {}; D.desembolso_rubricas.filter(x => x.desembolso_id === d.id).forEach(x => v['r_' + x.rubrica.replace(/\./g, '_')] = x.valor); return v; };
A.parcelaNova = d => {
  const p = byId('projetos', d.projeto), n = Math.max(0, ...D.desembolsos.filter(x => x.projeto_id === p.id).map(x => x.numero)) + 1;
  form({ title: 'Nova parcela — ' + p.sigla, wide: true, fields: camposParcela(p, null), values: { numero: n, descricao: 'Parcela ' + String(n).padStart(2, '0'), fundacao: p.fundacao_apoio || '', status: 'prevista' },
    onSave: x => salvarParcela(p, null, x) });
};
A.parcelaEditar = d => {
  const x0 = byId('desembolsos', d.id), p = byId('projetos', x0.projeto_id);
  form({ title: `Parcela ${x0.numero} — ${p.sigla}`, wide: true, fields: camposParcela(p, x0), values: { ...x0, ...valoresDist(x0) },
    onSave: x => salvarParcela(p, x0, x), onDelete: () => Data.remove('desembolsos', x0.id), deleteConfirm: `Excluir a parcela ${x0.numero}?` });
};
A.parcelaReceber = d => {
  const x0 = byId('desembolsos', d.id), p = byId('projetos', x0.projeto_id);
  form({ title: `Recebimento da parcela ${x0.numero} — ${p.sigla}`, okLabel: 'Registrar',
    intro: `<div class="note small mb">Prevista: <b>${fmtBRL2(x0.valor_previsto)}</b>${x0.data_prevista ? ' para ' + fmtD(x0.data_prevista) : ''}${x0.fundacao ? ' · ' + esc(x0.fundacao) : ''}. Se o valor recebido for menor, a parcela fica como recebida parcialmente e cada rubrica é liberada na mesma proporção.</div>`,
    fields: [{ k: 'data_recebida', l: 'Recebida em', t: 'date', req: true }, { k: 'valor_recebido', l: 'Valor recebido (R$)', t: 'money', min: 0.01, req: true }, { k: 'documento', l: 'Documento (ofício, extrato, comprovante)', full: true }],
    values: { data_recebida: hoje(), valor_recebido: x0.valor_previsto, documento: x0.documento },
    onSave: x => Data.update('desembolsos', x0.id, { ...x, status: 'recebida' }), okMsg: '✓ Recebimento registrado' });
};
A.parcelasGerar = d => {
  const p = byId('projetos', d.projeto), apr = Calc.totaisOrc(p.id).aprovado || num(p.valor_total);
  const meses = p.inicio && p.fim ? Calc.mesesPeriodo(p.inicio, p.fim) : 24;
  form({ title: 'Gerar parcelas iguais — ' + p.sigla, okLabel: 'Gerar',
    intro: `<div class="note small mb">Divide <b>${fmtBRL2(apr)}</b> (aprovado nas rubricas${Calc.totaisOrc(p.id).aprovado ? '' : ' — usando o valor do projeto'}) em parcelas iguais. As parcelas previstas que já existirem são substituídas. Cada parcela é repartida entre as rubricas pelo aprovado; ajuste depois se o financiador informar outra distribuição.</div>`,
    fields: [{ k: 'n', l: 'Número de parcelas', t: 'number', min: 1, max: 60, req: true }, { k: 'ini', l: 'Data da 1ª parcela', t: 'date', req: true },
      { k: 'intervalo', l: 'Intervalo entre parcelas (meses)', t: 'number', min: 1, max: 60, req: true }, { k: 'fundacao', l: 'Repassada por' }],
    values: { n: 2, ini: p.inicio, intervalo: Math.max(1, Math.round(meses / 2)), fundacao: p.fundacao_apoio || '' },
    onSave: async x => {
      const n = Math.round(num(x.n)); if (!(n >= 1)) falha('Informe o número de parcelas.'); if (!(apr > 0)) falha('O projeto ainda não tem valor aprovado nas rubricas nem valor total.');
      for (const o of D.desembolsos.filter(q => q.projeto_id === p.id)) { if (o.status !== 'prevista') falha('Já há parcelas recebidas ou canceladas; cadastre as novas uma a uma.'); await Data.remove('desembolsos', o.id); }
      const cent = Math.round(apr * 100), base = Math.floor(cent / n);
      for (let i = 0; i < n; i++) { const dt = toDate(x.ini); dt.setMonth(dt.getMonth() + i * Math.round(num(x.intervalo)));
        await Data.insert('desembolsos', { projeto_id: p.id, numero: i + 1, descricao: 'Parcela ' + String(i + 1).padStart(2, '0'), fundacao: x.fundacao || null, data_prevista: isoOf(dt), valor_previsto: (i === n - 1 ? cent - base * (n - 1) : base) / 100 }); }
    }, okMsg: '✓ Parcelas geradas' });
};
