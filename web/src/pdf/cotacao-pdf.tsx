import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import logoSelo from "@/assets/logo-pdf.png";
import { brl, data, num, numeroDoc } from "@/lib/format";
import { CINZA, VERMELHO, est, type DadosEmpresa } from "./comum";
import type { Comparativo } from "@/lib/comparativo";
import type { Cotacao, CotacaoItem } from "@/lib/tipos";

export type DadosCotacaoPdf = {
  cotacao: Cotacao;
  itens: CotacaoItem[];
  comparativo: Comparativo;
  solicitante: string | null;
  osNumero: number | null;
};

function Cabecalho({ empresa }: { empresa: DadosEmpresa }) {
  return (
    <View style={est.cabecalho}>
      <View style={est.marca}>
        <Image style={est.marcaSelo} src={logoSelo} />
      </View>
      <View style={est.empresaInfo}>
        {empresa.cnpj ? <Text>CNPJ {empresa.cnpj}</Text> : null}
        <Text>{empresa.endereco}</Text>
        <Text>{empresa.cidadeUf}</Text>
        <Text>{empresa.telefone} · {empresa.instagram}</Text>
      </View>
    </View>
  );
}

function Campo({ rotulo, valor, largura }: { rotulo: string; valor: string; largura: string }) {
  return (
    <View style={[est.campo, { width: largura }]}>
      <Text style={est.campoRotulo}>{rotulo.toUpperCase()}</Text>
      <Text style={est.campoValor}>{valor || "—"}</Text>
    </View>
  );
}

/* ============================================================
   Mapa comparativo — documento interno
   ============================================================ */

function MapaComparativo({ d, empresa }: { d: DadosCotacaoPdf; empresa: DadosEmpresa }) {
  const { cotacao, comparativo } = d;
  const colunas = comparativo.colunas.filter((c) => c.respondeu);

  // A tabela cresce para o lado conforme o numero de fornecedores. Acima de 4
  // a pagina A4 em retrato nao comporta, entao vira paisagem.
  const paisagem = colunas.length > 3;
  const largItem = paisagem ? "34%" : "40%";
  const largCol = `${(paisagem ? 60 : 54) / Math.max(1, colunas.length)}%`;

  return (
    <Page size="A4" orientation={paisagem ? "landscape" : "portrait"} style={est.pagina}>
      <View style={est.faixaVia}>
        <Text style={est.faixaViaTexto}>MAPA COMPARATIVO — USO INTERNO</Text>
        <Text style={est.faixaViaTexto}>COTAÇÃO Nº {numeroDoc(cotacao.numero)}</Text>
      </View>

      <Cabecalho empresa={empresa} />

      <View style={est.tituloDoc}>
        <Text style={est.tituloTexto}>MAPA COMPARATIVO DE COTAÇÃO</Text>
        <Text style={est.numeroDoc}>Nº {numeroDoc(cotacao.numero)}</Text>
      </View>

      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>OBJETO DA COTAÇÃO</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Descrição" valor={cotacao.descricao} largura="50%" />
            <Campo rotulo="Aberta em" valor={data(cotacao.criadoEm)} largura="16%" />
            <Campo rotulo="Solicitante" valor={d.solicitante ?? "—"} largura="18%" />
            <Campo rotulo="OS" valor={d.osNumero ? numeroDoc(d.osNumero) : "—"} largura="16%" />
          </View>
        </View>
      </View>

      {/* Matriz */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>PREÇOS RECEBIDOS</Text>

        <View style={est.tabelaCabecalho}>
          <Text style={[est.th, { width: largItem }]}>ITEM</Text>
          {colunas.map((c) => (
            <Text key={c.cf.id} style={[est.th, { width: largCol, textAlign: "center" }]}>
              {(c.fornecedor?.nome ?? "—").toUpperCase()}
            </Text>
          ))}
          <Text style={[est.th, { width: "6%", textAlign: "right" }]}>VAR.</Text>
        </View>

        {comparativo.linhas.map((linha, idx) => (
          <View key={linha.item.id} style={[est.tr, ...(idx % 2 ? [est.trZebra] : [])]}>
            <View style={{ width: largItem }}>
              <Text style={est.td}>{linha.item.descricao}</Text>
              <Text style={est.tdPeq}>
                {num(linha.item.quantidade)} {linha.item.unidade}
                {linha.item.observacoes ? ` · ${linha.item.observacoes}` : ""}
              </Text>
            </View>

            {colunas.map((c) => {
              const celula = linha.celulas.get(c.cf.id);
              const melhor = celula?.melhorDoItem;
              return (
                <View key={c.cf.id} style={{ width: largCol, alignItems: "center" }}>
                  <Text style={[est.td, melhor
                    ? { fontFamily: "Helvetica-Bold", color: "#0f7a4d" } : {}]}>
                    {celula?.disponivel ? brl(celula.precoUnit) : "—"}
                  </Text>
                  {celula?.disponivel && (
                    <Text style={est.tdPeq}>{brl(celula.totalLinha)}</Text>
                  )}
                </View>
              );
            })}

            <Text style={[est.tdPeq, { width: "6%", textAlign: "right",
              color: linha.amplitude > 0 ? VERMELHO : CINZA }]}>
              {linha.amplitude > 0 ? brl(linha.amplitude) : "—"}
            </Text>
          </View>
        ))}

        {/* Totais */}
        <View style={[est.tr, { backgroundColor: "#eeeef0", borderBottomWidth: 0 }]}>
          <Text style={[est.td, { width: largItem, fontFamily: "Helvetica-Bold" }]}>
            TOTAL
          </Text>
          {colunas.map((c) => {
            const vencedorTotal = comparativo.melhorTotal?.cf.id === c.cf.id;
            return (
              <View key={c.cf.id} style={{ width: largCol, alignItems: "center" }}>
                <Text style={[est.td, { fontFamily: "Helvetica-Bold" },
                  vencedorTotal ? { color: "#0f7a4d" } : {}]}>
                  {brl(c.total)}
                </Text>
                {c.parcial && <Text style={est.tdPeq}>cotação parcial</Text>}
                {vencedorTotal && <Text style={[est.tdPeq, { color: "#0f7a4d" }]}>melhor total</Text>}
              </View>
            );
          })}
          <Text style={{ width: "6%" }} />
        </View>
      </View>

      {/* Condições de cada fornecedor */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>CONDIÇÕES</Text>
        <View style={est.blocoCorpo}>
          {colunas.map((c) => (
            <View key={c.cf.id} style={est.linha}>
              <Campo rotulo="Fornecedor" valor={c.fornecedor?.nome ?? "—"} largura="26%" />
              <Campo rotulo="Itens cotados"
                valor={`${c.itensCotados} de ${d.itens.length}`} largura="14%" />
              <Campo rotulo="Frete" valor={brl(c.cf.frete)} largura="12%" />
              <Campo rotulo="Desconto" valor={brl(c.cf.desconto)} largura="12%" />
              <Campo rotulo="Prazo"
                valor={c.cf.prazoEntregaDias ? `${c.cf.prazoEntregaDias} dias` : "—"}
                largura="12%" />
              <Campo rotulo="Pagamento" valor={c.cf.condicoesPagamento ?? "—"} largura="24%" />
            </View>
          ))}
        </View>
      </View>

      {comparativo.economiaDividindo > 0 && (
        <View style={est.aviso}>
          <Text style={est.avisoTexto}>
            Comprando cada item de quem cotou mais barato, o total seria{" "}
            {brl(comparativo.totalPorItem)} — {brl(comparativo.economiaDividindo)} abaixo do
            melhor fornecedor único. Pesar o frete e o trabalho de comprar em mais de um lugar.
          </Text>
        </View>
      )}

      {cotacao.motivoDecisao && (
        <View style={est.bloco}>
          <Text style={est.blocoTitulo}>DECISÃO</Text>
          <View style={est.blocoCorpo}>
            <Text style={est.campoValor}>{cotacao.motivoDecisao}</Text>
          </View>
        </View>
      )}

      <View style={est.assinaturas}>
        <View style={est.assinatura}>
          <View style={est.assinaturaEspaco} />
          <View style={est.assinaturaLinha}>
            <Text style={est.assinaturaRotulo}>{d.solicitante ?? "Solicitante"}</Text>
          </View>
        </View>
        <View style={est.assinatura}>
          <View style={est.assinaturaEspaco} />
          <View style={est.assinaturaLinha}>
            <Text style={est.assinaturaRotulo}>Aprovação da compra</Text>
          </View>
        </View>
      </View>

      <View style={est.rodape} fixed>
        <Text style={est.rodapeTexto}>
          {empresa.nome} · {empresa.telefone} · {empresa.instagram}
        </Text>
        <Text style={est.rodapeTexto}>
          Mapa comparativo · Cotação {numeroDoc(cotacao.numero)}
        </Text>
      </View>
    </Page>
  );
}

/* ============================================================
   Pedido de cotação — vai para o fornecedor, sem preços
   ============================================================ */

function PedidoCotacao({ d, empresa }: { d: DadosCotacaoPdf; empresa: DadosEmpresa }) {
  const { cotacao, itens } = d;

  return (
    <Page size="A4" style={est.pagina}>
      <View style={est.faixaVia}>
        <Text style={est.faixaViaTexto}>PEDIDO DE COTAÇÃO</Text>
        <Text style={est.faixaViaTexto}>Nº {numeroDoc(cotacao.numero)}</Text>
      </View>

      <Cabecalho empresa={empresa} />

      <View style={est.tituloDoc}>
        <Text style={est.tituloTexto}>PEDIDO DE COTAÇÃO</Text>
        <Text style={est.numeroDoc}>Nº {numeroDoc(cotacao.numero)}</Text>
        <Text style={{ fontSize: 7.5, color: CINZA, marginTop: 2 }}>
          Emitido em {data(cotacao.criadoEm)}
          {cotacao.prazoResposta ? ` · Responder até ${data(cotacao.prazoResposta)}` : ""}
        </Text>
      </View>

      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>SOLICITAÇÃO</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Descrição" valor={cotacao.descricao} largura="60%" />
            <Campo rotulo="Solicitante" valor={d.solicitante ?? "—"} largura="40%" />
          </View>
          {cotacao.observacoes ? (
            <View style={{ marginTop: 2 }}>
              <Text style={est.campoRotulo}>OBSERVAÇÕES</Text>
              <Text style={[est.campoValor, { lineHeight: 1.5 }]}>{cotacao.observacoes}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Itens com espaço em branco para o fornecedor preencher */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>ITENS — PREENCHER COM SEU PREÇO</Text>
        <View style={est.tabelaCabecalho}>
          <Text style={[est.th, { width: "6%" }]}>Nº</Text>
          <Text style={[est.th, { width: "44%" }]}>DESCRIÇÃO</Text>
          <Text style={[est.th, { width: "10%", textAlign: "center" }]}>QTD</Text>
          <Text style={[est.th, { width: "10%", textAlign: "center" }]}>UN.</Text>
          <Text style={[est.th, { width: "15%", textAlign: "center" }]}>PREÇO UN.</Text>
          <Text style={[est.th, { width: "15%", textAlign: "center" }]}>PRAZO</Text>
        </View>

        {itens.map((i, idx) => (
          <View key={i.id} style={[est.tr, ...(idx % 2 ? [est.trZebra] : [])]}>
            <Text style={[est.td, { width: "6%" }]}>{idx + 1}</Text>
            <View style={{ width: "44%" }}>
              <Text style={est.td}>{i.descricao}</Text>
              {i.observacoes ? <Text style={est.tdPeq}>{i.observacoes}</Text> : null}
            </View>
            <Text style={[est.td, { width: "10%", textAlign: "center" }]}>
              {num(i.quantidade)}
            </Text>
            <Text style={[est.td, { width: "10%", textAlign: "center" }]}>{i.unidade}</Text>
            <Text style={[est.td, { width: "15%", textAlign: "center", color: "#c9c9cf" }]}>
              _________
            </Text>
            <Text style={[est.td, { width: "15%", textAlign: "center", color: "#c9c9cf" }]}>
              _________
            </Text>
          </View>
        ))}
      </View>

      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>CONDIÇÕES — PREENCHER</Text>
        <View style={[est.blocoCorpo, { paddingVertical: 14 }]}>
          <View style={est.linha}>
            <Campo rotulo="Frete (R$)" valor="_____________" largura="25%" />
            <Campo rotulo="Desconto (R$)" valor="_____________" largura="25%" />
            <Campo rotulo="Prazo de entrega" valor="_____________" largura="25%" />
            <Campo rotulo="Validade da proposta" valor="_____________" largura="25%" />
          </View>
          <View style={[est.linha, { marginTop: 6 }]}>
            <Campo rotulo="Condições de pagamento"
              valor="_________________________________________________" largura="100%" />
          </View>
        </View>
      </View>

      <View style={est.aviso}>
        <Text style={est.avisoTexto}>
          Favor devolver este documento preenchido{" "}
          {cotacao.prazoResposta ? `até ${data(cotacao.prazoResposta)}` : "o quanto antes"}.
          Informe marca e procedência de cada peça (original ou paralela) no campo de
          descrição. Itens indisponíveis podem ser deixados em branco.
        </Text>
      </View>

      <View style={est.assinaturas}>
        <View style={est.assinatura}>
          <View style={est.assinaturaEspaco} />
          <View style={est.assinaturaLinha}>
            <Text style={est.assinaturaRotulo}>Fornecedor — nome e assinatura</Text>
          </View>
        </View>
        <View style={est.assinatura}>
          <View style={est.assinaturaEspaco} />
          <View style={est.assinaturaLinha}>
            <Text style={est.assinaturaRotulo}>Data</Text>
          </View>
        </View>
      </View>

      <View style={est.rodape} fixed>
        <Text style={est.rodapeTexto}>
          {empresa.nome} · {empresa.telefone} · {empresa.instagram}
        </Text>
        <Text style={est.rodapeTexto}>
          Pedido de cotação {numeroDoc(cotacao.numero)}
        </Text>
      </View>
    </Page>
  );
}

export function DocumentoCotacao({
  dados, empresa, tipo,
}: {
  dados: DadosCotacaoPdf;
  empresa: DadosEmpresa;
  tipo: "mapa" | "pedido";
}) {
  const rotulo = tipo === "mapa" ? "Mapa comparativo" : "Pedido de cotação";
  return (
    <Document
      title={`${rotulo} ${numeroDoc(dados.cotacao.numero)}`}
      author={empresa.nome}
      subject={dados.cotacao.descricao}
    >
      {tipo === "mapa"
        ? <MapaComparativo d={dados} empresa={empresa} />
        : <PedidoCotacao d={dados} empresa={empresa} />}
    </Document>
  );
}
