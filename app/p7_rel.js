
/* ════════════════════════════════════════════════════════════════════
   RELATÓRIOS — gerador de Word (.docx) embutido e relatório físico-financeiro por projeto
   Modelo comum de relatório: R = { titulo, subtitulo, escopo, data, S:[{h, blocks}], assinatura? }
   blocos: {p} parágrafo · {h3} subtítulo · {kv:[[rótulo, valor]]} · {lista:[...]} · {head, rows, total?} tabela
   ════════════════════════════════════════════════════════════════════ */

/* ── ZIP (sem compressão) ── */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {   // files: [[nome, string]]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const [nome, txt] of files) {
    const nb = enc.encode(nome), data = enc.encode(txt), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const cSize = central.reduce((s, x) => s + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0; all.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}

/* ── DOCX ── */
const xe = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ehNumCel = s => /^(-?R\$\s?-?[\d.]+(,\d+)?|-?[\d.]+(,\d+)?\s?%?|\d+\/\d+|—)$/.test(String(s ?? '').trim());
function docxDeRelatorio(R) {
  const LARG = 9638;   // A4 com margens de 2 cm, em DXA
  const run = (t, o = {}) => `<w:r>${o.b || o.sz || o.cor || o.i ? `<w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.cor ? `<w:color w:val="${o.cor}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
  const par = (t, o = {}) => String(t ?? '').split(/\n/).map(l => `<w:p>${o.estilo || o.al || o.manter || o.antes != null || o.depois != null ? `<w:pPr>${o.estilo ? `<w:pStyle w:val="${o.estilo}"/>` : ''}${o.manter ? '<w:keepNext/>' : ''}${o.antes != null || o.depois != null ? `<w:spacing w:before="${o.antes ?? 0}" w:after="${o.depois ?? 80}"/>` : ''}${o.al ? `<w:jc w:val="${o.al}"/>` : ''}</w:pPr>` : ''}${run(l, o)}</w:p>`).join('');
  const tabela = (head, rows, o = {}) => {
    const n = head.length, sz = n > 6 ? 16 : n > 4 ? 17 : 19, cw = sz * 5.2;   // largura média de um caractere (DXA) no tamanho da fonte
    const palavra = t => Math.max(...String(t ?? '').split(/\s+/).map(x => x.length), 1);
    const minw = head.map((h, i) => Math.round(Math.max(palavra(h) * cw * 1.08, ...rows.map(r => ehNumCel(r[i]) ? String(r[i]).length * cw : palavra(r[i]) * cw)) + 150));
    const des = head.map((h, i) => Math.max(minw[i], Math.min(60, Math.max(String(h).length, ...rows.map(r => String(r[i] ?? '').length))) * cw + 150));
    let w; const sMin = minw.reduce((s, v) => s + v, 0), sDes = des.reduce((s, v) => s + v, 0);
    if (sDes <= LARG) w = des.map(v => v * LARG / sDes);                       // cabe tudo: escala para ocupar a largura
    else if (sMin <= LARG) { const extra = LARG - sMin, falta = des.map((d, i) => d - minw[i]), sf = falta.reduce((s, v) => s + v, 0) || 1; w = minw.map((m, i) => m + extra * falta[i] / sf); }
    else w = minw.map(v => v * LARG / sMin);
    w = w.map(v => Math.floor(v)); w[n - 1] += LARG - w.reduce((s, v) => s + v, 0);
    const cel = (t, i, hdr, tot2) => `<w:tc><w:tcPr><w:tcW w:w="${w[i]}" w:type="dxa"/>${hdr || tot2 ? '<w:shd w:val="clear" w:color="auto" w:fill="EFEDE7"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/>${!hdr && i > 0 && ehNumCel(t) && !/^(c[óo]digo|rubrica|n[º°o]|parcela)/i.test(head[i]) ? '<w:jc w:val="right"/>' : ''}</w:pPr>${run(t, { b: hdr || tot2, sz })}</w:p></w:tc>`;
    const borda = '<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBDB6"/><w:left w:val="single" w:sz="4" w:space="0" w:color="BFBDB6"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBDB6"/><w:right w:val="single" w:sz="4" w:space="0" w:color="BFBDB6"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBDB6"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBDB6"/>';
    return `<w:tbl><w:tblPr><w:tblW w:w="${LARG}" w:type="dxa"/><w:tblBorders>${borda}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>
      <w:tblGrid>${w.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>
      <w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => cel(h, i, true)).join('')}</w:tr>
      ${rows.map((r, k) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${head.map((_, i) => cel(r[i], i, false, o.total && k === rows.length - 1)).join('')}</w:tr>`).join('')}</w:tbl>${par('', { depois: 60 })}`;
  };
  const kv = pares => { const w1 = 2700, w2 = LARG - w1; return `<w:tbl><w:tblPr><w:tblW w:w="${LARG}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${w1}"/><w:gridCol w:w="${w2}"/></w:tblGrid>
    ${pares.map(([k, v]) => `<w:tr><w:tc><w:tcPr><w:tcW w:w="${w1}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="10" w:after="10"/></w:pPr>${run(k, { cor: '5F5E5A', sz: 19 })}</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="${w2}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="10" w:after="10"/></w:pPr>${run(v, { sz: 19 })}</w:p></w:tc></w:tr>`).join('')}</w:tbl>${par('', { depois: 60 })}`; };
  const lista = itens => itens.map(t => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="40"/></w:pPr>${run(t)}</w:p>`).join('');
  let corpo = par(R.titulo, { estilo: 'Title' }) + (R.subtitulo ? par(R.subtitulo, { estilo: 'Subtitle' }) : '') + par(`${R.escopo} · gerado em ${R.data}`, { cor: '5F5E5A', sz: 18, depois: 200 });
  R.S.forEach(s => {
    corpo += par(s.h, { estilo: 'Heading1' });
    s.blocks.forEach(b => {
      if (b.p != null) corpo += par(b.p, b.destaque ? { b: true } : {});
      else if (b.h3) corpo += par(b.h3, { estilo: 'Heading2' });
      else if (b.kv) corpo += kv(b.kv);
      else if (b.lista) corpo += lista(b.lista);
      else if (b.head) corpo += b.rows.length ? tabela(b.head, b.rows, b) : par('(sem registros)', { i: true, cor: '8A8984' });
    });
  });
  if (R.assinatura) corpo += par(R.assinatura.local, { antes: 480, al: 'right', manter: true }) + par(' ', { antes: 600, manter: true }) + par('_______________________________________', { al: 'center', depois: 0, manter: true }) + par(R.assinatura.nome, { al: 'center', b: true, depois: 0, manter: true }) + par(R.assinatura.cargo || '', { al: 'center', sz: 19, cor: '5F5E5A' });
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${corpo}
<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:color w:val="1C1C1A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:color w:val="3D3D3A"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="1C1C1A"/></w:pBdr><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1A5CA8"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="8A8984"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
</w:styles>`;
  const numeracao = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const fld = c => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${c} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const rodape = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>${run(R.rodape || R.titulo)}<w:r><w:tab/></w:r>${run('Página ')}${fld('PAGE')}${run(' de ')}${fld('NUMPAGES')}</w:p></w:ftr>`;
  const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zipStore([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(R.titulo)}</dc:title><dc:creator>GPMOT/UFSM</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`],
    ['word/document.xml', doc], ['word/styles.xml', estilos], ['word/numbering.xml', numeracao], ['word/footer1.xml', rodape]]);
}

/* ── prévia comum (imprimir/PDF, Word, Markdown) ── */
function abrirPrevia(R, base) {
  const ov = document.createElement('div'); ov.id = 'report';
  ov.innerHTML = `<div class="bar"><button class="btn-p" id="rp_p">⎙ Imprimir / salvar PDF</button><button id="rp_docx">⬇ Word (.docx)</button><button id="rp_md">⬇ Markdown</button><button id="rp_x" style="margin-left:auto">Fechar</button></div><div class="paper">${relHTML(R)}</div>`;
  document.body.appendChild(ov);
  ov.querySelector('#rp_x').onclick = () => ov.remove();
  ov.querySelector('#rp_p').onclick = () => { document.body.classList.add('printing'); const off = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', off); }; window.addEventListener('afterprint', off); window.print(); };
  ov.querySelector('#rp_md').onclick = () => baixar(base + '.md', relMD(R), 'text/markdown;charset=utf-8');
  ov.querySelector('#rp_docx').onclick = () => baixar(base + '.docx', docxDeRelatorio(R), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
const dataExtenso = iso => { const d = toDate(iso); return `${d.getDate()} de ${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][d.getMonth()]} de ${d.getFullYear()}`; };
const pct = (a, b) => b > 0 ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—';

/* ── Relatório físico-financeiro de um projeto ── */
function montarRelProjeto(p, o) {
  const de = o.de, ate = o.ate, noPer = d => d && d >= de && d <= ate, fin = Perm.veFin(p.id), sec = o.secoes;
  const S = [], nova = h => { const s = { h, blocks: [] }; S.push(s); return s; };
  const P = (s, t, x) => s.blocks.push({ p: t, ...x }), T = (s, head, rows, x) => s.blocks.push({ head, rows, ...x }), H3 = (s, t) => s.blocks.push({ h3: t }), L = (s, l) => l.length && s.blocks.push({ lista: l });
  const ads = Calc.aditivosDe(p.id), coord = Calc.coordenadores(p.id);
  const cr = Calc.cronograma(p), orc = Calc.orcamento(p), despP = D.despesas.filter(d => d.projeto_id === p.id && noPer(d.data));
  // Identificação
  const id = nova('Identificação do projeto');
  id.blocks.push({ kv: [['Projeto', `${p.sigla}${p.nome ? ' — ' + p.nome : ''}`], ['Tipo', lbl(TIPOS_PROJ, p.tipo || 'edital')], ...(p.programa || p.chamada ? [['Programa / chamada', [p.programa, p.chamada].filter(Boolean).join(' · ')]] : []),
    ...(p.linha_tematica ? [['Linha temática', p.linha_tematica]] : []), ['Financiador', p.financiador || '—'], ['Fundação de apoio', p.fundacao_apoio || '—'], ...(p.numero_contrato ? [['Contrato / convênio', p.numero_contrato]] : []),
    ['Vigência', `${fmtD(p.inicio)} a ${fmtD(p.fim)}${ads.some(a => a.novo_fim) ? ` (original até ${fmtD(Calc.vigenciaOriginal(p))}; ${ads.length} termo(s) aditivo(s))` : ''}`],
    ...(fin ? [['Valor do projeto', fmtBRL2(p.valor_total) + (ads.some(a => a.novo_valor != null) ? ` (original ${fmtBRL2(Calc.valorOriginal(p))})` : '')]] : []),
    ['Coordenação', coord.map(c => c.nome).join(', ') || '—'], ['Período deste relatório', `${fmtD(de)} a ${fmtD(ate)}`]] });
  // 1. Resumo
  if (sec.resumo) {
    const s = nova('Resumo do período');
    if (o.txtResumo) P(s, o.txtResumo);
    const b = [];
    if (cr.tot.folhas) b.push(`Avanço físico acumulado: ${cr.tot.pct}% (previsto para ${fmtD(ate)}: ${Calc.cronograma(p, ate).tot.prev}%). ${cr.rows.filter(r => r.folha && noPer(r.c.data_conclusao)).length} atividade(s) concluída(s) no período.`);
    const entP = D.entregas.filter(e => e.projeto_id === p.id && noPer(e.data_entrega)); if (entP.length) b.push(`${entP.length} entrega(s) realizada(s) no período: ${entP.map(e => e.titulo).join('; ')}.`);
    if (fin && orc.tot.aprovado) b.push(`Execução financeira: ${fmtBRL2(despP.reduce((s, d) => s + num(d.valor), 0))} no período; acumulado ${fmtBRL2(orc.tot.executado)} (${pct(orc.tot.executado, orc.tot.aprovado)} do aprovado).`);
    const eq = Calc.equipePlano(p).tot; if (eq.posicoes) b.push(`Equipe do plano: ${eq.ocupadas} de ${eq.posicoes} posições ocupadas${eq.vagas ? `, ${eq.vagas} vaga(s) aberta(s)` : ''}.`);
    L(s, b);
  }
  // 2. Execução física
  if (sec.fisico && cr.rows.length) {
    const s = nova('Execução física');
    const crA = Calc.cronograma(p, ate);
    T(s, ['Código', 'Meta / etapa', 'Período', 'Realizado', 'Previsto até ' + fmtD(ate).slice(0, 5) + fmtD(ate).slice(5), 'Situação'],
      crA.rows.filter(r => r.c.codigo.split('.').length <= 2).map(r => [r.c.codigo, r.c.titulo, r.ini && r.fim ? `${fmtMes(Calc.mesData(p, r.ini))} – ${fmtMes(Calc.mesDataFim(p, r.fim))}` : '—', (r.pct ?? 0) + '%', (r.prev ?? 0) + '%', r.folha ? lbl(Object.entries(ST_CRONO).map(([k, v]) => [k, v[0]]), r.c.status) : r.nAtras ? `${r.nAtras} atividade(s) atrasada(s)` : r.pct >= 100 ? 'Concluída' : r.pct > 0 ? 'Em andamento' : 'Planejada']));
    const conc = cr.rows.filter(r => r.folha && noPer(r.c.data_conclusao));
    H3(s, `Atividades concluídas no período (${conc.length})`);
    T(s, ['Código', 'Atividade', 'Concluída em', 'Evidência'], conc.map(r => [r.c.codigo, r.c.titulo, fmtD(r.c.data_conclusao), r.c.evidencia || '']));
    const and = crA.rows.filter(r => r.folha && r.c.status === 'em_andamento');
    if (and.length) { H3(s, `Atividades em andamento (${and.length})`); T(s, ['Código', 'Atividade', 'Término previsto', 'Realizado', 'Responsável'], and.map(r => [r.c.codigo, r.c.titulo, r.fim ? fmtMes(Calc.mesDataFim(p, r.fim)) : '—', r.pct + '%', r.c.responsavel_id ? nomePessoa(r.c.responsavel_id) : r.c.responsavel_texto || ''])); }
    const atr = crA.rows.filter(r => r.folha && r.atras);
    if (atr.length) { H3(s, `Atividades em atraso (${atr.length})`); T(s, ['Código', 'Atividade', 'Término previsto', 'Realizado', 'Justificativa / observação'], atr.map(r => [r.c.codigo, r.c.titulo, r.fim ? fmtMes(Calc.mesDataFim(p, r.fim)) : '—', r.pct + '%', r.c.obs || ''])); }
  }
  // 3. Entregas
  if (sec.entregas) {
    const s = nova('Entregas e relatórios'), ents = D.entregas.filter(e => e.projeto_id === p.id).sort(byName('prazo'));
    T(s, ['Entrega', 'Tipo', 'Prazo', 'Situação', 'Entregue em'], ents.filter(e => noPer(e.prazo) || noPer(e.data_entrega) || (Calc.entregaAberta(e) && e.prazo < de)).map(e => [e.titulo, lbl(TIPOS_ENTREGA, e.tipo), fmtD(e.prazo), ST_ENTREGA[e.status][0] + (Calc.entregaAtrasada(e) ? ' (atrasada)' : ''), fmtD(e.data_entrega) || '']));
    const prox = ents.filter(e => Calc.entregaAberta(e) && e.prazo > ate).slice(0, 5); if (prox.length) { H3(s, 'Próximas entregas'); T(s, ['Entrega', 'Prazo', 'Responsável'], prox.map(e => [e.titulo, fmtD(e.prazo), e.responsavel_id ? nomePessoa(e.responsavel_id) : ''])); }
  }
  // 4. Equipe
  if (sec.equipe) {
    const s = nova('Equipe'), EP = Calc.equipePlano(p);
    if (EP.rows.length) T(s, ['Posição no plano', 'Função', 'Ocupante', 'Desde', 'Situação'], EP.rows.filter(r => r.e.status !== 'cancelada').map(r => [r.e.nome_plano, r.e.funcao || lbl(CAT_PLANO, r.e.categoria), r.pessoa ? r.pessoa.nome : '—', fmtD(r.e.desde) || '', ST_VAGA[r.e.status][0]]));
    else T(s, ['Pessoa', 'Papel', 'Situação'], D.alocacoes.filter(a => a.projeto_id === p.id).map(a => [nomePessoa(a.pessoa_id), a.papel || NIVEIS[a.nivel], lbl(ST_ALOC, a.status)]));
    const ent = EP.rows.filter(r => noPer(r.e.desde)).map(r => `Entrada: ${r.pessoa ? r.pessoa.nome : '—'} — ${r.e.nome_plano} (${fmtD(r.e.desde)})`);
    const sai = D.pessoas.filter(pe => noPer(pe.saida) && D.alocacoes.some(a => a.pessoa_id === pe.id && a.projeto_id === p.id)).map(pe => `Saída: ${pe.nome} (${fmtD(pe.saida)})`);
    if (ent.length || sai.length) { H3(s, 'Movimentações no período'); L(s, [...ent, ...sai]); }
    if (fin) { const vs = D.vinculos_financeiros.filter(v => v.projeto_id === p.id && v.inicio <= ate && v.fim >= de).sort(byName('inicio'));
      if (vs.length) { H3(s, 'Bolsas e pagamentos de pessoal no período'); T(s, ['Bolsista', 'Modalidade', 'R$/mês', 'Vigência da bolsa', 'Meses no período', 'Situação'], vs.map(v => [nomePessoa(v.pessoa_id), v.modalidade || lbl(TIPOS_VINC, v.tipo), fmtBRL2(v.valor_mensal), `${fmtD(v.inicio)} a ${fmtD(v.fim)}`, String(Calc.mesesPeriodo(v.inicio > de ? v.inicio : de, v.fim < ate ? v.fim : ate)), ST_VINC[v.status][0]])); } }
  }
  // 5. Execução financeira
  if (sec.financeiro && fin && orc.rows.length) {
    const s = nova('Execução financeira por rubrica');
    const exP = cod => { const f = Calc.folhas(p).map(r => r.codigo).filter(c => c === cod || c.startsWith(cod + '.')); return despP.filter(d => f.includes(d.rubrica)).reduce((a, d) => a + num(d.valor), 0); };
    const exAte = cod => { const f = Calc.folhas(p).map(r => r.codigo).filter(c => c === cod || c.startsWith(cod + '.')); return D.despesas.filter(d => d.projeto_id === p.id && d.data <= ate && f.includes(d.rubrica)).reduce((a, d) => a + num(d.valor), 0); };
    const linhas = orc.rows.filter(x => x.aprovado || x.executado).map(x => { const ac = exAte(x.r.codigo); return [x.r.codigo, x.r.nome, fmtBRL2(x.aprovado), fmtBRL2(exP(x.r.codigo)), fmtBRL2(ac), fmtBRL2(x.aprovado - ac), pct(ac, x.aprovado)]; });
    const acT = D.despesas.filter(d => d.projeto_id === p.id && d.data <= ate).reduce((a, d) => a + num(d.valor), 0);
    linhas.push(['', 'Total', fmtBRL2(orc.tot.aprovado), fmtBRL2(despP.reduce((a, d) => a + num(d.valor), 0)), fmtBRL2(acT), fmtBRL2(orc.tot.aprovado - acT), pct(acT, orc.tot.aprovado)]);
    T(s, ['Código', 'Rubrica', 'Aprovado', 'Executado no período', 'Executado acumulado', 'Saldo', '% execução'], linhas, { total: true });
    if (sec.plano) { const its = D.plano_itens.filter(i => i.projeto_id === p.id && i.status !== 'cancelado');
      if (its.length) { const ex = {}; D.despesas.filter(d => d.item_id && d.data <= ate).forEach(d => ex[d.item_id] = (ex[d.item_id] || 0) + num(d.valor));
        const mov = its.filter(i => ex[i.id] || i.status !== 'previsto'), resto = its.filter(i => !mov.includes(i));
        H3(s, 'Plano de aplicação — itens com execução ou em aquisição'); T(s, ['Rubrica', 'Nº', 'Item', 'Previsto', 'Executado', 'Situação'], mov.sort((a, b) => Calc.codCmp(a.rubrica, b.rubrica) || a.numero - b.numero).map(i => [i.rubrica, String(i.numero || ''), i.descricao, fmtBRL2(i.valor_previsto), fmtBRL2(ex[i.id] || 0), ST_ITEM[i.status][0]]));
        if (resto.length) P(s, `Demais ${resto.length} item(ns) do plano ainda previstos, sem execução: ${fmtBRL2(resto.reduce((a, i) => a + num(i.valor_previsto), 0))}.`); } }
    if (sec.desembolso && D.desembolsos.some(d => d.projeto_id === p.id)) { const R2 = Calc.desembolso(p);
      H3(s, 'Desembolso'); T(s, ['Parcela', 'Prevista', 'Valor previsto', 'Recebida em', 'Valor recebido', 'Situação'], R2.parcelas.map(x => [x.d.descricao || 'Parcela ' + x.d.numero, fmtD(x.d.data_prevista) || '', fmtBRL2(x.d.valor_previsto), fmtD(x.d.data_recebida) || '', x.d.status === 'recebida' ? fmtBRL2(x.d.valor_recebido) : '', ST_DESEMB[x.st][0]]));
      P(s, `Recebido ${fmtBRL2(R2.tot.recebido)} · executado ${fmtBRL2(R2.tot.executado)} · saldo em caixa ${fmtBRL2(R2.tot.caixa)} · a receber ${fmtBRL2(R2.tot.aReceber)}.`); }
    if (sec.despesas) { H3(s, `Despesas do período (${despP.length})`); T(s, ['Data', 'Rubrica', 'Descrição', 'Favorecido', 'Documento', 'Valor'], despP.sort(byName('data')).map(d => [fmtD(d.data), d.rubrica, d.descricao, d.favorecido || (d.pessoa_id ? nomePessoa(d.pessoa_id) : ''), d.documento || '', fmtBRL2(d.valor)]).concat(despP.length ? [['', '', 'Total', '', '', fmtBRL2(despP.reduce((a, d) => a + num(d.valor), 0))]] : []), { total: despP.length > 0 }); }
  }
  // 6. Pendências e documentos
  if (sec.pendencias) {
    const s = nova('Pendências e documentos'), pend = D.pendencias.filter(x => x.projeto_id === p.id);
    const ab = pend.filter(Calc.pendenciaAberta), res = pend.filter(x => x.status === 'resolvida' && noPer(x.resolvida_em));
    H3(s, `Pendências em aberto (${ab.length})`); T(s, ['Pendência', 'Origem', 'Responsável', 'Prazo', 'Situação'], ab.map(x => [x.titulo, x.origem || '', x.responsavel_id ? nomePessoa(x.responsavel_id) : '', fmtD(x.prazo) || '', ST_PEND[x.status][0]]));
    if (res.length) { H3(s, `Pendências resolvidas no período (${res.length})`); T(s, ['Pendência', 'Resolvida em', 'Como'], res.map(x => [x.titulo, fmtD(x.resolvida_em), x.resolucao || ''])); }
    const docs = D.documentos.filter(d => d.projeto_id === p.id && Perm.veDoc(d) && noPer(d.data)); if (docs.length) { H3(s, 'Documentos do período'); T(s, ['Tipo', 'Documento', 'Nº', 'Data'], docs.map(d => [lbl(TIPOS_DOC, d.tipo), d.titulo, d.numero || '', fmtD(d.data)])); }
    if (ads.length) { H3(s, 'Termos aditivos'); T(s, ['Termo', 'Tipo', 'Assinatura', 'Novo término', 'Novo valor'], ads.map(a => [a.numero || 'Termo aditivo', lbl(TIPOS_ADITIVO, a.tipo), fmtD(a.data_assinatura) || '', fmtD(a.novo_fim) || '', fin && a.novo_valor != null ? fmtBRL2(a.novo_valor) : ''])); }
  }
  if (o.txtDificuldades || o.txtProximos) { const s = nova('Considerações da coordenação'); if (o.txtDificuldades) { H3(s, 'Dificuldades encontradas e soluções adotadas'); P(s, o.txtDificuldades); } if (o.txtProximos) { H3(s, 'Próximas etapas'); P(s, o.txtProximos); } }
  const c1 = coord[0];
  return { titulo: 'Relatório de acompanhamento físico-financeiro', subtitulo: `${p.sigla}${p.nome ? ' — ' + p.nome : ''}`, escopo: `Período de ${fmtD(de)} a ${fmtD(ate)}`, data: fmtD(hoje()), S, rodape: `${p.sigla} · Relatório ${fmtD(de)} a ${fmtD(ate)}`,
    assinatura: o.assinar ? { local: `Santa Maria, ${dataExtenso(hoje())}.`, nome: c1 ? c1.nome : '', cargo: `Coordenador(a) do projeto ${p.sigla}` } : null };
}

/* ── tela ── */
const SECOES_PROJ = [['resumo', 'Resumo do período'], ['fisico', 'Execução física (cronograma)'], ['entregas', 'Entregas e relatórios'], ['equipe', 'Equipe e bolsas'], ['financeiro', 'Execução financeira por rubrica', true], ['plano', 'Plano de aplicação (itens)', true], ['desembolso', 'Desembolso', true], ['despesas', 'Lista de despesas do período', true], ['pendencias', 'Pendências, documentos e aditivos']];
function relProjetoForm() {
  const projs = D.projetos.filter(p => p.situacao !== 'arquivado').sort(byName('sigla'));
  if (!projs.length) return '<div class="empty">Nenhum projeto.</div>';
  const c = UI.relP = UI.relP || { secoes: Object.fromEntries(SECOES_PROJ.map(([k]) => [k, k !== 'despesas'])), assinar: true, txt: {} };
  if (!c.pid || !byId('projetos', c.pid)) c.pid = (projs.find(p => Calc.vigente(p)) || projs[0]).id;
  const p = byId('projetos', c.pid), fin = Perm.veFin(p.id);
  if (!c.de) { c.de = [p.inicio, addDays(hoje(), -182)].sort().pop(); c.ate = hoje(); }
  const t = c.txt[p.id] = c.txt[p.id] || {};
  return `<div class="card" style="max-width:860px">
    <div class="bold mb">Relatório de acompanhamento físico-financeiro do projeto</div>
    <div class="fgrid"><div><label class="fl">Projeto</label><select id="rp_proj">${projs.map(x => `<option value="${x.id}"${x.id === p.id ? ' selected' : ''}>${esc(x.sigla)}${x.situacao !== 'vigente' ? ' (' + lbl(SITUACAO_PROJ, x.situacao) + ')' : ''}</option>`).join('')}</select></div>
      <div class="row" style="align-items:end;gap:6px"><div><label class="fl">De</label><input type="date" id="rp_de" value="${c.de}"></div><div><label class="fl">Até</label><input type="date" id="rp_ate" value="${c.ate}"></div></div>
      <div class="full row small" style="gap:6px"><span class="muted">Período rápido:</span>${[['sem', 'Últimos 6 meses'], ['ano', 'Últimos 12 meses'], ['ano_civil', 'Ano anterior'], ['tudo', 'Desde o início']].map(([k, l]) => `<button class="btn-s" data-a="rpPeriodo" data-v="${k}">${l}</button>`).join('')}</div></div>
    <label class="fl mt">Seções</label><div class="checks">${SECOES_PROJ.map(([k, l, f]) => `<label style="${f && !fin ? 'opacity:.5' : ''}"><input type="checkbox" data-rps="${k}" ${c.secoes[k] ? 'checked' : ''} ${f && !fin ? 'disabled' : ''}> ${l}${f && !fin ? ' (sem acesso ao financeiro)' : ''}</label>`).join('')}</div>
    <label class="fl mt">Resumo das atividades do período <span class="muted">(texto da coordenação, opcional)</span></label><textarea id="rp_t1" rows="4" placeholder="Principais resultados e atividades realizadas no período…">${esc(t.resumo || '')}</textarea>
    <label class="fl mt">Dificuldades encontradas e soluções adotadas</label><textarea id="rp_t2" rows="3">${esc(t.dif || '')}</textarea>
    <label class="fl mt">Próximas etapas</label><textarea id="rp_t3" rows="3">${esc(t.prox || '')}</textarea>
    <label class="row small mt"><input type="checkbox" id="rp_ass" ${c.assinar ? 'checked' : ''}> incluir local, data e espaço para assinatura da coordenação</label>
    <div class="mactions"><button class="btn-p" data-a="relProjGerar">Gerar relatório →</button></div>
    <div class="small muted">Abre uma prévia com opções de imprimir / salvar em PDF, Word (.docx) e Markdown. Os textos ficam guardados neste navegador enquanto você prepara o relatório. Valores financeiros só aparecem se você tiver acesso ao financeiro do projeto.</div></div>`;
}
const lerFormRelP = () => { const c = UI.relP, g = id => document.getElementById(id); if (!g('rp_proj')) return c;
  const t = c.txt[c.pid] = c.txt[c.pid] || {}; t.resumo = g('rp_t1').value; t.dif = g('rp_t2').value; t.prox = g('rp_t3').value;
  c.de = g('rp_de').value; c.ate = g('rp_ate').value; c.assinar = g('rp_ass').checked;
  document.querySelectorAll('[data-rps]').forEach(x => c.secoes[x.dataset.rps] = x.checked);
  try { localStorage.setItem(LS_PREFIX + '_relTxt', JSON.stringify(c.txt)); } catch { }
  return c; };
document.addEventListener('change', e => { if (e.target && e.target.id === 'rp_proj') { lerFormRelP(); UI.relP.pid = e.target.value; UI.relP.de = null; render(); } });
A.rpPeriodo = d => { const c = lerFormRelP(), p = byId('projetos', c.pid), t = hoje(), y = +t.slice(0, 4);
  if (d.v === 'sem') { c.de = addDays(t, -182); c.ate = t; } else if (d.v === 'ano') { c.de = addDays(t, -365); c.ate = t; } else if (d.v === 'ano_civil') { c.de = `${y - 1}-01-01`; c.ate = `${y - 1}-12-31`; } else { c.de = p.inicio; c.ate = t; }
  if (c.de < p.inicio) c.de = p.inicio; render(); };
A.relProjGerar = () => { const c = lerFormRelP(), p = byId('projetos', c.pid);
  if (!isDate(c.de) || !isDate(c.ate) || c.ate < c.de) { flash('Informe um período válido', true); return; }
  if (!Object.values(c.secoes).some(Boolean)) { flash('Escolha ao menos uma seção', true); return; }
  const t = c.txt[p.id] || {};
  const R = montarRelProjeto(p, { de: c.de, ate: c.ate, secoes: c.secoes, assinar: c.assinar, txtResumo: (t.resumo || '').trim(), txtDificuldades: (t.dif || '').trim(), txtProximos: (t.prox || '').trim() });
  abrirPrevia(R, `relatorio-${rSlug(p.sigla)}-${c.de}-a-${c.ate}`); };
try { const x = JSON.parse(localStorage.getItem(LS_PREFIX + '_relTxt') || 'null'); if (x) UI.relP = { secoes: Object.fromEntries(SECOES_PROJ.map(([k]) => [k, k !== 'despesas'])), assinar: true, txt: x }; } catch { }
