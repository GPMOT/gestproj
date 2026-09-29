
/* ════════════════════════════════════════════════════════════════════
   INTERFACE — base
   ════════════════════════════════════════════════════════════════════ */
const UI = { tab: 'painel', projeto: null, pessoa: null, sub: {}, f: {} };
const A = {};          // ações disparadas por data-a="nome"
let flashT = null;
function flash(msg, err) {
  const f = document.getElementById('flash'); f.textContent = msg; f.className = err ? 'err' : ''; f.style.display = 'block';
  clearTimeout(flashT); flashT = setTimeout(() => f.style.display = 'none', err ? 5200 : 2600);
}
async function run(fn) { try { await fn(); } catch (e) { console.error(e); flash(traduzErro(e), true); render(); } }

function render() {
  const app = document.getElementById('app');
  const ae = document.activeElement, focusId = ae && ae.id, sel = ae && ae.selectionStart;
  const y = window.scrollY;
  let body = '';
  try { body = (VIEWS[UI.tab] || VIEWS.painel)(); }
  catch (e) { console.error(e); body = `<div class="merr">Erro ao montar a tela: ${esc(e.message)}</div>`; }
  document.body.classList.remove('no-side');
  const side = document.getElementById('side'), nav = document.getElementById('navScroll'), sy = nav ? nav.scrollTop : 0;
  side.innerHTML = sidebar();
  document.getElementById('navScroll').scrollTop = sy;
  app.innerHTML = header() + body;
  window.scrollTo(0, y);
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (sel != null) el.setSelectionRange(sel, sel); } catch { } } }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.closest('#modal-root') && !el.dataset.a.startsWith('m_') && !el.closest('.mbody-actions')) { /* ações dentro de modais usam prefixo m_ */ }
  const f = A[el.dataset.a]; if (!f) return;
  e.preventDefault(); e.stopPropagation();
  run(() => f(el.dataset, el));
});
/* filtros: data-f="chave" em inputs/selects */
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.f || el.closest('#modal-root')) return;
  UI.f[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; render();
});

/* ── menu lateral ───────────────────────────────────────────────── */
const ICON = {
  painel: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>',
  projetos: '<path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9a1.5 1.5 0 0 0-1.5-1.5H12l-2-2.5H4.5A1.5 1.5 0 0 0 3 6.5z"/>',
  cronograma: '<path d="M3 5h18M3 12h18M3 19h18" opacity=".35"/><rect x="5" y="3.5" width="9" height="3" rx="1"/><rect x="9" y="10.5" width="10" height="3" rx="1"/><rect x="4" y="17.5" width="7" height="3" rx="1"/>',
  entregas: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8.5 14.5l2.2 2.2 4.8-4.7"/>',
  prospeccao: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.2 4.2 1.8 5 4.9"/>',
  tarefas: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 12.5l3 3 5.5-6.5"/>',
  gerencias: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  financeiro: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  infra: '<path d="M3 21V9l9-5 9 5v12"/><path d="M3 21h18"/><rect x="8" y="13" width="3" height="4"/><rect x="13" y="13" width="3" height="4"/>',
  relatorios: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15.5h6M9 19h4"/>',
  config: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
};
const ic = k => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
const TITULOS = { painel: 'Painel', projetos: 'Projetos', entregas: 'Entregas e prazos', cronograma: 'Cronograma', prospeccao: 'Prospecção', equipe: 'Equipe', tarefas: 'Tarefas', gerencias: 'Gerências', financeiro: 'Financeiro', infra: 'Infraestrutura', relatorios: 'Relatórios', config: 'Configurações' };
function tabVisivel(t) {
  if (t === 'financeiro') return D.projetos.some(p => Perm.veFin(p.id));
  return true;
}
function navItens() {
  const vig = D.projetos.filter(p => p.situacao === 'vigente').sort(byName('sigla'));
  const atrasadas = D.tarefas.filter(Calc.atrasada).length;
  const minhasAtr = ME.pessoa_id ? D.tarefas.filter(t => Calc.atrasada(t) && D.tarefa_responsaveis.some(r => r.tarefa_id === t.id && r.pessoa_id === ME.pessoa_id)).length : 0;
  const pend = D.infra_reservas.filter(r => r.status === 'solicitada' && Perm.gereInfra(r.item_id)).length;
  const alInfra = Calc.alertasInfra().filter(a => a.grave).length;
  const vencidos = D.projetos.filter(Calc.vencido).length;
  return [
    { grupo: '', itens: [{ t: 'painel', l: 'Painel' }] },
    { grupo: 'Portfólio', itens: [
      { t: 'projetos', l: 'Projetos', n: vencidos, nc: 'warn', nt: 'projetos com vigência vencida', subs: TIPOS_PROJ.flatMap(([tp, tl]) => { const ps = vig.filter(p => (p.tipo || 'edital') === tp); return ps.length ? [{ hdr: tp === 'edital' ? 'Editais' : 'Prestação de serviço' }, ...ps.map(p => ({ l: p.sigla, a: 'projAbrir', id: p.id, on: UI.tab === 'projetos' && UI.projeto === p.id, dot: (STATUS_PROJ[p.status] || STATUS_PROJ.pendente)[3] }))] : []; }) },
      { t: 'entregas', l: 'Entregas e prazos', n: D.entregas.filter(Calc.entregaAtrasada).length || D.entregas.filter(e => Calc.entregaAberta(e) && e.prazo <= addDays(hoje(), 15)).length,
        nc: D.entregas.some(Calc.entregaAtrasada) ? 'bad' : 'warn', nt: D.entregas.some(Calc.entregaAtrasada) ? 'entregas atrasadas' : 'entregas nos próximos 15 dias' },
      { t: 'cronograma', l: 'Cronograma' },
      { t: 'prospeccao', l: 'Prospecção', n: D.prospeccoes.filter(p => p.situacao === 'avaliacao').length, nc: 'info', nt: 'em avaliação' }] },
    { grupo: 'Pessoas e gestão', itens: [
      { t: 'equipe', l: 'Equipe', subs: SUBS_EQUIPE().map(([v, l]) => ({ l, g: 'equipe', v, on: UI.tab === 'equipe' && !UI.pessoa && (UI.sub.equipe || 'matriz') === v })) },
      { t: 'tarefas', l: 'Tarefas', n: minhasAtr || atrasadas, nc: 'bad', nt: minhasAtr ? 'suas tarefas atrasadas' : 'tarefas atrasadas',
        subs: [...(ME.pessoa_id ? [['minhas', 'Minhas tarefas']] : []), ['atrasadas', 'Atrasadas'], ['', 'Todas']].map(([v, l]) => ({ l, f: 'tfEscopo', fv: v, on: UI.tab === 'tarefas' && (UI.f.tfEscopo ?? (ME.pessoa_id ? 'minhas' : '')) === v })) },
      { t: 'gerencias', l: 'Gerências', subs: D.gerencias.filter(g => g.ativa).sort(by('ordem')).map(g => ({ l: g.nome.replace(/^Gerência (de |d[ao] )?/, ''), a: 'gerAbrir', id: g.id, on: UI.tab === 'gerencias' && UI.gerencia === g.id, n: D.tarefas.filter(t => t.gerencia_id === g.id && Calc.atrasada(t)).length })) }] },
    { grupo: 'Recursos', itens: [
      { t: 'financeiro', l: 'Financeiro', subs: SUBS_FIN.map(([v, l]) => ({ l, g: 'fin', v, on: UI.tab === 'financeiro' && (UI.sub.fin || 'resumo') === v })) },
      { t: 'infra', l: 'Infraestrutura', n: pend + alInfra, nc: alInfra ? 'bad' : 'warn', nt: `${pend} solicitação(ões) a confirmar · ${alInfra} alerta(s) grave(s)`,
        subs: [['itens', 'Itens'], ['agenda', 'Agenda de uso', pend], ['manut', 'Manutenções'], ['hab', 'Habilitações'], ['uso', 'Horas por projeto']].map(([v, l, n]) => ({ l, g: 'infra', v, n, on: UI.tab === 'infra' && (UI.sub.infra || 'itens') === v })) }] },
    { grupo: 'Sistema', itens: [{ t: 'relatorios', l: 'Relatórios' }, { t: 'config', l: 'Configurações' }] },
  ].map(g => ({ ...g, itens: g.itens.filter(i => tabVisivel(i.t)) })).filter(g => g.itens.length);
}
function lsGet(k, def) { try { const v = localStorage.getItem(LS_PREFIX + k); return v == null ? def : JSON.parse(v); } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch { } }
UI.navOpen = lsGet('_navopen', {});
function sidebar() {
  const nome = ME.pessoa_id ? nomePessoa(ME.pessoa_id) : (ME.email || 'Usuário local');
  const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const cnt = (n, c, t) => n ? `<span class="nv-n ${c || ''}" title="${esc(t || '')}">${n}</span>` : '';
  const grupos = navItens().map(g => `<div class="nv-g">${g.grupo ? `<div class="nv-gt">${g.grupo}</div>` : ''}
    ${g.itens.map(i => {
      const ativo = UI.tab === i.t, temSub = i.subs && i.subs.length;
      const aberto = temSub && (UI.navOpen[i.t] ?? ativo);
      return `<div class="nv-item${ativo ? ' on' : ''}">
        <button class="nv-a" data-a="nav" data-t="${i.t}" title="${esc(i.l)}">${ic(i.t)}<span class="nv-l">${esc(i.l)}</span>${cnt(i.n, i.nc, i.nt)}</button>
        ${temSub ? `<button class="nv-tg" data-a="navToggle" data-t="${i.t}" data-o="${aberto ? 1 : 0}" title="${aberto ? 'Recolher' : 'Expandir'}">${aberto ? '▾' : '▸'}</button>` : ''}</div>
        ${aberto ? `<div class="nv-subs">${i.subs.map(s => s.hdr ? `<div class="nv-sh">${esc(s.hdr)}</div>` : `<button class="nv-s${s.on ? ' on' : ''}" data-a="${s.a || 'nav'}" data-t="${i.t}"${s.id ? ` data-id="${s.id}"` : ''}${s.g ? ` data-g="${s.g}" data-v="${s.v}"` : ''}${s.f ? ` data-f2="${s.f}" data-fv="${s.fv}"` : ''}>${s.dot ? `<span class="nv-dot" style="background:${s.dot}"></span>` : ''}<span class="nv-l">${esc(s.l)}</span>${cnt(s.n, 'bad')}</button>`).join('')}</div>` : ''}`;
    }).join('')}</div>`).join('');
  return `<div class="nv-top"><div class="nv-brand"><span class="nv-logo">G</span><span class="nv-l"><b>GPMOT/UFSM</b><br><span>Gestão de Portfólio</span></span></div>
      <button class="nv-mini" data-a="navMini" title="${document.body.classList.contains('side-mini') ? 'Expandir menu' : 'Recolher menu'}">${document.body.classList.contains('side-mini') ? '»' : '«'}</button></div>
    <nav class="nv-scroll" id="navScroll">${grupos}</nav>
    <div class="nv-foot">
      <div class="nv-user" title="${esc(papelTexto())}"><span class="av">${esc(ini || '?')}</span><span class="nv-l"><b>${esc(nome)}</b><br><span>${esc(papelTexto())}</span></span></div>
      <div class="nv-l nv-mode ${ME.online ? 'online' : ''}">${ME.online ? '● Online' : '● Local (este navegador)'}</div>
      ${ME.online ? `<button class="nv-btn nv-l" data-a="sair">Sair</button>` : `<button class="nv-btn nv-l" data-a="nav" data-t="config">Trocar usuário</button>`}
    </div>`;
}
A.nav = d => {
  UI.tab = d.t; UI.projeto = null; UI.pessoa = null; UI.gerencia = null;
  if (d.g) UI.sub[d.g] = d.v;
  if (d.f2 !== undefined) UI.f[d.f2] = d.fv;
  document.body.classList.remove('nav-open'); window.scrollTo(0, 0); render();
};
A.tab = A.nav;
A.navToggle = d => { UI.navOpen[d.t] = d.o !== '1'; lsSet('_navopen', UI.navOpen); render(); };
A.navMini = () => { document.body.classList.toggle('side-mini'); lsSet('_mini', document.body.classList.contains('side-mini')); render(); };
A.navMobile = () => { document.body.classList.toggle('nav-open'); };
if (lsGet('_mini', false)) document.body.classList.add('side-mini');

function papelTexto() {
  const parts = [lbl(PAPEIS, ME.papel)];
  Perm.gerenciasAtivas().forEach(g => parts.push(g.nome.replace('Gerência ', 'Ger. ')));
  const coord = D.alocacoes.filter(a => a.pessoa_id === ME.pessoa_id && a.coordena).map(a => siglaProjeto(a.projeto_id));
  if (coord.length) parts.push('Coord. ' + coord.join(', '));
  return parts.join(' · ');
}
function header() {
  const trilha = [TITULOS[UI.tab] || ''];
  if (UI.tab === 'projetos' && UI.projeto) trilha.push(siglaProjeto(UI.projeto));
  if (UI.tab === 'equipe' && UI.pessoa) trilha.push(nomePessoa(UI.pessoa));
  if (UI.tab === 'gerencias' && UI.gerencia) trilha.push((byId('gerencias', UI.gerencia) || {}).nome || '');
  return `<div class="topbar"><button class="hamb" data-a="navMobile" aria-label="Abrir menu">☰</button>
    <div class="crumb">${trilha.filter(Boolean).map((t, i, a) => i < a.length - 1 ? `<button class="link crumb-a" data-a="nav" data-t="${UI.tab}">${esc(t)}</button><span class="crumb-s">›</span>` : `<span class="crumb-c">${esc(t)}</span>`).join('')}</div>
    <div class="sub">Hoje: ${fmtD(hoje())} · v${VERSAO}</div></div>`;
}

/* ── modal / formulários ────────────────────────────────────────── */
let MODAL = null;
function openModal(html, opts = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="ov"><div class="modal${opts.wide ? ' wide' : ''}">${html}</div></div>`;
  MODAL = { opts, root };
  root.querySelector('.ov').addEventListener('mousedown', e => { if (e.target.classList.contains('ov') && !opts.sticky) closeModal(); });
  const first = root.querySelector('input:not([type=checkbox]):not([readonly]),select,textarea'); if (first && !opts.noFocus) first.focus();
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; MODAL = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MODAL) closeModal(); });

function fieldHTML(f, v) {
  const id = 'fld_' + f.k, ro = f.ro ? ' disabled' : '';
  const lab = `<label class="fl" for="${id}">${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}</label>`;
  const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
  let inp = '';
  switch (f.t) {
    case 'textarea': inp = `<textarea id="${id}" rows="${f.rows || 3}"${ro}>${esc(v ?? '')}</textarea>`; break;
    case 'select': inp = `<select id="${id}"${ro}>${(f.blank !== false ? `<option value="">${esc(f.blank || '—')}</option>` : '')}${f.opts.map(([ov, ol]) => `<option value="${esc(ov)}"${String(ov) === String(v ?? '') ? ' selected' : ''}>${esc(ol)}</option>`).join('')}</select>`; break;
    case 'sec': return f.l ? `<div class="full fsec">${esc(f.l)}</div>` : '';
    case 'check': return `<div class="${f.full ? 'full' : ''}"><label class="row small" style="margin-top:18px"><input type="checkbox" id="${id}"${v ? ' checked' : ''}${ro}> ${esc(f.l)}</label>${help}</div>`;
    case 'multi': inp = `<div class="checks" id="${id}">${f.opts.map(([ov, ol]) => `<label><input type="checkbox" value="${esc(ov)}"${(v || []).includes(ov) ? ' checked' : ''}${ro}> ${esc(ol)}</label>`).join('')}</div>`; break;
    case 'tags': inp = `<textarea id="${id}" rows="${f.rows || 2}"${ro}>${esc((v || []).join(', '))}</textarea>`; break;
    case 'money': case 'number': inp = `<input id="${id}" type="number" step="${f.step || (f.t === 'money' ? '0.01' : 'any')}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} value="${v ?? ''}"${ro}>`; break;
    case 'date': inp = `<input id="${id}" type="date" value="${esc(v || '')}"${ro}>`; break;
    case 'datetime': inp = `<input id="${id}" type="datetime-local" value="${esc(v ? toLocalDT(v) : '')}"${ro}>`; break;
    default: inp = `<input id="${id}" type="text" value="${esc(v ?? '')}"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}${ro}>`;
  }
  return `<div class="${f.full || ['textarea', 'multi', 'tags'].includes(f.t) ? 'full' : ''}">${lab}${inp}${help}</div>`;
}
function toLocalDT(iso) { const d = new Date(iso); if (isNaN(d)) return ''; return isoOf(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function readField(f) {
  const el = document.getElementById('fld_' + f.k); if (!el) return undefined;
  switch (f.t) {
    case 'sec': return f.l ? `<div class="full fsec">${esc(f.l)}</div>` : '';
    case 'check': return el.checked;
    case 'multi': return [...el.querySelectorAll('input:checked')].map(x => x.value);
    case 'tags': return el.value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    case 'money': case 'number': return el.value === '' ? null : Number(el.value);
    case 'datetime': return el.value ? new Date(el.value).toISOString() : null;
    case 'select': return el.value === '' ? null : el.value;
    default: { const s = el.value.trim(); return s === '' ? null : s; }
  }
}
/* form({title, fields, values, onSave(vals), onDelete, intro, wide}) */
function form(o) {
  const vals = o.values || {};
  const html = `<h3>${esc(o.title)}</h3>${o.intro || ''}
    <div class="fgrid">${o.fields.filter(f => !f.hide).map(f => fieldHTML(f, vals[f.k])).join('')}</div>
    ${o.after || ''}
    <div class="merr" id="m_err" style="display:none"></div>
    <div class="mactions">
      ${o.onDelete ? `<button class="btn-d left" id="m_del">${esc(o.deleteLabel || 'Excluir')}</button>` : ''}
      <button id="m_cancel">Cancelar</button>
      ${o.onSave ? `<button class="btn-p" id="m_ok">${esc(o.okLabel || 'Salvar')}</button>` : ''}
    </div>`;
  openModal(html, { wide: o.wide, sticky: true });
  const err = m => { const e = document.getElementById('m_err'); e.textContent = m; e.style.display = 'block'; };
  document.getElementById('m_cancel').onclick = closeModal;
  if (o.onSave) document.getElementById('m_ok').onclick = async () => {
    const out = {};
    for (const f of o.fields.filter(f => !f.hide && !f.ro && f.t !== 'sec')) {
      const v = readField(f); out[f.k] = v;
      if (f.req && (v == null || v === '' || (Array.isArray(v) && !v.length))) { err(`Preencha: ${f.l}.`); return; }
    }
    const btn = document.getElementById('m_ok'); btn.disabled = true;
    try { await o.onSave(out); closeModal(); render(); if (o.okMsg !== false) flash(o.okMsg || '✓ Salvo'); }
    catch (e) { console.error(e); err(traduzErro(e)); btn.disabled = false; }
  };
  if (o.onDelete) document.getElementById('m_del').onclick = async () => {
    if (!await confirmar(o.deleteConfirm || 'Confirma a exclusão?')) return;
    try { await o.onDelete(); closeModal(); render(); flash('Excluído'); }
    catch (e) { console.error(e); err(traduzErro(e)); }
  };
  if (o.onOpen) o.onOpen();
}
function confirmar(msg) {
  return new Promise(res => {
    const prev = document.getElementById('modal-root').innerHTML;
    const box = document.createElement('div');
    box.innerHTML = `<div class="ov" style="z-index:70"><div class="modal" style="max-width:440px"><h3>Confirmação</h3><p style="font-size:13px;white-space:pre-line">${esc(msg)}</p>
      <div class="mactions"><button id="c_no">Cancelar</button><button class="btn-d" id="c_yes">Confirmar</button></div></div></div>`;
    document.body.appendChild(box);
    box.querySelector('#c_no').onclick = () => { box.remove(); res(false); };
    box.querySelector('#c_yes').onclick = () => { box.remove(); res(true); };
  });
}
function mostrar(title, html, wide) {
  openModal(`<div class="between mb"><h3 style="margin:0">${esc(title)}</h3><button class="btn-s" id="m_x">✕</button></div>${html}`, { wide, noFocus: true });
  document.getElementById('m_x').onclick = closeModal;
}

/* opções frequentes */
const optPessoas = (filtro = () => true) => D.pessoas.filter(p => p.ativo !== false).filter(filtro).sort(byName('nome')).map(p => [p.id, p.nome + (p.tipo === 'ic' ? ' (IC)' : '')]);
const optProjetos = (soVigentes) => D.projetos.filter(p => !soVigentes || p.situacao === 'vigente').sort(byName('sigla')).map(p => [p.id, p.sigla]);
const optGerencias = () => D.gerencias.filter(g => g.ativa).sort(by('ordem')).map(g => [g.id, g.nome]);

/* cor por carga */
function corCarga(pct) {
  if (pct >= 115) return ['#fcebeb', '#a32d2d', '#e24b4a'];
  if (pct >= 100) return ['#fbe9d7', '#8a3b0c', '#e3a06a'];
  if (pct >= 65) return ['#e6f1fb', '#0c447c', '#a9caed'];
  if (pct >= 38) return ['#eaf3de', '#27500a', '#7db84a'];
  if (pct > 0) return ['#faeeda', '#633806', '#efd29a'];
  return ['#f4f2ec', '#8a8984', '#dedad2'];
}
const pillCarga = pct => { const [bg, c, b] = corCarga(pct); return `<span class="loadpill" style="background:${bg};color:${c};border:1px solid ${b}">${Math.round(pct)}%</span>`; };

/* ════════════════════════════════════════════════════════════════════
   COMPONENTES: tarefas e Gantt de atividades
   ════════════════════════════════════════════════════════════════════ */
function tarefaLinha(t, o = {}) {
  const resp = Calc.responsaveis(t.id).map(p => p.nome).join(', ');
  const late = Calc.atrasada(t);
  const pode = Perm.editaTarefa(t);
  const at = t.atividade_id ? byId('cronograma', t.atividade_id) : null;
  const onde = [o.proj !== false && t.projeto_id ? `<span class="b b-blue">${esc(siglaProjeto(t.projeto_id))}</span>` : '', at ? `<span class="b b-gray" title="${esc(at.titulo)}">ativ. ${esc(at.codigo)}</span>` : '',
    o.ger !== false && t.gerencia_id ? `<span class="b b-gray">${esc((byId('gerencias', t.gerencia_id) || {}).nome || '')}</span>` : ''].join(' ');
  const pri = t.prioridade && t.prioridade !== 'normal' ? badge(lbl(PRIORIDADES, t.prioridade), t.prioridade === 'urgente' ? 'b-red' : t.prioridade === 'alta' ? 'b-yellow' : 'b-gray') : '';
  return `<div class="task${t.concluida ? ' done' : ''}">
    <input type="checkbox" ${t.concluida ? 'checked' : ''} ${pode ? '' : 'disabled'} data-a="tarefaToggle" data-id="${t.id}" title="Concluída">
    <div><span class="tt ${pode ? 'link' : ''}" ${pode ? `data-a="tarefaEditar" data-id="${t.id}"` : ''} style="font-weight:600">${esc(t.titulo || '(sem título)')}</span> ${pri}
      <div class="meta">${onde} ${resp ? '· ' + esc(resp) : '<span class="faint">· sem responsável</span>'}${t.descricao ? ' · ' + esc(t.descricao.slice(0, 120)) : ''}</div></div>
    <div class="small" style="text-align:right;${late ? 'color:var(--red);font-weight:600' : ''}">${t.inicio ? fmtD(t.inicio) + ' → ' : ''}${t.prazo ? fmtD(t.prazo) : '<span class="faint">sem prazo</span>'}${late ? '<br>atrasada' : ''}</div>
  </div>`;
}
function listaTarefas(list, o = {}) {
  if (!list.length) return `<div class="empty">${o.vazio || 'Nenhuma tarefa.'}</div>`;
  const ord = list.slice().sort((a, b) => (a.concluida - b.concluida) || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
  return ord.map(t => tarefaLinha(t, o)).join('');
}
A.tarefaToggle = async d => { const t = byId('tarefas', d.id); await Data.update('tarefas', t.id, { concluida: !t.concluida }); render(); };
A.tarefaEditar = d => formTarefa(byId('tarefas', d.id));
A.tarefaNova = d => formTarefa(null, { projeto_id: d.projeto || null, gerencia_id: d.gerencia || null, responsaveis: d.pessoa ? [d.pessoa] : (ME.pessoa_id && !d.projeto && !d.gerencia ? [ME.pessoa_id] : []) });
function formTarefa(t, pre = {}) {
  const novo = !t;
  const v = t ? { ...t, responsaveis: D.tarefa_responsaveis.filter(r => r.tarefa_id === t.id).map(r => r.pessoa_id) } : { prioridade: 'normal', ...pre };
  const gereResp = novo || Perm.gereTarefa(t);
  form({
    title: novo ? 'Nova tarefa / demanda' : 'Editar tarefa', values: v,
    fields: [
      { k: 'titulo', l: 'Título', req: true, full: true },
      { k: 'projeto_id', l: 'Projeto', t: 'select', opts: optProjetos(true), blank: '— nenhum (demanda de gerência) —' },
      { k: 'gerencia_id', l: 'Gerência', t: 'select', opts: optGerencias(), blank: '— nenhuma —' },
      { k: 'atividade_id', l: 'Atividade do cronograma físico', t: 'select', blank: '— nenhuma —', hide: !(v.projeto_id && Calc.folhasCronograma(v.projeto_id).length),
        opts: v.projeto_id ? Calc.folhasCronograma(v.projeto_id).map(c => [c.id, `${c.codigo} ${c.titulo.length > 70 ? c.titulo.slice(0, 68) + '…' : c.titulo}`]) : [], full: true, help: 'Opcional — liga a tarefa do dia a dia a uma atividade do plano de trabalho' },
      { k: 'inicio', l: 'Início', t: 'date' }, { k: 'prazo', l: 'Prazo', t: 'date' },
      { k: 'prioridade', l: 'Prioridade', t: 'select', opts: PRIORIDADES, blank: false },
      { k: 'concluida', l: 'Concluída', t: 'check' },
      { k: 'descricao', l: 'Descrição', t: 'textarea' },
      { k: 'responsaveis', l: 'Responsáveis', t: 'multi', opts: optPessoas(), ro: !gereResp },
    ],
    onSave: async x => {
      const resp = x.responsaveis; delete x.responsaveis;
      let row;
      if (novo) row = await Data.insert('tarefas', x); else row = await Data.update('tarefas', t.id, x);
      if (resp && gereResp) {
        const atuais = D.tarefa_responsaveis.filter(r => r.tarefa_id === row.id).map(r => r.pessoa_id);
        for (const pid of atuais.filter(p => !resp.includes(p))) await Data.removeWhere('tarefa_responsaveis', { tarefa_id: row.id, pessoa_id: pid });
        for (const pid of resp.filter(p => !atuais.includes(p))) await Data.insert('tarefa_responsaveis', { tarefa_id: row.id, pessoa_id: pid });
      }
    },
    onDelete: !novo && Perm.gereTarefa(t) ? () => Data.remove('tarefas', t.id) : null,
    deleteConfirm: 'Excluir esta tarefa?',
  });
}

function ganttTarefas(list, grupo = t => t.projeto_id ? siglaProjeto(t.projeto_id) : ((byId('gerencias', t.gerencia_id) || {}).nome || '')) {
  const rows = list.filter(t => t.inicio || t.prazo).map(t => {
    const s = toDate(t.inicio || t.prazo), e = toDate(t.prazo || t.inicio);
    return { t, s, e, ms: !(t.inicio && t.prazo) };
  }).sort((a, b) => a.s - b.s);
  if (!rows.length) return `<div class="empty">Sem tarefas com datas para o gráfico. Defina início e/ou prazo.</div>`;
  const today = toDate(hoje()); let min = rows[0].s, max = rows[0].e;
  rows.forEach(r => { if (r.s < min) min = r.s; if (r.e > max) max = r.e; });
  if (today < min) min = today; if (today > max) max = today;
  const DAY = 864e5; min = new Date(+min - 3 * DAY); max = new Date(+max + 3 * DAY);
  const days = Math.max(1, Math.round((max - min) / DAY));
  const LW = 230, rowH = 22, headH = 20, per = Math.max(2, Math.min(16, 760 / days)), W = LW + Math.round(days * per) + 10, H = headH + rows.length * rowH + 14;
  const x = d => LW + ((d - min) / DAY) * per;
  const o = [`<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%;height:auto;font-family:'Segoe UI',sans-serif">`];
  let cur = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cur <= max) { const cx = x(cur); if (cx >= LW) { o.push(`<line x1="${cx}" y1="${headH - 4}" x2="${cx}" y2="${H}" stroke="#eee"/><text x="${cx + 3}" y="13" fill="#9b9b98" font-size="9.5">${MESES[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}</text>`); } cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
  const tx = x(today); o.push(`<line x1="${tx}" y1="${headH - 4}" x2="${tx}" y2="${H}" stroke="#c43030" stroke-dasharray="3 3"/><text x="${tx + 2}" y="${H - 2}" fill="#c43030" font-size="9">hoje</text>`);
  rows.forEach((r, i) => {
    const y = headH + i * rowH + 3, bx = x(r.s), bw = Math.max(r.ms ? 9 : 5, x(r.e) - bx + per);
    const late = !r.t.concluida && r.e < today;
    const fill = r.t.concluida ? '#cfd3c9' : late ? '#e07a6a' : '#5b8fce';
    const label = (grupo(r.t) ? grupo(r.t) + ' · ' : '') + (r.t.titulo || '');
    o.push(`<text x="4" y="${y + 11}" fill="#444" font-size="10.5">${esc(label.length > 38 ? label.slice(0, 37) + '…' : label)}</text>`);
    if (r.ms) { const cx = bx + 4; o.push(`<rect x="${cx - 5}" y="${y}" width="10" height="10" transform="rotate(45 ${cx} ${y + 5})" fill="${fill}"/>`); }
    else o.push(`<rect x="${bx}" y="${y - 1}" width="${bw}" height="14" rx="3" fill="${fill}"><title>${esc(r.t.titulo)}</title></rect>`);
  });
  o.push('</svg>');
  return `<div class="card" style="padding:8px;overflow-x:auto">${o.join('')}</div>`;
}

/* ════════════════════════════════════════════════════════════════════
   PAINEL
   ════════════════════════════════════════════════════════════════════ */
const VIEWS = {};
/* alertas do laboratório (cada um com o projeto a que se refere, para agrupar) */
function alertasPainel() {
  const t = hoje(), al = [], push = (c, h, pid) => al.push({ c, h, pid: pid || null });
  const btn = (a, attrs) => ` <button class="btn-s" data-a="${a}" ${attrs || ''}>abrir</button>`;
  D.projetos.filter(p => Calc.vencido(p)).forEach(p => push('warn', `Vigência terminou em ${fmtD(p.fim)} e o projeto continua marcado como vigente.${btn('projAbrir', `data-id="${p.id}"`)}`, p.id));
  D.projetos.filter(p => Calc.vigente(p) && p.status === 'critico').forEach(p => push('bad', `Marcado como crítico${p.notas ? ': ' + esc(p.notas) : ''}`, p.id));
  D.desembolsos.filter(d => Perm.veFin(d.projeto_id) && Calc.situacaoParcela(d) === 'atrasada').sort(byName('data_prevista')).forEach(d => push('bad', `Parcela ${d.numero} do desembolso (${fmtBRL(d.valor_previsto)}) prevista para ${fmtD(d.data_prevista)} não recebida${btn('finDesemb', `data-id="${d.projeto_id}"`)}`, d.projeto_id));
  D.projetos.filter(p => Perm.veFin(p.id) && D.desembolsos.some(d => d.projeto_id === p.id)).forEach(p => { const x = Calc.desembolso(p).tot; if (x.caixa < -0.005) push('bad', `Gastos acima do recebido — caixa ${fmtBRL2(x.caixa)}${btn('finDesemb', `data-id="${p.id}"`)}`, p.id); });
  D.vinculos_financeiros.filter(v => Perm.veFin(v.projeto_id) && ['previsto', 'ativo'].includes(v.status) && v.fim && v.fim >= t && v.fim <= addDays(t, 30)).sort(byName('fim')).forEach(v => push('warn', `Bolsa de <b>${esc(nomePessoa(v.pessoa_id))}</b> termina em ${fmtD(v.fim)}${btn('eqBolsas')}`, v.projeto_id));
  D.equipe_plano.filter(e => e.status === 'selecao' && e.selecao_prazo && e.selecao_prazo < t && Perm.gereAlocacao(e.projeto_id)).forEach(e => push('warn', `Seleção para “${esc(e.nome_plano)}” passou do prazo (${fmtD(e.selecao_prazo)})${btn('eqVagas')}`, e.projeto_id));
  Calc.emTransicao().filter(x => Perm.gerePessoa(x.pe.id) && x.falta && (x.fase === 'saida' ? x.pe.saida < t : x.pe.ingresso && x.pe.ingresso < addDays(t, -30))).forEach(x => push('warn', `<b>${esc(x.pe.nome)}</b>: ${x.falta} item(ns) de ${x.fase === 'entrada' ? 'integração' : 'desligamento'} pendente(s)${btn('pessoaAbrir', `data-id="${x.pe.id}"`)}`));
  D.pendencias.filter(Calc.pendenciaAtrasada).sort(byName('prazo')).forEach(x => push('bad', `Pendência “${esc(x.titulo)}” venceu em ${fmtD(x.prazo)}${x.responsavel_id ? ' · ' + esc(nomePessoa(x.responsavel_id)) : ''}${btn('projAbrir', `data-id="${x.projeto_id}" data-aba="docs"`)}`, x.projeto_id));
  D.entregas.filter(Calc.entregaAtrasada).sort(byName('prazo')).forEach(e => push('bad', `Entrega “${esc(e.titulo)}” venceu em ${fmtD(e.prazo)}${e.responsavel_id ? ' · ' + esc(nomePessoa(e.responsavel_id)) : ''}${btn('projAbrir', `data-id="${e.projeto_id}" data-aba="entregas"`)}`, e.projeto_id));
  D.entregas.filter(e => Calc.entregaAberta(e) && e.prazo >= t && e.prazo <= addDays(t, 15)).sort(byName('prazo')).forEach(e => push('warn', `Entrega “${esc(e.titulo)}” vence em ${fmtD(e.prazo)}${e.responsavel_id ? ' · ' + esc(nomePessoa(e.responsavel_id)) : ''}`, e.projeto_id));
  D.pessoas.filter(p => p.ativo !== false && Calc.carga(p.id) > 100).forEach(p => push('warn', `<b>${esc(p.nome)}</b> com carga de ${Math.round(Calc.carga(p.id))}% nos projetos vigentes`));
  D.prospeccoes.filter(p => ['avaliacao', 'aprovada', 'renegociar'].includes(p.situacao) && p.prazo_submissao && p.prazo_submissao >= t && p.prazo_submissao <= addDays(t, 20)).forEach(p => push('warn', `Submissão <b>${esc(p.nome)}</b> vence em ${fmtD(p.prazo_submissao)}`));
  Calc.alertasInfra().forEach(a => push(a.grave ? 'bad' : 'warn', esc(a.txt)));
  const atras = D.tarefas.filter(Calc.atrasada);
  [...new Set(atras.map(x => x.projeto_id))].forEach(pid => { const n = atras.filter(x => x.projeto_id === pid).length; push('bad', `${n} tarefa(s) atrasada(s)${pid ? btn('projAbrir', `data-id="${pid}" data-aba="tarefas"`) : ''}`, pid); });
  return al;
}
const SINAL = { bad: ['Crítico', 'b-red', '●'], warn: ['Atenção', 'b-yellow', '▲'], ok: ['Em dia', 'b-green', '✓'] };
const CAT_EV = [['Entregas e pendências', '#2a78d6'], ['Atividades do cronograma', '#eb6834'], ['Financeiro', '#1baf7a'], ['Equipe', '#eda100'], ['Vigência e propostas', '#e87ba4']];
const attrsEv = a => Object.entries(a || {}).map(([k, v]) => k === 'a' ? `data-a="${v}"` : `data-${k}="${esc(v)}"`).join(' ');
A.nav2 = d => A.nav({ t: d.t });

VIEWS.painel = () => {
  const gestor = Perm.dir() || Perm.gerenciasAtivas().length > 0 || Perm.coordenaAlgum();
  let v = UI.sub.painel || (Perm.dir() || Perm.gerenciasAtivas().length ? 'portfolio' : 'semana');
  if (v === 'semana' && !ME.pessoa_id) v = 'portfolio';
  return `<div class="subtabs">${ME.pessoa_id ? `<button class="chip${v === 'semana' ? ' on' : ''}" data-a="sub" data-g="painel" data-v="semana">Minha semana</button>` : ''}<button class="chip${v === 'portfolio' ? ' on' : ''}" data-a="sub" data-g="painel" data-v="portfolio">Portfólio${gestor ? '' : ' (visão geral)'}</button></div>`
    + (v === 'semana' ? painelSemana() : painelPortfolio());
};

/* ── Minha semana ── */
function painelSemana() {
  const t = hoje(), dow = toDate(t).getDay(), fimSem = addDays(t, dow === 0 ? 0 : 7 - dow), lim = addDays(t, 30);
  const ag = Calc.minhaAgenda();
  const grupos = [['Atrasados', x => x.data && x.data < t, 'bad'], ['Esta semana', x => x.data && x.data >= t && x.data <= fimSem], ['Próximos 30 dias', x => x.data && x.data > fimSem && x.data <= lim], ['Sem prazo definido', x => !x.data]];
  const cont = grupos.map(([, f]) => ag.filter(f).length);
  const pe = byId('pessoas', ME.pessoa_id);
  const meusProj = D.alocacoes.filter(a => a.pessoa_id === ME.pessoa_id && a.status === 'ativo').map(a => ({ a, p: byId('projetos', a.projeto_id) })).filter(x => x.p && Calc.vigente(x.p)).sort((a, b) => b.a.coordena - a.a.coordena || String(a.p.sigla).localeCompare(b.p.sigla));
  const coordIds = new Set(meusProj.filter(x => x.a.coordena).map(x => x.p.id));
  const atencao = alertasPainel().filter(x => x.pid && coordIds.has(x.pid));
  const linha = x => { const atr = x.data && x.data < t;
    return `<div class="row small click" style="gap:10px;padding:6px 0;border-bottom:1px solid #eeebe4" ${attrsEv(x.a)}><span style="width:78px;font-variant-numeric:tabular-nums;${atr ? 'color:var(--red);font-weight:600' : ''}">${x.data ? (x.data.slice(0, 4) === t.slice(0, 4) ? fmtD(x.data).slice(0, 5) : fmtD(x.data).slice(0, 6) + x.data.slice(2, 4)) + ' ' + ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][toDate(x.data).getDay()] : '—'}</span>
      <span class="b b-gray" style="min-width:74px;text-align:center">${esc(x.tipo)}</span>${x.pid ? `<span class="muted" style="min-width:90px">${esc(siglaProjeto(x.pid))}</span>` : '<span style="min-width:90px"></span>'}<span style="flex:1">${esc(x.txt)}</span></div>`; };
  const mets = [['Atrasados', cont[0], cont[0] ? 'color:var(--red)' : ''], ['Esta semana', cont[1]], ['Próximos 30 dias', cont[2]], ['Meus projetos vigentes', meusProj.length]];
  return `<div class="between mb"><div><div class="title" style="font-size:18px">Olá, ${esc((pe && pe.nome || '').split(' ')[0])}</div><div class="small muted">${['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][dow]}, ${fmtD(t)} · o que está sob a sua responsabilidade</div></div>
    <button class="btn-s" data-a="tarefaNova">+ tarefa</button></div>
  <div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="grid" style="grid-template-columns:minmax(420px,3fr) minmax(300px,2fr);align-items:start">
    <div class="card">${ag.length ? grupos.map(([nome, f, c], i) => { const l = ag.filter(f).sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))); return l.length ? `<div class="sec" style="${i === 0 ? 'margin-top:0;' : ''}${c ? 'color:var(--red)' : ''}">${nome} (${l.length})</div>${l.map(linha).join('')}` : ''; }).join('')
      : '<div class="empty">Nada sob a sua responsabilidade nos próximos 30 dias. 👍</div>'}</div>
    <div>
      ${atencao.length ? `<div class="card mb"><div class="bold mb">Precisa da sua atenção <span class="small muted">(projetos que você coordena)</span></div>${atencao.map(x => `<div class="alert ${x.c}"><b>${esc(siglaProjeto(x.pid))}</b>: ${x.h}</div>`).join('')}</div>` : ''}
      <div class="card mb"><div class="bold mb">Meus projetos</div>${meusProj.length ? meusProj.map(({ a, p }) => { const s = Calc.saudeProjeto(p), prox = Calc.entregasAbertas(p.id)[0];
        return `<div class="click" data-a="projAbrir" data-id="${p.id}" style="padding:7px 0;border-bottom:1px solid #eeebe4"><div class="between"><span><b>${esc(p.sigla)}</b> ${a.coordena ? badge('coordena', 'b-green') : `<span class="small muted">${esc(a.papel || '')}</span>`}</span>${badge(SINAL[s.sinal][2] + ' ' + SINAL[s.sinal][0], SINAL[s.sinal][1])}</div>
          <div class="row small mt" style="gap:12px">${s.fis ? `<span class="muted">físico</span> ${barraAvanco(s.fis.pct, s.fis.prev)}` : ''}<span class="muted">${prox ? `próx. entrega ${fmtD(prox.prazo)}` : 'sem entregas abertas'}</span></div></div>`; }).join('') : '<div class="empty small">Sem alocações em projetos vigentes.</div>'}</div>
      ${(() => { const ger = Perm.gerenciasAtivas(); return ger.length ? `<div class="card"><div class="bold mb">Minhas gerências</div>${ger.map(g => `<div class="row small mb"><span class="b b-blue">${esc(g.nome)}</span> <button class="btn-s" data-a="gerAbrir" data-id="${g.id}">demandas</button></div>`).join('')}</div>` : ''; })()}
    </div></div>`;
}

/* ── Portfólio (Direção, gerências, coordenação) ── */
function painelPortfolio() {
  const t = hoje(), vig = D.projetos.filter(p => Calc.vigente(p) || Calc.vencido(p));
  const S = vig.map(p => Calc.saudeProjeto(p)).sort((a, b) => ({ bad: 0, warn: 1, ok: 2 }[a.sinal] - { bad: 0, warn: 1, ok: 2 }[b.sinal]) || String(a.p.sigla).localeCompare(b.p.sigla));
  const al = alertasPainel();
  const nS = k => S.filter(x => x.sinal === k).length;
  const equipe = D.pessoas.filter(p => p.ativo !== false && p.tipo !== 'ic').length, ics = D.pessoas.filter(p => p.ativo !== false && p.tipo === 'ic').length;
  const vagas = D.equipe_plano.filter(e => ['vaga', 'selecao'].includes(e.status)).length;
  const mets = [['Projetos vigentes', vig.filter(p => Calc.vigente(p)).length], ['Valor dos vigentes', fmtMi(vig.reduce((s, p) => s + num(p.valor_total), 0))],
    ['Críticos / atenção', `${nS('bad')} / ${nS('warn')}`, nS('bad') ? 'color:var(--red)' : ''], ['Entregas atrasadas', S.reduce((s, x) => s + x.entAtr, 0), S.some(x => x.entAtr) ? 'color:var(--red)' : ''],
    ['Vagas abertas', vagas, vagas ? 'color:var(--yellow-txt)' : ''], ['Equipe / IC', `${equipe} / ${ics}`]];
  const algumFin = S.some(x => x.veF);
  const linhas = S.map(x => { const p = x.p, sg = SINAL[x.sinal], coord = Calc.coordenadores(p.id).map(c => c.nome.split(' ')[0]).join(', ');
    const finCel = !x.veF ? '<span class="faint">—</span>' : x.fin ? `${barraExec(x.fin.exec, x.fin.apr)}<div class="small muted">em ${x.tempoPct}% do prazo</div>` : '<span class="small faint">sem orçamento</span>';
    return `<tr class="click" data-a="projAbrir" data-id="${p.id}"><td><b>${esc(p.sigla)}</b> ${badgeTipo(p)}<div class="small muted">${esc(coord || '—')}</div></td>
      <td class="small">${fmtD(p.fim)}<div class="muted">${Calc.vencido(p) ? '<b style="color:var(--red)">vencida</b>' : `${x.mesesRest} mês(es)`}</div></td>
      <td>${x.fis ? barraAvanco(x.fis.pct, x.fis.prev) + `<div class="small muted">previsto ${x.fis.prev}%</div>` : '<span class="small faint">sem cronograma</span>'}</td>
      ${algumFin ? `<td>${finCel}</td><td class="num small">${!x.veF || x.caixa == null ? '<span class="faint">—</span>' : `<span style="color:${x.caixa < 0 ? 'var(--red)' : 'inherit'};font-weight:600">${fmtBRL(x.caixa)}</span>`}</td>` : ''}
      <td class="small">${x.entAtr ? `<b style="color:var(--red)">${x.entAtr} atrasada(s)</b><br>` : ''}${x.entProx ? `${x.entProx} em 30 dias` : x.entAtr ? '' : '<span class="faint">—</span>'}${x.pendAb ? `<div class="muted">${x.pendAb} pendência(s)${x.pendAtr ? ` · <b style="color:var(--red)">${x.pendAtr} atrasada(s)</b>` : ''}</div>` : ''}</td>
      <td class="small">${x.eq.posicoes ? `${x.eq.ocupadas}/${x.eq.posicoes}${x.eq.vagas ? ` · <span style="color:var(--yellow-txt)">${x.eq.vagas} vaga(s)</span>` : ''}` : `${D.alocacoes.filter(a => a.projeto_id === p.id && a.status === 'ativo').length} pessoa(s)`}</td>
      <td>${badge(sg[2] + ' ' + sg[0], sg[1])}${[...x.mot.bad, ...x.mot.warn].length ? `<div class="small muted" style="max-width:220px">${esc([...x.mot.bad, ...x.mot.warn].slice(0, 3).join(' · '))}</div>` : ''}</td></tr>`; }).join('');
  // alertas agrupados por projeto
  const porProj = {}; al.forEach(x => (porProj[x.pid || ''] = porProj[x.pid || ''] || []).push(x));
  const ordemAl = Object.keys(porProj).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || porProj[b].filter(x => x.c === 'bad').length - porProj[a].filter(x => x.c === 'bad').length || String(siglaProjeto(a)).localeCompare(siglaProjeto(b)));
  const abertos = UI.f.alAbertos || new Set();
  const blocoAl = ordemAl.map(k => { const l = porProj[k], nb = l.filter(x => x.c === 'bad').length, nw = l.length - nb, aberto = abertos.has(k) || ordemAl.length <= 2;
    return `<div style="border-bottom:1px solid #eeebe4;padding:6px 0"><div class="between click" data-a="alToggle" data-k="${k}"><span><span class="crtg">${aberto ? '▾' : '▸'}</span> <b>${k ? esc(siglaProjeto(k)) : 'Laboratório (geral)'}</b></span><span>${nb ? `<span class="b b-red">● ${nb}</span> ` : ''}${nw ? `<span class="b b-yellow">▲ ${nw}</span>` : ''}</span></div>
      ${aberto ? l.sort((a, b) => (a.c === 'bad' ? 0 : 1) - (b.c === 'bad' ? 0 : 1)).map(x => `<div class="alert ${x.c}" style="margin:6px 0 0 18px">${x.h}</div>`).join('') : ''}</div>`; }).join('');
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="sec" style="margin-top:4px">Saúde dos projetos</div>
  <div class="card tw" style="padding:4px 8px">${S.length ? `<table class="t"><tr><th>Projeto</th><th>Vigência</th><th>Avanço físico</th>${algumFin ? '<th>Execução financeira</th><th class="num">Caixa</th>' : ''}<th>Entregas / pendências</th><th>Equipe do plano</th><th>Sinal</th></tr>${linhas}</table>` : '<div class="empty">Nenhum projeto vigente.</div>'}</div>
  <div class="small muted mt">Sinal: <b>● Crítico</b> — entrega ou pendência atrasada, caixa negativo, parcela não recebida, vigência vencida ou físico mais de 15 p.p. abaixo do previsto. <b>▲ Atenção</b> — físico 5–15 p.p. abaixo, execução financeira baixa para o tempo decorrido, fim da vigência em até 6 meses com execução baixa, vagas abertas ou entregas nos próximos 30 dias.</div>
  <div class="mt">${linhaTempo()}</div>
  <div class="mt"><div class="card"><div class="between mb"><span class="bold">Alertas (${al.length})</span><span class="small">${al.filter(x => x.c === 'bad').length ? `<span class="b b-red">● ${al.filter(x => x.c === 'bad').length}</span> ` : ''}<span class="b b-yellow">▲ ${al.filter(x => x.c !== 'bad').length}</span></span></div>${al.length ? blocoAl : '<div class="empty">Nenhum alerta. 👍</div>'}</div></div>`;
}
A.alToggle = d => { const s = UI.f.alAbertos = UI.f.alAbertos || new Set(); s.has(d.k) ? s.delete(d.k) : s.add(d.k); render(); };

/* linha do tempo dos próximos N dias: uma faixa por categoria, marcas clicáveis, lista por semana abaixo */
function linhaTempo() {
  const n = +(UI.f.ltDias || 60), t = hoje(), ate = addDays(t, n), ev = Calc.eventos(t, ate, false);
  const W = 1060, L = 170, R = 14, H0 = 38, RH = 30, H = H0 + CAT_EV.length * RH + 8, x = d => L + (toDate(d) - toDate(t)) / (toDate(ate) - toDate(t)) * (W - L - R);
  const ticks = []; for (let d = t; d <= ate; d = addDays(d, 7)) ticks.push(d);
  const meses = []; { const a = toDate(t); for (let m = new Date(a.getFullYear(), a.getMonth() + 1, 1); isoOf(m) <= ate; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) meses.push(isoOf(m)); }
  // empilha marcas do mesmo dia na mesma faixa
  const pos = {}; const marks = ev.map(e => { const k = e.cat + '|' + e.data; pos[k] = (pos[k] || 0) + 1; return { e, dx: (pos[k] - 1) * 7 }; });
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" role="img" aria-label="Linha do tempo dos próximos ${n} dias">
    ${meses.map(m => `<line x1="${x(m)}" x2="${x(m)}" y1="${H0 - 6}" y2="${H - 6}" stroke="#d0cec8" stroke-width="1"/><text x="${x(m) + 4}" y="12" font-size="11.5" font-weight="600" fill="#3d3d3a">${MESES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}</text>`).join('')}
    ${ticks.map(d => `<line x1="${x(d)}" x2="${x(d)}" y1="${H0 - 2}" y2="${H - 6}" stroke="#eeebe4" stroke-width="1"/><text x="${x(d)}" y="${H0 - 8}" font-size="10.5" fill="#5f5e5a" text-anchor="middle">${d.slice(8, 10)}/${d.slice(5, 7)}</text>`).join('')}
    ${CAT_EV.map(([nome], i) => `<text x="0" y="${H0 + i * RH + RH / 2 + 4}" font-size="12.5" fill="#3d3d3a">${esc(nome)}</text><line x1="${L}" x2="${W - R}" y1="${H0 + i * RH + RH / 2}" y2="${H0 + i * RH + RH / 2}" stroke="#eeebe4" stroke-width="1"/>`).join('')}
    <line x1="${L}" x2="${L}" y1="${H0 - 2}" y2="${H - 6}" stroke="#1c1c1a" stroke-width="1.5"/><text x="${L + 4}" y="${H - 1}" font-size="10.5" fill="#1c1c1a">hoje</text>
    ${marks.map(({ e, dx }) => `<g class="click" ${attrsEv(e.a)} style="cursor:pointer"><title>${esc(fmtD(e.data) + ' · ' + (e.pid ? siglaProjeto(e.pid) + ' · ' : '') + e.txt)}</title>
      <circle cx="${x(e.data) + dx}" cy="${H0 + e.cat * RH + RH / 2}" r="9" fill="transparent"/><circle cx="${x(e.data) + dx}" cy="${H0 + e.cat * RH + RH / 2}" r="5" fill="${CAT_EV[e.cat][1]}" stroke="#fff" stroke-width="2"/></g>`).join('')}
  </svg>`;
  // lista por semana
  const semanas = {}; ev.forEach(e => { const d = toDate(e.data), seg = addDays(e.data, -((d.getDay() + 6) % 7)); (semanas[seg] = semanas[seg] || []).push(e); });
  const lista = Object.keys(semanas).sort().map(s => `<div class="sec" style="margin-top:10px">Semana de ${fmtD(s < t ? t : s).slice(0, 5)}</div>${semanas[s].map(e => `<div class="row small click" ${attrsEv(e.a)} style="gap:8px;padding:3px 0"><span style="width:10px;height:10px;border-radius:50%;background:${CAT_EV[e.cat][1]};flex:none" title="${esc(CAT_EV[e.cat][0])}"></span><span style="width:40px;font-variant-numeric:tabular-nums">${fmtD(e.data).slice(0, 5)}</span>${e.pid ? `<span class="muted" style="min-width:86px">${esc(siglaProjeto(e.pid))}</span>` : '<span style="min-width:86px"></span>'}<span style="flex:1">${esc(e.txt)}</span></div>`).join('')}`).join('');
  const verLista = !!UI.f.ltLista;
  return `<div class="card"><div class="between mb"><span class="bold">Próximos ${n} dias <span class="small muted">(${ev.length} eventos)</span></span><div class="row">${[30, 60, 90].map(k => `<button class="chip${n === k ? ' on' : ''}" data-a="ltDias" data-v="${k}">${k} dias</button>`).join('')}</div></div>
    ${ev.length ? svg : '<div class="empty">Nenhum evento no período.</div>'}
    ${ev.length ? `<div class="mt"><button class="link small" data-a="ltLista">${verLista ? '▾ ocultar lista' : '▸ ver lista por semana'}</button>${verLista ? lista : ''}</div>` : ''}</div>`;
}
A.ltDias = d => { UI.f.ltDias = d.v; render(); };
A.ltLista = () => { UI.f.ltLista = !UI.f.ltLista; render(); };

/* ════════════════════════════════════════════════════════════════════
   PROJETOS
   ════════════════════════════════════════════════════════════════════ */
A.projAbrir = d => { if (UI.projeto !== d.id || d.aba) UI.projAba = d.aba || 'resumo'; UI.tab = 'projetos'; UI.projeto = d.id; window.scrollTo(0, 0); render(); };
A.projVoltar = () => { UI.projeto = null; render(); };
VIEWS.projetos = () => {
  if (UI.projeto && byId('projetos', UI.projeto)) return projetoDetalhe(byId('projetos', UI.projeto));
  const fs = UI.f.projSit || 'vigente', q = norm(UI.f.projBusca), ft = UI.f.projTipo || '';
  let list = D.projetos.slice().sort(by('ordem')).sort(byName('sigla'));
  if (fs !== 'todos') list = list.filter(p => p.situacao === fs);
  if (ft) list = list.filter(p => (p.tipo || 'edital') === ft);
  if (q) list = list.filter(p => norm([p.sigla, p.nome, p.financiador, p.fase].join(' ')).includes(q));
  const podeCriar = Perm.dir() || Perm.tem('projetos_criar');
  return `<div class="toolbar"><div class="row">
      <select data-f="projSit">${[['vigente', 'Vigentes'], ['encerrado', 'Encerrados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']].map(([v, l]) => `<option value="${v}"${fs === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select data-f="projTipo">${[['', 'Editais e serviços'], ...TIPOS_PROJ.map(([v, l]) => [v, v === 'edital' ? 'Só editais' : 'Só prestação de serviço'])].map(([v, l]) => `<option value="${v}"${ft === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input id="projBusca" data-f="projBusca" placeholder="Buscar sigla, nome, financiador…" value="${esc(UI.f.projBusca || '')}">
      <span class="small muted">${list.length} projeto(s)</span></div>
    ${podeCriar ? `<div class="row"><button data-a="importarPlanilha" title="Planilha padrão do edital (modelo Mover/Fundep) — importa a parte da UFSM">Importar planilha do edital (.xlsx)</button><button data-a="projTexto">Importar de texto</button><button class="btn-p" data-a="projNovo">+ Novo projeto</button></div>` : ''}
  </div>
  ${list.length ? `<div class="grid">${list.map(cardProjeto).join('')}</div>` : '<div class="empty">Nenhum projeto neste filtro.</div>'}`;
};
const badgeTipo = p => (p.tipo || 'edital') === 'servico' ? badge('Serviço', 'b-yellow') : badge('Edital', 'b-blue');
function barraExec(ex, ap) {
  const pct = ap > 0 ? ex / ap * 100 : 0, cor = pct > 100 ? 'var(--red)' : pct >= 85 ? 'var(--yellow)' : 'var(--green)';
  return `<span class="pbar" title="${pct.toFixed(1)}% executado"><span style="width:${Math.min(100, pct).toFixed(1)}%;background:${cor}"></span></span><span class="small" style="font-variant-numeric:tabular-nums">${pct.toFixed(0)}%</span>`;
}
function cardProjeto(p) {
  const st = STATUS_PROJ[p.status] || STATUS_PROJ.pendente;
  const coord = Calc.coordenadores(p.id).map(x => x.nome).join(', ');
  const nT = D.tarefas.filter(t => t.projeto_id === p.id && !t.concluida).length, nA = D.tarefas.filter(t => t.projeto_id === p.id && Calc.atrasada(t)).length;
  return `<div class="card pcard">
    <div class="hd"><div class="row"><button class="link" style="font-size:15px" data-a="projAbrir" data-id="${p.id}">${esc(p.sigla)}</button>${badgeTipo(p)}${badge(st[0], st[1])}
      ${p.placeholder ? badge('dados incompletos', 'b-gray') : ''}${Calc.vencido(p) ? badge('vigência vencida', 'b-red') : ''}${p.situacao !== 'vigente' ? badge(lbl(SITUACAO_PROJ, p.situacao), 'b-gray') : ''}</div></div>
    <div class="small muted mb">${esc(p.nome || '')}</div>
    <div class="kv mb"><span class="k">Financiador</span><span>${esc(p.financiador || '—')}</span>
      <span class="k">Valor</span><span>${fmtMi(p.valor_total)}</span>
      <span class="k">Período</span><span>${fmtMes(p.inicio)} → ${fmtMes(p.fim)}</span>
      <span class="k">Coordenação</span><span>${esc(coord || '—')}</span>
      <span class="k">Tarefas</span><span>${nT} aberta(s)${nA ? ` · <b style="color:var(--red)">${nA} atrasada(s)</b>` : ''}</span>
      ${(() => { const e = Calc.entregasAbertas(p.id)[0]; if (!e) return ''; const atr = Calc.entregaAtrasada(e); return `<span class="k">Próxima entrega</span><span style="${atr ? 'color:var(--red);font-weight:700' : ''}">${esc(e.titulo)} · ${fmtD(e.prazo)}${atr ? ' (atrasada)' : ''}</span>`; })()}
      ${Perm.veFin(p.id) ? (() => { const t = Calc.totaisOrc(p.id); return t.aprovado ? `<span class="k">Execução</span><span>${barraExec(t.executado, t.aprovado)} <span class="small muted">${fmtBRL(t.executado)} de ${fmtBRL(t.aprovado)}</span></span>` : `<span class="k">Orçamento</span><span class="faint">não lançado</span>`; })() : ''}</div>
    <div class="note"><b>${esc(p.fase || '—')}</b>${p.notas ? '<br>' + esc(p.notas) : ''}</div>
  </div>`;
}
A.projExcluir = async d => {
  const p = byId('projetos', d.id);
  const c = k => D[k].filter(r => r.projeto_id === p.id).length;
  const ok = await confirmar(`Excluir o projeto ${p.sigla}?\n\nSerão apagados junto: ${c('aditivos')} aditivo(s), ${c('cronograma')} item(ns) do cronograma físico, ${c('entregas')} entrega(s), ${c('alocacoes')} alocação(ões), ${c('tarefas')} tarefa(s), ${c('orcamento_rubricas')} rubrica(s) orçada(s), ${c('despesas')} despesa(s) lançada(s) e ${c('vinculos_financeiros')} vínculo(s) financeiro(s).\nReservas, itens e prospecções ligados perdem a referência.\n\nPara projetos concluídos, prefira marcar a situação como "Encerrado".`);
  if (!ok) return; await Data.remove('projetos', p.id); UI.projeto = null; render(); flash('Projeto excluído');
};
A.projEncerrar = async d => { await Data.update('projetos', d.id, { situacao: 'encerrado' }); render(); flash('Projeto marcado como encerrado'); };

function camposProjeto(p) {
  return [
    { t: 'sec', k: '_s1', l: 'Identificação' },
    { k: 'tipo', l: 'Tipo de projeto', t: 'select', blank: false, req: true, opts: TIPOS_PROJ },
    { k: 'sigla', l: 'Sigla', req: true }, { k: 'nome', l: 'Título completo', full: true },
    { k: 'status', l: 'Status', t: 'select', blank: false, opts: Object.entries(STATUS_PROJ).map(([k, v]) => [k, v[0]]) },
    { k: 'situacao', l: 'Situação', t: 'select', blank: false, opts: SITUACAO_PROJ },
    { k: 'fase', l: 'Fase atual' }, { k: 'placeholder', l: 'Dados ainda incompletos', t: 'check' },
    { t: 'sec', k: '_s2', l: 'Edital / contrato (parte UFSM)' },
    { k: 'financiador', l: 'Financiador / concedente' }, { k: 'fundacao_apoio', l: 'Fundação gestora (UFSM)' },
    { k: 'programa', l: 'Programa (ex.: Mover, Rota 2030)' }, { k: 'chamada', l: 'Chamada / edital' },
    { k: 'linha_tematica', l: 'Linha / área temática' }, { k: 'numero_contrato', l: 'Nº do convênio / contrato' },
    { k: 'data_assinatura', l: 'Data de assinatura', t: 'date' }, { k: '_sp', t: 'sec', l: '', hide: true },
    { k: 'valor_total', l: 'Aporte do financiador — parte UFSM (R$)', t: 'money', min: 0 },
    { k: 'contrapartida', l: 'Contrapartidas — parte UFSM (R$)', t: 'money', min: 0 },
    { k: 'inicio', l: 'Início da vigência', t: 'date', req: true },
    { k: 'fim', l: 'Término da vigência', t: 'date', req: true, help: p && Calc.aditivosDe(p.id).length ? 'Prorrogações: registre como aditivo (aba Contrato), não edite aqui.' : 'Prorrogações futuras: registre como aditivo (aba Contrato).' },
    { k: 'resumo', l: 'Resumo / objetivo', t: 'textarea', rows: 3 },
    { k: 'notas', l: 'Notas / alertas', t: 'textarea', rows: 2 }];
}
const fixProj = x => { if (x.valor_total == null) x.valor_total = 0; if (x.contrapartida == null) x.contrapartida = 0; return x; };
A.projNovo = (d, el, pre) => form({
  title: 'Novo projeto', fields: camposProjeto(null), values: pre || { tipo: UI.f.projTipo === 'servico' ? 'servico' : 'edital', status: 'pendente', situacao: 'vigente' }, wide: true,
  onSave: async x => { const p = await Data.insert('projetos', fixProj(x)); if (pre && pre._prospeccao) await Data.update('prospeccoes', pre._prospeccao, { situacao: 'promovida', projeto_id: p.id }); UI.projeto = p.id; UI.projAba = 'resumo'; UI.tab = 'projetos'; },
});
A.projEditar = d => { const p = byId('projetos', d.id); form({ title: 'Editar projeto — ' + p.sigla, fields: camposProjeto(p), values: p, wide: true, onSave: x => Data.update('projetos', p.id, fixProj(x)) }); };
A.projAba = d => { UI.projAba = d.v; render(); };

const ABAS_PROJ = [['resumo', 'Resumo'], ['contrato', 'Contrato e aditivos'], ['cronograma', 'Cronograma físico'], ['entregas', 'Entregas e prazos'], ['docs', 'Docs e pendências'], ['equipe', 'Equipe'], ['tarefas', 'Tarefas'], ['financeiro', 'Financeiro'], ['historico', 'Histórico']];
function projetoDetalhe(p) {
  const st = STATUS_PROJ[p.status] || STATUS_PROJ.pendente;
  const gere = Perm.gereProjeto(p.id), fin = Perm.veFin(p.id);
  const abas = ABAS_PROJ.filter(([k]) => (k !== 'financeiro' || fin) && (k !== 'historico' || Perm.tem('historico_ver')));
  let aba = UI.projAba || 'resumo'; if (!abas.some(a => a[0] === aba)) aba = 'resumo';
  const nEnt = Calc.entregasAbertas(p.id), nAtr = nEnt.filter(Calc.entregaAtrasada).length;
  const cont = {
    entregas: nAtr ? `<span class="nv-n bad" style="margin-left:5px">${nAtr}</span>` : nEnt.length ? `<span class="small muted"> (${nEnt.length})</span>` : '',
    contrato: Calc.aditivosDe(p.id).length ? `<span class="small muted"> (${Calc.aditivosDe(p.id).length} TA)</span>` : '',
    equipe: (() => { const t = Calc.equipePlano(p).tot; return t.posicoes ? (t.vagas ? `<span class="small muted"> (${t.ocupadas}/${t.posicoes})</span><span class="nv-n" style="margin-left:5px;background:var(--yellow-bg);color:var(--yellow-txt)" title="vagas abertas">${t.vagas}</span>` : `<span class="small muted"> (${t.ocupadas}/${t.posicoes})</span>`) : `<span class="small muted"> (${D.alocacoes.filter(a => a.projeto_id === p.id).length})</span>`; })(),
    tarefas: (() => { const n = D.tarefas.filter(t => t.projeto_id === p.id && Calc.atrasada(t)).length; return n ? `<span class="nv-n bad" style="margin-left:5px">${n}</span>` : ''; })(),
  };
  cont.docs = (() => { const ab = D.pendencias.filter(x => x.projeto_id === p.id && Calc.pendenciaAberta(x)), at = ab.filter(Calc.pendenciaAtrasada).length; return at ? `<span class="nv-n bad" style="margin-left:5px">${at}</span>` : ab.length ? `<span class="small muted"> (${ab.length})</span>` : ''; })();
  const crT = Calc.cronograma(p).tot;
  cont.cronograma = crT.atrasadas ? `<span class="nv-n bad" style="margin-left:5px">${crT.atrasadas}</span>` : crT.folhas ? `<span class="small muted"> (${crT.pct}%)</span>` : '';
  const corpo = { resumo: projResumo, contrato: projContrato, cronograma: projCronograma, entregas: projEntregas, docs: projDocs, equipe: projEquipe, tarefas: projTarefas, financeiro: projFinanceiro, historico: projHistorico }[aba](p);
  return `<div class="between mb"><div class="row"><button class="btn-s" data-a="projVoltar">← Projetos</button>
      <span class="title" style="font-size:18px">${esc(p.sigla)}</span>${badgeTipo(p)}${badge(st[0], st[1])}${Calc.vencido(p) ? badge('vigência vencida', 'b-red') : ''}${p.situacao !== 'vigente' ? badge(lbl(SITUACAO_PROJ, p.situacao), 'b-gray') : ''}</div>
    <div class="row">${gere && Calc.vencido(p) ? `<button data-a="projEncerrar" data-id="${p.id}">Marcar como encerrado</button>` : ''}
      ${gere ? `<button data-a="projEditar" data-id="${p.id}">✎ Editar dados</button>` : ''}
      ${Perm.dir() ? `<button class="btn-d" data-a="projExcluir" data-id="${p.id}">Excluir</button>` : ''}</div></div>
  <div class="small muted mb">${esc(p.nome || '')}</div>
  <div class="ptabs">${abas.map(([k, l]) => `<button class="ptab${aba === k ? ' on' : ''}" data-a="projAba" data-v="${k}">${l}${cont[k] || ''}</button>`).join('')}</div>
  ${corpo}`;
}
function linhaEntregaMini(e, comProj) {
  const atr = Calc.entregaAtrasada(e), dias = Math.round((toDate(e.prazo) - toDate(hoje())) / 864e5);
  return `<div class="between small mb"><span>${comProj ? `<b>${esc(siglaProjeto(e.projeto_id))}</b> · ` : ''}${esc(e.titulo)} ${badgeOf(ST_ENTREGA, e.status)}</span>
    <span style="${atr ? 'color:var(--red);font-weight:700' : dias <= 15 ? 'color:var(--yellow-txt);font-weight:600' : ''}">${fmtD(e.prazo)} · ${atr ? `atrasada ${-dias} dia(s)` : dias === 0 ? 'hoje' : `em ${dias} dia(s)`}</span></div>`;
}
function projResumo(p) {
  const fin = Perm.veFin(p.id) ? Calc.totaisOrc(p.id) : null;
  const vincs = Perm.veFin(p.id) ? D.vinculos_financeiros.filter(v => v.projeto_id === p.id) : [];
  const nDesp = D.despesas.filter(x => x.projeto_id === p.id).length;
  const coord = Calc.coordenadores(p.id).map(x => x.nome).join(', ');
  const vo = Calc.vigenciaOriginal(p);
  const ents = Calc.entregasAbertas(p.id).slice(0, 6);
  const tAtr = D.tarefas.filter(t => t.projeto_id === p.id && Calc.atrasada(t));
  const reservas = D.infra_reservas.filter(r => r.projeto_id === p.id && r.status !== 'cancelada' && r.fim >= new Date().toISOString()).sort(byName('inicio')).slice(0, 5);
  const prosp = D.prospeccoes.find(x => x.projeto_id === p.id);
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    <div class="card"><div class="kv">
        <span class="k">Financiador</span><span>${esc(p.financiador || '—')}</span>
        ${p.programa || p.chamada ? `<span class="k">Programa / chamada</span><span>${esc([p.programa, p.chamada].filter(Boolean).join(' · '))}</span>` : ''}
        <span class="k">Fundação gestora</span><span>${esc(p.fundacao_apoio || '—')}</span>
        <span class="k">Coordenação</span><span>${esc(coord || '—')}</span>
        <span class="k">Aporte (UFSM)</span><span>${fmtBRL(p.valor_total)}${num(p.contrapartida) ? ` + contrapartida ${fmtBRL(p.contrapartida)}` : ''}</span>
        <span class="k">Vigência</span><span>${fmtD(p.inicio)} → ${fmtD(p.fim)} (${monthsIncl(p.inicio, p.fim)} meses)${vo !== p.fim ? `<br><span class="small muted">original até ${fmtD(vo)} · prorrogado por aditivo</span>` : ''}</span>
        <span class="k">Fase</span><span>${esc(p.fase || '—')}</span>
        ${(() => { const t = Calc.equipePlano(p).tot; return t.posicoes ? `<span class="k">Equipe do plano</span><span><button class="link" style="font-weight:400" data-a="projAba" data-v="equipe">${t.ocupadas} de ${t.posicoes} posições ocupadas${t.vagas ? ` · <b style="color:var(--yellow-txt)">${t.vagas} vaga(s) aberta(s)</b>` : ''}${t.selecao ? ` · ${t.selecao} em seleção` : ''}</button></span>` : ''; })()}
        ${(() => { const t = Calc.cronograma(p).tot; return t.folhas ? `<span class="k">Avanço físico</span><span><button class="link" style="font-weight:400" data-a="projAba" data-v="cronograma">${barraAvanco(t.pct, t.prev)} <span class="small muted">previsto ${t.prev}%${t.atrasadas ? ` · <b style="color:var(--red)">${t.atrasadas} atrasada(s)</b>` : ''}</span></button></span>` : ''; })()}
        ${prosp ? `<span class="k">Origem</span><span>Prospecção “${esc(prosp.nome)}”</span>` : ''}</div>
      ${p.notas ? `<div class="note mt">${esc(p.notas)}</div>` : ''}</div>
    ${fin ? `<div class="card"><div class="between mb"><span class="bold">Financeiro</span><span class="row"><button class="btn-s" data-a="despVer" data-projeto="${p.id}">despesas (${nDesp})</button>${Perm.editaFin(p.id) ? `<button class="btn-s btn-p" data-a="despNova" data-projeto="${p.id}">+ lançar gasto</button>` : ''}</span></div>
      <div class="kv"><span class="k">Aprovado</span><span>${fmtBRL(fin.aprovado)}</span><span class="k">Previsto</span><span>${fmtBRL(fin.previsto)}</span>
      <span class="k">Executado</span><span>${fmtBRL(fin.executado)} ${fin.aprovado ? barraExec(fin.executado, fin.aprovado) : ''}</span><span class="k">Saldo</span><span style="font-weight:700;color:${fin.saldo < 0 ? 'var(--red)' : 'var(--green-txt)'}">${fmtBRL(fin.saldo)}</span>
      <span class="k">Bolsas/pagamentos</span><span>${vincs.length} vínculo(s) · ${fmtBRL(vincs.filter(v => v.status === 'ativo').reduce((s, v) => s + num(v.valor_mensal), 0))}/mês ativos</span></div></div>` : ''}
    <div class="card"><div class="between mb"><span class="bold">Próximas entregas</span><button class="btn-s" data-a="projAba" data-v="entregas">ver todas →</button></div>
      ${ents.length ? ents.map(e => linhaEntregaMini(e)).join('') : '<div class="empty" style="padding:4px 0">Nenhuma entrega em aberto.</div>'}</div>
    ${tAtr.length ? `<div class="card"><div class="between mb"><span class="bold" style="color:var(--red)">Tarefas atrasadas (${tAtr.length})</span><button class="btn-s" data-a="projAba" data-v="tarefas">ver →</button></div>${listaTarefas(tAtr, { proj: false })}</div>` : ''}
    ${reservas.length ? `<div class="card"><div class="bold mb">Próximas reservas de infraestrutura</div>${reservas.map(r => `<div class="small mb">${fmtDT(r.inicio)} · <b>${esc((byId('infra_itens', r.item_id) || {}).nome || '')}</b> ${badgeOf(ST_RES, r.status)}</div>`).join('')}</div>` : ''}
  </div>`;
}
function projContrato(p) {
  const gere = Perm.gereProjeto(p.id), ads = Calc.aditivosDe(p.id);
  const vo = Calc.vigenciaOriginal(p), vl = Calc.valorOriginal(p);
  const kv = (k, v) => `<span class="k">${k}</span><span>${v}</span>`;
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr))">
    <div class="card"><div class="between mb"><span class="bold">Edital e contrato — parte UFSM</span>${gere ? `<button class="btn-s" data-a="projEditar" data-id="${p.id}">✎ editar</button>` : ''}</div>
      <div class="kv">${kv('Tipo', esc(lbl(TIPOS_PROJ, p.tipo || 'edital')))}${kv('Financiador', esc(p.financiador || '—'))}${kv('Programa', esc(p.programa || '—'))}${kv('Chamada / edital', esc(p.chamada || '—'))}
        ${kv('Linha / área temática', esc(p.linha_tematica || '—'))}${kv('Nº convênio / contrato', esc(p.numero_contrato || '—'))}${kv('Assinatura', fmtD(p.data_assinatura))}${kv('Fundação gestora', esc(p.fundacao_apoio || '—'))}</div></div>
    <div class="card"><div class="bold mb">Valores e vigência</div>
      <div class="kv">${kv('Aporte (UFSM)', fmtBRL2(p.valor_total) + (vl !== num(p.valor_total) ? ` <span class="small muted">(original ${fmtBRL2(vl)})</span>` : ''))}${kv('Contrapartidas (UFSM)', fmtBRL2(p.contrapartida))}
        ${kv('Valor global (UFSM)', `<b>${fmtBRL2(num(p.valor_total) + num(p.contrapartida))}</b>`)}
        ${kv('Vigência atual', `${fmtD(p.inicio)} → ${fmtD(p.fim)} (${monthsIncl(p.inicio, p.fim)} meses)`)}
        ${vo !== p.fim ? kv('Vigência original', `${fmtD(p.inicio)} → ${fmtD(vo)} (${monthsIncl(p.inicio, vo)} meses)`) : ''}
        ${kv('Tempo decorrido', (() => { const tot = toDate(p.fim) - toDate(p.inicio), dec = Math.min(Math.max(toDate(hoje()) - toDate(p.inicio), 0), tot); return tot > 0 ? `${barraExec(dec, tot).replace(/executado/, 'do prazo')} ` : '—'; })())}</div></div>
  </div>
  ${p.resumo ? `<div class="card mt"><div class="bold mb">Resumo / objetivo</div><div class="small" style="white-space:pre-line">${esc(p.resumo)}</div></div>` : ''}
  <div class="sec between"><span>Termos aditivos (${ads.length})</span>${gere ? `<button class="btn-s btn-p" data-a="aditivoNovo" data-projeto="${p.id}">+ Registrar aditivo</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${ads.length ? `<table class="t"><tr><th>Aditivo</th><th>Tipo</th><th>Assinatura</th><th>Vigência</th><th class="num">Valor</th><th>Justificativa</th><th>Documento</th></tr>
    ${ads.map(a => `<tr class="${gere ? 'click' : ''}" ${gere ? `data-a="aditivoEditar" data-id="${a.id}"` : ''}><td><b>${esc(a.numero || '—')}</b></td><td class="small">${esc(lbl(TIPOS_ADITIVO, a.tipo))}</td><td class="small">${fmtD(a.data_assinatura)}</td>
      <td class="small">${a.novo_fim ? `${fmtD(a.fim_anterior)} → <b>${fmtD(a.novo_fim)}</b>` : '—'}</td><td class="num small">${a.novo_valor != null && a.novo_valor !== '' ? `${fmtBRL(a.valor_anterior)} → <b>${fmtBRL(a.novo_valor)}</b>` : '—'}</td>
      <td class="small">${esc(a.justificativa || '')}</td><td class="small">${linkOuTexto(a.documento)}</td></tr>`).join('')}</table>` : '<div class="empty">Nenhum aditivo registrado.</div>'}</div>
  <div class="small muted mt">Ao registrar um aditivo, o término e/ou o valor do projeto são atualizados e os anteriores ficam guardados aqui. Excluir o aditivo desfaz a alteração.</div>`;
}
const linkOuTexto = s => !s ? '' : /^https?:\/\//i.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener">abrir ↗</a>` : esc(s);
function camposAditivo(p, a) {
  const n = Calc.aditivosDe(p.id).length + (a ? 0 : 1);
  return [{ k: 'numero', l: 'Identificação', ph: `${n}º Termo Aditivo` },
  { k: 'tipo', l: 'Tipo', t: 'select', blank: false, req: true, opts: TIPOS_ADITIVO, ro: !!a },
  { k: 'data_assinatura', l: 'Data de assinatura', t: 'date' },
  { k: 'novo_fim', l: `Novo término (atual: ${fmtD(p.fim)})`, t: 'date', ro: !!a },
  { k: 'novo_valor', l: `Novo valor do aporte UFSM (atual: ${fmtBRL(p.valor_total)})`, t: 'money', min: 0, ro: !!a },
  { k: 'documento', l: 'Documento (nº do processo ou link)' },
  { k: 'justificativa', l: 'Justificativa', t: 'textarea', rows: 3 }];
}
A.aditivoNovo = d => { const p = byId('projetos', d.projeto); const n = Calc.aditivosDe(p.id).length + 1;
  form({ title: 'Registrar aditivo — ' + p.sigla, fields: camposAditivo(p, null), values: { numero: `${n}º Termo Aditivo`, tipo: 'prazo' },
    intro: '<div class="note mb small">O novo término e/ou o novo valor passam a valer no projeto ao salvar. Deixe em branco o que não mudou.</div>',
    onSave: x => Data.insert('aditivos', { ...x, projeto_id: p.id }), okMsg: '✓ Aditivo registrado — vigência/valor do projeto atualizados' }); };
A.aditivoEditar = d => { const a = byId('aditivos', d.id), p = byId('projetos', a.projeto_id);
  form({ title: (a.numero || 'Aditivo') + ' — ' + p.sigla, fields: camposAditivo(p, a), values: a,
    intro: '<div class="note mb small">Tipo, novo término e novo valor não se editam: para corrigir, exclua o aditivo (a alteração no projeto é desfeita) e registre de novo.</div>',
    onSave: x => { ['tipo', 'novo_fim', 'novo_valor'].forEach(k => delete x[k]); return Data.update('aditivos', a.id, x); },
    onDelete: () => Data.remove('aditivos', a.id), deleteConfirm: `Excluir ${a.numero || 'o aditivo'}?\nSe o projeto ainda estiver com o término/valor deste aditivo, eles voltam para ${a.novo_fim ? fmtD(a.fim_anterior) : ''}${a.novo_fim && a.novo_valor != null ? ' e ' : ''}${a.novo_valor != null && a.novo_valor !== '' ? fmtBRL(a.valor_anterior) : ''}.` }); };

/* entregas e prazos do projeto */
function tabelaEntregas(list, o = {}) {
  if (!list.length) return `<div class="empty">${o.vazio || 'Nenhuma entrega cadastrada.'}</div>`;
  return `<table class="t"><tr><th>Prazo</th>${o.proj ? '<th>Projeto</th>' : ''}<th>Entrega</th><th>Tipo</th><th>Responsável</th><th>Situação</th><th>Entregue em</th><th>Documento</th></tr>
  ${list.map(e => { const atr = Calc.entregaAtrasada(e), dias = Math.round((toDate(e.prazo) - toDate(hoje())) / 864e5), pode = Perm.editaEntrega(e);
    return `<tr class="${pode ? 'click' : ''}" ${pode ? `data-a="entregaEditar" data-id="${e.id}"` : ''} style="${Calc.entregaAberta(e) ? '' : 'opacity:.65'}">
      <td style="white-space:nowrap;${atr ? 'color:var(--red);font-weight:700' : Calc.entregaAberta(e) && dias <= 15 ? 'color:var(--yellow-txt);font-weight:600' : ''}">${fmtD(e.prazo)}${Calc.entregaAberta(e) ? `<div class="small">${atr ? `atrasada ${-dias}d` : dias === 0 ? 'hoje' : `em ${dias}d`}</div>` : ''}</td>
      ${o.proj ? `<td><button class="link" data-a="projAbrir" data-id="${e.projeto_id}" data-aba="entregas">${esc(siglaProjeto(e.projeto_id))}</button></td>` : ''}
      <td><b>${esc(e.titulo)}</b>${e.obs ? `<div class="small muted">${esc(e.obs)}</div>` : ''}</td><td class="small">${esc(lbl(TIPOS_ENTREGA, e.tipo))}</td>
      <td class="small">${esc(e.responsavel_id ? nomePessoa(e.responsavel_id) : '—')}</td><td>${badgeOf(ST_ENTREGA, e.status)}</td><td class="small">${fmtD(e.data_entrega)}</td><td class="small">${linkOuTexto(e.documento)}</td></tr>`; }).join('')}</table>`;
}
function projEntregas(p) {
  const gere = Perm.gereProjeto(p.id), fs = UI.f.entProjSt || 'todas';
  const list = D.entregas.filter(e => e.projeto_id === p.id && (fs === 'todas' || (fs === 'abertas' ? Calc.entregaAberta(e) : !Calc.entregaAberta(e)))).sort(byName('prazo'));
  return `<div class="toolbar"><select data-f="entProjSt" style="width:auto">${[['todas', 'Todas'], ['abertas', 'Em aberto'], ['concluidas', 'Entregues / aprovadas / dispensadas']].map(([v, l]) => `<option value="${v}"${fs === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${gere ? `<div class="row"><button data-a="entregaSerie" data-projeto="${p.id}">Gerar série de relatórios…</button><button class="btn-p" data-a="entregaNova" data-projeto="${p.id}">+ Entrega / prazo</button></div>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${tabelaEntregas(list, { vazio: gere ? 'Nenhuma entrega cadastrada. Use “Gerar série de relatórios…” para criar os relatórios periódicos e a prestação de contas final de uma vez.' : 'Nenhuma entrega cadastrada.' })}</div>`;
}
function camposEntrega(p, e) {
  const gere = Perm.gereProjeto(p.id);
  return [{ k: 'titulo', l: 'Entrega', req: true, full: true, ro: !gere, ph: 'Ex.: 1º Relatório técnico parcial' },
  { k: 'tipo', l: 'Tipo', t: 'select', blank: false, opts: TIPOS_ENTREGA, ro: !gere }, { k: 'prazo', l: 'Prazo', t: 'date', req: true, ro: !gere },
  { k: 'responsavel_id', l: 'Responsável', t: 'select', opts: optPessoas(), ro: !gere },
  { k: 'status', l: 'Situação', t: 'select', blank: false, opts: Object.entries(ST_ENTREGA).map(([k, v]) => [k, v[0]]) },
  { k: 'data_entrega', l: 'Entregue em', t: 'date', help: 'Preenchida automaticamente ao marcar como entregue' },
  { k: 'documento', l: 'Protocolo ou link do documento' }, { k: 'obs', l: 'Observações', t: 'textarea', rows: 2 }];
}
A.entregaNova = d => { const p = byId('projetos', d.projeto);
  form({ title: 'Nova entrega / prazo — ' + p.sigla, fields: camposEntrega(p, null), values: { tipo: 'relatorio_parcial', status: 'pendente', responsavel_id: (Calc.coordenadores(p.id)[0] || {}).id || null },
    onSave: x => Data.insert('entregas', { ...x, projeto_id: p.id }) }); };
A.entregaEditar = d => { const e = byId('entregas', d.id), p = byId('projetos', e.projeto_id);
  form({ title: e.titulo + ' — ' + p.sigla, fields: camposEntrega(p, e), values: e,
    onSave: x => Data.update('entregas', e.id, x), onDelete: Perm.gereProjeto(p.id) ? () => Data.remove('entregas', e.id) : null, deleteConfirm: `Excluir a entrega "${e.titulo}"?` }); };
A.entregaSerie = d => { const p = byId('projetos', d.projeto);
  form({ title: 'Gerar série de entregas — ' + p.sigla, intro: `<div class="note mb small">Cria de uma vez os relatórios periódicos até o fim da vigência (${fmtD(p.fim)}) e, se marcado, o relatório final e a prestação de contas final. Depois é possível ajustar cada uma.</div>`,
    fields: [{ k: 'tipo', l: 'Tipo dos periódicos', t: 'select', blank: false, opts: TIPOS_ENTREGA.filter(t => ['relatorio_parcial', 'prestacao_parcial', 'reuniao', 'marco'].includes(t[0])) },
      { k: 'base', l: 'Título base', req: true }, { k: 'meses', l: 'A cada quantos meses', t: 'number', min: 1, max: 24, req: true },
      { k: 'primeiro', l: 'Prazo do primeiro', t: 'date', req: true }, { k: 'responsavel_id', l: 'Responsável', t: 'select', opts: optPessoas() },
      { k: 'finais', l: 'Incluir relatório final e prestação de contas final', t: 'check' }, { k: 'dias_final', l: 'Dias após o término para os finais', t: 'number', min: 0, max: 365 }],
    values: { tipo: 'relatorio_parcial', base: 'Relatório técnico parcial', meses: 6, primeiro: (() => { const x = toDate(p.inicio); x.setMonth(x.getMonth() + 6); return isoOf(x); })(), responsavel_id: (Calc.coordenadores(p.id)[0] || {}).id || null, finais: true, dias_final: 60 },
    onSave: async x => {
      const datas = []; let dt = toDate(x.primeiro);
      while (isoOf(dt) <= p.fim && datas.length < 60) { datas.push(isoOf(dt)); dt = new Date(dt.getFullYear(), dt.getMonth() + num(x.meses), dt.getDate()); }
      const ja = t => D.entregas.some(e => e.projeto_id === p.id && norm(e.titulo) === norm(t));
      let n = 0;
      for (let i = 0; i < datas.length; i++) { const t = `${i + 1}º ${x.base}`; if (ja(t)) continue; await Data.insert('entregas', { projeto_id: p.id, tipo: x.tipo, titulo: t, prazo: datas[i], responsavel_id: x.responsavel_id }); n++; }
      if (x.finais) { const pf = addDays(p.fim, num(x.dias_final));
        for (const [tp, t] of [['relatorio_final', 'Relatório técnico final'], ['prestacao_final', 'Prestação de contas final']]) if (!ja(t)) { await Data.insert('entregas', { projeto_id: p.id, tipo: tp, titulo: t, prazo: pf, responsavel_id: x.responsavel_id }); n++; } }
      if (!n) falha('Nenhuma entrega nova: as datas não cabem na vigência ou as entregas já existem.');
      UI.projAba = 'entregas'; setTimeout(() => flash(`✓ ${n} entrega(s) criada(s)`), 30);
    }, okMsg: false }); };
/* ── cronograma físico ─────────────────────────────────────────── */
UI.cronFech = {};
function barraAvanco(pct, prev) {
  const p = Math.max(0, Math.min(100, num(pct))), atras = prev != null && p + 10 < prev;
  return `<span class="pbar" style="width:90px;position:relative" title="Realizado ${p}%${prev != null ? ` · previsto para hoje ${prev}%` : ''}"><span style="width:${p}%;background:${p >= 100 ? 'var(--green)' : atras ? 'var(--red)' : 'var(--blue)'}"></span>${prev != null && prev > 0 && prev < 100 ? `<i style="position:absolute;top:-2px;bottom:-2px;left:${prev}%;width:2px;background:#1c1c1a;opacity:.55"></i>` : ''}</span><span class="small" style="font-variant-numeric:tabular-nums">${p}%</span>`;
}
function projCronograma(p) {
  const { rows, tot } = Calc.cronograma(p), gere = Perm.gereProjeto(p.id);
  const fs = UI.f.crFiltro || 'todas', vis = UI.sub.crono || 'tabela';
  const fech = UI.cronFech[p.id] || new Set();
  const durProj = monthsIncl(p.inicio, p.fim);
  const passa = r => fs === 'todas' ? true : !r.folha ? false : fs === 'atual' ? (r.ini != null && r.ini <= tot.mesAtual && tot.mesAtual <= r.fim && r.c.status !== 'concluida') : fs === 'atrasadas' ? r.atras || r.naoIni : r.c.status === 'concluida';
  let mostrar;
  if (fs === 'todas') { const esc_ = []; mostrar = rows.filter(r => { if (esc_.some(pre => r.c.codigo.startsWith(pre + '.'))) return false; if (!r.folha && fech.has(r.c.codigo)) esc_.push(r.c.codigo); return true; }); }
  else { const folhas = rows.filter(passa); const cods = new Set(); folhas.forEach(r => { const seg = r.c.codigo.split('.'); for (let i = 1; i <= seg.length; i++) cods.add(seg.slice(0, i).join('.')); }); mostrar = rows.filter(r => cods.has(r.c.codigo)); }
  const mets = [['Avanço físico realizado', tot.pct + '%', tot.pct + 10 < tot.prev ? 'color:var(--red)' : ''], ['Previsto para hoje', tot.prev + '%'], ['Mês atual do projeto', tot.mesAtual < 1 ? 'não iniciado' : tot.mesAtual > durProj ? 'encerrado' : `${tot.mesAtual} de ${durProj}`],
    ['Atividades', `${tot.concluidas} / ${tot.folhas} concluídas`], ['Atrasadas', tot.atrasadas, tot.atrasadas ? 'color:var(--red)' : '']];
  const head = `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:18px;${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row">
      <select data-f="crFiltro" style="width:auto">${[['todas', 'Todas as atividades'], ['atual', 'Previstas para o mês atual'], ['atrasadas', 'Atrasadas / não iniciadas'], ['concluidas', 'Concluídas']].map(([v, l]) => `<option value="${v}"${fs === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <button class="chip${vis === 'tabela' ? ' on' : ''}" data-a="sub" data-g="crono" data-v="tabela">Tabela</button><button class="chip${vis === 'gantt' ? ' on' : ''}" data-a="sub" data-g="crono" data-v="gantt">Gantt</button>
      ${fs === 'todas' && rows.some(r => !r.folha) ? `<button class="btn-s" data-a="cronTodos" data-projeto="${p.id}" data-v="${fech.size ? 'abrir' : 'fechar'}">${fech.size ? 'Expandir tudo' : 'Recolher etapas'}</button>` : ''}</div>
    ${gere ? `<div class="row"><button data-a="importarPlanilha" data-projeto="${p.id}">Importar da planilha do edital…</button><button class="btn-p" data-a="atividadeNova" data-projeto="${p.id}">+ Atividade</button></div>` : ''}</div>`;
  if (!rows.length) return head + `<div class="empty">Nenhuma atividade no cronograma. ${gere ? 'Importe o cronograma da planilha do edital ou cadastre as metas, etapas e atividades.' : ''}</div>`;
  const legenda = `<div class="small muted mt">Meses contados a partir do início do projeto (mês 1 = ${fmtMes(p.inicio)}). Barra: realizado; traço: previsto para hoje. Grupos somam as atividades ponderando pela duração.</div>`;
  if (vis === 'gantt') return head + ganttCronograma(p, mostrar, tot) + legenda;
  return head + `<div class="card tw" style="padding:4px 8px"><table class="t orc"><tr><th>Código</th><th>Atividade</th><th>Meses</th><th>Período</th><th>Responsável</th><th>Andamento</th><th>Situação</th></tr>
    ${mostrar.map(r => {
      const c = r.c, pode = r.folha ? (gere || (Perm.podeEditar() && c.responsavel_id === ME.pessoa_id)) : gere;
      const aberto = !fech.has(c.codigo);
      const sit = r.folha ? (r.atras ? badge('atrasada', 'b-red') : r.naoIni ? badge('deveria ter iniciado', 'b-yellow') : badgeOf(ST_CRONO, c.status)) : (r.nAtras ? badge(r.nAtras + ' atrasada(s)', 'b-red') : '');
      const nT = r.folha ? D.tarefas.filter(t => t.atividade_id === c.id).length : 0;
      return `<tr class="${r.folha ? '' : (r.nivel === 0 ? 'grp grp0' : 'grp')}${pode ? ' click' : ''}" ${pode ? `data-a="atividadeEditar" data-id="${c.id}"` : ''}>
        <td class="cod">${!r.folha && fs === 'todas' ? `<span class="crtg" data-a="cronToggle" data-projeto="${p.id}" data-cod="${c.codigo}" title="${aberto ? 'recolher' : 'expandir'}">${aberto ? '▾' : '▸'}</span> ` : ''}${esc(c.codigo)}</td>
        <td style="padding-left:${8 + r.nivel * 16}px">${esc(c.titulo)}${r.folha && c.entrega ? `<div class="small muted">↳ ${esc(c.entrega.length > 110 ? c.entrega.slice(0, 108) + '…' : c.entrega)}</div>` : ''}${nT ? ` <span class="b b-gray" title="tarefas ligadas">${nT} tarefa(s)</span>` : ''}${!r.folha ? ` <span class="small muted">(${r.n})</span>` : ''}</td>
        <td class="small" style="white-space:nowrap">${r.ini != null ? `${r.ini}–${r.fim ?? '?'}` : '—'}</td>
        <td class="small" style="white-space:nowrap">${r.ini != null ? `${fmtMes(Calc.mesData(p, r.ini))} → ${r.fim != null ? fmtMes(Calc.mesData(p, r.fim)) : '?'}` : ''}</td>
        <td class="small">${esc(c.responsavel_id ? nomePessoa(c.responsavel_id) : (c.responsavel_texto || ''))}</td>
        <td style="white-space:nowrap">${r.pct != null ? barraAvanco(r.pct, r.prev) : '—'}</td><td>${sit}</td></tr>`;
    }).join('')}</table></div>` + legenda;
}
function ganttCronograma(p, rows, tot) {
  const N = Math.max(monthsIncl(p.inicio, p.fim), ...rows.map(r => r.fim || 0), 1);
  const LW = 300, per = Math.max(10, Math.min(28, 900 / N)), rowH = 21, headH = 30, W = LW + N * per + 10, H = headH + rows.length * rowH + 8;
  const x = m => LW + (m - 1) * per;
  const o = [`<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%;height:auto;font-family:'Segoe UI',sans-serif">`];
  for (let m = 1; m <= N; m++) {
    const d = toDate(Calc.mesData(p, m)); const jan = d.getMonth() === 0 || m === 1;
    o.push(`<line x1="${x(m)}" y1="${headH - 6}" x2="${x(m)}" y2="${H}" stroke="${jan ? '#d6d3cc' : '#f0eee9'}"/>`);
    if (jan) o.push(`<text x="${x(m) + 3}" y="11" fill="#7a7975" font-size="10" font-weight="600">${d.getFullYear()}</text>`);
    if (N <= 60 || m % 3 === 1) o.push(`<text x="${x(m) + per / 2}" y="${headH - 9}" fill="#9b9b98" font-size="8.5" text-anchor="middle">${m}</text>`);
  }
  if (tot.mesAtual >= 1 && tot.mesAtual <= N) { const dia = toDate(hoje()).getDate() / 31; const tx = x(tot.mesAtual) + dia * per; o.push(`<line x1="${tx}" y1="${headH - 6}" x2="${tx}" y2="${H}" stroke="#c43030" stroke-dasharray="3 3"/><text x="${tx + 2}" y="${H - 2}" fill="#c43030" font-size="9">hoje</text>`); }
  rows.forEach((r, i) => {
    const y = headH + i * rowH + 3, c = r.c;
    const lab = `${c.codigo} ${c.titulo}`;
    o.push(`<text x="${4 + r.nivel * 10}" y="${y + 11}" fill="${r.folha ? '#444' : '#1c1c1a'}" font-size="10.5" font-weight="${r.folha ? 400 : 700}">${esc(lab.length > 44 - r.nivel * 2 ? lab.slice(0, 43 - r.nivel * 2) + '…' : lab)}<title>${esc(lab)}</title></text>`);
    if (r.ini == null || r.fim == null) return;
    const bx = x(r.ini), bw = (r.fim - r.ini + 1) * per;
    if (!r.folha) { o.push(`<rect x="${bx}" y="${y + 3}" width="${bw}" height="7" fill="#3d4450" rx="2"/><rect x="${bx}" y="${y + 3}" width="${bw * num(r.pct) / 100}" height="7" fill="#5b9be8" rx="2"/>`); return; }
    const cor = c.status === 'cancelada' ? '#e3e0da' : r.atras ? '#f3c1b9' : '#cfe0f5';
    o.push(`<rect x="${bx}" y="${y}" width="${bw}" height="13" rx="3" fill="${cor}" stroke="${r.atras ? '#c43030' : '#a9caed'}"><title>${esc(lab)} — meses ${r.ini}–${r.fim} · ${r.pct}%</title></rect>`);
    if (r.pct) o.push(`<rect x="${bx}" y="${y}" width="${bw * r.pct / 100}" height="13" rx="3" fill="${r.pct >= 100 ? '#3b6d11' : '#1a5ca8'}" opacity=".85"/>`);
  });
  o.push('</svg>');
  return `<div class="card" style="padding:8px;overflow-x:auto">${o.join('')}</div>`;
}
A.cronToggle = d => { const s = UI.cronFech[d.projeto] || (UI.cronFech[d.projeto] = new Set()); s.has(d.cod) ? s.delete(d.cod) : s.add(d.cod); render(); };
A.cronTodos = d => { if (d.v === 'abrir') UI.cronFech[d.projeto] = new Set(); else UI.cronFech[d.projeto] = new Set(Calc.cronograma(byId('projetos', d.projeto)).rows.filter(r => !r.folha && r.nivel >= 1).map(r => r.c.codigo)); render(); };
function camposAtividade(p, c) {
  const gere = Perm.gereProjeto(p.id);
  const grupo = c && D.cronograma.some(x => x.projeto_id === p.id && x.codigo.startsWith(c.codigo + '.'));
  const N = monthsIncl(p.inicio, p.fim);
  return [{ k: 'codigo', l: 'Código (ex.: 2.5.1)', req: true, ro: !gere }, { k: 'titulo', l: 'Título', req: true, ro: !gere, full: true },
  { k: 'descricao', l: 'Descrição', t: 'textarea', rows: 2, ro: !gere },
  { k: 'mes_inicio', l: `Mês de início (1 a ${N})`, t: 'number', min: 1, ro: !gere, hide: grupo, help: `Mês 1 = ${fmtMes(p.inicio)}` },
  { k: 'mes_fim', l: 'Mês de término', t: 'number', min: 1, ro: !gere, hide: grupo },
  { k: 'entrega', l: 'Entrega prevista / resultado', t: 'textarea', rows: 2, ro: !gere, hide: grupo },
  { k: 'validador', l: 'Validador da entrega', ro: !gere, hide: grupo, full: true },
  { k: 'responsavel_id', l: 'Responsável (cadastro)', t: 'select', opts: optPessoas(), ro: !gere, hide: grupo },
  { k: 'responsavel_texto', l: 'Responsável como consta no plano', ro: !gere, hide: grupo },
  { k: 'percentual', l: 'Andamento (%)', t: 'number', min: 0, max: 100, step: 5, hide: grupo },
  { k: 'status', l: 'Situação', t: 'select', blank: false, opts: Object.entries(ST_CRONO).map(([k, v]) => [k, v[0]]), hide: grupo },
  { k: 'evidencia', l: 'Evidência (documento ou link)', hide: grupo }, { k: 'obs', l: 'Observações', t: 'textarea', rows: 2, hide: grupo }];
}
const fixAtiv = x => { ['mes_inicio', 'mes_fim', 'percentual'].forEach(k => { if (x[k] != null) x[k] = Math.round(x[k]); }); if (x.percentual == null && 'percentual' in x) x.percentual = 0; return x; };
A.atividadeNova = d => { const p = byId('projetos', d.projeto);
  form({ title: 'Nova meta / etapa / atividade — ' + p.sigla, fields: camposAtividade(p, null), values: { status: 'planejada', percentual: 0 }, wide: true,
    intro: '<div class="note mb small">A hierarquia vem do código: “2” é uma meta/plataforma, “2.5” uma etapa dentro dela e “2.5.1” uma atividade da etapa. Meses e andamento dos grupos são calculados a partir das atividades.</div>',
    onSave: x => Data.insert('cronograma', fixAtiv({ ...x, projeto_id: p.id })) }); };
A.atividadeEditar = d => { const c = byId('cronograma', d.id), p = byId('projetos', c.projeto_id), gere = Perm.gereProjeto(p.id);
  const ts = D.tarefas.filter(t => t.atividade_id === c.id);
  form({ title: `${c.codigo} — ${p.sigla}`, fields: camposAtividade(p, c), values: c, wide: true,
    intro: c.mes_inicio ? `<div class="small muted mb">Período: ${fmtD(Calc.mesData(p, c.mes_inicio))} a ${c.mes_fim ? fmtD(Calc.mesDataFim(p, c.mes_fim)) : '?'}${c.data_conclusao ? ` · concluída em ${fmtD(c.data_conclusao)}` : ''}</div>` : '',
    after: ts.length ? `<div class="sec">Tarefas ligadas (${ts.length})</div>${listaTarefas(ts, { proj: false })}` : '',
    onSave: x => Data.update('cronograma', c.id, fixAtiv(x)),
    onDelete: gere ? async () => { const sub = D.cronograma.filter(y => y.projeto_id === p.id && y.codigo.startsWith(c.codigo + '.')); for (const y of sub) await Data.remove('cronograma', y.id); await Data.remove('cronograma', c.id); } : null,
    deleteConfirm: `Excluir ${c.codigo} — ${c.titulo}${D.cronograma.some(y => y.projeto_id === p.id && y.codigo.startsWith(c.codigo + '.')) ? '\ne todas as etapas/atividades dentro dele' : ''}?` }); };

/* ── Equipe do projeto: posições do plano de trabalho (formato do edital) + alocações ── */
const etapasTopo = cods => { const s = new Set(cods || []); return [...s].filter(c => { const seg = c.split('.'); for (let i = 1; i < seg.length; i++) if (s.has(seg.slice(0, i).join('.'))) return false; return true; }).sort(Calc.codCmp); };
function chipsEtapas(p, cods) {
  const top = etapasTopo(cods); if (!top.length) return '<span class="faint">—</span>';
  const nome = c => (D.cronograma.find(x => x.projeto_id === p.id && x.codigo === c) || {}).titulo || '';
  const tit = top.map(c => c + ' ' + nome(c)).join('\n');
  return `<span title="${esc(tit)}">${top.slice(0, 4).map(c => `<span class="badge b-gray" style="margin:0 3px 3px 0;display:inline-block">${esc(c)}</span>`).join('')}${top.length > 4 ? ` <span class="small muted">+${top.length - 4}</span>` : ''}</span>`;
}
function projEquipe(p) {
  const EP = Calc.equipePlano(p), gere = Perm.gereAlocacao(p.id), fin = Perm.veFin(p.id), efin = Perm.editaFin(p.id), t = EP.tot;
  const alocs = D.alocacoes.filter(a => a.projeto_id === p.id).sort((a, b) => (b.coordena - a.coordena) || (b.nivel - a.nivel));
  const foraIds = new Set(EP.fora.map(a => a.id));
  let conf = '';
  if (fin && t.bolsas) {
    const apr = c => num(Calc.valoresRubrica(p.id, c).aprovado);
    const difs = Object.entries(t.porRubrica).filter(([c, v]) => Math.abs(v - apr(c)) > 0.5);
    conf = difs.length ? `<div class="note small mb">⚠ Bolsas previstas no plano × orçamento aprovado: ${difs.map(([c, v]) => `rubrica <b>${c}</b> — plano ${fmtBRL2(v)} · aprovado ${fmtBRL2(apr(c))}`).join('; ')}.</div>` : '';
  }
  const mets = [['Posições no plano', t.posicoes], ['Ocupadas', t.ocupadas], ['Vagas abertas', t.vagas, t.vagas ? 'color:var(--yellow-txt)' : ''], ['Em seleção', t.selecao]];
  if (fin && t.bolsas) mets.push(['Bolsas do plano', fmtBRL(t.bolsas)]);
  const linhas = EP.rows.map((r, i) => {
    const e = r.e, st = ST_VAGA[e.status] || [e.status, 'b-gray'];
    const ocup = r.pessoa ? `<b>${esc(r.pessoa.nome)}</b>${e.desde ? `<div class="small muted">desde ${fmtD(e.desde)}</div>` : ''}` : `<span class="small faint">${e.status === 'vaga' ? 'a contratar' : e.status === 'selecao' ? 'processo seletivo' : '—'}</span>`;
    const bol = !fin ? '' : `<td class="small">${r.bolsa ? `${esc(r.bolsa.modalidade || '')}<div><b>${fmtBRL(r.bolsa.valor_mensal)}</b>/mês × ${r.bolsa.meses}</div><div class="${r.mesesRest ? 'muted' : 'faint'}">${r.mesesVinc ? `${r.mesesVinc} mês(es) em bolsas · ` : ''}${r.mesesRest} restante(s)</div>` : '<span class="faint">—</span>'}</td>`;
    const acoes = [];
    if (gere && ['vaga', 'selecao'].includes(e.status)) acoes.push(`<button class="btn-s" data-a="vagaPreencher" data-id="${e.id}">Preencher</button>`);
    if (gere && e.status === 'ocupada') acoes.push(`<button class="btn-s" data-a="vagaLiberar" data-id="${e.id}">Liberar</button>`);
    if (efin && e.status === 'ocupada' && r.bolsa && r.mesesRest > 0 && !r.vAtual) acoes.push(`<button class="btn-s" data-a="vagaBolsa" data-id="${e.id}">Gerar bolsa</button>`);
    if (fin && r.vAtual) acoes.push(`<span class="small">${badge('bolsa ' + (ST_VINC[r.vAtual.status] || [r.vAtual.status])[0].toLowerCase(), ST_VINC[r.vAtual.status] ? ST_VINC[r.vAtual.status][1] : 'b-gray')}</span>`);
    return `<tr class="${gere || efin ? 'click' : ''}${['encerrada', 'cancelada'].includes(e.status) ? ' faint' : ''}" ${gere || efin ? `data-a="vagaEditar" data-id="${e.id}"` : ''}>
      <td class="small muted">${i + 1}</td><td><b>${esc(e.nome_plano)}</b><div class="small muted">${esc([e.funcao, lbl(CAT_PLANO, e.categoria)].filter(Boolean).join(' · '))}</div></td>
      <td class="small">${esc(e.formacao || '—')}</td><td>${ocup}</td><td>${badge(st[0], st[1])}</td><td class="small">${chipsEtapas(p, e.etapas)}</td>
      <td class="num small">${e.horas_semanais != null ? e.horas_semanais + ' h' : '—'}</td>${bol}<td style="white-space:nowrap">${acoes.join(' ')}</td></tr>`;
  }).join('');
  const plano = EP.rows.length
    ? `<div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Nº</th><th>Posição no plano</th><th>Formação</th><th>Ocupante</th><th>Situação</th><th>Etapas</th><th class="num">Dedicação</th>${fin ? '<th>Bolsa prevista</th>' : ''}<th></th></tr>${linhas}</table></div>`
    : `<div class="card empty">Nenhuma posição do plano de trabalho cadastrada.${gere ? ' Importe a planilha do edital ou adicione as posições manualmente — inclusive as vagas de bolsistas ainda não contratados.' : ''}</div>`;
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:18px;${s || ''}">${v}</div></div>`).join('')}</div>
  ${conf}
  <div class="toolbar"><span class="sec" style="margin:0">Equipe do plano de trabalho</span><div class="row">${gere ? `<button class="btn-s" data-a="importarPlanilha" data-projeto="${p.id}">Importar da planilha do edital…</button><button class="btn-p" data-a="vagaNova" data-projeto="${p.id}">+ Posição / vaga</button>` : ''}</div></div>
  ${plano}
  <div class="toolbar mt"><span class="sec" style="margin:0">Alocações no projeto <span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:400">(${alocs.length} · carga e permissões no dia a dia)</span></span>${gere ? `<button class="btn-s" data-a="alocNova" data-projeto="${p.id}">+ Alocar pessoa</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${alocs.length ? `<table class="t"><tr><th>Pessoa</th><th>Papel</th><th>Nível</th><th class="num">Carga</th><th>Atribuição</th><th>Desde</th><th>Status</th></tr>
    ${alocs.map(a => `<tr class="${gere ? 'click' : ''}" ${gere ? `data-a="alocEditar" data-id="${a.id}"` : ''}><td><b>${esc(nomePessoa(a.pessoa_id))}</b> ${a.coordena ? badge('coordena', 'b-green') : ''} ${EP.rows.length && foraIds.has(a.id) ? `<span title="Alocada no projeto, mas não ocupa nenhuma posição do plano de trabalho">${badge('fora do plano', 'b-gray')}</span>` : ''}</td><td>${esc(a.papel || '—')}</td><td>${NIVEIS[a.nivel] || '—'}</td>
      <td class="num">${pillCarga(num(a.carga_pct))}</td><td class="small">${esc(a.atribuicao || '')}</td><td class="small">${fmtD(a.desde)}</td><td>${badge(lbl(ST_ALOC, a.status), a.status === 'ativo' ? 'b-green' : 'b-gray')}</td></tr>`).join('')}</table>`
      : '<div class="empty">Ninguém alocado.</div>'}</div>`;
}

/* formulário da posição (dados do plano + bolsa prevista, esta só para quem edita o financeiro) */
function camposVaga(e, pid) {
  const efin = Perm.editaFin(pid), gere = Perm.gereAlocacao(pid), ocupada = e && e.status === 'ocupada';
  const folhas = rubricasPadrao().filter((r, _, all) => !all.some(x => x.pai === r.codigo));
  return [
    { k: 'nome_plano', l: 'Como consta no plano', req: true, ro: !gere, ph: 'ex.: Bolsista de Mestrado 1 (UFSM)' },
    { k: 'funcao', l: 'Função no edital', ro: !gere, ph: 'ex.: Bolsista - Mestrando, Pesquisador' },
    { k: 'categoria', l: 'Categoria', t: 'select', blank: false, opts: CAT_PLANO, ro: !gere },
    { k: 'formacao', l: 'Formação', ro: !gere, ph: 'ex.: Graduado(a), Mestre(a)' },
    { k: 'horas_semanais', l: 'Dedicação (h/semana)', t: 'number', min: 0, max: 60, ro: !gere },
    { k: 'status', l: 'Situação', t: 'select', blank: false, ro: !gere || ocupada, opts: ocupada ? [['ocupada', 'Ocupada — use “Liberar” para mudar']] : Object.entries(ST_VAGA).filter(([k]) => k !== 'ocupada').map(([k, v]) => [k, v[0]]), help: ocupada ? 'Ocupante: ' + nomePessoa(e.pessoa_id) : 'Para colocar alguém na posição, use “Preencher”.' },
    { k: 'requisitos', l: 'Perfil / requisitos para seleção', t: 'textarea', rows: 2, ro: !gere, hide: ocupada },
    { k: 'selecao_prazo', l: 'Prazo da seleção', t: 'date', ro: !gere, hide: ocupada },
    { k: 'etapas', l: 'Etapas do cronograma vinculadas', t: 'tags', ro: !gere, help: 'Códigos separados por vírgula (ex.: 2.5, 2.6.1). Vêm da matriz de etapas da planilha.' },
    { k: 'ordem', l: 'Ordem na lista', t: 'number', ro: !gere },
    { k: 'obs', l: 'Observações', t: 'textarea', ro: !gere },
    { t: 'sec', k: '_s', l: efin ? 'Bolsa prevista no plano (visível só para Direção, coordenação e financeiro)' : '', hide: !efin },
    { k: 'b_modalidade', l: 'Modalidade', hide: !efin, ph: 'ex.: Mestrado (BM), Coord. geral (COG)' },
    { k: 'b_valor', l: 'Valor mensal (R$)', t: 'money', min: 0, hide: !efin },
    { k: 'b_meses', l: 'Duração (meses)', t: 'number', min: 1, max: 120, hide: !efin },
    { k: 'b_rubrica', l: 'Rubrica', t: 'select', blank: false, hide: !efin, opts: folhas.map(r => [r.codigo, r.codigo + ' ' + r.nome]) },
  ];
}
async function salvarVaga(pid, e, x) {
  const b = { modalidade: x.b_modalidade, valor_mensal: x.b_valor, meses: x.b_meses, rubrica: x.b_rubrica };
  ['b_modalidade', 'b_valor', 'b_meses', 'b_rubrica', '_s'].forEach(k => delete x[k]);
  let v;
  if (Perm.gereAlocacao(pid)) {
    if (e && e.status === 'ocupada') delete x.status;
    v = e ? await Data.update('equipe_plano', e.id, x) : await Data.insert('equipe_plano', { ...x, projeto_id: pid, ordem: x.ordem ?? (Math.max(0, ...D.equipe_plano.filter(q => q.projeto_id === pid).map(q => num(q.ordem))) + 1) });
  } else v = e;
  if (Perm.editaFin(pid) && b.valor_mensal !== undefined) {
    const ex = D.equipe_plano_bolsas.find(q => q.vaga_id === v.id);
    const vazio = !b.modalidade && !num(b.valor_mensal);
    if (vazio) { if (ex) await Data.remove('equipe_plano_bolsas', ex.id); }
    else {
      if (!b.meses) falha('Informe a duração da bolsa em meses.');
      if (ex) await Data.update('equipe_plano_bolsas', ex.id, b); else await Data.insert('equipe_plano_bolsas', { ...b, vaga_id: v.id, projeto_id: pid });
    }
  }
  return v;
}
A.vagaNova = d => form({
  title: 'Nova posição do plano de trabalho', wide: true, fields: camposVaga(null, d.projeto), values: { categoria: 'outro', status: 'vaga', b_rubrica: '1.1.1', etapas: [] },
  intro: '<div class="note small mb">Use para cada linha da equipe do edital — inclusive vagas de bolsistas ainda não contratados (ex.: “Bolsista de Mestrado 2 (UFSM)”).</div>',
  onSave: x => salvarVaga(d.projeto, null, x),
});
A.vagaEditar = d => {
  const e = byId('equipe_plano', d.id), b = D.equipe_plano_bolsas.find(q => q.vaga_id === e.id) || {};
  const r = Calc.equipePlano(byId('projetos', e.projeto_id)).rows.find(q => q.e.id === e.id);
  const hist = r && r.vincs.length && Perm.veFin(e.projeto_id) ? `<div class="sec">Bolsas ligadas a esta posição</div><table class="t small"><tr><th>Bolsista</th><th>Período</th><th class="num">Meses</th><th class="num">R$/mês</th><th>Situação</th></tr>${r.vincs.map(v => `<tr><td>${esc(nomePessoa(v.pessoa_id))}</td><td>${fmtD(v.inicio)} → ${fmtD(v.fim)}</td><td class="num">${Calc.mesesPeriodo(v.inicio, v.fim)}</td><td class="num">${fmtBRL(v.valor_mensal)}</td><td>${badge((ST_VINC[v.status] || [v.status])[0], (ST_VINC[v.status] || [])[1] || 'b-gray')}</td></tr>`).join('')}</table>` : '';
  form({
    title: 'Posição — ' + e.nome_plano, wide: true, fields: camposVaga(e, e.projeto_id),
    values: { ...e, b_modalidade: b.modalidade, b_valor: b.valor_mensal, b_meses: b.meses, b_rubrica: b.rubrica || '1.1.1' }, after: hist,
    onSave: x => salvarVaga(e.projeto_id, e, x),
    onDelete: Perm.gereAlocacao(e.projeto_id) ? () => Data.remove('equipe_plano', e.id) : null, deleteLabel: 'Excluir posição',
    deleteConfirm: 'Excluir esta posição do plano? A bolsa prevista dela também é excluída; bolsas já registradas são mantidas, apenas desligadas da posição.',
  });
};
/* cria a bolsa (vínculo financeiro) de uma posição, respeitando os meses restantes e o fim do projeto */
/* valida antes de gravar qualquer coisa; devolve o período calculado */
function planoBolsaVaga(r, inicio, meses) {
  const p = byId('projetos', r.e.projeto_id);
  meses = Math.round(num(meses));
  if (!isDate(inicio)) falha('Informe o início da bolsa.');
  if (!(meses >= 1)) falha('Informe quantos meses de bolsa (1 ou mais).');
  if (meses > r.mesesRest) falha(`Esta posição tem só ${r.mesesRest} mês(es) de bolsa restantes no plano.`);
  if (p.inicio && inicio < p.inicio) falha(`A bolsa não pode começar antes do início da vigência (${fmtD(p.inicio)}).`);
  let fim = Calc.fimBolsa(inicio, meses), aviso = '';
  if (p.fim && fim > p.fim) { fim = p.fim; aviso = ` (limitada ao fim da vigência, ${fmtD(p.fim)})`; }
  if (fim < inicio) falha('O início da bolsa é posterior ao fim da vigência do projeto.');
  return { p, inicio, fim, aviso };
}
const inicioMes = iso => iso.slice(0, 8) + '01';
async function criarBolsaVaga(r, pessoa_id, inicio, meses, status) {
  const { p, fim, aviso } = planoBolsaVaga(r, inicio, meses);
  await Data.insert('vinculos_financeiros', { pessoa_id, projeto_id: p.id, vaga_id: r.e.id, tipo: r.bolsa.rubrica === '1.1.2' ? 'tecnico' : 'bolsa', modalidade: r.bolsa.modalidade || null,
    rubrica: r.bolsa.rubrica, valor_mensal: num(r.bolsa.valor_mensal), inicio, fim, status: status || 'previsto', obs: `Posição do plano: ${r.e.nome_plano}` });
  return `bolsa de ${fmtD(inicio)} a ${fmtD(fim)}${aviso}`;
}
const linhaVaga = id => { const e = byId('equipe_plano', id); return Calc.equipePlano(byId('projetos', e.projeto_id)).rows.find(q => q.e.id === id); };
const mesesAteFim = (p, ini) => p.fim && isDate(ini) ? Math.max(0, Calc.mesesPeriodo(ini, p.fim)) : 999;
A.vagaPreencher = d => {
  const cand = d.candidato ? byId('candidatos', d.candidato) : null;
  const r = linhaVaga(d.id), e = r.e, p = byId('projetos', e.projeto_id), efin = Perm.editaFin(p.id) && r.bolsa && r.mesesRest > 0;
  const ini = hoje() > p.inicio ? hoje() : p.inicio, bIni = [p.inicio, inicioMes(hoje())].sort().pop();
  const ocupados = new Set(D.equipe_plano.filter(q => q.projeto_id === p.id && q.status === 'ocupada').map(q => q.pessoa_id));
  form({
    title: 'Preencher vaga — ' + e.nome_plano, okLabel: 'Preencher', okMsg: false,
    intro: `<div class="note small mb">${esc([e.funcao, e.formacao, e.horas_semanais != null ? e.horas_semanais + ' h/semana' : ''].filter(Boolean).join(' · '))}${r.bolsa && Perm.veFin(p.id) ? `<br>Bolsa prevista: <b>${esc(r.bolsa.modalidade || '')} ${fmtBRL(r.bolsa.valor_mensal)}/mês</b> — ${r.mesesRest} de ${r.bolsa.meses} mês(es) ainda disponíveis` : ''}</div>`,
    fields: [
      { k: 'pessoa_id', l: 'Quem ocupa', t: 'select', blank: '— cadastrar pessoa nova —', opts: optPessoas(x => !ocupados.has(x.id)) },
      { k: 'nome', l: 'Nome (se for pessoa nova)' }, { k: 'email', l: 'E-mail (se for pessoa nova)' },
      { k: 'desde', l: 'Entra na posição em', t: 'date', req: true },
      { t: 'sec', k: '_s', l: efin ? 'Bolsa' : '', hide: !efin },
      { k: 'criar', l: 'Registrar a bolsa desta posição agora', t: 'check', hide: !efin, full: true },
      { k: 'b_ini', l: 'Início da bolsa', t: 'date', hide: !efin }, { k: 'b_meses', l: 'Meses de bolsa', t: 'number', min: 1, max: r.mesesRest || 1, hide: !efin, help: 'Sugerido: o que resta na posição, limitado ao fim da vigência' },
      { k: 'b_status', l: 'Situação da bolsa', t: 'select', blank: false, hide: !efin, opts: [['previsto', 'Prevista (aguardando implantação)'], ['ativo', 'Ativa (já implantada)']] },
    ],
    values: { nome: cand ? cand.nome : null, email: cand ? cand.email : null, pessoa_id: cand && cand.email ? (D.pessoas.find(q => norm(q.email) === norm(cand.email)) || {}).id || null : null, desde: ini, criar: true, b_ini: bIni, b_meses: efin ? Math.min(r.mesesRest, mesesAteFim(p, bIni)) : null, b_status: 'previsto' },
    onSave: async x => {
      let pid = x.pessoa_id;
      if (!isDate(x.desde)) falha('Informe a data de entrada.');
      if (efin && x.criar) planoBolsaVaga(r, x.b_ini, x.b_meses);   // valida a bolsa antes de gravar a posição
      if (!pid) {
        if (!x.nome) falha('Escolha uma pessoa cadastrada ou informe o nome da pessoa nova.');
        const ex = acharPessoa(x.nome, x.email || '');
        if (ex) pid = ex.id;
        else pid = (await Data.insert('pessoas', { nome: x.nome, email: x.email || null, tipo: e.categoria === 'outro' ? 'outro' : e.categoria, formacao: e.formacao || null, lattes: cand && cand.lattes || null, curso: cand && cand.curso || null, ingresso: x.desde, disponibilidade_pct: 100, perfil_disponibilidade: 'interno', ativo: true })).id;
      }
      { const pe = byId('pessoas', pid); if (pe && !pe.ingresso) await Data.update('pessoas', pid, { ingresso: x.desde }); }
      await Data.update('equipe_plano', e.id, { status: 'ocupada', pessoa_id: pid, desde: x.desde });
      const al = D.alocacoes.find(a => a.pessoa_id === pid && a.projeto_id === p.id);
      const carga = e.horas_semanais != null ? Math.min(100, Math.round(num(e.horas_semanais) / 40 * 100 / 5) * 5) : 25;
      if (!al) await Data.insert('alocacoes', { pessoa_id: pid, projeto_id: p.id, nivel: 2, carga_pct: carga, papel: e.funcao || e.nome_plano, status: 'ativo', desde: x.desde, atribuicao: e.etapas.length ? 'Etapas no plano: ' + etapasTopo(e.etapas).join(', ') : null });
      else if (al.status !== 'ativo') await Data.update('alocacoes', al.id, { status: 'ativo' });
      if (cand) { await Data.update('candidatos', cand.id, { status: 'contratado', pessoa_id: pid });
        for (const o of D.candidatos.filter(q => q.vaga_id === e.id && q.id !== cand.id && ['inscrito', 'entrevista', 'aprovado'].includes(q.status))) await Data.update('candidatos', o.id, { status: 'reprovado' }); }
      let msg = `✓ ${nomePessoa(pid)} ocupa “${e.nome_plano}”`;
      if (efin && x.criar) msg += ' · ' + await criarBolsaVaga(linhaVaga(e.id), pid, x.b_ini, x.b_meses, x.b_status);
      flash(msg);
    },
  });
};
A.vagaLiberar = d => {
  const r = linhaVaga(d.id), e = r.e, p = byId('projetos', e.projeto_id), efin = Perm.editaFin(p.id) && r.vAtual;
  form({
    title: `Liberar posição — ${e.nome_plano}`, okLabel: 'Liberar', okMsg: false,
    intro: `<div class="note small mb">Ocupante atual: <b>${esc(nomePessoa(e.pessoa_id))}</b>${e.desde ? ' desde ' + fmtD(e.desde) : ''}. Use quando o bolsista sai, conclui ou é substituído — o histórico fica registrado.</div>`,
    fields: [
      { k: 'saida', l: 'Data de saída', t: 'date', req: true },
      { k: 'destino', l: 'Depois da saída', t: 'select', blank: false, opts: [['vaga', 'Reabrir como vaga (para substituição)'], ['encerrada', 'Encerrar a posição']] },
      { k: 'encerrar_bolsa', l: `Encerrar a bolsa atual na data de saída (${r.vAtual ? fmtD(r.vAtual.inicio) + ' → ' + fmtD(r.vAtual.fim) : ''})`, t: 'check', hide: !efin, full: true },
      { k: 'concluir_aloc', l: 'Concluir a alocação da pessoa no projeto', t: 'check', full: true, help: 'Desmarque se ela continua no projeto em outra função' },
      { k: 'saida_lab', l: 'Está saindo do laboratório — abrir checklist de desligamento', t: 'check', full: true, hide: D.alocacoes.some(a => a.pessoa_id === e.pessoa_id && a.projeto_id !== p.id && a.status === 'ativo') },
    ],
    values: { saida: hoje(), destino: 'vaga', encerrar_bolsa: true, concluir_aloc: true, saida_lab: !D.alocacoes.some(a => a.pessoa_id === e.pessoa_id && a.projeto_id !== p.id && a.status === 'ativo') },
    onSave: async x => {
      const pid = e.pessoa_id;
      if (efin && x.encerrar_bolsa) {
        const v = r.vAtual; if (x.saida < v.inicio) falha(`A saída (${fmtD(x.saida)}) é anterior ao início da bolsa (${fmtD(v.inicio)}). Exclua a bolsa em Financeiro › Bolsas se ela não chegou a ser paga.`);
        await Data.update('vinculos_financeiros', v.id, { fim: x.saida < v.fim ? x.saida : v.fim, status: x.saida <= hoje() ? 'encerrado' : v.status });
      }
      await Data.update('equipe_plano', e.id, { status: x.destino, pessoa_id: null, desde: null, obs: [e.obs, `${nomePessoa(pid)}: ${fmtD(e.desde)} a ${fmtD(x.saida)}`].filter(Boolean).join('\n') });
      const al = D.alocacoes.find(a => a.pessoa_id === pid && a.projeto_id === p.id);
      if (x.concluir_aloc && al && al.status === 'ativo' && !al.coordena) await Data.update('alocacoes', al.id, { status: 'concluido' });
      if (x.saida_lab && Perm.gerePessoa(pid)) await Data.update('pessoas', pid, { saida: x.saida });
      flash(`✓ Posição liberada${x.destino === 'vaga' ? ' — vaga reaberta' : ' e encerrada'}`);
    },
  });
};
A.vagaBolsa = d => {
  const r = linhaVaga(d.id), e = r.e, p = byId('projetos', e.projeto_id);
  const ini = [e.desde, p.inicio, inicioMes(hoje())].filter(Boolean).sort().pop();
  form({
    title: `Bolsa — ${nomePessoa(e.pessoa_id)} (${e.nome_plano})`, okLabel: 'Registrar bolsa', okMsg: false,
    intro: `<div class="note small mb">${esc(r.bolsa.modalidade || '')} <b>${fmtBRL(r.bolsa.valor_mensal)}/mês</b> · rubrica ${esc(r.bolsa.rubrica)} · ${r.mesesRest} de ${r.bolsa.meses} mês(es) disponíveis na posição.</div>`,
    fields: [{ k: 'inicio', l: 'Início', t: 'date', req: true }, { k: 'meses', l: 'Meses', t: 'number', min: 1, max: r.mesesRest, req: true },
      { k: 'status', l: 'Situação', t: 'select', blank: false, opts: [['previsto', 'Prevista'], ['ativo', 'Ativa']] }],
    values: { inicio: ini, meses: Math.min(r.mesesRest, mesesAteFim(p, ini)), status: 'previsto' },
    onSave: async x => flash('✓ Registrada ' + await criarBolsaVaga(r, e.pessoa_id, x.inicio, x.meses, x.status)),
  });
};
/* ── Documentos e pendências do projeto ─────────────────────────────── */
const linkDoc = d => d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${esc(d.url)}">${esc(d.titulo)} ↗</a>` : `<b>${esc(d.titulo)}</b>`;
function projDocs(p) {
  const gere = Perm.gereProjeto(p.id), fp = UI.f.pdSt || 'abertas';
  const pend = D.pendencias.filter(x => x.projeto_id === p.id);
  const abertas = pend.filter(Calc.pendenciaAberta), atras = abertas.filter(Calc.pendenciaAtrasada);
  const lista = pend.filter(x => fp === 'todas' || (fp === 'abertas' ? Calc.pendenciaAberta(x) : x.status === 'resolvida'))
    .sort((a, b) => (Calc.pendenciaAberta(b) - Calc.pendenciaAberta(a)) || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
  const docs = D.documentos.filter(d => d.projeto_id === p.id && Perm.veDoc(d));
  const ck = Calc.checklistDocs(p), falta = ck.filter(c => !c.ok && !c.opcional);
  const mets = [['Pendências abertas', abertas.length], ['Atrasadas', atras.length, atras.length ? 'color:var(--red)' : ''], ['Documentos', docs.length], ['Checklist', `${ck.filter(c => c.ok).length} de ${ck.length}`, falta.length ? 'color:var(--yellow-txt)' : 'color:var(--green-txt)']];
  const prio = x => x.prioridade === 'alta' ? badge('alta', 'b-red') : x.prioridade === 'baixa' ? '<span class="small faint">baixa</span>' : '';
  const linhasP = lista.map(x => { const st = ST_PEND[x.status] || [x.status, 'b-gray'], pode = Perm.editaPendencia(x), doc = x.documento_id && byId('documentos', x.documento_id);
    return `<tr class="${pode ? 'click' : ''}${['resolvida', 'cancelada'].includes(x.status) ? ' faint' : ''}" ${pode ? `data-a="pendEditar" data-id="${x.id}"` : ''}>
      <td><b>${esc(x.titulo)}</b> ${prio(x)}${x.origem ? `<div class="small muted">Origem: ${esc(x.origem)}</div>` : ''}${x.resolucao ? `<div class="small" style="color:var(--green-txt)">✓ ${esc(x.resolucao)}${doc && Perm.veDoc(doc) ? ' · ' + linkDoc(doc) : ''}</div>` : ''}</td>
      <td class="small">${esc(lbl(CAT_PEND, x.categoria))}</td><td class="small">${x.responsavel_id ? esc(nomePessoa(x.responsavel_id)) : '<span class="faint">—</span>'}</td>
      <td class="small" style="white-space:nowrap;${Calc.pendenciaAtrasada(x) ? 'color:var(--red);font-weight:600' : ''}">${fmtD(x.prazo) || '—'}${Calc.pendenciaAtrasada(x) ? ' · atrasada' : ''}${x.resolvida_em ? `<div class="muted">resolvida ${fmtD(x.resolvida_em)}</div>` : ''}</td>
      <td>${badge(st[0], st[1])}</td><td>${pode && Calc.pendenciaAberta(x) ? `<button class="btn-s" data-a="pendResolver" data-id="${x.id}">Resolver</button>` : ''}</td></tr>`; }).join('');
  const grupos = TIPOS_DOC.map(([t, l]) => [t, l, docs.filter(d => d.tipo === t).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))]).filter(g => g[2].length);
  const linhasD = grupos.map(([t, l, ds]) => `<tr class="grp"><td colspan="5"><b>${esc(l)}</b> <span class="small muted">(${ds.length})</span></td></tr>` + ds.map(d => {
    const pode = Perm.editaDoc(d), ta = d.aditivo_id && byId('aditivos', d.aditivo_id), en = d.entrega_id && byId('entregas', d.entrega_id);
    return `<tr class="${pode ? 'click' : ''}" ${pode ? `data-a="docEditar" data-id="${d.id}"` : ''}><td>${linkDoc(d)} ${d.restrito ? '<span title="Restrito: só Direção, coordenação e financeiro">🔒</span>' : ''}${d.versao ? ` <span class="small muted">v. ${esc(d.versao)}</span>` : ''}${d.obs ? `<div class="small muted">${esc(d.obs)}</div>` : ''}</td>
      <td class="small">${esc(d.numero || '')}</td><td class="small">${fmtD(d.data) || ''}</td>
      <td class="small">${ta ? esc(ta.numero || 'Termo aditivo') : en ? 'Entrega: ' + esc(en.titulo) : ''}</td><td class="small muted">${d.criado_por && String(d.criado_por).startsWith('local:') ? '' : ''}</td></tr>`; }).join('')).join('');
  const ckHTML = ck.map((c, i) => `<div class="small" style="display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #eeebe4"><span style="font-weight:700;color:${c.ok ? 'var(--green-txt)' : c.opcional ? 'var(--muted)' : 'var(--yellow-txt)'}">${c.ok ? '✓' : c.opcional ? '○' : '!'}</span><span class="${c.ok ? 'muted' : ''}">${esc(c.txt)}${c.opcional && !c.ok ? ' <span class="faint">(opcional)</span>' : ''}</span>
      <span>${!c.ok && Perm.incluiDoc(p.id) ? `<button class="btn-s" data-a="docNovo" data-projeto="${p.id}" data-tipo="${c.tipo}" data-aditivo="${c.aditivo_id || ''}" data-entrega="${c.entrega_id || ''}">+ adicionar</button>` : ''}</span></div>`).join('');
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:18px;${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row"><span class="sec" style="margin:0 8px 0 0">Pendências</span>${[['abertas', 'Em aberto'], ['resolvidas', 'Resolvidas'], ['todas', 'Todas']].map(([k, l]) => `<button class="chip${fp === k ? ' on' : ''}" data-a="pdFiltro" data-v="${k}">${l}</button>`).join('')}</div>
    ${gere ? `<button class="btn-p" data-a="pendNova" data-projeto="${p.id}">+ Pendência</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${lista.length ? `<table class="t"><tr><th>Pendência</th><th>Categoria</th><th>Responsável</th><th>Prazo</th><th>Situação</th><th></th></tr>${linhasP}</table>`
    : `<div class="empty">${fp === 'abertas' ? 'Nenhuma pendência em aberto. 👍' : 'Nenhuma pendência.'}</div>`}</div>
  <div class="grid mt" style="grid-template-columns:minmax(280px,1fr) 2fr;align-items:start">
    <div class="card"><div class="bold mb">Checklist documental</div>${ckHTML}<div class="small muted mt">Gerado a partir do contrato, dos termos aditivos e das entregas já feitas.</div></div>
    <div><div class="toolbar" style="margin-top:0"><span class="sec" style="margin:0">Documentos</span>${Perm.incluiDoc(p.id) ? `<button class="btn-p" data-a="docNovo" data-projeto="${p.id}">+ Documento</button>` : ''}</div>
      <div class="card tw" style="padding:4px 8px">${docs.length ? `<table class="t"><tr><th>Documento</th><th>Nº (SEI / processo)</th><th>Data</th><th>Vínculo</th><th></th></tr>${linhasD}</table>` : '<div class="empty">Nenhum documento cadastrado. Guarde aqui os links (Drive, SharePoint, SEI) do contrato, plano de trabalho, termos aditivos, relatórios e ofícios.</div>'}</div></div></div>`;
}
A.pdFiltro = d => { UI.f.pdSt = d.v; render(); };
function camposDoc(p, d) {
  const gere = Perm.gereProjeto(p.id);
  return [
    { k: 'tipo', l: 'Tipo', t: 'select', blank: false, opts: TIPOS_DOC }, { k: 'titulo', l: 'Título', req: true },
    { k: 'url', l: 'Link do arquivo (Drive, SharePoint, OneDrive…)', full: true, ph: 'https://…' },
    { k: 'numero', l: 'Nº SEI / processo / protocolo' }, { k: 'data', l: 'Data', t: 'date' }, { k: 'versao', l: 'Versão' },
    { k: 'aditivo_id', l: 'Termo aditivo relacionado', t: 'select', blank: '— nenhum —', hide: !Calc.aditivosDe(p.id).length, opts: Calc.aditivosDe(p.id).map(a => [a.id, (a.numero || 'Termo aditivo') + (a.data_assinatura ? ' — ' + fmtD(a.data_assinatura) : '')]) },
    { k: 'entrega_id', l: 'Entrega relacionada', t: 'select', blank: '— nenhuma —', hide: !D.entregas.some(e => e.projeto_id === p.id), opts: D.entregas.filter(e => e.projeto_id === p.id).sort(byName('prazo')).map(e => [e.id, e.titulo + ' — ' + fmtD(e.prazo)]) },
    { k: 'restrito', l: 'Restrito (só Direção, coordenação e financeiro veem)', t: 'check', ro: !gere, help: gere ? 'Use para contratos com valores, extratos, notas fiscais' : 'Só a coordenação marca documentos restritos' },
    { k: 'obs', l: 'Observações', t: 'textarea', rows: 2 }];
}
A.docNovo = d => {
  const p = byId('projetos', d.projeto), tipo = d.tipo || 'outro', ta = d.aditivo && byId('aditivos', d.aditivo), en = d.entrega && byId('entregas', d.entrega);
  const titulo = ta ? (ta.numero || 'Termo aditivo') : en ? en.titulo : tipo === 'contrato' ? `Contrato — ${p.sigla}` : tipo === 'plano_trabalho' ? `Plano de trabalho — ${p.sigla}` : '';
  form({ title: 'Novo documento — ' + p.sigla, wide: true, fields: camposDoc(p, null),
    values: { tipo, titulo, aditivo_id: d.aditivo || null, entrega_id: d.entrega || null, data: ta ? ta.data_assinatura : null, restrito: tipo === 'contrato' || tipo === 'nota_fiscal' ? Perm.gereProjeto(p.id) : false, numero: tipo === 'contrato' ? p.numero_contrato || null : null },
    onSave: x => Data.insert('documentos', { ...x, projeto_id: p.id }) });
};
A.docEditar = d => {
  const x0 = byId('documentos', d.id), p = byId('projetos', x0.projeto_id);
  form({ title: 'Documento — ' + x0.titulo, wide: true, fields: camposDoc(p, x0), values: x0,
    onSave: x => Data.update('documentos', x0.id, x), onDelete: () => Data.remove('documentos', x0.id), deleteConfirm: `Excluir o registro "${x0.titulo}"? (o arquivo no Drive não é apagado)` });
};
function camposPend(p, x) {
  const gere = !x || Perm.gereProjeto(p.id), docs = D.documentos.filter(d => d.projeto_id === p.id && Perm.veDoc(d));
  const equipe = [...new Set(D.alocacoes.filter(a => a.projeto_id === p.id && a.status === 'ativo').map(a => a.pessoa_id))];
  return [
    { k: 'titulo', l: 'Pendência', req: true, full: true, ro: !gere, ph: 'ex.: Enviar certidões negativas à FAURGS' },
    { k: 'descricao', l: 'Detalhes', t: 'textarea', rows: 2, ro: !gere },
    { k: 'categoria', l: 'Categoria', t: 'select', blank: false, opts: CAT_PEND, ro: !gere }, { k: 'origem', l: 'Origem (quem exigiu / documento)', ro: !gere, ph: 'ex.: Ofício FAURGS 12/2026' },
    { k: 'responsavel_id', l: 'Responsável', t: 'select', ro: !gere, opts: optPessoas(q => equipe.includes(q.id) || (x && x.responsavel_id === q.id)) },
    { k: 'prazo', l: 'Prazo', t: 'date', ro: !gere }, { k: 'prioridade', l: 'Prioridade', t: 'select', blank: false, ro: !gere, opts: [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta']] },
    { k: 'status', l: 'Situação', t: 'select', blank: false, opts: Object.entries(ST_PEND).map(([k, v]) => [k, v[0]]) },
    { k: 'resolucao', l: 'Como foi resolvida', t: 'textarea', rows: 2 },
    { k: 'documento_id', l: 'Documento que comprova', t: 'select', blank: '— nenhum —', hide: !docs.length, opts: docs.map(d => [d.id, lbl(TIPOS_DOC, d.tipo) + ' · ' + d.titulo]) }];
}
A.pendNova = d => { const p = byId('projetos', d.projeto);
  form({ title: 'Nova pendência — ' + p.sigla, wide: true, fields: camposPend(p, null), values: { categoria: 'administrativa', prioridade: 'normal', status: 'aberta' }, onSave: x => Data.insert('pendencias', { ...x, projeto_id: p.id }) }); };
A.pendEditar = d => { const x0 = byId('pendencias', d.id), p = byId('projetos', x0.projeto_id);
  form({ title: 'Pendência — ' + p.sigla, wide: true, fields: camposPend(p, x0), values: x0,
    intro: Perm.gereProjeto(p.id) ? '' : '<div class="note small mb">Como responsável, você atualiza a situação, a resolução e o documento. Prazo e responsável são definidos pela coordenação.</div>',
    onSave: x => Data.update('pendencias', x0.id, x), onDelete: Perm.gereProjeto(p.id) ? () => Data.remove('pendencias', x0.id) : null, deleteConfirm: 'Excluir esta pendência? (para registrar que não é mais necessária, use a situação “Cancelada”)' }); };
A.pendResolver = d => { const x0 = byId('pendencias', d.id), p = byId('projetos', x0.projeto_id), docs = D.documentos.filter(q => q.projeto_id === p.id && Perm.veDoc(q));
  form({ title: 'Resolver — ' + x0.titulo, okLabel: 'Marcar como resolvida', okMsg: '✓ Pendência resolvida',
    fields: [{ k: 'resolucao', l: 'Como foi resolvida', t: 'textarea', rows: 2, req: true }, { k: 'resolvida_em', l: 'Resolvida em', t: 'date' },
      { k: 'documento_id', l: 'Documento que comprova', t: 'select', blank: '— nenhum —', hide: !docs.length, opts: docs.map(q => [q.id, lbl(TIPOS_DOC, q.tipo) + ' · ' + q.titulo]) }],
    values: { resolvida_em: hoje() }, onSave: x => Data.update('pendencias', x0.id, { ...x, status: 'resolvida' }) }); };

function projTarefas(p) {
  const tarefas = D.tarefas.filter(t => t.projeto_id === p.id);
  return `<div class="toolbar"><span class="small muted">${tarefas.filter(t => !t.concluida).length} aberta(s) de ${tarefas.length}</span>${Perm.podeCriarTarefa(p.id, null) ? `<button class="btn-p" data-a="tarefaNova" data-projeto="${p.id}">+ Tarefa</button>` : ''}</div>
  <div class="card">${listaTarefas(tarefas, { proj: false })}</div>
  <div class="mt">${ganttTarefas(tarefas, t => Calc.responsaveis(t.id).map(x => x.nome.split(' ')[0]).join('+'))}</div>`;
}
function projFinanceiro(p) {
  const v = UI.sub.projFin || 'orcamento';
  return `<div class="toolbar"><div class="row"><button class="chip${v === 'orcamento' ? ' on' : ''}" data-a="sub" data-g="projFin" data-v="orcamento">Orçamento por rubrica</button><button class="chip${v === 'plano' ? ' on' : ''}" data-a="sub" data-g="projFin" data-v="plano">Plano de aplicação${(() => { const n = D.plano_itens.filter(i => i.projeto_id === p.id && i.status !== 'cancelado').length; return n ? ` <span class="small muted">(${n})</span>` : ''; })()}</button><button class="chip${v === 'desembolso' ? ' on' : ''}" data-a="sub" data-g="projFin" data-v="desembolso">Desembolso${(() => { const t = Calc.desembolso(p).tot; return t.atrasadas.length ? ` <span class="nv-n bad" style="margin-left:4px">${t.atrasadas.length}</span>` : ''; })()}</button></div>
    <div class="row"><button class="btn-s" data-a="despVer" data-projeto="${p.id}">Despesas</button><button class="btn-s" data-a="finAbrirBolsas" data-id="${p.id}">Bolsas e pagamentos</button>${Perm.editaFin(p.id) ? `<button class="btn-p" data-a="despNova" data-projeto="${p.id}">+ Lançar gasto</button>` : ''}</div></div>
  ${v === 'plano' ? finPlano(p) : v === 'desembolso' ? finDesembolso(p) : orcTabela(p)}`;
}
A.finAbrirBolsas = d => { UI.tab = 'financeiro'; UI.f.finProj = d.id; UI.sub.fin = 'bolsas'; UI.projeto = null; window.scrollTo(0, 0); render(); };
function projHistorico(p) {
  return historicoBloco(r => r.registro_id === p.id || (r.alteracoes && (r.alteracoes.projeto_id === p.id || (Array.isArray(r.alteracoes.projeto_id) && r.alteracoes.projeto_id.includes(p.id)))), 200) || '<div class="empty">Sem registros.</div>';
}

function camposAlocacao(a, pid) {
  return [
    { k: 'pessoa_id', l: 'Pessoa', t: 'select', req: true, opts: optPessoas(), ro: !!a },
    { k: 'projeto_id', l: 'Projeto', t: 'select', req: true, opts: optProjetos(), ro: !!(a || pid) },
    { k: 'nivel', l: 'Nível de atuação', t: 'select', blank: false, opts: NIVEIS.map((n, i) => [String(i), i ? n + ' (sugere ' + NIVEL_CARGA[i] + '%)' : 'Sem atuação']) },
    { k: 'carga_pct', l: 'Carga estimada (%)', t: 'number', min: 0, max: 200, step: 5, help: 'Vazio = usa a sugestão do nível' },
    { k: 'papel', l: 'Papel (ex.: COG, CFD, Sup. Fab.)' },
    { k: 'desde', l: 'Alocado desde', t: 'date' },
    { k: 'status', l: 'Status', t: 'select', blank: false, opts: ST_ALOC },
    { k: 'coordena', l: 'Coordena este projeto', t: 'check', ro: !Perm.dir(), help: Perm.dir() ? 'Dá acesso de coordenação (inclusive financeiro) a este projeto' : 'Somente a Direção define coordenadores' },
    { k: 'atribuicao', l: 'Atribuição real no projeto', t: 'textarea' }];
}
const fixAloc = x => { x.nivel = Number(x.nivel ?? 1); if (x.carga_pct == null) x.carga_pct = NIVEL_CARGA[x.nivel] || 0; return x; };
A.alocNova = d => form({
  title: 'Alocar pessoa', fields: camposAlocacao(null, d.projeto), values: { projeto_id: d.projeto || null, pessoa_id: d.pessoa || null, nivel: '1', status: 'ativo' },
  onSave: x => Data.insert('alocacoes', fixAloc({ ...x, projeto_id: x.projeto_id || d.projeto, pessoa_id: x.pessoa_id || d.pessoa })),
});
A.alocEditar = d => {
  const a = byId('alocacoes', d.id);
  form({
    title: `Alocação — ${nomePessoa(a.pessoa_id)} · ${siglaProjeto(a.projeto_id)}`, fields: camposAlocacao(a), values: { ...a, nivel: String(a.nivel) },
    onSave: x => { delete x.pessoa_id; delete x.projeto_id; return Data.update('alocacoes', a.id, fixAloc(x)); },
    onDelete: () => Data.remove('alocacoes', a.id), deleteLabel: 'Remover do projeto', deleteConfirm: 'Remover esta pessoa do projeto?',
  });
};

function historicoBloco(filtro, limite = 15) {
  const list = D.historico.filter(filtro).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, limite);
  if (!list.length) return '';
  return `<div class="sec">Histórico recente</div><div class="card small">${list.map(h => `<div class="mb"><span class="muted">${fmtDT(h.em)} · ${esc(quem(h.usuario))}</span> — ${esc(descHist(h))}</div>`).join('')}</div>`;
}
function quem(u) { if (!u) return 'sistema'; if (String(u).startsWith('local:')) { const pid = u.slice(6); return byId('pessoas', pid) ? nomePessoa(pid) : 'Direção (local)'; } const pf = D.perfis.find(p => p.id === u); return pf ? (pf.pessoa_id ? nomePessoa(pf.pessoa_id) : pf.email) : 'usuário'; }
const NOME_TAB = { pessoas: 'pessoa', projetos: 'projeto', alocacoes: 'alocação', tarefas: 'tarefa', tarefa_responsaveis: 'responsável de tarefa', aditivos: 'aditivo', entregas: 'entrega', cronograma: 'atividade do cronograma', vinculos_financeiros: 'bolsa/pagamento', orcamento_rubricas: 'orçamento da rubrica', despesas: 'despesa', prospeccoes: 'prospecção', avaliacoes: 'avaliação', gerencias: 'gerência', gerencia_membros: 'gerente', perfis: 'perfil', infra_itens: 'item de infraestrutura', infra_reservas: 'reserva', infra_manutencoes: 'manutenção', infra_habilitacoes: 'habilitação' };
const REF_COL = { projeto_id: 'projetos', pessoa_id: 'pessoas', responsavel_id: 'pessoas', solicitante_id: 'pessoas', gerencia_id: 'gerencias', item_id: 'infra_itens', pai_id: 'infra_itens', tarefa_id: 'tarefas', prospeccao_id: 'prospeccoes', projeto_aquisicao_id: 'projetos', vinculo_id: 'vinculos_financeiros', atividade_id: 'cronograma' };
function nomeRef(t, id) { const r = byId(t, id); if (!r) return id ? '(removido)' : '∅'; return r.sigla || r.nome || r.titulo || r.item || (r.pessoa_id ? nomePessoa(r.pessoa_id) : '?'); }
function rotuloReg(t, r) {
  if (!r) return '';
  if (t === 'alocacoes' || t === 'gerencia_membros' || t === 'infra_habilitacoes' || t === 'vinculos_financeiros' || t === 'tarefa_responsaveis')
    return [r.pessoa_id && nomePessoa(r.pessoa_id), r.projeto_id && siglaProjeto(r.projeto_id), r.gerencia_id && nomeRef('gerencias', r.gerencia_id), r.item_id && nomeRef('infra_itens', r.item_id), r.tarefa_id && nomeRef('tarefas', r.tarefa_id)].filter(Boolean).join(' · ');
  if (t === 'infra_reservas' || t === 'infra_manutencoes') return [nomeRef('infra_itens', r.item_id), r.titulo, r.inicio && fmtDT(r.inicio)].filter(Boolean).join(' · ');
  if (t === 'aditivos') return siglaProjeto(r.projeto_id) + ' · ' + (r.numero || lbl(TIPOS_ADITIVO, r.tipo));
  if (t === 'entregas') return siglaProjeto(r.projeto_id) + ' · ' + r.titulo;
  if (t === 'cronograma') return siglaProjeto(r.projeto_id) + ' · ' + r.codigo + ' ' + r.titulo;
  if (t === 'orcamento_rubricas') return siglaProjeto(r.projeto_id) + ' · ' + Calc.rotuloRubrica(r.rubrica);
  if (t === 'despesas') return [siglaProjeto(r.projeto_id), Calc.rotuloRubrica(r.rubrica), r.descricao, fmtBRL2(r.valor)].join(' · ');
  if (t === 'avaliacoes') return nomeRef('prospeccoes', r.prospeccao_id) + (r.ia != null ? ` (IA ${Math.round(r.ia)})` : '');
  return r.sigla || r.nome || r.titulo || r.item || r.email || '';
}
function descHist(h) {
  const alvo = NOME_TAB[h.tabela] || h.tabela;
  if (h.operacao === 'INSERT' || h.operacao === 'DELETE') { const r = rotuloReg(h.tabela, h.alteracoes); return `${h.operacao === 'INSERT' ? 'criou' : 'excluiu'} ${alvo}${r ? ' “' + r + '”' : ''}`; }
  const atual = byId(h.tabela, h.registro_id);
  const f = (k, v) => v == null || v === '' ? '∅' : REF_COL[k] ? nomeRef(REF_COL[k], v) : typeof v === 'boolean' ? (v ? 'sim' : 'não') : typeof v === 'object' ? JSON.stringify(v) : /^\d{4}-\d{2}-\d{2}T/.test(v) ? fmtDT(v) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtD(v) : String(v).length > 50 ? String(v).slice(0, 50) + '…' : String(v);
  const campos = Object.entries(h.alteracoes || {}).filter(([k]) => !['concluida_em'].includes(k));
  return `alterou ${alvo}${atual ? ' “' + rotuloReg(h.tabela, atual) + '”' : ''}: ` + campos.map(([k, [a, b]]) => `${k.replace(/_id$/, '').replace(/_/g, ' ')} ${f(k, a)} → ${f(k, b)}`).join('; ');
}

/* ════════════════════════════════════════════════════════════════════
   CRONOGRAMA (linha do tempo dos projetos)
   ════════════════════════════════════════════════════════════════════ */
VIEWS.cronograma = () => {
  const v = UI.sub.cron || 'gantt';
  return `<div class="subtabs">${[['gantt', 'Gantt do portfólio'], ['carga', 'Carga da equipe por mês']].map(([k, l]) => `<button class="chip${v === k ? ' on' : ''}" data-a="sub" data-g="cron" data-v="${k}">${l}</button>`).join('')}</div>`
    + (v === 'gantt' ? cronGantt() : cronCarga());
};
const addMeses = (iso, n) => { const d = toDate(iso); return isoOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
function janelaCron(list) {
  const z = UI.f.cronZoom || '24', t = hoje();
  if (z === 'tudo') { const a = list.map(p => p.inicio).sort()[0] || t, b = list.map(p => p.fim).sort().pop() || t; return [`${a.slice(0, 4)}-01-01`, `${+b.slice(0, 4) + 1}-01-01`]; }
  const n = +z; return [addMeses(t, -Math.round(n / 4)), addMeses(t, n - Math.round(n / 4))];
}
function cronGantt() {
  const fs = UI.f.cronSit || 'vigente', meus = !!UI.f.cronMeus, t = hoje();
  let list = D.projetos.filter(p => (fs === 'todos' || (fs === 'vigente' ? Calc.vigente(p) || Calc.vencido(p) : p.situacao === fs)) && (!meus || D.alocacoes.some(a => a.projeto_id === p.id && a.pessoa_id === ME.pessoa_id && a.status === 'ativo')));
  list = list.sort((a, b) => String(a.inicio).localeCompare(b.inicio));
  const [ja, jb] = janelaCron(list), abertos = UI.f.cronAbertos || new Set();
  const W = 1100, L = 190, R = 16, x = d => L + Math.max(0, Math.min(1, (toDate(d) - toDate(ja)) / (toDate(jb) - toDate(ja)))) * (W - L - R);
  const dentro = d => d && d >= ja && d <= jb;
  const meses = []; for (let m = ja.slice(0, 7) + '-01'; m < jb; m = addMeses(m, 1)) meses.push(m);
  const passo = meses.length > 30 ? 3 : 1;
  const rows = [];
  list.forEach(p => { const s = Calc.saudeProjeto(p); rows.push({ tipo: 'p', p, s });
    if (abertos.has(p.id)) Calc.cronograma(p).rows.filter(r => r.c.codigo.split('.').length <= 2 && r.ini != null && r.fim != null).forEach(r => rows.push({ tipo: 'e', p, r })); });
  const RH = 26, H0 = 40, H = H0 + rows.length * RH + 24;
  let y = H0;
  const corSinal = { bad: '#c43030', warn: '#ba7517', ok: '#3b6d11' }, fundo = { bad: '#fcebeb', warn: '#faeeda', ok: '#eaf3de' };
  const svgRows = rows.map(o => {
    const yy = y, cy = yy + RH / 2; y += RH;
    if (o.tipo === 'p') {
      const p = o.p, s = o.s, x1 = x(p.inicio), x2 = x(addDays(p.fim, 1)), fis = s.fis ? s.fis.pct : null;
      const orig = Calc.vigenciaOriginal(p), prorr = orig && orig < p.fim;
      const marcos = [];
      D.entregas.filter(e => e.projeto_id === p.id && dentro(e.prazo)).forEach(e => { const atr = Calc.entregaAtrasada(e), ok = ['entregue', 'aprovado'].includes(e.status), cx = x(e.prazo);
        marcos.push(`<g data-a="projAbrir" data-id="${p.id}" data-aba="entregas" style="cursor:pointer"><title>${esc(`Entrega: ${e.titulo} — ${fmtD(e.prazo)} (${ST_ENTREGA[e.status][0]}${atr ? ', atrasada' : ''})`)}</title><rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" transform="rotate(45 ${cx} ${cy})" fill="${atr ? '#c43030' : ok ? '#8a8984' : '#1c1c1a'}" stroke="#fff" stroke-width="2"/></g>`); });
      if (Perm.veFin(p.id)) D.desembolsos.filter(d => d.projeto_id === p.id && d.status !== 'cancelada' && dentro(d.status === 'recebida' ? d.data_recebida : d.data_prevista)).forEach(d => { const dt = d.status === 'recebida' ? d.data_recebida : d.data_prevista, cx = x(dt), st = Calc.situacaoParcela(d);
        marcos.push(`<g data-a="finDesemb" data-id="${p.id}" style="cursor:pointer"><title>${esc(`Parcela ${d.numero}: ${fmtBRL(d.valor_previsto)} — ${ST_DESEMB[st][0]} (${fmtD(dt)})`)}</title><circle cx="${cx}" cy="${cy}" r="5.5" fill="${st === 'atrasada' ? '#c43030' : st === 'prevista' ? '#fff' : '#1c1c1a'}" stroke="${st === 'prevista' ? '#1c1c1a' : '#fff'}" stroke-width="2"/></g>`); });
      Calc.aditivosDe(p.id).filter(a => dentro(a.data_assinatura)).forEach(a => { const cx = x(a.data_assinatura); marcos.push(`<g><title>${esc(`${a.numero || 'Termo aditivo'} assinado em ${fmtD(a.data_assinatura)}`)}</title><line x1="${cx}" x2="${cx}" y1="${cy - 9}" y2="${cy + 9}" stroke="#1c1c1a" stroke-width="2.5"/></g>`); });
      return `<g>${abertos.has(p.id) ? '' : ''}<text x="4" y="${cy + 4}" font-size="12.5" font-weight="600" fill="#1c1c1a" data-a="cronAbrirProj" data-id="${p.id}" style="cursor:pointer">${D.cronograma.some(c => c.projeto_id === p.id) ? (abertos.has(p.id) ? '▾ ' : '▸ ') : '   '}${esc(p.sigla)}</text>
        <text x="${L - 8}" y="${cy + 4}" font-size="11" text-anchor="end" fill="${corSinal[s.sinal]}">${SINAL[s.sinal][2]}</text>
        <g data-a="projAbrir" data-id="${p.id}" style="cursor:pointer"><title>${esc(`${p.sigla}: ${fmtD(p.inicio)} a ${fmtD(p.fim)}${prorr ? ` (prorrogado; original ${fmtD(orig)})` : ''}${fis != null ? ` · físico ${fis}% (previsto ${s.fis.prev}%)` : ''} · ${SINAL[s.sinal][0]}${[...s.mot.bad, ...s.mot.warn].length ? ': ' + [...s.mot.bad, ...s.mot.warn].join('; ') : ''}`)}</title>
          <rect x="${x1}" y="${cy - 8}" width="${Math.max(2, x2 - x1)}" height="16" rx="4" fill="${fundo[s.sinal]}" stroke="${corSinal[s.sinal]}" stroke-width="1"/>
          ${fis ? (() => { const xf = x(isoOf(new Date(+toDate(p.inicio) + (toDate(addDays(p.fim, 1)) - toDate(p.inicio)) * fis / 100))); return xf > x1 ? `<rect x="${x1}" y="${cy - 8}" width="${xf - x1}" height="16" rx="4" fill="${corSinal[s.sinal]}" opacity=".35"/>` : ''; })() : ''}
          ${prorr && dentro(orig) ? `<line x1="${x(orig)}" x2="${x(orig)}" y1="${cy - 11}" y2="${cy + 11}" stroke="#1c1c1a" stroke-width="1.5" stroke-dasharray="3 2"/>` : ''}
          ${fis != null && x2 - x1 > 60 ? `<text x="${x1 + 6}" y="${cy + 4}" font-size="10.5" fill="#1c1c1a">${fis}%</text>` : ''}</g>${marcos.join('')}</g>`;
    }
    const r = o.r, p = o.p, di = Calc.mesData(p, r.ini), df = addDays(Calc.mesDataFim(p, r.fim), 1), x1 = x(di), x2 = x(df), atr = r.folha ? r.atras : r.nAtras > 0;
    return `<g data-a="projAbrir" data-id="${p.id}" data-aba="cronograma" style="cursor:pointer"><title>${esc(`${r.c.codigo} ${r.c.titulo}: ${fmtMes(di)} – ${fmtMes(Calc.mesDataFim(p, r.fim))} · realizado ${r.pct ?? 0}% (previsto ${r.prev ?? 0}%)${atr ? ' · com atraso' : ''}`)}</title>
      <text x="16" y="${cy + 4}" font-size="11" fill="#3d3d3a">${esc((r.c.codigo + ' ' + r.c.titulo).slice(0, 26) + ((r.c.codigo + ' ' + r.c.titulo).length > 26 ? '…' : ''))}</text>
      ${x2 > x1 ? `<rect x="${x1}" y="${cy - 5}" width="${Math.max(2, x2 - x1)}" height="10" rx="3" fill="#e6f1fb" stroke="${atr ? '#c43030' : '#1a5ca8'}" stroke-width="1"/><rect x="${x1}" y="${cy - 5}" width="${Math.max(0, (x2 - x1) * (r.pct || 0) / 100)}" height="10" rx="3" fill="#1a5ca8" opacity=".55"/>` : ''}</g>`;
  }).join('');
  const faixas = rows.map((o, i) => i % 2 ? '' : `<rect x="0" y="${H0 + i * RH}" width="${W}" height="${RH}" fill="#faf9f6"/>`).join('');
  const grade = meses.map((m, i) => `<line x1="${x(m)}" x2="${x(m)}" y1="${H0 - 12}" y2="${H - 22}" stroke="${m.slice(5, 7) === '01' ? '#d0cec8' : '#eeebe4'}" stroke-width="1"/>${i % passo === 0 ? `<text x="${x(m) + 3}" y="${H0 - 4}" font-size="10" fill="#5f5e5a">${MESES[+m.slice(5, 7) - 1]}</text>` : ''}${m.slice(5, 7) === '01' || i === 0 ? `<text x="${x(m) + 3}" y="14" font-size="12" font-weight="700" fill="#1c1c1a">${m.slice(0, 4)}</text>` : ''}`).join('');
  const hojeL = dentro(t) ? `<line x1="${x(t)}" x2="${x(t)}" y1="${H0 - 12}" y2="${H - 22}" stroke="#c43030" stroke-width="1.5"/><text x="${x(t) + 3}" y="${H - 10}" font-size="10.5" fill="#c43030">hoje</text>` : '';
  const legenda = `<div class="row small muted mt" style="gap:16px;flex-wrap:wrap">
    <span>Barra = vigência · preenchimento = avanço físico realizado · cor = sinal (✓ em dia, ▲ atenção, ● crítico)</span>
    <span class="row" style="gap:4px"><svg width="14" height="14"><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill="#1c1c1a"/></svg>entrega (vermelha = atrasada, cinza = feita)</span>
    <span class="row" style="gap:4px"><svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="#fff" stroke="#1c1c1a" stroke-width="2"/></svg>parcela prevista (cheia = recebida)</span>
    <span class="row" style="gap:4px"><svg width="10" height="14"><line x1="5" x2="5" y1="1" y2="13" stroke="#1c1c1a" stroke-width="2.5"/></svg>termo aditivo</span>
    <span class="row" style="gap:4px"><svg width="10" height="14"><line x1="5" x2="5" y1="1" y2="13" stroke="#1c1c1a" stroke-width="1.5" stroke-dasharray="3 2"/></svg>fim original (prorrogado)</span></div>`;
  const ctrl = `<div class="toolbar"><div class="row">
      ${[['vigente', 'Vigentes'], ['encerrado', 'Encerrados'], ['todos', 'Todos']].map(([k, l]) => `<button class="chip${fs === k ? ' on' : ''}" data-a="cronSit" data-v="${k}">${l}</button>`).join('')}
      <span class="muted small" style="margin-left:8px">Janela:</span>${[['12', '12 meses'], ['24', '24 meses'], ['48', '4 anos'], ['tudo', 'Tudo']].map(([k, l]) => `<button class="chip${(UI.f.cronZoom || '24') === k ? ' on' : ''}" data-a="cronZoom" data-v="${k}">${l}</button>`).join('')}
      ${ME.pessoa_id ? `<button class="chip${meus ? ' on' : ''}" data-a="cronMeus" style="margin-left:8px">${meus ? '✓ ' : ''}Só projetos em que atuo</button>` : ''}</div>
    <div class="row"><button class="btn-s" data-a="cronTodosProj" data-v="${list.every(p => abertos.has(p.id)) ? 'fechar' : 'abrir'}">${list.length && list.every(p => abertos.has(p.id)) ? 'Recolher etapas' : 'Mostrar etapas de todos'}</button></div></div>`;
  if (!list.length) return ctrl + '<div class="card empty">Nenhum projeto nesta seleção.</div>';
  return ctrl + `<div class="card tw" style="padding:10px 12px"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:820px;display:block" role="img" aria-label="Gantt dos projetos">${faixas}${grade}${svgRows}${hojeL}</svg>${legenda}</div>
  <div class="small muted mt">Clique no nome (▸) para abrir as metas e etapas do cronograma físico; clique na barra para abrir o projeto. Passe o mouse para ver detalhes.</div>`;
}
A.cronSit = d => { UI.f.cronSit = d.v; render(); };
A.cronZoom = d => { UI.f.cronZoom = d.v; render(); };
A.cronMeus = () => { UI.f.cronMeus = !UI.f.cronMeus; render(); };
A.cronAbrirProj = d => { const s = UI.f.cronAbertos = UI.f.cronAbertos || new Set(); s.has(d.id) ? s.delete(d.id) : s.add(d.id); render(); };
A.cronTodosProj = d => { const s = UI.f.cronAbertos = UI.f.cronAbertos || new Set(); D.projetos.forEach(p => d.v === 'abrir' ? s.add(p.id) : s.delete(p.id)); render(); };

/* ── carga da equipe por mês (sobreposição de projetos) ── */
function cronCarga() {
  const t = hoje(), n = +(UI.f.cgMeses || 12), ft = UI.f.cgTipo || 'equipe', ini = addMeses(t, 0);
  const meses = []; for (let i = 0; i < n; i++) meses.push(addMeses(ini, i));
  const pessoas = D.pessoas.filter(p => p.ativo !== false && filtroTipo(p, ft)).sort(byName('nome'));
  const cargaMes = (pe, m) => { const fimM = addDays(addMeses(m, 1), -1); let s = 0; const projs = [];
    D.alocacoes.filter(a => a.pessoa_id === pe.id && a.status === 'ativo').forEach(a => { const p = byId('projetos', a.projeto_id); if (p && p.situacao === 'vigente' && p.inicio <= fimM && p.fim >= m) { s += num(a.carga_pct); projs.push(`${p.sigla} ${num(a.carga_pct)}%`); } });
    return { s, projs }; };
  const cor = v => v <= 0 ? ['transparent', '#8a8984'] : v <= 40 ? ['#cde2fb', '#1c1c1a'] : v <= 70 ? ['#9ec5f4', '#1c1c1a'] : v <= 100 ? ['#5598e7', '#fff'] : ['#1c5cab', '#fff'];
  const projMes = meses.map(m => { const fimM = addDays(addMeses(m, 1), -1); return D.projetos.filter(p => p.situacao === 'vigente' && p.inicio <= fimM && p.fim >= m).length; });
  const fins = meses.map(m => { const fimM = addDays(addMeses(m, 1), -1); return D.projetos.filter(p => p.situacao === 'vigente' && p.fim >= m && p.fim <= fimM).map(p => p.sigla); });
  const linhas = pessoas.map(pe => { const cs = meses.map(m => cargaMes(pe, m)); if (!cs.some(c => c.s)) return '';
    return `<tr><td style="white-space:nowrap"><button class="link" data-a="pessoaAbrir" data-id="${pe.id}">${esc(pe.nome)}</button><div class="small muted">${esc(lbl(TIPOS_PESSOA, pe.tipo))} · dispon. ${num(pe.disponibilidade_pct)}%</div></td>
      ${cs.map(c => { const [bg, fg] = cor(c.s), disp = num(pe.disponibilidade_pct), sobre = c.s > 100 || (disp > 0 && disp < 100 && c.s > disp); return `<td class="num" title="${esc(c.projs.join(' · ') || 'sem alocação')}" style="background:${bg};color:${fg};text-align:center;font-variant-numeric:tabular-nums;${sobre ? 'font-weight:700;box-shadow:inset 0 0 0 2px #c43030' : ''}">${c.s ? Math.round(c.s) + '%' + (sobre ? ' !' : '') : ''}</td>`; }).join('')}</tr>`; }).join('');
  return `<div class="toolbar"><div class="row">
      <select data-f="cgTipo" style="width:auto">${[['equipe', 'Equipe (sem IC)'], ['ic', 'Bolsistas IC'], ['todos', 'Todos']].map(([v, l]) => `<option value="${v}"${ft === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      ${[[6, '6 meses'], [12, '12 meses'], [24, '24 meses']].map(([k, l]) => `<button class="chip${n === k ? ' on' : ''}" data-a="cgMeses" data-v="${k}">${l}</button>`).join('')}</div>
    <span class="small muted">Soma das cargas das alocações ativas em projetos vigentes em cada mês (pela vigência de cada projeto)</span></div>
  <div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Pessoa</th>${meses.map(m => `<th style="text-align:center;min-width:52px">${MESES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}</th>`).join('')}</tr>
    ${linhas || `<tr><td colspan="${n + 1}" class="empty">Sem alocações ativas.</td></tr>`}
    <tr class="total"><td>Projetos vigentes</td>${projMes.map(v => `<td style="text-align:center">${v}</td>`).join('')}</tr>
    <tr><td class="small muted">Terminam no mês</td>${fins.map(f => `<td class="small" style="text-align:center;color:var(--red-txt)" title="${esc(f.join(', '))}">${f.map(esc).join('<br>')}</td>`).join('')}</tr></table></div>
  <div class="row small muted mt" style="gap:14px;flex-wrap:wrap"><span>Carga:</span>${[['1–40%', '#cde2fb', '#1c1c1a'], ['41–70%', '#9ec5f4', '#1c1c1a'], ['71–100%', '#5598e7', '#fff'], ['acima de 100%', '#1c5cab', '#fff']].map(([l, b, f]) => `<span class="row" style="gap:4px"><span style="display:inline-block;width:26px;height:14px;background:${b};border-radius:3px"></span>${l}</span>`).join('')}<span class="row" style="gap:4px"><span style="display:inline-block;width:22px;height:14px;box-shadow:inset 0 0 0 2px #c43030;border-radius:3px"></span>sobrecarga (acima de 100% ou da disponibilidade) — marcada com “!”</span></div>
  <div class="small muted mt">Passe o mouse sobre a célula para ver os projetos que compõem a carga. A carga de cada alocação é ajustada na aba Equipe do projeto ou na Matriz de alocação.</div>`;
}
A.cgMeses = d => { UI.f.cgMeses = d.v; render(); };

/* ════════════════════════════════════════════════════════════════════
   EQUIPE (matriz de alocação + cadastro de pessoas)
   ════════════════════════════════════════════════════════════════════ */
VIEWS.equipe = () => {
  if (UI.pessoa && byId('pessoas', UI.pessoa)) return pessoaDetalhe(byId('pessoas', UI.pessoa));
  const abas = SUBS_EQUIPE();
  let sub = UI.sub.equipe || 'matriz'; if (!abas.some(a => a[0] === sub)) sub = 'matriz';
  return `<div class="subtabs">${abas.map(([k, l, n]) => `<button class="chip${sub === k ? ' on' : ''}" data-a="sub" data-g="equipe" data-v="${k}">${l}${n ? ` <span class="small muted">(${n})</span>` : ''}</button>`).join('')}</div>`
    + ({ matriz: equipeMatriz, pessoas: equipePessoas, vagas: equipeVagas, bolsas: equipeBolsas, transicao: equipeTransicao }[sub])();
};
A.sub = d => { UI.sub[d.g] = d.v; render(); };
const SUBS_EQUIPE = () => [['matriz', 'Matriz de alocação'], ['pessoas', 'Pessoas'], ['vagas', 'Vagas e seleção', D.equipe_plano.filter(e => ['vaga', 'selecao'].includes(e.status)).length],
  ...(D.projetos.some(p => Perm.veFin(p.id)) ? [['bolsas', 'Bolsas']] : []), ['transicao', 'Entrada e saída', Calc.emTransicao().filter(x => x.pe.id === ME.pessoa_id || Perm.gerePessoa(x.pe.id)).length]];
function filtroTipo(p, ft) { return ft === 'todos' || (ft === 'ic' ? p.tipo === 'ic' : ft === 'equipe' ? p.tipo !== 'ic' : true); }
function equipeMatriz() {
  const ft = UI.f.mxTipo || 'equipe', q = norm(UI.f.mxBusca);
  const projs = D.projetos.filter(p => Calc.vigente(p)).sort(by('ordem')).sort(byName('sigla'));
  const pessoas = D.pessoas.filter(p => p.ativo !== false && filtroTipo(p, ft) && (!q || norm(p.nome + ' ' + (p.funcao || '')).includes(q))).sort(byName('nome'));
  return `<div class="toolbar"><div class="row">
      <select data-f="mxTipo">${[['equipe', 'Equipe (sem IC)'], ['ic', 'Bolsistas IC'], ['todos', 'Todos']].map(([v, l]) => `<option value="${v}"${ft === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input id="mxBusca" data-f="mxBusca" placeholder="Filtrar nome ou função…" value="${esc(UI.f.mxBusca || '')}"></div>
    <span class="small muted">Só projetos vigentes · carga = soma das alocações ativas · clique na célula para alocar/editar</span></div>
  <div class="card tw" style="padding:4px"><table class="t mx"><tr><th style="text-align:left">Pessoa</th><th>Carga</th><th>Dispon.</th>${projs.map(p => `<th style="text-align:center"><button class="link" data-a="projAbrir" data-id="${p.id}">${esc(p.sigla)}</button></th>`).join('')}</tr>
  ${pessoas.map(pe => {
    const c = Calc.carga(pe.id);
    return `<tr><td style="text-align:left;white-space:nowrap"><button class="link" data-a="pessoaAbrir" data-id="${pe.id}">${pe.risco_sobrecarga ? '⚠ ' : ''}${esc(pe.nome)}</button><div class="small muted">${esc(pe.funcao || lbl(TIPOS_PESSOA, pe.tipo))}</div></td>
      <td>${pillCarga(c)}</td><td><span class="small" title="${esc(lbl(PERFIS_DISP, pe.perfil_disponibilidade))}">${num(pe.disponibilidade_pct)}%</span></td>
      ${projs.map(p => {
        const a = D.alocacoes.find(x => x.pessoa_id === pe.id && x.projeto_id === p.id);
        const pode = Perm.gereAlocacao(p.id);
        if (!a) return `<td>${pode ? `<button class="cell" style="color:#c8c6c0" data-a="alocNova" data-projeto="${p.id}" data-pessoa="${pe.id}">+</button>` : '<span class="faint">—</span>'}</td>`;
        const [bg, col, bd] = corCarga(a.status === 'ativo' ? num(a.carga_pct) : 0);
        const late = D.tarefas.some(t => t.projeto_id === p.id && Calc.atrasada(t) && D.tarefa_responsaveis.some(r => r.tarefa_id === t.id && r.pessoa_id === pe.id));
        return `<td><button class="cell" ${pode ? `data-a="alocEditar" data-id="${a.id}"` : 'disabled style="opacity:1;cursor:default"'} style="background:${bg};color:${col};border-color:${a.coordena ? '#1a5ca8' : bd};${a.coordena ? 'border-width:2px;' : ''}" title="${esc(nomePessoa(pe.id) + ' · ' + p.sigla + ' · ' + NIVEIS[a.nivel] + ' · ' + a.carga_pct + '%' + (a.atribuicao ? ' — ' + a.atribuicao : ''))}">${esc(a.papel || NIVEIS[a.nivel])}<br><b>${num(a.carga_pct)}%</b>${late ? ' <span style="color:var(--red)">●</span>' : ''}</button></td>`;
      }).join('')}</tr>`;
  }).join('')}</table></div>
  <div class="small muted mt">Borda azul = coordena o projeto · ● vermelho = tem tarefa atrasada no projeto · cores da carga: amarelo &lt;38%, verde 38–64%, azul 65–99%, laranja 100–114%, vermelho ≥115%</div>`;
}
function equipePessoas() {
  const ft = UI.f.peTipo || 'todos', q = norm(UI.f.peBusca), inat = !!UI.f.peInativos;
  const list = D.pessoas.filter(p => (inat || p.ativo !== false) && filtroTipo(p, ft)
    && (!q || norm([p.nome, p.funcao, p.curso, p.foco, (p.habilidades || []).join(' ')].join(' ')).includes(q))).sort(byName('nome'));
  return `<div class="toolbar"><div class="row">
      <select data-f="peTipo">${[['todos', 'Todos'], ['equipe', 'Equipe (sem IC)'], ['ic', 'Bolsistas IC']].map(([v, l]) => `<option value="${v}"${ft === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input id="peBusca" data-f="peBusca" placeholder="Nome, função, habilidade…" value="${esc(UI.f.peBusca || '')}">
      <label class="row small"><input type="checkbox" data-f="peInativos" ${inat ? 'checked' : ''}> mostrar inativos</label>
      <span class="small muted">${list.length} pessoa(s)</span></div>
    ${Perm.gerePessoas() ? `<button class="btn-p" data-a="pessoaNova">+ Nova pessoa</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Nome</th><th>Tipo / função</th><th>Curso</th><th class="num">Carga</th><th class="num">Dispon.</th><th>Projetos vigentes</th><th>Gerências</th></tr>
  ${list.map(p => {
    const projs = D.alocacoes.filter(a => a.pessoa_id === p.id && a.status === 'ativo' && Calc.vigente(byId('projetos', a.projeto_id))).map(a => siglaProjeto(a.projeto_id) + (a.coordena ? '★' : ''));
    const gers = Perm.gerenciasAtivas(p.id).map(g => g.nome.replace('Gerência ', ''));
    return `<tr class="click" data-a="pessoaAbrir" data-id="${p.id}"><td><b>${p.risco_sobrecarga ? '⚠ ' : ''}${esc(p.nome)}</b>${p.ativo === false ? ' ' + badge('inativo', 'b-gray') : ''}</td>
      <td class="small">${esc(lbl(TIPOS_PESSOA, p.tipo))}${p.funcao ? ' · ' + esc(p.funcao) : ''}</td><td class="small">${esc(p.curso || '')}${p.semestre ? ' · ' + p.semestre + 'º sem.' : ''}</td>
      <td class="num">${pillCarga(Calc.carga(p.id))}</td><td class="num small">${num(p.disponibilidade_pct)}%</td>
      <td class="small">${esc(projs.join(', ') || '—')}</td><td class="small">${esc(gers.join(', '))}</td></tr>`;
  }).join('')}</table></div>`;
}
A.pessoaAbrir = d => { UI.tab = 'equipe'; UI.pessoa = d.id; window.scrollTo(0, 0); render(); };
A.eqBolsas = () => { UI.tab = 'equipe'; UI.pessoa = null; UI.sub.equipe = 'bolsas'; render(); };
A.eqVagas = () => { UI.tab = 'equipe'; UI.pessoa = null; UI.sub.equipe = 'vagas'; render(); };
A.pessoaVoltar = () => { UI.pessoa = null; render(); };

/* ── Equipe › Vagas e seleção (todas as vagas do plano, em todos os projetos) ── */
function equipeVagas() {
  const fs = UI.f.vgSt || 'abertas', fc = UI.f.vgCat || '', fp = UI.f.vgProj || '';
  const vagas = D.equipe_plano.filter(e => (fs === 'abertas' ? ['vaga', 'selecao'].includes(e.status) : fs === 'selecao' ? e.status === 'selecao' : e.status !== 'cancelada')
    && (!fc || e.categoria === fc) && (!fp || e.projeto_id === fp)).sort((a, b) => String(siglaProjeto(a.projeto_id)).localeCompare(siglaProjeto(b.projeto_id)) || a.ordem - b.ordem);
  const abertas = D.equipe_plano.filter(e => e.status === 'vaga'), sel = D.equipe_plano.filter(e => e.status === 'selecao');
  const candAtivos = D.candidatos.filter(c => ['inscrito', 'entrevista', 'aprovado'].includes(c.status) && Perm.gereCandidatos(c.projeto_id));
  const bolsaVaga = e => { const b = D.equipe_plano_bolsas.find(x => x.vaga_id === e.id); return b && Perm.veFin(e.projeto_id) ? b : null; };
  const custo = [...abertas, ...sel].reduce((s, e) => s + num((bolsaVaga(e) || {}).valor_mensal), 0);
  const mets = [['Vagas abertas', abertas.length, abertas.length ? 'color:var(--yellow-txt)' : ''], ['Em seleção', sel.length], ['Candidatos em avaliação', candAtivos.length]];
  if (custo) mets.push(['Bolsas das vagas (R$/mês)', fmtBRL(custo)]);
  const projs = [...new Set(D.equipe_plano.map(e => e.projeto_id))].map(id => byId('projetos', id)).filter(Boolean).sort(byName('sigla'));
  const aberta = UI.f.vgAberta;
  const linhas = vagas.map(e => {
    const st = ST_VAGA[e.status], b = bolsaVaga(e), gere = Perm.gereAlocacao(e.projeto_id), gc = Perm.gereCandidatos(e.projeto_id);
    const cands = gc ? D.candidatos.filter(c => c.vaga_id === e.id) : [];
    const resumoC = cands.length ? Object.entries(cands.reduce((m, c) => (m[c.status] = (m[c.status] || 0) + 1, m), {})).map(([k, n]) => `${n} ${ST_CAND[k][0].toLowerCase()}`).join(' · ') : '';
    const venc = e.status === 'selecao' && e.selecao_prazo && e.selecao_prazo < hoje();
    const acoes = [];
    if (gere && e.status === 'vaga') acoes.push(`<button class="btn-s" data-a="vagaSelecao" data-id="${e.id}">Abrir seleção</button>`);
    if (gc && ['vaga', 'selecao'].includes(e.status)) acoes.push(`<button class="btn-s${aberta === e.id ? ' on' : ''}" data-a="vgCand" data-id="${e.id}">Candidatos${cands.length ? ` (${cands.length})` : ''}</button>`);
    if (gere && ['vaga', 'selecao'].includes(e.status)) acoes.push(`<button class="btn-s" data-a="vagaPreencher" data-id="${e.id}">Preencher</button>`);
    let sub = '';
    if (aberta === e.id && gc) sub = `<tr><td></td><td colspan="${Perm.veFin(e.projeto_id) ? 7 : 6}" style="background:#faf8f3">
      <div class="between mb"><span class="bold small">Candidatos — ${esc(e.nome_plano)}</span><button class="btn-s" data-a="candNovo" data-vaga="${e.id}">+ candidato</button></div>
      ${cands.length ? `<table class="t small"><tr><th>Nome</th><th>Curso / formação</th><th>Origem</th><th class="num">Nota</th><th>Situação</th><th></th></tr>${cands.sort((a, b) => num(b.nota) - num(a.nota)).map(c => `<tr class="click" data-a="candEditar" data-id="${c.id}">
        <td><b>${esc(c.nome)}</b>${c.email ? `<div class="muted">${esc(c.email)}</div>` : ''}</td><td>${esc(c.curso || '')}${c.lattes ? ` · <a href="${esc(c.lattes)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Lattes ↗</a>` : ''}</td><td>${esc(c.origem || '')}</td>
        <td class="num">${c.nota != null ? String(c.nota).replace('.', ',') : '—'}</td><td>${badge(ST_CAND[c.status][0], ST_CAND[c.status][1])}</td>
        <td>${gere && ['entrevista', 'aprovado'].includes(c.status) ? `<button class="btn-s" data-a="candContratar" data-id="${c.id}">Contratar</button>` : ''}</td></tr>`).join('')}</table>`
        : '<div class="empty small">Nenhum candidato registrado.</div>'}</td></tr>`;
    return `<tr${gere ? ` class="click" data-a="vagaEditar" data-id="${e.id}"` : ''}><td><button class="link" data-a="projAbrir" data-id="${e.projeto_id}" data-aba="equipe">${esc(siglaProjeto(e.projeto_id))}</button></td>
      <td><b>${esc(e.nome_plano)}</b><div class="small muted">${esc([e.funcao, lbl(CAT_PLANO, e.categoria)].filter(Boolean).join(' · '))}</div>${e.requisitos ? `<div class="small">${esc(e.requisitos)}</div>` : ''}</td>
      <td class="small">${esc(e.formacao || '—')}${e.horas_semanais != null ? `<div class="muted">${e.horas_semanais} h/semana</div>` : ''}</td>
      ${Perm.veFin(e.projeto_id) || vagas.some(x => Perm.veFin(x.projeto_id)) ? `<td class="small num">${b ? `${esc(b.modalidade || '')}<div><b>${fmtBRL(b.valor_mensal)}</b>/mês × ${b.meses}</div>` : ''}</td>` : ''}
      <td>${badge(st[0], st[1])}${e.status === 'selecao' && e.selecao_prazo ? `<div class="small" style="${venc ? 'color:var(--red);font-weight:600' : ''}">até ${fmtD(e.selecao_prazo)}</div>` : ''}${e.pessoa_id ? `<div class="small">${esc(nomePessoa(e.pessoa_id))}</div>` : ''}</td>
      <td class="small muted">${esc(resumoC)}</td><td style="white-space:nowrap">${acoes.join(' ')}</td></tr>${sub}`;
  }).join('');
  const temFin = vagas.some(x => Perm.veFin(x.projeto_id));
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:18px;${s || ''}">${v}</div></div>`).join('')}</div>
  <div class="toolbar"><div class="row">${[['abertas', 'Vagas abertas'], ['selecao', 'Em seleção'], ['todas', 'Todas as posições']].map(([k, l]) => `<button class="chip${fs === k ? ' on' : ''}" data-a="vgFiltro" data-v="${k}">${l}</button>`).join('')}
    <select data-f="vgCat" style="width:auto"><option value="">Todas as categorias</option>${CAT_PLANO.map(([k, l]) => `<option value="${k}"${fc === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <select data-f="vgProj" style="width:auto"><option value="">Todos os projetos</option>${projs.map(p => `<option value="${p.id}"${fp === p.id ? ' selected' : ''}>${esc(p.sigla)}</option>`).join('')}</select></div>
    <span class="small muted">As posições vêm da Equipe do plano de trabalho de cada projeto</span></div>
  <div class="card tw" style="padding:4px 8px">${vagas.length ? `<table class="t"><tr><th>Projeto</th><th>Posição</th><th>Formação / dedicação</th>${temFin ? '<th class="num">Bolsa prevista</th>' : ''}<th>Situação</th><th>Candidatos</th><th></th></tr>${linhas}</table>`
    : `<div class="empty">${fs === 'todas' ? 'Nenhuma posição cadastrada nos planos de trabalho.' : 'Nenhuma vaga aberta. 👍'}</div>`}</div>`;
}
A.vgFiltro = d => { UI.f.vgSt = d.v; render(); };
A.vgCand = d => { UI.f.vgAberta = UI.f.vgAberta === d.id ? null : d.id; render(); };
A.vagaSelecao = d => { const e = byId('equipe_plano', d.id);
  form({ title: 'Abrir seleção — ' + e.nome_plano, okLabel: 'Abrir seleção',
    fields: [{ k: 'requisitos', l: 'Perfil / requisitos', t: 'textarea', rows: 3, ph: 'ex.: Graduando em Eng. Mecânica a partir do 5º semestre; experiência com MATLAB' }, { k: 'selecao_prazo', l: 'Prazo da seleção', t: 'date' }],
    values: { requisitos: e.requisitos, selecao_prazo: e.selecao_prazo || addDays(hoje(), 30) },
    onSave: x => Data.update('equipe_plano', e.id, { ...x, status: 'selecao' }).then(() => { UI.f.vgAberta = e.id; }), okMsg: '✓ Seleção aberta' }); };
function camposCand() {
  return [{ k: 'nome', l: 'Nome', req: true }, { k: 'email', l: 'E-mail' }, { k: 'curso', l: 'Curso / formação' }, { k: 'lattes', l: 'Lattes (link)' },
    { k: 'origem', l: 'Origem', ph: 'ex.: edital interno 03/2026, indicação, PPGEM' }, { k: 'nota', l: 'Nota (0 a 10)', t: 'number', min: 0, max: 10, step: 0.1 },
    { k: 'status', l: 'Situação', t: 'select', blank: false, opts: Object.entries(ST_CAND).filter(([k]) => k !== 'contratado').map(([k, v]) => [k, v[0]]) }, { k: 'obs', l: 'Observações', t: 'textarea', rows: 2 }];
}
A.candNovo = d => { const e = byId('equipe_plano', d.vaga);
  form({ title: 'Novo candidato — ' + e.nome_plano, fields: camposCand(), values: { status: 'inscrito' }, onSave: x => Data.insert('candidatos', { ...x, vaga_id: e.id, projeto_id: e.projeto_id }) }); };
A.candEditar = d => { const c = byId('candidatos', d.id);
  form({ title: 'Candidato — ' + c.nome, fields: camposCand().map(f => f.k === 'status' && c.status === 'contratado' ? { ...f, ro: true, opts: [['contratado', 'Contratado']] } : f), values: c,
    onSave: x => { if (c.status === 'contratado') delete x.status; return Data.update('candidatos', c.id, x); }, onDelete: () => Data.remove('candidatos', c.id), deleteConfirm: `Excluir o registro de ${c.nome}?` }); };
A.candContratar = d => { const c = byId('candidatos', d.id); A.vagaPreencher({ id: c.vaga_id, candidato: c.id }); };

/* ── Equipe › Bolsas: vencendo, sem registro, bolsistas sem vínculo ── */
function equipeBolsas() {
  const dias = +(UI.f.bvDias || 60), lim = addDays(hoje(), dias);
  const vis = D.vinculos_financeiros.filter(v => Perm.veFin(v.projeto_id));
  const vencendo = vis.filter(v => ['previsto', 'ativo'].includes(v.status) && v.fim && v.fim >= hoje() && v.fim <= lim).sort(byName('fim'));
  const vencidas = vis.filter(v => ['previsto', 'ativo'].includes(v.status) && v.fim && v.fim < hoje()).sort(byName('fim'));
  const semReg = []; D.projetos.filter(p => Perm.veFin(p.id) && Calc.vigente(p)).forEach(p => Calc.equipePlano(p).rows.filter(r => r.e.status === 'ocupada' && r.bolsa && r.mesesRest > 0 && !r.vAtual).forEach(r => semReg.push({ p, r })));
  const bolsistas = D.pessoas.filter(pe => pe.ativo !== false && ['ic', 'mestrando', 'doutorando', 'pos_doc'].includes(pe.tipo)
    && D.alocacoes.some(a => a.pessoa_id === pe.id && a.status === 'ativo' && Calc.vigente(byId('projetos', a.projeto_id)) && Perm.veFin(a.projeto_id))
    && !D.vinculos_financeiros.some(v => v.pessoa_id === pe.id && ['previsto', 'ativo'].includes(v.status) && (!v.fim || v.fim >= hoje())));
  const ativos = vis.filter(v => v.status === 'ativo' && (!v.fim || v.fim >= hoje()) && (!v.inicio || v.inicio <= hoje()));
  const mets = [['Bolsas ativas', ativos.length], ['Valor mensal ativo', fmtBRL(ativos.reduce((s, v) => s + num(v.valor_mensal), 0))], [`Terminam em ${dias} dias`, vencendo.length, vencendo.length ? 'color:var(--yellow-txt)' : ''],
    ['Posições sem bolsa registrada', semReg.length, semReg.length ? 'color:var(--yellow-txt)' : ''], ['Bolsistas sem vínculo', bolsistas.length]];
  const lv = list => `<table class="t"><tr><th>Bolsista</th><th>Projeto</th><th>Modalidade / posição</th><th class="num">R$/mês</th><th>Término</th><th></th></tr>${list.map(v => { const d = Math.round((toDate(v.fim) - toDate(hoje())) / 864e5), pos = v.vaga_id && byId('equipe_plano', v.vaga_id);
      return `<tr><td><button class="link" data-a="pessoaAbrir" data-id="${v.pessoa_id}">${esc(nomePessoa(v.pessoa_id))}</button></td><td>${esc(siglaProjeto(v.projeto_id))}</td><td class="small">${esc(v.modalidade || lbl(TIPOS_VINC, v.tipo))}${pos ? `<div class="muted">${esc(pos.nome_plano)}</div>` : ''}</td>
        <td class="num">${fmtBRL(v.valor_mensal)}</td><td class="small" style="${d < 0 ? 'color:var(--red);font-weight:600' : d <= 30 ? 'color:var(--yellow-txt);font-weight:600' : ''}">${fmtD(v.fim)} · ${d < 0 ? `venceu há ${-d} dia(s)` : `${d} dia(s)`}</td>
        <td>${Perm.editaFin(v.projeto_id) ? `<button class="btn-s" data-a="vincEditar" data-id="${v.id}">${d < 0 ? 'Encerrar / prorrogar' : 'Prorrogar / editar'}</button>` : ''}</td></tr>`; }).join('')}</table>`;
  return `<div class="metrics">${mets.map(([k, v, s]) => `<div class="metric"><div class="k">${k}</div><div class="v" style="font-size:18px;${s || ''}">${v}</div></div>`).join('')}</div>
  ${vencidas.length ? `<div class="alert bad mb">${vencidas.length} bolsa(s) com término já passado e ainda marcadas como previstas/ativas — encerre ou prorrogue.</div><div class="card tw mb" style="padding:4px 8px">${lv(vencidas)}</div>` : ''}
  <div class="toolbar"><span class="sec" style="margin:0">Bolsas que terminam em breve</span><div class="row">${[30, 60, 90].map(n => `<button class="chip${dias === n ? ' on' : ''}" data-a="bvDias" data-v="${n}">${n} dias</button>`).join('')}</div></div>
  <div class="card tw" style="padding:4px 8px">${vencendo.length ? lv(vencendo) : `<div class="empty">Nenhuma bolsa termina nos próximos ${dias} dias.</div>`}</div>
  <div class="sec">Posições ocupadas com bolsa prevista, mas sem bolsa registrada</div>
  <div class="card tw" style="padding:4px 8px">${semReg.length ? `<table class="t"><tr><th>Projeto</th><th>Posição</th><th>Ocupante</th><th>Bolsa prevista</th><th class="num">Meses restantes</th><th></th></tr>${semReg.map(({ p, r }) => `<tr><td>${esc(p.sigla)}</td><td>${esc(r.e.nome_plano)}</td><td><button class="link" data-a="pessoaAbrir" data-id="${r.e.pessoa_id}">${esc(nomePessoa(r.e.pessoa_id))}</button></td>
      <td class="small">${esc(r.bolsa.modalidade || '')} · ${fmtBRL(r.bolsa.valor_mensal)}/mês</td><td class="num">${r.mesesRest}</td><td>${Perm.editaFin(p.id) ? `<button class="btn-s" data-a="vagaBolsa" data-id="${r.e.id}">Gerar bolsa</button>` : ''}</td></tr>`).join('')}</table>` : '<div class="empty">Todas as posições ocupadas com bolsa prevista têm bolsa registrada.</div>'}</div>
  <div class="sec">Bolsistas alocados sem bolsa registrada no Lab</div>
  <div class="card">${bolsistas.length ? bolsistas.map(pe => `<div class="row small mb" style="gap:8px"><button class="link" data-a="pessoaAbrir" data-id="${pe.id}">${esc(pe.nome)}</button><span class="muted">${esc(lbl(TIPOS_PESSOA, pe.tipo))} · ${esc(D.alocacoes.filter(a => a.pessoa_id === pe.id && a.status === 'ativo').map(a => siglaProjeto(a.projeto_id)).join(', '))}</span></div>`).join('') + '<div class="small muted mt">Pode ser bolsa de agência (CAPES, CNPq, FAPERGS) paga fora dos projetos — se for, registre como vínculo do tipo “Apoio externo” para ficar visível.</div>' : '<div class="empty small">Nenhum.</div>'}</div>`;
}
A.bvDias = d => { UI.f.bvDias = d.v; render(); };

/* ── Equipe › Entrada e saída (checklists) ── */
function blocoChecklist(pe, fase, compacto) {
  const c = Calc.checklistPessoa(pe, fase), pode = Perm.gerePessoa(pe.id), ok = c.filter(x => x.reg).length;
  return `<div class="small mb"><b>${ok} de ${c.length}</b> concluído(s)</div>` + c.map(x => `<label class="row small" style="gap:8px;padding:2px 0;${pode ? 'cursor:pointer' : ''}">
    <input type="checkbox" ${x.reg ? 'checked' : ''} ${pode ? `data-chk="${pe.id}|${x.i.id}"` : 'disabled'}> <span style="${x.reg ? 'color:var(--muted);text-decoration:line-through' : ''}">${esc(x.i.nome)}${x.i.obrigatorio ? '' : ' <span class="faint">(opcional)</span>'}</span>
    ${x.reg && !compacto ? `<span class="faint">${fmtD(x.reg.data)}</span>` : ''}</label>`).join('');
}
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset || !el.dataset.chk) return;
  const [pessoa_id, item_id] = el.dataset.chk.split('|');
  run(async () => {
    const ex = D.pessoa_checklist.find(r => r.pessoa_id === pessoa_id && r.item_id === item_id);
    if (ex) await Data.removeWhere('pessoa_checklist', { pessoa_id, item_id }); else await Data.insert('pessoa_checklist', { pessoa_id, item_id, feito: true, data: hoje() });
    render();
  });
});
function equipeTransicao() {
  const T = Calc.emTransicao().filter(x => x.pe.id === ME.pessoa_id || Perm.gerePessoa(x.pe.id));
  const ent = T.filter(x => x.fase === 'entrada'), sai = T.filter(x => x.fase === 'saida');
  const card = x => { const pe = x.pe, pode = Perm.gerePessoa(pe.id), tot = x.c.length, ok = tot - x.c.filter(y => !y.reg).length;
    const dias = x.fase === 'entrada' && pe.ingresso ? Math.round((toDate(hoje()) - toDate(pe.ingresso)) / 864e5) : null;
    return `<div class="card"><div class="between mb"><div><button class="link bold" data-a="pessoaAbrir" data-id="${pe.id}">${esc(pe.nome)}</button><div class="small muted">${esc(lbl(TIPOS_PESSOA, pe.tipo))} · ${x.fase === 'entrada' ? `ingresso ${fmtD(pe.ingresso) || '—'}${dias != null ? ` (há ${dias} dias)` : ''}` : `saída ${fmtD(pe.saida)}`} · ${esc(D.alocacoes.filter(a => a.pessoa_id === pe.id && a.status === 'ativo').map(a => siglaProjeto(a.projeto_id)).join(', ') || 'sem projeto ativo')}</div></div>
      <div style="min-width:110px">${barraAvanco(Math.round(ok / Math.max(1, tot) * 100), 0)}</div></div>${blocoChecklist(pe, x.fase, true)}
      ${x.fase === 'saida' && pode && !x.falta && pe.ativo !== false ? `<div class="mt"><button class="btn-p" data-a="pessoaInativar" data-id="${pe.id}">Concluir desligamento (marcar inativo)</button></div>` : ''}</div>`; };
  const gestor = Perm.dir() || Perm.tem('pessoas_gerir');
  return `<div class="toolbar"><span class="small muted">Integração: quem entrou nos últimos 12 meses com itens pendentes. Desligamento: quem tem data de saída (definida na ficha ou ao liberar uma posição).</span>${gestor ? '<button class="btn-s" data-a="chkConfig">Configurar itens…</button>' : ''}</div>
  <div class="sec">Em integração (${ent.length})</div>${ent.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${ent.map(card).join('')}</div>` : '<div class="card empty">Ninguém com integração pendente.</div>'}
  <div class="sec">Em desligamento (${sai.length})</div>${sai.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${sai.map(card).join('')}</div>` : '<div class="card empty">Nenhum desligamento em andamento.</div>'}`;
}
A.pessoaInativar = d => run(async () => { const pe = byId('pessoas', d.id);
  if (!await confirmar(`Marcar ${pe.nome} como inativo no laboratório? Ele(a) sai das listas, mas o histórico é mantido.`)) return;
  for (const a of D.alocacoes.filter(a => a.pessoa_id === pe.id && a.status === 'ativo')) await Data.update('alocacoes', a.id, { status: 'concluido' });
  await Data.update('pessoas', pe.id, { ativo: false }); flash('✓ Desligamento concluído'); render(); });
A.pessoaSaida = d => { const pe = byId('pessoas', d.id);
  form({ title: 'Desligamento — ' + pe.nome, okLabel: pe.saida ? 'Salvar' : 'Iniciar desligamento',
    intro: '<div class="note small mb">Define a data de saída e abre o checklist de desligamento (relatório final, encerramento da bolsa, devolução de chaves, remoção de acessos…). Alocações e bolsas não são alteradas aqui.</div>',
    fields: [{ k: 'saida', l: 'Data de saída', t: 'date', req: true }], values: { saida: pe.saida || hoje() },
    onSave: x => Data.update('pessoas', pe.id, x), onDelete: pe.saida ? () => Data.update('pessoas', pe.id, { saida: null }) : null, deleteLabel: 'Cancelar desligamento', deleteConfirm: 'Cancelar o desligamento (remove a data de saída)?' }); };
A.chkConfig = () => {
  const itens = fase => D.checklist_itens.filter(i => i.fase === fase).sort(by('ordem'));
  const lista = fase => itens(fase).map(i => `<tr class="click${i.ativo === false ? ' faint' : ''}" data-a="chkItemEditar" data-id="${i.id}"><td class="small muted">${i.ordem}</td><td>${esc(i.nome)}${i.obrigatorio ? '' : ' <span class="faint">(opcional)</span>'}</td><td class="small">${(i.tipos || []).length ? esc(i.tipos.map(t => lbl(TIPOS_PESSOA, t)).join(', ')) : 'todos'}</td></tr>`).join('');
  openModal(`<div class="between mb"><h3 style="margin:0">Itens de entrada e saída</h3><button class="btn-s" id="ck_x">✕</button></div>
    ${['entrada', 'saida'].map(f => `<div class="between"><span class="sec">${f === 'entrada' ? 'Entrada (integração)' : 'Saída (desligamento)'}</span><button class="btn-s" data-a="chkItemNovo" data-fase="${f}">+ item</button></div><table class="t"><tr><th>#</th><th>Item</th><th>Aplica-se a</th></tr>${lista(f)}</table>`).join('')}
    <div class="small muted mt">Nunca registre aqui dados bancários ou documentos pessoais — só se a etapa foi cumprida.</div>`, { wide: true });
  document.getElementById('ck_x').onclick = closeModal;
};
function camposChkItem() {
  return [{ k: 'fase', l: 'Fase', t: 'select', blank: false, opts: [['entrada', 'Entrada'], ['saida', 'Saída']] }, { k: 'nome', l: 'Item', req: true, full: true },
    { k: 'tipos', l: 'Aplica-se a (nenhum marcado = todos)', t: 'multi', opts: TIPOS_PESSOA }, { k: 'obrigatorio', l: 'Obrigatório', t: 'check' },
    { k: 'ordem', l: 'Ordem', t: 'number', min: 0 }, { k: 'ativo', l: 'Em uso', t: 'check' }];
}
A.chkItemNovo = d => form({ title: 'Novo item de checklist', fields: camposChkItem(), values: { fase: d.fase, obrigatorio: true, ativo: true, tipos: [], ordem: Math.max(0, ...D.checklist_itens.filter(i => i.fase === d.fase).map(i => i.ordem)) + 1 },
  onSave: x => Data.insert('checklist_itens', x) });
A.chkItemEditar = d => { const i = byId('checklist_itens', d.id);
  form({ title: 'Item de checklist', fields: camposChkItem(), values: i, onSave: x => Data.update('checklist_itens', i.id, x),
    onDelete: () => Data.remove('checklist_itens', i.id), deleteConfirm: 'Excluir este item? As marcações já feitas nele também são apagadas. Para parar de usar mantendo o histórico, desmarque “Em uso”.' }); };

function camposPessoa(p) {
  const gestor = !p || Perm.gerePessoas();
  return [
    { k: 'nome', l: 'Nome completo', req: true, full: true },
    { k: 'email', l: 'E-mail (liga ao login)', ro: !gestor }, { k: 'tipo', l: 'Tipo', t: 'select', blank: false, opts: TIPOS_PESSOA, ro: !gestor },
    { k: 'funcao', l: 'Função (ex.: COG, Controller)', ro: !gestor }, { k: 'ingresso', l: 'Ingresso no laboratório', t: 'date' }, { k: 'saida', l: 'Saída do laboratório (desligamento)', t: 'date', ro: !gestor },
    { k: 'curso', l: 'Curso (IC)' }, { k: 'semestre', l: 'Semestre (IC)', t: 'number', min: 1, max: 20 },
    { k: 'foco', l: 'Foco (Experimental / Numérico / Gestão)' },
    { k: 'formacao', l: 'Formação (Graduado, Mestre, Doutor…)' }, { k: 'lattes', l: 'Currículo Lattes (link)' },
    { k: 'disponibilidade_pct', l: 'Disponibilidade alocável (%)', t: 'number', min: 0, max: 100, step: 5 },
    { k: 'perfil_disponibilidade', l: 'Perfil de participação', t: 'select', blank: false, opts: PERFIS_DISP },
    { k: 'obs_disponibilidade', l: 'Observação de disponibilidade' },
    { k: 'risco_sobrecarga', l: 'Marcar risco de sobrecarga ⚠', t: 'check', ro: !gestor }, { k: 'ativo', l: 'Ativo no laboratório', t: 'check', ro: !gestor },
    { k: 'habilidades', l: 'Habilidades (separadas por vírgula)', t: 'tags', rows: 3 },
    { k: 'resumo', l: 'Atribuições gerais', t: 'textarea' }];
}
A.pessoaNova = () => form({ title: 'Nova pessoa', fields: camposPessoa(null), values: { tipo: 'outro', disponibilidade_pct: 100, perfil_disponibilidade: 'interno', ativo: true },
  onSave: async x => { if (x.semestre != null) x.semestre = Math.round(x.semestre); if (x.disponibilidade_pct == null) x.disponibilidade_pct = 100; const p = await Data.insert('pessoas', x); UI.pessoa = p.id; } });
A.pessoaEditar = d => {
  const p = byId('pessoas', d.id);
  form({ title: 'Editar — ' + p.nome, fields: camposPessoa(p), values: p,
    onSave: x => { if (x.semestre != null) x.semestre = Math.round(x.semestre); if (x.disponibilidade_pct == null) x.disponibilidade_pct = 100; return Data.update('pessoas', p.id, x); },
    onDelete: Perm.dir() ? async () => { await Data.remove('pessoas', p.id); UI.pessoa = null; } : null,
    deleteConfirm: `Excluir ${p.nome} definitivamente?\nAlocações, habilitações, participação em gerências e responsabilidade por tarefas serão apagadas.\n\nPara quem saiu do laboratório, prefira desmarcar "Ativo".` });
};
function pessoaDetalhe(p) {
  const podeEd = Perm.gerePessoas() || (Perm.podeEditar() && p.id === ME.pessoa_id);
  const alocs = D.alocacoes.filter(a => a.pessoa_id === p.id).sort((a, b) => Calc.vigente(byId('projetos', b.projeto_id)) - Calc.vigente(byId('projetos', a.projeto_id)));
  const tarefas = D.tarefas.filter(t => D.tarefa_responsaveis.some(r => r.tarefa_id === t.id && r.pessoa_id === p.id));
  const vincs = D.vinculos_financeiros.filter(v => v.pessoa_id === p.id && Perm.veFin(v.projeto_id));
  const gers = D.gerencia_membros.filter(gm => gm.pessoa_id === p.id);
  const habs = D.infra_habilitacoes.filter(h => h.pessoa_id === p.id);
  return `<div class="between mb"><div class="row"><button class="btn-s" data-a="pessoaVoltar">← Equipe</button><span class="title" style="font-size:18px">${p.risco_sobrecarga ? '⚠ ' : ''}${esc(p.nome)}</span>${p.ativo === false ? badge('inativo', 'b-gray') : ''}</div>
    <div class="row">${Perm.gerePessoa(p.id) && !p.saida && p.ativo !== false ? `<button data-a="pessoaSaida" data-id="${p.id}">Iniciar desligamento</button>` : ''}${podeEd ? `<button data-a="pessoaEditar" data-id="${p.id}">✎ Editar</button>` : ''}</div></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    <div class="card"><div class="kv"><span class="k">Tipo</span><span>${esc(lbl(TIPOS_PESSOA, p.tipo))}${p.funcao ? ' · ' + esc(p.funcao) : ''}</span>
      <span class="k">E-mail</span><span>${esc(p.email || '—')}</span>
      ${p.curso ? `<span class="k">Curso</span><span>${esc(p.curso)}${p.semestre ? ' · ' + p.semestre + 'º semestre' : ''}</span>` : ''}
      ${p.foco ? `<span class="k">Foco</span><span>${esc(p.foco)}</span>` : ''}
      ${p.formacao ? `<span class="k">Formação</span><span>${esc(p.formacao)}</span>` : ''}
      ${p.lattes ? `<span class="k">Lattes</span><span><a href="${esc(p.lattes)}" target="_blank" rel="noopener">${esc(p.lattes.replace(/^https?:\/\//, ''))} ↗</a></span>` : ''}
      <span class="k">Ingresso</span><span>${fmtD(p.ingresso)}${p.saida ? ` · <b style="color:var(--yellow-txt)">saída ${fmtD(p.saida)}</b>` : ''}</span>
      <span class="k">Carga atual</span><span>${pillCarga(Calc.carga(p.id))}</span>
      <span class="k">Disponibilidade</span><span>${num(p.disponibilidade_pct)}% · ${esc(lbl(PERFIS_DISP, p.perfil_disponibilidade))}${p.obs_disponibilidade ? ' · ' + esc(p.obs_disponibilidade) : ''}</span></div>
      ${p.resumo ? `<div class="note mt">${esc(p.resumo)}</div>` : ''}
      ${(p.habilidades || []).length ? `<div class="mt">${p.habilidades.map(h => `<span class="tag">${esc(h)}</span>`).join('')}</div>` : ''}</div>
    <div class="card"><div class="bold mb">Funções de gestão</div>
      ${gers.length ? gers.map(gm => { const g = byId('gerencias', gm.gerencia_id); const ativo = (!gm.desde || gm.desde <= hoje()) && (!gm.ate || gm.ate >= hoje()); return `<div class="small mb">${badge(g ? g.nome : '?', ativo ? 'b-blue' : 'b-gray')} ${gm.funcao} · ${fmtD(gm.desde)}${gm.ate ? ' → ' + fmtD(gm.ate) : ''}</div>`; }).join('') : '<div class="small faint mb">Nenhuma gerência.</div>'}
      ${alocs.filter(a => a.coordena).map(a => `<div class="small mb">${badge('Coordenação · ' + siglaProjeto(a.projeto_id), 'b-green')}</div>`).join('')}
      ${habs.length ? `<div class="bold mb mt">Habilitações em infraestrutura</div>${habs.map(h => `<div class="small mb">${esc((byId('infra_itens', h.item_id) || {}).nome || '')} · ${esc(lbl(NIVEL_HAB, h.nivel))}${h.validade ? ' · até ' + fmtD(h.validade) : ''}${h.validade && h.validade < hoje() ? ' ' + badge('vencida', 'b-red') : ''}</div>`).join('')}` : ''}</div>
  </div>
  ${(() => { const pos = D.equipe_plano.filter(e => e.pessoa_id === p.id); return pos.length ? `<div class="sec">Posições no plano de trabalho</div><div class="card tw" style="padding:4px 8px"><table class="t"><tr><th>Projeto</th><th>Posição</th><th>Função no edital</th><th>Desde</th><th>Etapas</th>${pos.some(e => Perm.veFin(e.projeto_id)) ? '<th>Bolsa</th>' : ''}</tr>${pos.map(e => { const r = linhaVaga(e.id), pr = byId('projetos', e.projeto_id);
      return `<tr><td><button class="link" data-a="projAbrir" data-id="${e.projeto_id}" data-aba="equipe">${esc(pr.sigla)}</button></td><td>${esc(e.nome_plano)}</td><td class="small">${esc(e.funcao || '')}</td><td class="small">${fmtD(e.desde)}</td><td class="small">${chipsEtapas(pr, e.etapas)}</td>${Perm.veFin(e.projeto_id) ? `<td class="small">${r.bolsa ? `${fmtBRL(r.bolsa.valor_mensal)}/mês · ${r.mesesVinc}/${r.bolsa.meses} meses${r.vAtual ? ' · até ' + fmtD(r.vAtual.fim) : ' · <span style="color:var(--yellow-txt)">sem bolsa registrada</span>'}` : '—'}</td>` : ''}</tr>`; }).join('')}</table></div>` : ''; })()}
  ${(() => { const ent = D.entregas.filter(e => e.responsavel_id === p.id && Calc.entregaAberta(e)), pen = D.pendencias.filter(x => x.responsavel_id === p.id && Calc.pendenciaAberta(x)), atv = D.cronograma.filter(c => c.responsavel_id === p.id && c.mes_inicio && !['concluida', 'cancelada'].includes(c.status));
    if (!ent.length && !pen.length && !atv.length) return '';
    const li = (tipo, txt, pid, aba, prazo, atr) => `<div class="row small mb click" data-a="projAbrir" data-id="${pid}" data-aba="${aba}" style="gap:8px"><span class="b b-gray">${esc(siglaProjeto(pid))}</span><span class="muted" style="width:88px">${tipo}</span><span style="flex:1">${esc(txt)}</span><span style="${atr ? 'color:var(--red);font-weight:600' : ''}">${prazo || ''}</span></div>`;
    return `<div class="sec">Responsabilidades em aberto</div><div class="card">${[...ent.map(e => li('Entrega', e.titulo, e.projeto_id, 'entregas', fmtD(e.prazo), Calc.entregaAtrasada(e))), ...pen.map(x => li('Pendência', x.titulo, x.projeto_id, 'docs', fmtD(x.prazo), Calc.pendenciaAtrasada(x))),
      ...atv.map(c => { const pr = byId('projetos', c.projeto_id); return li('Atividade ' + c.codigo, c.titulo, c.projeto_id, 'cronograma', c.mes_fim && pr ? 'até ' + fmtMes(Calc.mesDataFim(pr, c.mes_fim)) : '', false); })].join('')}</div>`; })()}
  ${(p.id === ME.pessoa_id || Perm.gerePessoa(p.id)) && (p.ingresso || p.saida || D.pessoa_checklist.some(r => r.pessoa_id === p.id)) ? `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));margin-top:12px">
    <div class="card"><div class="bold mb">Integração (entrada)</div>${blocoChecklist(p, 'entrada')}</div>
    ${p.saida ? `<div class="card"><div class="between mb"><span class="bold">Desligamento — saída ${fmtD(p.saida)}</span>${Perm.gerePessoa(p.id) ? `<button class="btn-s" data-a="pessoaSaida" data-id="${p.id}">editar</button>` : ''}</div>${blocoChecklist(p, 'saida')}</div>` : ''}</div>` : ''}
  <div class="sec between"><span>Alocações em projetos</span>${Perm.dir() || Perm.tem('alocacoes_gerir') ? `<button class="btn-s" data-a="alocNova" data-pessoa="${p.id}">+ alocar</button>` : ''}</div>
  <div class="card tw" style="padding:4px 8px">${alocs.length ? `<table class="t"><tr><th>Projeto</th><th>Papel</th><th>Nível</th><th class="num">Carga</th><th>Atribuição</th><th>Status</th></tr>
    ${alocs.map(a => { const pr = byId('projetos', a.projeto_id); const pode = Perm.gereAlocacao(a.projeto_id); return `<tr class="${pode ? 'click' : ''}" ${pode ? `data-a="alocEditar" data-id="${a.id}"` : ''} style="${Calc.vigente(pr) ? '' : 'opacity:.55'}"><td><b>${esc(siglaProjeto(a.projeto_id))}</b> ${a.coordena ? badge('coordena', 'b-green') : ''}${Calc.vigente(pr) ? '' : ' <span class="small faint">(não vigente)</span>'}</td><td>${esc(a.papel || '—')}</td><td>${NIVEIS[a.nivel]}</td><td class="num">${pillCarga(num(a.carga_pct))}</td><td class="small">${esc(a.atribuicao || '')}</td><td>${esc(lbl(ST_ALOC, a.status))}</td></tr>`; }).join('')}</table>` : '<div class="empty">Sem alocações.</div>'}</div>
  <div class="sec between"><span>Tarefas (${tarefas.filter(t => !t.concluida).length} abertas)</span>${Perm.podeEditar() ? `<button class="btn-s" data-a="tarefaNova" data-pessoa="${p.id}">+ tarefa</button>` : ''}</div>
  <div class="card">${listaTarefas(tarefas)}</div>
  <div class="mt">${ganttTarefas(tarefas)}</div>
  ${vincs.length ? `<div class="sec">Bolsas e pagamentos</div><div class="card tw" style="padding:4px 8px">${tabelaVinculos(vincs, { pessoa: false })}</div>` : ''}`;
}
