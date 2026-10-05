# GPMOT/UFSM — Gestão de Portfólio · código-fonte

Programa de gestão de projetos, equipe, financeiro e infraestrutura do laboratório.
O produto final é **um único arquivo HTML** (funciona offline, sem instalar nada), montado a partir das partes em `app/`.
Versão do programa: **2.30** · versão do esquema do banco: **1.8**. Implantação no Supabase: veja `../Guia de implantação online (Supabase).docx`.

```
Software de Gestão/
├─ GPMOT_UFSM — Gestão de Portfólio v2.html      ← programa (modo local; gerado por build.cjs --publicar)
├─ GPMOT_UFSM — Gestão de Portfólio (online).html ← programa já conectado ao banco da equipe
├─ gpmot_schema.sql                              ← esquema do banco (cópia de codigo-fonte/banco/)
├─ gpmot-portfolio-26-09-23.json                 ← dados do programa antigo (usados nos testes)
├─ H - Fundep_…_revisao_final.xlsx               ← planilha do edital (tem CPFs — nunca copiar para o código-fonte)
├─ Plano_de_Trabalho_Final_-_SIGITEC.pdf · visualizaSolicitaçãoDeAditiv.pdf ← documentos da Petrobras (usados nos testes t21 e t23)
└─ codigo-fonte/                                 (39 arquivos)
   ├─ README.md · build.cjs · .gitignore
   ├─ app/          10 partes do programa (editar aqui) + marca/ (logotipo e ícones) + vendor/ (biblioteca supabase-js)
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

As partes são concatenadas nesta ordem, num único `<script>` (as funções de uma parte podem usar as das outras); antes dele o build embute `app/vendor/supabase-js-2.117.2.min.js` (versão fixa, conferida por SHA-256 em `build.cjs`):

| Parte | Conteúdo |
|---|---|
| `p1_head.html` | estilos (CSS) e estrutura da página: menu lateral, área principal, janelas |
| `p2_core.js` | **núcleo**: tabelas (espelho do banco), permissões (`Perm`, `POLICY`), validações (`validar`), travas, efeitos (equivalentes aos gatilhos do banco), camada de dados (`Data`: modo local / Supabase) e todos os cálculos (`Calc`: orçamento, cronograma, equipe do plano, desembolso, saúde dos projetos, agenda…) |
| `p3_ui.js` | menu, formulários, Painel, Projetos (todas as abas do projeto), Cronograma, Equipe |
| `p4a_extract.js` | leitura de texto de editais (Prospecção), herdada da versão anterior |
| `p4_modulos.js` | Entregas, Gerências, Tarefas, Financeiro (resumo, compras, calendário de bolsas, orçamento, plano de aplicação, desembolso, despesas, bolsas), Prospecção, Infraestrutura |
| `p6_import.js` | leitor de .xlsx embutido, leitura da planilha Mover/Fundep, prévia e gravação da importação de planos de trabalho |
| `p6b_plano.js` | leitor de PDF embutido, leitor do Plano de Trabalho SIGITEC (Petrobras), plano padrão GPMOT (.json), conferências e escolha do leitor (`LEITORES_PLANO`) |
| `p6c_reformulacao.js` | reformulações financeiras: leitor da Solicitação de Reformulação Financeira do SIGITEC, reformulação padrão (.json), comparação com o sistema, prévia, registro e aplicação (`LEITORES_REFORMULACAO`) |
| `p7_rel.js` | gerador de Word (.docx) embutido e relatório físico-financeiro por projeto |
| `p5_final.js` | relatório do laboratório, configurações, backup, conversão do programa antigo, envio ao banco online e inicialização |

**Regra de ouro:** toda regra de negócio existe em dois lugares — no banco (`banco/gpmot_schema.sql`, que é quem decide no modo online) e em `p2_core.js` (que faz o papel do banco no modo local). Ao mudar uma, mude a outra e rode os dois conjuntos de testes.

## Reprogramação do cronograma

Projetos atrasam: os prazos das atividades podem ser ajustados por **Direção, coordenação (e vice) e gerências** — estas pela permissão `cronograma_gerir` (dada a todas as gerências; a Direção pode retirá-la em Gerências). Gerências mudam prazos e andamento, não a estrutura do cronograma (código, título, responsável, entregas), que é da coordenação.

- **Reprogramar prazos…** (aba Cronograma físico): seleciona atividades ou etapas inteiras, desloca N meses (início e término, só término ou só início) ou digita os novos meses; motivo obrigatório e documento (ofício, aceite do financiador); avisa quando o término passa da vigência (aditivo de prazo).
- **Linha de base**: na 1ª mudança de cada atividade o banco guarda os meses originais (`mes_inicio_base`, `mes_fim_base`); a tabela mostra “orig.” e o desvio, o Gantt mostra o plano original em cinza, e os indicadores mostram quantas atividades foram reprogramadas e o deslocamento do término. Só a Direção redefine a linha de base (ex.: após aditivo aprovado).
- **Registro** (`reprogramacoes`): data, autor (gravado pelo banco), motivo, documento e cada atividade “de → para”; listado no fim da aba. A ficha de uma atividade também exige motivo quando os meses mudam.

## Reformulações financeiras

Remanejamentos entre rubricas, inclusão, exclusão ou alteração de itens e nova distribuição do desembolso, sempre a partir de uma solicitação enviada ao financiador. Podem registrar e aplicar: **Direção, coordenação (e vice) e gerências** — estas pela permissão `financeiro_reformular` (dada a todas as gerências; a Direção pode retirá-la em Gerências). Quem só tem `financeiro_reformular` vê o orçamento, o plano de aplicação, o desembolso e as reformulações do projeto, mas não despesas, bolsas pagas nem valores do contrato.

- **Projeto → Financeiro → Reformulações → Importar solicitação de reformulação…** lê o PDF do SIGITEC (Petrobras) ou uma reformulação padrão (.json) e mostra a prévia:
  - **conferências do documento** (29 na solicitação da Petrobras): vigente + diferença = proposto em cada natureza; total geral; os itens alterados somam a diferença da natureza; o orçamento completo proposto bate com o resumo, item a item e no desembolso;
  - **natureza → rubrica** (editável) e, por rubrica, *no sistema × vigente × proposto × rendimentos*;
  - **cada item** (inclusão, exclusão, alteração) com a sua justificativa e a situação no plano de aplicação do sistema (confere / valor diferente / não encontrado / será incluído).
- **Como aplicar**: só as operações da solicitação, ou **sincronizar com o orçamento completo proposto** (recomendado quando o sistema não reflete reformulações anteriores: o plano de aplicação passa a ser exatamente a relação proposta; itens fora dela ou zerados são cancelados — nunca apagados —; itens em aquisição ou adquiridos não são tocados). Rendimentos de aplicação financeira **não** entram no aprovado nem no valor do projeto: ficam numa linha à parte, abaixo do total do Orçamento por rubrica (“Total com rendimentos”), e podem ser incluídos no valor dos itens que os usam (o aviso de itens acima do aprovado os considera). A distribuição por rubrica das parcelas ainda **previstas** é atualizada.
- **Situação**: *submetida* só registra (o orçamento não muda); quando o financiador aprovar, abra o registro e use **Aprovada pelo financiador — aplicar**; *rejeitada* fica no histórico. O aprovado de cada rubrica passa a ser o **proposto** do documento (valor absoluto), com observação “antes → depois” na rubrica e em cada item.
- **Refazer**: carregar de novo a mesma solicitação oferece *substituir o registro e refazer a aplicação* — serve para corrigir o mapa natureza → rubrica ou as opções. Itens já lançados em outra rubrica mudam de rubrica (exceto os que têm gastos), nada é duplicado, e rubricas que só o mapa anterior usava voltam a zero.
- **Registro** (`reformulacoes`): nº, data de submissão, documento, justificativa técnica, autor (gravado pelo banco) e o retrato completo da solicitação em `alteracoes` (rubricas, itens, relação proposta, desembolso, opções e o resultado da aplicação). A Direção pode excluir o registro (o que já foi aplicado não é desfeito).
- **Outros financiadores**: o mesmo caminho do plano de trabalho — um leitor em `LEITORES_REFORMULACAO`, ou a **reformulação padrão (.json)** (`gpmot-reformulacao-1`, exportável pela prévia): `numero`, `data`, `documento`, `justificativa`, `naturezas: [{nome, rubrica?, vigente, proposto}]`, `itens: [{operacao: "I"|"E"|"A", natureza, descricao, origem, vigente: {quantidade, valor_unitario, valor}, proposto: {quantidade, valor_unitario, valor, aplicacao}, justificativa}]` e, opcional, `orcamento_proposto` (um plano padrão `gpmot-plano-1` com o orçamento completo depois da reformulação, que habilita a sincronização e o desembolso).

## Importação de planos de trabalho

Cada financiador tem seu próprio documento (planilha Mover/Fundep, PDF do SIGITEC da Petrobras, …). Para que a inclusão de um projeto novo seja sempre igual e confiável:

1. **Um formato único por dentro — o plano padrão GPMOT** (`gpmot-plano-1`). Todo leitor converte o documento para ele; a prévia, as conferências e a gravação são as mesmas para qualquer financiador.
2. **Um leitor por formato** (`LEITORES_PLANO` em `p6b_plano.js`): hoje, planilha Mover/Fundep (.xlsx), Plano de Trabalho SIGITEC/Petrobras (.pdf) e o próprio plano padrão (.json). O leitor de PDF é embutido (sem bibliotecas externas) e lê o texto com a posição de cada trecho, o que permite reconstruir as tabelas.
3. **Conferências automáticas**: os itens de cada natureza somam o total que o próprio documento declara; as naturezas somam o total geral; bolsas = total da equipe; parcelas = total; atividades dentro da duração; matriz equipe × atividades completa. Se algo não bate, a prévia mostra ✗ e exige confirmação explícita para importar.
4. **Revisão humana antes de gravar**: natureza de despesa → rubrica do GPMOT (editável), dados do projeto lado a lado com o documento (o que substituir), equipe, atividades, itens, desembolso e relatórios. Reimportar não duplica (mescla por código, número e descrição).
5. **Financiador novo**: se for recorrente, escreva um leitor (uma função que devolve o plano padrão), registre-o em `LEITORES_PLANO` e crie um teste como o t21. Se for pontual, gere o plano padrão (.json) — à mão, a partir do exemplo exportado pela prévia (“Baixar plano padrão”), ou pedindo a um assistente de IA que converta o documento para este formato — e importe-o: as mesmas conferências valem.

**Plano padrão (.json)** — campos (todos opcionais, exceto `formato`):
`formato: "gpmot-plano-1"`, `titulo`, `financiador`, `programa`, `chamada`, `linha`, `tema`, `duracao_meses`, `resumo`, `coordenador`, `fundacao`, `notas`, `total_geral` (total declarado no documento, para conferência);
`orcamento: [{natureza, rubrica?, valor}]` (rubrica GPMOT como "1.3"; se faltar, é sugerida pela natureza);
`etapas: [{codigo, nome, atividades: [{codigo, nome, descricao, mes_inicio, mes_fim, entrega, validador, responsavel}]}]`;
`equipe: [{nome, vaga, funcao, nivel, formacao, instituicao, email, lattes, horas_semanais, meses, atividades: [códigos ou nomes], bolsa: {modalidade, valor_mensal, meses, natureza}}]`;
`itens: [{natureza, descricao, justificativa, origem: "nacional"|"importado", quantidade, valor_unitario, moeda, cambio, detalhe, valor}]`;
`relatorios: [{titulo, mes, tipo}]` (vira Entregas, prazo no fim do mês indicado);
`desembolso: [{mes, descricao, valor, por_natureza: {natureza: valor}}]`.
Valores em número (6077620.00) ou texto no formato brasileiro ("6.077.620,00").

## Segurança

O arquivo HTML é público (GitHub Pages) e a chave *publishable* também: **quem protege os dados é o banco**. Todo acesso passa pelas regras de `banco/gpmot_schema.sql` (RLS linha a linha, gatilhos e permissões por coluna), valendo igualmente para quem usa o programa e para quem chama a API diretamente.

- **Banco:** nada para quem não fez login; login novo entra inativo até a Direção liberar; valores de projetos e aditivos só chegam a quem tem cargo (as colunas de valor não se leem nas tabelas — o programa lê pelas visões `v_projetos_tela` / `v_aditivos_tela`); dados pessoais de terceiros mascarados para a Leitura (`v_pessoas`); coordenação só definida pela Direção; e-mail do cadastro só alterado pela Direção/gestão de pessoas; links só `http(s)`; sem TRUNCATE; funções com caminho de busca fixo. Seção 15 do esquema e teste `15_protecoes_seguranca`.
- **Programa:** política de segurança de conteúdo (CSP) gerada pelo build — só rodam os scripts do próprio arquivo (conferidos por hash), sem código em atributos `onclick`, e as conexões só vão ao banco do laboratório; biblioteca embutida (nada é baixado de terceiros); todo texto vindo do banco passa por `esc()` e todo link por `urlSegura()`; não abre dentro de outra página.
- **Nunca** coloque em arquivos a chave secreta (`sb_secret_…`/service_role), a senha do banco ou senhas de e-mail. Ao mudar colunas ou permissões, lembre que um novo `grant select … on all tables` reabre as colunas de valor: execute de novo o bloco “valores” da seção 15d.
- A cada mudança (tabelas, funções ou telas novas), rode os três conjuntos de testes; o `online.cjs` confere que um membro sem cargo não obtém valores nem consultando a API diretamente.

## Testes

Ficam em `testes/`, com uma instalação única (Node.js 18+):

```
cd codigo-fonte/testes
npm install                        # Playwright, supabase-js, esbuild, pg (uma vez)
npx playwright install chromium    # navegador de testes (uma vez)
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
| t19 | tela de abertura (1 s) e janela Sobre |
| t21 | Plano de Trabalho SIGITEC (PDF) no projeto Petrobras: 22 conferências, orçamento, cronograma, equipe e bolsas, itens, desembolso, relatórios; reimportação sem duplicar; ida e volta pelo plano padrão (.json). Usa o PDF da pasta `Software de Gestão` (nome com “SIGITEC”); sem ele, o teste é pulado |
| t22 | reprogramação do cronograma: Direção desloca uma etapa inteira (motivo obrigatório, documento, plano original guardado, indicadores, Gantt com linha de base); gerência com `cronograma_gerir` muda prazos mas não a estrutura; ficha da atividade exige motivo; membro sem cargo não reprograma; Direção adota nova linha de base |
| t23 | reformulação financeira (5ª solicitação da Petrobras, PDF): 29 conferências, naturezas → rubricas, comparação item a item com o sistema, registro como submetida sem mudar o orçamento, aplicação por gerência (rubricas, 15 itens cancelados, cabeçote alterado, serviços incluídos com rendimentos, 2ª parcela redistribuída), não aplica duas vezes, reformulação padrão (.json) de ida e volta; membro sem cargo não registra. Usa o PDF da pasta (nome com “Solicitação” e “Aditivo”/“Reformulação”); sem ele, é pulado |
| t20 | perfis (Suporte técnico, Leitura, vice-coordenação) e valores de projeto: visíveis a quem tem cargo; Membro sem cargo e Leitura não veem |
| `desempenho` | diagnóstico: tempo de cada tela com ≈ 11 mil registros (`node tela.cjs desempenho`) |
| `celular` | diagnóstico: telas num celular de 390 px (`node tela.cjs celular`) |

### Banco — `bash banco.sh`

Requer **PostgreSQL 16** local e `psql` no PATH (no Windows, Git Bash ou WSL). Cada seção `-- @@ nome` de `banco.sql` roda num banco novo — simulação do login (seção 00), esquema e roteiro — e a saída é comparada com a mesma seção de `banco_esperado.txt`. As linhas `ERROR:` são **bloqueios esperados**. `bash banco.sh 09_desembolso` roda um; `bash banco.sh --atualizar` regrava o esperado (só após mudança intencional). **Nunca rode na Supabase de produção**: a seção 00 cria um esquema `auth` falso.

### Online — `node online.cjs`

Recria um banco de teste no PostgreSQL local, sobe `simulador_supabase.cjs` (o subconjunto da API da Supabase que o programa usa, executando tudo com o papel `authenticated`, de modo que permissões, políticas, gatilhos e visões valem de verdade) e roda o programa com a biblioteca oficial `supabase-js`. Cobre: chave secreta recusada; login por código; aprovação; envio e reenvio do backup (inclusive dados antigos com campos faltando); gravações com gatilhos; edição simultânea; membro vendo só o que o banco permite; Suporte técnico permanente; Leitura recebendo do banco só os próprios projetos, sem valores nem dados pessoais; membro sem cargo sem valores de projetos, nem pela API direta; vice-coordenação; e a lista `COLUNAS` do programa igual ao esquema.

## Fluxo para alterar o programa

1. Edite as partes em `app/` (e, se mexer em regra de dados, também `banco/gpmot_schema.sql`).
2. Suba a versão em `p2_core.js` (`const VERSAO = '…'`) e, se mudou o banco, no cabeçalho do esquema.
3. `node build.cjs` → em `testes/`: `node tela.cjs` → `bash banco.sh` → `node online.cjs`. Se mudou colunas no banco, atualize também a lista `COLUNAS` em `p2_core.js` (o teste online confere).
4. `node build.cjs --publicar` (e com `--url … --chave …` para a versão online e o GitHub Pages); copie `banco/gpmot_schema.sql` para a pasta `Software de Gestão`.

## Dados e privacidade

- Planilhas de edital, backups (.json) e capturas de tela têm dados pessoais (CPF, e-mail, valores de bolsa) e **não** devem ir para repositórios — o `.gitignore` já os exclui.
- No modo local não há controle de acesso real (“Trocar usuário” permite simular qualquer perfil); as permissões valem de verdade no modo online (Supabase).
