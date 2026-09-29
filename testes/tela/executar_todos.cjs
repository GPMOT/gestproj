// Roda todos os testes de tela em sequência e resume o resultado.
// Uso:  node executar_todos.cjs            (todos)
//       node executar_todos.cjs t09 t14    (só alguns)
// Linhas "CONSOLE ErroRegra: …" são mensagens de validação que o próprio teste provoca de propósito — não são falhas.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const pedidos = process.argv.slice(2);
const testes = fs.readdirSync(__dirname).filter(f => /^t\d+\.cjs$/.test(f)).filter(f => !pedidos.length || pedidos.some(p => f.startsWith(p))).sort();
let falhas = 0;
for (const t of testes) {
  const ini = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, t)], { encoding: 'utf8', timeout: 240000 });
  const saida = (r.stdout || '') + (r.stderr || '');
  const problema = r.status !== 0 || /PAGEERR|TimeoutError|Error:/.test(saida.replace(/CONSOLE ErroRegra:.*/g, ''));
  fs.writeFileSync(path.join(__dirname, 'saida', t.replace('.cjs', '.log')), saida);
  console.log(`${problema ? '✗ FALHOU' : '✓ ok    '}  ${t}  (${((Date.now() - ini) / 1000).toFixed(1)} s)`);
  if (problema) { falhas++; console.log(saida.split('\n').filter(l => /PAGEERR|Error|Timeout|✗/.test(l)).slice(0, 6).map(l => '      ' + l).join('\n')); }
}
console.log(`\n${testes.length - falhas} de ${testes.length} testes ok. Logs e capturas em testes/tela/saida/`);
process.exit(falhas ? 1 : 0);
