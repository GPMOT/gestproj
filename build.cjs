// Monta o programa (um único HTML) a partir das partes em app/ e confere a sintaxe.
// Uso:  node build.cjs              → gera app/gpmot.html
//       node build.cjs --publicar   → também copia para ../GPMOT_UFSM — Gestão de Portfólio v2.html
//       node build.cjs --publicar --url https://xxxx.supabase.co --chave sb_publishable_...
//                                   → versão ONLINE da equipe, já conectada ao banco (abre direto no login):
//                                     ../GPMOT_UFSM — Gestão de Portfólio (online).html
//       Use só a chave PÚBLICA (publishable/anon). A chave secreta nunca vai para o programa.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const A = f => fs.readFileSync(path.join(__dirname, 'app', f), 'utf8');
const ORDEM = ['p1_head.html', 'p2_core.js', 'p3_ui.js', null, 'p4a_extract.js', 'p4_modulos.js', 'p6_import.js', 'p6b_plano.js', 'p6c_reformulacao.js', 'p7_rel.js', 'p5_final.js'];
let html = '';
for (const f of ORDEM) html += f ? A(f) : '\n/* ── extração de dados de texto (portado da versão anterior) ── */\n';
html += '\n</script>\n</body>\n</html>\n';
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
let URL_SB = arg('--url'); const CHAVE = arg('--chave');
try { if (URL_SB) URL_SB = new URL(URL_SB).origin; } catch { }   // aceita também a URL com /rest/v1/ no fim
if (URL_SB || CHAVE) {
  if (!/^https:\/\/[^/]+$/.test(URL_SB || '') || !CHAVE) { console.error('Informe --url https://xxxx.supabase.co e --chave sb_publishable_...'); process.exit(1); }
  let secreta = /^sb_secret_/.test(CHAVE); try { secreta = secreta || JSON.parse(Buffer.from(CHAVE.split('.')[1], 'base64url')).role === 'service_role'; } catch { }
  if (secreta) { console.error('Essa é a chave SECRETA do projeto. Use a chave pública (sb_publishable_... ou anon).'); process.exit(1); }
  const alvo = "const SUPABASE_CONFIG = { url: '', anonKey: '' };";
  if (!html.includes(alvo)) { console.error('Não encontrei SUPABASE_CONFIG em p2_core.js'); process.exit(1); }
  html = html.replace(alvo, `const SUPABASE_CONFIG = { url: ${JSON.stringify(URL_SB)}, anonKey: ${JSON.stringify(CHAVE)} };`);
}
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const tmp = path.join(os.tmpdir(), 'gpmot_check.js'); fs.writeFileSync(tmp, js);
const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
if (r.status !== 0) { console.error('ERRO DE SINTAXE:\n' + r.stderr); process.exit(1); }
// biblioteca do Supabase embutida (versão fixa, conferida pelo SHA-256): nada é baixado de terceiros ao abrir o programa
const LIB = 'supabase-js-2.117.2.min.js', LIB_SHA256 = 'f39f713bb8ce1ccb1ba2f15f16b26c89d38cd62fbe31ce7775a86c71b87ed2d8';
const lib = fs.readFileSync(path.join(__dirname, 'app', 'vendor', LIB), 'utf8');
if (require('crypto').createHash('sha256').update(lib).digest('hex') !== LIB_SHA256) { console.error('app/vendor/' + LIB + ' foi alterado (SHA-256 não confere).'); process.exit(1); }
if (/<\/script|<!--/i.test(lib)) { console.error('Biblioteca com trecho incompatível com HTML.'); process.exit(1); }
html = html.replace('\n<script>\n', () => '\n<script>' + lib + '\n</script>\n<script>\n');
// Política de segurança de conteúdo (CSP): só rodam os dois scripts deste arquivo (conferidos por hash);
// nada de código injetado, de outros sites ou de atributos onclick; conexões só com o banco do laboratório.
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${require('crypto').createHash('sha256').update(m[1].replace(/\r\n?/g, '\n')).digest('base64')}'`);
const conectar = URL_SB ? `${URL_SB} ${URL_SB.replace(/^https:/, 'wss:')}` : 'https: wss: http://localhost:* ws://localhost:*';
const CSP = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src data:; connect-src ${conectar}; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`;
if (!html.includes('__CSP__')) { console.error('Não encontrei __CSP__ em p1_head.html'); process.exit(1); }
html = html.replace('__CSP__', CSP);
const destino = path.join(__dirname, 'app', 'gpmot.html'); fs.writeFileSync(destino, html);
const versao = (js.match(/VERSAO = '([\d.]+)'/) || [])[1];
console.log(`BUILD_OK — versão ${versao} — ${(html.length / 1024).toFixed(0)} KB → ${destino}`);
if (URL_SB) {
  console.log('Versão online: conectada a ' + URL_SB);
  // cópia para o GitHub Pages (Settings → Pages → branch main, pasta /docs)
  const docs = path.join(__dirname, 'docs'); fs.mkdirSync(docs, { recursive: true });
  // manifesto e ícones: permitem "Instalar"/"Criar atalho" com o ícone do GPMOT
  const extra = '<meta name="robots" content="noindex">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icone-192.png">';
  fs.writeFileSync(path.join(docs, 'index.html'), html.replace('<head>', '<head>\n' + extra));
  for (const f of ['icone-192.png', 'icone-512.png', 'icone-maskable-512.png']) fs.copyFileSync(path.join(__dirname, 'app', 'marca', f), path.join(docs, f));
  fs.writeFileSync(path.join(docs, 'manifest.webmanifest'), JSON.stringify({
    name: 'GPMOT/UFSM — Gestão de Portfólio', short_name: 'GPMOT', lang: 'pt-BR', start_url: './', scope: './', display: 'standalone',
    background_color: '#eceae3', theme_color: '#003963',
    icons: [{ src: 'icone-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 1));
  console.log('GitHub Pages: ' + path.join(docs, 'index.html'));
}
if (process.argv.includes('--publicar')) { const pub = path.join(__dirname, '..', URL_SB ? 'GPMOT_UFSM — Gestão de Portfólio (online).html' : 'GPMOT_UFSM — Gestão de Portfólio v2.html'); fs.copyFileSync(destino, pub); console.log('Publicado em ' + pub); }
