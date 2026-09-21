/**
 * Dados institucionais da World Car Service.
 * Usados na landing page e como valores iniciais da tabela `empresa`
 * (que alimenta o cabecalho dos PDFs e pode ser editada em /sistema/configuracoes).
 */
export const EMPRESA = {
  nome: "World Car Service",
  slogan: "O mundo dos serviços para o seu veículo",
  descricaoCurta:
    "Estética automotiva, funilaria e revitalização em Curitiba. Mais de 16 anos de experiência cuidando do seu carro.",
  telefone: "(41) 98744-4929",
  whatsapp: "5541987444929",
  email: "contato@worldcarservice.com.br",
  endereco: "Rua Renato Polatti, 2701",
  bairro: "Campo Comprido",
  cidade: "Curitiba",
  uf: "PR",
  cep: "81230-170",
  instagram: "https://www.instagram.com/world.carservice/",
  instagramHandle: "@world.carservice",
  mapa: "https://www.google.com/maps/search/?api=1&query=Rua+Renato+Polatti+2701+Campo+Comprido+Curitiba+PR",
  horarios: [
    { dia: "Segunda a sexta", hora: "08h — 18h" },
    { dia: "Sábado", hora: "08h — 13h" },
    { dia: "Domingo", hora: "Fechado" },
  ],
} as const;

export function enderecoCompleto() {
  return `${EMPRESA.endereco} — ${EMPRESA.bairro}, ${EMPRESA.cidade}/${EMPRESA.uf} · CEP ${EMPRESA.cep}`;
}

export function whatsappLink(mensagem: string) {
  return `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

/** Vitrine de serviços da landing page. */
export const SERVICOS_VITRINE = [
  {
    slug: "estetica",
    titulo: "Estética Automotiva",
    resumo:
      "Lavagem detalhada, higienização interna, polimento e descontaminação da pintura com produtos da linha Soft99.",
    itens: ["Lavagem técnica", "Higienização interna", "Polimento técnico", "Hidratação de couro"],
  },
  {
    slug: "vitrificacao",
    titulo: "Vitrificação & Proteção",
    resumo:
      "Camada cerâmica que protege a pintura, intensifica o brilho e facilita a limpeza por meses.",
    itens: ["Vitrificação de pintura", "Cristalização", "Hidrofugante de vidros", "Selante de rodas"],
  },
  {
    slug: "pelicula",
    titulo: "Insulfilm & Nano Cerâmica",
    resumo:
      "Películas de segurança e nano cerâmicas que bloqueiam calor e raios UV, dentro da lei.",
    itens: ["Película de controle solar", "Nano cerâmica", "Película de segurança", "Faixa de parabrisa"],
  },
  {
    slug: "funilaria",
    titulo: "Funilaria & Pintura",
    resumo:
      "Reparo de amassados, troca de peças e pintura com preparação de superfície e acabamento de fábrica.",
    itens: ["Reparo de amassados", "Pintura de peças", "Polimento pós-pintura", "Troca de peças"],
  },
  {
    slug: "revitalizacao",
    titulo: "Revitalização de Faróis",
    resumo:
      "Remoção do amarelado e da opacidade, com proteção UV para o farol voltar a iluminar de verdade.",
    itens: ["Polimento de farol", "Proteção UV", "Revitalização de plásticos", "Restauração de lanternas"],
  },
  {
    slug: "lavagem",
    titulo: "Lava a Jato",
    resumo:
      "Lavagem completa externa e interna, com opções simples, detalhada e de motor.",
    itens: ["Lavagem simples", "Lavagem completa", "Lavagem de motor", "Lavagem a seco"],
  },
] as const;

export const DIFERENCIAIS = [
  {
    titulo: "16+ anos de experiência",
    texto: "A oficina nasceu de um sonho e de mais de 16 anos de estrada no setor automotivo.",
  },
  {
    titulo: "Orçamento formal por escrito",
    texto: "Você recebe o orçamento em PDF, com prazo, garantia e validade — nada de valor combinado no boca a boca.",
  },
  {
    titulo: "Vistoria de entrada e saída",
    texto: "Fotografamos e registramos o estado do veículo na chegada e na entrega. Transparência dos dois lados.",
  },
  {
    titulo: "Acompanhamento pós-serviço",
    texto: "Serviço com garantia tem retorno agendado. A gente liga para conferir se ficou tudo certo.",
  },
] as const;
