import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import logoSelo from "@/assets/logo-pdf.png";
import { brl, dataHora, documento, numeroDoc, telefone } from "@/lib/format";
import { VIAS, est, type DadosEmpresa, type Via } from "./comum";

export type OrdemPdf = {
  numero: number;
  status: string;
  dataEntrada: Date;
  dataSaida: Date | null;
  funcionarioEntrada: string;
  funcionarioSaida: string | null;
  kmEntrada: number | null;
  kmSaida: number | null;
  combustivelEntrada: string | null;
  observacoesEntrada: string | null;
  observacoesSaida: string | null;
  clienteRetirou: string | null;
  documentoRetirada: string | null;
  /** dataURL PNG assinado na tela na hora da entrega. */
  assinaturaEntrega: string | null;
  previsaoEntrega: Date | null;
  cliente: {
    nome: string;
    documento: string | null;
    telefone: string;
    endereco: string | null;
  };
  veiculo: {
    placa: string;
    marca: string;
    modelo: string;
    ano: number | null;
    cor: string | null;
  };
  itens: {
    descricao: string;
    quantidade: number;
    precoUnit: number;
    total: number;
    status: string;
    responsavel: string | null;
    garantiaDias: number;
  }[];
  subtotal: number;
  desconto: number;
  total: number;
  observacoes: string | null;
};

const ROTULO_STATUS: Record<string, string> = {
  PENDENTE: "Pendente",
  EXECUTANDO: "Executando",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
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

function ViaOrdem({
  os,
  empresa,
  via,
}: {
  os: OrdemPdf;
  empresa: DadosEmpresa;
  via: Via;
}) {
  const mostraValores = via.chave !== "PRODUCAO";
  const veiculo = `${os.veiculo.marca} ${os.veiculo.modelo}${
    os.veiculo.ano ? ` ${os.veiculo.ano}` : ""
  }`;

  return (
    <Page size="A4" style={est.pagina}>
      <View style={est.faixaVia}>
        <Text style={est.faixaViaTexto}>{via.rotulo}</Text>
        <Text style={est.faixaViaTexto}>OS Nº {numeroDoc(os.numero)}</Text>
      </View>

      <Cabecalho empresa={empresa} />

      <View style={est.tituloDoc}>
        <Text style={est.tituloTexto}>ORDEM DE SERVIÇO</Text>
        <Text style={est.numeroDoc}>Nº {numeroDoc(os.numero)}</Text>
      </View>

      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>CLIENTE E VEÍCULO</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Cliente" valor={os.cliente.nome} largura="42%" forte />
            <Campo
              rotulo="CPF / CNPJ"
              valor={os.cliente.documento ? documento(os.cliente.documento) : "—"}
              largura="29%"
            />
            <Campo
              rotulo="Telefone"
              valor={telefone(os.cliente.telefone)}
              largura="29%"
            />
          </View>
          <View style={est.linha}>
            <Campo rotulo="Placa" valor={os.veiculo.placa} largura="18%" forte />
            <Campo rotulo="Marca / Modelo" valor={veiculo} largura="42%" />
            <Campo rotulo="Cor" valor={os.veiculo.cor ?? "—"} largura="20%" />
            <Campo
              rotulo="Previsão"
              valor={os.previsaoEntrega ? dataHora(os.previsaoEntrega) : "A combinar"}
              largura="20%"
            />
          </View>
        </View>
      </View>

      {/* Entrada / Saida: o coracao do controle */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>ENTRADA E SAÍDA DO VEÍCULO</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Entrada em" valor={dataHora(os.dataEntrada)} largura="25%" />
            <Campo
              rotulo="Recebido por"
              valor={os.funcionarioEntrada}
              largura="25%"
              forte
            />
            <Campo
              rotulo="KM entrada"
              valor={os.kmEntrada ? os.kmEntrada.toLocaleString("pt-BR") : "—"}
              largura="25%"
            />
            <Campo
              rotulo="Combustível"
              valor={os.combustivelEntrada ?? "—"}
              largura="25%"
            />
          </View>
          <View style={est.linha}>
            <Campo
              rotulo="Saída em"
              valor={os.dataSaida ? dataHora(os.dataSaida) : "— em andamento —"}
              largura="25%"
            />
            <Campo
              rotulo="Entregue por"
              valor={os.funcionarioSaida ?? "—"}
              largura="25%"
              forte
            />
            <Campo
              rotulo="KM saída"
              valor={os.kmSaida ? os.kmSaida.toLocaleString("pt-BR") : "—"}
              largura="25%"
            />
            <Campo
              rotulo="Retirado por"
              valor={
                os.clienteRetirou
                  ? `${os.clienteRetirou}${os.documentoRetirada ? ` (${os.documentoRetirada})` : ""}`
                  : "—"
              }
              largura="25%"
            />
          </View>
          {os.observacoesEntrada ? (
            <View style={{ marginTop: 2 }}>
              <Text style={est.campoRotulo}>OBSERVAÇÕES DA ENTRADA</Text>
              <Text style={est.campoValor}>{os.observacoesEntrada}</Text>
            </View>
          ) : null}
          {os.observacoesSaida ? (
            <View style={{ marginTop: 2 }}>
              <Text style={est.campoRotulo}>OBSERVAÇÕES DA SAÍDA</Text>
              <Text style={est.campoValor}>{os.observacoesSaida}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Itens */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>SERVIÇOS EXECUTADOS</Text>
        <View style={est.tabelaCabecalho}>
          <Text style={[est.th, { width: "36%" }]}>DESCRIÇÃO</Text>
          <Text style={[est.th, { width: "22%" }]}>RESPONSÁVEL</Text>
          <Text style={[est.th, { width: "13%" }]}>SITUAÇÃO</Text>
          <Text style={[est.th, { width: "11%" }]}>GARANTIA</Text>
          {mostraValores ? (
            <>
              <Text style={[est.th, { width: "8%", textAlign: "center" }]}>QTD</Text>
              <Text style={[est.th, { width: "10%", textAlign: "right" }]}>TOTAL</Text>
            </>
          ) : (
            <Text style={[est.th, { width: "18%", textAlign: "center" }]}>QTD</Text>
          )}
        </View>

        {os.itens.map((i, idx) => (
          <View key={idx} style={[est.tr, ...(idx % 2 ? [est.trZebra] : [])]}>
            <Text style={[est.td, { width: "36%" }]}>{i.descricao}</Text>
            <Text style={[est.tdPeq, { width: "22%" }]}>{i.responsavel ?? "—"}</Text>
            <Text style={[est.tdPeq, { width: "13%" }]}>
              {ROTULO_STATUS[i.status] ?? i.status}
            </Text>
            <Text style={[est.tdPeq, { width: "11%" }]}>
              {i.garantiaDias > 0 ? `${i.garantiaDias} dias` : "—"}
            </Text>
            {mostraValores ? (
              <>
                <Text style={[est.td, { width: "8%", textAlign: "center" }]}>
                  {i.quantidade.toLocaleString("pt-BR")}
                </Text>
                <Text
                  style={[
                    est.td,
                    { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {brl(i.total)}
                </Text>
              </>
            ) : (
              <Text style={[est.td, { width: "18%", textAlign: "center" }]}>
                {i.quantidade.toLocaleString("pt-BR")}
              </Text>
            )}
          </View>
        ))}

        {mostraValores ? (
          <View style={est.totais}>
            <View style={est.totalLinha}>
              <Text style={est.totalRotulo}>Subtotal</Text>
              <Text style={est.totalValor}>{brl(os.subtotal)}</Text>
            </View>
            {os.desconto > 0 && (
              <View style={est.totalLinha}>
                <Text style={est.totalRotulo}>Desconto</Text>
                <Text style={est.totalValor}>− {brl(os.desconto)}</Text>
              </View>
            )}
            <View style={est.totalFinal}>
              <Text style={est.totalFinalRotulo}>TOTAL</Text>
              <Text style={est.totalFinalValor}>{brl(os.total)}</Text>
            </View>
          </View>
        ) : (
          <View style={est.aviso}>
            <Text style={est.avisoTexto}>
              Via da produção: valores omitidos. Ao concluir cada serviço, registre a
              baixa no sistema.
            </Text>
          </View>
        )}
      </View>

      {os.observacoes ? (
        <View style={est.aviso}>
          <Text style={est.avisoTexto}>{os.observacoes}</Text>
        </View>
      ) : null}

      {via.chave !== "PRODUCAO" && (
        <View style={est.assinaturas}>
          <View style={est.assinatura}>
            <View style={est.assinaturaEspaco} />
            <View style={est.assinaturaLinha}>
              <Text style={est.assinaturaRotulo}>
                {os.funcionarioSaida ?? empresa.nome} — responsável pela entrega
              </Text>
            </View>
          </View>
          <View style={est.assinatura}>
            <View style={est.assinaturaEspaco}>
              {os.assinaturaEntrega ? (
                <Image src={os.assinaturaEntrega} style={est.assinaturaImagem} />
              ) : null}
            </View>
            <View style={est.assinaturaLinha}>
              <Text style={est.assinaturaRotulo}>
                {os.clienteRetirou ?? os.cliente.nome} — recebi o veículo
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
          OS {numeroDoc(os.numero)} · {via.rotulo}
        </Text>
      </View>
    </Page>
  );
}

export function DocumentoOrdem({
  ordem,
  empresa,
}: {
  ordem: OrdemPdf;
  empresa: DadosEmpresa;
}) {
  return (
    <Document
      title={`OS ${numeroDoc(ordem.numero)} - ${ordem.cliente.nome}`}
      author={empresa.nome}
      subject={`Ordem de serviço — ${ordem.veiculo.placa}`}
    >
      {VIAS.map((via) => (
        <ViaOrdem key={via.chave} os={ordem} empresa={empresa} via={via} />
      ))}
    </Document>
  );
}
