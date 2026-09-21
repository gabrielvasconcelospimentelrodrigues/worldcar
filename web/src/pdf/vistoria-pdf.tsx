import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import logoSelo from "@/assets/logo-pdf.png";
import { dataHora, documento, numeroDoc, telefone } from "@/lib/format";
import { CHECKLIST_VISTORIA, type EstadoItemVistoria } from "@/lib/constantes";
import { CINZA, VERMELHO, VIAS, est, type DadosEmpresa, type Via } from "./comum";

export type VistoriaPdf = {
  tipo: "ENTRADA" | "SAIDA";
  data: Date;
  km: number | null;
  combustivel: string | null;
  vistoriador: string;
  pertences: string | null;
  observacoes: string | null;
  aprovadaCliente: boolean;
  /** dataURL PNG da assinatura feita na tela, se houver. */
  assinaturaCliente: string | null;
  /** Fotos ja convertidas em dataURL — ver fotosParaPdf em lib/storage. */
  fotos: { dataUrl: string; legenda: string | null }[];
  /** Quantas ficaram de fora do PDF por causa do teto de tamanho. */
  fotosOmitidas: number;
  checklist: Record<string, EstadoItemVistoria>;
  avarias: { local: string; descricao: string; gravidade: string }[];
  ordem: {
    numero: number;
    cliente: { nome: string; documento: string | null; telefone: string };
    veiculo: {
      placa: string;
      marca: string;
      modelo: string;
      ano: number | null;
      cor: string | null;
    };
  };
};

const SIGLA: Record<EstadoItemVistoria, string> = {
  OK: "OK",
  AVARIA: "AV",
  NA: "N/A",
};

function corEstado(e: EstadoItemVistoria | undefined) {
  if (e === "AVARIA") return VERMELHO;
  if (e === "OK") return "#0f7a4d";
  return CINZA;
}

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

function ViaVistoria({
  v,
  empresa,
  via,
}: {
  v: VistoriaPdf;
  empresa: DadosEmpresa;
  via: Via;
}) {
  const titulo = v.tipo === "ENTRADA" ? "VISTORIA DE ENTRADA" : "VISTORIA DE SAÍDA";
  const veiculo = `${v.ordem.veiculo.marca} ${v.ordem.veiculo.modelo}${
    v.ordem.veiculo.ano ? ` ${v.ordem.veiculo.ano}` : ""
  }`;

  return (
    <Page size="A4" style={est.pagina}>
      <View style={est.faixaVia}>
        <Text style={est.faixaViaTexto}>{via.rotulo}</Text>
        <Text style={est.faixaViaTexto}>OS Nº {numeroDoc(v.ordem.numero)}</Text>
      </View>

      <Cabecalho empresa={empresa} />

      <View style={est.tituloDoc}>
        <Text style={est.tituloTexto}>{titulo}</Text>
        <Text style={est.numeroDoc}>OS Nº {numeroDoc(v.ordem.numero)}</Text>
      </View>

      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>IDENTIFICAÇÃO</Text>
        <View style={est.blocoCorpo}>
          <View style={est.linha}>
            <Campo rotulo="Cliente" valor={v.ordem.cliente.nome} largura="38%" forte />
            <Campo
              rotulo="CPF / CNPJ"
              valor={
                v.ordem.cliente.documento ? documento(v.ordem.cliente.documento) : "—"
              }
              largura="26%"
            />
            <Campo
              rotulo="Telefone"
              valor={telefone(v.ordem.cliente.telefone)}
              largura="36%"
            />
          </View>
          <View style={est.linha}>
            <Campo rotulo="Placa" valor={v.ordem.veiculo.placa} largura="16%" forte />
            <Campo rotulo="Marca / Modelo" valor={veiculo} largura="30%" />
            <Campo rotulo="Cor" valor={v.ordem.veiculo.cor ?? "—"} largura="14%" />
            <Campo
              rotulo="KM"
              valor={v.km ? v.km.toLocaleString("pt-BR") : "—"}
              largura="14%"
            />
            <Campo rotulo="Combustível" valor={v.combustivel ?? "—"} largura="13%" />
            <Campo rotulo="Data" valor={dataHora(v.data)} largura="13%" />
          </View>
          <View style={est.linha}>
            <Campo rotulo="Vistoriador responsável" valor={v.vistoriador} largura="100%" forte />
          </View>
        </View>
      </View>

      {/* Checklist em colunas */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>CHECKLIST DO VEÍCULO</Text>
        <View style={est.blocoCorpo}>
          {CHECKLIST_VISTORIA.map((grupo) => (
            <View key={grupo.grupo} style={{ marginBottom: 5 }}>
              <Text
                style={{
                  fontSize: 7,
                  fontFamily: "Helvetica-Bold",
                  color: CINZA,
                  letterSpacing: 0.6,
                  marginBottom: 2,
                }}
              >
                {grupo.grupo.toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {grupo.itens.map((item) => {
                  const e = v.checklist[item];
                  return (
                    <View
                      key={item}
                      style={{
                        width: "33.33%",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingRight: 8,
                        paddingVertical: 1,
                      }}
                    >
                      <Text style={{ fontSize: 7.5 }}>{item}</Text>
                      <Text
                        style={{
                          fontSize: 7.5,
                          fontFamily: "Helvetica-Bold",
                          color: corEstado(e),
                        }}
                      >
                        {e ? SIGLA[e] : "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Avarias */}
      <View style={est.bloco}>
        <Text style={est.blocoTitulo}>AVARIAS REGISTRADAS</Text>
        {v.avarias.length === 0 ? (
          <View style={est.blocoCorpo}>
            <Text style={{ fontSize: 8.5 }}>
              Nenhuma avaria registrada nesta vistoria.
            </Text>
          </View>
        ) : (
          <>
            <View style={est.tabelaCabecalho}>
              <Text style={[est.th, { width: "28%" }]}>LOCAL</Text>
              <Text style={[est.th, { width: "56%" }]}>DESCRIÇÃO</Text>
              <Text style={[est.th, { width: "16%" }]}>GRAVIDADE</Text>
            </View>
            {v.avarias.map((a, i) => (
              <View key={i} style={[est.tr, ...(i % 2 ? [est.trZebra] : [])]}>
                <Text style={[est.td, { width: "28%" }]}>{a.local}</Text>
                <Text style={[est.td, { width: "56%" }]}>{a.descricao || "—"}</Text>
                <Text
                  style={[
                    est.td,
                    {
                      width: "16%",
                      fontFamily: "Helvetica-Bold",
                      color: a.gravidade === "Grave" ? VERMELHO : undefined,
                    },
                  ]}
                >
                  {a.gravidade}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      {(v.pertences || v.observacoes) && (
        <View style={est.bloco}>
          <Text style={est.blocoTitulo}>COMPLEMENTOS</Text>
          <View style={est.blocoCorpo}>
            {v.pertences ? (
              <View style={{ marginBottom: 3 }}>
                <Text style={est.campoRotulo}>PERTENCES DEIXADOS NO VEÍCULO</Text>
                <Text style={est.campoValor}>{v.pertences}</Text>
              </View>
            ) : null}
            {v.observacoes ? (
              <View>
                <Text style={est.campoRotulo}>OBSERVAÇÕES</Text>
                <Text style={[est.campoValor, { lineHeight: 1.5 }]}>{v.observacoes}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      <View style={est.aviso}>
        <Text style={est.avisoTexto}>
          Legenda: OK = conferido e em ordem · AV = avaria constatada · N/A = não se
          aplica. Este laudo registra o estado do veículo no momento da{" "}
          {v.tipo === "ENTRADA" ? "entrada" : "saída"} e é parte integrante da OS{" "}
          {numeroDoc(v.ordem.numero)}.
          {v.aprovadaCliente
            ? " O cliente conferiu e concordou com o conteúdo desta vistoria."
            : ""}
        </Text>
      </View>

      {/* Fotos: a prova visual do estado do veiculo */}
      {v.fotos.length > 0 && (
        <View style={est.bloco} break={v.fotos.length > 6}>
          <Text style={est.blocoTitulo}>
            REGISTRO FOTOGRÁFICO ({v.fotos.length}
            {v.fotosOmitidas > 0 ? ` DE ${v.fotos.length + v.fotosOmitidas}` : ""})
          </Text>
          <View style={[est.blocoCorpo, { flexDirection: "row", flexWrap: "wrap" }]}>
            {v.fotos.map((f, i) => (
              <View key={i} style={{ width: "33.33%", padding: 3 }}>
                <Image
                  src={f.dataUrl}
                  style={{
                    width: "100%",
                    height: 78,
                    objectFit: "cover",
                    borderWidth: 0.5,
                    borderColor: "#c9c9cf",
                  }}
                />
                <Text style={{ fontSize: 6, color: CINZA, marginTop: 1.5 }}>
                  {i + 1}. {f.legenda ?? "sem legenda"}
                </Text>
              </View>
            ))}
          </View>
          {v.fotosOmitidas > 0 ? (
            <Text style={{ fontSize: 6.5, color: CINZA, marginTop: 2 }}>
              Outras {v.fotosOmitidas} foto(s) desta vistoria ficaram fora do PDF por
              limite de tamanho e podem ser consultadas no sistema.
            </Text>
          ) : null}
        </View>
      )}

      <View style={est.assinaturas}>
        <View style={est.assinatura}>
          <View style={est.assinaturaEspaco} />
          <View style={est.assinaturaLinha}>
            <Text style={est.assinaturaRotulo}>{v.vistoriador} — vistoriador</Text>
          </View>
        </View>
        <View style={est.assinatura}>
          <View style={est.assinaturaEspaco}>
            {v.assinaturaCliente ? (
              <Image src={v.assinaturaCliente} style={est.assinaturaImagem} />
            ) : null}
          </View>
          <View style={est.assinaturaLinha}>
            <Text style={est.assinaturaRotulo}>
              {v.ordem.cliente.nome} — ciente do estado do veículo
            </Text>
          </View>
        </View>
      </View>

      <View style={est.rodape} fixed>
        <Text style={est.rodapeTexto}>
          {empresa.nome} · {empresa.telefone} · {empresa.instagram}
        </Text>
        <Text style={est.rodapeTexto}>
          {titulo} · OS {numeroDoc(v.ordem.numero)} · {via.rotulo}
        </Text>
      </View>
    </Page>
  );
}

export function DocumentoVistoria({
  vistoria,
  empresa,
}: {
  vistoria: VistoriaPdf;
  empresa: DadosEmpresa;
}) {
  return (
    <Document
      title={`Vistoria ${vistoria.tipo} - OS ${numeroDoc(vistoria.ordem.numero)}`}
      author={empresa.nome}
      subject={`Laudo de vistoria — ${vistoria.ordem.veiculo.placa}`}
    >
      {VIAS.map((via) => (
        <ViaVistoria key={via.chave} v={vistoria} empresa={empresa} via={via} />
      ))}
    </Document>
  );
}
