
/* ════════════════════════════════════════════════════════════════════
   REFORMULAÇÕES FINANCEIRAS (remanejamento entre rubricas e itens, desembolso)
   Leitor da "Solicitação de Reformulação Financeira" do SIGITEC (Petrobras) → reformulação padrão:
     { numero, situacaoDoc, data, justificativa, naturezas[{nome, vigente, proposto, diferenca, rubrica}],
       itens[{categoria, natureza, origem, numero, descricao, operacao I/E/A/R, vig{qtd,unit,valor,aplic}, prop{...}, justificativa}],
       proposto (plano completo proposto: itens, naturezas, desembolso), conferencias[], avisos[] }
   A prévia compara com o que está no sistema; registrar como "submetida" não muda o orçamento;
   "aprovada" aplica: aprovado por rubrica, itens do plano de aplicação e distribuição do desembolso.
   ════════════════════════════════════════════════════════════════════ */
async function lerReformulacaoSIGITEC(buf, nomeArquivo, inflar) {
  const pags = await lerPDF(buf, inflar);
  const todas = linhasPDF(pags);
  if (!todas.some(l => /DIFEREN[CÇ]AS DE OR[CÇ]AMENTO/i.test(l.txt))) falha('Este PDF não traz o quadro "Diferenças de orçamento" de uma Solicitação de Reformulação/Aditivo do SIGITEC.');
  const lixo = l => /^(PETROBRAS|SIGITEC - Gest[aã]o de Investimentos em Tecnologia)$/i.test(l.txt) || /^P[aá]gina \d+ de \d+$/i.test(l.txt) || /^\*Opera[cç][oõ]es$/.test(l.txt) || /^I: Inclus/.test(l.txt);
  const L = todas.filter(l => !lixo(l)), cab = l => /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(l.txt);
  const idx = (re, de = 0) => { for (let i = de; i < L.length; i++) if (re.test(L[i].txt)) return i; return -1; };
  const campo = re => { const i = idx(re); if (i < 0) return ''; const l = L[i]; return juntaTxt(l.its.filter(t => t.x >= 140).map(t => t.s)); };
  const R = { formato: 'Solicitação de Reformulação Financeira — SIGITEC (PDF)', arquivo: nomeArquivo, paginas: pags.length, avisos: [], conferencias: [] };
  R.processo = campo(/^Processo \S/);
  { const i = idx(/^Tipo da Solicita[cç][aã]o/); const t = i >= 0 ? juntaTxt(L.slice(i, i + 3).flatMap(l => l.its.filter(x => x.x >= 140).map(x => x.s))) : '';
    R.tipoSolicitacao = t; R.numero = parseInt((t.match(/(\d+)\s*(Inicial|Final|Complementar)?\s*$/i) || [])[1], 10) || null; }
  R.situacaoDoc = campo(/^Situa[cç][aã]o \S/) ; { const ss = L.filter(l => /^Situa[cç][aã]o \S/.test(l.txt)).map(l => juntaTxt(l.its.filter(t => t.x >= 140).map(t => t.s))); R.situacaoDoc = ss[ss.length - 1] || ''; }
  { const d = (campo(/^Data da submiss[aã]o/).match(/(\d{2})\/(\d{2})\/(\d{4})/) || []); R.data = d.length ? `${d[3]}-${d[2]}-${d[1]}` : null; }
  R.elaboradaPor = campo(/^Elaborada por/); R.vigencia = campo(/^Vig[eê]ncia/);
  /* justificativa técnica */
  { const a = idx(/^JUSTIFICATIVA T[EÉ]CNICA/), b = idx(/^DIFEREN[CÇ]AS DE OR[CÇ]AMENTO/, a + 1);
    R.justificativa = a < 0 ? '' : L.slice(a + 1, b < 0 ? L.length : b).filter(l => !cab(l)).map(l => l.txt.replace(/^Justificativa:\s*/, '')).join('\n').replace(/([^.:;\n])\n(?=[a-zà-ú])/g, '$1 ').trim(); }
  /* resumo por natureza */
  const iRes = idx(/^Resumo do Or[cç]amento/), iDet = idx(/^Detalhamento dos Recursos/, iRes + 1);
  R.naturezas = []; R.declarado = {};
  for (const l of L.slice(iRes + 1, iDet)) { const t = l.its.map(x => x.s.trim()).filter(Boolean), iv = t.findIndex(ehValorBR); if (iv < 1 || t.length - iv < 3) continue;
    const nome = juntaTxt(t.slice(0, iv)), [vg, pr, df] = t.slice(iv, iv + 3).map(valorBR);
    if (/^total geral$/i.test(nome)) R.declarado = { vigente: vg, proposto: pr, diferenca: df };
    else if (!/^total$/i.test(nome)) R.naturezas.push({ nome, vigente: vg, proposto: pr, diferenca: df, rubrica: rubricaDaNatureza(nome) }); }
  if (!R.naturezas.length) R.avisos.push('Não encontrei o "Resumo do Orçamento" (vigente × proposto) nas Diferenças de orçamento.');
  /* itens incluídos, excluídos ou alterados */
  R.itens = []; R.equipe = [];
  { const iFim = idx(/^JUSTIFICATIVA DAS ALTERA/, iDet + 1); let modo = 'itens', thr = 280, cat = '', atual = null;
    const qtd = v => v === '-' || v == null || v === '' ? null : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    for (const l of L.slice(iDet, iFim < 0 ? L.length : iFim)) {
      if (cab(l) || /^(Recurso|Valores|N[º°o]|Encargos|Benef[ií]cios)\b/.test(l.txt) || /^Vigente|^Proposto/.test(l.txt)) continue;
      if (/^Detalhamento dos Recursos/.test(l.txt)) { modo = /Equipe Executora/i.test(l.txt) ? 'equipe' : 'itens'; atual = null; continue; }
      const hq = l.its.filter(t => /^(Qtd\.|Per[ií]odo)$/.test(t.s.trim())); if (hq.length >= 2) { thr = Math.min(...hq.map(t => t.x)) - 8; continue; }
      if (/^Nenhum recurso alterado/.test(l.txt)) continue;
      const t0 = l.its[0].s.trim();
      if (/^\d+$/.test(t0) && l.its[0].x < 75) {
        const desc = juntaTxt(l.its.slice(1).filter(t => t.x < thr).map(t => t.s)), vals = l.its.filter(t => t.x >= thr).map(t => t.s.trim()).filter(Boolean);
        const op = /^[IEAR]$/.test(vals[vals.length - 1] || '') ? vals.pop() : '';
        let it;
        if (modo === 'equipe') { const n = vals.map(v => v === '-' ? null : ehValorBR(v) ? valorBR(v) : qtd(v));
          const g = k => ({ per: n[k] || 0, unit: n[k + 1] || 0, enc: n[k + 2] || 0, valor: r2((n[k] || 0) * (n[k + 1] || 0) + (n[k + 2] || 0)) });
          it = { tipo: 'equipe', categoria: 'Equipe Executora', numero: +t0, descricao: desc, operacao: op, vig: g(0), vigAplic: g(3), prop: g(6), propAplic: g(9) };
          R.equipe.push(it); }
        else { const n = vals.map(v => v === '-' ? '-' : v); while (n.length < 8) n.push('-');
          const g = k => { const q = qtd(n[k]), u = valorBR(n[k + 1]) || 0; return { qtd: q, unit: u, valor: r2((q == null ? 1 : q) * u) }; };
          const vig = g(0), va = g(2), prop = g(4), pa = g(6);
          it = { tipo: 'item', categoria: cat, numero: +t0, descricao: desc, operacao: op, vig: { ...vig, aplic: va.valor }, prop: { ...prop, aplic: pa.valor } };
          R.itens.push(it); }
        atual = it; continue;
      }
      if (!l.its.some(t => ehValorBR(t.s.trim())) && l.its[0].x < 60 && !/^\d/.test(t0)) { cat = l.txt.trim(); atual = null; continue; }   // "Material de Consumo - Nacional"
      if (atual && l.its[0].x >= 60) atual.descricao = juntaTxt([atual.descricao, ...l.its.filter(t => t.x < thr).map(t => t.s)]);
    } }
  /* justificativas de cada item */
  { const a = idx(/^JUSTIFICATIVA DAS ALTERA/); R.semValor = [];
    if (a >= 0) { const sec = L.slice(a + 1).filter(l => !cab(l) && !/^N[º°o] Descri/.test(l.txt)), corte = corteColuna(sec.filter(l => l.its.length > 1 || l.its[0].x > 300));
      let cat = '', atual = null; const just = [];
      for (const l of sec) {
        const t0 = l.its[0].s.trim(), esq = l.its.filter(t => t.x < corte), dir = l.its.filter(t => t.x >= corte);
        if (/^\d+$/.test(t0) && l.its[0].x < 60) { atual = { categoria: cat, numero: +t0, descricao: juntaTxt(esq.slice(1).map(t => t.s)), texto: [juntaTxt(dir.map(t => t.s))] }; just.push(atual); continue; }
        if (!dir.length && l.its[0].x < 60 && !atual?.descricao?.endsWith('-') && /^[A-ZÁÉÍÓÚÇ]/.test(t0) && / - |^(Material|Servi|Equipamento|Passage|Di[aá]ria|Outr|Equipe|Obras)/.test(l.txt)) { cat = l.txt.trim(); atual = null; continue; }
        if (atual) { if (esq.length) atual.descricao = juntaTxt([atual.descricao, ...esq.map(t => t.s)]); if (dir.length) atual.texto.push(juntaTxt(dir.map(t => t.s))); }
      }
      just.forEach(j => { j.texto = juntaTxt(j.texto.filter(Boolean));
        const it = R.itens.find(i => nrmPT(i.categoria) === nrmPT(j.categoria) && i.numero === j.numero) || R.equipe.find(i => i.numero === j.numero && /equipe/i.test(j.categoria));
        if (it) it.justificativa = j.texto; else R.semValor.push(j); }); } }
  /* o orçamento completo proposto (mesmas seções de um plano de trabalho) */
  R.proposto = await lerPlanoSIGITEC(null, nomeArquivo, inflar, { pags, reformulacao: true });
  /* natureza de cada item: categoria "Material de Consumo - Nacional" → "Material de Consumo" */
  const casaNat = c => { const a = nrmPT(String(c).split(/\s+-\s+/)[0]); return R.naturezas.find(n => nrmPT(n.nome) === a) || R.naturezas.find(n => nrmPT(n.nome).startsWith(a) || a.startsWith(nrmPT(n.nome))) || R.naturezas.find(n => nrmPT(n.nome).split(' ')[0] === a.split(' ')[0]); };
  R.itens.forEach(i => { const n = casaNat(i.categoria); i.natureza = n ? n.nome : i.categoria.split(/\s+-\s+/)[0]; i.origem = /importad/i.test(i.categoria) ? 'importado' : 'nacional'; });
  /* conferências */
  const ok = (c, t) => R.conferencias.push({ ok: !!c, txt: t }), eq = (a, b) => Math.abs(r2(a) - r2(b)) < 0.02;
  R.naturezas.forEach(n => ok(eq(n.vigente + n.diferenca, n.proposto), `${n.nome}: vigente ${fmtBRL2(n.vigente)} ${n.diferenca >= 0 ? '+' : '−'} ${fmtBRL2(Math.abs(n.diferenca))} = proposto ${fmtBRL2(n.proposto)}`));
  { const sv = R.naturezas.reduce((t, n) => t + n.vigente, 0), sp = R.naturezas.reduce((t, n) => t + n.proposto, 0);
    ok(R.declarado.proposto == null || (eq(sv, R.declarado.vigente) && eq(sp, R.declarado.proposto)), `Total geral: vigente ${fmtBRL2(sv)} → proposto ${fmtBRL2(sp)}`); }
  R.naturezas.forEach(n => { const its = R.itens.filter(i => i.natureza === n.nome), eqp = /equipe/i.test(n.nome) ? R.equipe : [];
    const d = its.reduce((t, i) => t + i.prop.valor - i.vig.valor, 0) + eqp.reduce((t, i) => t + i.prop.valor - i.vig.valor, 0);
    if (its.length || eqp.length || Math.abs(n.diferenca) >= 0.01) ok(eq(d, n.diferenca), `${n.nome}: itens alterados somam ${d >= 0 ? '+' : '−'}${fmtBRL2(Math.abs(d))} = diferença ${fmtBRL2(n.diferenca)}`); });
  R.naturezas.forEach(n => { const pn = (R.proposto.naturezas || []).find(x => nrmPT(x.nome) === nrmPT(n.nome)); if (pn) ok(eq(pn.valor, n.proposto), `${n.nome}: orçamento proposto completo ${fmtBRL2(pn.valor)} = resumo ${fmtBRL2(n.proposto)}`); });
  (R.proposto.conferencias || []).filter(c => /Relação|itens|Desembolso|Naturezas/i.test(c.txt) && !/atividades|Matriz|Detalhamento/i.test(c.txt)).forEach(c => R.conferencias.push({ ok: c.ok, txt: 'Orçamento proposto — ' + c.txt }));
  R.rendimentos = r2(R.itens.reduce((t, i) => t + (i.prop.aplic || 0) - (i.vig.aplic || 0), 0));
  R.remanejado = r2(R.naturezas.reduce((t, n) => t + Math.max(0, n.diferenca), 0));
  if (R.rendimentos) R.avisos.push(`A solicitação usa ${fmtBRL2(R.rendimentos)} de rendimentos de aplicação financeira (além do total do convênio).`);
  if (R.declarado.diferenca && Math.abs(R.declarado.diferenca) >= 0.01) R.avisos.push(`O total geral muda (${fmtBRL2(R.declarado.diferenca)}): registre também o aditivo de valor em Contrato e aditivos.`);
  if (R.equipe.length) R.avisos.push(`${R.equipe.length} alteração(ões) de bolsas da equipe executora: o total da rubrica é atualizado; confira as bolsas em Equipe.`);
  return R;
}

/* ── reformulação padrão do GPMOT em JSON (qualquer financiador) ─────────────
   { "formato": "gpmot-reformulacao-1", "numero": 5, "data": "2026-09-29", "documento": "...", "justificativa": "...",
     "naturezas": [{ "nome": "Material de Consumo", "rubrica": "1.3", "vigente": 2993457.76, "proposto": 2815072.39 }],
     "itens": [{ "operacao": "I|E|A", "natureza": "Serviços de Terceiros", "descricao": "...", "origem": "nacional",
                 "vigente": { "quantidade": 1, "valor_unitario": 0, "valor": 0 }, "proposto": { "quantidade": 1, "valor_unitario": 48000, "valor": 48000, "aplicacao": 0 },
                 "justificativa": "..." }],
     "orcamento_proposto": { …plano padrão "gpmot-plano-1" com o orçamento completo depois da reformulação (opcional)… } } */
function lerReformulacaoPadrao(o, nomeArquivo) {
  if (!o || o.formato !== 'gpmot-reformulacao-1') falha('Este JSON não está no formato "gpmot-reformulacao-1" (reformulação padrão do GPMOT).');
  const txt = v => v == null ? '' : String(v).trim(), n = v => v == null || v === '' ? 0 : r2(Number(v) || 0), nq = v => v == null || v === '' ? null : Number(v);
  const R = { formato: 'Reformulação padrão GPMOT (JSON)', arquivo: nomeArquivo, avisos: [], conferencias: [], numero: parseInt(o.numero, 10) || null, data: /^\d{4}-\d{2}-\d{2}$/.test(txt(o.data)) ? txt(o.data) : null,
    tipoSolicitacao: txt(o.tipo) || 'Reformulação financeira', situacaoDoc: txt(o.situacao_documento), processo: txt(o.processo), elaboradaPor: txt(o.elaborada_por), justificativa: txt(o.justificativa), documento: txt(o.documento), equipe: [], semValor: [] };
  R.naturezas = (o.naturezas || []).map(x => { const vg = n(x.vigente), pr = n(x.proposto); return { nome: txt(x.nome || x.rubrica), vigente: vg, proposto: pr, diferenca: r2(pr - vg), rubrica: /^\d+(\.\d+)*$/.test(txt(x.rubrica)) ? txt(x.rubrica) : rubricaDaNatureza(txt(x.nome)) }; });
  R.declarado = { vigente: r2(R.naturezas.reduce((t, x) => t + x.vigente, 0)), proposto: r2(R.naturezas.reduce((t, x) => t + x.proposto, 0)) }; R.declarado.diferenca = r2(R.declarado.proposto - R.declarado.vigente);
  const g = x => ({ qtd: nq((x || {}).quantidade), unit: n((x || {}).valor_unitario), valor: (x || {}).valor != null ? n(x.valor) : r2((nq((x || {}).quantidade) ?? 1) * n((x || {}).valor_unitario)), aplic: n((x || {}).aplicacao) });
  R.itens = (o.itens || []).map((x, i) => { const op = txt(x.operacao).toUpperCase().slice(0, 1); const nat = txt(x.natureza) || (R.naturezas.find(z => z.rubrica === txt(x.rubrica)) || {}).nome || txt(x.rubrica);
    return { tipo: 'item', categoria: nat, natureza: nat, rubricaDoc: /^\d+(\.\d+)*$/.test(txt(x.rubrica)) ? txt(x.rubrica) : null, origem: /import/i.test(txt(x.origem)) ? 'importado' : 'nacional', numero: parseInt(x.numero, 10) || i + 1, descricao: txt(x.descricao),
      operacao: ['I', 'E', 'A'].includes(op) ? op : 'A', vig: g(x.vigente), prop: op === 'E' ? { qtd: null, unit: 0, valor: 0, aplic: 0 } : g(x.proposto), justificativa: txt(x.justificativa) }; });
  R.itens.filter(i => !i.descricao).forEach(() => R.avisos.push('Há item sem descrição no JSON.'));
  R.proposto = o.orcamento_proposto ? lerPlanoPadrao(o.orcamento_proposto, nomeArquivo) : { itens: [], naturezas: [], desembolso: null, conferencias: [] };
  if (R.proposto.naturezas && R.proposto.naturezas.length) aplicarNaturezas(R.proposto);
  conferirReformulacao(R);
  return R;
}
/* conferências comuns (JSON); o leitor do SIGITEC tem as suas, mais completas */
function conferirReformulacao(R) {
  const ok = (c, t) => R.conferencias.push({ ok: !!c, txt: t }), eq = (a, b) => Math.abs(r2(a) - r2(b)) < 0.02;
  R.naturezas.forEach(nt => { const its = R.itens.filter(i => nrmPT(i.natureza) === nrmPT(nt.nome)); const d = its.reduce((t, i) => t + i.prop.valor - i.vig.valor, 0);
    if (its.length || Math.abs(nt.diferenca) >= 0.01) ok(eq(d, nt.diferenca), `${nt.nome}: itens alterados somam ${d >= 0 ? '+' : '−'}${fmtBRL2(Math.abs(d))} = diferença ${fmtBRL2(nt.diferenca)}`); });
  R.itens.filter(i => !R.naturezas.some(nt => nrmPT(nt.nome) === nrmPT(i.natureza)) && !i.rubricaDoc).forEach(i => ok(false, `Item "${i.descricao}": natureza "${i.natureza}" não está entre as naturezas do resumo`));
  R.rendimentos = r2(R.itens.reduce((t, i) => t + (i.prop.aplic || 0) - (i.vig.aplic || 0), 0));
  R.remanejado = r2(R.naturezas.reduce((t, x) => t + Math.max(0, x.diferenca), 0));
  if (R.rendimentos) R.avisos.push(`A solicitação usa ${fmtBRL2(R.rendimentos)} de rendimentos de aplicação financeira (além do total do convênio).`);
  if (Math.abs(R.declarado.diferenca || 0) >= 0.01) R.avisos.push(`O total geral muda (${fmtBRL2(R.declarado.diferenca)}): registre também o aditivo de valor em Contrato e aditivos.`);
}
function reformulacaoParaPadrao(R) {
  const v = x => ({ quantidade: x.qtd ?? null, valor_unitario: x.unit || 0, valor: x.valor || 0, ...(x.aplic ? { aplicacao: x.aplic } : {}) });
  return { formato: 'gpmot-reformulacao-1', gerado_de: R.arquivo || null, numero: R.numero, data: R.data, tipo: R.tipoSolicitacao || null, processo: R.processo || null, elaborada_por: R.elaboradaPor || null, justificativa: R.justificativa || '',
    naturezas: R.naturezas.map(x => ({ nome: x.nome, rubrica: x.rubrica || null, vigente: x.vigente, proposto: x.proposto })),
    itens: R.itens.map(i => ({ operacao: i.operacao, natureza: i.natureza, origem: i.origem, numero: i.numero, descricao: i.descricao, vigente: v(i.vig), proposto: v(i.prop), justificativa: i.justificativa || '' })),
    ...(R.proposto && (R.proposto.itens || []).length ? { orcamento_proposto: planoParaPadrao(R.proposto) } : {}) };
}
const LEITORES_REFORMULACAO = [
  { nome: 'Solicitação de Reformulação Financeira do SIGITEC/Petrobras (.pdf)', ext: /\.pdf$/i, ler: async f => lerReformulacaoSIGITEC(await f.arrayBuffer(), f.name) },
  { nome: 'Reformulação padrão do GPMOT (.json)', ext: /\.json$/i, ler: async f => { let o; try { o = JSON.parse(await f.text()); } catch { falha('O arquivo .json está com erro de formatação.'); } return lerReformulacaoPadrao(o, f.name); } }];
async function lerReformulacao(f) {
  const l = LEITORES_REFORMULACAO.find(x => x.ext.test(f.name));
  if (!l) falha('Formato não reconhecido. Aceitos: ' + LEITORES_REFORMULACAO.map(x => x.nome).join('; ') + '. Para outros financiadores, converta a solicitação para a reformulação padrão (.json) — veja o README.');
  return l.ler(f);
}

/* ── comparação com o sistema ─────────────────────────────────────────────── */
const chaveItem = s => nrmPT(s).replace(/[^a-z0-9]+/g, ' ').trim();
function acharItemPlano(pid, rubrica, descricao, origem, usados = new Set(), qualquer = false) {
  const k = chaveItem(descricao); if (!k) return null;
  if (qualquer) return acharItemPlano(pid, rubrica, descricao, origem, usados) || (() => {   // mesmo item lançado em outra rubrica (mapa natureza → rubrica mudou)
    const l = D.plano_itens.filter(x => x.projeto_id === pid && x.rubrica !== rubrica && !usados.has(x.id) && chaveItem(x.descricao) === k);
    return l.find(x => x.status !== 'cancelado' && (x.origem || 'nacional') === origem) || l.find(x => x.status !== 'cancelado') || l[0] || null; })();
  const c = D.plano_itens.filter(x => x.projeto_id === pid && x.rubrica === rubrica && !usados.has(x.id));
  const iguais = c.filter(x => chaveItem(x.descricao) === k);
  const pref = l => l.find(x => x.status !== 'cancelado' && (x.origem || 'nacional') === origem) || l.find(x => x.status !== 'cancelado') || l.find(x => (x.origem || 'nacional') === origem) || l[0] || null;
  if (iguais.length) return pref(iguais);
  if (k.length < 16) return null;
  return pref(c.filter(x => { const kx = chaveItem(x.descricao); return kx.length >= 16 && (kx.startsWith(k) || k.startsWith(kx)); }));
}
/* monta o retrato completo da reformulação (o que fica gravado em "alteracoes") a partir do lido + mapa natureza→rubrica */
function retratoReformulacao(R, p) {
  const rubDe = nome => { const x = R.naturezas.find(z => nrmPT(z.nome) === nrmPT(nome)); return x ? x.rubrica : rubricaDaNatureza(nome); };
  const aplicDe = new Map();   // rendimentos por item (chave rubrica|descrição)
  const itens = R.itens.map(i => { const rubrica = i.rubricaDoc || rubDe(i.natureza);
    if (i.prop.aplic) aplicDe.set(rubrica + '|' + chaveItem(i.descricao), i.prop.aplic);
    return { op: i.operacao, rubrica, natureza: i.natureza, origem: i.origem || 'nacional', numero: i.numero, descricao: i.descricao, vig: i.vig, prop: i.prop, justificativa: i.justificativa || '' }; });
  const rubricas = {}; R.naturezas.forEach(n => { if (!n.rubrica) return; const r = rubricas[n.rubrica] = rubricas[n.rubrica] || { rubrica: n.rubrica, naturezas: [], vigente: 0, proposto: 0, rendimentos: 0 };
    r.naturezas.push(n.nome); r.vigente = r2(r.vigente + n.vigente); r.proposto = r2(r.proposto + n.proposto); });
  itens.forEach(i => { const d = r2((i.prop.aplic || 0) - (i.vig.aplic || 0)); if (d && rubricas[i.rubrica]) rubricas[i.rubrica].rendimentos = r2(rubricas[i.rubrica].rendimentos + d); });
  Object.values(rubricas).forEach(r => { r.diferenca = r2(r.proposto - r.vigente); const ex = D.orcamento_rubricas.find(x => x.projeto_id === p.id && x.rubrica === r.rubrica); r.sistema = ex ? num(ex.aprovado) : 0; });
  const pr = R.proposto || {}; if (pr.naturezas && pr.naturezas.length) { pr.naturezas.forEach(n => { n.rubrica = rubDe(n.nome); }); aplicarNaturezas(pr); }
  const propostos = (pr.itens || []).filter(i => i.rubrica).map(i => ({ rubrica: i.rubrica, natureza: i.natureza || null, origem: i.origem || 'nacional', descricao: i.descricao, quantidade: i.quantidade ?? null, valor_unitario: i.valor_unitario ?? null,
    moeda: i.moeda || 'BRL', cambio: i.cambio ?? null, detalhe: i.detalhe || null, justificativa: i.justificativa || null, valor: r2(i.valor_previsto || 0), aplic: aplicDe.get(i.rubrica + '|' + chaveItem(i.descricao)) || 0 }));
  const desembolso = pr.desembolso ? pr.desembolso.parcelas.map(x => ({ numero: x.numero, mes: x.mes || null, valor: x.valor, dist: x.dist || {} })) : [];
  return { documento: { arquivo: R.arquivo || null, formato: R.formato || null, processo: R.processo || null, tipo: R.tipoSolicitacao || null, situacao: R.situacaoDoc || null, elaborada_por: R.elaboradaPor || null },
    naturezas: R.naturezas.map(n => ({ nome: n.nome, rubrica: n.rubrica || null, vigente: n.vigente, proposto: n.proposto, diferenca: n.diferenca })),
    rubricas: Object.values(rubricas).sort((a, b) => Calc.codCmp(a.rubrica, b.rubrica)), itens, equipe: (R.equipe || []).map(e => ({ op: e.operacao, numero: e.numero, descricao: e.descricao, vig: e.vig.valor, prop: e.prop.valor, justificativa: e.justificativa || '' })),
    propostos, desembolso, conferencias: { total: (R.conferencias || []).length, divergencias: (R.conferencias || []).filter(c => !c.ok).map(c => c.txt) }, avisos: R.avisos || [] };
}
/* situação de cada item da solicitação frente ao plano de aplicação do sistema */
function compararItens(alt, pid) {
  const usados = new Set();
  return alt.itens.map(i => { const ex = acharItemPlano(pid, i.rubrica, i.descricao, i.origem, usados, true); if (ex) usados.add(ex.id);
    const vs = ex ? num(ex.valor_previsto) : null;
    const sit = i.op === 'I' ? (ex && ex.status !== 'cancelado' ? 'existe' : 'novo') : !ex ? 'falta' : Math.abs(vs - i.vig.valor) >= 0.01 ? 'difere' : 'ok';
    return { i, ex, sit }; });
}
/* o que a sincronização com o orçamento completo proposto faria */
function planoSincronizacao(alt, pid) {
  const usados = new Set(), upd = [], ins = [], canc = [], travados = [];
  const rubs = new Set(alt.propostos.map(x => x.rubrica));
  alt.propostos.forEach(x => { const ex = acharItemPlano(pid, x.rubrica, x.descricao, x.origem, usados, true), zero = (x.valor || 0) + (x.aplic || 0) < 0.005;   // o SIGITEC mantém os excluídos com valor zero
    if (ex) { if (!zero) { usados.add(ex.id); upd.push({ x, ex }); } } else if (!zero) ins.push(x); });
  D.plano_itens.filter(i => i.projeto_id === pid && rubs.has(i.rubrica) && !usados.has(i.id) && i.status !== 'cancelado').forEach(i => (i.status === 'previsto' ? canc : travados).push(i));
  return { upd, ins, canc, travados, mudam: upd.filter(({ x, ex }) => Math.abs(num(ex.valor_previsto) - x.valor - (x.aplic || 0)) >= 0.01 || ex.status === 'cancelado' || ex.rubrica !== x.rubrica), movem: upd.filter(({ x, ex }) => ex.rubrica !== x.rubrica) };
}

/* ── tela: Financeiro do projeto → Reformulações ──────────────────────────── */
const SIT_REFORM = { rascunho: ['Rascunho', 'b-gray'], submetida: ['Submetida', 'b-yellow'], aprovada: ['Aprovada', 'b-green'], rejeitada: ['Rejeitada', 'b-red'] };
function finReformulacoes(p) {
  const pode = Perm.reformulaFin(p.id), lista = D.reformulacoes.filter(r => r.projeto_id === p.id).sort((a, b) => String(b.data).localeCompare(String(a.data)) || (num(b.numero) - num(a.numero)));
  const conta = r => { const its = ((r.alteracoes || {}).itens || []); return ['I', 'E', 'A'].map(o => [o, its.filter(i => i.op === o).length]).filter(([, n]) => n).map(([o, n]) => `${n} ${o === 'I' ? 'incl.' : o === 'E' ? 'excl.' : 'alter.'}`).join(' · '); };
  return `<div class="card">
    <div class="between mb"><div><span class="bold">Reformulações financeiras (${lista.length})</span><div class="small muted">Remanejamentos entre rubricas e itens solicitados ao financiador. A solicitação fica registrada; o orçamento, o plano de aplicação e o desembolso só mudam quando ela é aprovada e aplicada.</div></div>
      ${pode ? `<button class="btn-p" data-a="refImportar" data-projeto="${p.id}">Importar solicitação de reformulação…</button>` : ''}</div>
    ${lista.length ? `<div class="tw"><table class="t"><tr><th>Nº</th><th>Data</th><th>Situação</th><th class="num">Remanejado</th><th class="num">Rendimentos</th><th>Itens</th><th>Registrada por</th><th>Aplicada</th></tr>
      ${lista.map(r => { const s = SIT_REFORM[r.situacao] || [r.situacao, 'b-gray']; return `<tr class="click" data-a="refVer" data-id="${r.id}"><td><b>${r.numero ? esc(r.numero) + 'ª' : '—'}</b></td><td>${fmtD(r.data)}</td><td>${badge(s[0], s[1])}</td>
        <td class="num">${fmtBRL2(r.remanejado)}</td><td class="num">${num(r.rendimentos) ? fmtBRL2(r.rendimentos) : '<span class="faint">—</span>'}</td><td class="small">${esc(conta(r) || '—')}</td><td class="small">${esc(r.autor || '—')}</td>
        <td class="small">${r.aplicada_em ? fmtD(String(r.aplicada_em).slice(0, 10)) : '<span class="faint">não</span>'}</td></tr>`; }).join('')}</table></div>`
      : `<div class="empty">Nenhuma reformulação registrada.${pode ? ' Carregue o PDF da solicitação enviada ao financiador (SIGITEC) ou uma reformulação padrão (.json).' : ''}</div>`}</div>`;
}
A.refImportar = d => {
  const p = byId('projetos', d.projeto); if (!p || !Perm.reformulaFin(p.id)) falha('Você não tem permissão para registrar reformulações financeiras deste projeto.');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,.json';
  inp.onchange = () => run(async () => { const f = inp.files[0]; if (!f) return; flash('Lendo a solicitação de reformulação…'); const R = await lerReformulacao(f); previaReformulacao(R, p.id); });
  inp.click();
};
const opBadge = o => o === 'I' ? badge('Inclusão', 'b-green') : o === 'E' ? badge('Exclusão', 'b-red') : o === 'A' ? badge('Alteração', 'b-blue') : badge(o || '?', 'b-gray');
const sitItem = c => ({ ok: '<span style="color:var(--green)">✓ confere</span>', difere: `<span style="color:var(--yellow-txt)">⚠ no sistema ${fmtBRL2(c.ex && c.ex.valor_previsto)}</span>`, falta: '<span style="color:var(--red)">✗ não encontrado no plano</span>',
  novo: '<span style="color:var(--blue)">será incluído</span>', existe: '<span style="color:var(--yellow-txt)">⚠ já existe no plano</span>' })[c.sit] + (c.ex ? `<div class="faint">item nº ${esc(c.ex.numero)}${c.ex.status === 'cancelado' ? ' (cancelado)' : ''}</div>` : '');
function previaReformulacao(R, pid) {
  const p = byId('projetos', pid), alt = retratoReformulacao(R, p), cmp = compararItens(alt, pid), sinc = planoSincronizacao(alt, pid);
  const pend = (R.conferencias || []).filter(c => !c.ok), nomeR = c => (Calc.plano(p).find(r => r.codigo === c) || {}).nome || '';
  const folhas = Calc.folhas(p);
  const divRub = alt.rubricas.filter(r => Math.abs(r.sistema - r.vigente) >= 0.01), divIt = cmp.filter(c => c.sit !== 'ok' && c.sit !== 'novo');
  const temProposto = alt.propostos.length > 0, sugereSinc = temProposto && (divRub.length > 0 || divIt.length > 0);
  const jaReg = D.reformulacoes.find(r => r.projeto_id === pid && R.numero && num(r.numero) === R.numero && r.situacao !== 'rejeitada');
  const html = `<div class="between mb"><h3 style="margin:0">Reformulação financeira — ${esc(p.sigla)}</h3><button class="btn-s" id="rf_x">✕</button></div>
  <div class="note mb small">Arquivo: <b>${esc(R.arquivo)}</b> · ${esc(R.formato || '')}${R.paginas ? ' · ' + R.paginas + ' páginas' : ''}. Nada é gravado até clicar em “Registrar”.
    ${R.avisos.length ? '<br>' + R.avisos.map(a => '⚠ ' + esc(a)).join('<br>') : ''}${jaReg ? `<br><b style="color:var(--yellow-txt)">⚠ A ${esc(R.numero)}ª reformulação já está registrada neste projeto (${esc((SIT_REFORM[jaReg.situacao] || [jaReg.situacao])[0])}).</b>` : ''}</div>
  ${(R.conferencias || []).length ? `<details class="mb" ${pend.length ? 'open' : ''}><summary class="small"><b>Conferências do documento:</b> ${pend.length ? `<span style="color:var(--red)">${pend.length} divergência(s)</span>` : `<span style="color:var(--green)">todas as ${R.conferencias.length} conferem</span>`}</summary>
    <div class="small" style="padding:4px 0 0 14px">${R.conferencias.map(c => `<div>${c.ok ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>'} ${esc(c.txt)}</div>`).join('')}</div></details>` : ''}
  <div class="kv mb small"><span class="k">Solicitação</span><span><b>${R.numero ? esc(R.numero) + 'ª ' : ''}${esc((R.tipoSolicitacao || 'Reformulação financeira').replace(/\s*\d+\s*(Inicial|Final|Complementar)?\s*$/i, ''))}</b></span>
    <span class="k">Processo</span><span>${esc(R.processo || '—')}</span><span class="k">Submissão</span><span>${R.data ? fmtD(R.data) : '—'}${R.situacaoDoc ? ' · ' + esc(R.situacaoDoc) : ''}</span>
    <span class="k">Elaborada por</span><span>${esc(R.elaboradaPor || '—')}</span><span class="k">Remanejado</span><span><b>${fmtBRL2(R.remanejado)}</b>${R.rendimentos ? ` + rendimentos de aplicação <b>${fmtBRL2(R.rendimentos)}</b>` : ''}</span></div>
  ${R.justificativa ? `<details class="mb"><summary class="small"><b>Justificativa técnica</b></summary><div class="small" style="white-space:pre-line;padding:4px 0 0 14px">${esc(R.justificativa)}</div></details>` : ''}
  <div class="sec" style="margin-top:0">1 · Remanejamento por rubrica</div>
  <div class="small muted mb">Natureza de despesa do financiador → rubrica do GPMOT (troque se necessário). “No sistema” é o aprovado hoje; deve ser igual ao vigente do documento.</div>
  <div class="tw mb"><table class="t small"><tr><th>Natureza no documento</th><th class="num">Vigente</th><th class="num">Proposto</th><th class="num">Diferença</th><th>Rubrica GPMOT</th></tr>${R.naturezas.map((nt, k) => `<tr${Math.abs(nt.diferenca) >= 0.01 ? ' style="font-weight:600"' : ''}><td>${esc(nt.nome)}</td><td class="num">${fmtBRL2(nt.vigente)}</td><td class="num">${fmtBRL2(nt.proposto)}</td>
    <td class="num" style="color:${nt.diferenca < -0.005 ? 'var(--red)' : nt.diferenca > 0.005 ? 'var(--green)' : 'inherit'}">${Math.abs(nt.diferenca) >= 0.01 ? (nt.diferenca > 0 ? '+' : '−') + fmtBRL2(Math.abs(nt.diferenca)) : '—'}</td>
    <td><select class="rf-nat" data-i="${k}"><option value="">— não mapear —</option>${folhas.map(r => `<option value="${esc(r.codigo)}"${r.codigo === nt.rubrica ? ' selected' : ''}>${esc(r.codigo)} ${esc(r.nome)}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
  <div class="tw mb"><table class="t small"><tr><th>Rubrica</th><th class="num">No sistema (aprovado)</th><th class="num">Vigente no documento</th><th class="num">Proposto</th><th class="num">Fica aprovado</th>${R.rendimentos ? '<th class="num">Rendimentos (à parte)</th>' : ''}</tr>
    ${alt.rubricas.map(r => `<tr><td><b>${esc(r.rubrica)}</b> <span class="muted">${esc(nomeR(r.rubrica))}</span></td><td class="num">${fmtBRL2(r.sistema)}${Math.abs(r.sistema - r.vigente) >= 0.01 ? ' <span style="color:var(--yellow-txt)" title="O aprovado no sistema difere do vigente informado pelo financiador (reformulações anteriores não registradas?)">⚠</span>' : ''}</td>
      <td class="num">${fmtBRL2(r.vigente)}</td><td class="num">${fmtBRL2(r.proposto)}</td><td class="num"><b>${fmtBRL2(r.proposto)}</b></td>${R.rendimentos ? `<td class="num">${r.rendimentos ? fmtBRL2(r.rendimentos) : '—'}</td>` : ''}</tr>`).join('')}</table></div>
  ${divRub.length ? `<div class="alert warn small mb">O aprovado de ${divRub.length} rubrica(s) no sistema não bate com o vigente do documento — provavelmente há reformulações anteriores que não foram registradas aqui. Ao aplicar, o aprovado passa a ser o <b>proposto</b> do documento (valor absoluto), o que corrige também essas diferenças.</div>` : ''}
  <div class="sec">2 · Itens do plano de aplicação (${alt.itens.length})</div>
  <div class="tw mb" style="max-height:300px;overflow:auto"><table class="t small"><tr><th>Operação</th><th>Rubrica</th><th>Item</th><th class="num">Vigente</th><th class="num">Proposto</th><th>No sistema</th></tr>
    ${cmp.map(c => { const i = c.i; return `<tr><td>${opBadge(i.op)}</td><td>${esc(i.rubrica || '—')}</td><td><b>${esc(i.descricao)}</b><div class="faint">${esc(i.natureza)} · nº ${esc(i.numero)} no documento${i.origem === 'importado' ? ' · importado' : ''}</div>${i.justificativa ? `<div class="muted" title="${esc(i.justificativa)}">${esc(i.justificativa.length > 140 ? i.justificativa.slice(0, 138) + '…' : i.justificativa)}</div>` : ''}</td>
      <td class="num">${i.op === 'I' ? '—' : fmtBRL2(i.vig.valor)}</td><td class="num">${i.op === 'E' ? '—' : fmtBRL2(i.prop.valor)}${i.prop.aplic ? `<div class="small muted">+ ${fmtBRL2(i.prop.aplic)} aplicação</div>` : ''}</td><td class="small">${sitItem(c)}</td></tr>`; }).join('')}
    ${alt.equipe.map(e => `<tr><td>${opBadge(e.op)}</td><td>1.1.x</td><td><b>${esc(e.descricao)}</b><div class="faint">Equipe executora</div></td><td class="num">${fmtBRL2(e.vig)}</td><td class="num">${fmtBRL2(e.prop)}</td><td class="small muted">confira as bolsas em Equipe</td></tr>`).join('')}</table></div>
  ${(R.semValor || []).filter(j => j.texto).length ? `<div class="small muted mb">Justificativas sem item com valor alterado: ${R.semValor.filter(j => j.texto).map(j => esc(j.descricao)).join('; ')}.</div>` : ''}
  <div class="small mb"><b>Como aplicar no plano de aplicação:</b>
    <label class="row" style="margin-top:4px"><input type="radio" name="rf_modo" value="alteracoes"${sugereSinc ? '' : ' checked'}> só as operações desta solicitação (${cmp.filter(c => c.i.op === 'E').length} exclusão(ões), ${cmp.filter(c => c.i.op === 'A').length} alteração(ões), ${cmp.filter(c => c.i.op === 'I').length} inclusão(ões))${divIt.length ? ` — <span style="color:var(--yellow-txt)">${divIt.length} item(ns) com divergência</span>` : ''}</label>
    ${temProposto ? `<label class="row"><input type="radio" name="rf_modo" value="sincronizar"${sugereSinc ? ' checked' : ''}> sincronizar com o orçamento completo proposto (${alt.propostos.length} itens): ${sinc.mudam.length} atualizado(s), ${sinc.ins.length} incluído(s), ${sinc.canc.length} cancelado(s)${sinc.movem.length ? `, ${sinc.movem.length} mudam de rubrica` : ''}${sinc.travados.length ? `; ${sinc.travados.length} em aquisição/adquirido(s) fora da relação ficam como estão` : ''}${sugereSinc ? ' <b>(recomendado: o sistema está diferente do vigente)</b>' : ''}</label>` : ''}</div>
  ${R.rendimentos ? `<label class="row small mb"><input type="checkbox" id="rf_rend" checked> incluir os ${fmtBRL2(R.rendimentos)} de rendimentos de aplicação no valor dos itens que os usam — ficam numa linha à parte no orçamento, fora do aprovado e do valor do projeto</label>` : ''}
  <div class="sec">3 · Desembolso</div>
  ${alt.desembolso.length ? `<label class="row small mb"><input type="checkbox" id="rf_des" checked> atualizar a distribuição por rubrica das parcelas ainda <b>previstas</b> (as recebidas não mudam)</label>
    <div class="row small" style="gap:16px;flex-wrap:wrap">${alt.desembolso.map(x => { const ex = D.desembolsos.find(d => d.projeto_id === pid && d.numero === x.numero); return `<span>${esc(x.numero)}ª parcela${x.mes ? ' (mês ' + esc(x.mes) + ')' : ''}: <b>${fmtBRL2(x.valor)}</b> <span class="muted">${ex ? (ex.status === 'prevista' ? '· prevista no sistema' : '· ' + esc(ex.status) + ' — não muda') : '· não cadastrada no sistema'}</span></span>`; }).join('')}</div>`
    : '<div class="empty small">O documento não traz o cronograma de desembolso.</div>'}
  <div class="sec">4 · Registro</div>
  <div class="fgrid mb">
    <div><label class="fl">Nº da reformulação</label><input id="rf_num" type="number" min="1" value="${R.numero || (Math.max(0, ...D.reformulacoes.filter(r => r.projeto_id === pid).map(r => num(r.numero))) + 1)}"></div>
    <div><label class="fl">Data da submissão</label><input id="rf_data" type="date" value="${R.data || hoje()}"></div>
    <div><label class="fl">Situação</label><select id="rf_sit"><option value="submetida">Submetida — só registra (aplica depois, quando aprovada)</option><option value="aprovada">Aprovada — registra e aplica agora</option></select></div>
    <div><label class="fl">Documento</label><input id="rf_doc" value="${esc(R.arquivo || '')}"></div></div>
  ${jaReg ? `<label class="row small mb"><input type="checkbox" id="rf_subst" checked> substituir o registro da ${esc(jaReg.numero)}ª reformulação já existente${jaReg.aplicada_em ? ' e <b>refazer a aplicação</b> (corrige o mapa de rubricas, os rendimentos e os itens; os valores passam a ser os desta prévia)' : ''}</label>` : ''}
  ${pend.length ? `<div class="alert warn mt small"><label class="row"><input type="checkbox" id="rf_conf"> Revisei as ${pend.length} divergência(s) das conferências</label></div>` : ''}
  <div class="merr" id="rf_err" style="display:none"></div>
  <div class="mactions"><button id="rf_pad" title="Baixa o que foi lido no formato padrão do GPMOT (.json): serve para conferir, corrigir à mão e carregar de novo">Baixar reformulação padrão (.json)</button><button id="rf_c">Cancelar</button><button class="btn-p" id="rf_ok">Registrar</button></div>`;
  openModal(html, { wide: true, sticky: true, noFocus: true });
  const root = document.getElementById('modal-root'), q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  
  if (jaReg && jaReg.aplicada_em) { q('#rf_sit').value = 'aprovada'; q('#rf_ok').textContent = 'Registrar e aplicar'; }
  q('#rf_sit').onchange = () => { q('#rf_ok').textContent = q('#rf_sit').value === 'aprovada' ? 'Registrar e aplicar' : 'Registrar'; };
  q('#rf_x').onclick = q('#rf_c').onclick = closeModal;
  qa('.rf-nat').forEach(sel => sel.onchange = () => { R.naturezas[+sel.dataset.i].rubrica = sel.value || null; previaReformulacao(R, pid); });
  q('#rf_pad').onclick = () => baixar((R.arquivo || 'reformulacao').replace(/\.[^.]+$/, '') + ' — reformulação padrão GPMOT.json', JSON.stringify(reformulacaoParaPadrao(R), null, 1), 'application/json');
  q('#rf_ok').onclick = async () => {
    const err = m => { const el = q('#rf_err'); el.textContent = m; el.style.display = 'block'; };
    if (q('#rf_conf') && !q('#rf_conf').checked) return err('Há divergências nas conferências do documento: revise-as e marque a confirmação para registrar.');
    if (R.naturezas.some(n => !n.rubrica && (Math.abs(n.diferenca) >= 0.01 || n.proposto))) return err('Escolha a rubrica do GPMOT de todas as naturezas com valor.');
    const btn = q('#rf_ok'); btn.disabled = true;
    try {
      alt.opcoes = { modo: (qa('input[name="rf_modo"]').find(x => x.checked) || {}).value || 'alteracoes', rendimentos: !!(q('#rf_rend') && q('#rf_rend').checked), desembolso: !!(q('#rf_des') && q('#rf_des').checked) };
      const campos = { numero: parseInt(q('#rf_num').value, 10) || null, tipo: 'financeira', data: isDate(q('#rf_data').value) ? q('#rf_data').value : hoje(), situacao: 'submetida',
        documento: q('#rf_doc').value.trim() || null, justificativa: R.justificativa || null, alteracoes: alt, remanejado: R.remanejado || 0, rendimentos: R.rendimentos || 0 };
      const subst = jaReg && q('#rf_subst') && q('#rf_subst').checked;
      if (subst && jaReg.aplicada_em) { const ant = jaReg.alteracoes || {}, dep = ((ant.resultado || {}).rubricas || []);   // rubricas que a aplicação anterior definiu e o novo mapa não usa
        alt.substitui = (ant.rubricas || []).filter(r => !alt.rubricas.some(x => x.rubrica === r.rubrica)).map(r => ({ rubrica: r.rubrica, valor: (dep.find(d => d.rubrica === r.rubrica) || {}).depois ?? r.proposto })); }
      const ref = subst ? await Data.update('reformulacoes', jaReg.id, { ...campos, aplicada_em: null })
        : await Data.insert('reformulacoes', { projeto_id: pid, ...campos, autor: ME.pessoa_id ? nomePessoa(ME.pessoa_id) : (ME.email || null) });
      let msg = `✓ ${ref.numero ? ref.numero + 'ª r' : 'R'}eformulação registrada como submetida`;
      if (q('#rf_sit').value === 'aprovada') { const res = await aplicarReformulacao(ref.id); msg = '✓ Reformulação aprovada e aplicada: ' + res.resumo; }
      closeModal(); UI.tab = 'projetos'; UI.projeto = pid; UI.projAba = 'financeiro'; UI.sub.projFin = 'reformulacoes'; render(); flash(msg);
    } catch (e) { console.error(e); err(traduzErro(e)); btn.disabled = false; }
  };
}

/* ── aplicar uma reformulação aprovada ────────────────────────────────────── */
async function aplicarReformulacao(id) {
  const ref = byId('reformulacoes', id); if (!ref) falha('Reformulação não encontrada.');
  const pid = ref.projeto_id, p = byId('projetos', pid);
  if (!Perm.reformulaFin(pid)) falha('Você não tem permissão para aplicar reformulações financeiras deste projeto.');
  if (ref.aplicada_em) falha('Esta reformulação já foi aplicada.');
  const alt = ref.alteracoes || {}, op = alt.opcoes || {}, rend = !!op.rendimentos, nRef = ref.numero ? ref.numero + 'ª reformulação' : 'reformulação', quando = fmtD(ref.data || hoje());
  const nota = (antigo, txt) => [antigo, txt].filter(Boolean).join('\n');
  const res = { rubricas: [], itens: { incluidos: 0, alterados: 0, cancelados: 0, naoEncontrados: [], comGastos: [] }, parcelas: 0, notas: [] };
  /* 1. aprovado por rubrica = proposto do documento (+ rendimentos, se escolhido) */
  for (const r of alt.rubricas || []) {
    if (!rubricaFolha(r.rubrica)) { res.notas.push(`Rubrica ${r.rubrica} não existe no plano de contas: ignorada.`); continue; }
    const novo = r2(r.proposto), ex = D.orcamento_rubricas.find(x => x.projeto_id === pid && x.rubrica === r.rubrica);
    const antes = ex ? num(ex.aprovado) : 0; if (Math.abs(antes - novo) < 0.005) continue;
    if (ex) await Data.update('orcamento_rubricas', ex.id, { aprovado: novo, ...(num(ex.previsto) ? { previsto: r2(Math.max(0, num(ex.previsto) + novo - antes)) } : {}), obs: nota(ex.obs, `${nRef} (${quando}): aprovado ${fmtBRL2(antes)} → ${fmtBRL2(novo)}.`) });
    else await Data.insert('orcamento_rubricas', { projeto_id: pid, rubrica: r.rubrica, aprovado: novo, previsto: novo, obs: `Criada pela ${nRef} (${quando}).` });
    res.rubricas.push({ rubrica: r.rubrica, antes, depois: novo });
  }
  for (const r of alt.substitui || []) {   // refazer: rubrica usada só pelo mapa anterior volta a zero (se ninguém a mudou depois)
    const ex = D.orcamento_rubricas.find(x => x.projeto_id === pid && x.rubrica === r.rubrica); if (!ex || Math.abs(num(ex.aprovado) - num(r.valor)) >= 0.005) continue;
    await Data.update('orcamento_rubricas', ex.id, { aprovado: 0, ...(num(ex.previsto) ? { previsto: r2(Math.max(0, num(ex.previsto) - num(ex.aprovado))) } : {}), obs: nota(ex.obs, `${nRef} refeita (${quando}): aprovado ${fmtBRL2(ex.aprovado)} → ${fmtBRL2(0)}.`) });
    res.rubricas.push({ rubrica: r.rubrica, antes: num(ex.aprovado), depois: 0 });
  }
  /* 2. plano de aplicação */
  const gastos = it => D.despesas.filter(d => d.item_id === it.id).reduce((t, d) => t + num(d.valor), 0);
  const prox = rub => Math.max(0, ...D.plano_itens.filter(x => x.projeto_id === pid && x.rubrica === rub).map(x => num(x.numero))) + 1;
  const valorProp = i => r2((i.prop ? i.prop.valor : i.valor) + (rend ? (i.prop ? i.prop.aplic : i.aplic) || 0 : 0));
  const justOp = new Map((alt.itens || []).map(i => [i.rubrica + '|' + chaveItem(i.descricao), i]));
  const cancelar = async (ex, motivo) => { const g = gastos(ex); if (g > 0.005) res.itens.comGastos.push(`${ex.descricao} (${fmtBRL2(g)} já gastos)`);
    await Data.update('plano_itens', ex.id, { status: 'cancelado', obs: nota(ex.obs, motivo) }); res.itens.cancelados++; };
  if (op.modo === 'sincronizar' && (alt.propostos || []).length) {
    const s = planoSincronizacao(alt, pid);
    for (const { x, ex } of s.upd) { const v = valorProp(x), o = justOp.get(x.rubrica + '|' + chaveItem(x.descricao));
      const move = ex.rubrica !== x.rubrica && !(gastos(ex) > 0.005); if (ex.rubrica !== x.rubrica && !move) res.notas.push(`"${ex.descricao}" tem gastos lançados em ${ex.rubrica}: não foi movido para ${x.rubrica}.`);
      if (Math.abs(num(ex.valor_previsto) - v) < 0.005 && ex.status !== 'cancelado' && !o && !move) continue;
      await Data.update('plano_itens', ex.id, { valor_previsto: v, ...(move ? { rubrica: x.rubrica, numero: prox(x.rubrica) } : {}), quantidade: x.quantidade, valor_unitario: x.valor_unitario, ...(ex.status === 'cancelado' && v > 0 ? { status: 'previsto' } : {}), ...(!ex.justificativa && x.justificativa ? { justificativa: x.justificativa } : {}),
        ...(Math.abs(num(ex.valor_previsto) - v) >= 0.005 || o ? { obs: nota(ex.obs, `${nRef} (${quando}): ${fmtBRL2(ex.valor_previsto)} → ${fmtBRL2(v)}${o && o.justificativa ? ' — ' + o.justificativa : ''}`) } : {}) });
      res.itens.alterados++; }
    for (const x of s.ins) { const o = justOp.get(x.rubrica + '|' + chaveItem(x.descricao));
      await Data.insert('plano_itens', { projeto_id: pid, rubrica: x.rubrica, numero: prox(x.rubrica), descricao: x.descricao, origem: x.origem, quantidade: x.quantidade, valor_unitario: x.valor_unitario, moeda: x.moeda || 'BRL', cambio: x.cambio, detalhe: x.detalhe,
        justificativa: (o && o.justificativa) || x.justificativa, valor_previsto: valorProp(x), status: 'previsto', obs: `Incluído pela ${nRef} (${quando}).` }); res.itens.incluidos++; }
    for (const ex of s.canc) { const o = justOp.get(ex.rubrica + '|' + chaveItem(ex.descricao)); await cancelar(ex, `Excluído pela ${nRef} (${quando})${o && o.justificativa ? ' — ' + o.justificativa : ''}.`); }
    if (s.travados.length) res.notas.push(`${s.travados.length} item(ns) em aquisição/adquiridos não constam da relação proposta e foram mantidos: ${s.travados.map(i => i.descricao).join('; ')}.`);
  } else {
    const usados = new Set();
    for (const i of alt.itens || []) {
      const ex = acharItemPlano(pid, i.rubrica, i.descricao, i.origem, usados, true); if (ex) usados.add(ex.id);
      const motivo = `${i.op === 'E' ? 'Excluído' : i.op === 'I' ? 'Incluído' : 'Alterado'} pela ${nRef} (${quando})${i.justificativa ? ' — ' + i.justificativa : ''}.`;
      if (i.op === 'E') { if (ex) { if (ex.status !== 'cancelado') await cancelar(ex, motivo); } else res.itens.naoEncontrados.push(i.descricao); }
      else if (i.op === 'I' && !(ex && ex.status !== 'cancelado')) {
        if (ex) { await Data.update('plano_itens', ex.id, { status: 'previsto', valor_previsto: valorProp(i), quantidade: i.prop.qtd, valor_unitario: i.prop.unit || null, obs: nota(ex.obs, motivo) }); res.itens.alterados++; }
        else { await Data.insert('plano_itens', { projeto_id: pid, rubrica: i.rubrica, numero: prox(i.rubrica), descricao: i.descricao, origem: i.origem, quantidade: i.prop.qtd, valor_unitario: i.prop.unit || null, justificativa: i.justificativa || null, valor_previsto: valorProp(i), status: 'previsto', obs: `Incluído pela ${nRef} (${quando}).` }); res.itens.incluidos++; } }
      else { if (!ex) { res.itens.naoEncontrados.push(i.descricao); continue; }
        await Data.update('plano_itens', ex.id, { valor_previsto: valorProp(i), quantidade: i.prop.qtd, valor_unitario: i.prop.unit || null, obs: nota(ex.obs, motivo) }); res.itens.alterados++; }
    }
  }
  if (res.itens.naoEncontrados.length) res.notas.push(`Itens não encontrados no plano de aplicação (confira à mão): ${res.itens.naoEncontrados.join('; ')}.`);
  if (res.itens.comGastos.length) res.notas.push(`Itens cancelados que já tinham gastos lançados: ${res.itens.comGastos.join('; ')}.`);
  /* 3. desembolso: distribuição por rubrica das parcelas previstas */
  if (op.desembolso) for (const x of alt.desembolso || []) {
    const d = D.desembolsos.find(z => z.projeto_id === pid && z.numero === x.numero);
    if (!d) { res.notas.push(`A ${x.numero}ª parcela não está cadastrada no Desembolso.`); continue; }
    if (d.status !== 'prevista') continue;
    const atual = {}; D.desembolso_rubricas.filter(z => z.desembolso_id === d.id).forEach(z => atual[z.rubrica] = num(z.valor));
    const dist = Object.fromEntries(Object.entries(x.dist || {}).filter(([r, v]) => rubricaFolha(r) && v > 0.004));
    const igual = Object.keys({ ...atual, ...dist }).every(r => Math.abs((atual[r] || 0) - (dist[r] || 0)) < 0.005);
    if (!igual) { await Data.removeWhere('desembolso_rubricas', { desembolso_id: d.id }); for (const [rubrica, valor] of Object.entries(dist)) await Data.insert('desembolso_rubricas', { desembolso_id: d.id, projeto_id: pid, rubrica, valor: r2(valor) }); res.parcelas++; }
    if (Math.abs(num(d.valor_previsto) - x.valor) >= 0.01) { if (Perm.editaFin(pid)) await Data.update('desembolsos', d.id, { valor_previsto: x.valor }); else res.notas.push(`O valor da ${x.numero}ª parcela muda para ${fmtBRL2(x.valor)}: peça à coordenação ou à Gerência Financeira para ajustar.`); }
  }
  if ((alt.equipe || []).length) res.notas.push('Há alterações de bolsas da equipe executora: confira as bolsas previstas em Equipe.');
  const totAp = D.orcamento_rubricas.filter(x => x.projeto_id === pid).reduce((t, x) => t + num(x.aprovado), 0);
  if (p && num(p.valor_total) && Math.abs(totAp - num(p.valor_total)) >= 0.01)
    res.notas.push(`A soma do aprovado por rubrica (${fmtBRL2(totAp)}) difere do valor do contrato (${fmtBRL2(p.valor_total)}).`);
  res.resumo = [res.rubricas.length ? `${res.rubricas.length} rubrica(s)` : '', res.itens.incluidos ? `${res.itens.incluidos} item(ns) incluído(s)` : '', res.itens.alterados ? `${res.itens.alterados} alterado(s)` : '', res.itens.cancelados ? `${res.itens.cancelados} cancelado(s)` : '', res.parcelas ? `${res.parcelas} parcela(s) redistribuída(s)` : ''].filter(Boolean).join(', ') || 'nada mudou';
  await Data.update('reformulacoes', ref.id, { situacao: 'aprovada', aplicada_em: new Date().toISOString(), alteracoes: { ...alt, resultado: { em: new Date().toISOString(), por: ME.pessoa_id ? nomePessoa(ME.pessoa_id) : (ME.email || null), ...res } } });
  if (res.notas.length) res.resumo += ' — ' + res.notas.length + ' observação(ões) no registro';
  return res;
}
A.refVer = d => {
  const r = byId('reformulacoes', d.id); if (!r) return; const alt = r.alteracoes || {}, p = byId('projetos', r.projeto_id), pode = Perm.reformulaFin(r.projeto_id), s = SIT_REFORM[r.situacao] || [r.situacao, 'b-gray'], res = alt.resultado;
  const html = `<div class="between mb"><h3 style="margin:0">${r.numero ? esc(r.numero) + 'ª r' : 'R'}eformulação financeira — ${esc(p ? p.sigla : '')}</h3><button class="btn-s" id="rv_x">✕</button></div>
  <div class="kv mb small"><span class="k">Situação</span><span>${badge(s[0], s[1])}${r.aplicada_em ? ` <span class="muted">aplicada em ${fmtD(String(r.aplicada_em).slice(0, 10))}${res && res.por ? ' por ' + esc(res.por) : ''}</span>` : ''}</span>
    <span class="k">Submissão</span><span>${fmtD(r.data)}</span><span class="k">Documento</span><span>${esc(r.documento || '—')}${alt.documento && alt.documento.processo ? ' · processo ' + esc(alt.documento.processo) : ''}</span>
    <span class="k">Registrada por</span><span>${esc(r.autor || '—')}</span><span class="k">Remanejado</span><span><b>${fmtBRL2(r.remanejado)}</b>${num(r.rendimentos) ? ` + rendimentos ${fmtBRL2(r.rendimentos)}` : ''}</span>
    <span class="k">Modo</span><span>${(alt.opcoes || {}).modo === 'sincronizar' ? 'sincronizar com o orçamento completo proposto' : 'só as operações da solicitação'}${(alt.opcoes || {}).rendimentos ? ' · com rendimentos' : ''}${(alt.opcoes || {}).desembolso ? ' · redistribui o desembolso' : ''}</span></div>
  ${r.justificativa ? `<details class="mb"><summary class="small"><b>Justificativa técnica</b></summary><div class="small" style="white-space:pre-line;padding:4px 0 0 14px">${esc(r.justificativa)}</div></details>` : ''}
  ${(alt.conferencias || {}).divergencias && alt.conferencias.divergencias.length ? `<div class="alert warn small mb">Divergências aceitas no registro: ${alt.conferencias.divergencias.map(esc).join('; ')}</div>` : ''}
  <div class="sec" style="margin-top:0">Rubricas</div>
  <div class="tw mb"><table class="t small"><tr><th>Rubrica</th><th>Naturezas</th><th class="num">Vigente</th><th class="num">Proposto</th><th class="num">Diferença</th>${res ? '<th class="num">Aprovado antes → depois</th>' : ''}</tr>
    ${(alt.rubricas || []).map(x => { const a = res && res.rubricas.find(z => z.rubrica === x.rubrica); return `<tr><td><b>${esc(x.rubrica)}</b></td><td class="small">${esc((x.naturezas || []).join(', '))}</td><td class="num">${fmtBRL2(x.vigente)}</td><td class="num">${fmtBRL2(x.proposto)}</td>
      <td class="num">${Math.abs(x.diferenca) >= 0.01 ? (x.diferenca > 0 ? '+' : '−') + fmtBRL2(Math.abs(x.diferenca)) : '—'}</td>${res ? `<td class="num">${a ? fmtBRL2(a.antes) + ' → <b>' + fmtBRL2(a.depois) + '</b>' : '<span class="faint">sem mudança</span>'}</td>` : ''}</tr>`; }).join('')}</table></div>
  <div class="sec">Itens (${(alt.itens || []).length})</div>
  <div class="tw mb" style="max-height:260px;overflow:auto"><table class="t small"><tr><th>Operação</th><th>Rubrica</th><th>Item</th><th class="num">Vigente</th><th class="num">Proposto</th></tr>
    ${(alt.itens || []).map(i => `<tr><td>${opBadge(i.op)}</td><td>${esc(i.rubrica || '—')}</td><td><b>${esc(i.descricao)}</b>${i.justificativa ? `<div class="muted">${esc(i.justificativa)}</div>` : ''}</td><td class="num">${i.op === 'I' ? '—' : fmtBRL2(i.vig.valor)}</td><td class="num">${i.op === 'E' ? '—' : fmtBRL2(i.prop.valor)}${i.prop.aplic ? `<div class="muted">+ ${fmtBRL2(i.prop.aplic)} aplicação</div>` : ''}</td></tr>`).join('')}</table></div>
  ${res && res.notas && res.notas.length ? `<div class="alert warn small mb">${res.notas.map(esc).join('<br>')}</div>` : ''}
  ${res ? `<div class="small muted mb">Resultado da aplicação: ${esc(res.resumo || '')}.</div>` : ''}
  <div class="merr" id="rv_err" style="display:none"></div>
  <div class="mactions">${Perm.dir() ? '<button class="btn-d left" id="rv_del">Excluir registro</button>' : ''}${pode && !r.aplicada_em && r.situacao !== 'rejeitada' ? '<button id="rv_rej">Marcar como rejeitada</button>' : ''}${pode && r.situacao === 'rejeitada' ? '<button id="rv_reab">Reabrir</button>' : ''}<button id="rv_c">Fechar</button>${pode && !r.aplicada_em && r.situacao !== 'rejeitada' ? '<button class="btn-p" id="rv_ap">Aprovada pelo financiador — aplicar</button>' : ''}</div>`;
  openModal(html, { wide: true, noFocus: true });
  const root = document.getElementById('modal-root'), q = s => root.querySelector(s), err = e => { const el = q('#rv_err'); el.textContent = traduzErro(e); el.style.display = 'block'; };
  q('#rv_x').onclick = q('#rv_c').onclick = closeModal;
  if (q('#rv_ap')) q('#rv_ap').onclick = async () => { if (!await confirmar(`Aplicar a ${r.numero ? r.numero + 'ª ' : ''}reformulação?\n\nO aprovado das rubricas, os itens do plano de aplicação${(alt.opcoes || {}).desembolso ? ' e a distribuição das parcelas previstas' : ''} serão atualizados conforme a solicitação.`)) return;
    q('#rv_ap').disabled = true; try { const x = await aplicarReformulacao(r.id); closeModal(); render(); flash('✓ Reformulação aplicada: ' + x.resumo); } catch (e) { console.error(e); err(e); q('#rv_ap').disabled = false; } };
  if (q('#rv_rej')) q('#rv_rej').onclick = async () => { try { await Data.update('reformulacoes', r.id, { situacao: 'rejeitada' }); closeModal(); render(); flash('Reformulação marcada como rejeitada'); } catch (e) { err(e); } };
  if (q('#rv_reab')) q('#rv_reab').onclick = async () => { try { await Data.update('reformulacoes', r.id, { situacao: 'submetida' }); closeModal(); render(); flash('Reformulação reaberta'); } catch (e) { err(e); } };
  if (q('#rv_del')) q('#rv_del').onclick = async () => { if (!await confirmar('Excluir o registro desta reformulação?' + (r.aplicada_em ? '\n\nAs mudanças já aplicadas no orçamento e no plano de aplicação NÃO são desfeitas.' : ''))) return;
    try { await Data.remove('reformulacoes', r.id); closeModal(); render(); flash('Excluído'); } catch (e) { err(e); } };
};
