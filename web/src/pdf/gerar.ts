import { pdf } from "@react-pdf/renderer";
import { numeroDoc, num } from "@/lib/format";
import { dadosEmpresa } from "@/lib/consultas";
import { montarEmpresa } from "./comum";
import { DocumentoOrcamento } from "./orcamento-pdf";
import type { Comparativo } from "@/lib/comparativo";
import type {
  Cliente, Cotacao, CotacaoItem, Orcamento, OrcamentoItem, OrdemServico,
  OrdemServicoItem, Servico, Veiculo, Vistoria,
} from "@/lib/tipos";

// Reexportado por conveniencia; mora em ./aba para poder ser importado
// estaticamente sem arrastar o @react-pdf/renderer junto.
export { reservarAba } from "./aba";

/**
 * Geracao dos PDFs no navegador.
 *
 * No sistema anterior isso era uma rota de servidor. Aqui o @react-pdf/renderer
 * monta o documento no proprio aparelho — o que tambem significa que o PDF sai
 * sem uma ida ao servidor, e funciona com a oficina offline depois da tela
 * carregada.
 */

function abrirOuBaixar(blob: Blob, nome: string, baixar: boolean, aba?: Window | null) {
  const url = URL.createObjectURL(blob);

  const baixarArquivo = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.rel = "noopener";
    // O Firefox so dispara o clique se o elemento estiver no documento.
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (baixar) {
    baixarArquivo();
    // Se uma aba foi reservada e nao sera usada, fecha para nao deixar lixo.
    aba?.close();
  } else if (aba && !aba.closed) {
    aba.location.replace(url);
  } else {
    // Pop-up bloqueado ou aba fechada pelo usuario: baixa, que nunca e barrado.
    // Melhor entregar o arquivo do que nao fazer nada.
    baixarArquivo();
  }

  // Nao revoga na hora: o navegador precisa da URL viva enquanto abre a aba.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type ItemComServico = OrcamentoItem & {
  servicos: Pick<Servico, "descricao" | "garantiaDias"> | null;
};

export async function baixarPdfOrcamento(
  dados: {
    orc: Orcamento;
    cliente: Cliente;
    veiculo: Veiculo;
    itens: ItemComServico[];
    vendedor: string | null;
  },
  baixar: boolean,
  aba?: Window | null,
) {
  const empresa = montarEmpresa(await dadosEmpresa());
  const { orc, cliente, veiculo, itens, vendedor } = dados;

  const endereco = cliente.endereco
    ? `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}${
        cliente.bairro ? ` — ${cliente.bairro}` : ""
      }${cliente.cidade ? `, ${cliente.cidade}/${cliente.uf ?? ""}` : ""}`
    : null;

  const doc = DocumentoOrcamento({
    empresa,
    orcamento: {
      numero: orc.numero,
      criadoEm: new Date(orc.criadoEm),
      validoAte: new Date(orc.validoAte),
      status: orc.status,
      cliente: {
        nome: cliente.nome,
        documento: cliente.documento,
        telefone: cliente.telefone,
        email: cliente.email,
        endereco,
      },
      veiculo: {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        ano: veiculo.ano,
        cor: veiculo.cor,
      },
      kmVeiculo: orc.kmVeiculo,
      vendedor,
      itens: itens.map((i) => ({
        descricao: i.descricao,
        quantidade: num(i.quantidade),
        precoUnit: num(i.precoUnit),
        desconto: num(i.desconto),
        total: num(i.total),
        garantiaDias: i.servicos?.garantiaDias ?? 0,
      })),
      subtotal: num(orc.subtotal),
      desconto: num(orc.desconto),
      total: num(orc.total),
      prazoEntregaDias: orc.prazoEntregaDias,
      formaPagamento: orc.formaPagamento,
      observacoes: orc.observacoes,
    },
  });

  const blob = await pdf(doc).toBlob();
  abrirOuBaixar(blob, `orcamento-${numeroDoc(orc.numero)}-${veiculo.placa}.pdf`, baixar, aba);
}

/* ------------------------------------------------------------
   Ordem de servico
   ------------------------------------------------------------ */

export async function baixarPdfOrdem(
  dados: {
    os: OrdemServico;
    cliente: Cliente;
    veiculo: Veiculo;
    itens: OrdemServicoItem[];
    nomeFuncionario: (id: string | null | undefined) => string;
  },
  baixar: boolean,
  aba?: Window | null,
) {
  const { DocumentoOrdem } = await import("./ordem-pdf");
  const empresa = montarEmpresa(await dadosEmpresa());
  const { os, cliente, veiculo, itens, nomeFuncionario } = dados;

  const doc = DocumentoOrdem({
    empresa,
    ordem: {
      numero: os.numero,
      status: os.status,
      dataEntrada: new Date(os.dataEntrada),
      dataSaida: os.dataSaida ? new Date(os.dataSaida) : null,
      funcionarioEntrada: nomeFuncionario(os.funcionarioEntradaId),
      funcionarioSaida: os.funcionarioSaidaId ? nomeFuncionario(os.funcionarioSaidaId) : null,
      kmEntrada: os.kmEntrada,
      kmSaida: os.kmSaida,
      combustivelEntrada: os.combustivelEntrada,
      observacoesEntrada: os.observacoesEntrada,
      observacoesSaida: os.observacoesSaida,
      clienteRetirou: os.clienteRetirou,
      documentoRetirada: os.documentoRetirada,
      assinaturaEntrega: os.assinaturaEntrega,
      previsaoEntrega: os.previsaoEntrega ? new Date(os.previsaoEntrega) : null,
      cliente: {
        nome: cliente.nome,
        documento: cliente.documento,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
      },
      veiculo: {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        ano: veiculo.ano,
        cor: veiculo.cor,
      },
      itens: itens.map((i) => ({
        descricao: i.descricao,
        quantidade: num(i.quantidade),
        precoUnit: num(i.precoUnit),
        total: num(i.total),
        status: i.status,
        responsavel: i.responsavelId ? nomeFuncionario(i.responsavelId) : null,
        garantiaDias: i.garantiaDias,
      })),
      subtotal: num(os.subtotal),
      desconto: num(os.desconto),
      total: num(os.total),
      observacoes: os.observacoes,
    },
  });

  const blob = await pdf(doc).toBlob();
  abrirOuBaixar(blob, `os-${numeroDoc(os.numero)}-${veiculo.placa}.pdf`, baixar, aba);
}

/* ------------------------------------------------------------
   Vistoria
   ------------------------------------------------------------ */

export async function baixarPdfVistoria(
  dados: {
    v: Vistoria;
    os: OrdemServico;
    cliente: Cliente;
    veiculo: Veiculo;
    vistoriador: string;
    fotos: { dataUrl: string; legenda: string | null }[];
    fotosOmitidas: number;
  },
  baixar: boolean,
  aba?: Window | null,
) {
  const { DocumentoVistoria } = await import("./vistoria-pdf");
  const empresa = montarEmpresa(await dadosEmpresa());
  const { v, os, cliente, veiculo, vistoriador, fotos, fotosOmitidas } = dados;

  // A conferencia de limpeza e controle de qualidade interno: nao vira via para
  // o cliente. Emitir isso como documento entregaria a ele o registro de que o
  // servico foi reprovado e refeito.
  if (v.tipo === "LIMPEZA") {
    throw new Error("A conferência de limpeza é interna e não gera documento.");
  }

  const doc = DocumentoVistoria({
    empresa,
    vistoria: {
      tipo: v.tipo,
      data: new Date(v.data),
      km: v.km,
      combustivel: v.combustivel,
      vistoriador,
      pertences: v.pertences,
      observacoes: v.observacoes,
      aprovadaCliente: v.aprovadaCliente,
      assinaturaCliente: v.assinaturaCliente,
      fotos,
      fotosOmitidas,
      checklist: v.checklist,
      avarias: v.avarias,
      ordem: {
        numero: os.numero,
        cliente: {
          nome: cliente.nome,
          documento: cliente.documento,
          telefone: cliente.telefone,
        },
        veiculo: {
          placa: veiculo.placa,
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          ano: veiculo.ano,
          cor: veiculo.cor,
        },
      },
    },
  });

  const blob = await pdf(doc).toBlob();
  abrirOuBaixar(
    blob,
    `vistoria-${v.tipo.toLowerCase()}-os${numeroDoc(os.numero)}-${veiculo.placa}.pdf`,
    baixar,
    aba,
  );
}

/* ------------------------------------------------------------
   Cotação: mapa comparativo (interno) e pedido (para o fornecedor)
   ------------------------------------------------------------ */

export async function baixarPdfCotacao(dados: {
  cot: Cotacao;
  itens: CotacaoItem[];
  comparativo: Comparativo;
  ordem: OrdemServico | null;
  solicitante: string | null;
  tipo: "mapa" | "pedido";
}, aba?: Window | null) {
  const { DocumentoCotacao } = await import("./cotacao-pdf");
  const empresa = montarEmpresa(await dadosEmpresa());

  const doc = DocumentoCotacao({
    empresa,
    tipo: dados.tipo,
    dados: {
      cotacao: dados.cot,
      itens: dados.itens,
      comparativo: dados.comparativo,
      solicitante: dados.solicitante,
      osNumero: dados.ordem?.numero ?? null,
    },
  });

  const blob = await pdf(doc).toBlob();
  const nome = dados.tipo === "mapa"
    ? `mapa-cotacao-${numeroDoc(dados.cot.numero)}.pdf`
    : `pedido-cotacao-${numeroDoc(dados.cot.numero)}.pdf`;
  abrirOuBaixar(blob, nome, false, aba);
}

/* ------------------------------------------------------------
   Relatorio gerencial
   ------------------------------------------------------------ */

export async function baixarPdfRelatorio(
  dados: import("./relatorio-pdf").DadosRelatorioPdf,
  baixar: boolean,
  aba?: Window | null,
) {
  const { DocumentoRelatorio } = await import("./relatorio-pdf");
  const empresa = montarEmpresa(await dadosEmpresa());

  const blob = await pdf(DocumentoRelatorio({ empresa, dados })).toBlob();
  const nome = `relatorio-${dados.comp.inicio}-a-${dados.comp.fim}.pdf`;
  abrirOuBaixar(blob, nome, baixar, aba);
}
