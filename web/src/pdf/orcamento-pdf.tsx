import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import logoSelo from "@/assets/logo-pdf.png";
import { brl, data, documento, numeroDoc, telefone } from "@/lib/format";
import { CINZA, VIAS, est, type DadosEmpresa, type Via } from "./comum";

export type ItemPdf = {
  descricao: string;
  quantidade: number;
  precoUnit: number;
  desconto: number;
  total: number;
  garantiaDias: number;
};

export type OrcamentoPdf = {
  numero: number;
  criadoEm: Date;
  validoAte: Date;
  status: string;
  cliente: {
    nome: string;
    documento: string | null;
    telefone: string;
    email: string | null;
    endereco: string | null;
  };
  veiculo: {
    placa: string;
    marca: string;
    modelo: string;
    ano: number | null;
    cor: string | null;
  };
  kmVeiculo: number | null;
  vendedor: string | null;
  itens: ItemPdf[];
  subtotal: number;
  desconto: number;
  total: number;
  prazoEntregaDias: number | null;
  formaPagamento: string | null;
  observacoes: string | null;
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
        <Text>
          {empresa.telefone} · {empresa.instagram}
        </Text>
      </View>
    </View>
  );
}

function Campo({
  rotulo,
  valor,
  largura,
  forte,
}: {
  rotulo: string;
  valor: string;
  largura: string;
  forte?: boolean;
}) {
  return (
    <View style={[est.campo, { width: largura }]}>
      <Text style={est.campoRotulo}>{rotulo.toUpperCase()}</Text>
      <Text style={forte ? est.campoValorForte : est.campoValor}>{valor || "—"}</Text>
    </View>
  );
}

/** Larguras das colunas da tabela de itens (soma = 100%). */
const COL = { desc: "46%", gar: "14%", qtd: "8%", unit: "13%", desc2: "9%", tot: "10%" };

function ViaOrcamento({
  orc,
  empresa,
  via,
}: {
  orc: OrcamentoPdf;
  empresa: DadosEmpresa;
  via: Via;
}) {
  const veiculo = `${orc.veiculo.marca} ${orc.veiculo.modelo}${
    orc.veiculo.ano ? ` ${orc.veiculo.ano}` : ""
  }`;
  const mostraValores = via.chave !== "PRODUCAO";

  return (
    <Page size="A4" style={est.pagina}>
      <View style={est.faixaVia}>
        <Text style={est.faixaViaTexto}>{via.rotulo}</Text>
        <Text style={est.faixaViaTexto}>
          ORÇAMENTO Nº {numeroDoc(orc.numero)}
        </Text>
      </View>

      <Cabecalho empresa={empresa} />

      <View style={est.tituloDoc}>
        <Text style={est.tituloTexto}>ORÇAMENTO DE SERVIÇOS</Text>
        <Text style={est.numeroDoc}>Nº {numeroDoc(orc.numero)}</Text>
        <Text style={{ fontSize: 7.5, color: CINZA, marginTop: 2 }}>
          Emitido em {data(orc.criadoEm)} · Válido até {data(orc.validoAte)}
        </Text>
      </View>

      {/* Cliente */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>CLIENTE</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Nome" valor={orc.cliente.nome} largura="46%" forte />
            <Campo
              rotulo="CPF / CNPJ"
              valor={orc.cliente.documento ? documento(orc.cliente.documento) : "—"}
              largura="27%"
            />
            <Campo
              rotulo="Telefone"
              valor={telefone(orc.cliente.telefone)}
              largura="27%"
            />
          </View>
          <View style={est.linha}>
            <Campo rotulo="E-mail" valor={orc.cliente.email ?? "—"} largura="46%" />
            <Campo rotulo="Endereço" valor={orc.cliente.endereco ?? "—"} largura="54%" />
          </View>
        </View>
      </View>

      {/* Veiculo */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>VEÍCULO</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Placa" valor={orc.veiculo.placa} largura="18%" forte />
            <Campo rotulo="Marca / Modelo" valor={veiculo} largura="40%" />
            <Campo rotulo="Cor" valor={orc.veiculo.cor ?? "—"} largura="20%" />
            <Campo
              rotulo="KM"
              valor={orc.kmVeiculo ? orc.kmVeiculo.toLocaleString("pt-BR") : "—"}
              largura="22%"
            />
          </View>
        </View>
      </View>

      {/* Itens */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>SERVIÇOS ORÇADOS</Text>
        <View style={est.tabelaCabecalho}>
          <Text style={[est.th, { width: COL.desc }]}>DESCRIÇÃO</Text>
          <Text style={[est.th, { width: COL.gar }]}>GARANTIA</Text>
          <Text style={[est.th, { width: COL.qtd, textAlign: "center" }]}>QTD</Text>
          {mostraValores && (
            <>
              <Text style={[est.th, { width: COL.unit, textAlign: "right" }]}>
                VALOR UN.
              </Text>
              <Text style={[est.th, { width: COL.desc2, textAlign: "right" }]}>DESC.</Text>
              <Text style={[est.th, { width: COL.tot, textAlign: "right" }]}>TOTAL</Text>
            </>
          )}
        </View>

        {orc.itens.map((i, idx) => (
          <View key={idx} style={[est.tr, ...(idx % 2 ? [est.trZebra] : [])]}>
            <Text style={[est.td, { width: COL.desc }]}>{i.descricao}</Text>
            <Text style={[est.tdPeq, { width: COL.gar }]}>
              {i.garantiaDias > 0 ? `${i.garantiaDias} dias` : "—"}
            </Text>
            <Text style={[est.td, { width: COL.qtd, textAlign: "center" }]}>
              {i.quantidade.toLocaleString("pt-BR")}
            </Text>
            {mostraValores && (
              <>
                <Text style={[est.td, { width: COL.unit, textAlign: "right" }]}>
                  {brl(i.precoUnit)}
                </Text>
                <Text style={[est.td, { width: COL.desc2, textAlign: "right" }]}>
                  {i.desconto > 0 ? `−${brl(i.desconto)}` : "—"}
                </Text>
                <Text
                  style={[
                    est.td,
                    { width: COL.tot, textAlign: "right", fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {brl(i.total)}
                </Text>
              </>
            )}
          </View>
        ))}

        {mostraValores ? (
          <View style={est.totais}>
            <View style={est.totalLinha}>
              <Text style={est.totalRotulo}>Subtotal</Text>
              <Text style={est.totalValor}>{brl(orc.subtotal)}</Text>
            </View>
            {orc.desconto > 0 && (
              <View style={est.totalLinha}>
                <Text style={est.totalRotulo}>Desconto</Text>
                <Text style={est.totalValor}>− {brl(orc.subtotal - orc.total)}</Text>
              </View>
            )}
            <View style={est.totalFinal}>
              <Text style={est.totalFinalRotulo}>TOTAL</Text>
              <Text style={est.totalFinalValor}>{brl(orc.total)}</Text>
            </View>
          </View>
        ) : (
          <View style={est.aviso}>
            <Text style={est.avisoTexto}>
              Via da produção: valores omitidos de propósito. Execute os serviços
              conforme a descrição e as quantidades acima.
            </Text>
          </View>
        )}
      </View>

      {/* Condicoes */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>CONDIÇÕES</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo
              rotulo="Prazo de execução"
              valor={
                orc.prazoEntregaDias ? `${orc.prazoEntregaDias} dia(s) útil(eis)` : "A combinar"
              }
              largura="33%"
            />
            {mostraValores && (
              <Campo
                rotulo="Forma de pagamento"
                valor={orc.formaPagamento ?? "A combinar"}
                largura="34%"
              />
            )}
            <Campo rotulo="Atendido por" valor={orc.vendedor ?? "—"} largura="33%" />
          </View>
          {orc.observacoes ? (
            <View style={{ marginTop: 3 }}>
              <Text style={est.campoRotulo}>OBSERVAÇÕES</Text>
              <Text style={[est.campoValor, { lineHeight: 1.5 }]}>{orc.observacoes}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={est.aviso}>
        <Text style={est.avisoTexto}>
          Este orçamento é válido até {data(orc.validoAte)} e não inclui serviços ou
          peças não descritos acima. Serviços adicionais identificados durante a execução
          serão comunicados e dependem de aprovação do cliente.
          {empresa.observacoesOrcamento ? ` ${empresa.observacoesOrcamento}` : ""}
        </Text>
      </View>

      {via.chave !== "PRODUCAO" && (
        <View style={est.assinaturas}>
          <View style={est.assinatura}>
            <View style={est.assinaturaEspaco} />
            <View style={est.assinaturaLinha}>
              <Text style={est.assinaturaRotulo}>{empresa.nome}</Text>
            </View>
          </View>
          <View style={est.assinatura}>
            <View style={est.assinaturaEspaco} />
            <View style={est.assinaturaLinha}>
              <Text style={est.assinaturaRotulo}>
                {orc.cliente.nome} — aprovação do cliente
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={est.rodape} fixed>
        <Text style={est.rodapeTexto}>
          {empresa.nome} · {empresa.telefone} · {empresa.instagram}
        </Text>
        <Text style={est.rodapeTexto}>
          Orçamento {numeroDoc(orc.numero)} · {via.rotulo}
        </Text>
      </View>
    </Page>
  );
}

/** Documento completo: uma página por via (loja, produção e cliente). */
export function DocumentoOrcamento({
  orcamento,
  empresa,
}: {
  orcamento: OrcamentoPdf;
  empresa: DadosEmpresa;
}) {
  return (
    <Document
      title={`Orcamento ${numeroDoc(orcamento.numero)} - ${orcamento.cliente.nome}`}
      author={empresa.nome}
      subject={`Orçamento de serviços — ${orcamento.veiculo.placa}`}
    >
      {VIAS.map((via) => (
        <ViaOrcamento key={via.chave} orc={orcamento} empresa={empresa} via={via} />
      ))}
    </Document>
  );
}
