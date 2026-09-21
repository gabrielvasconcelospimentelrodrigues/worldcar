/**
 * Gera um ano de operacao ficticia, para demonstrar o sistema com dados.
 *
 *   node supabase/mock.mjs            gera
 *   node supabase/mock.mjs --limpar   apaga so o que foi gerado
 *
 * Todo registro criado aqui tem id comecando por "mk-". E o que torna a limpeza
 * exata: nada de "apagar tudo da tabela", que levaria junto o cadastro real.
 *
 * Usa DIRECT_URL porque sao milhares de linhas — pelo PostgREST seriam milhares
 * de requisicoes. Roda como dono do banco, entao a RLS nao se aplica; e carga de
 * dados, nao uso do sistema.
 */
import path from "node:path";
import pg from "pg";

for (const f of [".env", ".env.local"]) {
  try { process.loadEnvFile(path.join(process.cwd(), f)); } catch { /* ausente */ }
}

const LIMPAR = process.argv.includes("--limpar");

/** Aleatorio com semente: duas execucoes geram exatamente o mesmo mundo. */
let semente = 20260917;
const rnd = () => {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
};
const inteiro = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];
const talvez = (p) => rnd() < p;

const HOJE = new Date("2026-09-17T12:00:00Z");
const INICIO = new Date(HOJE);
INICIO.setFullYear(INICIO.getFullYear() - 1);

const iso = (d) => new Date(d).toISOString();
const somaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const somaHoras = (d, n) => { const x = new Date(d); x.setHours(x.getHours() + n); return x; };
const dinheiro = (n) => Number(n).toFixed(2);

// ----------------------------------------------------------------- vocabulario
const NOMES = ["Ana Paula", "Bruno", "Carla", "Daniel", "Eduarda", "Fabio", "Gabriela",
  "Henrique", "Isabela", "Joao Pedro", "Karina", "Lucas", "Mariana", "Nelson", "Olivia",
  "Patricia", "Rafael", "Sabrina", "Thiago", "Vanessa", "Wagner", "Yuri", "Beatriz", "Caio",
  "Debora", "Everton", "Fernanda", "Gustavo", "Helena", "Igor", "Juliana", "Leandro",
  "Marcelo", "Natalia", "Otavio", "Priscila", "Renata", "Samuel", "Tatiane", "Vinicius"];
const SOBRENOMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves",
  "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes",
  "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Moreira", "Cardoso"];
const EMPRESAS = ["Transportes Iguacu", "Locadora Pinhao", "Construtora Araucaria",
  "Mercado Bom Preco", "Clinica Vida Nova", "Contabil Marques", "Distribuidora Parana",
  "Frota Rapida Log"];
const CARROS = [
  ["Volkswagen", "Gol", ["Branco", "Prata", "Preto", "Vermelho"]],
  ["Chevrolet", "Onix", ["Branco", "Prata", "Cinza", "Preto"]],
  ["Fiat", "Argo", ["Vermelho", "Branco", "Cinza"]],
  ["Fiat", "Strada", ["Branco", "Prata", "Vermelho"]],
  ["Hyundai", "HB20", ["Branco", "Prata", "Azul"]],
  ["Toyota", "Corolla", ["Prata", "Preto", "Branco"]],
  ["Toyota", "Etios", ["Branco", "Prata"]],
  ["Honda", "Civic", ["Preto", "Cinza", "Branco"]],
  ["Honda", "Fit", ["Prata", "Branco"]],
  ["Renault", "Kwid", ["Laranja", "Branco", "Prata"]],
  ["Jeep", "Compass", ["Cinza", "Preto", "Branco"]],
  ["Nissan", "Kicks", ["Branco", "Cinza"]],
  ["Ford", "Ka", ["Prata", "Branco", "Preto"]],
  ["Volkswagen", "Polo", ["Cinza", "Branco"]],
  ["Chevrolet", "Tracker", ["Preto", "Branco"]],
];
const BAIRROS = ["Centro", "Batel", "Agua Verde", "Portao", "Boqueirao", "Cajuru",
  "Santa Felicidade", "Bacacheri", "Xaxim", "Pinheirinho", "Uberaba", "Capao Raso"];
const CIDADES = [["Curitiba", "PR", "80000"], ["Sao Jose dos Pinhais", "PR", "83000"],
  ["Colombo", "PR", "83400"], ["Pinhais", "PR", "83320"], ["Araucaria", "PR", "83700"]];
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const placa = () => {
  const l = () => LETRAS[inteiro(0, 25)];
  return `${l()}${l()}${l()}${inteiro(0, 9)}${l()}${inteiro(0, 9)}${inteiro(0, 9)}`;
};
const cpf = () => `${inteiro(100, 999)}${inteiro(100, 999)}${inteiro(100, 999)}${inteiro(10, 99)}`;
const cnpj = () => `${inteiro(10, 99)}${inteiro(100, 999)}${inteiro(100, 999)}0001${inteiro(10, 99)}`;
const fone = () => `41${inteiro(90000, 99999)}${inteiro(1000, 9999)}`;

// -------------------------------------------------------------------- conexao
const cli = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
await cli.connect();

// Ordem inversa das dependencias: filho antes de pai, senao a FK barra.
const TABELAS = ["comissoes", "folha_itens", "folhas", "cotacao_precos", "cotacao_fornecedores", "cotacao_itens",
  "cotacoes", "alertas", "lancamentos", "ocorrencias_rh", "vistoria_fotos", "vistorias",
  "os_itens", "ordens_servico", "orcamento_itens", "orcamentos", "veiculos", "clientes",
  "fornecedores", "funcionarios"];

async function limpar() {
  // `folha_itens.funcionarioId` e `on delete restrict`: uma folha criada fora
  // daqui (um teste, um fechamento na tela) impediria o delete dos funcionarios
  // e o script quebraria adiante com chave duplicada. Sai por funcionario, nao
  // so por id da folha.
  await cli.query(`delete from public.folha_itens where "funcionarioId" like 'mk-%'`);
  await cli.query(
    `delete from public.folhas where id not in (select "folhaId" from public.folha_itens)`);

  for (const t of TABELAS) {
    try {
      const r = await cli.query(`delete from public.${t} where id like 'mk-%'`);
      if (r.rowCount) console.log(`  ${t.padEnd(22)} -${r.rowCount}`);
    } catch (e) {
      console.log(`  ${t}: ${e.message}`);
    }
  }
}

if (LIMPAR) {
  console.log("limpando dados de demonstracao...\n");
  await limpar();
  await cli.end();
  console.log("\npronto.");
  process.exit(0);
}

console.log("gerando um ano de operacao...\n");
await limpar();

/** Insere em lote: uma instrucao por tabela, nao uma por linha. */
async function inserir(tabela, colunas, linhas) {
  if (!linhas.length) return;
  const LOTE = 400;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE);
    const valores = [];
    const marcas = fatia.map((linha, j) => {
      const base = j * colunas.length;
      valores.push(...linha);
      return `(${colunas.map((_, k) => `$${base + k + 1}`).join(",")})`;
    });
    const cols = colunas.map((c) => `"${c}"`).join(",");
    await cli.query(
      `insert into public.${tabela} (${cols}) values ${marcas.join(",")}`, valores);
  }
  console.log(`  ${tabela.padEnd(22)} +${linhas.length}`);
}

// --------------------------------------------------------------- funcionarios
const EQUIPE = [
  ["Roberto Nunes Prado", "Gerente de operacoes", "ADMINISTRATIVO", 6800, 0],
  ["Aline Castro Ramos", "Atendente", "ADMINISTRATIVO", 2600, 2],
  ["Priscila Amaral Vieira", "Atendente", "ADMINISTRATIVO", 2600, 2],
  ["Marcos Vinicius Teles", "Funileiro chefe", "FUNILARIA", 4200, 12],
  ["Douglas Pereira Maia", "Funileiro", "FUNILARIA", 3100, 10],
  ["Sergio Batista Lemos", "Pintor", "PINTURA", 4000, 12],
  ["Cleber Antunes Rosa", "Pintor auxiliar", "PINTURA", 2500, 8],
  ["Jefferson Rocha Lima", "Lavador", "LAVAGEM", 2100, 8],
  ["Wesley Dias Campos", "Lavador", "LAVAGEM", 2100, 8],
  ["Tatiane Moraes Pinto", "Esteticista automotiva", "ESTETICA", 3000, 10],
  ["Rodrigo Sampaio Cruz", "Aplicador de peliculas", "PELICULA", 3200, 12],
  ["Everton Luiz Prado", "Mecanico", "MECANICA", 3800, 10],
];
const funcionarios = EQUIPE.map(([nome, cargo, setor, salario, com], i) => ({
  id: `mk-fu-${i + 1}`,
  matricula: `WC${String(i + 1).padStart(3, "0")}`,
  nome, cargo, setor, salario, comissaoPct: com,
  admissao: somaDias(INICIO, -inteiro(20, 900)),
}));

await inserir("funcionarios",
  ["id", "matricula", "nome", "cpf", "telefone", "email", "cargo", "setor", "admissao",
    "salario", "comissaoPct", "ativo", "criadoEm", "atualizadoEm"],
  funcionarios.map((f) => [f.id, f.matricula, f.nome, cpf(), fone(),
    `${f.nome.split(" ")[0].toLowerCase()}@worldcarservice.com.br`,
    f.cargo, f.setor, iso(f.admissao), dinheiro(f.salario), dinheiro(f.comissaoPct),
    true, iso(f.admissao), iso(HOJE)]));

const atendentes = funcionarios.filter((f) => f.setor === "ADMINISTRATIVO");
// De qual setor sai o tecnico de cada categoria do catalogo.
const SETOR_DA_CATEGORIA = {
  LAVAGEM: "LAVAGEM", ESTETICA: "ESTETICA", FUNILARIA: "FUNILARIA", PINTURA: "PINTURA",
  PELICULA: "PELICULA", REVITALIZACAO: "ESTETICA", VITRIFICACAO: "ESTETICA",
  MECANICA: "MECANICA", OUTROS: "LAVAGEM",
};
const tecnicoDe = (categoria) => {
  const setor = SETOR_DA_CATEGORIA[categoria] ?? "LAVAGEM";
  const lista = funcionarios.filter((f) => f.setor === setor);
  return escolher(lista.length ? lista : funcionarios);
};

// ------------------------------------------------------------------- clientes
/**
 * Quantidade de clientes.
 *
 * Eram 92 para 2.150 ordens, o que dava 23 visitas por cliente ao ano — e fazia
 * praticamente todo mundo chegar ao nivel mais alto da fidelidade. Uma casa com
 * esse movimento atende algumas centenas de pessoas, a maioria poucas vezes.
 */
const clientes = [];
for (let i = 0; i < 430; i++) {
  const juridica = i < EMPRESAS.length;
  const [cidade, uf, cepBase] = escolher(CIDADES);
  clientes.push({
    id: `mk-cl-${i + 1}`,
    tipo: juridica ? "JURIDICA" : "FISICA",
    nome: juridica ? EMPRESAS[i] : `${escolher(NOMES)} ${escolher(SOBRENOMES)}`,
    // Frota negocia desconto; pessoa fisica so as vezes.
    descontoPct: juridica ? escolher([5, 8, 10, 10, 12]) : (talvez(0.08) ? 5 : 0),
    telefone: fone(),
    cidade, uf, cep: `${cepBase}${inteiro(100, 999)}`, bairro: escolher(BAIRROS),
    criadoEm: somaDias(INICIO, inteiro(-400, 350)),
  });
}
await inserir("clientes",
  ["id", "tipo", "nome", "documento", "telefone", "email", "cep", "endereco", "numero",
    "bairro", "cidade", "uf", "descontoPct", "ativo", "criadoEm", "atualizadoEm"],
  clientes.map((c) => [c.id, c.tipo, c.nome, c.tipo === "JURIDICA" ? cnpj() : cpf(),
    c.telefone, `${c.nome.split(" ")[0].toLowerCase()}${inteiro(1, 99)}@email.com`,
    c.cep, `Rua ${escolher(SOBRENOMES)}`, String(inteiro(10, 3000)), c.bairro, c.cidade, c.uf,
    dinheiro(c.descontoPct), true, iso(c.criadoEm), iso(HOJE)]));

// ------------------------------------------------------------------- veiculos
const veiculos = [];
for (const c of clientes) {
  const quantos = c.tipo === "JURIDICA" ? inteiro(3, 7) : (talvez(0.22) ? 2 : 1);
  for (let k = 0; k < quantos; k++) {
    const [marca, modelo, cores] = escolher(CARROS);
    veiculos.push({
      id: `mk-ve-${veiculos.length + 1}`, clienteId: c.id, placa: placa(),
      marca, modelo, ano: inteiro(2012, 2025), cor: escolher(cores),
      km: inteiro(15000, 190000), criadoEm: c.criadoEm,
    });
  }
}
await inserir("veiculos",
  ["id", "placa", "marca", "modelo", "ano", "cor", "km", "clienteId", "criadoEm", "atualizadoEm"],
  veiculos.map((v) => [v.id, v.placa, v.marca, v.modelo, v.ano, v.cor, v.km, v.clienteId,
    iso(v.criadoEm), iso(HOJE)]));

/**
 * Sorteio ponderado.
 *
 * Escolher uniformemente fazia todo cliente aparecer a mesma quantidade de
 * vezes, o que nao existe: a frota volta toda semana, o cliente fiel volta no
 * mes, e a maioria aparece uma ou duas vezes no ano. Repetir o mesmo cliente na
 * urna e a forma mais simples de dar peso a ele.
 */
const urnaClientes = [];
for (const [i, c] of clientes.entries()) {
  const vezes = c.tipo === "JURIDICA" ? 34 : i < 70 ? 9 : 1;
  for (let k = 0; k < vezes; k++) urnaClientes.push(c);
}

const veiculosDe = new Map();
for (const v of veiculos) {
  if (!veiculosDe.has(v.clienteId)) veiculosDe.set(v.clienteId, []);
  veiculosDe.get(v.clienteId).push(v);
}

// ------------------------------------------------- numeracao dos documentos
/**
 * Os numeros de documento sao unicos e ja existem registros reais no banco.
 * A demonstracao comeca depois do maior numero em uso, senao a primeira OS
 * gerada colide com uma de verdade.
 */
async function proximoNumero(tabela) {
  const { rows } = await cli.query(
    `select coalesce(max(numero), 0)::int n from public.${tabela}`);
  return rows[0].n;
}
const BASE_ORC = await proximoNumero("orcamentos");
const BASE_OS = await proximoNumero("ordens_servico");
const BASE_COT = await proximoNumero("cotacoes");

// ----------------------------------------------------------------- categorias
const { rows: categorias } = await cli.query(
  `select id, nome, grupo from public.categorias_financeiras`);
const catPorNome = new Map(categorias.map((c) => [c.nome, c.id]));
const cat = (nome) => catPorNome.get(nome) ?? null;

// ------------------------------------------------------------------- catalogo
const { rows: servicos } = await cli.query(
  `select id, nome, categoria, preco, "garantiaDias", "comissaoPct" from public.servicos where ativo`);
if (!servicos.length) {
  console.error("Catalogo de servicos vazio — rode o seed antes.");
  process.exit(1);
}

// --------------------------------------------------------------- fornecedores
const FORNECEDORES = [
  ["Auto Pecas Bandeirantes", "PECAS", 3], ["Distribuidora Sul Pecas", "PECAS", 5],
  ["Casa das Tintas Parana", "TINTAS", 2], ["ColorCar Tintas", "TINTAS", 4],
  ["Insumos Brilho Total", "INSUMOS", 2], ["Quimica Automotiva JF", "INSUMOS", 6],
  ["Peliculas ShieldPro", "PELICULAS", 7], ["Ferramentas Mecanix", "FERRAMENTAS", 10],
];
const fornecedores = FORNECEDORES.map(([nome, tipo, prazo], i) => ({
  id: `mk-fo-${i + 1}`, nome, tipo, prazo,
}));
await inserir("fornecedores",
  ["id", "nome", "razaoSocial", "documento", "tipo", "contato", "telefone", "email",
    "cidade", "uf", "prazoEntregaDias", "condicoesPagamento", "ativo", "criadoEm", "atualizadoEm"],
  fornecedores.map((f) => [f.id, f.nome, `${f.nome} LTDA`, cnpj(), f.tipo,
    `${escolher(NOMES)} ${escolher(SOBRENOMES)}`, fone(),
    `contato@${f.nome.split(" ")[0].toLowerCase()}.com.br`, "Curitiba", "PR",
    f.prazo, escolher(["A vista", "28 dias", "30/60", "Boleto 30 dias"]),
    true, iso(INICIO), iso(HOJE)]));

// --------------------------------------------------- ordens, orcamentos, resto
const orcamentos = [], orcItens = [], ordens = [], osItens = [];
/** Recebimentos de OS: sao os unicos lancamentos com parcela. */
const recebimentos = [];
const vistorias = [], alertas = [], lancamentos = [], comissoes = [];

let nOrc = 0, nOs = 0;

/** Sorteia de 1 a 4 servicos do catalogo, sem repetir. */
function sortearServicos() {
  const quantos = talvez(0.45) ? 1 : talvez(0.7) ? 2 : talvez(0.8) ? 3 : 4;
  const escolhidos = [];
  while (escolhidos.length < quantos) {
    const s = escolher(servicos);
    if (!escolhidos.some((x) => x.id === s.id)) escolhidos.push(s);
  }
  return escolhidos;
}

/**
 * Meses do calendario entre o inicio e hoje.
 *
 * Tem de ser mes de calendario, e nao "de 17 em 17 dias": aluguel, folha e
 * imposto vencem em dia fixo do mes, e um laco deslocado deixava o mes corrente
 * inteiro sem despesa — o painel mostrava receita no mes e despesa zero.
 */
const MESES = [];
for (let d = new Date(INICIO.getFullYear(), INICIO.getMonth(), 1);
  d <= HOJE; d.setMonth(d.getMonth() + 1)) {
  MESES.push(new Date(d));
}

for (let mes = 0; mes < MESES.length; mes++) {
  const inicioMes = MESES[mes];
  const ultimoDia = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0).getDate();

  // A oficina cresce ao longo do ano; e o que faz o grafico do painel contar
  // uma historia em vez de uma linha reta.
  //
  // O volume precisa sustentar a folha: com 12 pessoas e ~R$54 mil de folha por
  // mes, meia duzia de carros por dia daria prejuizo. Uma casa que junta lava a
  // jato com funilaria atende algo como 6 a 9 carros por dia util.
  const base = 150 + Math.round(mes * 4.5);
  // Inverno chove mais e a lavagem cai; verao enche.
  const estacao = [1.0, 0.92, 0.88, 0.9, 1.05, 1.15, 1.2, 1.1, 1.0, 0.95, 0.9, 1.08][
    inicioMes.getMonth() % 12];
  const quantasOs = Math.max(12, Math.round(base * estacao));

  for (let k = 0; k < quantasOs; k++) {
    const entrada = new Date(inicioMes);
    entrada.setDate(inteiro(1, ultimoDia));
    entrada.setHours(inteiro(8, 17), escolher([0, 15, 30, 45]), 0, 0);
    if (entrada > HOJE || entrada < INICIO) continue;

    const cliente = escolher(urnaClientes);
    const frota = veiculosDe.get(cliente.id) ?? [];
    if (!frota.length) continue;
    const veiculo = escolher(frota);
    const atendente = escolher(atendentes);
    const escolhidos = sortearServicos();

    // ---- orcamento (a maioria das OS nasce de um)
    const temOrcamento = talvez(0.72);
    let orcamentoId = null;
    let subtotal = 0;
    const linhas = escolhidos.map((s, ordem) => {
      const qtd = s.categoria === "LAVAGEM" ? 1 : escolher([1, 1, 1, 2]);
      const preco = Number(s.preco) * (talvez(0.15) ? 1 + (rnd() * 0.2 - 0.1) : 1);
      const total = Math.round(qtd * preco * 100) / 100;
      subtotal += total;
      return { servico: s, qtd, preco: Math.round(preco * 100) / 100, total, ordem };
    });
    subtotal = Math.round(subtotal * 100) / 100;

    const pct = Number(cliente.descontoPct);
    const descontoTipo = pct > 0 ? "PERCENTUAL" : "VALOR";
    const desconto = pct > 0 ? pct : (talvez(0.12) ? inteiro(10, 80) : 0);
    const abatido = descontoTipo === "PERCENTUAL"
      ? Math.round(subtotal * desconto) / 100
      : desconto;
    const total = Math.max(0, Math.round((subtotal - abatido) * 100) / 100);

    if (temOrcamento) {
      orcamentoId = `mk-or-${++nOrc}`;
      const emitido = somaDias(entrada, -inteiro(1, 6));
      orcamentos.push([orcamentoId, BASE_ORC + nOrc, "CONVERTIDO", cliente.id, veiculo.id, atendente.id,
        7, iso(somaDias(emitido, 7)), veiculo.km, dinheiro(subtotal), descontoTipo,
        dinheiro(desconto), dinheiro(total), inteiro(1, 5),
        escolher(["PIX", "CREDITO", "DEBITO", "DINHEIRO"]),
        null, iso(emitido), iso(emitido), iso(HOJE)]);
      linhas.forEach((l) => orcItens.push([`mk-oi-${orcItens.length + 1}`, orcamentoId,
        l.servico.id, l.servico.nome, dinheiro(l.qtd), dinheiro(l.preco), "0.00",
        dinheiro(l.total), l.ordem]));
    }

    // ---- ordem de servico
    const osId = `mk-os-${++nOs}`;
    const duracao = escolher([4, 6, 8, 24, 48, 72]);
    const saida = somaHoras(entrada, duracao);
    const entregue = saida < HOJE;
    // O que ainda nao terminou fica em um estagio plausivel do fluxo.
    const status = entregue ? "ENTREGUE"
      : saida < somaHoras(HOJE, 8) ? "PRONTA"
        : talvez(0.5) ? "EM_ANDAMENTO" : "AGUARDANDO";
    const funcSaida = entregue ? escolher(atendentes).id : null;
    const kmSaida = veiculo.km + inteiro(0, 80);

    ordens.push([osId, BASE_OS + nOs, status, orcamentoId, cliente.id, veiculo.id, iso(entrada),
      atendente.id, veiculo.km, inteiro(1, 4) * 25,
      entregue ? iso(saida) : null, funcSaida, entregue ? kmSaida : null,
      entregue ? cliente.nome.split(" ")[0] : null, iso(saida),
      dinheiro(subtotal), descontoTipo, dinheiro(desconto), dinheiro(total),
      iso(entrada), iso(HOJE)]);

    const idsDosItens = [];
    linhas.forEach((l) => {
      const tec = tecnicoDe(l.servico.categoria);
      idsDosItens.push(`mk-it-${osItens.length + 1}`);
      const itemStatus = entregue ? "CONCLUIDO"
        : status === "PRONTA" ? "CONCLUIDO"
          : status === "EM_ANDAMENTO" ? (talvez(0.5) ? "CONCLUIDO" : "EXECUTANDO")
            : "PENDENTE";
      osItens.push([`mk-it-${osItens.length + 1}`, osId, l.servico.id, l.servico.nome,
        dinheiro(l.qtd), dinheiro(l.preco), "0.00", dinheiro(l.total), itemStatus, tec.id,
        iso(somaHoras(entrada, 1)),
        itemStatus === "CONCLUIDO" ? iso(somaHoras(entrada, duracao - 1)) : null,
        l.servico.garantiaDias ?? 0]);

      // Comissao so sobre o que foi entregue e pago.
      const pctCom = Number(tec.comissaoPct);
      if (entregue && pctCom > 0) {
        // Rateio do desconto do documento: a comissao incide sobre o que
        // realmente entrou, nao sobre o preco de tabela.
        const proporcao = subtotal > 0 ? total / subtotal : 1;
        const baseCom = Math.round(l.total * proporcao * 100) / 100;
        comissoes.push([`mk-co-${comissoes.length + 1}`, tec.id, osId, dinheiro(baseCom),
          dinheiro(pctCom), dinheiro(Math.round(baseCom * pctCom) / 100),
          saida < somaDias(HOJE, -35),
          saida < somaDias(HOJE, -35) ? iso(somaDias(saida, 30)) : null,
          `${saida.getFullYear()}-${String(saida.getMonth() + 1).padStart(2, "0")}`,
          iso(saida)]);
      }
    });

    // ---- vistorias de entrada e saida
    const avarias = talvez(0.45)
      ? [{ local: escolher(["Para-choque dianteiro", "Porta esquerda", "Capo", "Teto",
        "Lateral direita"]), descricao: escolher(["risco", "amassado leve", "pintura desbotada"]),
      gravidade: escolher(["Leve", "Moderada"]) }]
      : [];
    const checklist = { "Documentos": "OK", "Estepe": talvez(0.9) ? "OK" : "Ausente",
      "Macaco": "OK", "Triangulo": talvez(0.95) ? "OK" : "Ausente", "Radio": "OK" };

    vistorias.push([`mk-vi-${vistorias.length + 1}`, "ENTRADA", osId,
      tecnicoDe(escolhidos[0].categoria).id, iso(entrada), veiculo.km,
      escolher(["1/4", "1/2", "3/4", "Cheio"]),
      JSON.stringify(checklist), JSON.stringify(avarias), JSON.stringify([]),
      null, true, iso(entrada), null, null, null, null]);

    if (entregue) {
      vistorias.push([`mk-vi-${vistorias.length + 1}`, "SAIDA", osId,
        tecnicoDe(escolhidos[0].categoria).id, iso(saida), kmSaida,
        escolher(["1/4", "1/2", "3/4", "Cheio"]),
        JSON.stringify(checklist), JSON.stringify(avarias), JSON.stringify([]),
        null, true, iso(saida), null, null, null, null]);
    }

    // Conferencia de limpeza: so para servico de lavagem ou estetica, e por
    // item, porque a lavagem externa pode passar e a higienizacao interna nao.
    const LIMPEZA_CONFERE = ["LAVAGEM", "ESTETICA", "REVITALIZACAO", "VITRIFICACAO"];
    if (entregue) {
      linhas.forEach((l, idx) => {
        if (!LIMPEZA_CONFERE.includes(l.servico.categoria)) return;
        const itemId = idsDosItens[idx];
        const vistoriador = escolher(atendentes);
        const conferido = { "Vidros": "OK", "Tapetes": "OK", "Painel": "OK", "Rodas": "OK" };
        const reprovou = talvez(0.09);
        if (reprovou) {
          const motivo = escolher(["Vidros com marca de agua.", "Tapete ainda umido.",
            "Restou sujeira no console.", "Roda com sujeira nos raios."]);
          const reprovada = `mk-vi-${vistorias.length + 1}`;
          vistorias.push([reprovada, "LIMPEZA", osId, vistoriador.id,
            iso(somaHoras(saida, -2)), kmSaida, null,
            JSON.stringify({ ...conferido, "Vidros": "Refazer" }),
            JSON.stringify([]), JSON.stringify([]), null, false,
            iso(somaHoras(saida, -2)), itemId, "REPROVADA", motivo, null]);
          vistorias.push([`mk-vi-${vistorias.length + 1}`, "LIMPEZA", osId, vistoriador.id,
            iso(somaHoras(saida, -1)), kmSaida, null, JSON.stringify(conferido),
            JSON.stringify([]), JSON.stringify([]), null, true,
            iso(somaHoras(saida, -1)), itemId, "APROVADA", null, reprovada]);
        } else {
          vistorias.push([`mk-vi-${vistorias.length + 1}`, "LIMPEZA", osId, vistoriador.id,
            iso(somaHoras(saida, -1)), kmSaida, null, JSON.stringify(conferido),
            JSON.stringify([]), JSON.stringify([]), null, true,
            iso(somaHoras(saida, -1)), itemId, "APROVADA", null, null]);
        }
      });
    }

    // ---- recebimentos
    //
    // Tres formas de pagar, como na oficina de verdade: a maioria quita na
    // entrega, servico caro costuma ter sinal na entrada, e uma parte fica
    // parcelada. Gerar tudo como uma linha paga na entrega, como antes,
    // deixava a tela de pagamentos sem nada para mostrar.
    if (entregue) {
      const rotulo = `OS ${String(BASE_OS + nOs).padStart(4, "0")} — ${cliente.nome}`;
      const AVISTA = ["PIX", "DEBITO", "DINHEIRO", "PIX"];
      let aCobrar = total;

      // Sinal: so em servico caro, e pago na ENTRADA, nao na saida.
      const caro = total >= 800;
      if (caro && talvez(0.42)) {
        const sinal = Math.round(total * (0.4 + rnd() * 0.2) * 100) / 100;
        aCobrar = Math.round((total - sinal) * 100) / 100;
        recebimentos.push([`mk-rc-${recebimentos.length + 1}`, "RECEITA", "PAGO",
          `Sinal ${rotulo}`, dinheiro(sinal), iso(entrada), iso(entrada),
          escolher(AVISTA), osId, cat("Servicos"), null, null,
          iso(entrada), iso(HOJE)]);
      }

      if (aCobrar > 0.005) {
        const parcelado = talvez(0.26);
        const vezes = parcelado ? escolher([2, 2, 3, 3, 4, 6]) : 1;

        // Divisao sem perder centavo: a ultima parcela absorve a diferenca.
        const base = Math.floor((aCobrar * 100) / vezes) / 100;

        for (let i = 1; i <= vezes; i++) {
          const valorParcela = i === vezes
            ? Math.round((aCobrar - base * (vezes - 1)) * 100) / 100
            : base;
          const vence = somaDias(saida, (i - 1) * 30);

          // A primeira sai paga na entrega; as seguintes, quando vencem — e
          // quase todo mundo paga. So o que venceu ha pouco fica em aberto,
          // senao um ano de inadimplencia empilharia centenas de vencidas.
          let pago;
          if (i === 1) {
            pago = vezes > 1 ? true : !talvez(saida > somaDias(HOJE, -40) ? 0.18 : 0.006);
          } else if (vence > HOJE) {
            pago = false;
          } else {
            pago = talvez(vence < somaDias(HOJE, -40) ? 0.99 : 0.82);
          }

          recebimentos.push([`mk-rc-${recebimentos.length + 1}`, "RECEITA",
            pago ? "PAGO" : "PENDENTE", rotulo, dinheiro(valorParcela),
            iso(vence), pago ? iso(vence) : null,
            parcelado ? escolher(["CREDITO", "BOLETO"]) : escolher(AVISTA),
            osId, cat("Servicos"),
            vezes > 1 ? i : null, vezes > 1 ? vezes : null,
            iso(saida), iso(HOJE)]);
        }
      }
    }

    // ---- alertas de pos-venda e de garantia
    if (entregue && talvez(0.22)) {
      const quando = somaDias(saida, 7);
      // O sorteio acontece UMA vez. Sorteando a cada campo, o mesmo alerta saia
      // "CONCLUIDO" sem data de conclusao — um estado que o sistema nao produz.
      // Alerta antigo quase sempre foi tratado; so os recentes seguem pendentes.
      const concluido = quando < somaDias(HOJE, -4) ? talvez(0.97) : talvez(0.35);
      alertas.push([`mk-al-${alertas.length + 1}`, "POS_VENDA",
        concluido ? "CONCLUIDO" : "PENDENTE",
        `Pos-venda — ${cliente.nome}`,
        `Confirmar satisfacao com o servico do ${veiculo.marca} ${veiculo.modelo}.`,
        iso(quando), cliente.id, veiculo.id, osId,
        concluido ? iso(quando) : null,
        concluido ? escolher(["Cliente satisfeito.", "Sem reclamacoes.",
          "Elogiou o acabamento."]) : null, iso(saida)]);
    }
    const comGarantia = escolhidos.find((s) => (s.garantiaDias ?? 0) > 0);
    if (entregue && comGarantia && talvez(0.18)) {
      const quando = somaDias(saida, comGarantia.garantiaDias);
      alertas.push([`mk-al-${alertas.length + 1}`, "RETORNO_GARANTIA",
        quando < HOJE ? "CONCLUIDO" : "PENDENTE",
        `Fim de garantia — ${veiculo.marca} ${veiculo.modelo} ${veiculo.placa}`,
        `Garantia de ${comGarantia.nome} vence nesta data.`,
        iso(quando), cliente.id, veiculo.id, osId,
        quando < HOJE ? iso(quando) : null, null, iso(saida)]);
    }
  }
}

// Orcamentos que nao viraram OS: a realidade nao aprova tudo.
for (let i = 0; i < 120; i++) {
  const cliente = escolher(urnaClientes);
  const frota = veiculosDe.get(cliente.id) ?? [];
  if (!frota.length) continue;
  const veiculo = escolher(frota);
  // Um terco sai dos ultimos dez dias. Sem isso, todo orcamento nao convertido
  // ja teria vencido e a tela de orcamentos abriria vazia — a demonstracao
  // precisa mostrar proposta em aberto, que e o trabalho do atendente hoje.
  const emitido = i % 3 === 0
    ? somaDias(HOJE, -inteiro(0, 10))
    : somaDias(INICIO, inteiro(0, 350));
  if (emitido > HOJE) continue;
  const validoAte = somaDias(emitido, 7);
  const escolhidos = sortearServicos();
  let subtotal = 0;
  const linhas = escolhidos.map((s, ordem) => {
    const qtd = escolher([1, 1, 2]);
    const total = Math.round(qtd * Number(s.preco) * 100) / 100;
    subtotal += total;
    return { servico: s, qtd, preco: Number(s.preco), total, ordem };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  const status = validoAte < HOJE
    ? escolher(["EXPIRADO", "RECUSADO", "EXPIRADO", "RECUSADO", "APROVADO"])
    : escolher(["ENVIADO", "ENVIADO", "RASCUNHO"]);
  const id = `mk-or-${++nOrc}`;
  orcamentos.push([id, BASE_ORC + nOrc, status, cliente.id, veiculo.id, escolher(atendentes).id,
    7, iso(validoAte), veiculo.km, dinheiro(subtotal), "VALOR", "0.00", dinheiro(subtotal),
    inteiro(1, 5), escolher(["PIX", "CREDITO", "BOLETO"]),
    status === "RECUSADO"
      ? escolher(["Achou caro", "Fechou com concorrente", "Adiou o servico"]) : null,
    status === "APROVADO" ? iso(somaDias(emitido, 1)) : null,
    iso(emitido), iso(HOJE)]);
  linhas.forEach((l) => orcItens.push([`mk-oi-${orcItens.length + 1}`, id, l.servico.id,
    l.servico.nome, dinheiro(l.qtd), dinheiro(l.preco), "0.00", dinheiro(l.total), l.ordem]));
}

await inserir("orcamentos",
  ["id", "numero", "status", "clienteId", "veiculoId", "vendedorId", "validadeDias",
    "validoAte", "kmVeiculo", "subtotal", "descontoTipo", "desconto", "total",
    "prazoEntregaDias", "formaPagamento", "motivoRecusa", "aprovadoEm", "criadoEm",
    "atualizadoEm"], orcamentos);

await inserir("orcamento_itens",
  ["id", "orcamentoId", "servicoId", "descricao", "quantidade", "precoUnit", "desconto",
    "total", "ordem"], orcItens);

await inserir("ordens_servico",
  ["id", "numero", "status", "orcamentoId", "clienteId", "veiculoId", "dataEntrada",
    "funcionarioEntradaId", "kmEntrada", "combustivelEntrada", "dataSaida",
    "funcionarioSaidaId", "kmSaida", "clienteRetirou", "previsaoEntrega", "subtotal",
    "descontoTipo", "desconto", "total", "criadoEm", "atualizadoEm"], ordens);

await inserir("os_itens",
  ["id", "ordemId", "servicoId", "descricao", "quantidade", "precoUnit", "desconto", "total",
    "status", "responsavelId", "iniciadoEm", "concluidoEm", "garantiaDias"], osItens);

await inserir("vistorias",
  ["id", "tipo", "ordemId", "funcionarioId", "data", "km", "combustivel", "checklist",
    "avarias", "pertences", "assinaturaCliente", "aprovadaCliente", "criadoEm",
    "itemId", "resultadoLimpeza", "motivoReprovacao", "refeitaDe"], vistorias);

await inserir("comissoes",
  ["id", "funcionarioId", "ordemId", "baseCalculo", "percentual", "valor", "pago", "pagoEm",
    "referencia", "criadoEm"], comissoes);

// ------------------------------------------------------------------- despesas
const FIXAS = [
  ["Aluguel do galpao", 7800, 5, "Aluguel"],
  ["Energia eletrica", 1900, 12, "Energia e água"],
  ["Agua", 620, 12, "Energia e água"],
  ["Internet e telefonia", 380, 15, "Outras despesas"],
  ["Contabilidade", 950, 10, "Outras despesas"],
  ["Software e sistemas", 290, 8, "Outras despesas"],
  ["Seguro do imovel", 540, 20, "Outras despesas"],
  ["Marketing e anuncios", 1200, 15, "Marketing"],
  ["Manutencao de equipamentos", 890, 18, "Manutenção e equipamentos"],
];
const folhaMensal = funcionarios.reduce((s, f) => s + f.salario, 0);
// Os mesmos meses de calendario usados nas ordens. Um laco proprio de doze
// iteracoes a partir de INICIO deixava o mes corrente sem nenhuma despesa, e o
// painel exibia receita no mes contra despesa zero.
for (const m of MESES) {
  for (const [nome, valor, diaVenc, categoria] of FIXAS) {
    const venc = new Date(m.getFullYear(), m.getMonth(), diaVenc, 12);
    if (venc > HOJE) continue;
    const variacao = nome === "Energia eletrica" ? 1 + (rnd() * 0.3 - 0.1) : 1;
    lancamentos.push([`mk-la-${lancamentos.length + 1}`, "DESPESA", "PAGO", nome,
      dinheiro(valor * variacao), iso(venc), iso(venc), "TRANSFERENCIA", null,
      cat(categoria), iso(venc), iso(HOJE)]);
  }
  // A folha nao entra aqui: ela e montada adiante, pelas tabelas de folha de
  // pagamento, para a demonstracao mostrar o mesmo caminho que a oficina usa.
  // Peca, tinta e insumo acompanham o movimento: um mes cheio consome mais.
  for (let k = 0; k < inteiro(9, 15); k++) {
    const quando = new Date(m.getFullYear(), m.getMonth(), inteiro(1, 27), 12);
    if (quando > HOJE) continue;
    const f = escolher(fornecedores);
    lancamentos.push([`mk-la-${lancamentos.length + 1}`, "DESPESA",
      quando < somaDias(HOJE, -3) ? "PAGO" : "PENDENTE",
      `Compra — ${f.nome}`, dinheiro(inteiro(700, 7200)), iso(quando),
      quando < somaDias(HOJE, -3) ? iso(quando) : null, "BOLETO", null,
      cat(f.tipo === "PECAS" ? "Peças" : "Materiais e insumos"),
      iso(quando), iso(HOJE)]);
  }

  // Imposto do mes, calculado sobre o que de fato entrou naquele mes. Sem esta
  // linha o resultado ficaria bonito demais para ser verdade.
  // A receita agora vive em `recebimentos`, nao em `lancamentos`. Somar do
  // array errado dava imposto zero com o faturamento cheio — e o resultado do
  // ano aparecia R$ 200 mil mais bonito do que e.
  const receitaDoMes = recebimentos
    .filter((l) => l[2] === "PAGO" && l[6]
      && new Date(l[6]).getMonth() === m.getMonth()
      && new Date(l[6]).getFullYear() === m.getFullYear())
    .reduce((s, l) => s + Number(l[4]), 0);
  const vencImposto = new Date(m.getFullYear(), m.getMonth() + 1, 20, 12);
  if (receitaDoMes > 0 && vencImposto <= HOJE) {
    lancamentos.push([`mk-la-${lancamentos.length + 1}`, "DESPESA", "PAGO",
      `Simples Nacional — ${m.getMonth() + 1}/${m.getFullYear()}`,
      dinheiro(receitaDoMes * 0.095), iso(vencImposto), iso(vencImposto),
      "TRANSFERENCIA", null, cat("Impostos e taxas"), iso(vencImposto), iso(HOJE)]);
  }
}
await inserir("lancamentos",
  ["id", "tipo", "status", "descricao", "valor", "vencimento", "pagamento", "forma",
    "ordemId", "categoriaId", "criadoEm", "atualizadoEm"], lancamentos);
await inserir("lancamentos",
  ["id", "tipo", "status", "descricao", "valor", "vencimento", "pagamento", "forma",
    "ordemId", "categoriaId", "parcela", "totalParcelas", "criadoEm", "atualizadoEm"],
  recebimentos);

await inserir("alertas",
  ["id", "tipo", "status", "titulo", "descricao", "dataAlvo", "clienteId", "veiculoId",
    "ordemId", "concluidoEm", "resultado", "criadoEm"], alertas);

// ------------------------------------------------------------------------- RH
const ocorrencias = [];
for (const f of funcionarios) {
  // Ferias de quem ja tem um ano de casa.
  if (talvez(0.55)) {
    const ini = somaDias(INICIO, inteiro(10, 320));
    ocorrencias.push([`mk-rh-${ocorrencias.length + 1}`, f.id, "FERIAS", iso(ini),
      iso(somaDias(ini, 29)), "Ferias regulares.", iso(ini)]);
  }
  for (let k = 0; k < inteiro(0, 4); k++) {
    const tipo = escolher(["FALTA", "ATESTADO", "TREINAMENTO", "ELOGIO", "ADVERTENCIA"]);
    const ini = somaDias(INICIO, inteiro(0, 360));
    if (ini > HOJE) continue;
    const textos = {
      FALTA: "Falta nao justificada.",
      ATESTADO: "Atestado medico apresentado.",
      TREINAMENTO: escolher(["Treinamento de polimento tecnico.",
        "Curso de aplicacao de pelicula.", "Capacitacao em pintura automotiva."]),
      ELOGIO: "Elogio registrado por cliente.",
      ADVERTENCIA: "Advertencia por atraso reiterado.",
    };
    ocorrencias.push([`mk-rh-${ocorrencias.length + 1}`, f.id, tipo, iso(ini),
      tipo === "ATESTADO" ? iso(somaDias(ini, inteiro(1, 3))) : null, textos[tipo], iso(ini)]);
  }
}
await inserir("ocorrencias_rh",
  ["id", "funcionarioId", "tipo", "inicio", "fim", "descricao", "criadoEm"], ocorrencias);

// -------------------------------------------------------------------- compras
const PECAS = [
  ["Farol dianteiro direito", "un"], ["Para-choque dianteiro", "un"],
  ["Retrovisor eletrico esquerdo", "un"], ["Capo", "un"], ["Porta dianteira direita", "un"],
  ["Tinta base branca", "L"], ["Verniz alto solidos", "L"], ["Massa poliester", "kg"],
  ["Lixa 400", "un"], ["Cera de carnauba", "L"], ["Shampoo automotivo", "L"],
  ["Pelicula G5 rolo", "m"], ["Disco de corte", "un"], ["Pastilha de freio", "jogo"],
];
const cotacoes = [], cotItens = [], cotForn = [], cotPrecos = [];
const ordensEntregues = ordens.filter((o) => o[2] === "ENTREGUE");

for (let i = 0; i < 38; i++) {
  const aberta = somaDias(INICIO, inteiro(5, 360));
  if (aberta > HOJE) continue;
  const id = `mk-ct-${i + 1}`;
  const prazo = somaDias(aberta, inteiro(2, 5));
  const decidida = prazo < somaDias(HOJE, -3);
  const status = decidida ? "DECIDIDA" : (prazo < HOJE ? "RESPONDIDA" : "ABERTA");
  const ligadaAOs = talvez(0.4) && ordensEntregues.length
    ? escolher(ordensEntregues)[0] : null;

  cotacoes.push([id, BASE_COT + i + 1, status,
    escolher(["Pecas para funilaria", "Reposicao de tintas", "Insumos de estetica",
      "Peliculas para o mes", "Pecas de reposicao"]),
    ligadaAOs, escolher(atendentes).id, iso(prazo),
    decidida ? iso(somaDias(prazo, 1)) : null,
    decidida ? "Melhor preco com prazo aceitavel." : null, iso(aberta), iso(HOJE)]);

  const quantosItens = inteiro(2, 5);
  const itensDesta = [];
  for (let k = 0; k < quantosItens; k++) {
    const [desc, un] = escolher(PECAS);
    const itemId = `mk-ci-${cotItens.length + 1}`;
    itensDesta.push({ id: itemId, base: inteiro(45, 900) });
    cotItens.push([itemId, id, desc, dinheiro(inteiro(1, 4)), un, k]);
  }

  const quantosForn = inteiro(2, 4);
  const sorteados = [];
  while (sorteados.length < quantosForn) {
    const f = escolher(fornecedores);
    if (!sorteados.some((x) => x.id === f.id)) sorteados.push(f);
  }

  sorteados.forEach((f, idx) => {
    const cfId = `mk-cf-${cotForn.length + 1}`;
    // Nem todo fornecedor responde, e nem sempre a lista inteira — e o caso que
    // o comparativo precisa saber tratar.
    const respondeu = status !== "ABERTA" || talvez(0.5);
    cotForn.push([cfId, id, f.id, respondeu ? iso(somaDias(prazo, -1)) : null,
      respondeu ? f.prazo : null,
      respondeu ? escolher(["A vista", "28 dias", "30/60"]) : null,
      respondeu ? dinheiro(escolher([0, 0, 35, 60])) : "0.00", "0.00", null,
      decidida && idx === 0]);

    if (!respondeu) return;
    for (const item of itensDesta) {
      // Um fornecedor as vezes nao tem a peca — coluna vazia no comparativo.
      if (talvez(0.12)) continue;
      const fator = 0.85 + rnd() * 0.4;
      cotPrecos.push([`mk-cp-${cotPrecos.length + 1}`, item.id, cfId,
        dinheiro(Math.round(item.base * fator * 100) / 100), true,
        f.prazo + inteiro(0, 4), escolher(["Original", "Paralela", "Original", "Similar"]),
        null, decidida && idx === 0]);
    }
  });
}

await inserir("cotacoes",
  ["id", "numero", "status", "descricao", "ordemId", "solicitanteId", "prazoResposta",
    "decididaEm", "motivoDecisao", "criadoEm", "atualizadoEm"], cotacoes);
await inserir("cotacao_itens",
  ["id", "cotacaoId", "descricao", "quantidade", "unidade", "ordem"], cotItens);
await inserir("cotacao_fornecedores",
  ["id", "cotacaoId", "fornecedorId", "respondidoEm", "prazoEntregaDias",
    "condicoesPagamento", "frete", "desconto", "observacoes", "vencedor"], cotForn);
await inserir("cotacao_precos",
  ["id", "cotacaoItemId", "cotacaoFornecedorId", "precoUnit", "disponivel", "prazoDias",
    "marca", "observacao", "vencedor"], cotPrecos);

// ------------------------------------------------------- folha de pagamento
//
// Montada aqui em vez de chamada via `gerar_folha`: aquela funcao exige um
// usuario logado com papel de gestao, e este script roda como dono do banco,
// sem sessao. A conta e a mesma — salario + comissoes do mes, menos faltas,
// mais encargos — e as duas despesas geradas sao as mesmas que o fechamento
// cria na tela.
const { rows: [par] } = await cli.query(`select * from public.parametros_rh where id = 'default'`);
const PCT_ENCARGOS = Number(par.fgtsPct) + Number(par.provisao13Pct)
  + Number(par.provisaoFeriasPct) + Number(par.inssPatronalPct)
  + Number(par.outrosEncargosPct);

// Lista propria: a insercao de `lancamentos` ja aconteceu la em cima, entao
// empurrar para aquele array agora nao gravaria nada.
const folhas = [], folhaItens = [], lancFolha = [];
const catFolha = cat("Folha de pagamento");

for (const m of MESES) {
  const competencia = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
  const folhaId = `mk-fl-${competencia}`;
  // O mes corrente ainda esta correndo: fica ABERTA, como ficaria de verdade.
  const emAberto = m.getMonth() === HOJE.getMonth() && m.getFullYear() === HOJE.getFullYear();

  let proventos = 0, descontos = 0, liquido = 0, encargos = 0;
  for (const f of funcionarios) {
    if (f.admissao >= new Date(m.getFullYear(), m.getMonth() + 1, 1)) continue;
    const comissao = comissoes
      .filter((c) => c[1] === f.id && c[8] === competencia)
      .reduce((soma, c) => soma + Number(c[5]), 0);
    const faltas = ocorrencias.filter((o) =>
      o[1] === f.id && o[2] === "FALTA"
      && new Date(o[3]).getMonth() === m.getMonth()
      && new Date(o[3]).getFullYear() === m.getFullYear()).length;
    const descFaltas = Math.round((f.salario / 30) * faltas * 100) / 100;
    const liq = f.salario + comissao - descFaltas;
    const enc = Math.round(liq * PCT_ENCARGOS) / 100;

    proventos += f.salario + comissao;
    descontos += descFaltas;
    liquido += liq;
    encargos += enc;

    folhaItens.push([`mk-fi-${folhaItens.length + 1}`, folhaId, f.id,
      dinheiro(f.salario), dinheiro(comissao), "0.00", dinheiro(descFaltas), "0.00",
      dinheiro(liq), dinheiro(enc), dinheiro(liq + enc), faltas]);
  }

  const pagamento = new Date(m.getFullYear(), m.getMonth() + 1, Number(par.diaPagamento), 12);
  folhas.push([folhaId, competencia, emAberto ? "ABERTA" : "FECHADA",
    dinheiro(proventos), dinheiro(descontos), dinheiro(liquido), dinheiro(encargos),
    dinheiro(liquido + encargos), emAberto ? null : iso(pagamento),
    iso(m), iso(HOJE)]);

  if (emAberto || pagamento > HOJE) continue;

  for (const [rotulo, valor] of [["Salarios e comissoes", liquido],
    ["Encargos sobre a folha", encargos]]) {
    if (valor <= 0) continue;
    lancFolha.push([`mk-la-fl-${lancFolha.length + 1}`, "DESPESA", "PAGO",
      `${rotulo} — ${competencia}`, dinheiro(valor), iso(pagamento), iso(pagamento),
      "TRANSFERENCIA", null, catFolha, iso(pagamento), iso(HOJE)]);
  }
}

await inserir("lancamentos",
  ["id", "tipo", "status", "descricao", "valor", "vencimento", "pagamento", "forma",
    "ordemId", "categoriaId", "criadoEm", "atualizadoEm"], lancFolha);
await inserir("folhas",
  ["id", "competencia", "status", "totalProventos", "totalDescontos", "totalLiquido",
    "totalEncargos", "custoTotal", "fechadaEm", "criadoEm", "atualizadoEm"], folhas);
await inserir("folha_itens",
  ["id", "folhaId", "funcionarioId", "salarioBase", "comissoes", "adicionais",
    "descontoFaltas", "outrosDescontos", "liquido", "encargos", "custoTotal",
    "faltas"], folhaItens);

// Comissao de folha fechada esta paga; a do mes corrente ainda nao.
await cli.query(`
  update public.comissoes c set pago = true, "pagoEm" = f."fechadaEm", "folhaId" = f.id
  from public.folhas f
  where f.competencia = c.referencia and f.status = 'FECHADA' and c.id like 'mk-%'`);

// As sequencias precisam passar do maior numero gerado, senao o proximo
// documento criado na tela colide com um destes.
for (const [seq, tabela] of [["orcamentos_numero_seq", "orcamentos"],
  ["ordens_servico_numero_seq", "ordens_servico"], ["cotacoes_numero_seq", "cotacoes"]]) {
  try {
    await cli.query(
      `select setval('public.${seq}', coalesce((select max(numero) from public.${tabela}), 0) + 1, false)`);
  } catch (e) {
    console.log(`  sequencia ${seq}: ${e.message}`);
  }
}

const { rows: [resumo] } = await cli.query(`
  select (select count(*) from public.ordens_servico where id like 'mk-%') os,
         (select count(*) from public.orcamentos where id like 'mk-%') orc,
         (select coalesce(sum(valor),0) from public.lancamentos
            where id like 'mk-%' and tipo='RECEITA' and status='PAGO') receita,
         (select coalesce(sum(valor),0) from public.lancamentos
            where id like 'mk-%' and tipo='DESPESA' and status='PAGO') despesa`);

console.log(`\nperiodo: ${INICIO.toISOString().slice(0, 10)} a ${HOJE.toISOString().slice(0, 10)}`);
console.log(`ordens: ${resumo.os} | orcamentos: ${resumo.orc}`);
console.log(`receita recebida: R$ ${Number(resumo.receita).toLocaleString("pt-BR")}`);
console.log(`despesa paga:     R$ ${Number(resumo.despesa).toLocaleString("pt-BR")}`);
console.log(`resultado:        R$ ${(Number(resumo.receita) - Number(resumo.despesa)).toLocaleString("pt-BR")}`);

await cli.end();
