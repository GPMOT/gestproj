# GPMOT/UFSM — Gestão de Portfólio · código-fonte

Programa de gestão de projetos, equipe, financeiro e infraestrutura do laboratório.
O produto final é **um único arquivo HTML** (funciona offline, sem instalar nada), montado a partir das partes em `app/`.
Versão do programa: **2.18** · versão do esquema do banco: **1.3**. Implantação no Supabase: veja `../Guia de implantação online (Supabase).docx`.

```
Software de Gestão/
├─ GPMOT_UFSM — Gestão de Portfólio v2.html   ← programa publicado (gerado por build.cjs --publicar)
├─ gpmot_schema.sql                           ← esquema do banco publicado (cópia de codigo-fonte/banco/)
├─ gpmot-portfolio-26-09-23.json              ← dados do programa antigo (usados nos testes)
├─ H - Fundep_…_revisao_final.xlsx            ← planilha do edital (tem CPFs — nunca copiar para o código-fonte)
└─ codigo-fonte/
   ├─ build.cjs                  monta app/gpmot.html e confere a sintaxe
   ├─ app/                       partes do programa (editar aqui)
   ├─ banco/gpmot_schema.sql     esquema PostgreSQL/Supabase (tabelas, regras de acesso, gatilhos, visões)
   └─ testes/
      ├─ tela/                   testes automáticos da interface (Playwright + Chromium)
      └─ banco/                  testes das regras do banco (PostgreSQL local)
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

**Identidade visual:** `app/marca/` tem o logotipo e o símbolo do GPMOT vetorizados (cor `#003963`), os ícones do aplicativo (PNG 192/512, versão *maskable*, SVG) e `gpmot.ico` para atalhos do Windows. O programa usa o símbolo no menu lateral, o logotipo nas telas de entrada e o ícone na aba do navegador (tudo embutido no HTML, pela constante `MARCA` em `p3_ui.js`).

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

## Testes de tela

```
cd codigo-fonte/testes/tela
npm install                        # instala o Playwright (uma vez)
npx playwright install chromium    # baixa o navegador de testes (uma vez)
node executar_todos.cjs            # roda todos (≈ 3 min)
node executar_todos.cjs t09 t14    # roda só alguns
```

Os testes abrem `app/gpmot.html` (monte antes com `node build.cjs`), carregam os dados do programa antigo e, quando precisam, importam a planilha do edital da pasta `Software de Gestão` (por uma cópia temporária fora do código-fonte, apagada ao final). Capturas de tela e logs ficam em `testes/tela/saida/` — podem conter dados pessoais; não compartilhe essa pasta.
Linhas `CONSOLE ErroRegra: …` nos logs são validações que o teste provoca de propósito.

| Teste | O que cobre |
|---|---|
| t01 | conversão dos dados do programa antigo e abertura de todas as janelas |
| t02 | permissões por perfil (Direção, gerências, coordenação, membro) |
| t03 | fluxo completo: criar projeto, alocar, tarefa, prospecção, infraestrutura, gerência, relatório do lab, backup e restauração |
| t04 | menu lateral (rolagem independente) e sub-abas |
| t05 | rolagem do menu × conteúdo |
| t06 | orçamento por rubricas, migração da v2.0, despesas, bolsas e CSV (usa o backup gerado pelo t03) |
| t07 | edição das células do orçamento (foco, formato brasileiro, valores inválidos) |
| t08 | contrato, termos aditivos (prazo/valor, desfazer) e entregas |
| t09 | importação da planilha do edital e cronograma físico (Gantt, avanço, permissões do responsável) |
| t10 | equipe do plano de trabalho: vagas, preencher/liberar, bolsas com meses restantes |
| t11 | plano de aplicação: itens, gastos por item, cadastro na infraestrutura |
| t12 | desembolso: parcelas, recebimento parcial, caixa por rubrica, alertas |
| t13 | documentos e pendências: checklist documental, responsável, restritos |
| t14 | Equipe: vagas e seleção, candidatos, contratação, bolsas vencendo, entrada e saída |
| t15 | Painel: minha semana, portfólio, saúde dos projetos, linha do tempo |
| t16 | relatório físico-financeiro do projeto (prévia, .docx, Markdown, sem acesso financeiro) |
| t17 | Cronograma: Gantt do portfólio e carga da equipe por mês |
| t18 | Financeiro geral: resumo, compras e aquisições, calendário de bolsas |
| `desempenho.cjs` | tempo de cada tela e espaço no navegador com ≈ 11 mil registros (não entra no executar_todos) |
| `celular.cjs` | largura das telas num celular de 390 px (não entra no executar_todos) |

## Testes do banco

Requer **PostgreSQL 16** local (ou outro servidor de testes) e `psql` no PATH. **Nunca rode no Supabase de produção**: o arquivo `00_simulacao_supabase_auth.sql` cria um esquema `auth` falso para simular o login.

```
cd codigo-fonte/testes/banco
PGHOST=localhost PGPORT=5432 PGUSER=postgres ./executar.sh           # todos
./executar.sh 09_desembolso                                           # um
./executar.sh --atualizar                                             # regrava os esperados (só após mudança intencional)
```

Cada teste cria um banco temporário, aplica a simulação do login, o esquema e o roteiro, e compara a saída com `esperados/<teste>.txt`. As linhas `ERROR:` são **bloqueios esperados** — é o banco recusando o que deve recusar (acesso sem permissão, datas inválidas, regras do responsável etc.). No Windows, use o Git Bash ou o WSL.

## Teste do modo online

Testa o programa conectado a um banco, sem depender da nuvem: `testes/online/supabase_local.cjs` é um **simulador da API da Supabase** (o subconjunto do PostgREST e do login usado pelo programa) que roda sobre um PostgreSQL real com o papel `authenticated`, de modo que permissões, políticas (RLS), gatilhos e visões do esquema valem de verdade. O programa usa a biblioteca oficial `supabase-js`.

```
cd codigo-fonte/testes/online
npm install && npm run preparar      # uma vez: dependências e o supabase-js empacotado
PGHOST=localhost PGPORT=5432 PGUSER=postgres bash rodar.sh
```

Cobre: chave secreta recusada; login por código; primeiro acesso aguardando aprovação; liberação da Direção; envio do backup ao banco e conferência tabela a tabela; reenvio sem duplicar; gravações com gatilhos (aditivo, entrega, pendência); edição simultânea; segundo usuário (membro) vendo só o que o banco permite; e a lista `COLUNAS` do programa igual ao esquema. Usa os mesmos dados dos testes de tela.

## Fluxo para alterar o programa

1. Edite as partes em `app/` (e, se mexer em regra de dados, também `banco/gpmot_schema.sql`).
2. Suba a versão em `p2_core.js` (`const VERSAO = '…'`) e, se mudou o banco, no cabeçalho do esquema.
3. `node build.cjs` → `node testes/tela/executar_todos.cjs` → `testes/banco/executar.sh` → `testes/online/rodar.sh`. Se mudou colunas no banco, atualize também a lista `COLUNAS` em `p2_core.js` (o teste online confere).
4. `node build.cjs --publicar` e copie `banco/gpmot_schema.sql` para a pasta `Software de Gestão`.

## Dados e privacidade

- Planilhas de edital, backups (.json) e capturas de tela têm dados pessoais (CPF, e-mail, valores de bolsa) e **não** devem ir para repositórios — o `.gitignore` já os exclui.
- No modo local não há controle de acesso real (“Trocar usuário” permite simular qualquer perfil); as permissões valem de verdade no modo online (Supabase).
