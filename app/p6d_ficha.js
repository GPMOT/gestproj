
/* ════════════════════════════════════════════════════════════════════
   FICHAS DE GESTÃO DA EQUIPE (UFSM — "Autorização para execução de projeto — ajuste de item —
   alteração da equipe"). A cada mudança na equipe executora sai uma ficha nova com a equipe
   COMPLETA (inclusive quem já saiu, com o período). O leitor converte a ficha para a
   FICHA PADRÃO do GPMOT:
     { formato, arquivo, referencia, titulo, processo, contrato, vigencia{inicio,fim}, coordenador, fundacao,
       formulario, descricao, aprovacoes{coordenacao,fiscal,pra:{data,nome}},
       participantes[{n, grupo 'ufsm'|'externo', nome, unidade, vinculo, funcao, horas, pagamentos, valor, inicio, fim}],
       conferencias[], avisos[] }
   O CPF dos participantes NUNCA sai do leitor: só se registra se a ficha o informa (para a conferência).
   A prévia casa cada linha com a pessoa, a posição do plano, a alocação e a bolsa do projeto;
   quem está no projeto e não aparece na ficha é listado para a coordenação decidir.
   ════════════════════════════════════════════════════════════════════ */
const RE_CPF = /\d{3}\.?\d{3}\.?\d{3}\s?-?\s?\d{2}/;
const dataBR = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
/* valor de cada pagamento: aceita "R$ 8.313,00", "$ 8,313.00" (planilha em inglês) e "8313" */
function valorFicha(s) {
  const t = String(s || '').replace(/R?\$|\s/g, '');
  if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(t)) return { v: r2(parseFloat(t.replace(/,/g, ''))), us: true };
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(t)) return { v: r2(parseFloat(t.replace(/\./g, '').replace(',', '.'))), us: false };
  if (/^\d+([.,]\d{1,2})?$/.test(t)) return { v: r2(parseFloat(t.replace(',', '.'))), us: false };
  return { v: null, us: false };
}
/* data da ficha → ISO; data inexistente (31/09) vira a mais provável: o fim de N pagamentos, se cair perto; senão, o último dia do mês */
function dataFicha(txt, inicio, pagamentos) {
  const iso = dataBR(txt); if (!iso) return { iso: null, txt: txt || '' };
  if (isDate(iso)) return { iso, txt };
  const [a, m] = iso.split('-').map(Number), ultimo = isoOf(new Date(a, m, 0));
  if (m >= 1 && m <= 12) {
    if (isDate(inicio) && pagamentos > 0) { const prov = Calc.fimBolsa(inicio, pagamentos), dm = (+prov.slice(0, 4) - a) * 12 + (+prov.slice(5, 7) - m);
      if (Math.abs(dm) <= 1) return { iso: prov, txt, corrigida: true }; }
    return { iso: ultimo, txt, corrigida: true };
  }
  return { iso: null, txt };
}
/* junta os trechos de uma linha de texto corrido: trecho que termina e o seguinte que começa sem espaço são a mesma palavra */
const juntaFino = its => its.reduce((s, t, i) => s + (i && (/\s$/.test(its[i - 1].s) || /^\s/.test(t.s)) ? ' ' : '') + t.s, '').replace(/\s+/g, ' ').trim();
const VINCULOS_UFSM = /^(Servidor(a)?|Aluno(a)?|Docente|Professor(a)?|T[ée]cnico(a)?(-administrativo)?|TAE|Discente|Estudante|Bolsista|Colaborador(a)?|Volunt[áa]rio(a)?|Estagi[áa]rio(a)?|Terceirizado(a)?|Aposentado(a)?)$/i;
const FORMAS_EXTERNO = /^(Bolsa|CLT|RPA|Servi[çc]o|PJ|Pessoa\s+Jur[íi]dica|Volunt[áa]rio|Est[áa]gio|Aut[ôo]nomo|Celetista|Contrato)\b/i;

async function lerFichaUFSM(buf, nomeArquivo, inflar) {
  const pags = await lerPDF(buf, inflar), L = linhasPDF(pags, 1.6);
  const txtAll = L.map(l => l.txt).join('\n');
  if (!/ALTERA[CÇ][AÃ]O DA EQUIPE/i.test(txtAll) || !/Equipe executora/i.test(txtAll)) falha('Este PDF não é uma ficha de gestão de alteração da equipe (UFSM — "Ajuste de item — alteração da equipe").');
  const F = { formato: 'Ficha de gestão — alteração da equipe (UFSM, PDF)', arquivo: nomeArquivo, paginas: pags.length, participantes: [], conferencias: [], avisos: [], _privado: { matriculas: {}, semCPF: [], semMatricula: [] } };
  const idx = (re, de = 0) => { for (let i = de; i < L.length; i++) if (re.test(L[i].txt)) return i; return -1; };
  const i41 = idx(/^4\.1\b/), i42 = idx(/^4\.2\b/), i5 = idx(/^5\.\s*Descri/i), i6 = idx(/^6\.\s*Aprova/i);
  if (i41 < 0) falha('Não encontrei o quadro "4.1 Equipe executora vinculada à UFSM" na ficha.');
  const H = L.slice(0, i41).map(l => l.txt).join(' ').replace(/\s+/g, ' ');
  /* 1. dados gerais */
  { const i = idx(/^Refer[eê]ncia/i); const s = i >= 0 ? L.slice(i, i + 2).map(l => l.txt).join(' ') : ''; F.referencia = ((s.match(/(\d+\.\d+)/) || [])[1]) || ''; }
  { const i = idx(/^T[íi]tulo:/i); if (i >= 0) { let t = juntaFino(L[i].its).replace(/^T[íi]tulo:\s*/i, '');
      for (let k = i + 1; k < Math.min(L.length, i + 4); k++) { const s = L[k].txt; if (/N[úu]mero|Vig[eê]ncia|Modalidade|^\d|Processo|Contrato|^\d+\.\s/i.test(s)) break; t += ' ' + juntaFino(L[k].its); }
      F.titulo = t.replace(/\s+/g, ' ').trim(); } else F.titulo = ''; }
  { const k = idx(/\d{5}\.\d{6}\/\d{4}/); if (k >= 0 && k < i41) { const m = L[k].txt.match(/(\d{5}\.\d{6}\/\d{4})\s*-?\s*(\d{2})?/); let dv = m[2] || '';
      for (let j = k + 1; !dv && j <= Math.min(k + 3, i41 - 1); j++) { const t0 = (L[j].its[0] || {}).s || ''; if (/^\s*\d{2}\s*$/.test(t0)) dv = t0.trim(); }
      F.processo = m[1] + (dv ? '-' + dv : ''); } else F.processo = ''; }
  F.contrato = ((H.match(/Contrato[^:]{0,40}:\s*([0-9][0-9.\/-]{5,}[0-9])/i) || [])[1]) || '';
  { const m = H.match(/Vig[eê]ncia:?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:a|at[ée]|-|–)\s*(\d{2}\/\d{2}\/\d{4})/i); F.vigencia = { inicio: m ? dataBR(m[1]) : null, fim: m ? dataBR(m[2]) : null }; }
  { const i = idx(/^Nome:/i); F.coordenador = i >= 0 ? (L[i].txt.replace(/^Nome:\s*/i, '').split(RE_CPF)[0].split(/\bCPF:/i)[0].replace(/\s+\S*@\S*.*$/, '').trim()) : ''; }
  F.fundacao = [H.match(/R\$\s*[\d.,]+\s+([A-ZÀ-Ú][A-ZÀ-Ú-]{2,})\b/), H.match(/Funda[cç][aã]o:\s*([A-ZÀ-Ú][A-ZÀ-Ú-]{2,})\b/)].map(m => m && m[1]).find(x => x && !/^(CNPJ|UFSM|CPF)$/.test(x)) || '';
  { const m = H.match(/Ressarcimento[\s\S]{0,120}?R\$\s*([\d.,]+)/i); F.ressarcimento = m ? valorFicha(m[1]).v : null; }
  { const s = L.slice(0, Math.max(i41, 0) + 1).map(l => l.txt).join(' '); const m = s.match(/\(\s*[xX]\s*\)\s*(Retificador|Original|Inicial|Substitutivo)/i); F.formulario = m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : ''; }
  /* 2. equipe: linhas que começam pelo número de ordem, com nome */
  const cab = (de, ate) => { const h = L.slice(de, de + 5).find(l => /Nome do Participante/i.test(l.txt)); const it = h ? h.its.find(t => /^CPF\b/.test(t.s.trim())) : null; return { xCPF: it ? it.x : null, xNum: h ? h.its[0].x : null }; };
  const lerQuadro = (de, ate, grupo) => {
    if (de < 0) return;
    const { xCPF, xNum } = cab(de, ate), seg = L.slice(de + 1, ate < 0 ? undefined : ate);
    const ehLinha = l => /^\d{1,2}\s+\S/.test(l.txt) && (xNum == null || Math.abs(l.its[0].x - xNum) < 12) && /\p{L}{2,}/u.test(l.txt.replace(/^\d+\s*/, ''));
    const linhas = seg.filter(ehLinha), outras = seg.filter(l => !ehLinha(l) && !/^\d{1,2}$/.test(l.txt) && !/Nome do Participante|Matr[íi]cula|Semanal|SIAPE|^N[ºo°]\b|C\. Hor/i.test(l.txt));
    const viz = new Map(linhas.map(l => [l, []]));
    outras.forEach(o => { let best = null, d = 1e9; linhas.forEach(l => { const dd = Math.abs(l.y - o.y); if (dd < d) { d = dd; best = l; } }); if (best && d <= 11) viz.get(best).push(o); });
    linhas.forEach(l => {
      const n = parseInt(l.txt, 10); let resto = l.txt.replace(/^\d{1,2}\s+/, '');
      const datas = [...resto.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map(m => m[0]); resto = resto.replace(/\s*\d{2}\/\d{2}\/\d{4}\s*/g, ' ');
      const vz = viz.get(l), acima = vz.filter(o => o.y > l.y), abaixo = vz.filter(o => o.y < l.y);
      const dIn = datas[0] || acima.map(o => (o.txt.match(/\d{2}\/\d{2}\/\d{4}/) || [])[0]).find(Boolean) || '';
      const dFim = datas[1] || abaixo.map(o => (o.txt.match(/\d{2}\/\d{2}\/\d{4}/) || [])[0]).find(Boolean) || '';
      const cauda = resto.match(/\s(\d{1,2}(?:[.,]\d+)?)\s+(\d{1,3})\s+((?:R?\$\s*)?[\d.,]+)\s*$/);
      let horas = null, pagamentos = null, valor = null, us = false;
      if (cauda) { horas = parseFloat(cauda[1].replace(',', '.')); pagamentos = parseInt(cauda[2], 10); const vv = valorFicha(cauda[3]); valor = vv.v; us = vv.us; resto = resto.slice(0, cauda.index); }
      const temCPF = RE_CPF.test(resto); let nome, meio;
      if (temCPF) { const m = resto.match(RE_CPF); nome = resto.slice(0, m.index); meio = resto.slice(m.index + m[0].length); }
      else if (xCPF != null) { const its = l.its.slice(1); nome = its.filter(t => t.x < xCPF - 8).map(t => t.s).join(' '); meio = its.filter(t => t.x >= xCPF - 8).map(t => t.s).join(' ').replace(/\s*\d{2}\/\d{2}\/\d{4}\s*/g, ' ');
        if (cauda) meio = meio.replace(/\s(\d{1,2}(?:[.,]\d+)?)\s+(\d{1,3})\s+((?:R?\$\s*)?[\d.,]+)\s*$/, ''); }
      else { nome = resto; meio = ''; }
      nome = nome.replace(/\s+/g, ' ').trim(); meio = meio.replace(/\s+/g, ' ').trim();
      const x = { n, grupo, nome, unidade: '', vinculo: '', funcao: '', horas, pagamentos, valor };
      const mm = meio.match(/^(\d{5,12})\b\s*/); const matricula = mm ? mm[1] : ''; if (mm) meio = meio.slice(mm[0].length);
      if (grupo === 'ufsm') {
        const pal = meio.split(' ').filter(Boolean); let vi = pal.length - 1; while (vi >= 0 && !VINCULOS_UFSM.test(pal[vi])) vi--;
        if (vi >= 0) { x.vinculo = pal[vi]; x.unidade = pal.slice(0, vi).join(' '); } else { x.vinculo = pal.pop() || ''; x.unidade = pal.join(' '); }
        const un = vz.flatMap(o => o.its).filter(t => !/\d{2}\/\d{2}\/\d{4}/.test(t.s) && /\p{L}/u.test(t.s)).sort((a, b) => b.y - a.y || a.x - b.x).map(t => t.s.trim());
        if (un.length) x.unidade = [x.unidade, ...un].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        if (!matricula) F._privado.semMatricula.push(nome);
      } else {
        const m = meio.match(FORMAS_EXTERNO); if (m) { x.vinculo = m[0]; x.funcao = meio.slice(m[0].length).trim(); } else { const p = meio.split(' '); x.vinculo = p.shift() || ''; x.funcao = p.join(' '); }
      }
      if (matricula) (F._privado.matriculas[matricula] = F._privado.matriculas[matricula] || []).push(nome);
      if (!temCPF) F._privado.semCPF.push(nome);
      const di = dataFicha(dIn, null, 0); x.inicio = di.iso; x.inicioTxt = dIn; if (di.corrigida) x.inicioCorrigido = true;
      const df = dataFicha(dFim, x.inicio, pagamentos); x.fim = df.iso; x.fimTxt = dFim; if (df.corrigida) x.fimCorrigido = true;
      if (us) F._us = true;
      F.participantes.push(x);
    });
  };
  lerQuadro(i41, i42 > 0 ? i42 : (i5 > 0 ? i5 : -1), 'ufsm');
  if (i42 > 0) lerQuadro(i42, idx(/^Nas hip[oó]teses|^5\.\s/i, i42), 'externo');
  if (!F.participantes.length) falha('Não encontrei participantes nos quadros 4.1 e 4.2 da ficha.');
  /* 3. descrição e aprovações */
  F.descricao = i5 >= 0 ? L.slice(i5 + 1, i6 > i5 ? i6 : i5 + 8).map(l => juntaFino(l.its)).join(' ').replace(/\s+/g, ' ').trim() : '';
  F.aprovacoes = {};
  if (i6 > 0) {
    const blocos = [['pra', /PR[ÓO]-?REITORIA/i], ['coordenacao', /COORDENADOR/i], ['fiscal', /FISCAL/i]];
    blocos.forEach(([k, re]) => { const i = idx(re, i6); if (i < 0) return; const j = idx(/aprovad[oa]\s+em/i, i + 1); if (j < 0 || j > i + 4) return;
      const s = L[j].txt.replace(/^.*?aprovad[oa]\s+em:?\s*/i, ''), d = s.match(/(\d{2}\/\d{2}\/\d{4})/);
      F.aprovacoes[k] = { data: d ? dataBR(d[1]) : null, nome: d ? s.slice(s.indexOf(d[1]) + 10).replace(/\d{5,}/g, '').replace(/\s+/g, ' ').trim() : '' }; });
  }
  F.data = (F.aprovacoes.coordenacao || {}).data || (F.aprovacoes.fiscal || {}).data || null;
  if (F._us) F.avisos.push('Os valores da ficha estão no formato americano ($ 8,313.00) — foram lidos como reais (R$ 8.313,00).');
  delete F._us;
  conferirFicha(F);
  return F;
}

/* ── ficha padrão do GPMOT em JSON (outras fundações / conferir e corrigir à mão) ──
   { "formato": "gpmot-ficha-equipe-1", "titulo": "...", "processo": "...", "contrato": "...", "vigencia": {"inicio": "2026-09-17", "fim": "2030-09-16"},
     "coordenador": "...", "fundacao": "FAURGS", "formulario": "Retificador", "data": "2026-11-25", "descricao": "...",
     "participantes": [{ "grupo": "ufsm|externo", "nome": "...", "unidade": "...", "vinculo": "Servidor|Aluno|Bolsa", "funcao": "...",
                         "horas": 10, "pagamentos": 48, "valor": 8313, "inicio": "2026-10-01", "fim": "2030-09-30" }] }   (sem CPF) */
function lerFichaPadrao(o, nomeArquivo) {
  if (!o || o.formato !== 'gpmot-ficha-equipe-1') falha('Este JSON não está no formato "gpmot-ficha-equipe-1" (ficha de equipe padrão do GPMOT).');
  if (RE_CPF.test(JSON.stringify(o.participantes || []))) falha('O JSON traz CPF dos participantes: retire-os (o programa não guarda CPF).');
  const t = v => v == null ? '' : String(v).trim(), d = v => isDate(t(v)) ? t(v) : null, n = v => v == null || v === '' ? null : Number(v);
  const F = { formato: 'Ficha de equipe padrão GPMOT (JSON)', arquivo: nomeArquivo, referencia: t(o.referencia), titulo: t(o.titulo), processo: t(o.processo), contrato: t(o.contrato),
    vigencia: { inicio: d((o.vigencia || {}).inicio), fim: d((o.vigencia || {}).fim) }, coordenador: t(o.coordenador), fundacao: t(o.fundacao), formulario: t(o.formulario),
    descricao: t(o.descricao), aprovacoes: Object.fromEntries(['coordenacao', 'fiscal', 'pra'].map(k => [k, { data: d(((o.aprovacoes || {})[k] || {}).data), nome: t(((o.aprovacoes || {})[k] || {}).nome) }])), data: d(o.data), conferencias: [], avisos: [], _privado: { matriculas: {}, semCPF: null, semMatricula: null } };
  F.participantes = (o.participantes || []).map((x, i) => ({ n: i + 1, grupo: x.grupo === 'externo' ? 'externo' : 'ufsm', nome: t(x.nome), unidade: t(x.unidade), vinculo: t(x.vinculo), funcao: t(x.funcao),
    horas: n(x.horas), pagamentos: n(x.pagamentos), valor: n(x.valor) == null ? null : r2(n(x.valor)), inicio: d(x.inicio), fim: d(x.fim), inicioTxt: t(x.inicio), fimTxt: t(x.fim) })).filter(x => x.nome);
  if (!F.participantes.length) falha('O JSON não traz participantes.');
  conferirFicha(F);
  return F;
}
function fichaParaPadrao(F) {
  return { formato: 'gpmot-ficha-equipe-1', gerado_de: F.arquivo || null, referencia: F.referencia || null, titulo: F.titulo || null, processo: F.processo || null, contrato: F.contrato || null,
    vigencia: F.vigencia || null, coordenador: F.coordenador || null, fundacao: F.fundacao || null, formulario: F.formulario || null, data: F.data || null, descricao: F.descricao || '', aprovacoes: F.aprovacoes || {},
    participantes: F.participantes.map(x => ({ grupo: x.grupo, nome: x.nome, unidade: x.unidade || null, vinculo: x.vinculo || null, funcao: x.funcao || null, horas: x.horas, pagamentos: x.pagamentos, valor: x.valor, inicio: x.inicio, fim: x.fim })) };
}
const LEITORES_FICHA = [
  { nome: 'Ficha de gestão da UFSM — alteração da equipe (.pdf)', ext: /\.pdf$/i, ler: async f => lerFichaUFSM(await f.arrayBuffer(), f.name) },
  { nome: 'Ficha de equipe padrão do GPMOT (.json)', ext: /\.json$/i, ler: async f => { let o; try { o = JSON.parse(await f.text()); } catch { falha('O arquivo .json está com erro de formatação.'); } return lerFichaPadrao(o, f.name); } }];
async function lerFicha(f) {
  const l = LEITORES_FICHA.find(x => x.ext.test(f.name));
  if (!l) falha('Formato não reconhecido. Aceitos: ' + LEITORES_FICHA.map(x => x.nome).join('; ') + '.');
  return l.ler(f);
}

/* ── conferências do documento (independem do que está no sistema) ── */
function conferirFicha(F) {
  const ok = (c, t) => F.conferencias.push({ ok: !!c, txt: t }), P = F.participantes, pv = F._privado || {};
  const u = P.filter(x => x.grupo === 'ufsm').length, e = P.length - u;
  P.forEach(x => {   // uma linha por participante quando tudo confere; uma por problema quando não
    const nm = x.nome, prob = [];
    if (!x.inicio && !x.fim && !x.inicioTxt && !x.fimTxt) prob.push('período não informado');
    else {
      if (!x.inicio) prob.push(x.inicioTxt ? `início ${x.inicioTxt} não existe` : 'início não informado');
      if (!x.fim) prob.push('fim não informado'); else if (x.fimCorrigido) prob.push(`fim ${x.fimTxt} não existe — considerado ${fmtD(x.fim)}`);
    }
    if (x.inicio && x.fim) {
      if (x.fim < x.inicio) prob.push('fim antes do início');
      if (F.vigencia && F.vigencia.inicio && F.vigencia.fim && !(x.inicio >= F.vigencia.inicio && x.fim <= F.vigencia.fim)) prob.push(`período ${fmtD(x.inicio)} a ${fmtD(x.fim)} fora da vigência (${fmtD(F.vigencia.inicio)} a ${fmtD(F.vigencia.fim)})`);
      if (x.pagamentos) { const m = Calc.mesesPeriodo(x.inicio, x.fim); if (!(x.pagamentos <= m && x.pagamentos >= m - 1)) prob.push(`${x.pagamentos} pagamento(s) em ${m} mês(es) de participação`); }
    }
    if (x.valor == null || x.horas == null || x.pagamentos == null) prob.push('carga horária, nº de pagamentos ou valor não lidos');
    if (prob.length) prob.forEach(t => ok(false, `${nm}: ${t}`));
    else ok(true, `${nm}: ${fmtD(x.inicio)} a ${fmtD(x.fim)}${x.pagamentos ? `, ${x.pagamentos} pagamento(s) no período` : ''}`);
  });
  if (pv.semCPF) ok(!pv.semCPF.length, pv.semCPF.length ? `CPF não informado: ${pv.semCPF.join(', ')}` : 'CPF informado para todos os participantes (não é gravado no programa)');
  if (pv.semMatricula) ok(!pv.semMatricula.length, pv.semMatricula.length ? `SIAPE/matrícula não informado: ${pv.semMatricula.join(', ')}` : 'SIAPE/matrícula informado para toda a equipe da UFSM');
  Object.values(pv.matriculas || {}).filter(l => l.length > 1).forEach(l => ok(false, `Mesmo SIAPE/matrícula para ${l.join(' e ')}`));
  if (pv.matriculas && !Object.values(pv.matriculas).some(l => l.length > 1) && Object.keys(pv.matriculas).length) ok(true, 'Nenhum SIAPE/matrícula repetido');
  ok(u * 3 >= P.length * 2, `Equipe da UFSM: ${u} de ${P.length} pessoa(s) (mínimo de 2/3 — Decreto 7.423/2010)`);
  if (F.coordenador) ok(P.some(x => x.grupo === 'ufsm' && mesmoNome(x.nome, F.coordenador)), `Coordenador(a) ${F.coordenador} consta na equipe da UFSM`);
  { const nomes = P.map(x => nrmPT(x.nome)); const rep = nomes.filter((x, i) => nomes.indexOf(x) !== i); ok(!rep.length, rep.length ? `Participante repetido: ${[...new Set(rep)].join(', ')}` : 'Nenhum participante repetido'); }
  if (F.vigencia && F.vigencia.inicio && F.vigencia.fim) ok(F.vigencia.fim > F.vigencia.inicio, `Vigência ${fmtD(F.vigencia.inicio)} a ${fmtD(F.vigencia.fim)}`);
  delete F._privado;   // CPF, SIAPE e matrículas não saem do leitor
  F.resumo = { ufsm: u, externos: e, total: r2(P.reduce((t, x) => t + num(x.valor) * num(x.pagamentos), 0)) };
}

/* ── comparação com o projeto ─────────────────────────────────────────── */
const palavrasTitulo = s => nrmPT(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2 && !['para', 'com', 'dos', 'das', 'uma', 'por', 'sobre', 'entre', 'projeto'].includes(w));
/* fração das palavras do nome do projeto que aparecem no título da ficha */
const afinidadeTitulo = (titulo, p) => { const T = new Set(palavrasTitulo(titulo)); const N = [...new Set(palavrasTitulo([p.nome, p.sigla].filter(Boolean).join(' ')))]; return N.length ? N.filter(w => T.has(w)).length / N.length : 0; };
const ehCLT = x => /CLT|celetista/i.test(x.vinculo || '');
/* categoria provável de uma linha da ficha (para escolher a posição do plano) */
function categoriaFicha(x) {
  const v = nrmPT(x.vinculo + ' ' + x.funcao);
  if (x.grupo === 'ufsm' && /servidor|docente|professor/.test(v)) return ['docente', 'pesquisador', 'tecnico'];
  if (/tecnic|tae/.test(v)) return ['tecnico'];
  if (x.grupo === 'externo') return /pos-?doc|recem/.test(v) ? ['pos_doc'] : /doutorand/.test(v) ? ['doutorando'] : /mestrand/.test(v) ? ['mestrando'] : /gradua|inicia/.test(v) ? ['ic']
    : /pesquisador/.test(v) ? ['pesquisador', 'doutorando', 'pos_doc'] : ['outro', 'pesquisador', 'doutorando', 'pos_doc', 'tecnico'];
  if (/aluno|discente|estudante|bolsista/.test(v)) return num(x.horas) >= 30 ? ['mestrando', 'doutorando'] : ['ic'];
  return [];
}
/* pessoa do cadastro com o nome da ficha; com homônimos, a que já está no projeto */
function pessoaDaFicha(nome, pid) {
  const noProj = q => D.alocacoes.some(a => a.projeto_id === pid && a.pessoa_id === q.id) || D.equipe_plano.some(e => e.projeto_id === pid && e.pessoa_id === q.id);
  const cands = D.pessoas.filter(q => mesmoNome(q.nome, nome)), a = acharPessoa(nome);
  if (a && !cands.some(q => q.id === a.id)) cands.push(a);
  if (cands.length <= 1) return cands[0] || null;
  const dentro = cands.filter(noProj); return dentro.length === 1 ? dentro[0] : (dentro[0] || cands.find(q => q.ativo) || cands[0]);
}
function planoFicha(F, pid) {
  const p = byId('projetos', pid), EP = Calc.equipePlano(p), usados = new Set(), H = hoje(), efin = Perm.editaFin(pid);
  const linhas = F.participantes.map(x => {
    const pessoa = pessoaDaFicha(x.nome, pid);
    let r = pessoa ? EP.rows.find(q => q.e.pessoa_id === pessoa.id && q.e.status === 'ocupada' && !usados.has(q.e.id)) : null;
    if (!r) r = EP.rows.find(q => !usados.has(q.e.id) && ['vaga', 'selecao'].includes(q.e.status) && mesmoNome(q.e.nome_plano, x.nome)) || null;
    if (!r && !(pessoa && EP.rows.some(q => q.e.pessoa_id === pessoa.id && q.e.status === 'ocupada'))) {
      const cats = categoriaFicha(x);
      const cand = EP.rows.filter(q => !usados.has(q.e.id) && ['vaga', 'selecao'].includes(q.e.status)).map(q => {
        let s = 0; if (q.bolsa && x.valor && Math.abs(num(q.bolsa.valor_mensal) - x.valor) < 0.01) s += 3;
        if (cats.includes(q.e.categoria)) s += 2; if (q.e.horas_semanais != null && x.horas != null && num(q.e.horas_semanais) === x.horas) s += 1;
        return { q, s }; }).filter(c => c.s >= 3).sort((a, b) => b.s - a.s || a.q.e.ordem - b.q.e.ordem);
      r = cand.length ? cand[0].q : null;
    }
    if (r) usados.add(r.e.id);
    return { x, pessoa, vaga: r ? r.e.id : (pessoa ? '' : 'nova'), r };
  });
  linhas.forEach(l => {
    const { x } = l, encerra = !!(x.fim && x.fim < H);
    l.encerra = encerra;
    const vinc = l.pessoa ? D.vinculos_financeiros.filter(v => v.projeto_id === pid && v.pessoa_id === l.pessoa.id && v.status !== 'encerrado').sort((a, b) => String(b.inicio).localeCompare(a.inicio))[0] || null : null;
    l.vinc = vinc;
    l.aloc = l.pessoa ? D.alocacoes.find(a => a.projeto_id === pid && a.pessoa_id === l.pessoa.id) || null : null;
    l.bolsa = efin && x.valor > 0 && x.inicio && x.fim && x.fim >= x.inicio;
    l.avisos = [];
    const r = l.r;
    if (r && r.bolsa && x.valor != null && Math.abs(num(r.bolsa.valor_mensal) - x.valor) >= 0.01) l.avisos.push(`valor ${fmtBRL2(x.valor)} × ${fmtBRL2(r.bolsa.valor_mensal)} previsto na posição`);
    if (r && r.bolsa && x.pagamentos && x.pagamentos !== r.bolsa.meses) { const disp = r.mesesRest + (vinc && vinc.vaga_id === r.e.id ? Calc.mesesPeriodo(vinc.inicio, vinc.fim) : 0);
      l.avisos.push(`${x.pagamentos} pagamento(s) × ${r.bolsa.meses} previstos na posição${x.pagamentos > disp ? ` (só ${disp} disponíveis)` : ''}`); }
    if (r && r.e.horas_semanais != null && x.horas != null && num(r.e.horas_semanais) !== x.horas) l.avisos.push(`${x.horas} h/semana × ${r.e.horas_semanais} h na posição`);
  });
  /* quem está no projeto e não aparece na ficha */
  const naFicha = new Set(linhas.filter(l => l.pessoa).map(l => l.pessoa.id));
  const ids = new Set([...EP.rows.filter(q => q.e.status === 'ocupada' && q.e.pessoa_id).map(q => q.e.pessoa_id), ...D.alocacoes.filter(a => a.projeto_id === pid && a.status === 'ativo').map(a => a.pessoa_id)]);
  const ausentes = [...ids].filter(id => !naFicha.has(id)).map(id => ({ pessoa: byId('pessoas', id), posicoes: EP.rows.filter(q => q.e.status === 'ocupada' && q.e.pessoa_id === id).map(q => q.e),
    aloc: D.alocacoes.find(a => a.projeto_id === pid && a.pessoa_id === id), vincs: D.vinculos_financeiros.filter(v => v.projeto_id === pid && v.pessoa_id === id && ['previsto', 'ativo', 'suspenso'].includes(v.status)) })).filter(a => a.pessoa);
  /* dados do contrato */
  const proj = [];
  if (F.titulo) { const af = afinidadeTitulo(F.titulo, p), outros = D.projetos.filter(q => q.id !== pid).map(q => ({ q, af: afinidadeTitulo(F.titulo, q) })).sort((a, b) => b.af - a.af);
    if (af < 0.5) proj.push(`O título da ficha (“${esc(F.titulo)}”) não corresponde ao nome do projeto no sistema (“${esc(p.nome || p.sigla)}”)${outros[0] && outros[0].af >= 0.6 && outros[0].af > af ? ` — parece ser o do projeto <b>${esc(outros[0].q.sigla)}</b>. Confira se a ficha foi preenchida a partir de outra` : ''}.`); }
  if (F.contrato && p.numero_contrato && nrmPT(F.contrato).replace(/\s/g, '') !== nrmPT(p.numero_contrato).replace(/\s/g, '')) proj.push(`Nº do contrato na ficha (${esc(F.contrato)}) difere do cadastrado (${esc(p.numero_contrato)}).`);
  if (F.vigencia && F.vigencia.inicio && F.vigencia.fim && (F.vigencia.inicio !== p.inicio || F.vigencia.fim !== p.fim)) proj.push(`Vigência na ficha ${fmtD(F.vigencia.inicio)} a ${fmtD(F.vigencia.fim)} × no sistema ${fmtD(p.inicio)} a ${fmtD(p.fim)} (ajuste em “Editar dados” ou registre o aditivo, se for o caso).`);
  if (F.fundacao && p.fundacao_apoio && nrmPT(F.fundacao) !== nrmPT(p.fundacao_apoio)) proj.push(`Fundação na ficha (${esc(F.fundacao)}) difere da cadastrada (${esc(p.fundacao_apoio)}).`);
  /* ficha anterior */
  const ant = D.fichas_equipe.filter(f => f.projeto_id === pid).sort((a, b) => String(b.data).localeCompare(String(a.data)) || num(b.numero) - num(a.numero))[0] || null;
  let dif = null;
  if (ant) { const A0 = ant.participantes || [], acha = (lista, x) => lista.find(y => mesmoNome(y.nome, x.nome));
    dif = { ant, entram: F.participantes.filter(x => !acha(A0, x)).map(x => x.nome), saem: A0.filter(y => !acha(F.participantes, y)).map(y => y.nome),
      mudam: F.participantes.map(x => { const y = acha(A0, x); if (!y) return null; const m = [];
        if (num(y.valor) !== num(x.valor)) m.push(`valor ${fmtBRL2(y.valor)} → ${fmtBRL2(x.valor)}`); if (num(y.pagamentos) !== num(x.pagamentos)) m.push(`pagamentos ${y.pagamentos} → ${x.pagamentos}`);
        if (num(y.horas) !== num(x.horas)) m.push(`${y.horas} h → ${x.horas} h`); if (y.inicio !== x.inicio || y.fim !== x.fim) m.push(`período ${fmtD(y.inicio)}–${fmtD(y.fim)} → ${fmtD(x.inicio)}–${fmtD(x.fim)}`);
        return m.length ? `${x.nome}: ${m.join(', ')}` : null; }).filter(Boolean) }; }
  if (dif && !dif.entram.length && !dif.saem.length && !dif.mudam.length && dif.ant.data === F.data) proj.push(`Esta ficha parece já estar registrada (${dif.ant.numero ? esc(dif.ant.numero) + 'ª ficha' : 'ficha'} de ${fmtD(dif.ant.data)}, mesma equipe). Aplicar de novo só cria outro registro.`);
  return { p, EP, linhas, ausentes, proj, dif, efin };
}

/* ── tela: Equipe do projeto → fichas de gestão ───────────────────────── */
function projFichas(p) {
  if (!Perm.veFin(p.id)) return '';
  const lista = D.fichas_equipe.filter(f => f.projeto_id === p.id).sort((a, b) => String(b.data).localeCompare(String(a.data)) || num(b.numero) - num(a.numero)), pode = Perm.importaFicha(p.id);
  return `<div class="toolbar mt"><span class="sec" style="margin:0">Fichas de gestão da equipe <span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:400">(${lista.length} · autorizações da UFSM para alterar a equipe executora)</span></span>${pode ? `<button class="btn-s" data-a="fichaImportar" data-projeto="${p.id}">Importar ficha de gestão…</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${lista.length ? `<table class="t"><tr><th>Nº</th><th>Data</th><th>Formulário</th><th class="num">Participantes</th><th>Mudanças aplicadas</th><th>Registrada por</th></tr>
    ${lista.map(f => { const r = ((f.alteracoes || {}).resumo) || ''; return `<tr class="click" data-a="fichaVer" data-id="${f.id}"><td><b>${f.numero ? esc(f.numero) + 'ª' : '—'}</b></td><td>${fmtD(f.data)}</td><td class="small">${esc(f.formulario || '—')}</td>
      <td class="num">${(f.participantes || []).length}</td><td class="small">${esc(r || '—')}</td><td class="small">${esc(f.autor || '—')}</td></tr>`; }).join('')}</table>`
    : `<div class="empty">Nenhuma ficha registrada.${pode ? ' Ao receber uma ficha de gestão (inicial ou retificadora), importe o PDF: o programa confere o documento e atualiza posições, alocações e bolsas.' : ''}</div>`}</div>`;
}
A.fichaImportar = d => {
  const p = byId('projetos', d.projeto); if (!p || !Perm.importaFicha(p.id)) falha('Você não tem permissão para importar fichas de gestão deste projeto (é preciso gerir a equipe e ver o financeiro do projeto).');
  if (SB.faltam && SB.faltam.has('fichas_equipe')) falha('O banco online ainda não tem a tabela das fichas: rode o arquivo atualizacao_para_1.12.sql no SQL Editor da Supabase.');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,.json';
  inp.onchange = () => run(async () => { const f = inp.files[0]; if (!f) return; flash('Lendo a ficha de gestão…'); const F = await lerFicha(f); previaFicha(F, p.id); });
  inp.click();
};
const nomeVaga = id => { const e = byId('equipe_plano', id); return e ? e.nome_plano : ''; };
function previaFicha(F, pid, est) {
  const PL = planoFicha(F, pid), { p, EP, linhas, ausentes, proj, dif, efin } = PL;
  est = est || { vagas: {}, bolsa: {}, ausente: {}, saida: (F.aprovacoes && (F.aprovacoes.coordenacao || {}).data) || hoje() };
  linhas.forEach((l, i) => { if (est.vagas[i] !== undefined) { l.vaga = est.vagas[i]; l.r = l.vaga && l.vaga !== 'nova' ? EP.rows.find(q => q.e.id === l.vaga) || null : null; } if (est.bolsa[i] !== undefined) l.bolsa = efin && est.bolsa[i]; });
  const pend = F.conferencias.filter(c => !c.ok), escolhidas = new Set(linhas.map(l => l.vaga).filter(v => v && v !== 'nova'));
  const opcoesVaga = (l, i) => {
    const livres = EP.rows.filter(q => (['vaga', 'selecao'].includes(q.e.status) || (l.pessoa && q.e.pessoa_id === l.pessoa.id)) && (!escolhidas.has(q.e.id) || q.e.id === l.vaga));
    return `<select class="fi-vaga" data-i="${i}" style="max-width:230px"><option value="">— sem posição (só alocação) —</option><option value="nova"${l.vaga === 'nova' ? ' selected' : ''}>+ nova posição “${esc(l.x.nome)}”</option>${livres.map(q => `<option value="${q.e.id}"${q.e.id === l.vaga ? ' selected' : ''}>${esc(q.e.nome_plano)}${q.bolsa && Perm.veFin(pid) ? ' · ' + fmtBRL(q.bolsa.valor_mensal) : ''}${q.e.status === 'ocupada' ? ' (atual)' : ''}</option>`).join('')}</select>`;
  };
  const acao = l => {
    const a = [];
    if (!l.pessoa) a.push('<span style="color:var(--blue)">cadastrar pessoa</span>');
    if (l.encerra) a.push(`<span style="color:var(--yellow-txt)">participação encerrada em ${fmtD(l.x.fim)}</span>`);
    else if (!l.aloc) a.push('alocar no projeto'); else if (l.aloc.status !== 'ativo') a.push('reativar alocação');
    if (l.bolsa) { const v = l.vinc; a.push(!v ? 'registrar bolsa' : (Math.abs(num(v.valor_mensal) - l.x.valor) >= 0.01 || v.inicio !== l.x.inicio || v.fim !== l.x.fim) ? `atualizar bolsa <span class="faint">(${fmtBRL(v.valor_mensal)} ${fmtD(v.inicio)}–${fmtD(v.fim)})</span>` : '<span class="faint">bolsa já confere</span>'); }
    return a.join(' · ') || '<span class="faint">já confere</span>';
  };
  const html = `<div class="between mb"><h3 style="margin:0">Ficha de gestão da equipe — ${esc(p.sigla)}</h3><button class="btn-s" id="fi_x">✕</button></div>
  <div class="note mb small">Arquivo: <b>${esc(F.arquivo)}</b> · ${esc(F.formato || '')}. Nada é gravado até clicar em “Aplicar”. O CPF dos participantes não é guardado.
    ${F.avisos.length ? '<br>' + F.avisos.map(a => '⚠ ' + esc(a)).join('<br>') : ''}</div>
  ${proj.length ? `<div class="alert warn small mb"><div>${proj.map(s => '⚠ ' + s).join('<br>')}</div></div>` : ''}
  <details class="mb" ${pend.length ? 'open' : ''}><summary class="small"><b>Conferências do documento:</b> ${pend.length ? `<span style="color:var(--red)">${pend.length} divergência(s)</span> de ${F.conferencias.length}` : `<span style="color:var(--green)">todas as ${F.conferencias.length} conferem</span>`}</summary>
    <div class="small" style="padding:4px 0 0 14px">${pend.map(c => `<div><span style="color:var(--red)">✗</span> ${esc(c.txt)}</div>`).join('')}
      <details${pend.length ? '' : ' open'}><summary class="muted">${F.conferencias.length - pend.length} conferem</summary>${F.conferencias.filter(c => c.ok).map(c => `<div><span style="color:var(--green)">✓</span> ${esc(c.txt)}</div>`).join('')}</details></div></details>
  <div class="kv mb small"><span class="k">Título</span><span>${esc(F.titulo || '—')}</span><span class="k">Processo · contrato</span><span>${esc(F.processo || '—')} · ${esc(F.contrato || '—')}${F.fundacao ? ' · ' + esc(F.fundacao) : ''}</span>
    <span class="k">Vigência</span><span>${F.vigencia && F.vigencia.inicio ? fmtD(F.vigencia.inicio) + ' a ' + fmtD(F.vigencia.fim) : '—'}</span><span class="k">Formulário</span><span>${esc(F.formulario || '—')}${F.referencia ? ' · referência ' + esc(F.referencia) : ''}</span>
    <span class="k">Aprovações</span><span>${[['coordenacao', 'coordenação'], ['fiscal', 'fiscal'], ['pra', 'PRA']].map(([k, n]) => `${n}: ${(F.aprovacoes || {})[k] && F.aprovacoes[k].data ? fmtD(F.aprovacoes[k].data) : '<span class="faint">pendente</span>'}`).join(' · ')}</span>
    <span class="k">Equipe</span><span>${F.resumo.ufsm} da UFSM + ${F.resumo.externos} externo(s) · total autorizado ${fmtBRL2(F.resumo.total)}</span></div>
  ${F.descricao ? `<div class="small muted mb"><b>Adequação:</b> ${esc(F.descricao)}</div>` : ''}
  ${dif ? `<div class="note small mb"><b>Em relação à ${dif.ant.numero ? esc(dif.ant.numero) + 'ª ficha' : 'ficha anterior'} (${fmtD(dif.ant.data)}):</b> ${!dif.entram.length && !dif.saem.length && !dif.mudam.length ? 'nenhuma mudança na equipe.' : ''}
    ${dif.entram.length ? `<br>entram: ${esc(dif.entram.join(', '))}` : ''}${dif.saem.length ? `<br>saem da ficha: ${esc(dif.saem.join(', '))}` : ''}${dif.mudam.length ? '<br>' + dif.mudam.map(esc).join('<br>') : ''}</div>` : ''}
  <div class="sec" style="margin-top:0">1 · Participantes da ficha (${linhas.length})</div>
  <div class="tw mb" style="max-height:360px;overflow:auto"><table class="t small"><tr><th>Nº</th><th>Participante</th><th>Vínculo</th><th class="num">h/sem</th><th class="num">Pagtos</th><th class="num">Valor</th><th>Período</th><th>Posição do plano</th>${efin ? '<th>Bolsa</th>' : ''}<th>No sistema</th></tr>
    ${linhas.map((l, i) => `<tr><td class="muted">${l.x.grupo === 'externo' ? 'E' : ''}${esc(l.x.n)}</td><td style="min-width:170px"><b>${esc(l.x.nome)}</b>${l.pessoa && nrmPT(l.pessoa.nome) !== nrmPT(l.x.nome) ? `<div class="faint">no sistema: ${esc(l.pessoa.nome)}</div>` : ''}</td>
      <td>${esc([l.x.vinculo, l.x.funcao].filter(Boolean).join(' · ') || '—')}${l.x.unidade ? `<div class="faint">${esc(l.x.unidade)}</div>` : ''}</td><td class="num">${l.x.horas ?? '—'}</td><td class="num">${l.x.pagamentos ?? '—'}</td><td class="num">${l.x.valor != null ? fmtBRL2(l.x.valor) : '—'}</td>
      <td style="white-space:nowrap">${fmtD(l.x.inicio)} → ${fmtD(l.x.fim)}${l.x.fimCorrigido ? `<div style="color:var(--red)" title="Data inexistente na ficha">ficha: ${esc(l.x.fimTxt)}</div>` : ''}</td>
      <td>${opcoesVaga(l, i)}${l.avisos.length ? `<div style="color:var(--yellow-txt)">⚠ ${l.avisos.map(esc).join('; ')}</div>` : ''}</td>
      ${efin ? `<td><input type="checkbox" class="fi-bolsa" data-i="${i}"${l.bolsa ? ' checked' : ''}${!(l.x.valor > 0) ? ' disabled' : ''} title="Registrar/atualizar a bolsa com o valor e o período da ficha"></td>` : ''}<td>${acao(l)}</td></tr>`).join('')}</table></div>
  ${!efin ? '<div class="small muted mb">Você não edita o financeiro deste projeto: as bolsas não serão registradas (só posições e alocações).</div>' : ''}
  <div class="sec">2 · No projeto, mas fora da ficha (${ausentes.length})</div>
  ${ausentes.length ? `<div class="small muted mb">A ficha traz a equipe completa: quem não aparece nela não está autorizado no projeto. Marque quem deve ter a participação encerrada (posição liberada, alocação concluída e bolsa encerrada na data abaixo).</div>
    <div class="tw mb"><table class="t small"><tr><th></th><th>Pessoa</th><th>No projeto</th>${Perm.veFin(pid) ? '<th>Bolsa</th>' : ''}</tr>${ausentes.map((a, k) => `<tr><td><input type="checkbox" class="fi-aus" data-k="${k}"${est.ausente[k] ? ' checked' : ''}${a.aloc && a.aloc.coordena ? ' title="coordena o projeto"' : ''}></td><td><b>${esc(a.pessoa.nome)}</b>${a.aloc && a.aloc.coordena ? ' ' + badge('coordena', 'b-green') : ''}</td>
      <td>${esc([...a.posicoes.map(e => e.nome_plano), a.aloc ? (a.aloc.papel || 'alocação') + ' · ' + num(a.aloc.carga_pct) + '%' : ''].filter(Boolean).join(' · ') || '—')}</td>${Perm.veFin(pid) ? `<td>${a.vincs.map(v => `${fmtBRL(v.valor_mensal)} até ${fmtD(v.fim)}`).join('; ') || '—'}</td>` : ''}</tr>`).join('')}</table></div>
    <div class="row small mb">Encerrar em <input type="date" id="fi_saida" value="${esc(est.saida)}" style="width:auto"></div>` : '<div class="empty small mb">Todos os que estão no projeto constam na ficha.</div>'}
  <div class="sec">3 · Registro</div>
  ${p.numero_contrato || !F.contrato || !Perm.gereProjeto(pid) ? '' : `<label class="row small mb"><input type="checkbox" id="fi_contrato" checked> preencher o nº do contrato do projeto com ${esc(F.contrato)}</label>`}
  <div class="fgrid mb"><div><label class="fl">Data da ficha</label><input id="fi_data" type="date" value="${esc(F.data || hoje())}"></div><div><label class="fl">Documento</label><input id="fi_doc" value="${esc(F.arquivo || '')}"></div></div>
  ${pend.length ? `<div class="alert warn mt small"><label class="row"><input type="checkbox" id="fi_conf"> Revisei as ${pend.length} divergência(s) das conferências (as datas inexistentes são gravadas como mostrado na coluna Período)</label></div>` : ''}
  <div class="merr" id="fi_err" style="display:none"></div>
  <div class="mactions"><button id="fi_pad" title="Baixa o que foi lido no formato padrão do GPMOT (.json), sem CPF: serve para conferir, corrigir à mão e carregar de novo">Baixar ficha padrão (.json)</button><button id="fi_c">Cancelar</button><button class="btn-p" id="fi_ok">Aplicar</button></div>`;
  openModal(html, { wide: true, sticky: true, noFocus: true });
  const root = document.getElementById('modal-root'), q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const guardar = () => { qa('.fi-aus').forEach(c => est.ausente[+c.dataset.k] = c.checked); qa('.fi-bolsa').forEach(c => est.bolsa[+c.dataset.i] = c.checked); if (q('#fi_saida')) est.saida = q('#fi_saida').value; };
  q('#fi_x').onclick = q('#fi_c').onclick = closeModal;
  qa('.fi-vaga').forEach(sel => sel.onchange = () => { guardar(); est.vagas[+sel.dataset.i] = sel.value; previaFicha(F, pid, est); });
  q('#fi_pad').onclick = () => baixar((F.arquivo || 'ficha').replace(/\.[^.]+$/, '') + ' — ficha de equipe padrão GPMOT.json', JSON.stringify(fichaParaPadrao(F), null, 1), 'application/json');
  q('#fi_ok').onclick = async () => {
    const err = m => { const el = q('#fi_err'); el.textContent = m; el.style.display = 'block'; };
    if (q('#fi_conf') && !q('#fi_conf').checked) return err('Há divergências nas conferências do documento: revise-as e marque a confirmação para aplicar.');
    guardar();
    const semData = linhas.filter(l => !l.x.inicio || !l.x.fim); if (semData.length) return err('Sem período válido: ' + semData.map(l => l.x.nome).join(', ') + '. Corrija no JSON padrão e carregue de novo.');
    const aus = ausentes.filter((a, k) => est.ausente[k]); if (aus.length && !isDate(est.saida)) return err('Informe a data de encerramento de quem está fora da ficha.');
    const btn = q('#fi_ok'); btn.disabled = true;
    try {
      const res = await aplicarFicha(F, PL, { ausentes: aus, saida: est.saida, data: isDate(q('#fi_data').value) ? q('#fi_data').value : (F.data || hoje()), documento: q('#fi_doc').value.trim() || null, contrato: !!(q('#fi_contrato') && q('#fi_contrato').checked) });
      closeModal(); UI.tab = 'projetos'; UI.projeto = pid; UI.projAba = 'equipe'; render(); flash('✓ Ficha aplicada: ' + res);
    } catch (e) { console.error(e); err(traduzErro(e)); btn.disabled = false; }
  };
}

/* ── aplicar a ficha ─────────────────────────────────────────────────── */
async function aplicarFicha(F, PL, op) {
  const { p, linhas, efin } = PL, pid = p.id, H = hoje();
  if (!Perm.importaFicha(pid)) falha('Você não tem permissão para importar fichas de gestão deste projeto.');
  const numero = Math.max(0, ...D.fichas_equipe.filter(f => f.projeto_id === pid).map(f => num(f.numero))) + 1, ref = `Ficha de gestão nº ${numero} (${fmtD(op.data)})`;
  const cont = { pessoas: 0, posicoes: 0, alocacoes: 0, bolsasNovas: 0, bolsasAlt: 0, encerrados: 0 }, reg = [];
  const temCoord = D.alocacoes.some(a => a.projeto_id === pid && a.coordena);
  const cargaDe = h => h != null ? Math.max(5, Math.min(100, Math.round(num(h) / 40 * 100 / 5) * 5)) : 25;
  for (const l of linhas) {
    const x = l.x, acoes = []; let pessoa = l.pessoa;
    const cats = categoriaFicha(x), pos = l.vaga && l.vaga !== 'nova' ? byId('equipe_plano', l.vaga) : null;
    if (!pessoa) {
      const tipo = pos && pos.categoria !== 'outro' ? pos.categoria : (cats[0] || (x.grupo === 'externo' ? 'externo' : 'outro'));
      pessoa = await Data.insert('pessoas', { nome: x.nome, tipo: TIPOS_PESSOA.some(t => t[0] === tipo) ? tipo : 'outro', ingresso: x.inicio, disponibilidade_pct: 100, perfil_disponibilidade: x.grupo === 'externo' ? 'externo' : 'interno', ativo: !l.encerra });
      cont.pessoas++; acoes.push('pessoa cadastrada');
    }
    /* posição do plano */
    let vagaId = null;
    if (pos) {
      vagaId = pos.id;
      if (l.encerra) { if (pos.status === 'ocupada' && pos.pessoa_id === pessoa.id) { await Data.update('equipe_plano', pos.id, { status: 'vaga', pessoa_id: null, desde: null, obs: [pos.obs, `${pessoa.nome}: ${fmtD(pos.desde || x.inicio)} a ${fmtD(x.fim)} (${ref})`].filter(Boolean).join('\n') }); acoes.push('posição liberada'); cont.posicoes++; } }
      else if (pos.pessoa_id !== pessoa.id || pos.status !== 'ocupada') { await Data.update('equipe_plano', pos.id, { status: 'ocupada', pessoa_id: pessoa.id, desde: x.inicio, ...(pos.horas_semanais == null && x.horas != null ? { horas_semanais: x.horas } : {}) }); acoes.push('ocupa ' + pos.nome_plano); cont.posicoes++; }
    } else if (l.vaga === 'nova' && !l.encerra) {
      const ordem = Math.max(0, ...D.equipe_plano.filter(q => q.projeto_id === pid).map(q => num(q.ordem))) + 1;
      const e = await Data.insert('equipe_plano', { projeto_id: pid, ordem, nome_plano: x.nome, funcao: x.funcao || x.vinculo || null, categoria: CAT_PLANO.some(c => c[0] === cats[0]) ? cats[0] : 'outro', horas_semanais: x.horas, status: 'ocupada', pessoa_id: pessoa.id, desde: x.inicio, obs: 'Incluída pela ' + ref });
      vagaId = e.id; acoes.push('nova posição'); cont.posicoes++;
    }
    /* alocação */
    const al = D.alocacoes.find(a => a.projeto_id === pid && a.pessoa_id === pessoa.id);
    if (l.encerra) { if (al && al.status === 'ativo' && !al.coordena) { await Data.update('alocacoes', al.id, { status: 'concluido' }); acoes.push('alocação concluída'); cont.alocacoes++; } }
    else if (!al) { const ehCoord = F.coordenador && mesmoNome(F.coordenador, x.nome) && !temCoord;
      await Data.insert('alocacoes', { pessoa_id: pessoa.id, projeto_id: pid, nivel: ehCoord ? 3 : 2, carga_pct: cargaDe(x.horas), papel: (pos && pos.funcao) || x.funcao || x.vinculo || null, status: 'ativo', desde: x.inicio, coordena: !!ehCoord,
        atribuicao: pos && (pos.etapas || []).length ? 'Etapas no plano: ' + etapasTopo(pos.etapas).join(', ') : null });
      acoes.push('alocado' + (ehCoord ? ' (coordena)' : '')); cont.alocacoes++; }
    else if (al.status !== 'ativo') { await Data.update('alocacoes', al.id, { status: 'ativo' }); acoes.push('alocação reativada'); cont.alocacoes++; }
    /* bolsa */
    if (efin && l.bolsa) {
      const vb = pos ? D.equipe_plano_bolsas.find(b => b.vaga_id === pos.id) : null;
      const st = l.encerra || x.fim < H ? 'encerrado' : 'previsto';   // a implantação (ativa) é marcada no financeiro quando os pagamentos começam
      const v = l.vinc && byId('vinculos_financeiros', l.vinc.id);
      if (v) { const muda = Math.abs(num(v.valor_mensal) - x.valor) >= 0.01 || v.inicio !== x.inicio || v.fim !== x.fim || (vagaId && v.vaga_id !== vagaId) || (l.encerra && v.status !== 'encerrado');
        if (muda) { await Data.update('vinculos_financeiros', v.id, { valor_mensal: x.valor, inicio: x.inicio, fim: x.fim, ...(vagaId ? { vaga_id: vagaId } : {}), ...(l.encerra ? { status: 'encerrado' } : {}), obs: [v.obs, `${ref}: ${fmtBRL2(x.valor)} × ${x.pagamentos || '?'} de ${fmtD(x.inicio)} a ${fmtD(x.fim)}`].filter(Boolean).join('\n') });
          acoes.push('bolsa atualizada'); cont.bolsasAlt++; } }
      else { await Data.insert('vinculos_financeiros', { pessoa_id: pessoa.id, projeto_id: pid, vaga_id: vagaId, tipo: x.grupo === 'externo' && ehCLT(x) ? 'tecnico' : x.grupo === 'externo' && !/bolsa/i.test(x.vinculo) ? 'externo' : 'bolsa',
          modalidade: (vb && vb.modalidade) || [x.vinculo, x.funcao].filter(Boolean).join(' · ') || null, rubrica: (vb && vb.rubrica) || (ehCLT(x) ? '1.1.2' : '1.1.1'), valor_mensal: x.valor, inicio: x.inicio, fim: x.fim, status: st,
          obs: `${ref}: ${x.pagamentos || '?'} pagamento(s)${pos ? ' · posição ' + pos.nome_plano : ''}` });
        acoes.push('bolsa registrada'); cont.bolsasNovas++; }
    }
    if (l.encerra) cont.encerrados++;
    reg.push({ nome: x.nome, pessoa_id: pessoa.id, vaga_id: vagaId, acoes });
  }
  /* quem está fora da ficha */
  const regAus = [];
  for (const a of op.ausentes) {
    const acoes = [];
    for (const e of a.posicoes) { const cur = byId('equipe_plano', e.id); if (cur && cur.status === 'ocupada' && cur.pessoa_id === a.pessoa.id) { await Data.update('equipe_plano', e.id, { status: 'vaga', pessoa_id: null, desde: null, obs: [cur.obs, `${a.pessoa.nome}: ${fmtD(cur.desde)} a ${fmtD(op.saida)} (fora da ${ref})`].filter(Boolean).join('\n') }); acoes.push('posição liberada'); } }
    if (efin) for (const v of a.vincs) { const cur = byId('vinculos_financeiros', v.id); if (!cur) continue;
      if (op.saida < cur.inicio) { acoes.push(`bolsa de ${fmtD(cur.inicio)} mantida (começa depois da saída — exclua-a em Financeiro › Bolsas, se for o caso)`); continue; }
      await Data.update('vinculos_financeiros', cur.id, { fim: op.saida < cur.fim ? op.saida : cur.fim, status: op.saida <= H ? 'encerrado' : cur.status, obs: [cur.obs, `Encerrada: fora da ${ref}`].filter(Boolean).join('\n') }); acoes.push('bolsa encerrada'); }
    const al = D.alocacoes.find(x => x.projeto_id === pid && x.pessoa_id === a.pessoa.id);
    if (al && al.status === 'ativo') { if (al.coordena) acoes.push('coordenação mantida'); else { await Data.update('alocacoes', al.id, { status: 'concluido' }); acoes.push('alocação concluída'); } }
    regAus.push({ nome: a.pessoa.nome, pessoa_id: a.pessoa.id, saida: op.saida, acoes }); cont.encerrados++;
  }
  if (op.contrato && F.contrato && !p.numero_contrato && Perm.gereProjeto(pid)) await Data.update('projetos', pid, { numero_contrato: F.contrato });
  const resumo = [cont.pessoas && `${cont.pessoas} pessoa(s) nova(s)`, cont.posicoes && `${cont.posicoes} posição(ões)`, cont.alocacoes && `${cont.alocacoes} alocação(ões)`,
    cont.bolsasNovas && `${cont.bolsasNovas} bolsa(s) registrada(s)`, cont.bolsasAlt && `${cont.bolsasAlt} bolsa(s) atualizada(s)`, cont.encerrados && `${cont.encerrados} participação(ões) encerrada(s)`].filter(Boolean).join(', ') || 'nenhuma mudança necessária';
  const participantes = F.participantes.map(x => ({ grupo: x.grupo, nome: x.nome, unidade: x.unidade || null, vinculo: x.vinculo || null, funcao: x.funcao || null, horas: x.horas, pagamentos: x.pagamentos, valor: x.valor, inicio: x.inicio, fim: x.fim, ...(x.fimCorrigido ? { fim_ficha: x.fimTxt } : {}) }));
  await Data.insert('fichas_equipe', { projeto_id: pid, numero, data: op.data, formulario: F.formulario || null, referencia: F.referencia ? [F.fundacao, F.referencia].filter(Boolean).join(' ') : null, processo: F.processo || null, contrato: F.contrato || null,
    vigencia_inicio: (F.vigencia || {}).inicio || null, vigencia_fim: (F.vigencia || {}).fim || null, descricao: F.descricao || null, documento: op.documento, participantes, aprovacoes: F.aprovacoes || {},
    alteracoes: { resumo, linhas: reg, ausentes: regAus, conferencias: F.conferencias.filter(c => !c.ok).map(c => c.txt), avisos: PL.proj.map(s => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')) }, aplicada_em: new Date().toISOString(),
    autor: ME.pessoa_id ? nomePessoa(ME.pessoa_id) : (ME.email || null) });
  return resumo;
}

A.fichaVer = d => {
  const f = byId('fichas_equipe', d.id); if (!f) return;
  const alt = f.alteracoes || {}, ps = f.participantes || [], ap = f.aprovacoes || {};
  const html = `<div class="between mb"><h3 style="margin:0">${f.numero ? esc(f.numero) + 'ª f' : 'F'}icha de gestão da equipe — ${esc(siglaProjeto(f.projeto_id))}</h3><button class="btn-s" id="fv_x">✕</button></div>
  <div class="kv mb small"><span class="k">Data</span><span>${fmtD(f.data)}${f.formulario ? ' · ' + esc(f.formulario) : ''}${f.referencia ? ' · ref. ' + esc(f.referencia) : ''}</span>
    <span class="k">Processo · contrato</span><span>${esc(f.processo || '—')} · ${esc(f.contrato || '—')}</span><span class="k">Vigência</span><span>${f.vigencia_inicio ? fmtD(f.vigencia_inicio) + ' a ' + fmtD(f.vigencia_fim) : '—'}</span>
    <span class="k">Aprovações</span><span>${[['coordenacao', 'coordenação'], ['fiscal', 'fiscal'], ['pra', 'PRA']].map(([k, n]) => `${n}: ${ap[k] && ap[k].data ? esc(fmtD(String(ap[k].data))) : 'pendente'}`).join(' · ')}</span>
    <span class="k">Registrada</span><span>${esc(f.autor || '—')}${f.documento ? ' · ' + esc(f.documento) : ''}</span><span class="k">Aplicada</span><span>${esc(alt.resumo || '—')}</span></div>
  ${f.descricao ? `<div class="small muted mb"><b>Adequação:</b> ${esc(f.descricao)}</div>` : ''}
  <div class="tw mb" style="max-height:340px;overflow:auto"><table class="t small"><tr><th>Participante</th><th>Vínculo</th><th class="num">h/sem</th><th class="num">Pagtos</th><th class="num">Valor</th><th>Período</th><th>Aplicado</th></tr>
    ${ps.map(x => { const r = (alt.linhas || []).find(l => l.nome === x.nome); return `<tr><td><b>${esc(x.nome)}</b>${x.grupo === 'externo' ? ' ' + badge('externo', 'b-gray') : ''}${x.unidade ? `<div class="faint">${esc(x.unidade)}</div>` : ''}</td><td>${esc([x.vinculo, x.funcao].filter(Boolean).join(' · ') || '—')}</td>
      <td class="num">${esc(x.horas ?? '—')}</td><td class="num">${esc(x.pagamentos ?? '—')}</td><td class="num">${x.valor != null ? fmtBRL2(x.valor) : '—'}</td><td style="white-space:nowrap">${esc(fmtD(String(x.inicio || '')))} → ${esc(fmtD(String(x.fim || '')))}${x.fim_ficha ? `<div class="faint">ficha: ${esc(x.fim_ficha)}</div>` : ''}</td>
      <td class="small">${esc(r && (r.acoes || []).length ? r.acoes.join(', ') : 'já conferia')}</td></tr>`; }).join('')}</table></div>
  ${(alt.ausentes || []).length ? `<div class="small mb"><b>Encerrados por não constarem na ficha:</b> ${alt.ausentes.map(a => `${esc(a.nome)} (${esc(fmtD(String(a.saida || '')))}: ${esc(a.acoes.join(', ') || '—')})`).join('; ')}</div>` : ''}
  ${(alt.conferencias || []).length || (alt.avisos || []).length ? `<details class="mb"><summary class="small"><b>Divergências registradas na importação (${(alt.conferencias || []).length + (alt.avisos || []).length})</b></summary><div class="small" style="padding:4px 0 0 14px">${[...(alt.avisos || []), ...(alt.conferencias || [])].map(s => '⚠ ' + esc(s)).join('<br>')}</div></details>` : ''}
  <div class="mactions">${Perm.dir() ? '<button class="btn-d left" id="fv_del" title="Apaga só o registro da ficha; posições, alocações e bolsas ficam como estão">Excluir registro</button>' : ''}<button id="fv_c">Fechar</button></div>`;
  openModal(html, { wide: true, noFocus: true });
  const root = document.getElementById('modal-root'), q = s => root.querySelector(s);
  q('#fv_x').onclick = q('#fv_c').onclick = closeModal;
  if (q('#fv_del')) q('#fv_del').onclick = () => run(async () => { if (!await confirmar('Excluir o registro desta ficha? Posições, alocações e bolsas não mudam.')) return; await Data.remove('fichas_equipe', f.id); closeModal(); render(); flash('✓ Registro da ficha excluído'); });
};
