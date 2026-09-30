# GPMOT/UFSM — Gestão de Portfólio · código-fonte

Programa de gestão de projetos, equipe, financeiro e infraestrutura do laboratório.
O produto final é **um único arquivo HTML** (funciona offline, sem instalar nada), montado a partir das partes em `app/`.
Versão do programa: **2.19** · versão do esquema do banco: **1.3**. Implantação no Supabase: veja `../Guia de implantação online (Supabase).docx`.

```
Software de Gestão/
├─ GPMOT_UFSM — Gestão de Portfólio v2.html      ← programa (modo local; gerado por build.cjs --publicar)
├─ GPMOT_UFSM — Gestão de Portfólio (online).html ← programa já conectado ao banco da equipe
├─ gpmot_schema.sql                              ← esquema do banco (cópia de codigo-fonte/banco/)
├─ gpmot-portfolio-26-09-23.json                 ← dados do programa antigo (usados nos testes)
├─ H - Fundep_…_revisao_final.xlsx               ← planilha do edital (tem CPFs — nunca copiar para o código-fonte)
└─ codigo-fonte/                                 (30 arquivos)
   ├─ README.md · build.cjs · .gitignore
   ├─ app/          8 partes do programa (editar aqui) + marca/ (logotipo e ícones)
   ├─ banco/        gpmot_schema.sql (banco completo) + atualização da versão anterior
   ├─ docs/         versão publicada pelo GitHub Pages (gerada pelo build)
   └─ testes/       tela.cjs · banco.sh + banco.sql + banco_esperado.txt · online.cjs + simulador_supabase.cjs · package.json
```

## Montar o programa

Requer **Node.js 18+** (https://nodejs.org).

```
cd codigo-fonte
node build.cjs              # gera app/gpmot.html
node build.cjs --publicar   # e copia para "../GPMOT_UFSM — Gestão de Portfólio v2.html"
node build.cjs --publicar --url https://xxxx.supabase.co --chave sb_publishable_...
                            # versão da equipe já conectada ao banco: "../GPMOT_UFSM — Gestão de Portfólio (online).html"
```

Use só a chave **pública** (publishable/anon); o build recusa a chave secreta.

Com `--url` o build também grava `docs/index.html`, a cópia publicada pelo **GitHub Pages** (Settings → Pages → branch `main`, pasta `/docs`). Depois de cada mudança no programa, gere de novo com `--url` e envie a pasta `docs` junto (index.html, manifesto e ícones).

**Identidade visual:** `app/marca/` tem o logotipo do GPMOT vetorizado (cor `#003963`), os ícones do aplicativo (PNG 192/512 e versão *maskable*) e `gpmot.ico` para atalhos do Windows. O programa usa o símbolo no menu lateral, o logotipo nas telas de entrada e o ícone na aba do navegador (tudo embutido no HTML, pela constante `MARCA` em `p3_ui.js`).

As partes são concatenadas nesta ordem, num único `<script>` (as funções de uma parte podem usar as das outras):

| Parte | Conteúdo |
|---|---|
| `p1_head.html` | estilos (CSS) e estrutura da página: menu lateral, área principal, janelas |
| `p2_core.js` | **núcleo**: tabelas (espelho do banco), permissões (`Perm`, `POLICY`), validações (`validar`), travas, efeitos (equivalentes aos gatilhos do banco), camada de dados (`Data`: modo local / Supabase) e todos os cálculos (`Calc`: orçamento, cronograma, equipe do plano, desembolso, saúde dos projetos, agenda…) |
| `p3_ui.js` | menu, formulários, Painel, Projetos (todas as abas do projeto), Cronograma, Equipe |
| `p4a_extract.js` | leitura de texto de editais (Prospecção), herdada da versão anterior |
| `p4_modulos.js` | Entregas, Gerências, Tarefas, Financeiro (resumo, compras, calendário de bolsas, orçamento, plano de aplicação, desembolso, despesas, bolsas), Prospecção, Infraestrutura |
| `p6_import.js` | leitor de .xlsx embutido e importação da planilha padrão do edital (parte UFSM) |
| `p7_rel.js` | gerador de Word (.docx) embutido e relatório físico-financeiro por projeto |
| `p5_final.js` | relatório do laboratório, configurações, backup, conversão do programa antigo, envio ao banco online e inicialização |

**Regra de ouro:** toda regra de negócio existe em dois lugares — no banco (`banco/gpmot_schema.sql`, que é quem decide no modo online) e em `p2_core.js` (que faz o papel do banco no modo local). Ao mudar uma, mude a outra e rode os dois conjuntos de testes.

## Testes

Ficam em `testes/`, com uma instalação única (Node.js 18+):

```
cd codigo-fonte/testes
npm install                        # Playwright, supabase-js, esbuild, pg (uma vez)
npx playwright install chromium    # navegador de testes (uma vez)
npm run preparar                   # empacota o supabase-js para o teste online (uma vez)
```

Monte o programa antes (`node build.cjs`). Capturas e logs vão para `testes/saida/` — podem conter dados pessoais; não compartilhe essa pasta.

### Tela — `node tela.cjs`

Abre `app/gpmot.html` no Chromium, carrega os dados do programa antigo e, quando precisa, importa a planilha do edital da pasta `Software de Gestão` (por uma cópia temporária fora do código-fonte, apagada ao final). Cada teste roda num processo próprio; `node tela.cjs t09 t14` roda só alguns (≈ 3 min todos). Linhas `CONSOLE ErroRegra: …` são validações provocadas de propósito.

| Teste | O que cobre |
|---|---|
| t01 | conversão dos dados do programa antigo e abertura de todas as janelas |
| t02 | permissões por perfil (Direção, gerências, coordenação, membro) |
| t03 | fluxo completo: criar projeto, alocar, tarefa, prospecção, infraestrutura, gerência, relatório do lab, backup e restauração |
| t04–t05 | menu lateral, sub-abas e rolagem |
| t06–t07 | orçamento por rubricas, despesas, bolsas, CSV e edição das células (t06 usa o backup gerado pelo t03) |
| t08 | contrato, termos aditivos e entregas |
| t09 | importação da planilha do edital e cronograma físico |
| t10–t14 | equipe do plano, plano de aplicação, desembolso, documentos e pendências, Equipe (seleção e contratação) |
| t15–t18 | Painel, relatório físico-financeiro (.docx), Cronograma do portfólio, Financeiro geral |
| t19 | tela de abertura (1 s) e quadro Sobre |
| `desempenho` | diagnóstico: tempo de cada tela com ≈ 11 mil registros (`node tela.cjs desempenho`) |
| `celular` | diagnóstico: telas num celular de 390 px (`node tela.cjs celular`) |

### Banco — `bash banco.sh`

Requer **PostgreSQL 16** local e `psql` no PATH (no Windows, Git Bash ou WSL). Cada seção `-- @@ nome` de `banco.sql` roda num banco novo — simulação do login (seção 00), esquema e roteiro — e a saída é comparada com a mesma seção de `banco_esperado.txt`. As linhas `ERROR:` são **bloqueios esperados**. `bash banco.sh 09_desembolso` roda um; `bash banco.sh --atualizar` regrava o esperado (só após mudança intencional). **Nunca rode na Supabase de produção**: a seção 00 cria um esquema `auth` falso.

### Online — `node online.cjs`

Recria um banco de teste no PostgreSQL local, sobe `simulador_supabase.cjs` (o subconjunto da API da Supabase que o programa usa, executando tudo com o papel `authenticated`, de modo que permissões, políticas, gatilhos e visões valem de verdade) e roda o programa com a biblioteca oficial `supabase-js`. Cobre: chave secreta recusada; login por código; aprovação; envio e reenvio do backup (inclusive dados antigos com campos faltando); gravações com gatilhos; edição simultânea; membro vendo só o que o banco permite; Direção permanente; e a lista `COLUNAS` do programa igual ao esquema.

## Fluxo para alterar o programa

1. Edite as partes em `app/` (e, se mexer em regra de dados, também `banco/gpmot_schema.sql`).
2. Suba a versão em `p2_core.js` (`const VERSAO = '…'`) e, se mudou o banco, no cabeçalho do esquema.
3. `node build.cjs` → em `testes/`: `node tela.cjs` → `bash banco.sh` → `node online.cjs`. Se mudou colunas no banco, atualize também a lista `COLUNAS` em `p2_core.js` (o teste online confere).
4. `node build.cjs --publicar` (e com `--url … --chave …` para a versão online e o GitHub Pages); copie `banco/gpmot_schema.sql` para a pasta `Software de Gestão`.

## Dados e privacidade

- Planilhas de edital, backups (.json) e capturas de tela têm dados pessoais (CPF, e-mail, valores de bolsa) e **não** devem ir para repositórios — o `.gitignore` já os exclui.
- No modo local não há controle de acesso real (“Trocar usuário” permite simular qualquer perfil); as permissões valem de verdade no modo online (Supabase).
