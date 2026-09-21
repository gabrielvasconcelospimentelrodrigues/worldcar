import type {
  CategoriaServico,
  Papel,
  Setor,
  StatusAlerta,
  StatusItemOS,
  StatusLancamento,
  StatusOS,
  StatusOrcamento,
  TipoAlerta,
  TipoOcorrenciaRH,
  FormaPagamento,
} from "@prisma/client";

/** Cor = classe Tailwind do badge. Preto/branco/vermelho + apoios discretos. */
type Rotulo = { label: string; cor: string };

export const STATUS_ORCAMENTO: Record<StatusOrcamento, Rotulo> = {
  RASCUNHO: { label: "Rascunho", cor: "bg-zinc-700 text-zinc-100" },
  ENVIADO: { label: "Enviado", cor: "bg-blue-600 text-white" },
  APROVADO: { label: "Aprovado", cor: "bg-emerald-600 text-white" },
  RECUSADO: { label: "Recusado", cor: "bg-red-700 text-white" },
  EXPIRADO: { label: "Expirado", cor: "bg-amber-600 text-white" },
  CONVERTIDO: { label: "Convertido em OS", cor: "bg-zinc-900 text-white" },
};

export const STATUS_OS: Record<StatusOS, Rotulo> = {
  AGUARDANDO: { label: "Aguardando", cor: "bg-amber-600 text-white" },
  EM_ANDAMENTO: { label: "Em andamento", cor: "bg-blue-600 text-white" },
  PAUSADA: { label: "Pausada", cor: "bg-zinc-600 text-white" },
  PRONTA: { label: "Pronta p/ retirada", cor: "bg-emerald-600 text-white" },
  ENTREGUE: { label: "Entregue", cor: "bg-zinc-900 text-white" },
  CANCELADA: { label: "Cancelada", cor: "bg-red-700 text-white" },
};

export const STATUS_ITEM_OS: Record<StatusItemOS, Rotulo> = {
  PENDENTE: { label: "Pendente", cor: "bg-zinc-600 text-white" },
  EXECUTANDO: { label: "Executando", cor: "bg-blue-600 text-white" },
  CONCLUIDO: { label: "Concluido", cor: "bg-emerald-600 text-white" },
  CANCELADO: { label: "Cancelado", cor: "bg-red-700 text-white" },
};

export const STATUS_LANCAMENTO: Record<StatusLancamento, Rotulo> = {
  PENDENTE: { label: "Pendente", cor: "bg-amber-600 text-white" },
  PAGO: { label: "Pago", cor: "bg-emerald-600 text-white" },
  ATRASADO: { label: "Atrasado", cor: "bg-red-700 text-white" },
  CANCELADO: { label: "Cancelado", cor: "bg-zinc-600 text-white" },
};

export const STATUS_ALERTA: Record<StatusAlerta, Rotulo> = {
  PENDENTE: { label: "Pendente", cor: "bg-amber-600 text-white" },
  CONCLUIDO: { label: "Concluido", cor: "bg-emerald-600 text-white" },
  CANCELADO: { label: "Cancelado", cor: "bg-zinc-600 text-white" },
};

export const TIPO_ALERTA: Record<TipoAlerta, Rotulo> = {
  RETORNO_GARANTIA: { label: "Retorno de garantia", cor: "bg-red-600 text-white" },
  RETORNO_MANUTENCAO: { label: "Retorno de manutencao", cor: "bg-blue-600 text-white" },
  ORCAMENTO_EXPIRANDO: { label: "Orcamento expirando", cor: "bg-amber-600 text-white" },
  ENTREGA_ATRASADA: { label: "Entrega atrasada", cor: "bg-red-700 text-white" },
  POS_VENDA: { label: "Pos-venda", cor: "bg-emerald-600 text-white" },
  FINANCEIRO_VENCIMENTO: { label: "Vencimento financeiro", cor: "bg-zinc-700 text-white" },
};

export const CATEGORIA_SERVICO: Record<CategoriaServico, string> = {
  LAVAGEM: "Lavagem",
  ESTETICA: "Estetica automotiva",
  FUNILARIA: "Funilaria",
  PINTURA: "Pintura",
  PELICULA: "Pelicula / Insulfilm",
  REVITALIZACAO: "Revitalizacao",
  VITRIFICACAO: "Vitrificacao",
  MECANICA: "Mecanica",
  OUTROS: "Outros",
};

export const SETOR: Record<Setor, string> = {
  LAVAGEM: "Lavagem",
  FUNILARIA: "Funilaria",
  PINTURA: "Pintura",
  ESTETICA: "Estetica",
  PELICULA: "Pelicula",
  MECANICA: "Mecanica",
  ADMINISTRATIVO: "Administrativo",
};

export const PAPEL: Record<Papel, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  ATENDENTE: "Atendente",
  TECNICO: "Tecnico",
};

export const FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  DEBITO: "Cartao de debito",
  CREDITO: "Cartao de credito",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferencia",
  OUTRO: "Outro",
};

export const TIPO_OCORRENCIA_RH: Record<TipoOcorrenciaRH, string> = {
  FERIAS: "Ferias",
  FALTA: "Falta",
  ATESTADO: "Atestado",
  ADVERTENCIA: "Advertencia",
  SUSPENSAO: "Suspensao",
  TREINAMENTO: "Treinamento",
  ELOGIO: "Elogio",
  OUTRO: "Outro",
};

export const NIVEIS_COMBUSTIVEL = ["Reserva", "1/4", "1/2", "3/4", "Cheio"] as const;

/** Checklist padrao da vistoria (entrada e saida usam o mesmo). */
export const CHECKLIST_VISTORIA: { grupo: string; itens: string[] }[] = [
  {
    grupo: "Documentacao e chaves",
    itens: ["Documento do veiculo", "Chave reserva", "Manual"],
  },
  {
    grupo: "Externo",
    itens: [
      "Para-choque dianteiro",
      "Para-choque traseiro",
      "Capo",
      "Teto",
      "Porta-malas",
      "Lateral direita",
      "Lateral esquerda",
      "Retrovisores",
      "Parabrisa",
      "Vidros laterais",
      "Farois",
      "Lanternas",
      "Rodas / calotas",
      "Pneus (estado)",
      "Estepe",
    ],
  },
  {
    grupo: "Interno",
    itens: [
      "Bancos",
      "Tapetes",
      "Painel",
      "Radio / multimidia",
      "Ar-condicionado",
      "Forro do teto",
      "Porta-luvas",
    ],
  },
  {
    grupo: "Itens obrigatorios",
    itens: ["Triangulo", "Macaco", "Chave de roda", "Extintor"],
  },
];

export type EstadoItemVistoria = "OK" | "AVARIA" | "NA";

export const ESTADO_VISTORIA: Record<EstadoItemVistoria, Rotulo> = {
  OK: { label: "OK", cor: "bg-emerald-600 text-white" },
  AVARIA: { label: "Avaria", cor: "bg-red-700 text-white" },
  NA: { label: "N/A", cor: "bg-zinc-600 text-white" },
};
