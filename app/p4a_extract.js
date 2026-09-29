function normalizeText(s) {
  return (s||'')
    .replace(/\r/g,'\n')
    .replace(/[\t ]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}
function cleanExtracted(s) {
  return (s||'')
    .replace(/^[\s:;\-–—]+/,'')
    .replace(/[\s;]+$/,'')
    .replace(/^['"“”]+|['"“”]+$/g,'')
    .trim();
}
function parseMoney(txt) {
  const t = txt || '';
  const patterns = [
    /(?:valor\s+(?:total|global|do\s+contrato|estimado)|import[aâ]ncia|montante|or[cç]amento)[^\n\r]{0,80}?R\$\s*([0-9\.]+(?:,[0-9]{2})?)/i,
    /R\$\s*([0-9\.]+(?:,[0-9]{2})?)/i
  ];
  for(const re of patterns) {
    const m = t.match(re);
    if(m) return Number(m[1].replace(/\./g,'').replace(',','.')) || 0;
  }
  return 0;
}
function monthNum(m) {
  const mm = stripAccents((m||'').toLowerCase()).slice(0,3);
  return {jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12}[mm] || null;
}
function toYM(y,m) {
  if(!y||!m) return '';
  return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0');
}
function parseDateToYM(s) {
  if(!s) return '';
  let m;
  m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m) return toYM(Number(m[3].length===2?'20'+m[3]:m[3]), Number(m[2]));
  m = s.match(/(\d{4})[\/\-.](\d{1,2})/);
  if(m) return toYM(Number(m[1]), Number(m[2]));
  m = s.match(/(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})/i);
  if(m) return toYM(Number(m[2]), monthNum(m[1]));
  return '';
}
function addMonthsYM(ym, months) {
  if(!ym || !months) return '';
  const [y,m]=ym.split('-').map(Number);
  const d = new Date(y, m-1 + Number(months), 1);
  return toYM(d.getFullYear(), d.getMonth()+1);
}
function firstLabelValue(text, labels, maxLen=180) {
  const lines = normalizeText(text).split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const labs = labels.map(l=>stripAccents(l).toLowerCase());
  for(let i=0;i<lines.length;i++) {
    const raw = lines[i];
    const low = stripAccents(raw).toLowerCase();
    for(const lab of labs) {
      if(low.includes(lab)) {
        let v = raw.replace(new RegExp('^.*?'+lab.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:;\\-–—]?\\s*','i'), '');
        v = cleanExtracted(v);
        if(v && stripAccents(v).toLowerCase() !== lab && v.length <= maxLen) return v;
        if(lines[i+1] && lines[i+1].length <= maxLen) return cleanExtracted(lines[i+1]);
      }
    }
  }
  return '';
}
function guessTitle(text) {
  const byLabel = firstLabelValue(text, ['título do projeto','titulo do projeto','nome do projeto','objeto','projeto'], 220);
  if(byLabel && byLabel.length > 8) return byLabel;
  const lines = normalizeText(text).split(/\n+/).map(cleanExtracted).filter(x=>x.length>12 && x.length<180);
  const good = lines.find(l=>/desenvolvimento|avalia[cç][aã]o|valida[cç][aã]o|estudo|pesquisa|motor|sistema|projeto/i.test(l));
  return good || (lines[0] || '');
}
function guessName(fullName, text) {
  const explicit = firstLabelValue(text, ['sigla','acrônimo','acronimo'], 40);
  if(explicit) return explicit.replace(/[^A-Za-z0-9À-ÿ\- ]/g,'').trim().slice(0,32);
  const caps = (fullName.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]{2,}(?:[-\/][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]{2,})?\b/g)||[])
    .filter(x=>!['UFSM','CNPJ','CPF','CEP','R$'].includes(x));
  if(caps.length) return caps[0].slice(0,32);
  return fullName.split(/\s+/).filter(w=>w.length>3).slice(0,3).map(w=>w[0]).join('').toUpperCase() || 'NOVO';
}
function guessFunder(text) {
  const v = firstLabelValue(text, ['financiador','financiadora','contratante','concedente','patrocinador'], 180);
  if(v) return v;
  const known = ['Petrobras','FAURGS','FINEP','CNPq','CAPES','EMBRAPII','Volkswagen','VW','Silenkar','Raízen','FDMS','Aramco'];
  return known.filter(k=>new RegExp(k,'i').test(text)).slice(0,2).join(' / ');
}
function guessSupportFoundation(text) {
  const v = firstLabelValue(text, ['fundação de apoio','fundacao de apoio','interveniente financeira','fundação executora','fundacao executora'], 160);
  if(v) return v;
  const known = ['FDMS','FAURGS','FUNDEP','FATEC','FAPEU'];
  return known.find(k=>new RegExp(k,'i').test(text)) || '';
}
function guessLead(text) {
  const v = firstLabelValue(text, ['coordenador','coordenação','coordenacao','responsável técnico','responsavel tecnico','pesquisador responsável','pesquisador responsavel'], 160);
  if(v) return v;
  const m = text.match(/(?:Prof\.?\s*(?:Dr\.?|Dra\.?)?\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,4})\s*(?:,|\n)?\s*(?:coordenador|respons[aá]vel)/i);
  return m ? cleanExtracted(m[1]) : '';
}
function guessDates(text) {
  const vig = text.match(/vig[eê]ncia[^\n\r]{0,160}/i)?.[0] || '';
  const dates = (vig || text).match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}|(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?\d{4})/ig) || [];
  let start = '', end = '';
  if(dates.length>=1) start = parseDateToYM(dates[0]);
  if(dates.length>=2) end = parseDateToYM(dates[1]);
  if(!start) start = parseDateToYM(firstLabelValue(text, ['data de início','data de inicio','início','inicio'], 80));
  if(!end)   end   = parseDateToYM(firstLabelValue(text, ['data de término','data de termino','fim','encerramento'], 80));
  const dur = text.match(/(?:prazo|vig[eê]ncia|dura[cç][aã]o)[^\n\r]{0,80}?(\d{1,3})\s*mes(?:es)?/i);
  if(start && !end && dur) end = addMonthsYM(start, Number(dur[1]));
  return {start, end};
}
function inferStatus(text) {
  const low = stripAccents(text).toLowerCase();
  if(/atras|penden|critico|nao recebido|sem ensaio|sem infraestrutura|risco/.test(low)) return 'yellow';
  if(/finaliza|encerr/.test(low)) return 'yellow';
  if(/em execucao|em andamento|vigente|assinado|formalizado/.test(low)) return 'green';
  return 'gray';
}
function extractProjectFromText(raw) {
  const text = normalizeText(raw);
  const fullName = guessTitle(text);
  const dates = guessDates(text);
  const funder = guessFunder(text);
  const supportFoundation = guessSupportFoundation(text);
  const lead = guessLead(text);
  const value = parseMoney(text);
  const phase = firstLabelValue(text, ['fase atual','fase','etapa atual','situação','situacao'], 120) || (inferStatus(text)==='green'?'Em execução':'A revisar');
  const notesParts = [];
  if(!value) notesParts.push('Valor não identificado automaticamente.');
  if(!dates.start || !dates.end) notesParts.push('Vigência não identificada completamente.');
  if(!funder) notesParts.push('Financiador não identificado automaticamente.');
  if(!supportFoundation) notesParts.push('Fundação de apoio não identificada automaticamente.');
  const pend = (text.match(/(?:pend[eê]ncias?|atraso|risco|aguardando|n[aã]o recebido|em discuss[aã]o)[^\.\n]{0,160}/ig)||[]).slice(0,3);
  if(pend.length) notesParts.push(pend.map(cleanExtracted).join(' | '));
  return {
    id: newId(),
    name: guessName(fullName, text),
    fullName: fullName || '',
    funder: funder || '',
    supportFoundation: supportFoundation || '',
    value: value || 0,
    start: dates.start || '2026-01',
    end: dates.end || '2027-12',
    status: inferStatus(text),
    lead: lead || '',
    phase,
    notes: notesParts.join(' '),
    ph: false
  };
}

function guessSubmissionDeadline(text){
  const direct = firstLabelValue(text, ['prazo de submissão','data limite','limite para submissão','encerramento das submissões','submissão até','submissao ate'], 80);
  const d = parseDateToYM(direct);
  if(d) return d;
  const line = (text.match(/(?:submiss[aã]o|proposta|edital|chamada|data limite)[^\n\r]{0,140}/i)||[])[0] || '';
  const m = line.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2})/);
  return m ? parseDateToYM(m[1]) : '';
}
function extractSubmissionFromText(raw){
  const text = normalizeText(raw);
  const p = extractProjectFromText(text);
  const edital = firstLabelValue(text, ['edital','chamada','chamada pública','chamada publica','programa','linha'], 160) || p.fullName || p.name;
  const objective = firstLabelValue(text, ['objetivo','objeto','resumo','descrição','descricao'], 260);
  const deadline = guessSubmissionDeadline(text);
  const req = (text.match(/(?:anexo|documentos?|contrapartida|elegibilidade|prazo|limite|or[cç]amento|bolsas?)[^\.\n]{0,180}/ig)||[])
    .slice(0,5).map(cleanExtracted).join(' | ');
  return {
    name: p.name || guessName(edital||'EDITAL', text),
    title: edital || '',
    funder: p.funder || '',
    value: p.value || 0,
    deadline,
    start: p.start || '',
    end: p.end || '',
    lead: p.lead || '',
    objective: objective || '',
    notes: [p.notes, req].filter(Boolean).join(' '),
    sourceFile: UI.subArquivo || ''
  };
}

function submissionMatrixSuggestions(sub){
  if(!sub) return {filters:null,scores:null,efforts:null};
  const text = stripAccents(normalizeText([
    sub.name, sub.title, sub.funder, sub.objective, sub.notes, sub.raw
  ].filter(Boolean).join(' '))).toLowerCase();
  const has = re => re.test(text);
  const filters = {};
  DM_FILTERS.forEach(f=>filters[f.id]='pass');
  if(has(/fora do escopo|nao aderente|sem alinhamento/)) filters.f_align='fail';
  if(!sub.lead && has(/responsavel nao definido|sem coordenador|coordenador indefinido/)) filters.f_resp='fail';
  if(has(/infraestrutura indisponivel|sem infraestrutura|banco indisponivel/)) filters.f_infra='fail';
  if(has(/prazo incompativel|inexequivel|nao exequivel/)) filters.f_prazo='fail';
  if(has(/sem recurso minimo|orcamento insuficiente|nao cobre custos/)) filters.f_recurso='fail';
  if(has(/risco reputacional (alto|inaceitavel)|nao aceitavel/)) filters.f_risco='fail';

  const scores = {
    c_lin: has(/motor|combust|etanol|biodiesel|hidrogen|h2|emissoes|dinamometr|energia|termic/) ? 5 : 3,
    c_part: has(/finep|cnpq|petrobras|brics|fapesp|capes|embrapii|internacional|multilateral/) ? 4 : 3,
    c_sin: has(/etanol|flex|motor|combust|h2|hidrogen|biodiesel|projetos existentes|sinergia/) ? 4 : 3,
    c_inov: has(/inov|desenvolv|pesquisa|experimental|demonstrador|tecnolog/) ? 4 : 3,
    c_form: has(/bolsa|bolsista|alun|estudante|formacao|capacita|recursos humanos/) ? 4 : 3,
    c_pub: has(/publica|artigo|propriedade intelectual|patente|demonstracao|relatorio tecnico/) ? 4 : 3,
    c_inst: has(/ufsm|gpmot|internacional|brics|cooperacao|rede|parceria/) ? 4 : 3,
    c_vol: (sub.value||0)>=2000000 ? 5 : ((sub.value||0)>=1000000 ? 4 : ((sub.value||0)>=300000 ? 3 : 2)),
    c_eq: has(/bolsa|equipe dedicada|equipe tecnica|pesquisador|alun/) ? 4 : 3,
    c_man: has(/insumo|manutencao|equipamento|infraestrutura|ensaio|banco|orcamento/) ? 4 : 3,
    c_cp: has(/contrapartida.*(alta|significativa|obrigatoria)|recurso proprio/) ? 2 : (has(/contrapartida.*(minima|baixa)|cobre custos/) ? 4 : 3),
    c_deq: has(/equipe dedicada|equipe disponivel|bolsa/) ? 4 : (has(/dependencia de equipe|gargalo|pessoas-chave/) ? 2 : 3),
    c_dinf: has(/infraestrutura disponivel|banco disponivel|laboratorio disponivel/) ? 4 : (has(/sem infraestrutura|infraestrutura indisponivel/) ? 1 : 3),
    c_rtec: has(/risco tecnico alto|alta incerteza tecnica/) ? 2 : (has(/risco tecnico baixo|baixo risco tecnico/) ? 4 : 3),
    c_radm: has(/internacional|multilateral|dados entre paises|dependencia.*paises|compras criticas|importacao/) ? 2 : 3,
    c_rrep: has(/risco reputacional aceitavel|baixo risco reputacional/) ? 4 : (has(/risco reputacional/) ? 3 : 4)
  };
  const efforts = {
    e_coord: has(/internacional|multilateral|coordenacao internacional|pessoas-chave|gargalo/) ? 4 : 3,
    e_team: has(/equipe dedicada|bolsas|bolsistas|pesquisadores|engenheiros/) ? 3 : 2,
    e_infra: has(/banco|dinamometr|ensaio|instrumentacao|emissoes|cfd|gt-power|scanner/) ? 4 : 2,
    e_adm: has(/internacional|multilateral|dados entre paises|contrapartida|compras|importacao|prestacao de contas/) ? 4 : 3
  };
  return {filters,scores,efforts};
}
