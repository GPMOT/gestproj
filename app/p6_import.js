
/* ════════════════════════════════════════════════════════════════════
   IMPORTAÇÃO DA PLANILHA PADRÃO DO EDITAL (.xlsx) — parte UFSM
   Leitor de .xlsx embutido (sem bibliotecas externas, funciona offline).
   ════════════════════════════════════════════════════════════════════ */
async function lerXLSX(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) falha('O arquivo não é uma planilha .xlsx válida.');
  const n = dv.getUint16(e + 10, true), cd = dv.getUint32(e + 16, true), ent = {};
  for (let i = 0, p = cd; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    ent[new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl))] = { metodo, csize, off }; p += 46 + nl + xl + cl;
  }
  const texto = async nome => {
    const en = ent[nome]; if (!en) return null;
    const l = en.off, ini = l + 30 + dv.getUint16(l + 26, true) + dv.getUint16(l + 28, true), dados = buf.subarray(ini, ini + en.csize);
    if (en.metodo === 0) return new TextDecoder().decode(dados);
    if (typeof DecompressionStream === 'undefined') falha('Este navegador não consegue ler .xlsx. Use Chrome, Edge ou Firefox atualizados.');
    const out = await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return new TextDecoder().decode(out);
  };
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const wbx = xml(await texto('xl/workbook.xml') || falha('Planilha sem workbook.'));
  const rels = xml(await texto('xl/_rels/workbook.xml.rels') || '<r/>');
  const alvo = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => alvo[r.getAttribute('Id')] = r.getAttribute('Target'));
  const abas = [...wbx.getElementsByTagName('sheet')].map(s => { const t = alvo[s.getAttribute('r:id')] || ''; return { nome: s.getAttribute('name'), arq: t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '') }; });
  const sstTxt = await texto('xl/sharedStrings.xml');
  const sst = sstTxt ? [...xml(sstTxt).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const col = ref => { let c = 0; for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c; };
  const cache = {};
  return {
    abas: abas.map(a => a.nome),
    async aba(re) {
      const a = abas.find(x => re.test(x.nome)); if (!a) return null;
      if (cache[a.nome]) return cache[a.nome];
      const doc = xml(await texto(a.arq) || '<x/>'), cel = new Map(); let maxR = 0;
      for (const c of doc.getElementsByTagName('c')) {
        const r = c.getAttribute('r'), t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
        let val = null;
        if (t === 's') val = v ? sst[+v.textContent] : null;
        else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else if (t === 'str') val = v ? v.textContent : null;
        else if (t === 'b') val = v ? v.textContent === '1' : null;
        else if (t === 'e') val = null;
        else val = v ? Number(v.textContent) : null;
        if (val === null || val === '') continue;
        const rn = +r.replace(/[A-Z]+/g, ''), cn = col(r); cel.set(rn + ':' + cn, val); if (rn > maxR) maxR = rn;
      }
      const sh = { nome: a.nome, maxR, v: (r, c) => cel.get(r + ':' + c) ?? null, s: (r, c) => { const x = cel.get(r + ':' + c); return x == null ? '' : String(x).trim(); },
        acha(re, r0 = 1, r1 = maxR) { for (const [k, v] of cel) { const [r, c] = k.split(':').map(Number); if (r >= r0 && r <= r1 && re.test(String(v))) return { r, c }; } return null; },
        linha(r, c0 = 1, c1 = 200) { const out = []; for (let c = c0; c <= c1; c++) out.push(cel.get(r + ':' + c) ?? null); return out; } };
      cache[a.nome] = sh; return sh;
    },
  };
}

/* rótulo → valor: "Programa: Mover - FUNDEP" ou rótulo numa célula e valor na próxima não vazia à direita */
function rotuloValor(sh, re) {
  if (!sh) return '';
  const a = sh.acha(re); if (!a) return '';
  const txt = sh.s(a.r, a.c), m = txt.match(/:\s*(.+)$/);
  if (m && m[1].trim()) return m[1].trim();
  for (let c = a.c + 1; c <= a.c + 12; c++) { const v = sh.s(a.r, c); if (v && !/^(coordenador geral|proponente)$/i.test(v)) return v; }
  return '';
}
async function lerModeloEdital(file) {
  const wb = await lerXLSX(file);
  const ins = await wb.aba(/instru/i), dados = await wb.aba(/dados do projeto/i), eq = await wb.aba(/equipe/i), atv = await wb.aba(/atividades/i), orc = await wb.aba(/or[çc]amento/i);
  if (!atv && !orc) falha('Não reconheci o modelo: a planilha precisa ter as abas de Atividades e/ou Orçamento do edital (modelo Mover/Fundep).');
  const R = { arquivo: file.name, abas: wb.abas, avisos: [] };
  const fonte = ins || dados || orc;
  const prog = rotuloValor(fonte, /^Programa:/i) || rotuloValor(dados, /^Programa/i);
  R.programa = prog.split(/\s+-\s+/)[0] || prog;
  R.financiador = (prog.split(/\s+-\s+/)[1] || '').trim();
  R.linha = rotuloValor(ins, /Programa Priorit/i) || rotuloValor(ins, /Linha/i);
  R.chamada = rotuloValor(fonte, /^Chamada/i) || rotuloValor(dados, /^Chamada/i);
  R.tema = rotuloValor(ins, /[ÁA]rea tem/i) || rotuloValor(dados, /Tema estrat/i);
  R.titulo = rotuloValor(ins, /T[ií]tulo do projeto/i) || rotuloValor(orc || atv, /^T[ií]tulo/i);
  R.meses = parseInt(rotuloValor(ins, /Vig[êe]ncia do projeto/i) || rotuloValor(dados, /Dura[çc][ãa]o/i), 10) || null;
  R.resumo = rotuloValor(ins, /^Resumo/i);
  R.coordenador = rotuloValor(orc || atv || eq, /^Coordenador/i);
  /* orçamento: coluna da UFSM na distribuição por instituição */
  R.orcamento = {}; R.gestora = ''; R.totalUFSM = 0;
  if (orc) {
    const lin = orc.acha(/^Institui[çc][ãa]o/i);
    if (lin) {
      const cols = orc.linha(lin.r); const cU = cols.findIndex(v => /^UFSM$/i.test(String(v || '').trim())) + 1;
      if (cU > 0) {
        R.gestora = orc.s(lin.r + 1, cU);
        for (let r = lin.r + 1; r <= Math.min(orc.maxR, lin.r + 40); r++) {
          let cod = null; for (let c = 1; c < cU; c++) { const s = orc.s(r, c); if (/^\d+(\.\d+)*$/.test(s)) { cod = s; break; } if (/^total$/i.test(s)) { cod = 'total'; break; } }
          if (!cod) continue; const v = num(orc.v(r, cU));
          if (cod === 'total') { R.totalUFSM = v; break; }
          R.orcamento[cod] = Math.round(v * 100) / 100;
        }
        if (!R.totalUFSM) R.totalUFSM = ['1', '2'].reduce((s, k) => s + num(R.orcamento[k]), 0);
      } else R.avisos.push('Não encontrei a coluna "UFSM" na distribuição do orçamento por instituição.');
    } else R.avisos.push('Não encontrei a tabela de distribuição do orçamento por instituição.');
  }
  /* equipe (todas as ICTs, para identificar etapas) */
  R.equipe = []; const marcasTodas = new Set(), marcasUFSM = new Set();
  if (eq) {
    const h = eq.acha(/^Nome\s*$/i);
    if (h) {
      const cab = eq.linha(h.r).map(v => String(v || '').trim().toLowerCase());
      const ci = re => cab.findIndex(v => re.test(v)) + 1;
      const cNome = h.c, cForm = ci(/forma/), cFunc = ci(/fun[çc][ãa]o/), cICT = ci(/ict|empresa/), cMail = ci(/e-?mail/), cLat = ci(/lattes/), cEt = ci(/etapas/);
      const codCols = []; if (cEt) for (let c = cEt; c <= cEt + 400; c++) { const s = eq.s(h.r + 1, c); if (/^\d+(\.\d+)*$/.test(s)) codCols.push([c, s]); }
      for (let r = h.r + 2; r <= Math.min(eq.maxR, h.r + 400); r++) {
        const nome = eq.s(r, cNome), ict = cICT ? eq.s(r, cICT) : ''; if (!nome || !ict) continue;
        const etapas = codCols.filter(([c]) => /^(x|sim|1)$/i.test(eq.s(r, c))).map(([, cod]) => cod);
        etapas.forEach(e => marcasTodas.add(e));
        const ufsm = /^UFSM$/i.test(ict); if (ufsm) etapas.forEach(e => marcasUFSM.add(e));
        R.equipe.push({ nome, formacao: cForm ? eq.s(r, cForm) : '', funcao: cFunc ? eq.s(r, cFunc) : '', ict, email: cMail ? eq.s(r, cMail).toLowerCase() : '', lattes: cLat ? eq.s(r, cLat) : '', etapas, ufsm, vaga: /^(bolsista|aluno|a contratar|vaga)/i.test(nome) });
      }
    }
  }
  /* bolsas (aba 4) e CLT (aba 5) da UFSM → bolsa prevista de cada posição */
  R.bolsas = [];
  const bol = await wb.aba(/bolsas/i), clt = await wb.aba(/clt/i);
  if (bol) for (let r = 1; r <= bol.maxR; r++) {
    const cab = bol.linha(r, 1, 30).map(v => String(v || '').trim().toLowerCase()); const cMod = cab.findIndex(v => /^modalidade/.test(v)) + 1; if (!cMod) continue;
    const ci = re => cab.findIndex(v => re.test(v)) + 1, cRec = ci(/^recebedor/), cVal = ci(/^valor/), cICT = ci(/^ict/), cMes = ci(/per[íi]odo/), cH = ci(/dedica[çc][ãa]o semanal/);
    for (let k = r + 1; k <= bol.maxR; k++) {
      if (/^total/i.test(bol.s(k, 1)) || /^modalidade/i.test(bol.s(k, cMod))) break;
      const nome = bol.s(k, cRec).replace(/\s+/g, ' ').trim(), mod = bol.s(k, cMod);
      if (!nome || !mod || !/^UFSM$/i.test(bol.s(k, cICT))) continue;
      R.bolsas.push({ nome, modalidade: mod, valor_mensal: Math.round(num(bol.v(k, cVal)) * 100) / 100, meses: parseInt(bol.v(k, cMes), 10) || 1, horas: num(bol.v(k, cH)) || null, rubrica: '1.1.1' });
    }
    r += 1;
  }
  if (clt) { const h = clt.acha(/^Recebedor/i);
    if (h) { const cab = clt.linha(h.r, 1, 30).map(v => String(v || '').trim().toLowerCase()); const ci = re => cab.findIndex(v => re.test(v)) + 1;
      const cCat = ci(/^categoria/), cCargo = ci(/^cargo/), cICT = ci(/^ict/), cMes = ci(/per[íi]odo/), cH = ci(/carga hor/), cTot = cab.findIndex((v, i) => /^valor/.test(v) && !/hh/.test(v)) + 1;
      for (let k = h.r + 1; k <= clt.maxR; k++) {
        if (/^total/i.test(clt.s(k, 1))) break;
        const nome = clt.s(k, h.c); if (!nome || !/^UFSM$/i.test(clt.s(k, cICT))) continue;
        const meses = parseInt(clt.v(k, cMes), 10) || 1;
        R.bolsas.push({ nome, modalidade: 'CLT — ' + [clt.s(k, cCargo), clt.s(k, cCat)].filter(Boolean).join(' · '), valor_mensal: Math.round(num(clt.v(k, cTot)) / meses * 100) / 100, meses, horas: num(clt.v(k, cH)) || null, rubrica: '1.1.2' });
      } } }
  { const eqU = R.equipe.filter(e => e.ufsm);
    R.bolsas.forEach(b => {
      const e = eqU.find(x => !x.bolsa && mesmoNome(x.nome, b.nome));
      if (e) e.bolsa = b;
      else { R.equipe.push({ nome: b.nome, formacao: '', funcao: b.modalidade, ict: 'UFSM', email: '', lattes: '', etapas: [], ufsm: true, vaga: /^(bolsista|aluno|a contratar|vaga)/i.test(b.nome), bolsa: b });
        R.avisos.push(`A bolsa “${b.nome}” (${b.modalidade}) não tem linha correspondente na aba de equipe; foi incluída como posição à parte.`); }
    });
    const soma = R.bolsas.reduce((t, b) => { t[b.rubrica] = (t[b.rubrica] || 0) + b.valor_mensal * b.meses; return t; }, {});
    Object.entries(soma).forEach(([c, v]) => { if (R.orcamento[c] && Math.abs(v - R.orcamento[c]) > 1) R.avisos.push(`Bolsas/CLT da UFSM somam ${fmtBRL2(v)} na rubrica ${c}, mas o orçamento traz ${fmtBRL2(R.orcamento[c])}.`); });
  }
  /* plano de aplicação: itens da UFSM nas abas 6 (passagens) a 11 (obras) */
  R.itens = [];
  for (const nomeAba of wb.abas) {
    const nAba = parseInt(nomeAba, 10), rub = ABA_RUBRICA[nAba]; if (!rub) continue;
    const sh = await wb.aba(new RegExp('^' + nomeAba.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')); if (!sh) continue;
    let origem = 'nacional', H = null;
    for (let r = 1; r <= sh.maxR; r++) {
      const l0 = sh.s(r, 1) + ' ' + sh.s(r, 2);
      if (/importad/i.test(l0) && !/^\d+$/.test(sh.s(r, 1))) { origem = 'importado'; H = null; continue; }
      if (/nacional/i.test(l0) && !/^\d+$/.test(sh.s(r, 1)) && /material|consumo|permanente/i.test(l0)) { origem = 'nacional'; H = null; continue; }
      const cab = sh.linha(r, 1, 20).map(v => String(v || '').trim().toLowerCase());
      if (/^n[º°o]\.?$/.test(cab[0]) && cab.some(v => /^ict/.test(v))) {
        const ci = re => cab.findIndex(v => re.test(v)) + 1, cv = cab.map((v, i) => /^valor \(r\$\)/.test(v) ? i + 1 : 0).filter(Boolean);
        H = { desc: ci(/^descri|^tipo$/), just: ci(/finalidade|justificativa/), ict: ci(/^ict/), unit: ci(/^valor unit/), qtd: ci(/^quant\.?(\s*\(|$)/), dias: ci(/dias/), pess: ci(/pessoas/), moeda: ci(/^moeda/), cambio: ci(/c[âa]mbio|cota[çc]/), val: cv[cv.length - 1] || 0 };
        continue;
      }
      if (!H) continue;
      if (/^total/i.test(sh.s(r, 1))) { H = null; continue; }
      if (!/^\d+$/.test(sh.s(r, 1)) || !/^UFSM$/i.test(sh.s(r, H.ict))) continue;
      const desc = sh.s(r, H.desc), valor = Math.round(num(sh.v(r, H.val)) * 100) / 100; if (!desc || !(valor > 0)) continue;
      const unit = num(sh.v(r, H.unit)), cambio = H.cambio ? num(sh.v(r, H.cambio)) : 0;
      const moedaTxt = H.moeda ? sh.s(r, H.moeda) : '', moeda = /d[óo]lar|us\$|usd/i.test(moedaTxt) ? 'USD' : /euro|eur|€/i.test(moedaTxt) ? 'EUR' : /libra|gbp/i.test(moedaTxt) ? 'GBP' : /iene|jpy/i.test(moedaTxt) ? 'JPY' : /franco|chf/i.test(moedaTxt) ? 'CHF' : 'BRL';
      const fator = unit * (moeda !== 'BRL' && cambio ? cambio : 1);
      let qtd = H.qtd ? num(sh.v(r, H.qtd)) : 0; if (!qtd && fator) qtd = Math.round(valor / fator * 100) / 100;
      const det = [H.dias && num(sh.v(r, H.dias)) ? num(sh.v(r, H.dias)) + ' dia(s)' : '', H.pess && num(sh.v(r, H.pess)) ? num(sh.v(r, H.pess)) + ' pessoa(s)' : ''].filter(Boolean).join(' · ');
      R.itens.push({ rubrica: rub, numero: parseInt(sh.s(r, 1), 10), descricao: desc, justificativa: H.just ? sh.s(r, H.just) : '', origem: moeda !== 'BRL' ? 'importado' : origem,
        quantidade: qtd || null, valor_unitario: unit || null, moeda, cambio: moeda !== 'BRL' ? cambio || null : null, detalhe: det || null, valor_previsto: valor });
    }
  }
  { const vist = {}; R.itens.forEach(i => { const k = i.rubrica; vist[k] = vist[k] || new Set(); if (vist[k].has(i.numero)) i.numero = Math.max(...vist[k]) + 1; vist[k].add(i.numero); }); }
  { const soma = {}; R.itens.forEach(i => soma[i.rubrica] = (soma[i.rubrica] || 0) + i.valor_previsto);
    Object.entries(soma).forEach(([c, v]) => { if (R.orcamento[c] != null && Math.abs(v - R.orcamento[c]) > 1) R.avisos.push(`Itens da UFSM na rubrica ${c} somam ${fmtBRL2(v)}, mas o orçamento traz ${fmtBRL2(R.orcamento[c])}.`); }); }
  /* cronograma de desembolso: bloco da gestora da UFSM (ou o que soma o aporte UFSM) */
  R.desembolso = null;
  const des = await wb.aba(/desembolso/i);
  if (des) {
    const blocos = [];
    for (let r = 1; r <= des.maxR; r++) {
      const linha = des.linha(r, 1, 40), cps = linha.map((v, i) => /^parcela\s*\d+/i.test(String(v || '').trim()) ? i + 1 : 0).filter(Boolean);
      if (!cps.length) continue;
      let nome = ''; for (let k = r - 1; k >= Math.max(1, r - 3) && !nome; k--) nome = des.linha(k, 1, 10).map(v => String(v ?? '').trim()).find(v => v && !/^\d+$/.test(v) && !/^cronograma/i.test(v)) || '';
      const parc = cps.map(c => ({ col: c, numero: parseInt(String(des.v(r, c)).replace(/\D/g, ''), 10), descricao: String(des.v(r, c)).trim(), valor: 0, dist: {} }));
      for (let k = r + 1; k <= Math.min(des.maxR, r + 30); k++) {
        const cel = des.linha(k, 1, cps[0] - 1).map(v => String(v ?? '').trim()), cod = cel.find(v => /^\d+(\.\d+)*$/.test(v)), ehTot = cel.some(v => /^total$/i.test(v));
        if (ehTot) { parc.forEach(x => x.valor = Math.round(num(des.v(k, x.col)) * 100) / 100); break; }
        if (cod && rubricaFolha(cod)) parc.forEach(x => { const v = Math.round(num(des.v(k, x.col)) * 100) / 100; if (v > 0) x.dist[cod] = v; });
      }
      blocos.push({ nome, parcelas: parc.map(({ col, ...x }) => x), total: parc.reduce((t, x) => t + x.valor, 0) });
      r += 5;
    }
    const b = blocos.find(x => R.gestora && norm(x.nome) === norm(R.gestora)) || blocos.find(x => R.totalUFSM && Math.abs(x.total - R.totalUFSM) < 1);
    if (b && b.total > 0) R.desembolso = { fundacao: b.nome, parcelas: b.parcelas.filter(x => x.valor > 0) };
    else if (blocos.length) R.avisos.push('Não identifiquei, na aba de desembolso, o bloco da gestora da UFSM.');
  }
  /* cronograma de atividades */
  R.atividades = [];
  if (atv) {
    const h = atv.acha(/Cod\.?\s*Etapa/i);
    if (h) {
      const cab = atv.linha(h.r).map(v => String(v || '').trim().toLowerCase()); const ci = re => cab.findIndex(v => re.test(v)) + 1;
      const cCod = h.c, cEt = ci(/^etapa$/), cDesc = ci(/descri/), cEnt = ci(/entrega/), cVal = ci(/validador/), cIni = ci(/in[íi]cio/), cFim = ci(/t[ée]rmino/), cResp = ci(/respons/);
      for (let r = h.r + 1; r <= atv.maxR; r++) {
        const cod = atv.s(r, cCod); if (!/^\d+(\.\d+)*$/.test(cod)) continue;
        const etapa = cEt ? atv.s(r, cEt) : '', desc = cDesc ? atv.s(r, cDesc) : '';
        const mi = parseInt(atv.s(r, cIni), 10), mf = parseInt(atv.s(r, cFim), 10);
        R.atividades.push({ codigo: cod, etapa, descricao: desc, entrega: cEnt ? atv.s(r, cEnt) : '', validador: cVal ? atv.s(r, cVal) : '', mes_inicio: mi > 0 ? mi : null, mes_fim: mf > 0 ? mf : null, responsavel: cResp ? atv.s(r, cResp) : '' });
      }
    }
  }
  /* grupos ausentes na planilha (ex.: 3.1…3.6 sem linha "3") → cria o nível pai para manter a árvore */
  { const existe = new Set(R.atividades.map(a => a.codigo)), novos = [];
    R.atividades.forEach(a => { const s = a.codigo.split('.'); for (let i = 1; i < s.length; i++) { const c = s.slice(0, i).join('.'); if (!existe.has(c)) { existe.add(c); novos.push({ codigo: c, etapa: (i === 1 ? 'Meta ' : 'Etapa ') + c + ' (sem título na planilha)', descricao: '', entrega: '', validador: '', mes_inicio: null, mes_fim: null, responsavel: '', sintetico: true }); } } });
    if (novos.length) { R.atividades.push(...novos); R.atividades.sort((a, b) => Calc.codCmp(a.codigo, b.codigo)); R.avisos.push(`A planilha não tem linha de título para ${novos.map(n => n.codigo).join(', ')}; criado(s) com nome provisório — renomeie depois no cronograma.`); } }
  const cods = R.atividades.map(a => a.codigo), temFilho = c => cods.some(x => x.startsWith(c + '.'));
  R.atividades.forEach(a => { a.folha = !temFilho(a.codigo); a.titulo = a.folha && a.descricao ? a.descricao : (a.etapa || a.descricao || a.codigo); if (a.folha && a.etapa && a.descricao) a.descricaoLonga = ''; });
  /* sugestão de atividades da UFSM (matriz "Etapas físicas vinculadas") */
  const anc = c => { const s = c.split('.'), out = []; while (s.length > 1) { s.pop(); out.push(s.join('.')); } return out; };
  const folhaMarcadaAbaixo = (c, marcas) => cods.some(x => x.startsWith(c + '.') && marcas.has(x));
  R.atividades.forEach(a => {
    if (!a.folha) return;
    a.ufsm = marcasUFSM.has(a.codigo) || anc(a.codigo).some(g => marcasUFSM.has(g) && !folhaMarcadaAbaixo(g, marcasTodas));
  });
  R.temMatriz = marcasUFSM.size > 0;
  if (!R.temMatriz && R.atividades.length) R.avisos.push('A planilha não tem a matriz de etapas vinculadas da UFSM: selecione manualmente as atividades da UFSM.');
  return R;
}

/* casamento de pessoas da planilha com o cadastro */
function acharPessoa(nome, email) {
  if (email) { const p = D.pessoas.find(x => x.email && norm(x.email) === norm(email)); if (p) return p; }
  const tk = norm(nome).replace(/[^a-z\s.]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !['de', 'da', 'do', 'dos', 'das', 'e'].includes(t));
  if (tk.length < 2) return null;
  const f = tk[0], l = tk[tk.length - 1];
  const cands = D.pessoas.filter(p => { const t = norm(p.nome).replace(/[^a-z\s.]/g, ' ').split(/\s+/).filter(x => x.length > 0 && !['de', 'da', 'do', 'dos', 'das', 'e'].includes(x)); if (t.length < 2) return false;
    const pf = t[0].replace(/\.$/, ''), pl = t[t.length - 1]; return pl === l && (pf === f || (pf.length === 1 && f.startsWith(pf)) || (f.length === 1 && pf.startsWith(f))); });
  return cands.length === 1 ? cands[0] : null;
}
/* mesmo nome? "Lucas Scherer" = "Lucas Giuliani Scherer"; "Bolsista de Mestrado 1 (UFSM)" só casa com ele mesmo */
function mesmoNome(a, b) {
  const t = x => norm(x).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !['de', 'da', 'do', 'dos', 'das', 'e'].includes(w));
  const A = t(a), B = t(b); if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return true;
  if (/\d/.test(A.join('')) || /\d/.test(B.join(''))) return false;
  return A.length > 1 && B.length > 1 && A[0] === B[0] && A[A.length - 1] === B[B.length - 1];
}
const tipoPorFuncao = (func, form) => /p[óo]s-?dout|rec[ée]m-?doutor/i.test(func + ' ' + (form || '')) ? 'pos_doc' : /bolsista.*gradua/i.test(func) ? 'ic' : /doutorand/i.test(func) ? 'doutorando' : /mestrand/i.test(func) ? 'mestrando' : /p[óo]s-?doc/i.test(func) ? 'pos_doc' : /t[ée]cnic/i.test(func) ? 'tecnico' : /coordenador|pesquisador/i.test(func) && /doutor/i.test(form) ? 'docente' : /pesquisador/i.test(func) ? 'pesquisador' : 'outro';

/* atividade que É um relatório ("Relatório técnico parcial", "Elaboração do relatório final"), não uma que apenas o menciona */
const ehAtvRelatorio = t => /^\s*((elabora[çc][ãa]o|reda[çc][ãa]o|entrega|emiss[ãa]o|apresenta[çc][ãa]o)\s+d[oe]s?\s+)?relat[óo]rios?\b/i.test(t || '');

/* ── fluxo de importação ─────────────────────────────────────────── */
A.importarPlanilha = d => {
  if (!(Perm.dir() || Perm.tem('projetos_criar') || (d.projeto && Perm.gereProjeto(d.projeto)))) falha('Você não tem permissão para importar projetos.');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.pdf,.json';
  inp.onchange = () => run(async () => {
    const f = inp.files[0]; if (!f) return;
    flash('Lendo o plano de trabalho…');
    const R = await lerPlanoDeTrabalho(f);
    previaImportacao(R, d.projeto || null);
  });
  inp.click();
};
function previaImportacao(R, projetoAlvo) {
  const leafs = R.atividades.filter(a => a.folha);
  const eqU = R.equipe.filter(e => e.ufsm);
  const plano = rubricasPadrao(), folhasOrc = plano.filter(r => !plano.some(x => x.pai === r.codigo));
  const inicioSug = (() => { const d = new Date(); return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1)); })();
  const alvo = projetoAlvo ? byId('projetos', projetoAlvo) : null;
  const grupos = {}; leafs.forEach(a => { const g = a.codigo.split('.').slice(0, 2).join('.'); (grupos[g] = grupos[g] || []).push(a); });
  const nomeGrupo = g => (R.atividades.find(a => a.codigo === g) || {}).titulo || g;
  const eqLinhas = eqU.map((e, i) => { const p = e.vaga ? null : acharPessoa(e.nome, e.email);
    return `<tr><td><input type="checkbox" class="im-eq" data-i="${i}" ${e.vaga ? 'disabled' : 'checked'}></td><td><b>${esc(e.nome)}</b><div class="small muted">${esc([e.formacao, e.email].filter(Boolean).join(' · '))}</div></td><td class="small">${esc(e.funcao)}${e.nivel ? `<div class="muted">${esc(e.nivel)}</div>` : ''}${e.horas ? `<div class="muted">${e.horas} h/semana</div>` : ''}</td>
      <td class="small">${e.vaga ? '<span style="color:var(--yellow-txt)">vaga aberta no plano</span>' : p ? `✓ já cadastrada: <b>${esc(p.nome)}</b>` : '<span style="color:var(--blue)">será cadastrada</span>'}</td><td class="small">${e.etapas.length}</td>
      <td class="small num">${e.bolsa ? `${esc(e.bolsa.modalidade)}<div><b>${fmtBRL(e.bolsa.valor_mensal)}</b> × ${e.bolsa.meses}</div>` : '<span class="faint">—</span>'}</td></tr>`; }).join('');
  const totBolsas = eqU.reduce((t, e) => t + (e.bolsa ? e.bolsa.valor_mensal * e.bolsa.meses : 0), 0);
  const pend = (R.conferencias || []).filter(c => !c.ok);
  /* projeto existente: campo a campo, o que está no projeto × o que diz o documento */
  const fimDoc = alvo && R.meses && isDate(alvo.inicio) ? isoOf(new Date(toDate(alvo.inicio).getFullYear(), toDate(alvo.inicio).getMonth() + R.meses, 0)) : null;
  const campos = !alvo ? [] : [['nome', 'Título', R.titulo], ['financiador', 'Financiador', R.financiador], ['fundacao_apoio', 'Fundação de apoio', R.gestora], ['programa', 'Programa', R.programa], ['chamada', 'Chamada / processo', R.chamada],
    ['linha_tematica', 'Linha / tema', [R.linha, R.tema].filter(Boolean).join(' · ')], ['resumo', 'Resumo', R.resumo], ['valor_total', 'Valor (aporte)', R.totalUFSM ? r2(R.totalUFSM) : null], ['fim', 'Término (início + ' + (R.meses || '?') + ' meses)', fimDoc]]
    .filter(([k, , v]) => v != null && v !== '' && (k === 'valor_total' ? Math.abs(num(alvo[k]) - v) >= 0.01 : String(alvo[k] ?? '').trim() !== String(v).trim()))
    .map(([k, l, v]) => ({ k, l, v, atual: alvo[k], vazio: k === 'valor_total' ? !num(alvo[k]) : !String(alvo[k] ?? '').trim() }));
  const mostraV = (k, v) => k === 'valor_total' ? fmtBRL2(v) : k === 'fim' ? fmtD(v) : esc(String(v ?? '').length > 140 ? String(v).slice(0, 138) + '…' : v ?? '');
  const html = `<div class="between mb"><h3 style="margin:0">Importar plano de trabalho — ${esc(R.formato || 'planilha do edital')}</h3><button class="btn-s" id="im_x">✕</button></div>
  <div class="note mb small">Arquivo: <b>${esc(R.arquivo)}</b> · ${R.paginas ? R.paginas + ' páginas' : (R.abas || []).length + ' abas'}. Revise o que será importado; nada é gravado até clicar em “Importar”.${R.avisos.length ? '<br>' + R.avisos.map(a => '⚠ ' + esc(a)).join('<br>') : ''}</div>
  ${(R.conferencias || []).length ? `<details class="mb" ${pend.length ? 'open' : ''}><summary class="small"><b>Conferências do documento:</b> ${pend.length ? `<span style="color:var(--red)">${pend.length} divergência(s)</span>` : `<span style="color:var(--green)">✓ ${R.conferencias.length} de ${R.conferencias.length} conferem</span>`}</summary>
    <div class="small" style="padding:4px 0 0 14px">${R.conferencias.map(c => `<div>${c.ok ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>'} ${esc(c.txt)}</div>`).join('')}</div></details>` : ''}
  <div class="sec" style="margin-top:0">1 · Projeto</div>
  <div class="kv mb small"><span class="k">Título</span><span><b>${esc(R.titulo || '—')}</b></span><span class="k">Programa / chamada</span><span>${esc([R.programa, R.chamada].filter(Boolean).join(' · ') || '—')}</span>
    <span class="k">Linha / tema</span><span>${esc([R.linha, R.tema].filter(Boolean).join(' · ') || '—')}</span><span class="k">Financiador</span><span>${esc(R.financiador || '—')}</span>
    <span class="k">Duração</span><span>${R.meses ? R.meses + ' meses' : '—'}</span><span class="k">Coordenação geral</span><span>${esc(R.coordenador || '—')}</span>
    <span class="k">Gestora UFSM</span><span>${esc(R.gestora || '—')}</span><span class="k">Aporte UFSM</span><span><b>${fmtBRL2(R.totalUFSM)}</b></span></div>
  ${campos.length ? `<div class="small muted mb">Dados do projeto ${esc(alvo.sigla)} diferentes do documento — marque o que deve ser substituído (campos vazios são sempre preenchidos):</div>
  <div class="tw mb"><table class="t small"><tr><th>Campo</th><th>No projeto</th><th>No documento</th><th>Usar o do documento</th></tr>${campos.map(c => `<tr><td>${esc(c.l)}</td><td>${c.vazio ? '<span class="faint">(vazio)</span>' : mostraV(c.k, c.atual)}</td><td>${mostraV(c.k, c.v)}</td><td><input type="checkbox" class="im-campo" data-k="${c.k}" ${c.vazio ? 'checked disabled' : ''}></td></tr>`).join('')}</table></div>` : ''}
  <div class="fgrid mb">
    <div><label class="fl">Destino</label><select id="im_dest"><option value="">➕ Criar novo projeto</option>${D.projetos.slice().sort(byName('sigla')).map(p => `<option value="${p.id}"${alvo && alvo.id === p.id ? ' selected' : ''}>Atualizar: ${esc(p.sigla)}</option>`).join('')}</select></div>
    <div id="im_novo"><label class="fl">Sigla do novo projeto</label><input id="im_sigla" value="${esc((R.programa ? R.programa + ' — ' : '') + (R.titulo || '').split(/\s+/).slice(0, 3).join(' '))}"></div>
    <div><label class="fl">Início da vigência</label><input id="im_ini" type="date" value="${alvo ? alvo.inicio : inicioSug}"><div class="help">Mês 1 do cronograma. Término = início + ${R.meses || '?'} meses.</div></div>
    <div class="small muted" style="align-self:end">Ao atualizar um projeto existente, só campos vazios são preenchidos, o orçamento é somado por rubrica e o cronograma é mesclado pelo código.</div></div>
  <div class="sec">2 · Orçamento — coluna UFSM <label class="small" style="text-transform:none;letter-spacing:0;font-weight:400;margin-left:8px"><input type="checkbox" id="im_orc" checked> importar como Aprovado</label> <label class="small" style="text-transform:none;letter-spacing:0;font-weight:400;margin-left:8px"><input type="checkbox" id="im_prev" checked> e usar o mesmo valor como Previsto</label></div>
  ${R.naturezas ? `<div class="small muted mb">Natureza de despesa do financiador → rubrica do GPMOT (troque se necessário; orçamento, itens e desembolso acompanham):</div>
  <div class="tw mb"><table class="t small"><tr><th>Natureza no documento</th><th class="num">Valor</th><th>Rubrica GPMOT</th></tr>${R.naturezas.map((nt, i) => `<tr><td>${esc(nt.nome)}</td><td class="num">${fmtBRL(nt.valor)}</td><td><select class="im-nat" data-i="${i}" style="${nt.rubrica ? '' : 'border-color:var(--red)'}"><option value="">— escolha —</option>${folhasOrc.map(r => `<option value="${r.codigo}"${nt.rubrica === r.codigo ? ' selected' : ''}>${esc(r.codigo + ' ' + r.nome)}</option>`).join('')}</select></td></tr>`).join('')}</table></div>` : ''}
  <div class="tw"><table class="t orc small"><tr>${folhasOrc.map(r => `<th class="num" title="${esc(r.nome)}">${r.codigo}</th>`).join('')}<th class="num">Total</th></tr><tr>${folhasOrc.map(r => `<td class="num">${fmtBRL(R.orcamento[r.codigo] || 0)}</td>`).join('')}<td class="num"><b>${fmtBRL(folhasOrc.reduce((s, r) => s + num(R.orcamento[r.codigo]), 0))}</b></td></tr></table></div>
  <div class="sec">3 · Equipe UFSM (${eqU.length} posições · ${eqU.filter(e => e.vaga).length} vagas${totBolsas ? ' · bolsas/CLT ' + fmtBRL2(totBolsas) : ''})</div>
  <div class="row small mb" style="gap:14px"><label class="row"><input type="checkbox" id="im_plano" checked> criar a equipe do plano de trabalho (posições, vagas e bolsas previstas)</label><label class="row"><input type="checkbox" id="im_aloc" checked> cadastrar e alocar as pessoas marcadas</label></div>
  ${eqU.length ? `<div class="tw" style="max-height:230px;overflow:auto"><table class="t"><tr><th></th><th>Nome</th><th>Função no edital</th><th>Cadastro</th><th>Etapas</th><th class="num">Bolsa / CLT</th></tr>${eqLinhas}</table></div>` : '<div class="empty">Nenhum membro da UFSM encontrado na aba de equipe.</div>'}
  <div class="sec">4 · Cronograma físico — atividades da UFSM <span class="small" style="text-transform:none;letter-spacing:0;font-weight:400">(<span id="im_nsel">0</span> de ${leafs.length} selecionadas${R.temMatriz ? ', sugeridas pela matriz de etapas da equipe UFSM' : ''})</span>
    <button class="btn-s" id="im_todas" style="margin-left:6px">todas</button><button class="btn-s" id="im_nenhuma">nenhuma</button><button class="btn-s" id="im_sug">sugestão UFSM</button></div>
  <div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px 10px">${Object.keys(grupos).sort(Calc.codCmp).map(g => `<details ${grupos[g].some(a => a.ufsm) ? 'open' : ''}><summary class="small"><label><input type="checkbox" class="im-grp" data-g="${g}"></label> <b>${esc(g)}</b> ${esc(nomeGrupo(g))} <span class="muted">(${grupos[g].length})</span></summary>
    ${grupos[g].map(a => `<label class="row small" style="padding:2px 0 2px 26px;align-items:flex-start"><input type="checkbox" class="im-at" data-cod="${a.codigo}" data-g="${g}" ${a.ufsm ? 'checked' : ''}> <span><b>${esc(a.codigo)}</b> ${esc(a.titulo.length > 120 ? a.titulo.slice(0, 118) + '…' : a.titulo)} <span class="muted">· meses ${a.mes_inicio ?? '?'}–${a.mes_fim ?? '?'} · ${esc(a.responsavel)}</span></span></label>`).join('')}</details>`).join('')}</div>
  <div class="sec">5 · Plano de aplicação — itens da UFSM (${R.itens.length} · ${fmtBRL2(R.itens.reduce((t, i) => t + i.valor_previsto, 0))}) <label class="small" style="text-transform:none;letter-spacing:0;font-weight:400;margin-left:8px"><input type="checkbox" id="im_itens" ${R.itens.length ? 'checked' : 'disabled'}> importar os itens previstos por rubrica</label></div>
  ${R.itens.length ? `<div class="tw" style="max-height:200px;overflow:auto"><table class="t small"><tr><th>Rubrica</th><th class="num">Itens</th><th class="num">Valor</th><th>Exemplos</th></tr>${[...new Set(R.itens.map(i => i.rubrica))].sort(Calc.codCmp).map(c => { const its = R.itens.filter(i => i.rubrica === c); return `<tr><td>${esc(Calc.rotuloRubrica(c))}</td><td class="num">${its.length}</td><td class="num">${fmtBRL(its.reduce((t, i) => t + i.valor_previsto, 0))}</td><td class="muted">${esc(its.slice(0, 3).map(i => i.descricao).join('; ') + (its.length > 3 ? '…' : ''))}</td></tr>`; }).join('')}</table></div>` : '<div class="empty small">Nenhum item da UFSM nas abas 6 a 11.</div>'}
  <div class="sec">6 · Desembolso ${R.desembolso ? `— ${esc(R.desembolso.fundacao)} (${R.desembolso.parcelas.length} parcela(s) · ${fmtBRL2(R.desembolso.parcelas.reduce((t, x) => t + x.valor, 0))})` : ''} <label class="small" style="text-transform:none;letter-spacing:0;font-weight:400;margin-left:8px"><input type="checkbox" id="im_des" ${R.desembolso ? 'checked' : 'disabled'}> importar as parcelas previstas e sua distribuição por rubrica</label></div>
  ${R.desembolso ? `<div class="row small" style="gap:16px;flex-wrap:wrap">${R.desembolso.parcelas.map(x => `<span>${esc(x.descricao)}: <b>${fmtBRL2(x.valor)}</b> <span class="muted">(${Object.keys(x.dist).length} rubricas)</span></span>`).join('')}</div>
    ${R.desembolso.parcelas.every(x => x.mes) ? '<div class="help">Data de cada parcela = início da vigência + mês indicado no documento.</div>' : `<div class="fgrid mt"><div><label class="fl">Data prevista da 1ª parcela</label><input type="date" id="im_des_ini"><div class="help">A planilha não traz datas; padrão = início da vigência.</div></div>
    <div><label class="fl">Intervalo entre parcelas (meses)</label><input type="number" id="im_des_int" min="1" max="60" value="${Math.max(1, Math.round((R.meses || 24) / Math.max(1, R.desembolso.parcelas.length)))}"></div></div>`}` : '<div class="empty small">Sem cronograma de desembolso da UFSM no documento.</div>'}
  ${(R.entregas || []).length ? `<div class="sec">7 · Relatórios previstos → Entregas (${R.entregas.length}) <label class="small" style="text-transform:none;letter-spacing:0;font-weight:400;margin-left:8px"><input type="checkbox" id="im_entR" checked> criar as entregas com prazo no fim do mês indicado</label></div>
    <div class="small muted">${R.entregas.map(e => `${esc(e.titulo)} <b>(mês ${e.mes})</b>`).join(' · ')}</div>` : ''}
  <div class="row mt small"><label class="row"><input type="checkbox" id="im_ent" checked> criar Entregas para as atividades de relatório selecionadas (<span id="im_nrel">0</span>)</label></div>
  ${pend.length || (R.semRubrica || []).length ? `<div class="alert warn mt small"><label class="row"><input type="checkbox" id="im_conf"> ${pend.length ? `Revisei as ${pend.length} divergência(s) das conferências` : ''}${pend.length && (R.semRubrica || []).length ? ' e ' : ''}${(R.semRubrica || []).length ? 'sei que naturezas sem rubrica não entram no orçamento' : ''} — importar mesmo assim</label></div>` : ''}
  <div class="merr" id="im_err" style="display:none"></div>
  <div class="mactions"><button id="im_pad" title="Baixa o que foi lido no formato padrão do GPMOT (.json): serve para conferir, corrigir à mão e importar de novo">Baixar plano padrão (.json)</button><button id="im_c">Cancelar</button><button class="btn-p" id="im_ok">Importar</button></div>`;
  openModal(html, { wide: true, sticky: true, noFocus: true });
  const root = document.getElementById('modal-root'), q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const ehRel = cod => ehAtvRelatorio((leafs.find(a => a.codigo === cod) || {}).titulo);
  const conta = () => { const sel = qa('.im-at:checked'); q('#im_nsel').textContent = sel.length; q('#im_nrel').textContent = sel.filter(x => ehRel(x.dataset.cod)).length;
    qa('.im-grp').forEach(g => { const it = qa(`.im-at[data-g="${g.dataset.g}"]`), ck = it.filter(x => x.checked).length; g.checked = ck === it.length && ck > 0; g.indeterminate = ck > 0 && ck < it.length; }); };
  qa('.im-at').forEach(x => x.onchange = conta);
  qa('.im-grp').forEach(g => g.onchange = () => { qa(`.im-at[data-g="${g.dataset.g}"]`).forEach(x => x.checked = g.checked); conta(); });
  q('#im_todas').onclick = () => { qa('.im-at').forEach(x => x.checked = true); conta(); };
  q('#im_nenhuma').onclick = () => { qa('.im-at').forEach(x => x.checked = false); conta(); };
  q('#im_sug').onclick = () => { qa('.im-at').forEach(x => x.checked = !!(leafs.find(a => a.codigo === x.dataset.cod) || {}).ufsm); conta(); };
  const destino = () => { q('#im_novo').style.visibility = q('#im_dest').value ? 'hidden' : 'visible'; const p = byId('projetos', q('#im_dest').value); if (p) q('#im_ini').value = p.inicio; };
  const sincDes = () => { const e = q('#im_des_ini'); if (e && !e.dataset.mexeu) e.value = q('#im_ini').value; };
  if (q('#im_des_ini')) q('#im_des_ini').oninput = e => e.target.dataset.mexeu = '1';
  q('#im_ini').addEventListener('change', sincDes);
  q('#im_dest').onchange = () => previaImportacao(R, q('#im_dest').value || null);   // refaz a comparação com o projeto escolhido
  destino(); sincDes(); conta();
  q('#im_x').onclick = q('#im_c').onclick = closeModal;
  qa('.im-nat').forEach(sel => sel.onchange = () => { R.naturezas[+sel.dataset.i].rubrica = sel.value || null; aplicarNaturezas(R); previaImportacao(R, q('#im_dest').value || projetoAlvo); });
  q('#im_pad').onclick = () => baixar((R.arquivo || 'plano').replace(/\.[^.]+$/, '') + ' — plano padrão GPMOT.json', JSON.stringify(planoParaPadrao(R), null, 1), 'application/json');
  q('#im_ok').onclick = async () => {
    const btn = q('#im_ok');
    if (q('#im_conf') && !q('#im_conf').checked) { const el = q('#im_err'); el.textContent = 'Há divergências nas conferências do documento: revise-as e marque a confirmação para importar.'; el.style.display = 'block'; return; }
    btn.disabled = true;
    try {
      const opts = { destino: q('#im_dest').value || null, sigla: q('#im_sigla').value.trim(), inicio: q('#im_ini').value, orc: q('#im_orc').checked, prev: q('#im_prev').checked, aloc: q('#im_aloc').checked,
        equipe: qa('.im-eq:checked').map(x => eqU[+x.dataset.i]), plano: q('#im_plano').checked ? eqU : null, itens: q('#im_itens').checked, des: q('#im_des').checked ? { ini: (q('#im_des_ini') || {}).value || q('#im_ini').value, intervalo: +((q('#im_des_int') || {}).value || 12) } : null, atividades: new Set(qa('.im-at:checked').map(x => x.dataset.cod)), entregas: q('#im_ent').checked, entregasPrevistas: !!(q('#im_entR') && q('#im_entR').checked), campos: new Set(qa('.im-campo:checked').map(x => x.dataset.k)) };
      const res = await executarImportacao(R, opts);
      closeModal(); UI.tab = 'projetos'; UI.projeto = res.projeto.id; UI.projAba = 'cronograma'; render();
      flash(`✓ Importado: ${res.resumo}`);
    } catch (e) { console.error(e); const el = q('#im_err'); el.textContent = traduzErro(e); el.style.display = 'block'; btn.disabled = false; }
  };
}
async function executarImportacao(R, o) {
  if (!isDate(o.inicio)) falha('Informe a data de início da vigência.');
  const cont = { orc: 0, pessoas: 0, aloc: 0, atv: 0, ent: 0, pos: 0, bol: 0, itens: 0, parc: 0 }, pessoaDe = new Map();
  const fimVig = R.meses ? isoOf(new Date(toDate(o.inicio).getFullYear(), toDate(o.inicio).getMonth() + R.meses, 0)) : addDays(o.inicio, 365 * 2);
  /* 1. projeto */
  let p;
  const dadosProj = { nome: R.titulo || null, financiador: R.financiador || null, fundacao_apoio: R.gestora || null, programa: R.programa || null, chamada: R.chamada || null, linha_tematica: [R.linha, R.tema].filter(Boolean).join(' · ') || null, resumo: R.resumo || null, notas: R.notas || null };
  if (!o.destino) {
    if (!o.sigla) falha('Informe a sigla do novo projeto.');
    p = await Data.insert('projetos', { ...dadosProj, tipo: 'edital', sigla: o.sigla, valor_total: Math.round(num(R.totalUFSM) * 100) / 100, contrapartida: 0, inicio: o.inicio, fim: fimVig, status: 'pendente', situacao: 'vigente', fase: 'Início', placeholder: false,
      notas: [`Importado de "${R.arquivo}" (${R.formato || 'planilha do edital'}) em ${fmtD(hoje())}.`, R.notas].filter(Boolean).join('\n') });
  } else {
    p = byId('projetos', o.destino);
    const patch = {}; Object.entries(dadosProj).forEach(([k, v]) => { if (v && !p[k]) patch[k] = v; });
    const campos = o.campos || new Set();
    Object.entries(dadosProj).forEach(([k, v]) => { if (v && campos.has(k)) patch[k] = v; });
    if ((!num(p.valor_total) || campos.has('valor_total')) && R.totalUFSM) patch.valor_total = Math.round(num(R.totalUFSM) * 100) / 100;
    if (o.inicio !== p.inicio) patch.inicio = o.inicio;
    if (campos.has('fim') && R.meses) patch.fim = fimVig;
    if (Object.keys(patch).length) p = await Data.update('projetos', p.id, patch);
  }
  /* 2. orçamento UFSM */
  if (o.orc) for (const [cod, v] of Object.entries(R.orcamento)) {
    if (!rubricaFolha(cod) || !(v > 0)) continue;
    const ex = D.orcamento_rubricas.find(x => x.projeto_id === p.id && x.rubrica === cod);
    const val = Math.round(v * 100) / 100;
    if (ex) await Data.update('orcamento_rubricas', ex.id, { aprovado: val, ...(o.prev && !num(ex.previsto) ? { previsto: val } : {}) });
    else await Data.insert('orcamento_rubricas', { projeto_id: p.id, rubrica: cod, aprovado: val, previsto: o.prev ? val : 0 });
    cont.orc++;
  }
  /* 3. equipe */
  for (const e of o.equipe) {
    let pe = acharPessoa(e.nome, e.email);
    if (pe) pessoaDe.set(e, pe);
    if (!pe) { pe = await Data.insert('pessoas', { nome: e.nome, email: e.email || null, tipo: tipoPorFuncao(e.funcao, [e.nivel, e.formacao].filter(Boolean).join(' ')), funcao: null, formacao: e.formacao || null, lattes: e.lattes || null, disponibilidade_pct: 100, perfil_disponibilidade: 'interno', ativo: true }); cont.pessoas++; }
    else { const patch = {}; if (e.email && !pe.email && !D.pessoas.some(x => x.id !== pe.id && norm(x.email) === norm(e.email))) patch.email = e.email; if (e.lattes && !pe.lattes) patch.lattes = e.lattes; if (e.formacao && !pe.formacao) patch.formacao = e.formacao;
      if (Object.keys(patch).length) { try { await Data.update('pessoas', pe.id, patch); } catch (err) { console.warn(err); } } }
    pessoaDe.set(e, pe);
    if (o.aloc && !D.alocacoes.some(a => a.pessoa_id === pe.id && a.projeto_id === p.id)) {
      const coord = /coordenador/i.test(e.funcao);
      await Data.insert('alocacoes', { pessoa_id: pe.id, projeto_id: p.id, nivel: coord ? 3 : 2, carga_pct: e.horas ? Math.min(100, Math.round(e.horas / 40 * 100)) : coord ? 20 : 25, papel: e.funcao || null, status: 'ativo', desde: o.inicio, coordena: coord && Perm.dir(), atribuicao: e.etapas.length ? 'Etapas no plano: ' + e.etapas.filter(x => x.split('.').length <= 2).join(', ') : null });
      cont.aloc++;
    }
  }
  /* 3b. equipe do plano de trabalho: uma posição por linha da UFSM (inclusive vagas) + bolsa prevista */
  if (o.plano) {
    const podeFin = Perm.editaFin(p.id); let ordem = Math.max(0, ...D.equipe_plano.filter(x => x.projeto_id === p.id).map(x => num(x.ordem)));
    for (const e of o.plano) {
      const pe = pessoaDe.get(e) || null;
      const base = { funcao: [e.funcao, e.nivel].filter(Boolean).join(' · ') || null, categoria: tipoPorFuncao(e.funcao, [e.nivel, e.formacao].filter(Boolean).join(' ')), formacao: e.formacao || null, etapas: e.etapas, horas_semanais: e.horas || (e.bolsa && e.bolsa.horas) || null };
      let pos = D.equipe_plano.find(x => x.projeto_id === p.id && (mesmoNome(x.nome_plano, e.nome) || (pe && x.pessoa_id === pe.id)));
      if (pos) pos = await Data.update('equipe_plano', pos.id, base);
      else {
        const ocupa = pe && !D.equipe_plano.some(x => x.projeto_id === p.id && x.status === 'ocupada' && x.pessoa_id === pe.id);
        pos = await Data.insert('equipe_plano', { ...base, projeto_id: p.id, nome_plano: e.nome, ordem: ++ordem, status: ocupa ? 'ocupada' : 'vaga', pessoa_id: ocupa ? pe.id : null, desde: ocupa ? o.inicio : null });
        cont.pos++;
      }
      if (e.bolsa && podeFin) {
        const b = { modalidade: e.bolsa.modalidade, valor_mensal: e.bolsa.valor_mensal, meses: e.bolsa.meses, rubrica: e.bolsa.rubrica };
        const ex = D.equipe_plano_bolsas.find(x => x.vaga_id === pos.id);
        if (ex) await Data.update('equipe_plano_bolsas', ex.id, b); else await Data.insert('equipe_plano_bolsas', { ...b, vaga_id: pos.id, projeto_id: p.id });
        cont.bol++;
      }
    }
  }
  /* 3c. plano de aplicação (itens por rubrica) — mesclado por rubrica + descrição */
  const usados = new Set();
  if (o.itens && Perm.editaFin(p.id)) for (const it of R.itens) {
    if (!it.rubrica) continue;
    const mesmos = D.plano_itens.filter(x => x.projeto_id === p.id && x.rubrica === it.rubrica && norm(x.descricao) === norm(it.descricao) && !usados.has(x.id));
    const ex = mesmos.find(x => x.numero === it.numero) || (mesmos.length === 1 ? mesmos[0] : null); if (ex) usados.add(ex.id);
    const { natureza, tipo, ...base } = it; const row = { ...base, justificativa: it.justificativa || null };
    if (ex) { delete row.numero; await Data.update('plano_itens', ex.id, row); } else { const r = await Data.insert('plano_itens', { ...row, projeto_id: p.id }); usados.add(r.id); }
    cont.itens++;
  }
  /* 3d. desembolso: parcelas previstas (as já recebidas/canceladas não são tocadas) */
  if (o.des && R.desembolso && Perm.editaFin(p.id)) for (const [i, x] of R.desembolso.parcelas.entries()) {
    const dt = toDate(isDate(o.des.ini) ? o.des.ini : o.inicio); if (x.mes) { const i0 = toDate(o.inicio); dt.setTime(new Date(i0.getFullYear(), i0.getMonth() + x.mes - 1, i0.getDate()).getTime()); } else dt.setMonth(dt.getMonth() + i * Math.max(1, o.des.intervalo || 12));
    const ex = D.desembolsos.find(d => d.projeto_id === p.id && d.numero === x.numero);
    if (ex && ex.status !== 'prevista') continue;
    const row = { descricao: x.descricao, fundacao: R.desembolso.fundacao || null, valor_previsto: x.valor, data_prevista: ex && ex.data_prevista ? ex.data_prevista : isoOf(dt) };
    const d = ex ? await Data.update('desembolsos', ex.id, row) : await Data.insert('desembolsos', { ...row, projeto_id: p.id, numero: x.numero, status: 'prevista' });
    await Data.removeWhere('desembolso_rubricas', { desembolso_id: d.id });
    for (const [rubrica, valor] of Object.entries(x.dist)) await Data.insert('desembolso_rubricas', { desembolso_id: d.id, projeto_id: p.id, rubrica, valor });
    cont.parc++;
  }
  /* 4. cronograma: atividades escolhidas + seus grupos */
  const escolhidas = R.atividades.filter(a => a.folha && o.atividades.has(a.codigo));
  const cods = new Set(); escolhidas.forEach(a => { const s = a.codigo.split('.'); for (let i = 1; i <= s.length; i++) cods.add(s.slice(0, i).join('.')); });
  const itens = R.atividades.filter(a => cods.has(a.codigo)).sort((a, b) => Calc.codCmp(a.codigo, b.codigo));
  for (const a of itens) {
    const resp = a.responsavel && !/[\/,;]/.test(a.responsavel) ? acharPessoa(a.responsavel, '') : null;
    const row = { titulo: a.titulo, descricao: a.folha ? (a.detalhe || (a.etapa && a.etapa !== a.titulo ? a.etapa : null)) : (a.descricao || null), entrega: a.entrega || null, validador: a.validador || null,
      mes_inicio: a.folha ? a.mes_inicio : null, mes_fim: a.folha ? a.mes_fim : null, responsavel_texto: a.responsavel || null, responsavel_id: resp ? resp.id : null };
    const ex = D.cronograma.find(c => c.projeto_id === p.id && c.codigo === a.codigo);
    if (ex) await Data.update('cronograma', ex.id, row); else await Data.insert('cronograma', { ...row, projeto_id: p.id, codigo: a.codigo });
    cont.atv++;
  }
  /* 5. entregas a partir das atividades de relatório */
  if (o.entregas) for (const a of escolhidas.filter(a => ehAtvRelatorio(a.titulo) && a.mes_fim)) {
    if (D.entregas.some(e => e.projeto_id === p.id && norm(e.titulo) === norm(a.titulo))) continue;
    await Data.insert('entregas', { projeto_id: p.id, tipo: /final/i.test(a.titulo) ? 'relatorio_final' : 'relatorio_parcial', titulo: a.titulo, prazo: Calc.mesDataFim(p, a.mes_fim), obs: `Atividade ${a.codigo} do cronograma físico` });
    cont.ent++;
  }
  /* 5b. relatórios previstos no documento (mês do projeto) */
  if (o.entregasPrevistas) for (const e of (R.entregas || [])) {
    if (!e.mes || D.entregas.some(x => x.projeto_id === p.id && norm(x.titulo) === norm(e.titulo))) continue;
    await Data.insert('entregas', { projeto_id: p.id, tipo: e.tipo || 'relatorio_parcial', titulo: e.titulo, prazo: Calc.mesDataFim(byId('projetos', p.id), e.mes), obs: `Previsto no plano de trabalho (mês ${e.mes})` });
    cont.ent++;
  }
  return { projeto: byId('projetos', p.id), resumo: `${cont.orc} rubrica(s), ${cont.pessoas} pessoa(s) nova(s), ${cont.aloc} alocação(ões), ${cont.pos} posição(ões) do plano, ${cont.bol} bolsa(s) prevista(s), ${cont.itens} item(ns) do plano de aplicação, ${cont.parc} parcela(s) de desembolso, ${cont.atv} item(ns) de cronograma, ${cont.ent} entrega(s)` };
}
