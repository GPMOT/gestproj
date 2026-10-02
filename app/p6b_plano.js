
/* ════════════════════════════════════════════════════════════════════
   IMPORTAÇÃO DE PLANOS DE TRABALHO (vários formatos → um formato único)
   Cada financiador tem o seu documento. Um "leitor" por formato converte o arquivo
   para o PLANO PADRÃO do GPMOT (o objeto R usado por previaImportacao/executarImportacao):
     { formato, arquivo, titulo, financiador, programa, chamada, linha, tema, meses, resumo,
       coordenador, gestora, totalUFSM, orcamento{rubrica: valor}, equipe[], bolsas[], itens[],
       desembolso{fundacao, parcelas[{numero, descricao, mes, valor, dist{rubrica: valor}}]},
       atividades[], entregas[], conferencias[], avisos[] }
   Depois, a MESMA prévia e as MESMAS conferências valem para todos os formatos.
   Para incluir um formato novo: escreva um leitor que devolva esse objeto e registre-o em LEITORES_PLANO.
   ════════════════════════════════════════════════════════════════════ */

/* ── leitor de PDF embutido (texto com posição; sem bibliotecas externas) ── */
async function inflarPDF(bytes) {
  if (typeof DecompressionStream === 'undefined') falha('Este navegador não consegue ler PDF compactado. Use Chrome, Edge ou Firefox atualizados.');
  const ds = new DecompressionStream('deflate'), w = ds.writable.getWriter();
  w.write(bytes).catch(() => { }); w.close().catch(() => { });
  const out = [], rd = ds.readable.getReader(); let n = 0;
  try { for (; ;) { const { value, done } = await rd.read(); if (done) break; out.push(value); n += value.length; } }
  catch (e) { if (!n) throw e; }   // fluxo com lixo no fim: aproveita o que já foi descompactado
  const u = new Uint8Array(n); let o = 0; out.forEach(c => { u.set(c, o); o += c.length; }); return u;
}
const WINANSI_EXTRA = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };
async function lerPDF(buf, inflar = inflarPDF) {
  const B = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let S = ''; for (let i = 0; i < B.length; i += 65536) S += String.fromCharCode.apply(null, B.subarray(i, i + 65536));
  if (!S.startsWith('%PDF')) falha('O arquivo não é um PDF.');
  if (/\/Encrypt\s/.test(S)) falha('O PDF está protegido por senha/criptografia. Gere uma cópia sem proteção.');
  /* objetos */
  const OBJ = new Map(), re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
  while ((m = re.exec(S))) {
    const ini = m.index + m[0].length, fimObj = S.indexOf('endobj', ini); if (fimObj < 0) break;
    let corpo = S.slice(ini, fimObj), stream = null;
    const st = corpo.search(/\bstream\r?\n/);
    if (st >= 0) { const d0 = ini + st + corpo.slice(st).match(/^stream\r?\n/)[0].length; const e = S.lastIndexOf('endstream', fimObj); stream = [d0, e]; corpo = corpo.slice(0, st); }
    OBJ.set(+m[1], { dict: corpo, stream }); re.lastIndex = fimObj;
  }
  if (S.includes('/ObjStm')) {   // objetos guardados dentro de fluxos (PDF 1.5+)
    for (const [, o] of [...OBJ]) if (/\/Type\s*\/ObjStm/.test(o.dict) && o.stream) {
      const txt = latin(await bytesDoFluxo(o)); const n = +(o.dict.match(/\/N\s+(\d+)/) || [])[1], first = +(o.dict.match(/\/First\s+(\d+)/) || [])[1];
      const nums = txt.slice(0, first).trim().split(/\s+/).map(Number);
      for (let k = 0; k < n; k++) { const id = nums[2 * k], off = nums[2 * k + 1], fim = k + 1 < n ? nums[2 * k + 3] : txt.length - first; if (!OBJ.has(id)) OBJ.set(id, { dict: txt.slice(first + off, first + fim), stream: null }); }
    }
  }
  function latin(u) { let s = ''; for (let i = 0; i < u.length; i += 65536) s += String.fromCharCode.apply(null, u.subarray(i, i + 65536)); return s; }
  async function bytesDoFluxo(o) {
    let [a, b] = o.stream; const L = o.dict.match(/\/Length\s+(\d+)(\s+\d+\s+R)?/);
    if (L && !L[2]) b = Math.min(b, a + +L[1]); else if (L && L[2]) { const lo = OBJ.get(+L[1]); if (lo) b = Math.min(b, a + parseInt(lo.dict, 10)); }
    const raw = B.subarray(a, b);
    return /\/FlateDecode/.test(o.dict) ? inflar(raw) : raw;
  }
  const ref = (txt, chave) => { const r = txt.match(new RegExp('/' + chave + '\\s+(\\d+)\\s+\\d+\\s+R')); return r ? +r[1] : null; };
  const dictDe = (txt, chave) => {   // valor de /Chave como dicionário (inline ou referência)
    const i = txt.search(new RegExp('/' + chave + '\\s*(<<|\\d+\\s+\\d+\\s+R)')); if (i < 0) return '';
    const resto = txt.slice(i + chave.length + 1).trimStart();
    if (resto.startsWith('<<')) { let p = 0, k = 0; for (; k < resto.length; k++) { if (resto.startsWith('<<', k)) { p++; k++; } else if (resto.startsWith('>>', k)) { p--; k++; if (!p) break; } } return resto.slice(0, k + 1); }
    const r = resto.match(/^(\d+)\s+\d+\s+R/); return r && OBJ.get(+r[1]) ? OBJ.get(+r[1]).dict : '';
  };
  /* fontes: tabela código → texto (ToUnicode) e bytes por código */
  const FONTES = new Map();
  async function fonte(id) {
    if (FONTES.has(id)) return FONTES.get(id);
    const o = OBJ.get(id) || { dict: '' }, f = { dois: /\/Identity-H|\/Identity-V|\/Type0/.test(o.dict), mapa: new Map() };
    const tu = ref(o.dict, 'ToUnicode');
    if (tu && OBJ.get(tu) && OBJ.get(tu).stream) {
      const cm = latin(await bytesDoFluxo(OBJ.get(tu)));
      const hex2s = h => { let s = ''; for (let i = 0; i + 3 < h.length + 0; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return s; };
      for (const bl of cm.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const p of bl[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) f.mapa.set(parseInt(p[1], 16), hex2s(p[2]));
      for (const bl of cm.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const p of bl[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
        const a = parseInt(p[1], 16), b = parseInt(p[2], 16);
        if (p[4]) { const base = p[4]; for (let c = a; c <= b && c - a < 65536; c++) { const ult = parseInt(base.slice(-4), 16) + (c - a); f.mapa.set(c, hex2s(base.slice(0, -4)) + String.fromCharCode(ult)); } }
        else { const lst = [...p[5].matchAll(/<([0-9a-fA-F]+)>/g)].map(x => hex2s(x[1])); lst.forEach((s, k) => f.mapa.set(a + k, s)); }
      }
      if (/<[0-9a-fA-F]{2}>\s*<[0-9a-fA-F]{2}>\s*$/m.test((cm.match(/begincodespacerange([\s\S]*?)endcodespacerange/) || ['', ''])[1])) f.dois = false;
    }
    /* diferenças de codificação em fontes simples */
    const enc = dictDe(o.dict, 'Encoding'), dif = (enc.match(/\/Differences\s*\[([^\]]*)\]/) || [])[1];
    if (dif && !f.mapa.size) { let c = 0; for (const t of dif.match(/\d+|\/[^\s/\[\]]+/g) || []) { if (/^\d/.test(t)) c = +t; else { const nm = t.slice(1); const ch = GLIFOS[nm] || (nm.length === 1 ? nm : null); if (ch) f.mapa.set(c, ch); c++; } } }
    FONTES.set(id, f); return f;
  }
  const GLIFOS = { space: ' ', hyphen: '-', period: '.', comma: ',', colon: ':', semicolon: ';', slash: '/', parenleft: '(', parenright: ')', aacute: 'á', agrave: 'à', acircumflex: 'â', atilde: 'ã', eacute: 'é', ecircumflex: 'ê', iacute: 'í', oacute: 'ó', ocircumflex: 'ô', otilde: 'õ', uacute: 'ú', ccedilla: 'ç', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ccedilla: 'Ç', Atilde: 'Ã', Otilde: 'Õ', ordmasculine: 'º', ordfeminine: 'ª', degree: '°', endash: '–', emdash: '—', quotedblleft: '“', quotedblright: '”', quoteright: '’', bullet: '•' };
  const decodifica = (f, bytes) => {
    let s = '';
    if (f && f.dois) { for (let i = 0; i + 1 < bytes.length; i += 2) { const c = (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1); s += f.mapa.has(c) ? f.mapa.get(c) : ''; } return s; }
    for (let i = 0; i < bytes.length; i++) { const c = bytes.charCodeAt(i); s += f && f.mapa.has(c) ? f.mapa.get(c) : WINANSI_EXTRA[c] || String.fromCharCode(c); }
    return s;
  };
  /* leitura do fluxo de conteúdo */
  const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  function tokens(c) {
    const out = []; let i = 0; const n = c.length;
    while (i < n) {
      const ch = c[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '%') { while (i < n && c[i] !== '\n' && c[i] !== '\r') i++; continue; }
      if (ch === '(') { let p = 1, s = ''; i++; while (i < n && p) { const d = c[i]; if (d === '\\') { const e = c[i + 1]; if (/[0-7]/.test(e)) { let o = ''; let k = i + 1; while (k < i + 4 && /[0-7]/.test(c[k])) o += c[k++]; s += String.fromCharCode(parseInt(o, 8) & 255); i = k; continue; } s += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[e] ?? (e === '\r' || e === '\n' ? '' : e); i += 2; continue; } if (d === '(') p++; if (d === ')') { p--; if (!p) { i++; break; } } s += d; i++; } out.push({ t: 's', v: s }); continue; }
      if (ch === '<' && c[i + 1] === '<') { out.push({ t: 'o', v: '<<' }); i += 2; continue; }
      if (ch === '>' && c[i + 1] === '>') { out.push({ t: 'o', v: '>>' }); i += 2; continue; }
      if (ch === '<') { const e = c.indexOf('>', i); let h = c.slice(i + 1, e).replace(/\s/g, ''); if (h.length % 2) h += '0'; let s = ''; for (let k = 0; k < h.length; k += 2) s += String.fromCharCode(parseInt(h.substr(k, 2), 16)); out.push({ t: 's', v: s }); i = e + 1; continue; }
      if (ch === '[' || ch === ']') { out.push({ t: ch }); i++; continue; }
      if (ch === '/') { let k = i + 1; while (k < n && !/[\s\/\[\]<>()%{}]/.test(c[k])) k++; out.push({ t: 'n', v: c.slice(i + 1, k) }); i = k; continue; }
      let k = i; while (k < n && !/[\s\/\[\]<>()%{}]/.test(c[k])) k++; if (k === i) { i++; continue; }
      const w = c.slice(i, k); i = k;
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) out.push({ t: '#', v: +w }); else out.push({ t: 'op', v: w });
      if (w === 'BI') { const e = c.indexOf('EI', i); i = e < 0 ? n : e + 2; }
    }
    return out;
  }
  async function executa(conteudo, recursos, ctm0, itens, prof) {
    if (prof > 6) return;
    const fontesRec = dictDe(recursos, 'Font'), xobjs = dictDe(recursos, 'XObject');
    let ctm = ctm0.slice(), pilha = [], tm = [1, 0, 0, 1, 0, 0], tlm = tm.slice(), f = null, tam = 10, lead = 0, ops = [];
    const toks = tokens(conteudo);
    const mostra = txt => { const M = mul(tm, ctm), x = M[4], y = M[5]; if (!txt) return; const alt = Math.abs(tam * Math.hypot(M[2], M[3])) || tam;
      const ult = itens[itens.length - 1];
      if (ult && ult.pend && Math.abs(ult.y - y) < 0.5 && Math.abs(ult.x - x) < 0.01) { ult.s += txt; return; }
      itens.push({ x, y, s: txt, h: alt, pend: true }); };
    for (const tk of toks) {
      if (tk.t !== 'op') { ops.push(tk); continue; }
      const a = ops; ops = [];
      const nums = a.filter(x => x.t === '#').map(x => x.v);
      switch (tk.v) {
        case 'q': pilha.push(ctm.slice()); break;
        case 'Q': ctm = pilha.pop() || ctm0.slice(); break;
        case 'cm': if (nums.length >= 6) ctm = mul(nums.slice(-6), ctm); break;
        case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); break;
        case 'Tf': { const nm = a.find(x => x.t === 'n'); tam = nums[nums.length - 1] || tam; const id = nm ? ref(fontesRec, nm.v) : null; f = id ? await fonte(id) : null; break; }
        case 'Tm': if (nums.length >= 6) { tm = nums.slice(-6); tlm = tm.slice(); } break;
        case 'Td': tlm = mul([1, 0, 0, 1, nums[0] || 0, nums[1] || 0], tlm); tm = tlm.slice(); break;
        case 'TD': lead = -(nums[1] || 0); tlm = mul([1, 0, 0, 1, nums[0] || 0, nums[1] || 0], tlm); tm = tlm.slice(); break;
        case 'TL': lead = nums[0] || 0; break;
        case 'T*': tlm = mul([1, 0, 0, 1, 0, -lead], tlm); tm = tlm.slice(); break;
        case 'Tj': { const s = a.filter(x => x.t === 's').pop(); if (s) mostra(decodifica(f, s.v)); break; }
        case "'": case '"': { tlm = mul([1, 0, 0, 1, 0, -lead], tlm); tm = tlm.slice(); const s = a.filter(x => x.t === 's').pop(); if (s) mostra(decodifica(f, s.v)); break; }
        case 'TJ': { let txt = ''; for (const x of a) { if (x.t === 's') txt += decodifica(f, x.v); else if (x.t === '#' && x.v < -200 && txt && !/\s$/.test(txt)) txt += ' '; } mostra(txt); break; }
        case 'ET': itens.forEach(x => delete x.pend); break;
        case 'Do': { const nm = a.find(x => x.t === 'n'); const id = nm ? ref(xobjs, nm.v) : null; const o = id && OBJ.get(id);
          if (o && /\/Subtype\s*\/Form/.test(o.dict) && o.stream) { const mt = (o.dict.match(/\/Matrix\s*\[([^\]]*)\]/) || [])[1]; const M = mt ? mt.trim().split(/\s+/).map(Number) : [1, 0, 0, 1, 0, 0];
            const rec = dictDe(o.dict, 'Resources') || recursos; await executa(latin(await bytesDoFluxo(o)), rec, mul(M, ctm), itens, prof + 1); }
          break; }
      }
    }
  }
  /* páginas na ordem da árvore */
  const raiz = ref((S.match(/trailer\s*<<([\s\S]*?)>>\s*startxref/) || S.match(/\/Root\s+\d+\s+\d+\s+R[\s\S]*/) || [''])[0], 'Root') || [...OBJ].find(([, o]) => /\/Type\s*\/Catalog/.test(o.dict))?.[0];
  const paginas = [];
  const percorre = (id, herdado, prof) => { const o = OBJ.get(id); if (!o || prof > 30) return; const d = o.dict;
    const rec = dictDe(d, 'Resources') || herdado;
    if (/\/Type\s*\/Pages\b/.test(d)) { const kids = (d.match(/\/Kids\s*\[([^\]]*)\]/) || ['', ''])[1]; for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) percorre(+k[1], rec, prof + 1); }
    else if (/\/Type\s*\/Page\b/.test(d)) paginas.push({ id, d, rec }); };
  const cat = raiz && OBJ.get(raiz); if (cat) percorre(ref(cat.dict, 'Pages'), '', 0);
  if (!paginas.length) for (const [id, o] of OBJ) if (/\/Type\s*\/Page\b/.test(o.dict)) paginas.push({ id, d: o.dict, rec: dictDe(o.dict, 'Resources') });
  const saida = [];
  for (const pg of paginas) {
    const cont = pg.d.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/); let txt = '';
    if (cont) for (const r of cont[1].matchAll(/(\d+)\s+\d+\s+R/g)) { const o = OBJ.get(+r[1]); if (o && o.stream) txt += latin(await bytesDoFluxo(o)) + '\n'; }
    const itens = []; await executa(txt, pg.rec, [1, 0, 0, 1, 0, 0], itens, 0);
    itens.forEach(x => { delete x.pend; x.s = x.s.replace(/\u0000/g, '').replace(/ /g, ' '); });
    saida.push(itens.filter(x => x.s.trim()));
  }
  return saida;
}
/* agrupa os trechos de cada página em linhas (mesma altura), da esquerda para a direita */
function linhasPDF(paginas, tol = 2.2) {
  const out = [];
  paginas.forEach((its, p) => {
    const ord = its.slice().sort((a, b) => b.y - a.y || a.x - b.x), linhas = [];
    for (const it of ord) { const l = linhas.find(l => Math.abs(l.y - it.y) <= tol); if (l) l.its.push(it); else linhas.push({ y: it.y, its: [it] }); }
    linhas.forEach(l => { l.its.sort((a, b) => a.x - b.x); l.pag = p + 1; l.txt = l.its.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(); l.x = l.its[0].x; });
    out.push(...linhas.sort((a, b) => b.y - a.y));
  });
  return out;
}

/* ── utilidades dos leitores ── */
/* divisa entre a coluna da esquerda e a da direita de uma tabela de duas colunas de texto:
   início mais frequente dos trechos da direita (texto justificado quebra palavras em vários trechos) */
function corteColuna(linhas) {
  const xs = linhas.flatMap(l => l.its.map(t => Math.round(t.x))); if (!xs.length) return 150;
  const xe = Math.min(...xs), cont = {}; xs.filter(x => x > xe + 40).forEach(x => cont[x] = (cont[x] || 0) + 1);
  const xd = +Object.entries(cont).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || xe + 120;
  return xd - 4;
}
const nrmPT = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ehValorBR = s => /^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(String(s).trim());
const valorBR = s => { const t = String(s || '').trim(); return ehValorBR(t) ? Math.round(parseFloat(t.replace(/\./g, '').replace(',', '.')) * 100) / 100 : null; };
const juntaTxt = a => a.join(' ').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/(\p{L})- (\p{Lu})/gu, '$1-$2').trim();
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

/* natureza de despesa do financiador → rubrica do GPMOT (pode ser trocada na prévia) */
const MAPA_NATUREZA = [
  [/equipamento|material permanente/, '2.1'], [/obras|instala[cç]/, '2.2'],
  [/equipe executora|bolsa|pessoal|recursos humanos/, '1.1.1'], [/clt|encargos/, '1.1.2'],
  [/passage/, '1.2.1'], [/di[aá]ria|ajuda de custo/, '1.2.2'],
  [/material de consumo|consumo/, '1.3'], [/servi[cç]os de terceiros|servi[cç]o/, '1.4'],
  [/outros bens e direitos|licen[cç]a|software/, '1.4'],
  [/outras despesas|despesas operacionais|administrativ|indiretos|doa\b/, '1.5'], [/custos diretos/, '1.5']];
const rubricaDaNatureza = nome => { const n = nrmPT(nome); const m = MAPA_NATUREZA.find(([re]) => re.test(n)); return m ? m[1] : null; };

/* ── SIGITEC (Petrobras): "Plano de Trabalho" exportado do sistema em PDF ── */
async function lerPlanoSIGITEC(buf, nomeArquivo, inflar, opts = {}) {
  const pags = opts.pags || await lerPDF(buf, inflar);
  const todas = linhasPDF(pags);
  const lixo = l => /^(PETROBRAS|SIGITEC - Gest[aã]o de Investimentos em Tecnologia|PLANO DE TRABALHO|CRONOGRAMA DE DESEMBOLSO)$/i.test(l.txt) || /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(l.txt) || /^P[aá]gina \d+ de \d+$/i.test(l.txt) || /^Solicita[cç][aã]o de (Reformula[cç][aã]o|Aditivo|Altera[cç][aã]o)[\w\sçãáéíóúêô/-]*$/i.test(l.txt) || /^(Solicita[cç][aã]o de .*|DIFEREN[CÇ]AS DE OR[CÇ]AMENTO|JUSTIFICATIVA (T[EÉ]CNICA|DAS ALTERA).*) \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/i.test(l.txt);
  const L = todas.filter(l => !lixo(l));
  if (!opts.reformulacao && (!todas.some(l => /SIGITEC/i.test(l.txt)) || !todas.some(l => /^PLANO DE TRABALHO$/i.test(l.txt)))) falha('Este PDF não parece ser um Plano de Trabalho exportado do SIGITEC (Petrobras).');
  const R = { formato: 'SIGITEC (Petrobras) — PDF', arquivo: nomeArquivo, abas: [], paginas: pags.length, avisos: [], conferencias: [], declarado: {} };
  const idx = (re, de = 0) => { for (let i = de; i < L.length; i++) if (re.test(L[i].txt)) return i; return -1; };
  const entre = (reIni, reFim, de = 0) => { const a = idx(reIni, de); if (a < 0) return []; const b = idx(reFim, a + 1); return L.slice(a + 1, b < 0 ? L.length : b); };
  const valorCampo = (re, xMin = 140) => { const i = idx(re); if (i < 0) return ''; const v = [];
    for (let k = Math.max(0, i - 1); k < Math.min(L.length, i + 4); k++) { const l = L[k]; if (l.pag !== L[i].pag || Math.abs(l.y - L[i].y) > 14) continue; if (k > i && l.its[0].x < xMin && !/^(Processo|Proposta|Contratual|Divulga[cç][aã]o)$/i.test(l.its[0].s.trim())) break; if (k < i && l.its[0].x < xMin) continue; v.push(...l.its.filter(t => t.x >= xMin).map(t => t.s)); }
    return juntaTxt(v); };
  /* 1. identificação */
  R.processo = (L[idx(/^Processo \S/)] || { txt: '' }).txt.replace(/^Processo\s+/, '');
  R.programa = valorCampo(/^Tipo de Investimento/);
  R.coordenador = valorCampo(/^Coordenador \S/);
  R.gerenciaTecnica = valorCampo(/^Ger[eê]ncia T[eé]cnica/);
  R.meses = parseInt(valorCampo(/^Dura[cç][aã]o/), 10) || null;
  R.instrumento = valorCampo(/^Tipo de Instrumento/);
  R.financiador = 'Petrobras';
  R.chamada = R.processo ? 'SIGITEC ' + R.processo : '';
  R.programa = R.programa.replace(/\s*-\s*Vers[aã]o \d+\s*$/i, '');
  R.titulo = juntaTxt(entre(/^T[ií]tulo em Portugu[eê]s$/, /^Palavras-chave$/).map(l => l.txt));
  R.tema = entre(/^Palavras-chave$/, /^Projeto - Institui/).map(l => l.txt).join('; ');
  { const ins = entre(/^Institui[cç][oõ]es de Pesquisa/, /^Respons[aá]vel da Convenente/), h = ins.find(l => l.its.some(t => /^Convenente$/i.test(t.s.trim())));
    if (h) { const xc = h.its.find(t => /^Convenente$/i.test(t.s.trim())).x, hn = ins.find(l => l.y < h.y && l.its.some(t => /^Nome$/i.test(t.s.trim()))) || h;
      const dados = ins.filter(l => l.y < hn.y), xs = []; dados.forEach(l => l.its.forEach(t => xs.push(Math.round(t.x))));
      const cl = []; xs.sort((a, b) => a - b).forEach(x => { const c = cl.find(c => Math.abs(c.x - x) < 8); if (c) c.n++; else cl.push({ x, n: 1 }); });
      const ini = cl.filter(c => c.n >= 2).map(c => c.x).sort((a, b) => a - b), a = ini.filter(x => x <= xc + 2).pop() ?? 0, b = ini.find(x => x > a + 8) ?? 9999;
      const txt = juntaTxt(dados.flatMap(l => l.its.filter(t => t.x >= a - 2 && t.x < b - 2).map(t => t.s))).split(/Pessoa jur/i)[0].trim();
      R.gestoraNome = txt; R.gestora = (txt.match(/\/\s*([A-ZÇÃÕÉ]{3,})\s*$/) || [])[1] || txt; } }
  R.linha = juntaTxt(entre(/^Linhas de Pesquisas das Executoras$/, /^Resumo em Portugu/).filter(l => !/^Institui[cç][aã]o Linha/.test(l.txt)).flatMap(l => l.its.filter(t => t.x > 250).map(t => t.s)));
  const resumo = juntaTxt(entre(/^Resumo em Portugu[eê]s$/, /^Objetivo Geral$/).map(l => l.txt)), objetivo = juntaTxt(entre(/^Objetivo Geral$/, /^Objetivos Espec[ií]ficos$/).map(l => l.txt));
  R.resumo = [resumo, objetivo && 'Objetivo geral: ' + objetivo].filter(Boolean).join('\n\n');
  /* 2. etapas e atividades */
  const etapas = {}; entre(/^Etapas$/, /^Atividades$/).concat(entre(/^Etapas$/, /^Atividades$/, idx(/^Atividades$/) + 1)).forEach(l => { if (l.its.length >= 2 && /^\d+$/.test(l.its[0].s.trim())) etapas[l.its[0].s.trim()] = juntaTxt(l.its.slice(1).map(t => t.s)); });
  const atv = []; { const ini = idx(/^Atividades$/), fim = idx(/^Detalhamento das Atividades$/);
    for (const l of L.slice(ini + 1, fim)) { if (/^Etapas Atividades/i.test(l.txt) || /^Atividades$/.test(l.txt)) continue;
      const t = l.its.map(x => x.s.trim()).filter(Boolean);
      if (t.length >= 5 && /^\d+$/.test(t[0]) && /^\d+$/.test(t[t.length - 1]) && /^\d+$/.test(t[t.length - 2]) && /^\d+$/.test(t[t.length - 3])) atv.push({ etapa: t[0], nome: juntaTxt(t.slice(1, -3)), mi: +t[t.length - 3], mf: +t[t.length - 2], dur: +t[t.length - 1] });
      else if (atv.length && t.length && !/^\d+$/.test(t[0])) atv[atv.length - 1].nome = juntaTxt([atv[atv.length - 1].nome, ...t]); } }
  /* detalhamento: nomes (coluna esquerda) na mesma ordem das atividades */
  { const sec = entre(/^Detalhamento das Atividades$/, /^Projeto - Equipe Executora$/).filter(l => !/^Atividades Detalhamento$/i.test(l.txt) && !/^Detalhamento das Atividades$/.test(l.txt));
    const corte = corteColuna(sec); let k = -1, esq = '', fechado = true;
    for (const l of sec) {
      const e = juntaTxt(l.its.filter(t => t.x < corte).map(t => t.s)), d = juntaTxt(l.its.filter(t => t.x >= corte).map(t => t.s));
      if (e && fechado && k + 1 < atv.length) { k++; esq = e; atv[k].det = []; fechado = nrmPT(esq) === nrmPT(atv[k].nome); }
      else if (e && !fechado) { esq = juntaTxt([esq, e]); fechado = nrmPT(esq) === nrmPT(atv[k].nome) || nrmPT(esq).length >= nrmPT(atv[k].nome).length; }
      if (d && k >= 0) atv[k].det.push(d);
    }
    atv.forEach(a => { a.detalhe = a.det ? juntaTxt(a.det) : ''; delete a.det; });
    const semDet = atv.filter(a => !a.detalhe).length; R.conferencias.push({ ok: !semDet, txt: `Detalhamento encontrado para ${atv.length - semDet} de ${atv.length} atividades` }); }
  R.atividades = [];
  const codAtv = {}; const seq = {};
  Object.keys(etapas).sort((a, b) => a - b).forEach(e => R.atividades.push({ codigo: e, etapa: etapas[e], titulo: etapas[e], descricao: '', entrega: '', validador: '', mes_inicio: null, mes_fim: null, responsavel: '', folha: false }));
  atv.forEach(a => { seq[a.etapa] = (seq[a.etapa] || 0) + 1; const cod = a.etapa + '.' + seq[a.etapa]; codAtv[nrmPT(a.nome)] = cod;
    if (!etapas[a.etapa]) { etapas[a.etapa] = 'Etapa ' + a.etapa; R.atividades.push({ codigo: a.etapa, etapa: etapas[a.etapa], titulo: etapas[a.etapa], descricao: '', entrega: '', validador: '', folha: false }); R.avisos.push(`A etapa ${a.etapa} não tem nome no documento.`); }
    R.atividades.push({ codigo: cod, etapa: etapas[a.etapa], titulo: a.nome, descricao: '', detalhe: a.detalhe, entrega: '', validador: '', mes_inicio: a.mi, mes_fim: a.mf, responsavel: '', folha: true, ufsm: true }); });
  R.atividades.sort((a, b) => { const x = a.codigo.split('.').map(Number), y = b.codigo.split('.').map(Number); return x[0] - y[0] || (x[1] || 0) - (y[1] || 0); });
  R.temMatriz = true;
  { const fora = atv.filter(a => R.meses && (a.mf > R.meses || a.mi < 1 || a.mf < a.mi)), durErr = atv.filter(a => a.mf - a.mi + 1 !== a.dur);
    R.conferencias.push({ ok: !fora.length, txt: `${atv.length} atividades em ${Object.keys(etapas).length} etapas, todas dentro dos ${R.meses || '?'} meses` + (fora.length ? ` — fora do prazo: ${fora.map(a => a.nome).join('; ')}` : '') });
    if (durErr.length) R.avisos.push(`Duração diferente de (fim − início + 1) em: ${durErr.map(a => `${a.nome} (${a.mi}–${a.mf}, ${a.dur} meses)`).join('; ')}. Mantidos os meses de início e fim.`); }
  /* 3. equipe executora */
  const equipe = [];
  { const ini = idx(/^Projeto - Equipe Executora$/), fim = idx(/^Projeto - Equipe Executora x Etapas/);
    let cols = null;
    for (const l of L.slice(ini + 1, fim)) {
      if (l.its.some(t => /^Fun[cç][aã]o$/.test(t.s.trim())) && l.its.some(t => /^Nome$/.test(t.s.trim()))) { const hx = l.its.map(t => ({ x: t.x, s: nrmPT(t.s) })); cols = hx.map((h, i) => ({ nome: h.s, ini: i ? (hx[i - 1].x + h.x) / 2 : -1 })); continue; }
      if (/^\* -/.test(l.txt)) break;
      if (!cols || /^\(meses\)/.test(l.txt) || /^Equipe Executora$/.test(l.txt)) continue;
      const col = x => { let c = cols[0].nome; cols.forEach(k => { if (x >= k.ini) c = k.nome; }); return c; };
      const cel = {}; l.its.forEach(t => { const c = col(t.x); cel[c] = juntaTxt([cel[c] || '', t.s]); });
      const nomeC = cols[0].nome, funC = cols.find(c => /fun/.test(c.nome));
      if (cel[nomeC] && funC && cel[funC.nome]) equipe.push({ ...cel });
      else if (equipe.length) Object.entries(cel).forEach(([c, v]) => { const e = equipe[equipe.length - 1]; e[c] = juntaTxt([e[c] || '', v]); });
    }
    const pega = (e, re) => { const k = Object.keys(e).find(c => re.test(c)); return k ? e[k] : ''; };
    equipe.forEach(e => {
      const nome = pega(e, /^nome/).replace(/\s*\*\s*$/, '').trim();
      R.equipe = R.equipe || [];
      const vaga = /membro de equipe n[aã]o definido/i.test(nome), nVaga = (nome.match(/(\d+)\s*$/) || [])[1];
      R.equipe.push({ nome, nomeOriginal: nome, funcao: pega(e, /^fun/), nivel: pega(e, /^titula/), formacao: pega(e, /^forma/), ict: pega(e, /^institui/) || 'UFSM', email: '', lattes: '',
        meses: parseInt(pega(e, /^per/), 10) || null, horas: parseInt(pega(e, /^carga/), 10) || null, etapas: [], ufsm: true, vaga, nVaga, permanente: /\*\s*$/.test(pega(e, /^nome/)) });
    });
    R.equipe = R.equipe || [];
    const coord = R.equipe.find(e => /coordenador/i.test(e.funcao)); const em = L.find(l => /^E-mail /.test(l.txt) || /^E-mail$/.test(l.its[0].s.trim()));
    const mail = (todas.map(l => l.txt).join(' ').match(/E-mail\s+([\w.+-]+@[\w.-]+)/) || [])[1]; if (coord && mail) coord.email = mail.toLowerCase();
    R.equipe.filter(e => e.vaga).forEach(e => e.nome = `Vaga ${e.nVaga || ''} — ${e.funcao}${e.nivel ? ' · ' + e.nivel : ''}${e.formacao ? ' (' + e.formacao + ')' : ''}`.replace(/\s+/g, ' '));
  }
  /* equipe × atividades */
  { const sec = entre(/^Projeto - Equipe Executora x Etapas/, /^Projeto - Viagens$/).filter(l => !/^Nome Etapas \/ Atividades$/i.test(l.txt));
    const corte = corteColuna(sec), blocos = []; let b = null;
    for (const l of sec) { const e = juntaTxt(l.its.filter(t => t.x < corte).map(t => t.s)), d = juntaTxt(l.its.filter(t => t.x >= corte).map(t => t.s));
      if (e && /^Etapa:/.test(d)) { b = { nome: e, txt: [d] }; blocos.push(b); }
      else if (b) { if (e) b.nome = juntaTxt([b.nome, e]); if (d) b.txt.push(d); } }
    let semPar = 0;
    blocos.forEach(bl => {
      const e = R.equipe.find(x => nrmPT(x.nomeOriginal) === nrmPT(bl.nome)); if (!e) { semPar++; return; }
      const nomes = juntaTxt(bl.txt).split(/Etapa:/).flatMap(p => (p.split(/Atividades:/)[1] || '').split(/\s*;\s*/)).map(s => nrmPT(s)).filter(Boolean);
      e.etapas = [...new Set(nomes.map(n => codAtv[n]).filter(Boolean))];
      const faltam = nomes.filter(n => !codAtv[n]); if (faltam.length && !opts.reformulacao) R.avisos.push(`Atividades de ${e.nomeOriginal} não encontradas no cronograma: ${faltam.join('; ')}`);
    });
    R.conferencias.push({ ok: !semPar && blocos.length === R.equipe.length, txt: `Matriz equipe × atividades: ${blocos.length - semPar} de ${R.equipe.length} membros` }); }
  /* 4. relatórios previstos → entregas */
  R.entregas = entre(/^Projeto - Relat[oó]rios Previstos$/, /^Or[cç]amento - Parcela Planejada$/).filter(l => l.its.length >= 2 && /^\d+$/.test(l.its[l.its.length - 1].s.trim()) && !/^Relat[oó]rio M[eê]s$/i.test(l.txt))
    .map(l => { const t = juntaTxt(l.its.slice(0, -1).map(x => x.s)), mes = +l.its[l.its.length - 1].s.trim();
      return { titulo: t, mes, tipo: /gerencial/i.test(t) ? 'prestacao_parcial' : /\bRTC\b|final/i.test(t) || (R.meses && mes >= R.meses && /t[eé]cnico/i.test(t)) ? 'relatorio_final' : 'relatorio_parcial' }; });
  /* 5. orçamento por natureza (totais declarados) */
  R.naturezas = [];
  { const sec = entre(/^Or[cç]amento - Detalhamento$/, /^Rela[cç][aã]o dos Itens/);
    for (const l of sec) { const t = l.its.map(x => x.s.trim()).filter(Boolean), iv = t.findIndex(ehValorBR); if (iv < 1) continue;
      const nome = juntaTxt(t.slice(0, iv)); const v = valorBR(t[iv]);
      if (/^TOTAL GERAL$/i.test(nome)) R.declarado.total = v; else if (!/^total$/i.test(nome) && !/^Despesas/i.test(nome)) R.naturezas.push({ nome, valor: v, rubrica: rubricaDaNatureza(nome) }); } }
  if (!R.naturezas.length) R.avisos.push('Não encontrei o quadro "Orçamento - Detalhamento".');
  /* 6. relações de itens (por natureza) */
  R.itens = []; R.bolsas = [];
  { const iniRel = []; L.forEach((l, i) => { if (/^Rela[cç][aã]o dos Itens - /.test(l.txt)) iniRel.push(i); });
    const fimTudo = idx(/^(Outras Fontes|Documentos( -|$)|DIFEREN[CÇ]AS DE OR[CÇ]AMENTO|JUSTIFICATIVA T[EÉ]CNICA)/);
    iniRel.forEach((a, n) => {
      const b = n + 1 < iniRel.length ? iniRel[n + 1] : (fimTudo < 0 ? L.length : fimTudo);
      const titulo = L[a].txt.replace(/^Rela[cç][aã]o dos Itens - /, ''), partes = titulo.split(/\s+-\s+/), natureza = partes[0], origem = /importad/i.test(titulo) ? 'importado' : 'nacional';
      const bloco = L.slice(a + 1, b).filter(l => !/^Despesas (Correntes|de Capital)$/.test(l.txt));
      const hdr = bloco.find(l => /^N[º°o]$/.test(l.its[0].s.trim())); if (!hdr) { R.avisos.push(`Tabela "${titulo}" sem cabeçalho reconhecível.`); return; }
      const rotulos = hdr.its.map(t => nrmPT(t.s)).filter(s => !/^n[º°o]$|^quant|^per[ií]odo|^valor|^\(meses\)$/.test(s));
      const linhas = bloco.slice(bloco.indexOf(hdr) + 1); let atual = null, modo = 'linha'; const itens = []; let totalDecl = null;
      for (const l of linhas) {
        const t0 = l.its[0].s.trim();
        if (/^VALOR TOTAL$/i.test(juntaTxt(l.its.slice(0, -1).map(x => x.s))) || /^VALOR TOTAL/i.test(l.txt)) { totalDecl = valorBR(l.its[l.its.length - 1].s); atual = null; continue; }
        if (/^Per[ií]odo \(meses\)|^\(meses\)$/.test(l.txt)) continue;
        if (/^\d+$/.test(t0) && l.its[0].x < 45 && l.its.length >= 3) { atual = { n: +t0, partes: [l], just: [] }; itens.push(atual); modo = 'linha'; continue; }
        if (!atual) continue;
        if (/^Justificativa:?$/.test(l.txt.trim()) || /^Justificativa:/.test(l.txt)) { modo = 'just'; const r = l.txt.replace(/^Justificativa:\s*/, ''); if (r) atual.just.push(r); continue; }
        if (/^Or[cç]amento\/Proposta|^Demonstrativo:|^No caso de profissionais/.test(l.txt)) { modo = 'fim'; continue; }
        if (modo === 'linha') atual.partes.push(l); else if (modo === 'just') atual.just.push(l.txt);
      }
      /* colunas de texto: posições de início nas linhas de abertura dos itens */
      const xs = []; itens.forEach(it => it.partes[0].its.slice(1).forEach(t => { if (!ehValorBR(t.s.trim()) && !/^\d+$/.test(t.s.trim())) xs.push(t.x); }));
      const clus = []; xs.sort((p, q) => p - q).forEach(x => { const c = clus.find(c => Math.abs(c.x - x) < 8); if (c) c.n++; else clus.push({ x, n: 1 }); });
      const colsTxt = clus.filter(c => c.n >= Math.max(1, Math.ceil(itens.length * 0.3))).map(c => c.x).sort((p, q) => p - q);
      const nomeCol = i => rotulos[i] || 'col' + i;
      const somaItens = [];
      itens.forEach(it => {
        const cel = {}, nums = [];
        it.partes.forEach((l, k) => l.its.forEach((t, j) => { const s = t.s.trim(); if (k === 0 && j === 0) return;
          if (ehValorBR(s) || (/^\d+$/.test(s) && t.x > (colsTxt[colsTxt.length - 1] || 0) + 60)) { if (k === 0) nums.push(s); return; }
          let c = 0; colsTxt.forEach((x, i) => { if (t.x >= x - 6) c = i; }); const nm = nomeCol(c); cel[nm] = juntaTxt([cel[nm] || '', s]); }));
        const valor = valorBR(nums[nums.length - 1]), unit = nums.length >= 2 ? valorBR(nums[nums.length - 2]) : null, qtd = nums.length >= 3 ? parseFloat(String(nums[nums.length - 3]).replace(/\./g, '').replace(',', '.')) : null;
        const pega = re => { const k = Object.keys(cel).find(c => re.test(c)); return k ? cel[k] : ''; };
        const just = juntaTxt(it.just);
        somaItens.push(valor || 0);
        if (/equipe executora/i.test(natureza)) {
          R.bolsas.push({ nome: pega(/membro/), modalidade: pega(/modalidade/), tipo: pega(/tipo da remun/), valor_mensal: unit, meses: qtd ? Math.round(qtd) : (unit ? Math.round(valor / unit) : 1), total: valor, justificativa: just, rubrica: null, natureza });
        } else {
          const tipo = pega(/^tipo$|^viagem$/), desc = pega(/descri/) || tipo;
          R.itens.push({ natureza, rubrica: null, numero: it.n, descricao: desc || ('Item ' + it.n), tipo, justificativa: just || null, origem, quantidade: qtd, valor_unitario: unit && qtd ? unit : null, moeda: 'BRL', cambio: null, detalhe: [tipo && tipo !== desc ? 'Tipo: ' + tipo : '', pega(/destina/) && !/GRUPO DE PESQUISAS/i.test(pega(/destina/)) ? 'Destinação: ' + pega(/destina/) : ''].filter(Boolean).join(' · ') || null, valor_previsto: valor || 0 });
        }
      });
      const soma = r2(somaItens.reduce((s, v) => s + v, 0));
      R.conferencias.push({ ok: totalDecl == null || Math.abs(soma - totalDecl) < 0.02, txt: `${titulo}: ${itens.length} item(ns) somam ${fmtBRL2(soma)}` + (totalDecl != null ? (Math.abs(soma - totalDecl) < 0.02 ? ' = total do documento' : ` ≠ total do documento ${fmtBRL2(totalDecl)}`) : '') });
    }); }
  /* título da relação ("Diária") → natureza do orçamento ("Diária ou Ajuda de Custo") */
  { const casa = t => { const a = nrmPT(t); return R.naturezas.find(n => nrmPT(n.nome) === a) || R.naturezas.find(n => nrmPT(n.nome).startsWith(a) || a.startsWith(nrmPT(n.nome))) || R.naturezas.find(n => nrmPT(n.nome).split(' ')[0] === a.split(' ')[0]); };
    R.itens.forEach(i => { const n = casa(i.natureza); if (n) i.natureza = n.nome; else R.avisos.push(`A relação de itens "${i.natureza}" não corresponde a nenhuma natureza do orçamento.`); });
    R.bolsas.forEach(b => { const n = casa(b.natureza); if (n) b.natureza = n.nome; }); }
  /* conferência natureza × itens */
  R.naturezas.forEach(nt => { const k = nrmPT(nt.nome);
    const s = /equipe executora/.test(k) ? R.bolsas.reduce((t, b) => t + (b.total || 0), 0) : R.itens.filter(i => nrmPT(i.natureza) === k).reduce((t, i) => t + i.valor_previsto, 0);
    R.conferencias.push({ ok: Math.abs(r2(s) - nt.valor) < 0.02, txt: `${nt.nome}: itens ${fmtBRL2(s)} × orçamento ${fmtBRL2(nt.valor)}` }); });
  { const s = r2(R.naturezas.reduce((t, n) => t + n.valor, 0)); R.conferencias.push({ ok: R.declarado.total != null && Math.abs(s - R.declarado.total) < 0.02, txt: `Naturezas somam ${fmtBRL2(s)} × total geral ${fmtBRL2(R.declarado.total)}` }); }
  /* bolsas → posições da equipe */
  R.bolsas.forEach(b => { const e = R.equipe.find(x => !x.bolsa && nrmPT(x.nomeOriginal) === nrmPT(b.nome));
    if (e) e.bolsa = b; else R.avisos.push(`A bolsa de "${b.nome}" (${b.modalidade}) não tem membro correspondente na equipe executora.`); });
  /* 7. cronograma de desembolso (página final) */
  { const i0 = todas.findIndex(l => /^CRONOGRAMA DE DESEMBOLSO$/i.test(l.txt));
    if (i0 >= 0) {
      const sec = todas.slice(i0 + 1).filter(l => !lixo(l)), hm = sec.find(l => /M[eê]s\s*\d+/i.test(l.txt) && !ehValorBR(l.its[l.its.length - 1].s.trim()));
      const meses = hm ? [...hm.txt.matchAll(/M[eê]s\s*(\d+)/gi)].map(m => +m[1]) : [];
      const parc = meses.map((m, i) => ({ numero: i + 1, mes: m, descricao: `${i + 1}ª parcela (mês ${m})`, valor: 0, porNatureza: {} }));
      for (const l of sec) { const t = l.its.map(x => x.s.trim()).filter(Boolean), iv = t.findIndex(ehValorBR); if (iv < 1 || !parc.length) continue;
        const vals = t.slice(iv).map(valorBR); let nome = juntaTxt(t.slice(0, iv)).replace(/^Despesas (de Capital|Correntes)\s*/i, '').trim();
        if (/^TOTAL GERAL$/i.test(nome)) { parc.forEach((p, k) => p.valor = vals[k] || 0); R.declarado.totalDesembolso = vals[parc.length]; break; }
        if (/^TOTAL DE/i.test(nome) || !nome) continue;
        parc.forEach((p, k) => { if (vals[k]) p.porNatureza[nome] = vals[k]; }); }
      R.desembolso = parc.length ? { fundacao: R.gestora || '', parcelas: parc } : null;
      if (R.desembolso) { const s = r2(parc.reduce((t, p) => t + p.valor, 0)); R.conferencias.push({ ok: Math.abs(s - (R.declarado.total || 0)) < 0.02, txt: `Desembolso: ${parc.length} parcelas (meses ${meses.join(', ')}) somam ${fmtBRL2(s)}` });
        R.naturezas.forEach(nt => { const s2 = r2(parc.reduce((t, p) => t + (p.porNatureza[nt.nome] || 0), 0)); if (Math.abs(s2 - nt.valor) >= 0.02) R.conferencias.push({ ok: false, txt: `Desembolso de "${nt.nome}" soma ${fmtBRL2(s2)} × orçamento ${fmtBRL2(nt.valor)}` }); }); }
    } else R.avisos.push('O PDF não traz a página "Cronograma de Desembolso".'); }
  R.notas = [R.processo && 'Processo SIGITEC ' + R.processo, R.instrumento && 'Instrumento: ' + R.instrumento, R.gerenciaTecnica && 'Gerência técnica Petrobras: ' + R.gerenciaTecnica, R.gestoraNome && 'Convenente: ' + R.gestoraNome].filter(Boolean).join(' · ');
  aplicarNaturezas(R);
  return R;
}
/* aplica o mapa natureza → rubrica (refeito quando o usuário troca uma rubrica na prévia) */
function aplicarNaturezas(R) {
  if (!R.naturezas) return R;
  const rub = nome => { const n = R.naturezas.find(x => nrmPT(x.nome) === nrmPT(nome)); return n ? n.rubrica : rubricaDaNatureza(nome); };
  R.orcamento = {}; R.naturezas.forEach(n => { if (n.rubrica) R.orcamento[n.rubrica] = r2((R.orcamento[n.rubrica] || 0) + n.valor); });
  R.totalUFSM = r2(R.naturezas.reduce((t, n) => t + n.valor, 0));
  (R.itens || []).forEach(i => { i.rubrica = rub(i.natureza); });
  (R.bolsas || []).forEach(b => { b.rubrica = rub(b.natureza) || '1.1.1'; });
  if (R.desembolso) R.desembolso.parcelas.forEach(p => { p.dist = {}; Object.entries(p.porNatureza || {}).forEach(([nm, v]) => { const r = rub(nm); if (r) p.dist[r] = r2((p.dist[r] || 0) + v); }); });
  R.semRubrica = R.naturezas.filter(n => !n.rubrica).map(n => n.nome);
  /* numeração sequencial por rubrica (nacionais e importados podem repetir números no documento) */
  const seq = {}; (R.itens || []).forEach(i => { if (!i.rubrica) return; seq[i.rubrica] = (seq[i.rubrica] || 0) + 1; i.numero = seq[i.rubrica]; });
  return R;
}

/* ── plano padrão do GPMOT em JSON (para qualquer financiador) ──────────────
   Formato aberto: pode ser preenchido à mão, gerado por outro sistema ou por um assistente de IA
   a partir de qualquer documento. Passa pelas mesmas conferências e pela mesma prévia.
   Campos (todos opcionais, menos formato): ver README → "Importação de planos de trabalho". */
function lerPlanoPadrao(obj, nomeArquivo) {
  if (!obj || obj.formato !== 'gpmot-plano-1') falha('Este JSON não está no formato "gpmot-plano-1" (plano de trabalho padrão do GPMOT).');
  const R = { formato: 'Plano padrão GPMOT (JSON)', arquivo: nomeArquivo, abas: [], avisos: [], conferencias: [], declarado: { total: obj.total_geral ?? null } };
  const txt = v => v == null ? '' : String(v).trim(), n = v => v == null || v === '' ? null : Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  Object.assign(R, { titulo: txt(obj.titulo), financiador: txt(obj.financiador), programa: txt(obj.programa), chamada: txt(obj.chamada), linha: txt(obj.linha), tema: txt(obj.tema), meses: parseInt(obj.duracao_meses, 10) || null,
    resumo: txt(obj.resumo), coordenador: txt(obj.coordenador), gestora: txt(obj.fundacao), notas: txt(obj.notas) });
  R.naturezas = (obj.orcamento || []).map(o => ({ nome: txt(o.natureza || o.rubrica), valor: r2(n(o.valor)), rubrica: /^\d+(\.\d+)*$/.test(txt(o.rubrica)) ? txt(o.rubrica) : rubricaDaNatureza(o.natureza || '') }));
  R.atividades = []; const seq = {};
  (obj.etapas || []).forEach((e, i) => { const ce = txt(e.codigo) || String(i + 1); R.atividades.push({ codigo: ce, etapa: txt(e.nome), titulo: txt(e.nome), descricao: '', entrega: '', validador: '', folha: !(e.atividades || []).length, mes_inicio: null, mes_fim: null, responsavel: '' });
    (e.atividades || []).forEach(a => { seq[ce] = (seq[ce] || 0) + 1; const c = txt(a.codigo) || ce + '.' + seq[ce];
      R.atividades.push({ codigo: c, etapa: txt(e.nome), titulo: txt(a.nome), descricao: '', detalhe: txt(a.descricao), entrega: txt(a.entrega), validador: txt(a.validador), mes_inicio: parseInt(a.mes_inicio, 10) || null, mes_fim: parseInt(a.mes_fim, 10) || null, responsavel: txt(a.responsavel), folha: true, ufsm: true }); }); });
  R.temMatriz = true;
  const codDe = nome => (R.atividades.find(a => a.folha && (a.codigo === txt(nome) || nrmPT(a.titulo) === nrmPT(nome))) || {}).codigo;
  R.equipe = (obj.equipe || []).map(e => { const vaga = !!e.vaga || !txt(e.nome);
    const b = e.bolsa && n(e.bolsa.valor_mensal) ? { modalidade: txt(e.bolsa.modalidade) || 'Bolsa', valor_mensal: r2(n(e.bolsa.valor_mensal)), meses: parseInt(e.bolsa.meses, 10) || 1, total: r2(n(e.bolsa.valor_mensal) * (parseInt(e.bolsa.meses, 10) || 1)), natureza: txt(e.bolsa.natureza) || 'Bolsas', rubrica: txt(e.bolsa.rubrica) || null } : null;
    return { nome: txt(e.nome) || txt(e.funcao) || 'Vaga', nomeOriginal: txt(e.nome), funcao: txt(e.funcao), nivel: txt(e.nivel), formacao: txt(e.formacao), ict: txt(e.instituicao) || 'UFSM', email: txt(e.email).toLowerCase(), lattes: txt(e.lattes),
      meses: parseInt(e.meses, 10) || null, horas: n(e.horas_semanais), etapas: (e.atividades || []).map(codDe).filter(Boolean), ufsm: true, vaga, bolsa: b }; });
  R.bolsas = R.equipe.filter(e => e.bolsa).map(e => e.bolsa);
  R.itens = (obj.itens || []).map((i, k) => ({ natureza: txt(i.natureza), rubrica: null, numero: k + 1, descricao: txt(i.descricao) || 'Item ' + (k + 1), justificativa: txt(i.justificativa) || null, origem: /import/i.test(txt(i.origem)) ? 'importado' : 'nacional',
    quantidade: n(i.quantidade), valor_unitario: n(i.valor_unitario), moeda: txt(i.moeda) || 'BRL', cambio: n(i.cambio), detalhe: txt(i.detalhe) || null, valor_previsto: r2(n(i.valor)) }));
  R.entregas = (obj.relatorios || obj.entregas || []).map(e => ({ titulo: txt(e.titulo), mes: parseInt(e.mes, 10) || null, tipo: TIPOS_ENTREGA.some(t => t[0] === e.tipo) ? e.tipo : /final/i.test(e.titulo) ? 'relatorio_final' : 'relatorio_parcial' })).filter(e => e.titulo && e.mes);
  if ((obj.desembolso || []).length) R.desembolso = { fundacao: R.gestora, parcelas: obj.desembolso.map((p, k) => ({ numero: k + 1, mes: parseInt(p.mes, 10) || null, descricao: txt(p.descricao) || `${k + 1}ª parcela${p.mes ? ' (mês ' + p.mes + ')' : ''}`, valor: r2(n(p.valor)),
    porNatureza: Object.fromEntries(Object.entries(p.por_natureza || {}).map(([k2, v]) => [k2, r2(n(v))])) })) };
  conferirPlano(R);
  return aplicarNaturezas(R);
}
/* conferências genéricas: somas por natureza, total geral, desembolso e meses */
function conferirPlano(R) {
  const ok = (c, t) => R.conferencias.push({ ok: !!c, txt: t }), eq = (a, b) => Math.abs(r2(a) - r2(b)) < 0.02;
  const tot = r2((R.naturezas || []).reduce((t, x) => t + x.valor, 0));
  if (R.declarado.total != null) ok(eq(tot, R.declarado.total), `Orçamento soma ${fmtBRL2(tot)} × total geral ${fmtBRL2(R.declarado.total)}`);
  (R.naturezas || []).forEach(nt => { const k = nrmPT(nt.nome);
    const its = R.itens.filter(i => nrmPT(i.natureza) === k), bol = R.bolsas.filter(b => nrmPT(b.natureza) === k);
    if (!its.length && !bol.length) return;
    const s = its.reduce((t, i) => t + i.valor_previsto, 0) + bol.reduce((t, b) => t + (b.total || 0), 0);
    ok(eq(s, nt.valor), `${nt.nome}: itens ${fmtBRL2(s)} × orçamento ${fmtBRL2(nt.valor)}`); });
  const soltos = R.itens.filter(i => !(R.naturezas || []).some(nt => nrmPT(nt.nome) === nrmPT(i.natureza)));
  if (soltos.length) ok(false, `${soltos.length} item(ns) com natureza fora do orçamento: ${[...new Set(soltos.map(i => i.natureza || '(vazia)'))].join(', ')}`);
  if (R.desembolso) { const s = R.desembolso.parcelas.reduce((t, p) => t + p.valor, 0); ok(eq(s, tot), `Desembolso: ${R.desembolso.parcelas.length} parcela(s) somam ${fmtBRL2(s)} × orçamento ${fmtBRL2(tot)}`); }
  const fora = R.atividades.filter(a => a.folha && R.meses && (a.mes_fim > R.meses || a.mes_inicio < 1 || a.mes_fim < a.mes_inicio));
  if (R.atividades.length) ok(!fora.length, `${R.atividades.filter(a => a.folha).length} atividade(s)${R.meses ? ' dentro dos ' + R.meses + ' meses' : ''}` + (fora.length ? ` — fora: ${fora.map(a => a.codigo).join(', ')}` : ''));
}
/* exporta o plano lido no formato padrão (para revisar, corrigir à mão e importar de novo) */
function planoParaPadrao(R) {
  const etapas = R.atividades.filter(a => !a.codigo.includes('.')).map(e => ({ codigo: e.codigo, nome: e.titulo,
    atividades: R.atividades.filter(a => a.folha && a.codigo.split('.')[0] === e.codigo).map(a => ({ codigo: a.codigo, nome: a.titulo, descricao: a.detalhe || a.descricao || '', mes_inicio: a.mes_inicio, mes_fim: a.mes_fim, entrega: a.entrega || '', validador: a.validador || '', responsavel: a.responsavel || '' })) }));
  return { formato: 'gpmot-plano-1', origem: R.formato + ' · ' + R.arquivo, titulo: R.titulo, financiador: R.financiador, programa: R.programa, chamada: R.chamada, linha: R.linha, tema: R.tema, duracao_meses: R.meses, resumo: R.resumo, coordenador: R.coordenador, fundacao: R.gestora, notas: R.notas || '',
    total_geral: R.declarado && R.declarado.total != null ? R.declarado.total : R.totalUFSM,
    orcamento: (R.naturezas || Object.entries(R.orcamento || {}).map(([c, v]) => ({ nome: c, valor: v, rubrica: c }))).map(x => ({ natureza: x.nome, rubrica: x.rubrica, valor: x.valor })),
    etapas, equipe: R.equipe.map(e => ({ nome: e.vaga ? '' : e.nome, vaga: !!e.vaga, funcao: e.vaga ? e.nome : e.funcao, nivel: e.nivel || '', formacao: e.formacao || '', instituicao: e.ict || '', email: e.email || '', lattes: e.lattes || '', horas_semanais: e.horas || null, meses: e.meses || null,
      atividades: e.etapas, bolsa: e.bolsa ? { modalidade: e.bolsa.modalidade, valor_mensal: e.bolsa.valor_mensal, meses: e.bolsa.meses, natureza: e.bolsa.natureza || '', rubrica: e.bolsa.rubrica } : null })),
    itens: R.itens.map(i => ({ natureza: i.natureza || Calc.rotuloRubrica(i.rubrica), descricao: i.descricao, justificativa: i.justificativa || '', origem: i.origem, quantidade: i.quantidade, valor_unitario: i.valor_unitario, moeda: i.moeda, cambio: i.cambio, detalhe: i.detalhe || '', valor: i.valor_previsto })),
    relatorios: (R.entregas || []).map(e => ({ titulo: e.titulo, mes: e.mes, tipo: e.tipo })),
    desembolso: R.desembolso ? R.desembolso.parcelas.map(p => ({ mes: p.mes || null, descricao: p.descricao, valor: p.valor, por_natureza: p.porNatureza || p.dist })) : [] };
}
/* ── qual leitor usar ── */
const LEITORES_PLANO = [
  { nome: 'Planilha do edital Mover/Fundep (.xlsx)', ext: /\.xlsx$/i, ler: f => lerModeloEdital(f) },
  { nome: 'Plano de Trabalho do SIGITEC/Petrobras (.pdf)', ext: /\.pdf$/i, ler: async f => lerPlanoSIGITEC(await f.arrayBuffer(), f.name) },
  { nome: 'Plano padrão do GPMOT (.json)', ext: /\.json$/i, ler: async f => { let o; try { o = JSON.parse(await f.text()); } catch { falha('O arquivo .json está com erro de formatação.'); } return lerPlanoPadrao(o, f.name); } }];
async function lerPlanoDeTrabalho(f) {
  const l = LEITORES_PLANO.find(x => x.ext.test(f.name));
  if (!l) falha('Formato não reconhecido. Aceitos: ' + LEITORES_PLANO.map(x => x.nome).join('; ') + '. Para outros financiadores, converta o documento para o plano padrão (.json) — veja o README.');
  const R = await l.ler(f); R.formato = R.formato || l.nome; R.conferencias = R.conferencias || []; return R;
}
