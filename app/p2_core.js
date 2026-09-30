'use strict';
/* ════════════════════════════════════════════════════════════════════
   GPMOT/UFSM — Gestão de Portfólio · versão 2
   Estrutura de dados idêntica ao esquema gpmot_schema.sql (Supabase).

   ARMAZENAMENTO
   - Modo local: dados ficam neste navegador (para testes e uso offline).
   - Modo online: preencha SUPABASE_CONFIG abaixo (ou em Configurações)
     e o programa passa a ler e gravar no banco Supabase, com login.
   ════════════════════════════════════════════════════════════════════ */
const VERSAO = '2.19';
const VERSAO_DATA = '29/09/2026';
const SUPABASE_CONFIG = { url: '', anonKey: '' };   // ← preencher na implantação

/* ── utilidades ─────────────────────────────────────────────────── */
const pad2 = n => String(n).padStart(2, '0');
const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isoOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const hoje = () => isoOf(new Date());
const isDate = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; const d = new Date(s + 'T12:00:00'); return !isNaN(d) && isoOf(d) === s; };
const toDate = s => new Date(s + 'T12:00:00');
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtD = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—';
const fmtMes = s => s ? MESES[+s.slice(5, 7) - 1] + '/' + s.slice(0, 4) : '—';
const fmtDT = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
const fmtBRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtBRL2 = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const fmtMi = v => Number(v) > 0 ? 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + ' mi' : '—';
const num = v => Number(v) || 0;
const stripAccents = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => stripAccents(String(s || '')).toLowerCase().trim();
const monthsIncl = (a, b) => { if (!a || !b) return 0; const n = (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) + 1; return Math.max(0, n); };
const lastDayOfMonth = (y, m) => isoOf(new Date(y, m, 0)); // m = 1..12
const by = k => (a, b) => (a[k] ?? 0) < (b[k] ?? 0) ? -1 : (a[k] ?? 0) > (b[k] ?? 0) ? 1 : 0;
const byName = k => (a, b) => String(a[k] || '').localeCompare(String(b[k] || ''), 'pt-BR');
const clone = o => JSON.parse(JSON.stringify(o));

/* ── domínio: rótulos ───────────────────────────────────────────── */
const TIPOS_PESSOA = [['docente', 'Docente'], ['pesquisador', 'Pesquisador(a)'], ['pos_doc', 'Pós-doc'], ['doutorando', 'Doutorando(a)'], ['mestrando', 'Mestrando(a)'], ['tecnico', 'Técnico(a)'], ['ic', 'Bolsista IC'], ['externo', 'Externo'], ['outro', 'Outro']];
const PERFIS_DISP = [['interno', 'Interno operacional'], ['parcial', 'Parcial / compartilhado'], ['externo', 'Externo / parceiro'], ['formal', 'Proponente formal'], ['consultivo', 'Consultivo'], ['bloqueado', 'Não alocável']];
const STATUS_PROJ = { em_dia: ['Em dia', 'b-green', '#eaf3de', '#7db84a', '#27500a'], atencao: ['Atenção', 'b-yellow', '#faeeda', '#efaa2a', '#633806'], critico: ['Crítico', 'b-red', '#fcebeb', '#e24b4a', '#a32d2d'], pendente: ['Pendente', 'b-gray', '#f0ede8', '#c8c6c0', '#666'] };
const SITUACAO_PROJ = [['vigente', 'Vigente'], ['encerrado', 'Encerrado'], ['cancelado', 'Cancelado']];
const NIVEIS = ['—', 'Apoio', 'Colaborador', 'Principal'];
const NIVEL_CARGA = [0, 25, 50, 75];
const ST_ALOC = [['ativo', 'Ativo'], ['pausado', 'Pausado'], ['concluido', 'Concluído']];
const PRIORIDADES = [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
const PERMISSOES = [
  ['projetos_criar', 'Cadastrar novos projetos'],
  ['projetos_editar', 'Editar dados e cronograma de qualquer projeto'],
  ['alocacoes_gerir', 'Alocar pessoas e ajustar carga em qualquer projeto'],
  ['tarefas_gerir', 'Criar/editar tarefas em qualquer projeto'],
  ['pessoas_gerir', 'Cadastrar/editar pessoas, bolsistas IC e disponibilidade'],
  ['financeiro_ver', 'Ver bolsas e orçamento de todos os projetos'],
  ['financeiro_editar', 'Lançar/editar bolsas e orçamento de todos os projetos'],
  ['prospeccao_gerir', 'Registrar e avaliar prospecções'],
  ['historico_ver', 'Consultar o histórico de alterações'],
  ['infraestrutura_gerir', 'Gerir infraestrutura (itens, agenda, manutenção, habilitações)'],
];
const PAPEIS = [['direcao', 'Direção'], ['membro', 'Membro'], ['leitura', 'Leitura']];
const TIPOS_VINC = [['bolsa', 'Bolsa'], ['tecnico', 'Pagamento técnico'], ['servico', 'Serviço'], ['externo', 'Apoio externo'], ['outro', 'Outro']];
const ST_VINC = { previsto: ['Previsto', 'b-yellow'], ativo: ['Ativo', 'b-green'], suspenso: ['Suspenso', 'b-red'], encerrado: ['Encerrado', 'b-gray'] };
const ESTAGIOS = [['aprovado', 'Aprovado'], ['previsto', 'Previsto / em andamento'], ['executado', 'Executado']];
const PIPE = { avaliacao: ['Em avaliação', 'b-gray'], aprovada: ['Aprovada', 'b-green'], renegociar: ['Renegociar', 'b-yellow'], recusada: ['Recusada', 'b-red'], promovida: ['Promovida', 'b-blue'] };
const CAT_INFRA = [['laboratorio', 'Laboratório / sala'], ['celula_teste', 'Célula de teste'], ['banco_ensaio', 'Banco de ensaio'], ['bancada', 'Bancada'], ['equipamento', 'Equipamento'], ['instrumento', 'Instrumento'], ['software', 'Software / licença'], ['veiculo', 'Veículo'], ['outro', 'Outro']];
const ST_INFRA = { operacional: ['Operacional', 'b-green'], restrito: ['Uso restrito', 'b-yellow'], em_manutencao: ['Em manutenção', 'b-yellow'], inoperante: ['Inoperante', 'b-red'], desativado: ['Desativado', 'b-gray'] };
const ST_RES = { solicitada: ['Solicitada', 'b-yellow'], confirmada: ['Confirmada', 'b-blue'], cancelada: ['Cancelada', 'b-gray'], realizada: ['Realizada', 'b-green'] };
const TIPO_MAN = [['preventiva', 'Preventiva'], ['corretiva', 'Corretiva'], ['calibracao', 'Calibração'], ['inspecao', 'Inspeção'], ['seguranca', 'Segurança']];
const ST_MAN = { planejada: ['Planejada', 'b-gray'], em_andamento: ['Em andamento', 'b-yellow'], concluida: ['Concluída', 'b-green'], cancelada: ['Cancelada', 'b-gray'] };
const NIVEL_HAB = [['operador', 'Operador'], ['supervisor', 'Supervisor'], ['instrutor', 'Instrutor']];
const lbl = (list, v) => (list.find(x => x[0] === v) || [v, v || '—'])[1];
const badge = (text, cls) => `<span class="b ${cls || 'b-gray'}">${esc(text)}</span>`;
const badgeOf = (map, v) => { const x = map[v] || [v || '—', 'b-gray']; return badge(x[0], x[1]); };

const RUBRICAS_PADRAO = [   // [código, nome, rubrica-pai]
  ['1', 'Custeio', null], ['1.1', 'Pessoal', '1'], ['1.1.1', 'Bolsas', '1.1'], ['1.1.2', 'CLT', '1.1'],
  ['1.2', 'Viagens', '1'], ['1.2.1', 'Passagens', '1.2'], ['1.2.2', 'Diárias', '1.2'],
  ['1.3', 'Material de consumo', '1'], ['1.4', 'Serviços de Terceiros', '1'], ['1.5', 'Custos Administrativos', '1'],
  ['2', 'Capital', null], ['2.1', 'Material permanente', '2'], ['2.2', 'Obras', '2']];
const rubricasPadrao = () => RUBRICAS_PADRAO.map(([codigo, nome, pai], i) => ({ codigo, nome, pai, ordem: i + 1, planos: ['edital', 'servico'] }));
const TIPOS_PROJ = [['edital', 'Edital'], ['servico', 'Prestação de serviço']];
const TIPOS_ADITIVO = [['prazo', 'Prorrogação de prazo'], ['valor', 'Alteração de valor'], ['prazo_valor', 'Prazo e valor'], ['escopo', 'Alteração de escopo / plano de trabalho'], ['outro', 'Outro']];
const TIPOS_ENTREGA = [['relatorio_parcial', 'Relatório técnico parcial'], ['relatorio_final', 'Relatório técnico final'], ['prestacao_parcial', 'Prestação de contas parcial'], ['prestacao_final', 'Prestação de contas final'], ['marco', 'Marco / entregável'], ['reuniao', 'Reunião de acompanhamento'], ['outro', 'Outro']];
const CAT_PLANO = [['docente', 'Docente'], ['pesquisador', 'Pesquisador(a)'], ['pos_doc', 'Pós-doc'], ['doutorando', 'Doutorando(a)'], ['mestrando', 'Mestrando(a)'], ['tecnico', 'Técnico(a)'], ['ic', 'Graduando(a) / IC'], ['outro', 'Outro']];
const ST_VAGA = { vaga: ['Vaga aberta', 'b-yellow'], selecao: ['Em seleção', 'b-blue'], ocupada: ['Ocupada', 'b-green'], encerrada: ['Encerrada', 'b-gray'], cancelada: ['Cancelada', 'b-gray'] };
const ST_ITEM = { previsto: ['Previsto', 'b-gray'], em_aquisicao: ['Em aquisição', 'b-blue'], adquirido: ['Adquirido', 'b-green'], cancelado: ['Cancelado', 'b-gray'] };
const MOEDAS = [['BRL', 'R$ (real)'], ['USD', 'US$ (dólar)'], ['EUR', '€ (euro)'], ['GBP', '£ (libra)'], ['JPY', '¥ (iene)'], ['CHF', 'CHF (franco)']];
/* aba da planilha do edital → rubrica */
const ABA_RUBRICA = { 6: '1.2.1', 7: '1.2.2', 8: '1.3', 9: '1.4', 10: '2.1', 11: '2.2' };
const ST_DESEMB = { prevista: ['Prevista', 'b-gray'], atrasada: ['Atrasada', 'b-red'], recebida: ['Recebida', 'b-green'], parcial: ['Recebida (parcial)', 'b-yellow'], cancelada: ['Cancelada', 'b-gray'] };
const TIPOS_DOC = [['contrato', 'Contrato / convênio'], ['plano_trabalho', 'Plano de trabalho'], ['termo_aditivo', 'Termo aditivo'], ['relatorio', 'Relatório'], ['prestacao_contas', 'Prestação de contas'], ['oficio', 'Ofício / correspondência'], ['ata', 'Ata de reunião'], ['proposta', 'Proposta submetida'], ['nota_fiscal', 'Nota fiscal / comprovante'], ['outro', 'Outro']];
const CAT_PEND = [['administrativa', 'Administrativa'], ['financeira', 'Financeira'], ['tecnica', 'Técnica'], ['documental', 'Documental'], ['prestacao_contas', 'Prestação de contas'], ['outra', 'Outra']];
const ST_PEND = { aberta: ['Aberta', 'b-yellow'], em_andamento: ['Em andamento', 'b-blue'], aguardando: ['Aguardando terceiros', 'b-gray'], resolvida: ['Resolvida', 'b-green'], cancelada: ['Cancelada', 'b-gray'] };
const ST_CAND = { inscrito: ['Inscrito', 'b-gray'], entrevista: ['Entrevista', 'b-blue'], aprovado: ['Aprovado', 'b-green'], reprovado: ['Não selecionado', 'b-gray'], desistiu: ['Desistiu', 'b-gray'], contratado: ['Contratado', 'b-green'] };
const CHECKLIST_PADRAO = [
  ['entrada', 'Termo de compromisso / plano de atividades assinado', ['ic', 'mestrando', 'doutorando', 'pos_doc', 'tecnico']],
  ['entrada', 'Cadastro na fundação de apoio para pagamento (dados enviados à fundação)', ['ic', 'mestrando', 'doutorando', 'pos_doc', 'tecnico']],
  ['entrada', 'Currículo Lattes atualizado', []], ['entrada', 'Acesso ao laboratório (chave / cartão / biometria)', []],
  ['entrada', 'Treinamento de segurança do laboratório (EPI, normas, emergência)', []], ['entrada', 'E-mail, grupos e pastas compartilhadas do Lab', []],
  ['entrada', 'Apresentação às normas e rotinas do Lab', []],
  ['saida', 'Relatório final de atividades entregue', ['ic', 'mestrando', 'doutorando', 'pos_doc', 'tecnico']], ['saida', 'Bolsa encerrada na fundação', ['ic', 'mestrando', 'doutorando', 'pos_doc', 'tecnico']],
  ['saida', 'Dados, códigos e arquivos do projeto transferidos para a pasta do Lab', []], ['saida', 'Chaves, cartões e equipamentos devolvidos', []],
  ['saida', 'Acessos removidos (pastas, e-mail, sistemas)', []], ['saida', 'Declaração de participação emitida', []]];
const checklistPadrao = () => { const c = { entrada: 0, saida: 0 }; return CHECKLIST_PADRAO.map(([fase, nome, tipos]) => ({ id: newId(), fase, nome, descricao: null, tipos, obrigatorio: true, ordem: ++c[fase], ativo: true })); };
const ST_CRONO = { planejada: ['Planejada', 'b-gray'], em_andamento: ['Em andamento', 'b-blue'], concluida: ['Concluída', 'b-green'], cancelada: ['Cancelada', 'b-gray'] };
const ST_ENTREGA = { pendente: ['Pendente', 'b-gray'], em_elaboracao: ['Em elaboração', 'b-yellow'], entregue: ['Entregue', 'b-blue'], aprovado: ['Aprovado', 'b-green'], dispensado: ['Dispensado', 'b-gray'] };
const GERENCIAS_PADRAO = [
  ['Gerência de Projetos', 'Acompanha cronogramas, status e entregas de todo o portfólio; organiza alocações; conduz a prospecção de novos projetos.', ['projetos_criar', 'projetos_editar', 'alocacoes_gerir', 'tarefas_gerir', 'prospeccao_gerir']],
  ['Gerência Técnica', 'Distribui e acompanha o trabalho técnico da equipe e dos bolsistas; mantém cadastro de pessoas, habilidades e disponibilidade.', ['alocacoes_gerir', 'tarefas_gerir', 'pessoas_gerir']],
  ['Gerência de Infraestrutura', 'Cuida de bancos de ensaio, células de teste, instrumentação, manutenção, segurança (PPCI) e compras de infraestrutura.', ['infraestrutura_gerir']],
  ['Gerência Financeira', 'Controla orçamento aprovado, execução e saldo por rubrica; bolsas e pagamentos; prestação de contas com as fundações.', ['financeiro_ver', 'financeiro_editar', 'historico_ver']]];

/* ── tabelas (espelho do banco) ─────────────────────────────────── */
const TABLES = {
  pessoas: {}, perfis: {}, projetos: {}, aditivos: {}, entregas: {}, cronograma: {}, documentos: {}, pendencias: {}, equipe_plano: {}, candidatos: {}, checklist_itens: { noStamp: true }, pessoa_checklist: { key: null, noStamp: true }, equipe_plano_bolsas: {}, alocacoes: {}, gerencias: {}, gerencia_membros: {},
  tarefas: {}, tarefa_responsaveis: { key: null, noStamp: true }, rubricas: { key: 'codigo', noStamp: true },
  vinculos_financeiros: {}, orcamento_rubricas: {}, plano_itens: {}, desembolsos: {}, desembolso_rubricas: { key: null, noStamp: true }, despesas: {}, prospeccoes: {}, avaliacoes: { noStamp: true },
  historico: { noStamp: true, noHist: true, key: 'id' },
  infra_itens: {}, infra_habilitacoes: {}, infra_reservas: {}, infra_manutencoes: {},
};
/* Colunas de cada tabela no banco (gpmot_schema.sql). Campos fora desta lista não são gravados,
   nem no modo local nem no online — assim os dois modos guardam exatamente a mesma coisa.
   Ao mudar o esquema, atualize esta lista (o teste online confere as duas). */
const COLUNAS = Object.fromEntries(Object.entries({
  aditivos: 'id projeto_id numero tipo data_assinatura fim_anterior novo_fim valor_anterior novo_valor justificativa documento criado_em atualizado_em atualizado_por',
  alocacoes: 'id pessoa_id projeto_id nivel carga_pct coordena papel atribuicao desde status criado_em atualizado_em atualizado_por',
  avaliacoes: 'id prospeccao_id avaliado_em avaliado_por filtros notas esforcos ia ie ip bloqueada quadrante parecer',
  candidatos: 'id vaga_id projeto_id nome email curso lattes origem status nota pessoa_id obs criado_em atualizado_em atualizado_por',
  checklist_itens: 'id fase nome descricao tipos obrigatorio ordem ativo',
  cronograma: 'id projeto_id codigo titulo descricao entrega validador mes_inicio mes_fim responsavel_texto responsavel_id percentual status data_conclusao evidencia obs ordem criado_em atualizado_em atualizado_por',
  desembolso_rubricas: 'desembolso_id projeto_id rubrica valor',
  desembolsos: 'id projeto_id numero descricao fundacao data_prevista valor_previsto status data_recebida valor_recebido documento obs criado_em atualizado_em atualizado_por',
  despesas: 'id projeto_id rubrica data competencia descricao favorecido documento valor pessoa_id vinculo_id item_id obs criado_em criado_por atualizado_em atualizado_por',
  documentos: 'id projeto_id tipo titulo url numero data versao restrito aditivo_id entrega_id obs criado_em criado_por atualizado_em atualizado_por',
  entregas: 'id projeto_id tipo titulo prazo responsavel_id status data_entrega documento obs criado_em atualizado_em atualizado_por',
  equipe_plano: 'id projeto_id ordem nome_plano funcao categoria formacao etapas horas_semanais pessoa_id status desde requisitos selecao_prazo obs criado_em atualizado_em atualizado_por',
  equipe_plano_bolsas: 'id vaga_id projeto_id modalidade rubrica valor_mensal meses criado_em atualizado_em atualizado_por',
  gerencia_membros: 'id gerencia_id pessoa_id funcao desde ate criado_em atualizado_em atualizado_por',
  gerencias: 'id nome descricao permissoes ativa ordem criado_em atualizado_em atualizado_por',
  historico: 'id tabela registro_id operacao usuario em alteracoes',
  infra_habilitacoes: 'id item_id pessoa_id nivel desde validade obs criado_em atualizado_em atualizado_por',
  infra_itens: 'id nome codigo categoria pai_id localizacao fabricante modelo numero_serie patrimonio projeto_aquisicao_id responsavel_id status reservavel requer_habilitacao especificacoes obs criado_em atualizado_em atualizado_por',
  infra_manutencoes: 'id item_id tipo titulo descricao status data_prevista data_inicio data_conclusao proxima_em executor responsavel_id custo projeto_id documento criado_em criado_por atualizado_em atualizado_por',
  infra_reservas: 'id item_id projeto_id solicitante_id responsavel_id inicio fim finalidade status horas_uso obs criado_em criado_por atualizado_em atualizado_por',
  orcamento_rubricas: 'id projeto_id rubrica aprovado previsto obs criado_em atualizado_em atualizado_por',
  pendencias: 'id projeto_id titulo descricao categoria origem responsavel_id prazo prioridade status resolucao resolvida_em documento_id criado_em criado_por atualizado_em atualizado_por',
  perfis: 'id email pessoa_id papel ativo criado_em atualizado_em atualizado_por',
  pessoa_checklist: 'pessoa_id item_id feito data obs atualizado_por',
  pessoas: 'id nome email tipo funcao curso semestre foco formacao lattes ingresso saida habilidades resumo disponibilidade_pct perfil_disponibilidade obs_disponibilidade risco_sobrecarga ordem ativo criado_em atualizado_em atualizado_por',
  plano_itens: 'id projeto_id rubrica numero descricao justificativa origem quantidade valor_unitario moeda cambio detalhe valor_previsto status infra_item_id obs criado_em atualizado_em atualizado_por',
  projetos: 'id sigla nome financiador fundacao_apoio tipo programa chamada linha_tematica numero_contrato data_assinatura resumo valor_total contrapartida inicio fim status fase notas placeholder situacao ordem criado_em atualizado_em atualizado_por',
  prospeccoes: 'id nome financiador edital valor_estimado prazo_submissao inicio_previsto fim_previsto responsavel_id objetivo observacoes texto_origem arquivo_origem situacao projeto_id criado_em criado_por atualizado_em atualizado_por',
  rubricas: 'codigo nome pai ordem planos',
  tarefa_responsaveis: 'tarefa_id pessoa_id',
  tarefas: 'id projeto_id gerencia_id atividade_id prioridade titulo descricao inicio prazo concluida concluida_em criado_em criado_por atualizado_em atualizado_por',
  vinculos_financeiros: 'id pessoa_id projeto_id tipo modalidade rubrica valor_mensal inicio fim status vaga_id obs criado_em atualizado_em atualizado_por',
}).map(([t, c]) => [t, new Set(c.split(' '))]));
/* Campos obrigatórios que têm valor padrão no banco. Dados antigos (de antes de o campo existir)
   chegam sem eles ou vazios; ao enviar ao banco, recebem o mesmo padrão que o banco usaria. */
const PADRAO_BANCO = {"aditivos":{"tipo":"prazo"},"alocacoes":{"carga_pct":25,"coordena":false,"nivel":1,"status":"ativo"},"avaliacoes":{"avaliado_em":"@agora","bloqueada":false,"esforcos":{},"filtros":{},"notas":{}},"candidatos":{"status":"inscrito"},"checklist_itens":{"ativo":true,"obrigatorio":true,"ordem":0,"tipos":[]},"cronograma":{"ordem":0,"percentual":0,"status":"planejada"},"desembolso_rubricas":{"valor":0},"desembolsos":{"status":"prevista","valor_previsto":0},"documentos":{"restrito":false,"tipo":"outro"},"entregas":{"status":"pendente","tipo":"relatorio_parcial"},"equipe_plano":{"categoria":"outro","etapas":[],"ordem":0,"status":"vaga"},"equipe_plano_bolsas":{"meses":1,"rubrica":"1.1.1","valor_mensal":0},"gerencia_membros":{"desde":"@hoje","funcao":"titular"},"gerencias":{"ativa":true,"ordem":0,"permissoes":[]},"infra_habilitacoes":{"desde":"@hoje","nivel":"operador"},"infra_itens":{"categoria":"equipamento","especificacoes":{},"requer_habilitacao":false,"reservavel":true,"status":"operacional"},"infra_manutencoes":{"status":"planejada"},"infra_reservas":{"status":"solicitada"},"orcamento_rubricas":{"aprovado":0,"previsto":0},"pendencias":{"categoria":"administrativa","prioridade":"normal","status":"aberta"},"pessoa_checklist":{"data":"@hoje","feito":true},"pessoas":{"ativo":true,"disponibilidade_pct":100,"habilidades":[],"ordem":0,"perfil_disponibilidade":"interno","risco_sobrecarga":false,"tipo":"outro"},"plano_itens":{"moeda":"BRL","numero":0,"origem":"nacional","status":"previsto","valor_previsto":0},"projetos":{"contrapartida":0,"ordem":0,"placeholder":false,"situacao":"vigente","status":"pendente","tipo":"edital","valor_total":0},"prospeccoes":{"situacao":"avaliacao"},"rubricas":{"ordem":0,"planos":["edital","servico"]},"tarefas":{"concluida":false,"prioridade":"normal","titulo":""},"vinculos_financeiros":{"rubrica":"1.1.1","status":"previsto","tipo":"bolsa","valor_mensal":0}};
function completarObrigatorios(t, row) {
  const P = PADRAO_BANCO[t]; if (!P) return row;
  for (const [c, v] of Object.entries(P)) if (row[c] === undefined || row[c] === null || row[c] === '') {
    row[c] = v === '@agora' ? new Date().toISOString() : v === '@hoje' ? hoje() : Array.isArray(v) ? [...v] : (v && typeof v === 'object') ? { ...v } : v;
  }
  return row;
}
const _avisoCol = new Set();
function soColunas(t, row) {
  const C = COLUNAS[t]; if (!C || !row) return row;
  const r = {};
  for (const k of Object.keys(row)) {
    if (C.has(k)) r[k] = row[k];
    else if (!_avisoCol.has(t + '.' + k)) { _avisoCol.add(t + '.' + k); console.warn(`Campo ignorado (não existe no banco): ${t}.${k}`); }
  }
  return r;
}
const keyOf = t => TABLES[t].key === undefined ? 'id' : TABLES[t].key;
const DEFAULTS = {
  pessoas: { tipo: 'outro', habilidades: [], disponibilidade_pct: 100, perfil_disponibilidade: 'interno', risco_sobrecarga: false, ordem: 0, ativo: true },
  perfis: { papel: 'leitura', ativo: false },
  aditivos: { tipo: 'prazo' },
  entregas: { tipo: 'relatorio_parcial', status: 'pendente' },
  cronograma: { percentual: 0, status: 'planejada', ordem: 0 },
  projetos: { tipo: 'edital', valor_total: 0, contrapartida: 0, status: 'pendente', placeholder: false, situacao: 'vigente', ordem: 0 },
  documentos: { tipo: 'outro', restrito: false },
  candidatos: { status: 'inscrito' },
  checklist_itens: { tipos: [], obrigatorio: true, ordem: 0, ativo: true },
  pessoa_checklist: { feito: true },
  pendencias: { categoria: 'administrativa', prioridade: 'normal', status: 'aberta' },
  alocacoes: { nivel: 1, carga_pct: 25, coordena: false, status: 'ativo' },
  equipe_plano: { categoria: 'outro', etapas: [], status: 'vaga', ordem: 0 },
  equipe_plano_bolsas: { rubrica: '1.1.1', valor_mensal: 0, meses: 1 },
  gerencias: { permissoes: [], ativa: true, ordem: 0 },
  gerencia_membros: { funcao: 'titular' },
  tarefas: { prioridade: 'normal', titulo: '', concluida: false },
  vinculos_financeiros: { tipo: 'bolsa', rubrica: '1.1.1', valor_mensal: 0, status: 'previsto' },
  orcamento_rubricas: { aprovado: 0, previsto: 0 },
  desembolsos: { status: 'prevista', valor_previsto: 0 },
  desembolso_rubricas: { valor: 0 },
  plano_itens: { numero: 0, origem: 'nacional', moeda: 'BRL', valor_previsto: 0, status: 'previsto' },
  despesas: {},
  prospeccoes: { situacao: 'avaliacao' },
  avaliacoes: { filtros: {}, notas: {}, esforcos: {}, bloqueada: false },
  infra_itens: { categoria: 'equipamento', status: 'operacional', reservavel: true, requer_habilitacao: false, especificacoes: {} },
  infra_habilitacoes: { nivel: 'operador' },
  infra_reservas: { status: 'solicitada' },
  infra_manutencoes: { status: 'planejada' },
};
const FK = [
  ['perfis', 'pessoa_id', 'pessoas', 'null'],
  ['aditivos', 'projeto_id', 'projetos', 'cascade'],
  ['cronograma', 'projeto_id', 'projetos', 'cascade'], ['cronograma', 'responsavel_id', 'pessoas', 'null'],
  ['tarefas', 'atividade_id', 'cronograma', 'null'],
  ['candidatos', 'vaga_id', 'equipe_plano', 'cascade'], ['candidatos', 'projeto_id', 'projetos', 'cascade'], ['candidatos', 'pessoa_id', 'pessoas', 'null'],
  ['pessoa_checklist', 'pessoa_id', 'pessoas', 'cascade'], ['pessoa_checklist', 'item_id', 'checklist_itens', 'cascade'],
  ['documentos', 'projeto_id', 'projetos', 'cascade'], ['documentos', 'aditivo_id', 'aditivos', 'null'], ['documentos', 'entrega_id', 'entregas', 'null'],
  ['pendencias', 'projeto_id', 'projetos', 'cascade'], ['pendencias', 'responsavel_id', 'pessoas', 'null'], ['pendencias', 'documento_id', 'documentos', 'null'],
  ['equipe_plano', 'projeto_id', 'projetos', 'cascade'], ['equipe_plano', 'pessoa_id', 'pessoas', 'null'],
  ['equipe_plano_bolsas', 'vaga_id', 'equipe_plano', 'cascade'], ['equipe_plano_bolsas', 'projeto_id', 'projetos', 'cascade'],
  ['entregas', 'projeto_id', 'projetos', 'cascade'], ['entregas', 'responsavel_id', 'pessoas', 'null'],
  ['alocacoes', 'pessoa_id', 'pessoas', 'cascade'], ['alocacoes', 'projeto_id', 'projetos', 'cascade'],
  ['gerencia_membros', 'gerencia_id', 'gerencias', 'cascade'], ['gerencia_membros', 'pessoa_id', 'pessoas', 'cascade'],
  ['tarefas', 'projeto_id', 'projetos', 'cascade'], ['tarefas', 'gerencia_id', 'gerencias', 'cascade'],
  ['tarefa_responsaveis', 'tarefa_id', 'tarefas', 'cascade'], ['tarefa_responsaveis', 'pessoa_id', 'pessoas', 'cascade'],
  ['vinculos_financeiros', 'pessoa_id', 'pessoas', 'restrict'], ['vinculos_financeiros', 'projeto_id', 'projetos', 'cascade'],
  ['orcamento_rubricas', 'projeto_id', 'projetos', 'cascade'],
  ['desembolsos', 'projeto_id', 'projetos', 'cascade'], ['desembolso_rubricas', 'desembolso_id', 'desembolsos', 'cascade'], ['desembolso_rubricas', 'projeto_id', 'projetos', 'cascade'],
  ['plano_itens', 'projeto_id', 'projetos', 'cascade'], ['plano_itens', 'infra_item_id', 'infra_itens', 'null'], ['despesas', 'item_id', 'plano_itens', 'null'],
  ['despesas', 'projeto_id', 'projetos', 'cascade'], ['despesas', 'pessoa_id', 'pessoas', 'null'], ['despesas', 'vinculo_id', 'vinculos_financeiros', 'null'], ['vinculos_financeiros', 'vaga_id', 'equipe_plano', 'null'],
  ['prospeccoes', 'responsavel_id', 'pessoas', 'null'], ['prospeccoes', 'projeto_id', 'projetos', 'null'],
  ['avaliacoes', 'prospeccao_id', 'prospeccoes', 'cascade'],
  ['infra_itens', 'pai_id', 'infra_itens', 'null'], ['infra_itens', 'projeto_aquisicao_id', 'projetos', 'null'], ['infra_itens', 'responsavel_id', 'pessoas', 'null'],
  ['infra_habilitacoes', 'item_id', 'infra_itens', 'cascade'], ['infra_habilitacoes', 'pessoa_id', 'pessoas', 'cascade'],
  ['infra_reservas', 'item_id', 'infra_itens', 'cascade'], ['infra_reservas', 'projeto_id', 'projetos', 'null'],
  ['infra_reservas', 'solicitante_id', 'pessoas', 'null'], ['infra_reservas', 'responsavel_id', 'pessoas', 'null'],
  ['infra_manutencoes', 'item_id', 'infra_itens', 'cascade'], ['infra_manutencoes', 'responsavel_id', 'pessoas', 'null'], ['infra_manutencoes', 'projeto_id', 'projetos', 'null'],
];
const RESTRICT_MSG = { vinculos_financeiros: 'Esta pessoa tem bolsas/pagamentos registrados. Encerre ou transfira os vínculos financeiros antes de excluí-la (ou marque-a como inativa).' };

/* cache em memória de todas as tabelas */
const D = {};
Object.keys(TABLES).forEach(t => D[t] = []);
const byId = (t, id) => id ? D[t].find(r => r.id === id) : undefined;
const nomePessoa = id => (byId('pessoas', id) || {}).nome || '—';
const siglaProjeto = id => (byId('projetos', id) || {}).sigla || '—';

/* ── usuário atual ──────────────────────────────────────────────── */
const ME = { uid: null, papel: null, pessoa_id: null, email: '', online: false };

const Perm = {
  dir: () => ME.papel === 'direcao',
  podeEditar: () => ME.papel === 'direcao' || ME.papel === 'membro',
  temAcesso: () => !!ME.papel,
  gerenciasAtivas(pessoaId = ME.pessoa_id) {
    const t = hoje();
    return D.gerencia_membros.filter(gm => gm.pessoa_id === pessoaId && gm.pessoa_id && (!gm.desde || gm.desde <= t) && (!gm.ate || gm.ate >= t))
      .map(gm => byId('gerencias', gm.gerencia_id)).filter(g => g && g.ativa);
  },
  minhas() {
    if (Perm.dir()) return PERMISSOES.map(p => p[0]);
    if (!Perm.podeEditar()) return [];
    return [...new Set(Perm.gerenciasAtivas().flatMap(g => g.permissoes || []))];
  },
  tem: p => Perm.minhas().includes(p),
  gerencia: gid => Perm.dir() || (Perm.podeEditar() && Perm.gerenciasAtivas().some(g => g.id === gid)),
  coordena: pid => Perm.podeEditar() && !!ME.pessoa_id && D.alocacoes.some(a => a.projeto_id === pid && a.pessoa_id === ME.pessoa_id && a.coordena),
  coordenaAlgum: () => Perm.podeEditar() && !!ME.pessoa_id && D.alocacoes.some(a => a.pessoa_id === ME.pessoa_id && a.coordena),
  alocado: pid => !!ME.pessoa_id && D.alocacoes.some(a => a.projeto_id === pid && a.pessoa_id === ME.pessoa_id),
  gereProjeto: pid => Perm.dir() || Perm.coordena(pid) || Perm.tem('projetos_editar'),
  veFin: pid => Perm.dir() || Perm.coordena(pid) || Perm.tem('financeiro_ver'),
  editaFin: pid => Perm.dir() || Perm.coordena(pid) || Perm.tem('financeiro_editar'),
  gereTarefas: pid => !!pid && (Perm.gereProjeto(pid) || Perm.tem('tarefas_gerir')),
  gerePessoa: pid => Perm.dir() || Perm.tem('pessoas_gerir') || D.alocacoes.some(a => a.pessoa_id === pid && Perm.coordena(a.projeto_id)),
  gereCandidatos: pid => Perm.gereProjeto(pid) || Perm.tem('alocacoes_gerir') || Perm.tem('pessoas_gerir'),
  veDoc: d => !d.restrito || Perm.veFin(d.projeto_id) || Perm.gereProjeto(d.projeto_id),
  incluiDoc: pid => Perm.gereProjeto(pid) || (Perm.podeEditar() && Perm.alocadoAtivo(pid)),
  editaDoc: d => Perm.gereProjeto(d.projeto_id) || (Perm.podeEditar() && !!d.criado_por && d.criado_por === ME.uid),
  alocadoAtivo: pid => !!ME.pessoa_id && D.alocacoes.some(a => a.projeto_id === pid && a.pessoa_id === ME.pessoa_id && a.status === 'ativo'),
  editaPendencia: x => Perm.gereProjeto(x.projeto_id) || (Perm.podeEditar() && !!ME.pessoa_id && x.responsavel_id === ME.pessoa_id),
  editaEntrega: e => Perm.gereProjeto(e.projeto_id) || (Perm.podeEditar() && !!ME.pessoa_id && e.responsavel_id === ME.pessoa_id),
  gereAlocacao: pid => Perm.gereProjeto(pid) || Perm.tem('alocacoes_gerir'),
  gerePessoas: () => Perm.dir() || Perm.tem('pessoas_gerir') || Perm.coordenaAlgum(),
  gereProspeccao: () => Perm.dir() || Perm.tem('prospeccao_gerir') || Perm.coordenaAlgum(),
  gereInfraGeral: () => Perm.dir() || Perm.tem('infraestrutura_gerir'),
  gereInfra: itemId => Perm.gereInfraGeral() || (Perm.podeEditar() && !!ME.pessoa_id && (byId('infra_itens', itemId) || {}).responsavel_id === ME.pessoa_id),
  responsavelTarefa: tid => !!ME.pessoa_id && D.tarefa_responsaveis.some(r => r.tarefa_id === tid && r.pessoa_id === ME.pessoa_id),
  gereTarefa(t) {
    return Perm.gereTarefas(t.projeto_id) || (!!t.gerencia_id && Perm.gerencia(t.gerencia_id)) || (Perm.podeEditar() && t.criado_por === ME.uid);
  },
  editaTarefa(t) { return Perm.gereTarefa(t) || (Perm.podeEditar() && Perm.responsavelTarefa(t.id)); },
  podeCriarTarefa(pid, gid) {
    if (gid && !Perm.gerencia(gid)) return false;
    if (!pid) return !!gid;
    return Perm.gereTarefas(pid) || (!!gid && Perm.gerencia(gid)) || (Perm.podeEditar() && Perm.alocado(pid));
  },
};

/* Políticas de acesso — mesmas regras do banco (RLS). No modo online
   quem decide é o banco; no modo local, estas funções fazem o papel dele. */
const POLICY = {
  pessoas: { ins: () => Perm.gerePessoas(), upd: (n, o) => Perm.gerePessoas() || (Perm.podeEditar() && o.id === ME.pessoa_id), del: () => Perm.dir() },
  perfis: { ins: () => Perm.dir(), upd: () => Perm.dir(), del: () => Perm.dir() },
  projetos: { ins: () => Perm.dir() || Perm.tem('projetos_criar'), upd: (n, o) => Perm.gereProjeto(o.id), del: () => Perm.dir() },
  alocacoes: { all: r => Perm.gereAlocacao(r.projeto_id) },
  equipe_plano: { all: r => Perm.gereAlocacao(r.projeto_id) },
  equipe_plano_bolsas: { all: r => Perm.editaFin(r.projeto_id) },
  aditivos: { all: r => Perm.gereProjeto(r.projeto_id) },
  cronograma: { ins: n => Perm.gereProjeto(n.projeto_id), upd: (n, o) => Perm.gereProjeto(o.projeto_id) || (Perm.podeEditar() && !!ME.pessoa_id && o.responsavel_id === ME.pessoa_id), del: (n, o) => Perm.gereProjeto(o.projeto_id) },
  candidatos: { all: r => Perm.gereCandidatos(r.projeto_id) },
  checklist_itens: { all: () => Perm.dir() || Perm.tem('pessoas_gerir') },
  pessoa_checklist: { all: r => Perm.gerePessoa(r.pessoa_id) },
  documentos: { ins: n => Perm.gereProjeto(n.projeto_id) || (Perm.incluiDoc(n.projeto_id) && !n.restrito), upd: (n, o) => Perm.editaDoc(o) && (Perm.gereProjeto(o.projeto_id) || !n.restrito), del: (n, o) => Perm.editaDoc(o) },
  pendencias: { ins: n => Perm.gereProjeto(n.projeto_id), upd: (n, o) => Perm.editaPendencia(o), del: (n, o) => Perm.gereProjeto(o.projeto_id) },
  entregas: { ins: n => Perm.gereProjeto(n.projeto_id), upd: (n, o) => Perm.editaEntrega(o), del: (n, o) => Perm.gereProjeto(o.projeto_id) },
  gerencias: { all: () => Perm.dir() }, gerencia_membros: { all: () => Perm.dir() }, rubricas: { all: () => Perm.dir() },
  tarefas: {
    ins: n => Perm.podeCriarTarefa(n.projeto_id, n.gerencia_id),
    upd: (n, o) => Perm.editaTarefa(o), del: (n, o) => Perm.gereTarefa(o)
  },
  tarefa_responsaveis: { all: r => { const t = byId('tarefas', r.tarefa_id); return !!t && Perm.gereTarefa(t); } },
  vinculos_financeiros: { all: r => Perm.editaFin(r.projeto_id) },
  orcamento_rubricas: { all: r => Perm.editaFin(r.projeto_id) },
  plano_itens: { all: r => Perm.editaFin(r.projeto_id) },
  desembolsos: { all: r => Perm.editaFin(r.projeto_id) },
  desembolso_rubricas: { all: r => Perm.editaFin(r.projeto_id) },
  despesas: { all: r => Perm.editaFin(r.projeto_id) },
  prospeccoes: { ins: () => Perm.gereProspeccao(), upd: () => Perm.gereProspeccao(), del: () => Perm.dir() },
  avaliacoes: { ins: () => Perm.gereProspeccao(), upd: () => false, del: () => Perm.dir() },
  historico: { all: () => true },
  infra_itens: { ins: () => Perm.gereInfraGeral(), upd: (n, o) => Perm.gereInfra(o.id), del: () => Perm.gereInfraGeral() },
  infra_habilitacoes: { all: r => Perm.gereInfra(r.item_id) },
  infra_reservas: { ins: () => Perm.podeEditar(), upd: (n, o) => Perm.gereInfra(o.item_id) || (Perm.podeEditar() && o.criado_por === ME.uid), del: (n, o) => Perm.gereInfra(o.item_id) },
  infra_manutencoes: { ins: n => Perm.gereInfra(n.item_id) || (Perm.podeEditar() && n.tipo === 'corretiva' && n.status === 'planejada'), upd: (n, o) => Perm.gereInfra(o.item_id), del: (n, o) => Perm.gereInfra(o.item_id) },
};
function permitido(t, op, n, o) {
  const p = POLICY[t]; if (!p) return true;
  const f = p[op] || p.all; if (!f) return false;
  if (p.all && !p[op]) return (op === 'ins' ? f(n) : op === 'del' ? f(o) : f(o) && f(n));
  return f(n, o);
}

/* ── validação (mensagens em português; vale nos dois modos) ─────── */
class ErroRegra extends Error { }
const falha = m => { throw new ErroRegra(m); };
function exigeData(v, nome, obrig) { if (!v) { if (obrig) falha(`Informe ${nome}.`); return; } if (!isDate(v)) falha(`Data inválida: "${v}" (${nome.replace(/^(a|o) /, '')}).`); }
function exigePeriodo(a, b, txt) { if (a && b && b < a) falha(txt || 'A data final não pode ser anterior à inicial.'); }

function validar(t, r, old) {
  switch (t) {
    case 'pessoas':
      if (!String(r.nome || '').trim()) falha('Informe o nome.');
      if (r.email && D.pessoas.some(p => p.id !== r.id && norm(p.email) === norm(r.email))) falha('Já existe uma pessoa com este e-mail.');
      if (r.disponibilidade_pct < 0 || r.disponibilidade_pct > 100) falha('Disponibilidade deve estar entre 0 e 100%.');
      exigeData(r.ingresso, 'a data de ingresso');
      break;
    case 'projetos':
      if (!String(r.sigla || '').trim()) falha('Informe a sigla do projeto.');
      if (!TIPOS_PROJ.some(t => t[0] === r.tipo)) falha('Escolha o tipo do projeto (edital ou prestação de serviço).');
      exigeData(r.inicio, 'a data de início', true); exigeData(r.fim, 'a data de término', true);
      exigePeriodo(r.inicio, r.fim, 'O término do projeto não pode ser anterior ao início.');
      exigeData(r.data_assinatura, 'a data de assinatura');
      if (num(r.valor_total) < 0) falha('Valor total não pode ser negativo.');
      if (num(r.contrapartida) < 0) falha('Contrapartida não pode ser negativa.');
      break;
    case 'aditivos': {
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!TIPOS_ADITIVO.some(t => t[0] === r.tipo)) falha('Escolha o tipo de aditivo.');
      exigeData(r.data_assinatura, 'a data de assinatura'); exigeData(r.novo_fim, 'o novo término');
      if (!['escopo', 'outro'].includes(r.tipo) && !r.novo_fim && (r.novo_valor == null || r.novo_valor === '')) falha('Informe o novo término e/ou o novo valor do projeto.');
      if (['prazo', 'prazo_valor'].includes(r.tipo) && !r.novo_fim) falha('Informe o novo término.');
      if (['valor', 'prazo_valor'].includes(r.tipo) && (r.novo_valor == null || r.novo_valor === '')) falha('Informe o novo valor.');
      if (r.novo_valor != null && num(r.novo_valor) < 0) falha('Valor não pode ser negativo.');
      const pj = byId('projetos', r.projeto_id);
      if (pj && r.novo_fim && r.novo_fim < pj.inicio) falha('O novo término não pode ser anterior ao início do projeto.');
      break;
    }
    case 'cronograma':
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!/^\d+(\.\d+)*$/.test(String(r.codigo || ''))) falha('Código inválido. Use números separados por ponto, ex.: 2.5.1');
      if (!String(r.titulo || '').trim()) falha('Informe o título da atividade.');
      if (D.cronograma.some(c => c.id !== r.id && c.projeto_id === r.projeto_id && c.codigo === r.codigo)) falha(`Já existe a atividade ${r.codigo} neste projeto.`);
      if (r.mes_inicio != null && (!Number.isInteger(+r.mes_inicio) || +r.mes_inicio < 1)) falha('Mês de início deve ser 1 ou maior (mês 1 = mês de início do projeto).');
      if (r.mes_fim != null && r.mes_inicio != null && +r.mes_fim < +r.mes_inicio) falha('O mês de término não pode ser anterior ao de início.');
      if (num(r.percentual) < 0 || num(r.percentual) > 100) falha('Percentual entre 0 e 100.');
      exigeData(r.data_conclusao, 'a data de conclusão');
      break;
    case 'equipe_plano':
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!String(r.nome_plano || '').trim()) falha('Informe como a posição consta no plano (ex.: “Bolsista de Mestrado 1”).');
      if (r.status === 'ocupada' && !r.pessoa_id) falha('Posição ocupada precisa de uma pessoa.');
      if (['vaga', 'selecao'].includes(r.status) && r.pessoa_id) falha('Vaga aberta ou em seleção não tem ocupante. Use “Preencher vaga”.');
      if (r.status === 'ocupada' && D.equipe_plano.some(e => e.id !== r.id && e.projeto_id === r.projeto_id && e.status === 'ocupada' && e.pessoa_id === r.pessoa_id)) falha(`${nomePessoa(r.pessoa_id)} já ocupa outra posição neste projeto.`);
      if (r.horas_semanais != null && r.horas_semanais !== '' && (num(r.horas_semanais) < 0 || num(r.horas_semanais) > 60)) falha('Horas semanais entre 0 e 60.');
      exigeData(r.desde, 'a data de entrada');
      break;
    case 'equipe_plano_bolsas':
      if (!r.vaga_id) falha('Posição não informada.');
      if (num(r.valor_mensal) < 0) falha('Valor mensal não pode ser negativo.');
      if (!Number.isInteger(+r.meses) || +r.meses < 1 || +r.meses > 120) falha('Duração da bolsa entre 1 e 120 meses.');
      exigeFolha(r.rubrica);
      break;
    case 'entregas':
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!String(r.titulo || '').trim()) falha('Informe o título da entrega.');
      exigeData(r.prazo, 'o prazo', true); exigeData(r.data_entrega, 'a data de entrega');
      break;
    case 'alocacoes':
      if (!r.pessoa_id || !r.projeto_id) falha('Escolha a pessoa e o projeto.');
      if (D.alocacoes.some(a => a.id !== r.id && a.pessoa_id === r.pessoa_id && a.projeto_id === r.projeto_id)) falha('Esta pessoa já está alocada neste projeto.');
      if (num(r.carga_pct) < 0 || num(r.carga_pct) > 200) falha('Carga deve estar entre 0 e 200%.');
      exigeData(r.desde, 'a data "alocado desde"');
      break;
    case 'gerencias':
      if (!String(r.nome || '').trim()) falha('Informe o nome da gerência.');
      if (D.gerencias.some(g => g.id !== r.id && norm(g.nome) === norm(r.nome))) falha('Já existe uma gerência com este nome.');
      break;
    case 'gerencia_membros':
      if (!r.pessoa_id || !r.gerencia_id) falha('Escolha a pessoa.');
      exigeData(r.desde, 'a data de início', true); exigeData(r.ate, 'a data de término');
      exigePeriodo(r.desde, r.ate);
      break;
    case 'tarefas':
      if (!r.projeto_id && !r.gerencia_id) falha('A tarefa precisa pertencer a um projeto ou a uma gerência.');
      if (!String(r.titulo || '').trim()) falha('Informe o título da tarefa.');
      exigeData(r.inicio, 'a data de início'); exigeData(r.prazo, 'o prazo');
      exigePeriodo(r.inicio, r.prazo, 'O prazo não pode ser anterior ao início.');
      break;
    case 'vinculos_financeiros':
      if (!r.pessoa_id || !r.projeto_id) falha('Escolha a pessoa e o projeto.');
      exigeData(r.inicio, 'a data de início', true); exigeData(r.fim, 'a data de término', true);
      exigePeriodo(r.inicio, r.fim);
      if (num(r.valor_mensal) < 0) falha('Valor mensal não pode ser negativo.');
      exigeFolha(r.rubrica);
      break;
    case 'orcamento_rubricas':
      if (!r.projeto_id) falha('Projeto não informado.');
      exigeFolha(r.rubrica);
      if (num(r.aprovado) < 0 || num(r.previsto) < 0) falha('Valores não podem ser negativos.');
      if (D.orcamento_rubricas.some(o => o.id !== r.id && o.projeto_id === r.projeto_id && o.rubrica === r.rubrica)) falha('Esta rubrica já tem orçamento neste projeto.');
      break;
    case 'candidatos':
      if (!r.vaga_id) falha('Vaga não informada.');
      if (!String(r.nome || '').trim()) falha('Informe o nome do candidato.');
      if (r.nota != null && r.nota !== '' && (num(r.nota) < 0 || num(r.nota) > 10)) falha('Nota entre 0 e 10.');
      break;
    case 'checklist_itens':
      if (!['entrada', 'saida'].includes(r.fase)) falha('Fase inválida.');
      if (!String(r.nome || '').trim()) falha('Descreva o item.');
      break;
    case 'documentos':
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!String(r.titulo || '').trim()) falha('Informe o título do documento.');
      if (!String(r.url || '').trim() && !String(r.numero || '').trim()) falha('Informe o link do arquivo ou o número do documento (SEI, processo, protocolo).');
      if (r.url && !/^(https?:\/\/|file:|\\\\|[a-z]:\\)/i.test(String(r.url).trim())) falha('Link inválido. Cole o endereço completo (https://…) ou o caminho da rede.');
      exigeData(r.data, 'a data do documento');
      break;
    case 'pendencias':
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!String(r.titulo || '').trim()) falha('Descreva a pendência.');
      exigeData(r.prazo, 'o prazo'); exigeData(r.resolvida_em, 'a data de resolução');
      break;
    case 'desembolsos':
      if (!r.projeto_id) falha('Projeto não informado.');
      if (!(Number.isInteger(+r.numero) && +r.numero > 0)) falha('Informe o número da parcela (1, 2, 3…).');
      if (D.desembolsos.some(x => x.id !== r.id && x.projeto_id === r.projeto_id && +x.numero === +r.numero)) falha(`Já existe a parcela ${r.numero} neste projeto.`);
      exigeData(r.data_prevista, 'a data prevista'); exigeData(r.data_recebida, 'a data de recebimento');
      if (num(r.valor_previsto) < 0 || num(r.valor_recebido) < 0) falha('Valores não podem ser negativos.');
      if (r.status === 'recebida' && !(isDate(r.data_recebida) && num(r.valor_recebido) > 0)) falha('Para marcar como recebida, informe a data e o valor recebido.');
      break;
    case 'desembolso_rubricas':
      if (!r.desembolso_id) falha('Parcela não informada.');
      exigeFolha(r.rubrica);
      if (num(r.valor) < 0) falha('Valor não pode ser negativo.');
      break;
    case 'plano_itens':
      if (!r.projeto_id) falha('Projeto não informado.');
      exigeFolha(r.rubrica);
      if (!String(r.descricao || '').trim()) falha('Descreva o item.');
      if (r.quantidade != null && r.quantidade !== '' && !(num(r.quantidade) > 0)) falha('Quantidade deve ser maior que zero.');
      if (num(r.valor_unitario) < 0 || num(r.valor_previsto) < 0) falha('Valores não podem ser negativos.');
      if (r.cambio != null && r.cambio !== '' && !(num(r.cambio) > 0)) falha('Câmbio deve ser maior que zero.');
      break;
    case 'despesas':
      if (!r.projeto_id) falha('Escolha o projeto.');
      if (r.item_id) { const it = byId('plano_itens', r.item_id); if (!it) falha('Item do plano de aplicação não encontrado.'); if (it.projeto_id !== r.projeto_id) falha('O item do plano de aplicação é de outro projeto.'); r.rubrica = it.rubrica; }
      exigeFolha(r.rubrica);
      exigeData(r.data, 'a data da despesa', true); exigeData(r.competencia, 'a competência');
      if (!String(r.descricao || '').trim()) falha('Descreva a despesa.');
      if (!(num(r.valor) > 0)) falha('O valor da despesa deve ser maior que zero.');
      if (r.vinculo_id && r.competencia && D.despesas.some(x => x.id !== r.id && x.vinculo_id === r.vinculo_id && x.competencia === r.competencia)) falha('Esta parcela da bolsa já foi lançada.');
      break;
    case 'prospeccoes':
      if (!String(r.nome || '').trim()) falha('Informe o nome da prospecção.');
      ['prazo_submissao', 'inicio_previsto', 'fim_previsto'].forEach(k => exigeData(r[k], 'a data'));
      break;
    case 'infra_itens':
      if (!String(r.nome || '').trim()) falha('Informe o nome do item.');
      if (r.codigo && D.infra_itens.some(i => i.id !== r.id && norm(i.codigo) === norm(r.codigo))) falha('Já existe um item com este código.');
      if (r.pai_id && r.pai_id === r.id) falha('Um item não pode estar dentro de si mesmo.');
      if (r.pai_id) { let p = byId('infra_itens', r.pai_id), n = 0; while (p && n++ < 50) { if (p.id === r.id) falha('Hierarquia circular: o item escolhido já está dentro deste.'); p = byId('infra_itens', p.pai_id); } }
      break;
    case 'infra_habilitacoes':
      if (!r.item_id || !r.pessoa_id) falha('Escolha o item e a pessoa.');
      if (D.infra_habilitacoes.some(h => h.id !== r.id && h.item_id === r.item_id && h.pessoa_id === r.pessoa_id)) falha('Esta pessoa já tem habilitação neste item.');
      exigeData(r.desde, 'a data de início', true); exigeData(r.validade, 'a validade');
      break;
    case 'infra_reservas': validarReserva(r, old); break;
    case 'infra_manutencoes':
      if (!r.item_id || !String(r.titulo || '').trim()) falha('Informe o item e o título.');
      ['data_prevista', 'data_inicio', 'data_conclusao', 'proxima_em'].forEach(k => exigeData(r[k], 'a data'));
      if (num(r.custo) < 0) falha('Custo não pode ser negativo.');
      break;
  }
}
const rubricaFolha = c => !!c && D.rubricas.some(r => r.codigo === c) && !D.rubricas.some(r => r.pai === c);
function exigeFolha(c) {
  if (!c) falha('Escolha a rubrica.');
  if (!rubricaFolha(c)) falha('Use uma rubrica final (ex.: 1.1.1 Bolsas), não um grupo.');
}
function habilitado(itemId, pessoaId, ini, fim) {
  return D.infra_habilitacoes.some(h => h.item_id === itemId && h.pessoa_id === pessoaId
    && (!h.desde || h.desde <= ini) && (!h.validade || h.validade >= fim));
}
function validarReserva(r, old) {
  if (!r.item_id) falha('Escolha o item.');
  if (!r.inicio || !r.fim || isNaN(new Date(r.inicio)) || isNaN(new Date(r.fim))) falha('Informe início e fim da reserva.');
  if (new Date(r.fim) <= new Date(r.inicio)) falha('O fim da reserva deve ser depois do início.');
  const it = byId('infra_itens', r.item_id); if (!it) falha('Item não encontrado.');
  if (['solicitada', 'confirmada'].includes(r.status)) {
    if (!it.reservavel) falha(`O item "${it.nome}" não está aberto para reservas.`);
    if (['inoperante', 'desativado'].includes(it.status)) falha(`O item "${it.nome}" está ${lbl(Object.entries(ST_INFRA).map(([k, v]) => [k, v[0].toLowerCase()]), it.status)}.`);
    if (it.requer_habilitacao && !habilitado(it.id, r.responsavel_id, String(r.inicio).slice(0, 10), String(r.fim).slice(0, 10)))
      falha(`O responsável pelo uso não tem habilitação válida para "${it.nome}".`);
  }
  if (['confirmada', 'realizada'].includes(r.status)) {
    const a = new Date(r.inicio), b = new Date(r.fim);
    const c = D.infra_reservas.find(x => x.id !== r.id && x.item_id === r.item_id && ['confirmada', 'realizada'].includes(x.status)
      && new Date(x.inicio) < b && new Date(x.fim) > a);
    if (c) falha(`Conflito de horário: "${it.nome}" já está reservado de ${fmtDT(c.inicio)} a ${fmtDT(c.fim)}${c.projeto_id ? ' (' + siglaProjeto(c.projeto_id) + ')' : ''}.`);
  }
  if (!Perm.gereInfra(r.item_id)) {
    if (!['solicitada', 'cancelada'].includes(r.status)) falha('Somente a Gerência de Infraestrutura ou o responsável pelo item confirma reservas.');
    if (old && old.status !== 'solicitada') falha('Reserva já confirmada: peça a alteração à Gerência de Infraestrutura.');
  }
}

/* travas equivalentes aos gatilhos do banco */
function travas(t, n, o) {
  if (t === 'alocacoes' && !Perm.dir()) {
    if ((!o && n.coordena) || (o && !!n.coordena !== !!o.coordena)) falha('Somente a Direção pode definir coordenadores de projeto.');
  }
  if (t === 'cronograma' && o && !Perm.gereProjeto(o.projeto_id)) {
    for (const k of ['codigo', 'titulo', 'mes_inicio', 'mes_fim', 'responsavel_id', 'projeto_id', 'entrega', 'descricao'])
      if (JSON.stringify(n[k] ?? null) !== JSON.stringify(o[k] ?? null)) falha('O responsável pela atividade só atualiza andamento, conclusão, evidência e observações. O planejamento é da coordenação.');
  }
  if (t === 'pendencias' && o && !Perm.gereProjeto(o.projeto_id)) {
    for (const k of ['titulo', 'prazo', 'responsavel_id', 'projeto_id', 'prioridade', 'categoria'])
      if (JSON.stringify(n[k] ?? null) !== JSON.stringify(o[k] ?? null)) falha('O responsável pela pendência só atualiza situação, resolução e documento. Prazo e responsável são definidos pela coordenação.');
  }
  if (t === 'entregas' && o && !Perm.gereProjeto(o.projeto_id)) {
    for (const k of ['titulo', 'tipo', 'prazo', 'responsavel_id', 'projeto_id'])
      if (JSON.stringify(n[k] ?? null) !== JSON.stringify(o[k] ?? null)) falha('O responsável pela entrega só atualiza situação, data de entrega, documento e observações. Prazo e responsável são definidos pela coordenação.');
  }
  if (t === 'pessoas' && o && !(Perm.dir() || Perm.tem('pessoas_gerir') || Perm.coordenaAlgum())) {
    for (const k of ['tipo', 'funcao', 'email', 'ativo', 'risco_sobrecarga', 'ordem', 'saida'])
      if (JSON.stringify(n[k] ?? null) !== JSON.stringify(o[k] ?? null)) falha('Este campo só pode ser alterado pela Direção, Gerência Técnica ou Coordenação.');
  }
}

/* traduz erros do Postgres/Supabase para português */
function traduzErro(e) {
  if (e instanceof ErroRegra) return e.message;
  const m = (e && (e.message || e.details)) || String(e);
  const code = e && e.code;
  if (code === '23P01' || /exclusion constraint/i.test(m)) return 'Conflito de horário com outra reserva confirmada.';
  if (code === '23505' || /duplicate key/i.test(m)) return 'Já existe um registro igual.';
  if (code === '23503' || /foreign key/i.test(m)) return 'Este registro está em uso por outros dados.';
  if (code === '23514' || /check constraint/i.test(m)) return 'Valor inválido (' + ((m.match(/"([^"]+)"$/) || [])[1] || 'regra de validação') + ').';
  if (/permission denied for (table|view|function|schema|sequence)/i.test(m)) return 'O banco recusou o acesso à tabela (faltam permissões da API). Confira se o gpmot_schema.sql v1.2 ou mais novo foi aplicado.';
  if (code === '42501' || /row-level security/i.test(m)) return 'Você não tem permissão para esta operação.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  if (/token has expired or is invalid|otp.*(expired|invalid)/i.test(m)) return 'Código inválido ou vencido. Peça um novo código.';
  if (/rate limit|too many requests/i.test(m) || (e && e.status === 429)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
  const seg = m.match(/only request this after (\d+) seconds/i); if (seg) return `Por segurança, aguarde ${seg[1]} segundos antes de pedir outro código.`;
  if (/signups not allowed|signup.*disabled/i.test(m)) return 'Este e-mail não está cadastrado para acessar o sistema. Fale com a Direção.';
  const nn = m.match(/null value in column "([^"]+)" of relation "([^"]+)"/i); if (nn) return `Campo obrigatório vazio: ${nn[1]} (${nn[2]}). Preencha esse campo no registro e tente de novo.`;
  if (/error sending .*email/i.test(m)) return 'A Supabase não conseguiu enviar o e-mail com o código. Confira o envio de e-mails do projeto (SMTP) no painel da Supabase — guia de implantação, passo 4.';
  if (/invalid path specified in request url/i.test(m)) return 'Endereço do projeto incorreto. Use só https://xxxx.supabase.co (sem /rest/v1 no fim), em Configurações.';
  if (/invalid api key|no api key/i.test(m)) return 'Chave do projeto inválida. Confira a chave pública nas Configurações.';
  if (/^relation "[^"]+" does not exist|could not find the table/i.test(m)) return 'O banco online não tem as tabelas do programa. Rode o arquivo gpmot_schema.sql no SQL Editor da Supabase.';
  const col = m.match(/column "([^"]+)" of relation "([^"]+)" does not exist|could not find the '([^']+)' column of '([^']+)'/i);
  if (col) return `O banco online está em outra versão do esquema (falta a coluna ${col[1] || col[3]} em ${col[2] || col[4]}). Aplique o gpmot_schema.sql mais recente.`;
  return m;
}

/* ── armazenamento local ────────────────────────────────────────── */
const LS_PREFIX = 'gpmot2:';
const Local = {
  load() {
    for (const t of Object.keys(TABLES)) {
      try { const v = localStorage.getItem(LS_PREFIX + t); D[t] = v ? JSON.parse(v) : []; } catch { D[t] = []; }
    }
    migrarFinanceiroLocal();
    let seeded = false; try { seeded = !!localStorage.getItem(LS_PREFIX + '_seed'); } catch { }
    if (!seeded) { seedPadrao(); this.persistAll(); try { localStorage.setItem(LS_PREFIX + '_seed', hoje()); } catch { } }
  },
  persist(t) {
    try { localStorage.setItem(LS_PREFIX + t, JSON.stringify(D[t])); }
    catch (e) { flash('Não foi possível gravar no navegador (espaço cheio?). Exporte um backup.', true); throw e; }
  },
  persistAll() { Object.keys(TABLES).forEach(t => this.persist(t)); },
  wipe() { Object.keys(TABLES).forEach(t => { try { localStorage.removeItem(LS_PREFIX + t); } catch { } }); try { localStorage.removeItem(LS_PREFIX + '_seed'); } catch { } },
};
/* migração dos dados locais da v2.0 (orçamento em "linhas") para o orçamento por rubricas */
const MAPA_RUBRICA_ANTIGA = { bolsas: '1.1.1', consumo_nac: '1.3', consumo_imp: '1.3', permanente_nac: '2.1', permanente_imp: '2.1', servico_pf: '1.4', servico_pj: '1.4', obras: '2.2', viagens: '1.2.1', diarias: '1.2.2', contrapartidas: '1.5', desembolso: '1.5' };
function migrarFinanceiroLocal() {
  let antigas = null; try { antigas = JSON.parse(localStorage.getItem(LS_PREFIX + 'orcamento_linhas') || 'null'); } catch { }
  let mudou = false;
  if (!D.rubricas.some(r => r.codigo === '1.1.1')) { D.rubricas = rubricasPadrao(); mudou = true; }
  D.projetos.forEach(p => { if (!p.tipo) { p.tipo = 'edital'; mudou = true; } });
  D.vinculos_financeiros.forEach(v => { if (!v.rubrica) { v.rubrica = v.tipo === 'tecnico' ? '1.1.2' : '1.1.1'; delete v.linha_aprovada_id; mudou = true; } });
  if (Array.isArray(antigas) && antigas.length) {
    const agora = new Date().toISOString();
    antigas.filter(l => !l.cancelada).forEach(l => {
      const rub = MAPA_RUBRICA_ANTIGA[l.rubrica] || '1.5';
      if (l.estagio === 'executado') {
        if (num(l.valor) > 0) D.despesas.push({ id: newId(), projeto_id: l.projeto_id, rubrica: rub, data: isDate(l.data_ref) ? l.data_ref : hoje(), descricao: l.item || 'Despesa migrada', documento: l.documento || null, valor: num(l.valor), vinculo_id: l.vinculo_id || null, obs: l.obs || null, criado_em: agora, atualizado_em: agora });
        return;
      }
      let o = D.orcamento_rubricas.find(x => x.projeto_id === l.projeto_id && x.rubrica === rub);
      if (!o) { o = { id: newId(), projeto_id: l.projeto_id, rubrica: rub, aprovado: 0, previsto: 0, criado_em: agora, atualizado_em: agora }; D.orcamento_rubricas.push(o); }
      o[l.estagio === 'aprovado' ? 'aprovado' : 'previsto'] += num(l.valor);
    });
    mudou = true;
  }
  if (mudou) { Local.persistAll(); }
  try { localStorage.removeItem(LS_PREFIX + 'orcamento_linhas'); } catch { }
}
function seedPadrao() {
  if (!D.rubricas.some(r => r.codigo === '1.1.1')) D.rubricas = rubricasPadrao();
  if (!D.checklist_itens.length) D.checklist_itens = checklistPadrao();
  if (!D.gerencias.length) D.gerencias = GERENCIAS_PADRAO.map(([nome, descricao, permissoes], i) => ({ ...DEFAULTS.gerencias, id: newId(), nome, descricao, permissoes, ordem: i + 1, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }));
}

/* ── armazenamento online (Supabase) ────────────────────────────── */
/* só o endereço do projeto (https://xxxx.supabase.co): o painel mostra a URL da API com /rest/v1/ no fim,
   e com esse caminho o login falha com "Invalid path specified in request URL" */
function urlProjeto(u) { u = String(u || '').trim(); try { const x = new URL(u); return x.origin; } catch { return u.replace(/\/+$/, ''); } }
const SB = {
  client: null,
  cfg() {
    let c = { ...SUPABASE_CONFIG };
    try { const o = JSON.parse(localStorage.getItem(LS_PREFIX + '_supabase') || 'null'); if (o && o.url && o.anonKey) c = o; } catch { }
    if (c.url) c = { ...c, url: urlProjeto(c.url) };
    return c.url && c.anonKey ? c : null;
  },
  async connect() {
    const c = this.cfg(); if (!c) return false;
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    this.client = mod.createClient(c.url, c.anonKey);
    return true;
  },
  async fetchAll(t) {
    const out = []; let from = 0;
    for (; ;) {
      const { data, error } = await this.client.from(t).select('*').range(from, from + 999);
      if (error) throw error;
      out.push(...data); if (data.length < 1000) break; from += 1000;
    }
    return out;
  },
  async loadAll() {
    const ts = Object.keys(TABLES).filter(t => t !== 'historico');
    const res = await Promise.all(ts.map(t => this.fetchAll(t)));
    ts.forEach((t, i) => D[t] = res[i]);
  },
  async reload(tables) { for (const t of tables) D[t] = await this.fetchAll(t); },
  clean(t, row) { const r = soColunas(t, row); delete r.criado_em; delete r.atualizado_em; delete r.atualizado_por; return r; },
  async insert(t, row) {
    const { data, error } = await this.client.from(t).insert(this.clean(t, row)).select();
    if (error) throw error; return data[0];
  },
  async update(t, id, patch, prev) {
    const k = keyOf(t);
    let q = this.client.from(t).update(this.clean(t, patch)).eq(k, id);
    if (prev && prev.atualizado_em && !TABLES[t].noStamp) q = q.eq('atualizado_em', prev.atualizado_em);
    const { data, error } = await q.select();
    if (error) throw error;
    if (!data.length) throw new ErroRegra('Este registro foi alterado por outra pessoa enquanto você editava (ou você não tem permissão). Recarregue os dados e tente de novo.');
    return data[0];
  },
  async remove(t, match) {
    let q = this.client.from(t).delete(); Object.entries(match).forEach(([k, v]) => q = q.eq(k, v));
    const { data, error } = await q.select(); if (error) throw error;
    if (!data.length) throw new ErroRegra('Você não tem permissão para excluir este registro.');
  },
};

/* ── serviço de dados: toda gravação passa por aqui ─────────────── */
function histLocal(t, id, op, alt) {
  if (TABLES[t].noHist) return;
  D.historico.push({ id: newId(), tabela: t, registro_id: id || null, operacao: op, usuario: ME.uid, em: new Date().toISOString(), alteracoes: alt });
}
function diffOf(o, n) {
  const d = {};
  for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
    if (k === 'atualizado_em' || k === 'atualizado_por') continue;
    if (JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null)) d[k] = [o[k] ?? null, n[k] ?? null];
  }
  return d;
}
function efeitosAntes(t, n, o) {
  if (t === 'aditivos' && !o) {
    const p = byId('projetos', n.projeto_id);
    if (p) { if (n.fim_anterior == null) n.fim_anterior = p.fim; if (n.valor_anterior == null) n.valor_anterior = num(p.valor_total); }
  }
  if (t === 'entregas' && ['entregue', 'aprovado'].includes(n.status) && !n.data_entrega) n.data_entrega = hoje();
  if (t === 'cronograma') {
    n.percentual = Math.round(num(n.percentual));
    if (n.status === 'concluida') n.percentual = 100;
    if (n.percentual === 100 && ['planejada', 'em_andamento'].includes(n.status)) n.status = 'concluida';
    if (n.percentual > 0 && n.percentual < 100 && n.status === 'planejada') n.status = 'em_andamento';
    if (n.status === 'concluida' && !n.data_conclusao) n.data_conclusao = hoje();
    if (n.status !== 'concluida') n.data_conclusao = null;
    if (n.mes_inicio != null) n.mes_inicio = +n.mes_inicio; if (n.mes_fim != null) n.mes_fim = +n.mes_fim;
  }
  if (t === 'candidatos') { const v = byId('equipe_plano', n.vaga_id); if (v) n.projeto_id = v.projeto_id; if (n.nota === '') n.nota = null; }
  if (t === 'pessoas' && n.saida === '') n.saida = null;
  if (t === 'pendencias') { if (n.status === 'resolvida' && !n.resolvida_em) n.resolvida_em = hoje(); if (n.status !== 'resolvida') n.resolvida_em = null; }
  if (t === 'documentos' && n.url) n.url = String(n.url).trim();
  if (t === 'desembolsos') { n.numero = +n.numero; ['valor_previsto', 'valor_recebido'].forEach(k => { if (n[k] === '') n[k] = null; if (n[k] != null) n[k] = num(n[k]); }); if (n.valor_previsto == null) n.valor_previsto = 0; }
  if (t === 'desembolso_rubricas') { const d = byId('desembolsos', n.desembolso_id); if (d) n.projeto_id = d.projeto_id; n.valor = num(n.valor); }
  if (t === 'despesas' && n.item_id) { const it = byId('plano_itens', n.item_id); if (it) n.rubrica = it.rubrica; }
  if (t === 'plano_itens') {
    ['quantidade', 'valor_unitario', 'cambio', 'valor_previsto'].forEach(k => { if (n[k] === '') n[k] = null; if (n[k] != null) n[k] = num(n[k]); });
    if (n.moeda === 'BRL') n.cambio = null; else n.origem = 'importado';
    if (n.valor_previsto == null) n.valor_previsto = Calc.valorItem(n);
  }
  if (t === 'equipe_plano_bolsas') { const v = byId('equipe_plano', n.vaga_id); if (v) n.projeto_id = v.projeto_id; n.meses = +n.meses; n.valor_mensal = num(n.valor_mensal); }
  if (t === 'equipe_plano') { if (!Array.isArray(n.etapas)) n.etapas = String(n.etapas || '').split(/[\s,;]+/).filter(Boolean); if (n.horas_semanais === '') n.horas_semanais = null; }
  if (t === 'tarefas') {
    if (n.concluida && (!o || !o.concluida)) n.concluida_em = new Date().toISOString();
    if (!n.concluida) n.concluida_em = null;
  }
}
function efeitosDepois(t, n, op) {   // modo local: equivalente aos gatilhos do banco
  const out = [];
  if (t === 'aditivos' && op === 'INSERT') {
    const p = byId('projetos', n.projeto_id);
    if (p) { const o = { ...p }; if (n.novo_fim) p.fim = n.novo_fim; if (n.novo_valor != null && n.novo_valor !== '') p.valor_total = num(n.novo_valor);
      const d = diffOf(o, p); if (Object.keys(d).length) { p.atualizado_em = new Date().toISOString(); histLocal('projetos', p.id, 'UPDATE', d); out.push('projetos'); } }
  }
  if (t === 'plano_itens' && op !== 'INSERT') {
    D.despesas.filter(d => d.item_id === n.id && d.rubrica !== n.rubrica).forEach(d => { const o = { ...d }; d.rubrica = n.rubrica; histLocal('despesas', d.id, 'UPDATE', diffOf(o, d)); if (!out.includes('despesas')) out.push('despesas'); });
  }
  if (t === 'infra_manutencoes') {
    const it = byId('infra_itens', n.item_id); if (!it) return out;
    if (n.status === 'em_andamento' && ['corretiva', 'preventiva', 'calibracao'].includes(n.tipo)) {
      if (['operacional', 'restrito'].includes(it.status)) { const o = { ...it }; it.status = 'em_manutencao'; histLocal('infra_itens', it.id, 'UPDATE', diffOf(o, it)); out.push('infra_itens'); }
      if (!n.data_inicio) n.data_inicio = hoje();
    } else if (['concluida', 'cancelada'].includes(n.status) && !D.infra_manutencoes.some(m => m.item_id === n.item_id && m.status === 'em_andamento' && m.id !== n.id)) {
      if (it.status === 'em_manutencao') { const o = { ...it }; it.status = 'operacional'; histLocal('infra_itens', it.id, 'UPDATE', diffOf(o, it)); out.push('infra_itens'); }
      if (n.status === 'concluida' && !n.data_conclusao) n.data_conclusao = hoje();
    }
  }
  return out;
}
function desfazAditivo(a) {   // modo local: equivalente ao gatilho de exclusão
  const p = byId('projetos', a.projeto_id); if (!p) return false;
  const o = { ...p };
  if (a.novo_fim && p.fim === a.novo_fim && a.fim_anterior) p.fim = a.fim_anterior;
  if (a.novo_valor != null && a.novo_valor !== '' && num(p.valor_total) === num(a.novo_valor) && a.valor_anterior != null) p.valor_total = num(a.valor_anterior);
  const d = diffOf(o, p); if (Object.keys(d).length) { histLocal('projetos', p.id, 'UPDATE', d); return true; } return false;
}
const DEPENDENTES = {
  plano_itens: ['plano_itens', 'despesas'],
  aditivos: ['aditivos', 'projetos'],
  infra_manutencoes: ['infra_itens', 'infra_manutencoes'],
  tarefas: ['tarefas'],
};

const Data = {
  async insert(t, row) {
    const k = keyOf(t);
    let n = { ...clone(DEFAULTS[t] || {}), ...row };
    if (k === 'id' && !n.id) n.id = newId();
    if (!TABLES[t].noStamp) { n.criado_em = n.criado_em || new Date().toISOString(); n.atualizado_em = n.criado_em; }
    if (['tarefas', 'prospeccoes', 'infra_reservas', 'infra_manutencoes', 'documentos', 'pendencias'].includes(t) && !n.criado_por) n.criado_por = ME.uid;
    if (t === 'avaliacoes') { n.avaliado_em = n.avaliado_em || new Date().toISOString(); n.avaliado_por = n.avaliado_por || ME.uid; }
    validar(t, n, null); travas(t, n, null); efeitosAntes(t, n, null);
    n = soColunas(t, n);
    if (ME.online) {
      const saved = await SB.insert(t, n); D[t].push(saved);
      if (DEPENDENTES[t]) await SB.reload(DEPENDENTES[t]);
      return saved;
    }
    if (!permitido(t, 'ins', n, null)) falha('Você não tem permissão para esta operação.');
    D[t].push(n);
    histLocal(t, n.id, 'INSERT', n);
    const extra = efeitosDepois(t, n, 'INSERT');
    Local.persist(t); extra.forEach(x => Local.persist(x)); Local.persist('historico');
    return n;
  },
  async update(t, id, patch) {
    const k = keyOf(t);
    const o = D[t].find(r => r[k] === id); if (!o) falha('Registro não encontrado (talvez já excluído).');
    let n = { ...o, ...patch };
    validar(t, n, o); travas(t, n, o); efeitosAntes(t, n, o);
    n = soColunas(t, n);
    if (ME.online) {
      const mud = {};   // envia tudo o que mudou: o que foi digitado e os ajustes automáticos (efeitosAntes)
      for (const c of Object.keys(n)) if (JSON.stringify(n[c] ?? null) !== JSON.stringify(o[c] ?? null)) mud[c] = n[c];
      delete mud.criado_em; delete mud.atualizado_em; delete mud.atualizado_por;
      if (!Object.keys(mud).length) return o;
      const saved = await SB.update(t, id, mud, o);
      Object.assign(o, saved);
      if (DEPENDENTES[t]) await SB.reload(DEPENDENTES[t]);
      return o;
    }
    if (!permitido(t, 'upd', n, o)) falha('Você não tem permissão para esta operação.');
    if (!TABLES[t].noStamp) { n.atualizado_em = new Date().toISOString(); n.atualizado_por = ME.uid; }
    const d = diffOf(o, n);
    Object.assign(o, n);
    if (Object.keys(d).length) histLocal(t, o[k], 'UPDATE', d);
    const extra = efeitosDepois(t, o);
    Local.persist(t); extra.forEach(x => Local.persist(x)); Local.persist('historico');
    return o;
  },
  async remove(t, id) {
    const k = keyOf(t);
    const o = D[t].find(r => r[k] === id); if (!o) return;
    if (ME.online) {
      await SB.remove(t, { [k]: id });
      await SB.reload([...new Set([t, ...dependentesDe(t), ...(DEPENDENTES[t] || [])])]);
      return;
    }
    if (!permitido(t, 'del', null, o)) falha('Você não tem permissão para excluir.');
    const changed = new Set([t, 'historico']);
    if (t === 'aditivos' && desfazAditivo(o)) changed.add('projetos');
    removeCascata(t, o, changed);
    changed.forEach(x => Local.persist(x));
  },
  async removeWhere(t, match) {   // p/ tabelas sem id (tarefa_responsaveis)
    const rows = D[t].filter(r => Object.entries(match).every(([k, v]) => r[k] === v));
    if (!rows.length) return;
    if (ME.online) { await SB.remove(t, match); await SB.reload([t]); return; }
    for (const r of rows) if (!permitido(t, 'del', null, r)) falha('Você não tem permissão para esta operação.');
    D[t] = D[t].filter(r => !rows.includes(r));
    Local.persist(t);
  },
};
function dependentesDe(t, seen = new Set()) {
  FK.filter(f => f[2] === t && !seen.has(f[0])).forEach(f => { seen.add(f[0]); dependentesDe(f[0], seen); });
  return [...seen];
}
function removeCascata(t, row, changed) {
  const k = keyOf(t), id = row[k];
  for (const [ct, col, rt, rule] of FK) {
    if (rt !== t) continue;
    const refs = D[ct].filter(r => r[col] === id && r !== row);
    if (!refs.length) continue;
    if (rule === 'restrict') falha(RESTRICT_MSG[ct] || 'Registro em uso por outros dados.');
  }
  for (const [ct, col, rt, rule] of FK) {
    if (rt !== t) continue;
    const refs = D[ct].filter(r => r[col] === id && r !== row);
    if (!refs.length) continue;
    changed.add(ct);
    if (rule === 'null') refs.forEach(r => { const o = { ...r }; r[col] = null; histLocal(ct, r.id, 'UPDATE', diffOf(o, r)); });
    else if (rule === 'cascade') refs.forEach(r => removeCascata(ct, r, changed));
  }
  D[t] = D[t].filter(r => r !== row);
  histLocal(t, id, 'DELETE', row);
}

/* ── cálculos de apoio (equivalentes às visões do banco) ────────── */
const Calc = {
  vigente: p => p && p.situacao === 'vigente' && p.fim >= hoje(),
  vencido: p => p && p.situacao === 'vigente' && p.fim < hoje(),
  carga(pessoaId) {
    return D.alocacoes.filter(a => a.pessoa_id === pessoaId && a.status === 'ativo' && Calc.vigente(byId('projetos', a.projeto_id)))
      .reduce((s, a) => s + num(a.carga_pct), 0);
  },
  coordenadores: pid => D.alocacoes.filter(a => a.projeto_id === pid && a.coordena).map(a => byId('pessoas', a.pessoa_id)).filter(Boolean),
  responsaveis: tid => D.tarefa_responsaveis.filter(r => r.tarefa_id === tid).map(r => byId('pessoas', r.pessoa_id)).filter(Boolean),
  atrasada: t => !t.concluida && t.prazo && t.prazo < hoje(),
  gerentes(gid) {
    const t = hoje();
    return D.gerencia_membros.filter(gm => gm.gerencia_id === gid && (!gm.desde || gm.desde <= t) && (!gm.ate || gm.ate >= t));
  },
  ultimaAvaliacao: pid => D.avaliacoes.filter(a => a.prospeccao_id === pid).sort((a, b) => String(b.avaliado_em).localeCompare(String(a.avaliado_em)))[0],
  /* financeiro */
  mesesVinculo: v => monthsIncl(v.inicio, v.fim),
  totalVinculo: v => num(v.valor_mensal) * Calc.mesesVinculo(v),
  mesesPagos(v, ref = new Date()) {
    if (v.status === 'previsto' || v.status === 'suspenso') return 0;
    if (!v.inicio || !v.fim || !num(v.valor_mensal)) return 0;
    const d1 = new Date(ref.getFullYear(), ref.getMonth(), 1), dw = d1.getDay();
    if (dw === 6) d1.setDate(3); else if (dw === 0) d1.setDate(2);     // 1º dia útil (sem feriados)
    const eleg = ref >= d1 ? ref.getFullYear() * 12 + ref.getMonth() : ref.getFullYear() * 12 + ref.getMonth() - 1;
    const a = +v.inicio.slice(0, 4) * 12 + +v.inicio.slice(5, 7) - 1, b = +v.fim.slice(0, 4) * 12 + +v.fim.slice(5, 7) - 1;
    return Math.max(0, Math.min(eleg, b) - a + 1);
  },
  /* cronograma físico (meses relativos ao início do projeto) */
  mesData(p, m) { const d = toDate(p.inicio); return isoOf(new Date(d.getFullYear(), d.getMonth() + (m - 1), 1)); },
  mesDataFim(p, m) { const d = toDate(p.inicio); return isoOf(new Date(d.getFullYear(), d.getMonth() + m, 0)); },
  mesAtual(p, ref) { const a = toDate(p.inicio), h = toDate(ref || hoje()); return (h.getFullYear() - a.getFullYear()) * 12 + (h.getMonth() - a.getMonth()) + 1; },
  codCmp: (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? -1) - (y[i] ?? -1); if (d) return d; } return 0; },
  /* árvore do cronograma com agregação nos grupos (média ponderada pela duração) */
  /* nº de meses cobertos por um período (01/10 a 30/09 = 12), igual à view v_plano_bolsas */
  mesesPeriodo(ini, fim) {
    if (!isDate(ini) || !isDate(fim) || fim < ini) return 0;
    const a = toDate(ini), b = toDate(addDays(fim, 1));
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
  },
  /* fim de uma bolsa de n meses que começa em ini (ex.: 01/10/2026 + 12 → 30/09/2027) */
  fimBolsa(ini, n) { const d = toDate(ini); return addDays(isoOf(new Date(d.getFullYear(), d.getMonth() + n, d.getDate())), -1); },
  /* equipe do plano de trabalho: posições + bolsa prevista + vínculos (bolsas pagas/previstas) por posição */
  equipePlano(p) {
    const rows = D.equipe_plano.filter(e => e.projeto_id === p.id).sort((a, b) => (a.ordem - b.ordem) || String(a.nome_plano).localeCompare(b.nome_plano, 'pt-BR', { numeric: true })).map(e => {
      const bolsa = D.equipe_plano_bolsas.find(b => b.vaga_id === e.id) || null;
      const vincs = D.vinculos_financeiros.filter(v => v.vaga_id === e.id).sort((a, b) => String(a.inicio).localeCompare(b.inicio));
      const mesesVinc = vincs.reduce((s, v) => s + Calc.mesesPeriodo(v.inicio, v.fim), 0);
      const vAtual = vincs.find(v => v.pessoa_id === e.pessoa_id && ['previsto', 'ativo', 'suspenso'].includes(v.status)) || null;
      return { e, bolsa, vincs, mesesVinc, mesesRest: bolsa ? Math.max(0, bolsa.meses - mesesVinc) : null, vAtual, pessoa: e.pessoa_id ? byId('pessoas', e.pessoa_id) : null };
    });
    const ativos = rows.filter(r => r.e.status !== 'cancelada');
    const tot = { posicoes: ativos.length, ocupadas: rows.filter(r => r.e.status === 'ocupada').length, vagas: rows.filter(r => r.e.status === 'vaga').length, selecao: rows.filter(r => r.e.status === 'selecao').length,
      bolsas: ativos.reduce((s, r) => s + (r.bolsa ? num(r.bolsa.valor_mensal) * r.bolsa.meses : 0), 0), porRubrica: {} };
    ativos.forEach(r => { if (r.bolsa) tot.porRubrica[r.bolsa.rubrica] = (tot.porRubrica[r.bolsa.rubrica] || 0) + num(r.bolsa.valor_mensal) * r.bolsa.meses; });
    const ocupantes = new Set(rows.filter(r => r.e.status === 'ocupada').map(r => r.e.pessoa_id));
    const fora = D.alocacoes.filter(a => a.projeto_id === p.id && a.status === 'ativo' && !ocupantes.has(a.pessoa_id));
    return { rows, tot, fora };
  },
  cronograma(p, ref) {
    const itens = D.cronograma.filter(c => c.projeto_id === p.id).sort((a, b) => Calc.codCmp(a.codigo, b.codigo));
    const porCod = new Map(itens.map(c => [c.codigo, c]));
    const pai = c => { const seg = c.codigo.split('.'); while (seg.length > 1) { seg.pop(); const k = seg.join('.'); if (porCod.has(k)) return k; } return null; };
    const filhos = new Map(); itens.forEach(c => { const k = pai(c); if (!filhos.has(k)) filhos.set(k, []); filhos.get(k).push(c); });
    const mAt = Calc.mesAtual(p, ref), rows = [];
    const previstoFolha = (ini, fim) => { if (ini == null || fim == null) return null; if (mAt < ini) return 0; if (mAt > fim) return 100; return Math.round((mAt - ini + 1) / (fim - ini + 1) * 100); };
    const walk = (c, nivel) => {
      const fs = filhos.get(c.codigo) || [];
      const i = rows.length; rows.push(null);
      if (!fs.length) {
        const dur = c.mes_inicio != null && c.mes_fim != null ? c.mes_fim - c.mes_inicio + 1 : 1;
        const pct = c.status === 'cancelada' ? null : num(c.percentual), prev = previstoFolha(c.mes_inicio, c.mes_fim);
        const atras = c.status !== 'cancelada' && c.status !== 'concluida' && c.mes_fim != null && mAt > c.mes_fim;
        const naoIni = c.status === 'planejada' && num(c.percentual) === 0 && c.mes_inicio != null && mAt >= c.mes_inicio && !atras;
        const r = { c, nivel, folha: true, ini: c.mes_inicio, fim: c.mes_fim, pct, prev, peso: c.status === 'cancelada' ? 0 : dur, atras, naoIni, n: 1 };
        rows[i] = r; return r;
      }
      const sub = fs.map(f => walk(f, nivel + 1));
      const ini = Math.min(...sub.map(x => x.ini ?? Infinity)), fim = Math.max(...sub.map(x => x.fim ?? -Infinity));
      const peso = sub.reduce((s, x) => s + x.peso, 0);
      const pond = k => peso ? Math.round(sub.reduce((s, x) => s + num(x[k]) * x.peso, 0) / peso) : 0;
      const r = { c, nivel, folha: false, ini: isFinite(ini) ? ini : null, fim: isFinite(fim) ? fim : null, pct: pond('pct'), prev: pond('prev'), peso,
        atras: sub.some(x => x.atras), naoIni: sub.some(x => x.naoIni), n: sub.reduce((s, x) => s + x.n, 0), nAtras: sub.reduce((s, x) => s + (x.folha ? +x.atras : x.nAtras || 0), 0) };
      rows[i] = r; return r;
    };
    const raizes = filhos.get(null) || [];
    const tops = raizes.map(c => walk(c, 0));
    const peso = tops.reduce((s, x) => s + x.peso, 0);
    const tot = { pct: peso ? Math.round(tops.reduce((s, x) => s + num(x.pct) * x.peso, 0) / peso) : 0, prev: peso ? Math.round(tops.reduce((s, x) => s + num(x.prev) * x.peso, 0) / peso) : 0,
      folhas: rows.filter(r => r.folha).length, atrasadas: rows.filter(r => r.folha && r.atras).length, concluidas: rows.filter(r => r.folha && r.c.status === 'concluida').length, mesAtual: mAt };
    return { rows, tot };
  },
  folhasCronograma: pid => { const cs = D.cronograma.filter(c => c.projeto_id === pid); return cs.filter(c => !cs.some(x => x.codigo.startsWith(c.codigo + '.'))).sort((a, b) => Calc.codCmp(a.codigo, b.codigo)); },
  /* contrato e entregas */
  /* checklist de entrada/saída de uma pessoa (itens que se aplicam ao tipo dela) */
  checklistPessoa(pe, fase) {
    const itens = D.checklist_itens.filter(i => i.ativo !== false && i.fase === fase && (!(i.tipos || []).length || i.tipos.includes(pe.tipo))).sort(by('ordem'));
    return itens.map(i => ({ i, reg: D.pessoa_checklist.find(r => r.pessoa_id === pe.id && r.item_id === i.id && r.feito) || null }));
  },
  /* pessoas em integração (entrada incompleta, ingresso nos últimos 12 meses ou ocupando posição) e em desligamento */
  emTransicao() {
    const lim = addDays(hoje(), -365), out = [];
    D.pessoas.forEach(pe => {
      if (pe.saida) { const c = Calc.checklistPessoa(pe, 'saida'); const falta = c.filter(x => !x.reg && x.i.obrigatorio).length; if (falta || pe.saida >= addDays(hoje(), -30)) out.push({ pe, fase: 'saida', c, falta }); return; }
      if (pe.ativo === false) return;
      const c = Calc.checklistPessoa(pe, 'entrada'), falta = c.filter(x => !x.reg && x.i.obrigatorio).length;
      if (falta && ((pe.ingresso && pe.ingresso >= lim) || D.pessoa_checklist.some(r => r.pessoa_id === pe.id))) out.push({ pe, fase: 'entrada', c, falta });
    });
    return out;
  },
  /* saúde do projeto: indicadores e sinal (bad/warn/ok) com os motivos */
  saudeProjeto(p) {
    const t = hoje(), mot = { bad: [], warn: [] };
    const ini = toDate(p.inicio), fim = toDate(p.fim), dur = Math.max(1, fim - ini);
    const tempoPct = Math.max(0, Math.min(100, Math.round((toDate(t) - ini) / dur * 100)));
    const mesesRest = Math.max(0, Math.round((fim - toDate(t)) / (864e5 * 30.44)));
    const cr = Calc.cronograma(p).tot, fis = cr.folhas ? { pct: cr.pct, prev: cr.prev, atr: cr.atrasadas } : null;
    const veF = Perm.veFin(p.id); let fin = null, caixa = null, parcAtr = 0;
    if (veF) { const o = Calc.totaisOrc(p.id); if (o.aprovado) fin = { exec: o.executado, apr: o.aprovado, pct: Math.round(o.executado / o.aprovado * 100) };
      if (D.desembolsos.some(d => d.projeto_id === p.id)) { const ds = Calc.desembolso(p).tot; caixa = ds.caixa; parcAtr = ds.atrasadas.length; } }
    const ents = Calc.entregasAbertas(p.id), entAtr = ents.filter(Calc.entregaAtrasada).length, entProx = ents.filter(e => e.prazo >= t && e.prazo <= addDays(t, 30)).length;
    const pend = D.pendencias.filter(x => x.projeto_id === p.id && Calc.pendenciaAberta(x)), pendAtr = pend.filter(Calc.pendenciaAtrasada).length;
    const eq = Calc.equipePlano(p).tot;
    if (Calc.vencido(p)) mot.bad.push('vigência vencida');
    if (p.status === 'critico') mot.bad.push('marcado como crítico');
    if (entAtr) mot.bad.push(`${entAtr} entrega(s) atrasada(s)`);
    if (pendAtr) mot.bad.push(`${pendAtr} pendência(s) atrasada(s)`);
    if (caixa != null && caixa < -0.005) mot.bad.push('gastos acima do recebido');
    if (parcAtr) mot.bad.push(`${parcAtr} parcela(s) não recebida(s)`);
    if (fis && fis.prev - fis.pct > 15) mot.bad.push(`físico ${fis.prev - fis.pct} p.p. abaixo do previsto`);
    else if (fis && fis.prev - fis.pct > 5) mot.warn.push(`físico ${fis.prev - fis.pct} p.p. abaixo do previsto`);
    if (fin && tempoPct >= 25 && tempoPct - fin.pct > 25) mot.warn.push(`execução financeira baixa (${fin.pct}% em ${tempoPct}% do prazo)`);
    if (!Calc.vencido(p) && mesesRest <= 6 && ((fis && fis.pct < 80) || (fin && fin.pct < 70))) mot.warn.push(`faltam ${mesesRest} mês(es) de vigência`);
    if (eq.vagas) mot.warn.push(`${eq.vagas} vaga(s) aberta(s)`);
    if (entProx && !entAtr) mot.warn.push(`${entProx} entrega(s) nos próximos 30 dias`);
    if (p.status === 'atencao') mot.warn.push('marcado como atenção');
    const sinal = mot.bad.length ? 'bad' : mot.warn.length ? 'warn' : 'ok';
    return { p, tempoPct, mesesRest, fis, fin, caixa, veF, entAtr, entProx, pendAb: pend.length, pendAtr, eq, sinal, mot };
  },
  /* eventos datados do portfólio (linha do tempo) */
  eventos(de, ate, soMeus) {
    const ev = [], me = ME.pessoa_id, dentro = d => d && d >= de && d <= ate, vig = D.projetos.filter(p => p.situacao === 'vigente');
    const add = (data, cat, txt, pid, a, extra) => ev.push({ data, cat, txt, pid, a, ...extra });
    D.entregas.filter(e => Calc.entregaAberta(e) && dentro(e.prazo) && (!soMeus || e.responsavel_id === me)).forEach(e => add(e.prazo, 0, 'Entrega: ' + e.titulo, e.projeto_id, { a: 'projAbrir', id: e.projeto_id, aba: 'entregas' }));
    D.pendencias.filter(x => Calc.pendenciaAberta(x) && dentro(x.prazo) && (!soMeus || x.responsavel_id === me)).forEach(x => add(x.prazo, 0, 'Pendência: ' + x.titulo, x.projeto_id, { a: 'projAbrir', id: x.projeto_id, aba: 'docs' }));
    vig.forEach(p => D.cronograma.filter(c => c.projeto_id === p.id && c.mes_fim && !['concluida', 'cancelada'].includes(c.status) && (!soMeus || c.responsavel_id === me)).forEach(c => { const d = Calc.mesDataFim(p, c.mes_fim); if (dentro(d)) add(d, 1, `Atividade ${c.codigo}: ${c.titulo}`, p.id, { a: 'projAbrir', id: p.id, aba: 'cronograma' }); }));
    if (!soMeus) {
      D.desembolsos.filter(d => Perm.veFin(d.projeto_id) && d.status === 'prevista' && dentro(d.data_prevista)).forEach(d => add(d.data_prevista, 2, `Parcela ${d.numero} (${fmtBRL(d.valor_previsto)})`, d.projeto_id, { a: 'finDesemb', id: d.projeto_id }));
      D.vinculos_financeiros.filter(v => Perm.veFin(v.projeto_id) && ['previsto', 'ativo'].includes(v.status) && dentro(v.fim)).forEach(v => add(v.fim, 2, `Fim da bolsa de ${nomePessoa(v.pessoa_id)}`, v.projeto_id, { a: 'eqBolsas' }));
      D.equipe_plano.filter(e => e.status === 'selecao' && dentro(e.selecao_prazo)).forEach(e => add(e.selecao_prazo, 3, `Prazo da seleção: ${e.nome_plano}`, e.projeto_id, { a: 'eqVagas' }));
      D.pessoas.filter(pe => dentro(pe.saida)).forEach(pe => add(pe.saida, 3, `Saída de ${pe.nome}`, null, { a: 'pessoaAbrir', id: pe.id }));
      vig.filter(p => dentro(p.fim)).forEach(p => add(p.fim, 4, 'Fim da vigência', p.id, { a: 'projAbrir', id: p.id }));
      D.prospeccoes.filter(x => ['avaliacao', 'aprovada', 'renegociar'].includes(x.situacao) && dentro(x.prazo_submissao)).forEach(x => add(x.prazo_submissao, 4, 'Submissão: ' + x.nome, null, { a: 'nav', t: 'prospeccao' }));
    }
    return ev.sort((a, b) => a.data.localeCompare(b.data) || a.cat - b.cat);
  },
  /* agenda pessoal: tudo o que está sob a minha responsabilidade */
  minhaAgenda() {
    const me = ME.pessoa_id; if (!me) return [];
    const it = [], add = (data, tipo, txt, pid, a) => it.push({ data: data || null, tipo, txt, pid, a });
    D.tarefas.filter(x => !x.concluida && D.tarefa_responsaveis.some(r => r.tarefa_id === x.id && r.pessoa_id === me)).forEach(x => add(x.prazo, 'Tarefa', x.titulo, x.projeto_id, { a: 'tarefaEditar', id: x.id }));
    D.entregas.filter(e => Calc.entregaAberta(e) && e.responsavel_id === me).forEach(e => add(e.prazo, 'Entrega', e.titulo, e.projeto_id, { a: 'projAbrir', id: e.projeto_id, aba: 'entregas' }));
    D.pendencias.filter(x => Calc.pendenciaAberta(x) && x.responsavel_id === me).forEach(x => add(x.prazo, 'Pendência', x.titulo, x.projeto_id, { a: 'projAbrir', id: x.projeto_id, aba: 'docs' }));
    D.projetos.filter(p => p.situacao === 'vigente').forEach(p => D.cronograma.filter(c => c.projeto_id === p.id && c.responsavel_id === me && c.mes_inicio && !['concluida', 'cancelada'].includes(c.status)).forEach(c => {
      if (Calc.mesData(p, c.mes_inicio) <= addDays(hoje(), 30)) add(Calc.mesDataFim(p, c.mes_fim || c.mes_inicio), 'Atividade ' + c.codigo, c.titulo + (c.percentual ? ` (${c.percentual}%)` : ''), p.id, { a: 'projAbrir', id: p.id, aba: 'cronograma' }); }));
    D.infra_reservas.filter(r => ['solicitada', 'confirmada'].includes(r.status) && (r.responsavel_id === me || r.solicitante_id === me)).forEach(r => { const d = isoOf(new Date(r.inicio)); if (d >= hoje() && d <= addDays(hoje(), 30)) { const h = new Date(r.inicio);
      add(d, 'Reserva', `${(byId('infra_itens', r.item_id) || {}).nome || 'Equipamento'} · ${pad2(h.getHours())}:${pad2(h.getMinutes())}${r.status === 'solicitada' ? ' (aguardando confirmação)' : ''}`, r.projeto_id, { a: 'resEditar', id: r.id }); } });
    const pe = byId('pessoas', me);
    if (pe) ['entrada', 'saida'].forEach(f => { if (f === 'saida' && !pe.saida) return; const c = Calc.checklistPessoa(pe, f), falta = c.filter(x => !x.reg && x.i.obrigatorio).length;
      if (falta && (f === 'saida' || D.pessoa_checklist.some(r => r.pessoa_id === me) || (pe.ingresso && pe.ingresso >= addDays(hoje(), -365)))) add(null, f === 'entrada' ? 'Integração' : 'Desligamento', `${falta} item(ns) pendente(s) no checklist`, null, { a: 'pessoaAbrir', id: me }); });
    return it;
  },
  pendenciaAberta: x => ['aberta', 'em_andamento', 'aguardando'].includes(x.status),
  pendenciaAtrasada: x => Calc.pendenciaAberta(x) && !!x.prazo && x.prazo < hoje(),
  /* checklist documental: o que o projeto deveria ter e ainda não tem */
  checklistDocs(p) {
    const docs = D.documentos.filter(d => d.projeto_id === p.id), tem = t => docs.some(d => d.tipo === t);
    const out = [];
    const edital = (p.tipo || 'edital') === 'edital';
    out.push({ ok: tem('contrato'), txt: edital ? 'Contrato / convênio assinado' : 'Contrato de prestação de serviço', tipo: 'contrato' });
    if (edital) { out.push({ ok: tem('proposta'), txt: 'Proposta submetida ao edital', tipo: 'proposta', opcional: true }); out.push({ ok: tem('plano_trabalho'), txt: 'Plano de trabalho aprovado', tipo: 'plano_trabalho' }); }
    Calc.aditivosDe(p.id).forEach(a => out.push({ ok: docs.some(d => d.aditivo_id === a.id) || !!a.documento, txt: `${a.numero || 'Termo aditivo'}${a.data_assinatura ? ' de ' + fmtD(a.data_assinatura) : ''} — documento`, tipo: 'termo_aditivo', aditivo_id: a.id }));
    D.entregas.filter(e => e.projeto_id === p.id && ['entregue', 'aprovado'].includes(e.status)).forEach(e => out.push({ ok: !!e.documento || docs.some(d => d.entrega_id === e.id), txt: `Entrega “${e.titulo}” — comprovante / arquivo`, tipo: /^relat/.test(e.tipo || '') ? 'relatorio' : /^prestacao/.test(e.tipo || '') ? 'prestacao_contas' : 'outro', entrega_id: e.id }));
    return out;
  },
  entregaAberta: e => ['pendente', 'em_elaboracao'].includes(e.status),
  entregaAtrasada: e => Calc.entregaAberta(e) && e.prazo < hoje(),
  entregasAbertas(pid) { return D.entregas.filter(e => (!pid || e.projeto_id === pid) && Calc.entregaAberta(e)).sort(byName('prazo')); },
  aditivosDe: pid => D.aditivos.filter(a => a.projeto_id === pid).sort((a, b) => String(a.data_assinatura || a.criado_em).localeCompare(String(b.data_assinatura || b.criado_em)) || String(a.criado_em).localeCompare(String(b.criado_em))),
  vigenciaOriginal(p) { const ad = Calc.aditivosDe(p.id).find(a => a.novo_fim && a.fim_anterior); return ad ? ad.fim_anterior : p.fim; },
  valorOriginal(p) { const ad = Calc.aditivosDe(p.id).find(a => a.novo_valor != null && a.novo_valor !== '' && a.valor_anterior != null); return ad ? num(ad.valor_anterior) : num(p.valor_total); },
  /* orçamento por rubricas */
  plano(p) { const tipo = (p && p.tipo) || 'edital'; return D.rubricas.filter(r => !r.planos || r.planos.includes(tipo)).sort(by('ordem')); },
  /* valor do item em R$: quantidade × unitário × câmbio */
  valorItem(i) { const q = i.quantidade == null ? 1 : num(i.quantidade), c = i.moeda && i.moeda !== 'BRL' ? num(i.cambio) || 0 : 1; return Math.round(q * num(i.valor_unitario) * c * 100) / 100; },
  /* plano de aplicação: por rubrica final, itens previstos × aprovado × execução */
  planoAplicacao(p) {
    const itens = D.plano_itens.filter(i => i.projeto_id === p.id);
    const desp = D.despesas.filter(d => d.projeto_id === p.id);
    const exItem = {}; desp.forEach(d => { if (d.item_id) exItem[d.item_id] = (exItem[d.item_id] || 0) + num(d.valor); });
    const grupos = Calc.folhas(p).map(r => {
      const v = Calc.valoresRubrica(p.id, r.codigo);
      const its = itens.filter(i => i.rubrica === r.codigo).sort((a, b) => (a.numero - b.numero) || String(a.descricao).localeCompare(b.descricao)).map(i => ({ i, executado: exItem[i.id] || 0, saldo: num(i.valor_previsto) - (exItem[i.id] || 0) }));
      const ativos = its.filter(x => x.i.status !== 'cancelado');
      const previstoItens = ativos.reduce((s, x) => s + num(x.i.valor_previsto), 0);
      const semItem = desp.filter(d => d.rubrica === r.codigo && !d.item_id).reduce((s, d) => s + num(d.valor), 0);
      return { r, ...v, itens: its, previstoItens, semItem, dif: v.aprovado && its.length ? previstoItens - v.aprovado : 0 };
    });
    const tot = { itens: itens.filter(i => i.status !== 'cancelado').length, adquiridos: itens.filter(i => i.status === 'adquirido').length, emAquisicao: itens.filter(i => i.status === 'em_aquisicao').length,
      previsto: grupos.reduce((s, g) => s + g.previstoItens, 0), executadoItens: Object.values(exItem).reduce((s, v) => s + v, 0) };
    return { grupos, tot };
  },
  /* desembolso: parcelas × recebido × executado; caixa por rubrica.
     A parcela recebida libera sua distribuição por rubrica (proporcional ao valor recebido);
     sem distribuição, reparte pelo aprovado das rubricas. */
  situacaoParcela: d => d.status === 'cancelada' ? 'cancelada' : d.status === 'recebida' ? (num(d.valor_recebido) + 0.005 < num(d.valor_previsto) ? 'parcial' : 'recebida') : (d.data_prevista && d.data_prevista < hoje() ? 'atrasada' : 'prevista'),
  desembolso(p) {
    const folhas = Calc.folhas(p), orc = {}; folhas.forEach(r => orc[r.codigo] = Calc.valoresRubrica(p.id, r.codigo));
    const totApr = folhas.reduce((s, r) => s + orc[r.codigo].aprovado, 0);
    const parcelas = D.desembolsos.filter(d => d.projeto_id === p.id).sort((a, b) => a.numero - b.numero).map(d => {
      const dist = D.desembolso_rubricas.filter(x => x.desembolso_id === d.id && num(x.valor) > 0);
      const somaDist = dist.reduce((s, x) => s + num(x.valor), 0);
      const base = {}; if (dist.length) dist.forEach(x => base[x.rubrica] = num(x.valor)); else if (totApr) folhas.forEach(r => { if (orc[r.codigo].aprovado) base[r.codigo] = num(d.valor_previsto) * orc[r.codigo].aprovado / totApr; });
      const somaBase = Object.values(base).reduce((s, v) => s + v, 0);
      const st = Calc.situacaoParcela(d);
      const fator = ['recebida', 'parcial'].includes(st) && somaBase ? num(d.valor_recebido) / somaBase : 0;
      const liberado = {}; Object.entries(base).forEach(([c, v]) => liberado[c] = v * fator);
      return { d, st, dist, somaDist, base, liberado, distDif: dist.length ? somaDist - num(d.valor_previsto) : 0 };
    });
    const ativas = parcelas.filter(x => x.st !== 'cancelada');
    const rub = folhas.map(r => {
      const previsto = ativas.reduce((s, x) => s + (x.base[r.codigo] || 0), 0), recebido = ativas.reduce((s, x) => s + (x.liberado[r.codigo] || 0), 0), o = orc[r.codigo];
      return { r, aprovado: o.aprovado, previsto, recebido, executado: o.executado, caixa: recebido - o.executado, aLiberar: previsto - recebido };
    }).filter(x => x.aprovado || x.previsto || x.executado);
    const executado = folhas.reduce((s, r) => s + orc[r.codigo].executado, 0);
    const tot = { aprovado: totApr, previsto: ativas.reduce((s, x) => s + num(x.d.valor_previsto), 0), recebido: ativas.reduce((s, x) => s + (['recebida', 'parcial'].includes(x.st) ? num(x.d.valor_recebido) : 0), 0),
      executado, atrasadas: ativas.filter(x => x.st === 'atrasada'), proxima: ativas.find(x => ['prevista', 'atrasada'].includes(x.st)) || null };
    tot.caixa = tot.recebido - tot.executado; tot.aReceber = ativas.reduce((s, x) => s + (['prevista', 'atrasada'].includes(x.st) ? num(x.d.valor_previsto) : x.st === 'parcial' ? num(x.d.valor_previsto) - num(x.d.valor_recebido) : 0), 0);
    tot.rubricasNeg = rub.filter(x => x.caixa < -0.005 && parcelas.length);
    return { parcelas, rub, tot };
  },
  valoresRubrica(pid, cod) {
    const o = D.orcamento_rubricas.find(x => x.projeto_id === pid && x.rubrica === cod) || null;
    const ds = D.despesas.filter(d => d.projeto_id === pid && d.rubrica === cod);
    return { aprovado: num(o && o.aprovado), previsto: num(o && o.previsto), executado: ds.reduce((s, d) => s + num(d.valor), 0), n: ds.length, orc: o };
  },
  /* árvore do orçamento: linhas na ordem do plano, com grupos somando as folhas */
  orcamento(p) {
    const plano = Calc.plano(p), rows = [];
    const walk = (r, nivel) => {
      const fs = plano.filter(x => x.pai === r.codigo);
      if (!fs.length) { const v = Calc.valoresRubrica(p.id, r.codigo); rows.push({ r, nivel, folha: true, ...v }); return v; }
      const i = rows.length; rows.push(null);
      const acc = { aprovado: 0, previsto: 0, executado: 0, n: 0 };
      fs.forEach(f => { const v = walk(f, nivel + 1); acc.aprovado += v.aprovado; acc.previsto += v.previsto; acc.executado += v.executado; acc.n += v.n; });
      rows[i] = { r, nivel, folha: false, ...acc }; return acc;
    };
    const tot = { aprovado: 0, previsto: 0, executado: 0, n: 0 };
    plano.filter(r => !r.pai || !plano.some(x => x.codigo === r.pai)).forEach(r => { const v = walk(r, 0); tot.aprovado += v.aprovado; tot.previsto += v.previsto; tot.executado += v.executado; tot.n += v.n; });
    rows.forEach(x => x.saldo = x.aprovado - x.executado); tot.saldo = tot.aprovado - tot.executado;
    return { rows, tot };
  },
  totaisOrc(pid) { const p = byId('projetos', pid); return p ? Calc.orcamento(p).tot : { aprovado: 0, previsto: 0, executado: 0, saldo: 0, n: 0 }; },
  folhas(p) { const pl = Calc.plano(p); return pl.filter(r => !pl.some(x => x.pai === r.codigo)); },
  rotuloRubrica: cod => { const r = D.rubricas.find(x => x.codigo === cod); return r ? `${r.codigo} ${r.nome}` : (cod || '—'); },
  /* parcelas de bolsa: meses de competência já vencidos (até o 1º dia útil do mês corrente) */
  competenciasPagas(v, ref = new Date()) {
    const n = Calc.mesesPagos(v, ref), out = [];
    for (let i = 0; i < n; i++) { const d = new Date(+v.inicio.slice(0, 4), +v.inicio.slice(5, 7) - 1 + i, 1); out.push(isoOf(d)); }
    return out;
  },
  primeiroDiaUtil(iso) { const d = toDate(iso.slice(0, 8) + '01'); const w = d.getDay(); if (w === 6) d.setDate(3); else if (w === 0) d.setDate(2); return isoOf(d); },
  /* infraestrutura */
  alertasInfra() {
    const out = [], t = hoje(), lim = addDays(t, 30);
    D.infra_manutencoes.forEach(m => {
      const it = byId('infra_itens', m.item_id); if (!it || it.status === 'desativado') return;
      if (m.status === 'concluida' && m.proxima_em && m.proxima_em <= lim
        && !D.infra_manutencoes.some(m2 => m2.item_id === m.item_id && m2.tipo === m.tipo && m2.status !== 'cancelada' && m2.criado_em > m.criado_em))
        out.push({ item: it, tipo: 'vencimento', txt: `${lbl(TIPO_MAN, m.tipo)} "${m.titulo}" ${m.proxima_em < t ? 'venceu em' : 'vence em'} ${fmtD(m.proxima_em)}`, grave: m.proxima_em < t });
      if (m.status === 'planejada' && m.data_prevista && m.data_prevista < t)
        out.push({ item: it, tipo: 'atrasada', txt: `Manutenção "${m.titulo}" prevista para ${fmtD(m.data_prevista)} ainda não iniciada`, grave: true });
    });
    D.infra_itens.filter(i => ['inoperante', 'em_manutencao'].includes(i.status))
      .forEach(i => out.push({ item: i, tipo: 'parado', txt: `${i.nome}: ${ST_INFRA[i.status][0].toLowerCase()}`, grave: i.status === 'inoperante' }));
    D.infra_habilitacoes.filter(h => h.validade && h.validade <= lim).forEach(h => {
      const it = byId('infra_itens', h.item_id); if (!it) return;
      out.push({ item: it, tipo: 'habilitacao', txt: `Habilitação de ${nomePessoa(h.pessoa_id)} em ${it.nome} ${h.validade < t ? 'venceu' : 'vence'} em ${fmtD(h.validade)}`, grave: h.validade < t });
    });
    return out;
  },
  horasReserva: r => r.horas_uso != null && r.horas_uso !== '' ? num(r.horas_uso) : (new Date(r.fim) - new Date(r.inicio)) / 36e5,
};
