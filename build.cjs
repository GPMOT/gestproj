// Monta o programa (um único HTML) a partir das partes em app/ e confere a sintaxe.
// Uso:  node build.cjs              → gera app/gpmot.html
//       node build.cjs --publicar   → também copia para ../GPMOT_UFSM — Gestão de Portfólio v2.html
//       node build.cjs --publicar --url https://xxxx.supabase.co --chave sb_publishable_...
//                                   → versão ONLINE da equipe, já conectada ao banco (abre direto no login):
//                                     ../GPMOT_UFSM — Gestão de Portfólio (online).html
//       Use só a chave PÚBLICA (publishable/anon). A chave secreta nunca vai para o programa.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const A = f => fs.readFileSync(path.join(__dirname, 'app', f), 'utf8');
const ORDEM = ['p1_head.html', 'p2_core.js', 'p3_ui.js', null, 'p4a_extract.js', 'p4_modulos.js', 'p6_import.js', 'p7_rel.js', 'p5_final.js'];
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
const destino = path.join(__dirname, 'app', 'gpmot.html'); fs.writeFileSync(destino, html);
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const tmp = path.join(os.tmpdir(), 'gpmot_check.js'); fs.writeFileSync(tmp, js);
const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
if (r.status !== 0) { console.error('ERRO DE SINTAXE:\n' + r.stderr); process.exit(1); }
const versao = (js.match(/VERSAO = '([\d.]+)'/) || [])[1];
console.log(`BUILD_OK — versão ${versao} — ${(html.length / 1024).toFixed(0)} KB → ${destino}`);
if (URL_SB) console.log('Versão online: conectada a ' + URL_SB);
if (process.argv.includes('--publicar')) { const pub = path.join(__dirname, '..', URL_SB ? 'GPMOT_UFSM — Gestão de Portfólio (online).html' : 'GPMOT_UFSM — Gestão de Portfólio v2.html'); fs.copyFileSync(destino, pub); console.log('Publicado em ' + pub); }
