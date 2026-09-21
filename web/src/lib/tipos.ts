/**
 * Tipos do dominio, espelhando as tabelas do Postgres.
 *
 * No sistema anterior o Prisma gerava isto. Aqui o navegador fala direto com o
 * Supabase via PostgREST, entao os nomes das colunas sao os do banco — que o
 * Prisma criou em camelCase e entre aspas ("clienteId", "criadoEm"). Por isso
 * aparecem assim, e nao em snake_case como e comum no Postgres.
 */

export type Papel = "ADMIN" | "GERENTE" | "ATENDENTE" | "TECNICO";

export type Setor =
  | "LAVAGEM" | "FUNILARIA" | "PINTURA" | "ESTETICA"
  | "PELICULA" | "MECANICA" | "ADMINISTRATIVO";

export type CategoriaServico =
  | "LAVAGEM" | "ESTETICA" | "FUNILARIA" | "PINTURA" | "PELICULA"
  | "REVITALIZACAO" | "VITRIFICACAO" | "MECANICA" | "OUTROS";

export type TipoPessoa = "FISICA" | "JURIDICA";

export type StatusOrcamento =
  | "RASCUNHO" | "ENVIADO" | "APROVADO" | "RECUSADO" | "EXPIRADO" | "CONVERTIDO";

export type StatusOS =
  | "AGUARDANDO" | "EM_ANDAMENTO" | "PAUSADA" | "PRONTA" | "ENTREGUE" | "CANCELADA";

export type StatusItemOS = "PENDENTE" | "EXECUTANDO" | "CONCLUIDO" | "CANCELADO";

/** LIMPEZA e a conferencia interna pos-lavagem, nao um documento do cliente. */
export type TipoVistoria = "ENTRADA" | "SAIDA" | "LIMPEZA";

export type TipoAlerta =
  | "RETORNO_GARANTIA" | "RETORNO_MANUTENCAO" | "ORCAMENTO_EXPIRANDO"
  | "ENTREGA_ATRASADA" | "POS_VENDA" | "FINANCEIRO_VENCIMENTO";

export type StatusAlerta = "PENDENTE" | "CONCLUIDO" | "CANCELADO";

export type TipoLancamento = "RECEITA" | "DESPESA";

export type StatusLancamento = "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO";

export type FormaPagamento =
  | "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO" | "BOLETO" | "TRANSFERENCIA" | "OUTRO";

export type TipoOcorrenciaRH =
  | "FERIAS" | "FALTA" | "ATESTADO" | "ADVERTENCIA"
  | "SUSPENSAO" | "TREINAMENTO" | "ELOGIO" | "OUTRO";

/** O PostgREST devolve numeric como string, para nao perder precisao. */
export type Decimal = string | number;

export type Cliente = {
  id: string;
  tipo: TipoPessoa;
  nome: string;
  documento: string | null;
  telefone: string;
  telefone2: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  descontoPct: number | string;
};

export type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number | null;
  cor: string | null;
  chassi: string | null;
  renavam: string | null;
  km: number | null;
  observacoes: string | null;
  fotoUrl: string | null;
  fotoCredito: string | null;
  fotoOrigem: "WEB" | "VISTORIA" | "MANUAL" | null;
  clienteId: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type Servico = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaServico;
  preco: Decimal;
  custo: Decimal;
  duracaoMin: number;
  garantiaDias: number;
  comissaoPct: Decimal;
  ativo: boolean;
  criadoEm: string;
};

/** Item da equipe pela visao `equipe` — sem salario nem CPF. */
export type MembroEquipe = {
  id: string;
  nome: string;
  cargo: string;
  setor: Setor;
  ativo: boolean;
};

export type Funcionario = MembroEquipe & {
  matricula: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  admissao: string;
  demissao: string | null;
  salario: Decimal;
  comissaoPct: Decimal;
  observacoes: string | null;
};

export type OrcamentoItem = {
  id: string;
  orcamentoId: string;
  servicoId: string | null;
  descricao: string;
  quantidade: Decimal;
  precoUnit: Decimal;
  desconto: Decimal;
  total: Decimal;
  ordem: number;
};

export type Orcamento = {
  id: string;
  numero: number;
  status: StatusOrcamento;
  clienteId: string;
  veiculoId: string;
  vendedorId: string | null;
  validadeDias: number;
  validoAte: string;
  kmVeiculo: number | null;
  subtotal: Decimal;
  descontoTipo: string;
  desconto: Decimal;
  total: Decimal;
  prazoEntregaDias: number | null;
  formaPagamento: string | null;
  observacoes: string | null;
  motivoRecusa: string | null;
  aprovadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type OrdemServicoItem = {
  id: string;
  ordemId: string;
  servicoId: string | null;
  descricao: string;
  quantidade: Decimal;
  precoUnit: Decimal;
  desconto: Decimal;
  total: Decimal;
  status: StatusItemOS;
  responsavelId: string | null;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  garantiaDias: number;
};

export type OrdemServico = {
  id: string;
  numero: number;
  status: StatusOS;
  orcamentoId: string | null;
  clienteId: string;
  veiculoId: string;
  dataEntrada: string;
  funcionarioEntradaId: string;
  kmEntrada: number | null;
  combustivelEntrada: string | null;
  observacoesEntrada: string | null;
  dataSaida: string | null;
  funcionarioSaidaId: string | null;
  kmSaida: number | null;
  observacoesSaida: string | null;
  clienteRetirou: string | null;
  documentoRetirada: string | null;
  assinaturaEntrega: string | null;
  previsaoEntrega: string | null;
  subtotal: Decimal;
  desconto: Decimal;
  total: Decimal;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type EstadoItemVistoria = "OK" | "AVARIA" | "NA";

export type Avaria = { local: string; descricao: string; gravidade: string };

export type Vistoria = {
  id: string;
  tipo: TipoVistoria;
  ordemId: string;
  funcionarioId: string;
  data: string;
  km: number | null;
  combustivel: string | null;
  checklist: Record<string, EstadoItemVistoria>;
  avarias: Avaria[];
  pertences: string | null;
  observacoes: string | null;
  assinaturaCliente: string | null;
  aprovadaCliente: boolean;
  criadoEm: string;
  /** So para tipo LIMPEZA: APROVADA libera, REPROVADA devolve para refazer. */
  resultadoLimpeza: "APROVADA" | "REPROVADA" | null;
  /** Qual servico da OS foi conferido. */
  itemId: string | null;
  motivoReprovacao: string | null;
  refeitaDe: string | null;
};

export type VistoriaFoto = {
  id: string;
  vistoriaId: string;
  caminho: string;
  legenda: string | null;
  criadoEm: string;
};

export type Alerta = {
  id: string;
  tipo: TipoAlerta;
  status: StatusAlerta;
  titulo: string;
  descricao: string | null;
  dataAlvo: string;
  clienteId: string | null;
  veiculoId: string | null;
  ordemId: string | null;
  concluidoEm: string | null;
  resultado: string | null;
  criadoEm: string;
};

export type CategoriaFinanceira = {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  ativo: boolean;
};

export type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  status: StatusLancamento;
  descricao: string;
  valor: Decimal;
  vencimento: string;
  pagamento: string | null;
  forma: FormaPagamento | null;
  categoriaId: string | null;
  ordemId: string | null;
  parcela: number | null;
  totalParcelas: number | null;
  fornecedor: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type Comissao = {
  id: string;
  funcionarioId: string;
  ordemId: string;
  baseCalculo: Decimal;
  percentual: Decimal;
  valor: Decimal;
  pago: boolean;
  pagoEm: string | null;
  referencia: string;
  criadoEm: string;
};

export type OcorrenciaRH = {
  id: string;
  funcionarioId: string;
  tipo: TipoOcorrenciaRH;
  inicio: string;
  fim: string | null;
  descricao: string | null;
  criadoEm: string;
};

export type Empresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  instagram: string | null;
  logoUrl: string | null;
  observacoesOrcamento: string | null;
};

/** Retorno da funcao resumo_painel() — o painel inteiro numa ida ao banco. */
export type ResumoPainel = {
  os_ativas: number;
  os_prontas: number;
  orcamentos_abertos: number;
  alertas_hoje: number;
  receita_mes: Decimal;
  despesa_mes: Decimal;
  a_receber: Decimal;
};

/* ------------------------------------------------------------
   Compras: fornecedores e cotação
   ------------------------------------------------------------ */

export type TipoFornecedor =
  | "PECAS" | "TINTAS" | "INSUMOS" | "PELICULAS"
  | "FERRAMENTAS" | "SERVICO_TERCEIRIZADO" | "OUTROS";

export type StatusCotacao = "ABERTA" | "RESPONDIDA" | "DECIDIDA" | "CANCELADA";

export type Fornecedor = {
  id: string;
  nome: string;
  razaoSocial: string | null;
  documento: string | null;
  tipo: TipoFornecedor;
  contato: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  prazoEntregaDias: number | null;
  condicoesPagamento: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type Cotacao = {
  id: string;
  numero: number;
  status: StatusCotacao;
  descricao: string;
  ordemId: string | null;
  solicitanteId: string | null;
  prazoResposta: string | null;
  observacoes: string | null;
  decididaEm: string | null;
  motivoDecisao: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type CotacaoItem = {
  id: string;
  cotacaoId: string;
  descricao: string;
  quantidade: Decimal;
  unidade: string;
  observacoes: string | null;
  ordem: number;
};

export type CotacaoFornecedor = {
  id: string;
  cotacaoId: string;
  fornecedorId: string;
  respondidoEm: string | null;
  prazoEntregaDias: number | null;
  condicoesPagamento: string | null;
  frete: Decimal;
  desconto: Decimal;
  observacoes: string | null;
  vencedor: boolean;
};

/** Um preço na matriz item × fornecedor. */
export type CotacaoPreco = {
  id: string;
  cotacaoItemId: string;
  cotacaoFornecedorId: string;
  precoUnit: Decimal;
  disponivel: boolean;
  prazoDias: number | null;
  marca: string | null;
  observacao: string | null;
  vencedor: boolean;
};
