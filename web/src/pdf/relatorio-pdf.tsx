import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import logoSelo from "@/assets/logo-pdf.png";
import { brl, data } from "@/lib/format";
import { CINZA, CINZA_CLARO, PRETO, VERMELHO, est, type DadosEmpresa } from "./comum";

/**
 * Relatorio gerencial em PDF.
 *
 * Existe porque relatorio que so vive na tela nao vai para a reuniao com o
 * contador nem para a conversa com o socio. Cada numero vem com o periodo
 * anterior ao lado, pela mesma razao da tela: numero sozinho nao informa.
 */

export type Janela = {
  recebido: number; ordens: number; clientes: number; itens: number;
  ticket: number; orcamentos: number; convertidos: number; conversao: number;
};

export type DadosRelatorioPdf = {
  periodo: { inicio: string; fim: string; rotulo: string };
  comp: {
    atual: Janela; anterior: Janela;
    inicio: string; fim: string; inicio_anterior: string; fim_anterior: string;
  };
  evolucao: { mes: string; recebido: number; ordens: number; ticket: number; novos: number }[];
  clientes: { nome: string; visitas: number; ticket: number; gasto: number; dias_sem_vir: number }[];
  equipe: { nome: string; cargo: string; servicos: number; producao: number;
    comissao: number; conferidas: number; pct_retrabalho: number }[];
  servicos: { nome: string; vezes: number; faturamento: number }[];
};

const e = StyleSheet.create({
  secao: { marginTop: 12, marginBottom: 4 },
  secaoTitulo: {
    fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1,
    color: "#ffffff", backgroundColor: PRETO, paddingVertical: 3, paddingHorizontal: 6,
  },
  cartoes: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  cartao: {
    width: "25%", paddingHorizontal: 3, marginBottom: 6,
  },
  cartaoCorpo: { borderWidth: 0.5, borderColor: "#c9c9cf", padding: 6 },
  cartaoRotulo: { fontSize: 6.5, color: CINZA, letterSpacing: 0.5 },
  cartaoValor: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  cartaoVar: { fontSize: 7, marginTop: 2 },
  sobe: { color: "#047857" },
  desce: { color: VERMELHO },
  neutro: { color: CINZA },

  tabela: { borderWidth: 0.5, borderColor: "#c9c9cf", borderTopWidth: 0 },
  th: {
    flexDirection: "row", backgroundColor: CINZA_CLARO,
    paddingVertical: 3, paddingHorizontal: 5,
  },
  thTexto: { fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, color: CINZA },
  tr: {
    flexDirection: "row", paddingVertical: 3, paddingHorizontal: 5,
    borderTopWidth: 0.5, borderTopColor: "#e4e4e8",
  },
  td: { fontSize: 8 },
  tdForte: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  dir: { textAlign: "right" },
  centro: { textAlign: "center" },

  nota: { fontSize: 6.5, color: CINZA, marginTop: 4, lineHeight: 1.4 },
  rodape: {
    position: "absolute", bottom: 18, left: 32, right: 32,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 0.5, borderTopColor: "#c9c9cf", paddingTop: 4,
    fontSize: 6.5, color: CINZA,
  },
});

const dataCurta = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString("pt-BR");

function Variacao({ atual, anterior, inverso }: {
  atual: number; anterior: number; inverso?: boolean;
}) {
  const v = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
  // Mesmo criterio da tela: variacao acima de 500% indica periodo anterior sem
  // movimento comparavel, nao crescimento real.
  if (!anterior || Math.abs(v) >= 500) {
    return <Text style={[e.cartaoVar, e.neutro]}>sem base comparável</Text>;
  }
  const subiu = v > 0.05;
  const bom = inverso ? !subiu : subiu;
  return (
    <Text style={[e.cartaoVar, Math.abs(v) < 0.05 ? e.neutro : bom ? e.sobe : e.desce]}>
      {v > 0 ? "+" : ""}{v.toFixed(1)}% vs. anterior
    </Text>
  );
}

function Cartao({ rotulo, valor, atual, anterior }: {
  rotulo: string; valor: string; atual: number; anterior: number;
}) {
  return (
    <View style={e.cartao}>
      <View style={e.cartaoCorpo}>
        <Text style={e.cartaoRotulo}>{rotulo}</Text>
        <Text style={e.cartaoValor}>{valor}</Text>
        <Variacao atual={atual} anterior={anterior} />
      </View>
    </View>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <View style={e.secao}>
      <Text style={e.secaoTitulo}>{titulo}</Text>
    </View>
  );
}

export function DocumentoRelatorio({
  empresa, dados,
}: {
  empresa: DadosEmpresa;
  dados: DadosRelatorioPdf;
}) {
  const { comp, evolucao, clientes, equipe, servicos, periodo } = dados;
  const a = comp.atual;
  const b = comp.anterior;
  const emitido = new Date();

  return (
    <Document
      title={`Relatório ${periodo.rotulo} — ${empresa.nome}`}
      author={empresa.nome}
    >
      {/* `wrap` ligado: relatorio longo precisa fluir para a pagina seguinte.
          Com wrap={false} o conteudo que nao coubesse seria cortado em silencio. */}
      <Page size="A4" style={est.pagina} wrap>
        <View style={est.cabecalho}>
          <View style={est.marca}>
            <Image style={est.marcaSelo} src={logoSelo} />
          </View>
          <View style={est.empresaInfo}>
            {empresa.cnpj ? <Text>CNPJ {empresa.cnpj}</Text> : null}
            <Text>{empresa.endereco}</Text>
            <Text>{empresa.cidadeUf}</Text>
            <Text>{empresa.telefone}</Text>
          </View>
        </View>

        <View style={est.tituloDoc}>
          <Text style={est.tituloTexto}>RELATÓRIO GERENCIAL</Text>
          <Text style={est.numeroDoc}>
            {dataCurta(comp.inicio)} a {dataCurta(comp.fim)}
          </Text>
        </View>

        <Text style={e.nota}>
          Comparado com {dataCurta(comp.inicio_anterior)} a {dataCurta(comp.fim_anterior)},
          período de mesmo tamanho. Os valores consideram o que foi efetivamente
          recebido, não o que foi faturado.
        </Text>

        <Secao titulo="RESUMO DO PERÍODO" />
        <View style={e.cartoes}>
          <Cartao rotulo="RECEBIDO" valor={brl(a.recebido)}
            atual={Number(a.recebido)} anterior={Number(b.recebido)} />
          <Cartao rotulo="ORDENS ENTREGUES" valor={String(a.ordens)}
            atual={Number(a.ordens)} anterior={Number(b.ordens)} />
          <Cartao rotulo="TICKET MÉDIO" valor={brl(a.ticket)}
            atual={Number(a.ticket)} anterior={Number(b.ticket)} />
          <Cartao rotulo="CLIENTES ATENDIDOS" valor={String(a.clientes)}
            atual={Number(a.clientes)} anterior={Number(b.clientes)} />
          <Cartao rotulo="ORÇAMENTOS" valor={String(a.orcamentos)}
            atual={Number(a.orcamentos)} anterior={Number(b.orcamentos)} />
          <Cartao rotulo="CONVERSÃO" valor={`${a.conversao}%`}
            atual={Number(a.conversao)} anterior={Number(b.conversao)} />
          <Cartao rotulo="SERVIÇOS EXECUTADOS" valor={String(a.itens)}
            atual={Number(a.itens)} anterior={Number(b.itens)} />
        </View>

        {evolucao.length > 0 && (
          <>
            <Secao titulo="EVOLUÇÃO MÊS A MÊS" />
            <View style={e.tabela}>
              <View style={e.th}>
                <Text style={[e.thTexto, { width: "22%" }]}>MÊS</Text>
                <Text style={[e.thTexto, { width: "26%" }, e.dir]}>RECEBIDO</Text>
                <Text style={[e.thTexto, { width: "17%" }, e.centro]}>ORDENS</Text>
                <Text style={[e.thTexto, { width: "22%" }, e.dir]}>TICKET</Text>
                <Text style={[e.thTexto, { width: "13%" }, e.centro]}>NOVOS</Text>
              </View>
              {evolucao.map((m) => (
                <View key={m.mes} style={e.tr}>
                  <Text style={[e.td, { width: "22%" }]}>{m.mes}</Text>
                  <Text style={[e.tdForte, { width: "26%" }, e.dir]}>{brl(m.recebido)}</Text>
                  <Text style={[e.td, { width: "17%" }, e.centro]}>{m.ordens}</Text>
                  <Text style={[e.td, { width: "22%" }, e.dir]}>{brl(m.ticket)}</Text>
                  <Text style={[e.td, { width: "13%" }, e.centro]}>{m.novos}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {clientes.length > 0 && (
          <>
            <Secao titulo="MAIORES CLIENTES" />
            <View style={e.tabela}>
              <View style={e.th}>
                <Text style={[e.thTexto, { width: "6%" }]}>#</Text>
                <Text style={[e.thTexto, { width: "38%" }]}>CLIENTE</Text>
                <Text style={[e.thTexto, { width: "14%" }, e.centro]}>VISITAS</Text>
                <Text style={[e.thTexto, { width: "20%" }, e.dir]}>TICKET</Text>
                <Text style={[e.thTexto, { width: "22%" }, e.dir]}>TOTAL PAGO</Text>
              </View>
              {clientes.slice(0, 15).map((c, i) => (
                <View key={c.nome + i} style={e.tr}>
                  <Text style={[e.td, { width: "6%" }]}>{i + 1}</Text>
                  <Text style={[e.td, { width: "38%" }]}>
                    {c.nome}
                    {Number(c.dias_sem_vir) > 90 ? ` (${c.dias_sem_vir}d sem vir)` : ""}
                  </Text>
                  <Text style={[e.td, { width: "14%" }, e.centro]}>{c.visitas}</Text>
                  <Text style={[e.td, { width: "20%" }, e.dir]}>{brl(c.ticket)}</Text>
                  <Text style={[e.tdForte, { width: "22%" }, e.dir]}>{brl(c.gasto)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {equipe.length > 0 && (
          <>
            <Secao titulo="PRODUÇÃO DA EQUIPE" />
            <View style={e.tabela}>
              <View style={e.th}>
                <Text style={[e.thTexto, { width: "32%" }]}>FUNCIONÁRIO</Text>
                <Text style={[e.thTexto, { width: "20%" }]}>CARGO</Text>
                <Text style={[e.thTexto, { width: "12%" }, e.centro]}>SERVIÇOS</Text>
                <Text style={[e.thTexto, { width: "20%" }, e.dir]}>PRODUÇÃO</Text>
                <Text style={[e.thTexto, { width: "16%" }, e.centro]}>RETRABALHO</Text>
              </View>
              {equipe.map((f) => (
                <View key={f.nome} style={e.tr}>
                  <Text style={[e.td, { width: "32%" }]}>{f.nome}</Text>
                  <Text style={[e.td, { width: "20%" }]}>{f.cargo}</Text>
                  <Text style={[e.td, { width: "12%" }, e.centro]}>{f.servicos}</Text>
                  <Text style={[e.tdForte, { width: "20%" }, e.dir]}>{brl(f.producao)}</Text>
                  <Text style={[e.td, { width: "16%" }, e.centro]}>
                    {f.conferidas > 0 ? `${f.pct_retrabalho}%` : "—"}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={e.nota}>
              Retrabalho é a proporção de serviços reprovados na conferência de limpeza
              e devolvidos para refazer. "—" indica funcionário que não executa serviço
              sujeito a essa conferência.
            </Text>
          </>
        )}

        {servicos.length > 0 && (
          <>
            <Secao titulo="SERVIÇOS MAIS VENDIDOS" />
            <View style={e.tabela}>
              <View style={e.th}>
                <Text style={[e.thTexto, { width: "58%" }]}>SERVIÇO</Text>
                <Text style={[e.thTexto, { width: "17%" }, e.centro]}>VEZES</Text>
                <Text style={[e.thTexto, { width: "25%" }, e.dir]}>FATURAMENTO</Text>
              </View>
              {servicos.slice(0, 12).map((s) => (
                <View key={s.nome} style={e.tr}>
                  <Text style={[e.td, { width: "58%" }]}>{s.nome}</Text>
                  <Text style={[e.td, { width: "17%" }, e.centro]}>{s.vezes}</Text>
                  <Text style={[e.tdForte, { width: "25%" }, e.dir]}>{brl(s.faturamento)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={e.rodape} fixed>
          <Text>{empresa.nome} · relatório gerencial de uso interno</Text>
          <Text render={({ pageNumber, totalPages }) =>
            `Emitido em ${data(emitido)} · página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
