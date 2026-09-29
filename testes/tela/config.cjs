// Caminhos usados pelos testes de tela. Tudo é relativo a esta pasta:
//   Software de Gestão/
//     gpmot-portfolio-26-09-23.json          ← dados do programa antigo (entrada dos testes)
//     H - Fundep_..._revisao_final.xlsx      ← planilha do edital (tem CPFs: NÃO copiar para o código-fonte)
//     codigo-fonte/app/gpmot.html            ← programa montado por build.cjs
//     codigo-fonte/testes/tela/saida/        ← capturas de tela e arquivos gerados (pode apagar)
// Para usar outros arquivos: defina GPMOT_DADOS_V1 e/ou GPMOT_PLANILHA com o caminho completo.
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const RAIZ = path.resolve(__dirname, '..', '..');
const PASTA = path.resolve(RAIZ, '..');
const SAIDA = path.join(__dirname, 'saida'); fs.mkdirSync(SAIDA, { recursive: true });
const achar = re => { try { const f = fs.readdirSync(PASTA).find(n => re.test(n) && !n.startsWith('~$')); return f ? path.join(PASTA, f) : null; } catch { return null; } };
const DADOS_V1 = process.env.GPMOT_DADOS_V1 || achar(/^gpmot-portfolio.*\.json$/i);
const PLAN_ORIG = process.env.GPMOT_PLANILHA || achar(/fundep.*\.xlsx$/i);
// O navegador de testes não anexa arquivos cujo caminho tem acento ("Gestão"): usa uma cópia temporária
// fora do código-fonte (a planilha tem dados pessoais), apagada ao fim do teste.
let PLANILHA = null;
if (PLAN_ORIG) { PLANILHA = path.join(require('os').tmpdir(), `gpmot_planilha_${process.pid}.xlsx`); fs.copyFileSync(PLAN_ORIG, PLANILHA);
  process.on('exit', () => { try { fs.unlinkSync(PLANILHA); } catch { } }); }
if (!DADOS_V1) throw new Error('Não encontrei o JSON do programa antigo (gpmot-portfolio-*.json) na pasta Software de Gestão. Defina GPMOT_DADOS_V1.');
// arquivo de backup gerado pelo t03 e reutilizado pelo t06 (caminho sem acento, fora do código-fonte)
const BACKUP = path.join(require('os').tmpdir(), 'gpmot_backup_teste.json');
module.exports = { BACKUP, APP: pathToFileURL(path.join(RAIZ, 'app', 'gpmot.html')).href, DADOS_V1, PLANILHA, SAIDA, saida: n => path.join(SAIDA, n) };
