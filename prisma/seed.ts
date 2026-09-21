/**
 * Popula o banco com o catálogo de serviços da World Car Service,
 * categorias financeiras, os dados da empresa e um usuário administrador.
 *
 *   npm run db:seed
 *
 * É idempotente: pode rodar quantas vezes quiser sem duplicar nada.
 */
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

// Rodando por `tsx`, fora do Next, nada carrega o .env automaticamente.
// .env.local tem prioridade; em producao as variaveis ja vem do ambiente.
for (const arquivo of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), arquivo));
  } catch {
    // arquivo ausente: segue com o que ja estiver no ambiente
  }
}

const prisma = new PrismaClient();

const dec = (v: number) => new Prisma.Decimal(v.toFixed(2));

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL ?? "admin@worldcarservice.com.br";
// Sem valor padrao de proposito. Uma senha escrita aqui viraria a senha de
// producao de todo mundo que rodasse o seed sem ler o codigo — e este
// repositorio e publico.
const SENHA_ADMIN = process.env.SEED_ADMIN_SENHA;
if (!SENHA_ADMIN) {
  throw new Error("Defina SEED_ADMIN_SENHA no .env.local antes de rodar o seed.");
}

const SERVICOS = [
  // --- Lavagem ---
  { codigo: "LAV-01", nome: "Lavagem simples", categoria: "LAVAGEM", preco: 60, duracaoMin: 40, garantiaDias: 0, comissaoPct: 10, descricao: "Lavagem externa com shampoo neutro, secagem e pretinho nos pneus." },
  { codigo: "LAV-02", nome: "Lavagem completa", categoria: "LAVAGEM", preco: 110, duracaoMin: 90, garantiaDias: 0, comissaoPct: 10, descricao: "Lavagem externa e interna, aspiração, painel e vidros." },
  { codigo: "LAV-03", nome: "Lavagem de motor", categoria: "LAVAGEM", preco: 90, duracaoMin: 60, garantiaDias: 0, comissaoPct: 10, descricao: "Desengraxe e limpeza do cofre do motor com proteção dos componentes elétricos." },
  { codigo: "LAV-04", nome: "Lavagem a seco", categoria: "LAVAGEM", preco: 80, duracaoMin: 50, garantiaDias: 0, comissaoPct: 10, descricao: "Limpeza sem uso de água, ideal para manutenção entre lavagens." },

  // --- Estética ---
  { codigo: "EST-01", nome: "Higienização interna completa", categoria: "ESTETICA", preco: 450, duracaoMin: 300, garantiaDias: 30, comissaoPct: 12, descricao: "Extração de bancos, carpetes, forro e teto com produtos específicos." },
  { codigo: "EST-02", nome: "Polimento técnico", categoria: "ESTETICA", preco: 700, duracaoMin: 420, garantiaDias: 90, comissaoPct: 12, descricao: "Correção de riscos e marcas de lavagem com politriz e refino da pintura." },
  { codigo: "EST-03", nome: "Polimento comercial", categoria: "ESTETICA", preco: 380, duracaoMin: 180, garantiaDias: 30, comissaoPct: 12, descricao: "Realce de brilho e remoção de riscos superficiais." },
  { codigo: "EST-04", nome: "Descontaminação de pintura", categoria: "ESTETICA", preco: 250, duracaoMin: 120, garantiaDias: 30, comissaoPct: 12, descricao: "Remoção de contaminantes ferrosos e clay bar." },
  { codigo: "EST-05", nome: "Hidratação de couro", categoria: "ESTETICA", preco: 280, duracaoMin: 120, garantiaDias: 60, comissaoPct: 12, descricao: "Limpeza e nutrição dos bancos e revestimentos de couro." },

  // --- Vitrificação / proteção ---
  { codigo: "VIT-01", nome: "Vitrificação de pintura", categoria: "VITRIFICACAO", preco: 1600, duracaoMin: 600, garantiaDias: 365, comissaoPct: 15, descricao: "Aplicação de coating cerâmico com preparação e polimento prévios. Inclui revisão de 30 dias." },
  { codigo: "VIT-02", nome: "Cristalização de pintura", categoria: "VITRIFICACAO", preco: 480, duracaoMin: 240, garantiaDias: 90, comissaoPct: 12, descricao: "Camada de proteção com brilho intenso e efeito hidrofóbico." },
  { codigo: "VIT-03", nome: "Hidrofugante de vidros", categoria: "VITRIFICACAO", preco: 220, duracaoMin: 90, garantiaDias: 180, comissaoPct: 12, descricao: "Repelente de água nos vidros, melhora a visibilidade na chuva." },
  { codigo: "VIT-04", nome: "Selante de rodas", categoria: "VITRIFICACAO", preco: 260, duracaoMin: 120, garantiaDias: 120, comissaoPct: 12, descricao: "Proteção das rodas contra pó de freio e sujeira." },

  // --- Película / insulfilm ---
  { codigo: "PEL-01", nome: "Insulfilm - carro completo", categoria: "PELICULA", preco: 550, duracaoMin: 180, garantiaDias: 365, comissaoPct: 15, descricao: "Película de controle solar dentro dos limites do CONTRAN, com garantia de 1 ano." },
  { codigo: "PEL-02", nome: "Película nano cerâmica - completo", categoria: "PELICULA", preco: 1400, duracaoMin: 240, garantiaDias: 1825, comissaoPct: 15, descricao: "Nano cerâmica de alta rejeição de calor e raios UV. Garantia de 5 anos." },
  { codigo: "PEL-03", nome: "Película de segurança", categoria: "PELICULA", preco: 980, duracaoMin: 210, garantiaDias: 730, comissaoPct: 15, descricao: "Película antivandalismo que mantém o vidro íntegro em caso de impacto." },
  { codigo: "PEL-04", nome: "Faixa de parabrisa", categoria: "PELICULA", preco: 180, duracaoMin: 45, garantiaDias: 365, comissaoPct: 15, descricao: "Faixa superior do parabrisa para reduzir o ofuscamento." },

  // --- Revitalização ---
  { codigo: "REV-01", nome: "Revitalização de faróis (par)", categoria: "REVITALIZACAO", preco: 260, duracaoMin: 120, garantiaDias: 180, comissaoPct: 15, descricao: "Remoção do amarelado e da opacidade com lixamento progressivo, polimento e proteção UV." },
  { codigo: "REV-02", nome: "Revitalização de lanternas", categoria: "REVITALIZACAO", preco: 180, duracaoMin: 90, garantiaDias: 180, comissaoPct: 15, descricao: "Recuperação da transparência e da cor das lanternas." },
  { codigo: "REV-03", nome: "Revitalização de plásticos externos", categoria: "REVITALIZACAO", preco: 220, duracaoMin: 120, garantiaDias: 90, comissaoPct: 12, descricao: "Devolve a cor original de para-choques, frisos e capas de retrovisor." },

  // --- Funilaria e pintura ---
  { codigo: "FUN-01", nome: "Reparo de amassado leve", categoria: "FUNILARIA", preco: 380, duracaoMin: 300, garantiaDias: 90, comissaoPct: 12, descricao: "Desamassamento sem repintura, quando a pintura está preservada." },
  { codigo: "FUN-02", nome: "Funilaria de peça", categoria: "FUNILARIA", preco: 650, duracaoMin: 480, garantiaDias: 180, comissaoPct: 12, descricao: "Recuperação da peça com massa, lixamento e preparação para pintura." },
  { codigo: "FUN-03", nome: "Troca de peça", categoria: "FUNILARIA", preco: 320, duracaoMin: 240, garantiaDias: 90, comissaoPct: 10, descricao: "Mão de obra de substituição. Peça cobrada à parte." },
  { codigo: "PIN-01", nome: "Pintura de peça", categoria: "PINTURA", preco: 720, duracaoMin: 480, garantiaDias: 365, comissaoPct: 12, descricao: "Pintura com tinta na cor original, verniz e polimento de acabamento." },
  { codigo: "PIN-02", nome: "Pintura de parachoque", categoria: "PINTURA", preco: 620, duracaoMin: 420, garantiaDias: 365, comissaoPct: 12, descricao: "Preparação, primer, pintura e verniz do para-choque." },
  { codigo: "PIN-03", nome: "Polimento pós-pintura", categoria: "PINTURA", preco: 280, duracaoMin: 180, garantiaDias: 90, comissaoPct: 12, descricao: "Nivelamento do verniz e brilho final após a pintura." },
] as const;

const CATEGORIAS_FINANCEIRAS = [
  { nome: "Servicos", tipo: "RECEITA" as const },
  { nome: "Venda de produtos", tipo: "RECEITA" as const },
  { nome: "Outras receitas", tipo: "RECEITA" as const },
  { nome: "Materiais e insumos", tipo: "DESPESA" as const },
  { nome: "Peças", tipo: "DESPESA" as const },
  { nome: "Folha de pagamento", tipo: "DESPESA" as const },
  { nome: "Aluguel", tipo: "DESPESA" as const },
  { nome: "Energia e água", tipo: "DESPESA" as const },
  { nome: "Marketing", tipo: "DESPESA" as const },
  { nome: "Impostos e taxas", tipo: "DESPESA" as const },
  { nome: "Manutenção e equipamentos", tipo: "DESPESA" as const },
  { nome: "Outras despesas", tipo: "DESPESA" as const },
];

async function main() {
  console.log("Populando o banco da World Car Service...\n");

  // --- Empresa ---
  const dadosEmpresa = {
    nome: "World Car Service",
    telefone: "(41) 98744-4929",
    whatsapp: "5541987444929",
    endereco: "Rua Renato Polatti, 2701 — Campo Comprido",
    cidade: "Curitiba",
    uf: "PR",
    cep: "81230-170",
    instagram: "@world.carservice",
    observacoesOrcamento:
      "A garantia dos serviços cobre defeitos de aplicação e não abrange danos por mau uso, acidentes ou lavagens abrasivas.",
  };
  await prisma.empresa.upsert({
    where: { id: "default" },
    create: { id: "default", ...dadosEmpresa },
    update: dadosEmpresa,
  });
  console.log("  empresa configurada");

  // --- Catálogo de serviços ---
  for (const s of SERVICOS) {
    const dados = {
      nome: s.nome,
      descricao: s.descricao,
      categoria: s.categoria,
      preco: dec(s.preco),
      duracaoMin: s.duracaoMin,
      garantiaDias: s.garantiaDias,
      comissaoPct: dec(s.comissaoPct),
    };
    await prisma.servico.upsert({
      where: { codigo: s.codigo },
      create: { codigo: s.codigo, ...dados },
      update: dados,
    });
  }
  console.log(`  ${SERVICOS.length} servicos no catalogo`);

  // --- Categorias financeiras ---
  for (const c of CATEGORIAS_FINANCEIRAS) {
    await prisma.categoriaFinanceira.upsert({
      where: { nome: c.nome },
      create: c,
      update: { tipo: c.tipo },
    });
  }
  console.log(`  ${CATEGORIAS_FINANCEIRAS.length} categorias financeiras`);

  // --- Usuário administrador + funcionário vinculado ---
  const senhaHash = await bcrypt.hash(SENHA_ADMIN, 10);
  const usuario = await prisma.usuario.upsert({
    where: { email: EMAIL_ADMIN },
    create: { email: EMAIL_ADMIN, senhaHash, papel: "ADMIN" },
    update: { papel: "ADMIN", ativo: true },
  });

  await prisma.funcionario.upsert({
    where: { matricula: "F001" },
    create: {
      matricula: "F001",
      nome: "Administrador",
      cargo: "Proprietário",
      setor: "ADMINISTRATIVO",
      admissao: new Date(),
      salario: dec(0),
      comissaoPct: dec(0),
      usuarioId: usuario.id,
    },
    update: { usuarioId: usuario.id, ativo: true },
  });
  console.log("  usuario administrador pronto");

  console.log("\nPronto. Acesse /login com:");
  console.log(`   e-mail: ${EMAIL_ADMIN}`);
  console.log(`   senha:  ${SENHA_ADMIN}`);
  console.log("\nTroque essa senha em Sistema > RH > acesso.\n");
}

main()
  .catch((e) => {
    console.error("Falha ao popular o banco:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
