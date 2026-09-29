
/* ════════════════════════════════════════════════════════════════════
   RELATÓRIOS
   ════════════════════════════════════════════════════════════════════ */
UI.rel = { escopo: 'completo', financiador: '', secoes: { resumo: true, saude: true, portfolio: true, financeiro: true, cronograma: true, equipe: true, gerencias: true, infra: true, prospeccao: true } };
const SECOES_REL = [['resumo', 'Resumo executivo'], ['saude', 'Saúde dos projetos (físico × financeiro)'], ['portfolio', 'Portfólio'], ['financeiro', 'Financeiro'], ['cronograma', 'Cronograma, aditivos e entregas'], ['equipe', 'Equipe e atribuições'], ['gerencias', 'Gerências e demandas'], ['infra', 'Infraestrutura'], ['prospeccao', 'Prospecção']];
VIEWS.relatorios = () => {
  const tipo = UI.sub.rel || 'projeto';
  const chips = `<div class="subtabs">${[['projeto', 'Relatório de projeto (físico-financeiro)'], ['lab', 'Relatório do laboratório']].map(([k, l]) => `<button class="chip${tipo === k ? ' on' : ''}" data-a="sub" data-g="rel" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (tipo === 'projeto') return chips + relProjetoForm();
  const c = UI.rel, fins = [...new Set(D.projetos.map(p => p.financiador).filter(Boolean))].sort();
  return chips + `<div class="card" style="max-width:720px">
    <div class="bold mb">Relatório do laboratório (portfólio)</div>
    <div class="fgrid"><div><label class="fl">Escopo</label><select onchange="UI.rel.escopo=this.value;render()"><option value="completo"${c.escopo === 'completo' ? ' selected' : ''}>Portfólio completo (vigentes)</option><option value="financiador"${c.escopo === 'financiador' ? ' selected' : ''}>Por financiador</option><option value="todos"${c.escopo === 'todos' ? ' selected' : ''}>Todos os projetos (inclui encerrados)</option></select></div>
    ${c.escopo === 'financiador' ? `<div><label class="fl">Financiador</label><select onchange="UI.rel.financiador=this.value">${fins.map(f => `<option${c.financiador === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></div>` : '<div></div>'}</div>
    <label class="fl mt">Seções</label><div class="checks">${SECOES_REL.map(([k, l]) => `<label><input type="checkbox" ${c.secoes[k] ? 'checked' : ''} onchange="UI.rel.secoes['${k}']=this.checked"> ${l}</label>`).join('')}</div>
    <div class="mactions"><button class="btn-p" data-a="relGerar">Gerar relatório →</button></div>
    <div class="small muted">Abre uma prévia com opções de imprimir / salvar em PDF, Word (.docx) e Markdown. O relatório respeita suas permissões: valores financeiros só aparecem para projetos que você pode ver.</div></div>`;
};
function montarRelatorio() {
  const c = UI.rel; if (c.escopo === 'financiador' && !c.financiador) c.financiador = [...new Set(D.projetos.map(p => p.financiador).filter(Boolean))].sort()[0] || '';
  const projs = D.projetos.filter(p => c.escopo === 'todos' || (p.situacao === 'vigente' && (c.escopo !== 'financiador' || p.financiador === c.financiador))).sort(byName('sigla'));
  const ids = new Set(projs.map(p => p.id));
  const S = [];   // {h, p:[], t:[{head,rows}], sub:[{h3,p,t}]}
  const sec = (h) => { const s = { h, blocks: [] }; S.push(s); return s; };
  const P = (s, txt) => s.blocks.push({ p: txt }); const T = (s, head, rows) => s.blocks.push({ head, rows }); const H3 = (s, txt) => s.blocks.push({ h3: txt });
  if (c.secoes.resumo) {
    const s = sec('Resumo executivo'); const cnt = k => projs.filter(p => p.status === k).length;
    P(s, `${projs.length} projeto(s) no escopo · valor contratado ${fmtBRL(projs.reduce((a, p) => a + num(p.valor_total), 0))}.`);
    P(s, `Status: ${cnt('em_dia')} em dia · ${cnt('atencao')} em atenção · ${cnt('critico')} crítico(s) · ${cnt('pendente')} pendente(s).`);
    const venc = projs.filter(Calc.vencido); if (venc.length) P(s, `Vigência vencida sem encerramento: ${venc.map(p => p.sigla).join(', ')}.`);
    const al = projs.filter(p => ['critico', 'atencao'].includes(p.status));
    if (al.length) { H3(s, 'Pontos de atenção'); T(s, ['Projeto', 'Status', 'Observação'], al.map(p => [p.sigla, STATUS_PROJ[p.status][0], p.notas || ''])); }
    const atr = D.tarefas.filter(t => Calc.atrasada(t) && (!t.projeto_id || ids.has(t.projeto_id))); if (atr.length) P(s, `${atr.length} tarefa(s) atrasada(s).`);
  }
  if (c.secoes.saude) {
    const s = sec('Saúde dos projetos'), SS = projs.map(p => Calc.saudeProjeto(p));
    T(s, ['Projeto', 'Vigência até', 'Físico (real / previsto)', 'Execução financeira', 'Entregas atrasadas', 'Vagas', 'Sinal', 'Motivos'], SS.map(x => [x.p.sigla, fmtD(x.p.fim), x.fis ? `${x.fis.pct}% / ${x.fis.prev}%` : '—', x.fin ? `${x.fin.pct}% (tempo ${x.tempoPct}%)` : '—', String(x.entAtr), String(x.eq.vagas), SINAL[x.sinal][0], [...x.mot.bad, ...x.mot.warn].join('; ')]));
  }
  if (c.secoes.portfolio) { const s = sec('Portfólio de projetos'); T(s, ['Projeto', 'Tipo', 'Financiador', 'Valor', 'Vigência', 'Coordenação', 'Fase', 'Status'], projs.map(p => [p.sigla + (p.nome ? ' — ' + p.nome : ''), lbl(TIPOS_PROJ, p.tipo || 'edital'), p.financiador || '—', fmtBRL(p.valor_total), `${fmtD(p.inicio)} – ${fmtD(p.fim)}`, Calc.coordenadores(p.id).map(x => x.nome).join(', ') || '—', p.fase || '—', STATUS_PROJ[p.status][0]])); }
  if (c.secoes.financeiro) {
    const s = sec('Financeiro'); const vis = projs.filter(p => Perm.veFin(p.id));
    T(s, ['Projeto', 'Tipo', 'Valor contratado', 'Aprovado', 'Previsto', 'Executado', 'Saldo', '% exec.'], vis.map(p => { const t = Calc.totaisOrc(p.id); return [p.sigla, lbl(TIPOS_PROJ, p.tipo || 'edital'), fmtBRL(p.valor_total), fmtBRL(t.aprovado), fmtBRL(t.previsto), fmtBRL(t.executado), fmtBRL(t.saldo), t.aprovado ? (t.executado / t.aprovado * 100).toFixed(1) + '%' : '—']; }));
    if (vis.length < projs.length) P(s, `(${projs.length - vis.length} projeto(s) sem acesso financeiro para o seu usuário não aparecem.)`);
    vis.forEach(p => {
      const o = Calc.orcamento(p); if (!o.tot.aprovado && !o.tot.executado) return;
      H3(s, `${p.sigla} — orçamento por rubrica`);
      T(s, ['Código', 'Rubrica', 'Aprovado', 'Previsto', 'Executado', 'Saldo'], [...o.rows.filter(x => !x.folha || x.aprovado || x.previsto || x.executado).map(x => [x.r.codigo, (x.folha ? '' : '▸ ') + x.r.nome, fmtBRL2(x.aprovado), fmtBRL2(x.previsto), fmtBRL2(x.executado), fmtBRL2(x.saldo)]), ['', 'Total', fmtBRL2(o.tot.aprovado), fmtBRL2(o.tot.previsto), fmtBRL2(o.tot.executado), fmtBRL2(o.tot.saldo)]]);
    });
    const porF = {}; projs.forEach(p => porF[p.financiador || '—'] = (porF[p.financiador || '—'] || 0) + num(p.valor_total));
    if (Object.keys(porF).length > 1) { H3(s, 'Valor contratado por financiador'); T(s, ['Financiador', 'Valor'], Object.entries(porF).sort((a, b) => b[1] - a[1]).map(([f, v]) => [f, fmtBRL(v)])); }
  }
  if (c.secoes.cronograma) {
    const s = sec('Cronograma, aditivos e entregas');
    T(s, ['Projeto', 'Início', 'Término', 'Duração', 'Aditivos', 'Situação'], projs.slice().sort(byName('inicio')).map(p => { const ads = Calc.aditivosDe(p.id); return [p.sigla, fmtD(p.inicio), fmtD(p.fim), monthsIncl(p.inicio, p.fim) + ' meses', ads.length ? ads.length + ' (original até ' + fmtD(Calc.vigenciaOriginal(p)) + ')' : '—', Calc.vencido(p) ? 'vigência vencida' : lbl(SITUACAO_PROJ, p.situacao)]; }));
    const ents = D.entregas.filter(e => ids.has(e.projeto_id) && Calc.entregaAberta(e)).sort(byName('prazo'));
    if (ents.length) { H3(s, 'Entregas e prazos em aberto'); T(s, ['Prazo', 'Projeto', 'Entrega', 'Responsável', 'Situação'], ents.map(e => [fmtD(e.prazo) + (Calc.entregaAtrasada(e) ? ' (ATRASADA)' : ''), siglaProjeto(e.projeto_id), e.titulo, e.responsavel_id ? nomePessoa(e.responsavel_id) : '—', ST_ENTREGA[e.status][0]])); }
  }
  if (c.secoes.equipe) {
    const s = sec('Equipe e atribuições');
    D.pessoas.filter(p => p.ativo !== false).sort(byName('nome')).forEach(pe => {
      const al = D.alocacoes.filter(a => a.pessoa_id === pe.id && ids.has(a.projeto_id)); if (!al.length && c.escopo === 'financiador') return; if (!al.length && pe.tipo === 'ic') return;
      H3(s, `${pe.risco_sobrecarga ? '⚠ ' : ''}${pe.nome} — ${pe.funcao || lbl(TIPOS_PESSOA, pe.tipo)} · carga ${Math.round(Calc.carga(pe.id))}% · disponibilidade ${num(pe.disponibilidade_pct)}%`);
      if (al.length) T(s, ['Projeto', 'Papel', 'Nível', 'Carga', 'Atribuição'], al.map(a => [siglaProjeto(a.projeto_id) + (a.coordena ? ' (coord.)' : ''), a.papel || '—', NIVEIS[a.nivel], num(a.carga_pct) + '%', a.atribuicao || ''])); else P(s, 'Sem alocação nos projetos do escopo.');
    });
    const ics = D.pessoas.filter(p => p.ativo !== false && p.tipo === 'ic');
    if (ics.length) { H3(s, `Bolsistas IC (${ics.length})`); T(s, ['Nome', 'Curso', 'Foco', 'Projetos'], ics.sort(byName('nome')).map(p => [p.nome, (p.curso || '') + (p.semestre ? ' · ' + p.semestre + 'º' : ''), p.foco || '', D.alocacoes.filter(a => a.pessoa_id === p.id).map(a => siglaProjeto(a.projeto_id)).join(', ') || '—'])); }
  }
  if (c.secoes.gerencias) {
    const s = sec('Gerências e demandas');
    D.gerencias.filter(g => g.ativa).sort(by('ordem')).forEach(g => {
      const dem = D.tarefas.filter(t => t.gerencia_id === g.id && !t.concluida);
      H3(s, `${g.nome} — ${Calc.gerentes(g.id).map(gm => nomePessoa(gm.pessoa_id) + (gm.funcao === 'adjunto' ? ' (adj.)' : '')).join(', ') || 'sem gerente nomeado'}`);
      if (dem.length) T(s, ['Demanda', 'Projeto', 'Responsáveis', 'Prazo'], dem.map(t => [t.titulo + (Calc.atrasada(t) ? ' (ATRASADA)' : ''), t.projeto_id ? siglaProjeto(t.projeto_id) : '', Calc.responsaveis(t.id).map(p => p.nome).join(', '), fmtD(t.prazo)])); else P(s, 'Sem demandas abertas.');
    });
  }
  if (c.secoes.infra && D.infra_itens.length) {
    const s = sec('Infraestrutura');
    T(s, ['Item', 'Categoria', 'Situação', 'Responsável', 'Próx. manutenção'], arvoreItens().filter(([i]) => i.status !== 'desativado').map(([i, n]) => ['  '.repeat(n) + (n ? '└ ' : '') + i.nome, lbl(CAT_INFRA, i.categoria), ST_INFRA[i.status][0], i.responsavel_id ? nomePessoa(i.responsavel_id) : '—', fmtD(proximaManut(i.id))]));
    const al = Calc.alertasInfra(); if (al.length) { H3(s, 'Alertas'); al.forEach(a => P(s, '• ' + a.txt)); }
    const uso = {}; D.infra_reservas.filter(r => r.status === 'realizada' && (!r.projeto_id || ids.has(r.projeto_id))).forEach(r => { const k = (byId('infra_itens', r.item_id) || {}).nome + '|' + (r.projeto_id ? siglaProjeto(r.projeto_id) : '—'); uso[k] = (uso[k] || 0) + Calc.horasReserva(r); });
    if (Object.keys(uso).length) { H3(s, 'Horas de uso (reservas realizadas)'); T(s, ['Item', 'Projeto', 'Horas'], Object.entries(uso).map(([k, h]) => [...k.split('|'), h.toFixed(1)])); }
  }
  if (c.secoes.prospeccao) {
    const s = sec('Prospecção');
    const pr = D.prospeccoes.filter(p => c.escopo !== 'financiador' || norm(p.financiador) === norm(c.financiador));
    if (!pr.length) P(s, 'Nenhuma prospecção no escopo.');
    else T(s, ['Prospecção', 'Financiador', 'IA', 'IE', 'IP', 'Quadrante', 'Situação'], pr.map(p => { const a = Calc.ultimaAvaliacao(p.id); return [p.nome, p.financiador || '—', a && !a.bloqueada ? Math.round(a.ia) : '—', a && !a.bloqueada ? num(a.ie).toFixed(1) : '—', a && !a.bloqueada ? num(a.ip).toFixed(1) : '—', !a ? 'a avaliar' : a.bloqueada ? 'Bloqueada' : QUAD[a.quadrante][0], PIPE[p.situacao][0]]; }));
  }
  const titulo = 'Relatório de portfólio — GPMOT/UFSM', escopo = c.escopo === 'financiador' ? 'Financiador: ' + c.financiador : c.escopo === 'todos' ? 'Todos os projetos' : 'Portfólio vigente';
  return { titulo, escopo, data: fmtD(hoje()), S };
}
function relHTML(R) {
  const tb = b => `<table><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  const kvH = b => `<table class="kv2">${b.kv.map(([k, v]) => `<tr><td style="color:#5f5e5a;width:190px;border:none;padding:2px 8px 2px 0">${esc(k)}</td><td style="border:none;padding:2px 0">${esc(v)}</td></tr>`).join('')}</table>`;
  const blk = b => b.p != null ? `<p>${esc(b.p).replace(/\n/g, '<br>')}</p>` : b.h3 ? `<h3>${esc(b.h3)}</h3>` : b.kv ? kvH(b) : b.lista ? `<ul>${b.lista.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : b.rows.length ? tb(b) : '<p style="color:#8a8984;font-style:italic">(sem registros)</p>';
  return `<h1>${esc(R.titulo)}</h1>${R.subtitulo ? `<p style="font-size:15px;margin:0 0 2px">${esc(R.subtitulo)}</p>` : ''}<p style="color:#666">${esc(R.escopo)} · gerado em ${R.data}</p>` + R.S.map(s => `<h2>${esc(s.h)}</h2>` + s.blocks.map(blk).join('')).join('');
}
function relMD(R) {
  const cell = c => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
  const o = [`# ${R.titulo}`, '', ...(R.subtitulo ? [`**${R.subtitulo}**`, ''] : []), `*${R.escopo} · gerado em ${R.data}*`, ''];
  R.S.forEach(s => { o.push(`## ${s.h}`, ''); s.blocks.forEach(b => { if (b.p != null) o.push(b.p, ''); else if (b.h3) o.push(`### ${b.h3}`, ''); else if (b.kv) { b.kv.forEach(([k, v]) => o.push(`- **${k}:** ${v}`)); o.push(''); } else if (b.lista) { b.lista.forEach(x => o.push('- ' + x)); o.push(''); } else if (!b.rows.length) o.push('*(sem registros)*', ''); else { o.push('| ' + b.head.map(cell).join(' | ') + ' |', '|' + b.head.map(() => '---').join('|') + '|'); b.rows.forEach(r => o.push('| ' + r.map(cell).join(' | ') + ' |')); o.push(''); } }); });
  return o.join('\n');
}
function baixar(nome, conteudo, mime) { const b = new Blob([conteudo], { type: mime }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
A.relGerar = () => {
  if (!Object.values(UI.rel.secoes).some(Boolean)) { flash('Escolha ao menos uma seção', true); return; }
  abrirPrevia(montarRelatorio(), `relatorio-gpmot-${hoje()}`);
};

/* ════════════════════════════════════════════════════════════════════
   CONFIGURAÇÕES — usuário, armazenamento, backup, importação
   ════════════════════════════════════════════════════════════════════ */
VIEWS.config = () => {
  const cfg = SB.cfg() || {};
  const sim = lerSim();
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr))">
  ${!ME.online ? `<div class="card"><div class="bold mb">Usuário (modo local)</div>
    <div class="small muted mb">No modo local não há login. Escolha quem você é e com qual papel, para trabalhar e para testar o que cada perfil vê e pode fazer. No modo online isso vem do login.</div>
    <div class="fgrid"><div><label class="fl">Pessoa</label><select id="sim_p"><option value="">— nenhuma (administrador) —</option>${optPessoas().map(([v, l]) => `<option value="${v}"${sim.pessoa_id === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div><label class="fl">Papel</label><select id="sim_r">${PAPEIS.map(([v, l]) => `<option value="${v}"${sim.papel === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="mactions"><button class="btn-p" data-a="simAplicar">Aplicar</button></div>
    <div class="small muted">Permissões efetivas agora: ${Perm.minhas().map(p => `<span class="tag">${p}</span>`).join('') || '<i>nenhuma de gerência</i>'}${Perm.coordenaAlgum() ? ' + coordenação de ' + D.alocacoes.filter(a => a.pessoa_id === ME.pessoa_id && a.coordena).map(a => siglaProjeto(a.projeto_id)).join(', ') : ''}</div></div>` : ''}

  <div class="card"><div class="bold mb">Armazenamento</div>
    ${ME.online ? `<div class="alert ok">Conectado ao banco online: ${esc(cfg.url || '')}</div><div class="row mt"><button data-a="recarregar">↻ Recarregar dados</button></div>`
      : `<div class="alert warn">Modo local: os dados ficam só neste navegador. Exporte backups com frequência.</div>
    <div class="small muted mb">Para usar o banco online (Supabase), crie o projeto, rode o arquivo <b>gpmot_schema.sql</b> no SQL Editor e informe abaixo a URL do projeto e a chave <b>pública</b> (Project Settings → API Keys: a <i>publishable key</i>, que começa com <code>sb_publishable_</code>, ou a antiga <i>anon key</i>). Nunca use a chave secreta (<code>sb_secret_</code> / service_role).</div>
    <div class="fgrid"><div class="full"><label class="fl">URL do projeto Supabase</label><input id="sb_url" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url || '')}"></div>
    <div class="full"><label class="fl">Chave pública (publishable / anon)</label><input id="sb_key" placeholder="sb_publishable_…" value="${esc(cfg.anonKey || '')}"></div></div>
    <div class="mactions"><button class="btn-p" data-a="sbConectar">Conectar ao banco online</button></div>`}</div>

  <div class="card"><div class="bold mb">Backup</div>
    <div class="small muted mb">Arquivo JSON com todas as tabelas. ${ME.online ? 'No modo online, “Enviar backup” grava o conteúdo do arquivo no banco (use para migrar os dados locais).' : 'Importar substitui todos os dados deste navegador.'}</div>
    <div class="row"><button data-a="bkExportar">↓ Exportar backup</button>
      ${Perm.dir() ? `<label class="row" style="cursor:pointer"><span class="btn" style="border:1px solid #c8c6c0;border-radius:7px;padding:5px 12px;background:#fff">↑ ${ME.online ? 'Enviar backup ao banco' : 'Importar backup'}</span><input type="file" accept=".json" style="display:none" onchange="importarArquivo(this.files[0],'backup');this.value=''"></label>` : ''}</div>
    ${Perm.dir() ? `<div class="sec">Dados da versão anterior</div><div class="small muted mb">Converte o JSON exportado pelo programa antigo (gpmot-portfolio-*.json) para a nova estrutura. Você verá um resumo antes de confirmar.</div>
    <label class="row" style="cursor:pointer"><span style="border:1px solid #c8c6c0;border-radius:7px;padding:5px 12px;background:#fff">↑ Importar JSON do programa antigo</span><input type="file" accept=".json" style="display:none" onchange="importarArquivo(this.files[0],'v1');this.value=''"></label>` : ''}
    ${!ME.online && Perm.dir() ? `<div class="sec">Zona de risco</div><button class="btn-d" data-a="zerar">Apagar todos os dados deste navegador</button>` : ''}</div>

  ${ME.online && Perm.dir() ? `<div class="card"><div class="bold mb">Usuários e acessos</div><div class="small muted mb">Novos logins entram sem acesso. Ligue cada usuário a uma pessoa do cadastro, escolha o papel e ative.</div>
    ${D.perfis.sort(byName('email')).map(pf => `<div class="fgrid mb" style="grid-template-columns:1.2fr 1.2fr .8fr auto;align-items:end"><div class="small"><b>${esc(pf.email)}</b></div>
      <select onchange="run(()=>Data.update('perfis','${pf.id}',{pessoa_id:this.value||null}).then(render))"><option value="">— pessoa —</option>${optPessoas().map(([v, l]) => `<option value="${v}"${pf.pessoa_id === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select onchange="run(()=>Data.update('perfis','${pf.id}',{papel:this.value}).then(render))">${PAPEIS.map(([v, l]) => `<option value="${v}"${pf.papel === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="row small"><input type="checkbox" ${pf.ativo ? 'checked' : ''} onchange="run(()=>Data.update('perfis','${pf.id}',{ativo:this.checked}).then(render))"> ativo</label></div>`).join('') || '<div class="empty">Nenhum usuário.</div>'}</div>` : ''}

  ${Perm.tem('historico_ver') ? `<div class="card" style="grid-column:1/-1"><div class="between mb"><span class="bold">Histórico de alterações</span>${ME.online ? '<button class="btn-s" data-a="histCarregar">carregar últimas 300</button>' : ''}</div>
    ${D.historico.length ? D.historico.slice().sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 150).map(h => `<div class="small mb"><span class="muted">${fmtDT(h.em)} · ${esc(quem(h.usuario))}</span> — ${esc(descHist(h))}</div>`).join('') : '<div class="empty">Sem registros carregados.</div>'}</div>` : ''}
  </div>`;
};
function lerSim() { try { return JSON.parse(localStorage.getItem(LS_PREFIX + '_sim') || 'null') || { papel: 'direcao', pessoa_id: null }; } catch { return { papel: 'direcao', pessoa_id: null }; } }
function aplicarSim(s) { ME.online = false; ME.papel = s.papel || 'direcao'; ME.pessoa_id = s.pessoa_id && byId('pessoas', s.pessoa_id) ? s.pessoa_id : null; ME.uid = 'local:' + (ME.pessoa_id || 'direcao'); ME.email = ''; }
A.simAplicar = () => { const s = { pessoa_id: document.getElementById('sim_p').value || null, papel: document.getElementById('sim_r').value }; try { localStorage.setItem(LS_PREFIX + '_sim', JSON.stringify(s)); } catch { } aplicarSim(s); render(); flash('Usuário alterado: ' + (s.pessoa_id ? nomePessoa(s.pessoa_id) : 'administrador') + ' · ' + lbl(PAPEIS, s.papel)); };
A.sbConectar = async () => {
  const url = urlProjeto(document.getElementById('sb_url').value), key = document.getElementById('sb_key').value.trim();
  if (!/^https?:\/\/.+/.test(url) || key.length < 20) { flash('Informe a URL (https://…) e a chave pública', true); return; }
  if (chaveSecreta(key)) { flash('Esta é a chave SECRETA do projeto — ela ignora todas as permissões e não pode ficar no navegador. Use a chave pública (sb_publishable_… ou anon).', true); return; }
  if (!await confirmar('Conectar ao banco online?\nA página será recarregada e pedirá login por e-mail. Os dados locais continuam neste navegador; depois de entrar, use “Enviar backup ao banco” para migrá-los.')) return;
  localStorage.setItem(LS_PREFIX + '_supabase', JSON.stringify({ url, anonKey: key })); location.reload();
};
A.recarregar = async () => { await SB.loadAll(); render(); flash('Dados recarregados'); };
A.histCarregar = async () => { const { data, error } = await SB.client.from('historico').select('*').order('em', { ascending: false }).limit(300); if (error) throw error; D.historico = data; render(); };
A.sair = async () => { await SB.client.auth.signOut(); location.reload(); };
A.zerar = async () => { if (!await confirmar('Apagar TODOS os dados deste navegador?\nExporte um backup antes, se quiser guardá-los.')) return; Local.wipe(); Local.load(); render(); flash('Dados apagados'); };
A.bkExportar = () => {
  const out = { formato: 'gpmot-v2', versao: VERSAO, exportado_em: new Date().toISOString(), tabelas: {} };
  Object.keys(TABLES).forEach(t => out.tabelas[t] = D[t]);
  baixar(`gpmot-backup-${hoje()}.json`, JSON.stringify(out, null, 1), 'application/json');
};
function importarArquivo(f, tipo) {
  if (!f) return; const r = new FileReader();
  r.onload = () => run(async () => {
    let d; try { d = JSON.parse(r.result); } catch { falha('O arquivo não é um JSON válido.'); }
    let T, avisos = [];
    if (tipo === 'backup') { if (d.formato !== 'gpmot-v2' || !d.tabelas) falha('Este arquivo não é um backup da versão 2. Para o JSON do programa antigo, use “Importar JSON do programa antigo”.'); T = d.tabelas; }
    else { if (!d.projects && !d.team) falha('Este arquivo não parece ser do programa antigo (faltam "projects"/"team").'); ({ T, avisos } = converterV1(d)); }
    const resumo = ['pessoas', 'projetos', 'aditivos', 'entregas', 'cronograma', 'documentos', 'pendencias', 'equipe_plano', 'candidatos', 'alocacoes', 'tarefas', 'vinculos_financeiros', 'orcamento_rubricas', 'plano_itens', 'desembolsos', 'despesas', 'prospeccoes', 'avaliacoes', 'gerencias', 'infra_itens'].map(t => `${t}: ${(T[t] || []).length}`).join(' · ');
    openModal(`<h3>Confirmar importação</h3><div class="note mb small">${esc(resumo)}</div>
      ${avisos.length ? `<div class="bold small">Observações da conversão (${avisos.length})</div><div class="small" style="max-height:240px;overflow:auto;background:#faf9f6;border:1px solid #eee;border-radius:8px;padding:8px">${avisos.map(a => '• ' + esc(a)).join('<br>')}</div>` : ''}
      <div class="alert warn mt">${ME.online ? 'Os registros serão GRAVADOS no banco online (registros com o mesmo id são atualizados).' : 'Todos os dados atuais deste navegador serão SUBSTITUÍDOS.'}</div>
      <div class="mactions"><button id="im_n">Cancelar</button><button class="btn-p" id="im_y">Importar</button></div>`, { sticky: true });
    document.getElementById('im_n').onclick = closeModal;
    document.getElementById('im_y').onclick = () => run(async () => {
      document.getElementById('im_y').disabled = true;
      if (ME.online) await enviarAoBanco(T); else { Object.keys(TABLES).forEach(t => D[t] = Array.isArray(T[t]) ? T[t] : []); seedPadrao(); Local.persistAll(); aplicarSim(lerSim()); }
      closeModal(); UI.tab = 'painel'; render(); flash('✓ Importação concluída');
    });
  });
  r.readAsText(f);
}
async function enviarAoBanco(T0) {
  let T = T0;
  const limpar = (t, r) => { const x = completarObrigatorios(t, soColunas(t, r)); delete x.criado_em; delete x.atualizado_em; delete x.atualizado_por; ['criado_por', 'avaliado_por'].forEach(k => { if (x[k] && String(x[k]).startsWith('local:')) x[k] = null; }); if (t === 'avaliacoes' && r.avaliado_em) x.avaliado_em = r.avaliado_em; return x; };
  const up = async (t, rows, onConflict) => { for (let i = 0; i < rows.length; i += 400) { const { error } = await SB.client.from(t).upsert(rows.slice(i, i + 400).map(r => limpar(t, r)), { ...(onConflict ? { onConflict } : {}), ...(t === 'avaliacoes' ? { ignoreDuplicates: true } : {}) });   /* avaliações não se alteram depois de gravadas: o reenvio ignora as que já existem */ if (error) throw new ErroRegra(`Falha ao enviar ${t}: ${traduzErro(error)}`); } };
  const g = t => T[t] || [];
  await up('rubricas', g('rubricas').slice().sort(by('ordem')), 'codigo');
  await up('pessoas', g('pessoas')); await up('projetos', g('projetos'));
  // aditivos: o banco reaplica o efeito ao inserir; os valores do projeto já vêm atualizados no backup, então reenviamos o projeto depois
  await up('aditivos', g('aditivos')); await up('projetos', g('projetos')); await up('entregas', g('entregas'));
  await up('documentos', g('documentos').map(d => ({ ...d, criado_por: String(d.criado_por || '').startsWith('local:') ? null : d.criado_por }))); await up('pendencias', g('pendencias').map(d => ({ ...d, criado_por: String(d.criado_por || '').startsWith('local:') ? null : d.criado_por })));
  await up('cronograma', g('cronograma').slice().sort((a, b) => Calc.codCmp(a.codigo, b.codigo)), 'projeto_id,codigo');
  // gerências já existentes no banco (criadas pelo SQL) são reaproveitadas pelo nome
  const gmap = {}; g('gerencias').forEach(x => { const ex = D.gerencias.find(y => norm(y.nome) === norm(x.nome)); gmap[x.id] = ex ? ex.id : x.id; });
  await up('gerencias', g('gerencias').map(x => ({ ...x, id: gmap[x.id] })));
  const mg = r => ({ ...r, gerencia_id: r.gerencia_id ? (gmap[r.gerencia_id] || r.gerencia_id) : r.gerencia_id });
  T = { ...T, gerencia_membros: g('gerencia_membros').map(mg), tarefas: g('tarefas').map(mg) };
  await up('gerencia_membros', g('gerencia_membros'));
  await up('alocacoes', g('alocacoes'), 'pessoa_id,projeto_id');
  await up('equipe_plano', g('equipe_plano')); await up('equipe_plano_bolsas', g('equipe_plano_bolsas'), 'vaga_id'); await up('candidatos', g('candidatos'));
  await up('tarefas', g('tarefas')); await up('tarefa_responsaveis', g('tarefa_responsaveis'), 'tarefa_id,pessoa_id');
  await up('orcamento_rubricas', g('orcamento_rubricas'), 'projeto_id,rubrica');
  await up('vinculos_financeiros', g('vinculos_financeiros'));
  await up('desembolsos', g('desembolsos')); await up('desembolso_rubricas', g('desembolso_rubricas'), 'desembolso_id,rubrica');
  await up('plano_itens', g('plano_itens').map(i => ({ ...i, infra_item_id: null })));   // o item de infraestrutura entra depois
  await up('despesas', g('despesas'));
  // checklist: o banco já traz o modelo padrão; reaproveita pelo nome e envia só a situação das pessoas
  { const cmap = {}; g('checklist_itens').forEach(i => { const ex = D.checklist_itens.find(y => y.fase === i.fase && norm(y.nome) === norm(i.nome)); cmap[i.id] = ex ? ex.id : i.id; });
    await up('checklist_itens', g('checklist_itens').filter(i => cmap[i.id] === i.id));
    await up('pessoa_checklist', g('pessoa_checklist').map(r => ({ ...r, item_id: cmap[r.item_id] || r.item_id })), 'pessoa_id,item_id'); }
  await up('prospeccoes', g('prospeccoes')); await up('avaliacoes', g('avaliacoes'));
  const itens = g('infra_itens'); await up('infra_itens', itens.map(i => ({ ...i, pai_id: null }))); await up('infra_itens', itens.filter(i => i.pai_id));
  await up('infra_habilitacoes', g('infra_habilitacoes'), 'item_id,pessoa_id'); await up('infra_reservas', g('infra_reservas')); await up('infra_manutencoes', g('infra_manutencoes'));
  await up('plano_itens', g('plano_itens').filter(i => i.infra_item_id));
  await SB.loadAll();
}

/* conversor do JSON do programa antigo (v1) para a nova estrutura */
function converterV1(d) {
  const T = {}; Object.keys(TABLES).forEach(t => T[t] = []);
  const av = [], agora = new Date().toISOString();
  const stamp = o => ({ ...o, criado_em: agora, atualizado_em: agora });
  const ymI = s => { const m = String(s || '').match(/^(\d{4})-(\d{1,2})$/); return m && +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${pad2(+m[2])}-01` : null; };
  const ymF = s => { const m = String(s || '').match(/^(\d{4})-(\d{1,2})$/); return m && +m[2] >= 1 && +m[2] <= 12 ? lastDayOfMonth(+m[1], +m[2]) : null; };
  const diaOk = s => isDate(s) ? s : null;
  const ST = { green: 'em_dia', yellow: 'atencao', red: 'critico', gray: 'pendente' };
  T.rubricas = rubricasPadrao();
  av.push('Todos os projetos foram importados como "Edital". Ajuste o tipo dos projetos de prestação de serviço (editar projeto).');
  T.gerencias = GERENCIAS_PADRAO.map(([nome, descricao, permissoes], i) => stamp({ ...DEFAULTS.gerencias, id: newId(), nome, descricao, permissoes, ordem: i + 1 }));
  const P = {}, PE = {}, PR = {};
  (d.projects || []).forEach((p, i) => {
    const id = newId(); P[p.id] = id;
    let ini = ymI(p.start), fim = ymF(p.end);
    if (!ini) { ini = hoje(); av.push(`Projeto ${p.name}: início inválido ("${p.start}") — usado ${fmtD(ini)}.`); }
    if (!fim || fim < ini) { fim = addDays(ini, 365); av.push(`Projeto ${p.name}: término inválido ("${p.end}") — usado ${fmtD(fim)}.`); }
    const r = stamp({ ...DEFAULTS.projetos, id, sigla: p.name || '(sem sigla)', nome: p.fullName || null, financiador: p.funder || null, fundacao_apoio: p.supportFoundation || null, valor_total: num(p.value), inicio: ini, fim, status: ST[p.status] || 'pendente', fase: p.phase || null, notas: p.notes || null, placeholder: !!p.ph, situacao: 'vigente', ordem: i });
    PR[id] = r; T.projetos.push(r);
    if (fim < hoje()) av.push(`Projeto ${p.name}: vigência terminou em ${fmtD(fim)} — continua como "vigente"; marque como encerrado se for o caso.`);
    if (/^teste?$/i.test(p.name || '')) av.push(`Projeto "${p.name}" parece ser um teste — agora pode ser excluído na tela do projeto.`);
  });
  const tipoDe = role => { const r = norm(role); return /pos-?doc/.test(r) ? 'pos_doc' : /doutorand/.test(r) ? 'doutorando' : /mestrand/.test(r) ? 'mestrando' : /tecnic/.test(r) ? 'tecnico' : /extern/.test(r) ? 'externo' : /pesquisador/.test(r) ? 'pesquisador' : /prof|diretor|docente|cog|coa|controller|fin/.test(r) ? 'docente' : 'outro'; };
  (d.team || []).forEach((m, i) => {
    const id = newId(); PE['team:' + m.id] = id;
    T.pessoas.push(stamp({ ...DEFAULTS.pessoas, id, nome: m.name, tipo: tipoDe(m.role), funcao: m.role || null, risco_sobrecarga: !!m.risk, resumo: m.summary || null,
      disponibilidade_pct: m.availability !== undefined && m.availability !== '' ? Math.max(0, Math.min(100, num(m.availability))) : 100,
      perfil_disponibilidade: PERFIS_DISP.some(x => x[0] === m.availProfile) ? m.availProfile : (/extern/i.test(m.role || '') ? 'externo' : 'interno'), obs_disponibilidade: m.availNote || null, ordem: i }));
  });
  (d.ic || []).forEach((s, i) => {
    const id = newId(); PE['ic:' + s.id] = id;
    const sem = parseInt(s.semester, 10);
    T.pessoas.push(stamp({ ...DEFAULTS.pessoas, id, nome: s.name, tipo: 'ic', curso: s.course || null, semestre: sem >= 1 && sem <= 20 ? sem : null, foco: s.focus || null, ingresso: ymI(s.entry), habilidades: s.skills || [], ordem: 100 + i }));
    (s.scholarships || []).forEach(b => av.push(`Bolsa histórica de ${s.name} (${b.type || '?'}) sem valor — registre em Financeiro › Bolsas se necessário.`));
  });
  /* coordenação deduzida do campo "Responsável" */
  const primeiro = s => norm(String(s).split(/\s+/)[0]);
  const coordDe = {};
  (d.projects || []).forEach(p => { const toks = String(p.lead || '').split('/').map(x => primeiro(x.trim())).filter(x => x && x !== '—' && x !== '-'); coordDe[P[p.id]] = toks; });
  const shared = {};
  const addTarefas = (tasks, pid, pessoaId) => (tasks || []).forEach(t => {
    if (t.sharedId && shared[t.sharedId]) { if (!T.tarefa_responsaveis.some(r => r.tarefa_id === shared[t.sharedId] && r.pessoa_id === pessoaId)) T.tarefa_responsaveis.push({ tarefa_id: shared[t.sharedId], pessoa_id: pessoaId }); return; }
    let ini = diaOk(t.start), prazo = diaOk(t.due); if (ini && prazo && prazo < ini) [ini, prazo] = [prazo, ini];
    const id = newId(); if (t.sharedId) shared[t.sharedId] = id;
    T.tarefas.push(stamp({ ...DEFAULTS.tarefas, id, projeto_id: pid, titulo: t.title || '(sem título)', descricao: t.description || null, inicio: ini, prazo, concluida: !!t.done, concluida_em: t.done ? agora : null, criado_por: null }));
    T.tarefa_responsaveis.push({ tarefa_id: id, pessoa_id: pessoaId });
  });
  (d.team || []).forEach(m => {
    const pesId = PE['team:' + m.id], pe = T.pessoas.find(x => x.id === pesId);
    const pids = new Set([...Object.keys(m.a || {}), ...Object.keys(m.notes || {}), ...Object.keys(m.work || {})]);
    pids.forEach(old => {
      const pid = P[old]; if (!pid) return;
      const lvl = num((m.a || {})[old]), w = (m.work || {})[old] || {}, nota = String((m.notes || {})[old] || '').trim();
      const temTarefa = (w.tasks || []).length;
      if (!(lvl > 0 || nota || temTarefa || (w.load !== undefined && w.load !== '' && num(w.load) > 0))) return;
      const coord = (coordDe[pid] || []).includes(primeiro(pe.nome));
      T.alocacoes.push(stamp({ ...DEFAULTS.alocacoes, id: newId(), pessoa_id: pesId, projeto_id: pid, nivel: Math.max(0, Math.min(3, lvl)),
        carga_pct: w.load !== undefined && w.load !== '' ? Math.max(0, Math.min(200, num(w.load))) : NIVEL_CARGA[lvl] || 0,
        papel: nota && nota.length <= 30 ? nota.replace(/\.$/, '') : null, atribuicao: nota.length > 30 ? nota : null, desde: ymI(w.since) || diaOk(w.since), status: ST_ALOC.some(s => s[0] === w.status) ? w.status : 'ativo', coordena: coord }));
      addTarefas(w.tasks, pid, pesId);
    });
  });
  const nCoord = T.alocacoes.filter(a => a.coordena).length;
  if (nCoord) av.push(`Coordenadores deduzidos do antigo campo "Responsável" (${nCoord} marcação(ões)) — confira na aba Projetos. Só a Direção altera.`);
  (d.projects || []).forEach(p => { const pid = P[p.id]; if ((coordDe[pid] || []).length && !T.alocacoes.some(a => a.projeto_id === pid && a.coordena)) av.push(`Projeto ${p.name}: responsável "${p.lead}" não foi encontrado na equipe — defina o coordenador manualmente.`); });
  (d.ic || []).forEach(s => (s.allocations || []).forEach(a => {
    const pesId = PE['ic:' + s.id], pid = P[a.projectId];
    if (!pid) { av.push(`${s.name}: alocação em "${a.projectOther || 'outro'}" (fora dos projetos) não foi importada.`); return; }
    if (T.alocacoes.some(x => x.pessoa_id === pesId && x.projeto_id === pid)) return;
    T.alocacoes.push(stamp({ ...DEFAULTS.alocacoes, id: newId(), pessoa_id: pesId, projeto_id: pid, nivel: 1, carga_pct: 25, papel: a.role || null, desde: ymI(a.since), status: ST_ALOC.some(x => x[0] === a.status) ? a.status : 'ativo' }));
    addTarefas(a.tasks, pid, pesId);
  }));
  /* orçamento: linhas antigas → orçamento por rubricas + despesas */
  Object.entries(d.budgets || {}).forEach(([old, b]) => {
    const pid = P[old]; if (!pid) return;
    (b.lines || []).forEach(l => {
      const rub = MAPA_RUBRICA_ANTIGA[l.cat] || '1.5';
      if (!num(l.approved) && !num(l.forecast) && !num(l.executed)) { av.push(`Orçamento: linha "${l.item || '(sem nome)'}" com todos os valores zerados não foi importada.`); return; }
      if (num(l.approved) || num(l.forecast)) {
        let o = T.orcamento_rubricas.find(x => x.projeto_id === pid && x.rubrica === rub);
        if (!o) { o = stamp({ ...DEFAULTS.orcamento_rubricas, id: newId(), projeto_id: pid, rubrica: rub }); T.orcamento_rubricas.push(o); }
        o.aprovado += num(l.approved); o.previsto += num(l.forecast);
      }
      if (num(l.executed)) T.despesas.push(stamp({ id: newId(), projeto_id: pid, rubrica: rub, data: hoje(), descricao: l.item || 'Despesa importada', valor: num(l.executed), obs: 'Importada do programa antigo' }));
    });
    av.push(`Orçamento de ${PR[pid].sigla}: linhas antigas somadas por rubrica do novo plano (ex.: "${(b.lines || [])[0] && (b.lines[0].item || '')}" → ${Calc.rotuloRubrica(MAPA_RUBRICA_ANTIGA[(b.lines || [])[0] && b.lines[0].cat] || '1.5')}). Confira aprovado e previsto.`);
  });
  /* bolsas e pagamentos */
  (d.payments || []).forEach(p => {
    const pesId = PE[(p.personType || 'team') + ':' + p.personId], pid = P[p.projectId];
    if (!pesId || !pid) { av.push(`Pagamento ${p.id}: pessoa ou projeto não encontrado — ignorado.`); return; }
    const pr = PR[pid]; let ini = ymI(p.start), fim = ymF(p.end);
    if (!ini) { ini = pr.inicio; av.push(`Bolsa de ${nomeT(T, pesId)} (${pr.sigla}): início inválido ("${p.start}") — usado o início do projeto.`); }
    if (!fim || fim < ini) { fim = pr.fim; av.push(`Bolsa de ${nomeT(T, pesId)} (${pr.sigla}): fim inválido ("${p.end}") — usado o término do projeto (${fmtD(fim)}). Confira.`); }
    T.vinculos_financeiros.push(stamp({ ...DEFAULTS.vinculos_financeiros, id: newId(), pessoa_id: pesId, projeto_id: pid, tipo: TIPOS_VINC.some(t => t[0] === p.type) ? p.type : 'outro', modalidade: p.rubrica && !/^bolsas?$/i.test(p.rubrica) ? p.rubrica : null, rubrica: p.type === 'tecnico' ? '1.1.2' : '1.1.1', valor_mensal: num(p.value), inicio: ini, fim, status: ST_VINC[p.status] ? p.status : 'previsto', obs: p.note || null }));
  });
  /* prospecção */
  const vistos = new Set();
  (d.prospects || []).forEach(pr => {
    const dec = pr.decision, chave = norm(pr.name) + '|' + (dec ? Math.round(dec.ia) : '') + '|' + pr.date;
    if (vistos.has(chave)) { av.push(`Prospecção "${pr.name}" duplicada (mesma avaliação) — importada uma vez.`); return; }
    vistos.add(chave);
    const id = newId(), sub = pr.submission || {};
    const criado = diaOk(pr.date) ? pr.date + 'T12:00:00.000Z' : agora;
    T.prospeccoes.push({ ...DEFAULTS.prospeccoes, id, nome: String(pr.name || '(sem nome)').trim(), financiador: pr.funder || sub.funder || null, edital: sub.title || null, valor_estimado: num(sub.value) || null,
      objetivo: sub.objective || null, observacoes: sub.notes || null, texto_origem: sub.raw || null, arquivo_origem: sub.sourceFile || null,
      situacao: PIPE[pr.pipeline] ? pr.pipeline : 'avaliacao', projeto_id: P[pr.promotedToId] || null, criado_em: criado, atualizado_em: criado, criado_por: null });
    if (dec) {
      const semNotas = !dec.scores || !Object.keys(dec.scores).length;
      T.avaliacoes.push({ ...DEFAULTS.avaliacoes, id: newId(), prospeccao_id: id, avaliado_em: criado, avaliado_por: null, filtros: dec.filters || {}, notas: dec.scores || {}, esforcos: dec.efforts || {},
        ia: Math.max(0, Math.min(100, num(dec.ia))), ie: Math.max(1, Math.min(5, num(dec.ie) || 1)), ip: num(dec.ip), bloqueada: !!dec.blocked, quadrante: QUAD[dec.quadKey] ? dec.quadKey : null, parecer: semNotas ? 'Importada da matriz antiga (sem notas por critério).' : null });
    }
  });
  T.checklist_itens = checklistPadrao();
  return { T, avisos: av };
}
const nomeT = (T, id) => (T.pessoas.find(p => p.id === id) || {}).nome || '?';

/* ════════════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ════════════════════════════════════════════════════════════════════ */
function telaSimples(html) { document.body.classList.add('no-side'); document.getElementById('side').innerHTML = ''; document.getElementById('app').innerHTML = `<div class="card" style="max-width:520px;margin:60px auto">${html}</div>`; }
function chaveSecreta(k) {
  if (/^sb_secret_/.test(k)) return true;
  try { const p = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.role === 'service_role'; } catch { return false; }
}
let LOGIN_EMAIL = '';
function telaLogin(msg, etapa) {
  const codigo = etapa === 'codigo';
  telaSimples(`<div class="title mb">GPMOT/UFSM — Gestão de Portfólio</div>
    ${codigo ? `<div class="small muted mb">Enviamos um e-mail para <b>${esc(LOGIN_EMAIL)}</b>. Digite abaixo o código que veio nele${location.protocol.startsWith('http') ? ' (ou clique no link do e-mail, neste mesmo navegador)' : ''}.</div>`
      : `<div class="small muted mb">Entre com seu e-mail institucional. Você receberá um código de acesso por e-mail.</div>`}
    ${msg ? `<div class="alert ${codigo ? 'ok' : 'warn'}">${esc(msg)}</div>` : ''}
    ${codigo ? `<label class="fl">Código recebido</label><input id="lg_code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="font-size:20px;letter-spacing:4px">
      <div class="mactions"><button class="btn-s" onclick="telaLogin()">Trocar e-mail</button><button class="btn-s" onclick="enviarLink(true)">Reenviar</button><button class="btn-p" id="lg_ok" onclick="confirmarCodigo()">Entrar</button></div>`
      : `<label class="fl">E-mail</label><input id="lg_email" type="email" placeholder="nome@ufsm.br" value="${esc(LOGIN_EMAIL)}">
      <div class="mactions">${SUPABASE_CONFIG.url ? '' : '<button class="btn-s" onclick="usarLocal()">Usar modo local</button>'}<button class="btn-p" id="lg_env" onclick="enviarLink()">Enviar código</button></div>`}`);
  const f = document.getElementById(codigo ? 'lg_code' : 'lg_email'); if (f) { f.focus(); f.onkeydown = ev => { if (ev.key === 'Enter') codigo ? confirmarCodigo() : enviarLink(); }; }
}
async function enviarLink(reenviar) {
  const email = reenviar ? LOGIN_EMAIL : (document.getElementById('lg_email').value.trim().toLowerCase());
  if (!/^\S+@\S+\.\S+$/.test(email)) { flash('Informe um e-mail válido', true); return; }
  const b = document.getElementById(reenviar ? 'lg_ok' : 'lg_env'); if (b) b.disabled = true;
  const opts = location.protocol.startsWith('http') ? { emailRedirectTo: location.href.split('#')[0] } : {};
  const { error } = await SB.client.auth.signInWithOtp({ email, options: opts });
  if (b) b.disabled = false;
  if (error) { flash(traduzErro(error), true); return; }
  LOGIN_EMAIL = email;
  telaLogin(reenviar ? 'Novo código enviado.' : '', 'codigo');
}
async function confirmarCodigo() {
  const token = (document.getElementById('lg_code').value || '').replace(/\D/g, '');
  if (token.length < 6) { flash('Digite o código completo', true); return; }
  const b = document.getElementById('lg_ok'); if (b) b.disabled = true;
  const { data, error } = await SB.client.auth.verifyOtp({ email: LOGIN_EMAIL, token, type: 'email' });
  if (b) b.disabled = false;
  if (error) { flash(traduzErro(error), true); return; }
  if (data && data.session && !ME.online) await entrarOnline(data.session);
}
function usarLocal() { try { localStorage.removeItem(LS_PREFIX + '_supabase'); } catch { } location.reload(); }
async function entrarOnline(session) {
  ME.online = true; ME.uid = session.user.id; ME.email = session.user.email;
  telaSimples('<div class="small muted">Carregando dados…</div>');
  await SB.loadAll();
  const pf = D.perfis.find(p => p.id === ME.uid);
  if (!pf || !pf.ativo) { telaSimples(`<div class="title mb">Acesso aguardando aprovação</div><div class="small">Seu login (${esc(ME.email)}) foi registrado. A Direção precisa ativar seu acesso e ligá-lo ao seu cadastro.</div><div class="mactions"><button onclick="A.sair()">Sair</button></div>`); return; }
  ME.papel = pf.papel; ME.pessoa_id = pf.pessoa_id;
  try {   // atualização em tempo real (se o Realtime estiver habilitado no Supabase)
    let pend = new Set(), tm = null;
    SB.client.channel('gpmot').on('postgres_changes', { event: '*', schema: 'public' }, p => {
      if (p.table === 'historico') return; pend.add(p.table); clearTimeout(tm);
      tm = setTimeout(async () => { const ts = [...pend]; pend = new Set(); await SB.reload(ts); if (!MODAL) render(); }, 700);
    }).subscribe();
  } catch (e) { console.warn('Realtime indisponível', e); }
  render();
}
async function boot() {
  if (SB.cfg()) {
    try {
      await SB.connect();
      const { data: { session } } = await SB.client.auth.getSession();
      SB.client.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' && s && !ME.online) entrarOnline(s); });
      if (!session) return telaLogin();
      await entrarOnline(session);
    } catch (e) {
      console.error(e);
      telaSimples(`<div class="title mb">Não foi possível conectar ao banco online</div><div class="merr">${esc(traduzErro(e))}</div><div class="mactions"><button onclick="location.reload()">Tentar de novo</button>${SUPABASE_CONFIG.url ? '' : '<button onclick="usarLocal()">Usar modo local</button>'}</div>`);
    }
    return;
  }
  Local.load(); aplicarSim(lerSim()); render();
}
boot();
