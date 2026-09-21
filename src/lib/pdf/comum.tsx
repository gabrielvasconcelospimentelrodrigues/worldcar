import { StyleSheet } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { EMPRESA } from "@/lib/empresa-info";

/** Cabecalho dos documentos: usa a tabela `empresa` e cai para as constantes. */
export type DadosEmpresa = {
  nome: string;
  cnpj: string | null;
  telefone: string;
  endereco: string;
  cidadeUf: string;
  instagram: string;
  observacoesOrcamento: string | null;
};

export async function dadosEmpresa(): Promise<DadosEmpresa> {
  const padrao: DadosEmpresa = {
    nome: EMPRESA.nome,
    cnpj: null,
    telefone: EMPRESA.telefone,
    endereco: `${EMPRESA.endereco} — ${EMPRESA.bairro}`,
    cidadeUf: `${EMPRESA.cidade}/${EMPRESA.uf} · CEP ${EMPRESA.cep}`,
    instagram: EMPRESA.instagramHandle,
    observacoesOrcamento: null,
  };

  try {
    const e = await prisma.empresa.findUnique({ where: { id: "default" } });
    if (!e) return padrao;
    return {
      nome: e.nome || padrao.nome,
      cnpj: e.cnpj,
      telefone: e.whatsapp || e.telefone || padrao.telefone,
      endereco: e.endereco || padrao.endereco,
      cidadeUf:
        e.cidade && e.uf
          ? `${e.cidade}/${e.uf}${e.cep ? ` · CEP ${e.cep}` : ""}`
          : padrao.cidadeUf,
      instagram: e.instagram || padrao.instagram,
      observacoesOrcamento: e.observacoesOrcamento,
    };
  } catch {
    return padrao;
  }
}

export const VERMELHO = "#c81222";
export const PRETO = "#17171d";
export const CINZA = "#6e6e7a";
export const CINZA_CLARO = "#eeeef0";

/** Estilos compartilhados por todos os PDFs do sistema. */
export const est = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: PRETO,
  },

  // --- faixa da via ---
  faixaVia: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: PRETO,
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  faixaViaTexto: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },

  // --- cabecalho ---
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: VERMELHO,
    paddingBottom: 10,
    marginBottom: 12,
  },
  marca: { flexDirection: "row", alignItems: "center" },
  marcaCaixa: {
    width: 30,
    height: 30,
    backgroundColor: VERMELHO,
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 5,
    marginRight: 8,
  },
  marcaNome: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: -0.3 },
  marcaSub: { fontSize: 6.5, color: CINZA, letterSpacing: 2, marginTop: 1 },
  empresaInfo: { textAlign: "right", fontSize: 7.5, color: CINZA, lineHeight: 1.5 },

  // --- titulo do documento ---
  tituloDoc: { alignItems: "flex-end", marginBottom: 12 },
  tituloTexto: { fontSize: 17, fontFamily: "Helvetica-Bold", letterSpacing: -0.4 },
  numeroDoc: { fontSize: 11, color: VERMELHO, fontFamily: "Helvetica-Bold" },

  // --- blocos ---
  bloco: { marginBottom: 10 },
  blocoTitulo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: "#ffffff",
    backgroundColor: PRETO,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  blocoCorpo: {
    borderWidth: 0.5,
    borderColor: "#c9c9cf",
    borderTopWidth: 0,
    padding: 7,
  },

  linha: { flexDirection: "row", flexWrap: "wrap" },
  campo: { marginBottom: 3, paddingRight: 8 },
  campoRotulo: { fontSize: 6.5, color: CINZA, letterSpacing: 0.5, marginBottom: 1 },
  campoValor: { fontSize: 9 },
  campoValorForte: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  // --- tabela ---
  tabelaCabecalho: {
    flexDirection: "row",
    backgroundColor: PRETO,
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  tr: {
    flexDirection: "row",
    paddingVertical: 4.5,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dcdce1",
  },
  trZebra: { backgroundColor: "#fafafb" },
  td: { fontSize: 8.5 },
  tdPeq: { fontSize: 7, color: CINZA },

  // --- totais ---
  totais: { marginTop: 8, alignItems: "flex-end" },
  totalLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 190,
    paddingVertical: 2,
  },
  totalRotulo: { fontSize: 8.5, color: CINZA },
  totalValor: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  totalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 190,
    backgroundColor: VERMELHO,
    color: "#ffffff",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 3,
  },
  totalFinalRotulo: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  totalFinalValor: { fontSize: 12, fontFamily: "Helvetica-Bold" },

  // --- assinaturas ---
  // O bloco reserva uma faixa acima da linha para a assinatura feita na tela;
  // sem ela a faixa fica em branco e a pessoa assina a via impressa.
  assinaturas: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  assinatura: { width: "46%" },
  assinaturaEspaco: { height: 36, justifyContent: "flex-end" },
  assinaturaImagem: { height: 34, objectFit: "contain" },
  assinaturaLinha: { borderTopWidth: 0.8, borderTopColor: PRETO, paddingTop: 4 },
  assinaturaRotulo: { fontSize: 7, color: CINZA, textAlign: "center" },

  // --- rodape ---
  rodape: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    borderTopWidth: 0.5,
    borderTopColor: "#dcdce1",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rodapeTexto: { fontSize: 6.5, color: CINZA },

  aviso: {
    borderLeftWidth: 2.5,
    borderLeftColor: VERMELHO,
    backgroundColor: "#fdf3f4",
    padding: 6,
    marginTop: 8,
  },
  avisoTexto: { fontSize: 7.5, lineHeight: 1.5 },
});

/** As três vias impressas de cada documento. */
export const VIAS = [
  { chave: "LOJA", rotulo: "VIA DA LOJA — ARQUIVO INTERNO" },
  { chave: "PRODUCAO", rotulo: "VIA DA PRODUÇÃO — EQUIPE TÉCNICA" },
  { chave: "CLIENTE", rotulo: "VIA DO CLIENTE" },
] as const;

export type Via = (typeof VIAS)[number];
