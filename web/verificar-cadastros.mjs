/**
 * Exercita todos os cadastros do sistema pela chave anon, logado como admin —
 * exatamente o caminho que o navegador percorre, RLS inclusa.
 * Cria, lê, atualiza e apaga cada um, e reporta o que falhar.
 *
 *   node verificar-cadastros.mjs
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {}
}

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

// Credenciais por ambiente, nunca no arquivo: este repositorio e publico e a
// URL do Supabase aparece no site publicado. Usuario e senha aqui dentro
// significariam acesso de administrador para qualquer um que clonasse.
const EMAIL = process.env.TESTE_EMAIL;
const SENHA = process.env.TESTE_SENHA;
if (!EMAIL || !SENHA) {
  console.error(
    "Defina TESTE_EMAIL e TESTE_SENHA no .env.local para rodar a verificacao.");
  process.exit(1);
}

const { error: erroLogin } = await sb.auth.signInWithPassword({
  email: EMAIL,
  password: SENHA,
});
if (erroLogin) {
  console.error("Falha no login:", erroLogin.message);
  process.exit(1);
}

const id = () => crypto.randomUUID();
const agora = () => new Date().toISOString();
const criados = [];
const resultados = [];

async function testar(nome, fn) {
  try {
    const detalhe = await fn();
    resultados.push({ nome, ok: true, detalhe });
  } catch (e) {
    resultados.push({ nome, ok: false, detalhe: e.message });
  }
}

/** Insere, relê e confere que um campo voltou igual. */
async function ciclo(tabela, registro, campoConferir) {
  const { error: eIns } = await sb.from(tabela).insert(registro);
  if (eIns) throw new Error(`inserir: ${eIns.message}`);
  criados.push([tabela, registro.id]);

  const { data, error: eSel } = await sb
    .from(tabela).select("*").eq("id", registro.id).maybeSingle();
  if (eSel) throw new Error(`ler: ${eSel.message}`);
  if (!data) throw new Error("inseriu mas não leu de volta");
  // O Postgres normaliza numeric na volta (45.50 vira 45.5), então valor
  // numérico se compara como número, não como texto.
  const voltou = data[campoConferir];
  const esperado = registro[campoConferir];
  const ambosNumericos = !Number.isNaN(Number(voltou)) && !Number.isNaN(Number(esperado));
  const igual = ambosNumericos
    ? Number(voltou) === Number(esperado)
    : String(voltou) === String(esperado);
  if (!igual) {
    throw new Error(`${campoConferir} voltou "${voltou}", esperado "${esperado}"`);
  }

  const { error: eUpd } = await sb.from(tabela).update({ [campoConferir]: data[campoConferir] })
    .eq("id", registro.id);
  if (eUpd) throw new Error(`atualizar: ${eUpd.message}`);

  return "criou, leu e atualizou";
}

// --- ids encadeados ---
const idCliente = id(), idVeiculo = id(), idServico = id(), idFunc = id();
const idOrc = id(), idOs = id(), idVist = id(), idForn = id(), idCot = id();

await testar("Cliente", () => ciclo("clientes", {
  id: idCliente, nome: "Teste Cadastros", telefone: "41999990000",
  cidade: "Curitiba", uf: "PR", atualizadoEm: agora(),
}, "nome"));

await testar("Veículo", () => ciclo("veiculos", {
  id: idVeiculo, clienteId: idCliente, placa: "TST9A99",
  marca: "Toyota", modelo: "Corolla", ano: 2022, atualizadoEm: agora(),
}, "placa"));

await testar("Serviço (catálogo)", () => ciclo("servicos", {
  id: idServico, codigo: "TST-99", nome: "Serviço de teste",
  categoria: "ESTETICA", preco: "100.00", garantiaDias: 30, comissaoPct: "10.00",
}, "codigo"));

await testar("Funcionário", () => ciclo("funcionarios", {
  id: idFunc, matricula: "TST99", nome: "Funcionário Teste", cargo: "Testador",
  setor: "ESTETICA", admissao: agora(), salario: "1000.00", comissaoPct: "5.00",
  atualizadoEm: agora(),
}, "matricula"));

await testar("Orçamento", () => ciclo("orcamentos", {
  id: idOrc, clienteId: idCliente, veiculoId: idVeiculo,
  validoAte: agora(), subtotal: "100.00", total: "100.00", atualizadoEm: agora(),
}, "clienteId"));

await testar("Item de orçamento", async () => {
  const idItem = id();
  return ciclo("orcamento_itens", {
    id: idItem, orcamentoId: idOrc, descricao: "Item de teste",
    quantidade: "1.00", precoUnit: "100.00", desconto: "0.00", total: "100.00", ordem: 0,
  }, "descricao");
});

await testar("Ordem de serviço", () => ciclo("ordens_servico", {
  id: idOs, clienteId: idCliente, veiculoId: idVeiculo,
  funcionarioEntradaId: idFunc, subtotal: "100.00", total: "100.00", atualizadoEm: agora(),
}, "clienteId"));

await testar("Item de OS", () => ciclo("os_itens", {
  id: id(), ordemId: idOs, descricao: "Serviço na OS",
  quantidade: "1.00", precoUnit: "100.00", desconto: "0.00", total: "100.00",
  garantiaDias: 30,
}, "descricao"));

await testar("Vistoria", () => ciclo("vistorias", {
  id: idVist, tipo: "ENTRADA", ordemId: idOs, funcionarioId: idFunc,
  checklist: { "Capô": "OK" }, avarias: [{ local: "Teto", descricao: "risco", gravidade: "Leve" }],
  aprovadaCliente: true, criadoEm: agora(),
}, "tipo"));

await testar("Alerta", () => ciclo("alertas", {
  id: id(), tipo: "POS_VENDA", titulo: "Alerta de teste",
  dataAlvo: agora(), clienteId: idCliente, criadoEm: agora(),
}, "titulo"));

await testar("Lançamento financeiro", () => ciclo("lancamentos", {
  id: id(), tipo: "DESPESA", descricao: "Despesa de teste",
  valor: "50.00", vencimento: agora(), atualizadoEm: agora(),
}, "descricao"));

await testar("Ocorrência de RH", () => ciclo("ocorrencias_rh", {
  id: id(), funcionarioId: idFunc, tipo: "TREINAMENTO",
  inicio: agora(), criadoEm: agora(),
}, "tipo"));

await testar("Fornecedor", () => ciclo("fornecedores", {
  id: idForn, nome: "Fornecedor Teste", tipo: "PECAS",
  telefone: "41988880000", atualizadoEm: agora(),
}, "nome"));

await testar("Cotação", () => ciclo("cotacoes", {
  id: idCot, descricao: "Cotação de teste", atualizadoEm: agora(),
}, "descricao"));

const idItemCot = id(), idCotForn = id();
await testar("Item de cotação", () => ciclo("cotacao_itens", {
  id: idItemCot, cotacaoId: idCot, descricao: "Peça cotada",
  quantidade: "2.00", unidade: "un", ordem: 0,
}, "descricao"));

await testar("Fornecedor na cotação", () => ciclo("cotacao_fornecedores", {
  id: idCotForn, cotacaoId: idCot, fornecedorId: idForn,
  frete: "0.00", desconto: "0.00",
}, "cotacaoId"));

await testar("Preço na matriz", () => ciclo("cotacao_precos", {
  id: id(), cotacaoItemId: idItemCot, cotacaoFornecedorId: idCotForn,
  precoUnit: "45.50", disponivel: true,
}, "precoUnit"));

await testar("Empresa (configurações)", async () => {
  const { data: antes } = await sb.from("empresa").select("*").eq("id", "default").maybeSingle();
  const { error } = await sb.from("empresa")
    .update({ atualizadoEm: agora() }).eq("id", "default");
  if (error) throw new Error(error.message);
  return antes ? `lida e atualizada (${antes.nome})` : "sem registro";
});

// --- funções de negócio ---
await testar("RPC resumo_painel", async () => {
  const { data, error } = await sb.rpc("resumo_painel");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("não devolveu dados");
  return `${Object.keys(data).length} indicadores`;
});

await testar("RPC sincronizar_pendencias", async () => {
  const { error } = await sb.rpc("sincronizar_pendencias");
  if (error) throw new Error(error.message);
  return "executou";
});

await testar("RPC recalcular_ordem", async () => {
  const { error } = await sb.rpc("recalcular_ordem", { p_ordem_id: idOs });
  if (error) throw new Error(error.message);
  const { data } = await sb.from("ordens_servico").select("subtotal").eq("id", idOs).maybeSingle();
  return `subtotal recalculado: ${data?.subtotal}`;
});

await testar("Trava: entregar com serviço pendente", async () => {
  const { error } = await sb.rpc("entregar_ordem", {
    p_ordem_id: idOs, p_funcionario_saida: idFunc, p_cliente_retirou: "Teste",
  });
  if (!error) throw new Error("DEIXOU entregar com serviço pendente!");
  if (!/servico\(s\) nao concluido/i.test(error.message)) {
    throw new Error(`barrou por outro motivo: ${error.message}`);
  }
  return "barrou corretamente";
});

await testar("Trava: entregar sem vistoria de saída", async () => {
  // Conclui o item para que a trava dos serviços saia do caminho e sobre
  // apenas a da vistoria — as duas são corretas, mas testadas separadamente.
  await sb.from("os_itens")
    .update({ status: "CONCLUIDO", concluidoEm: agora() }).eq("ordemId", idOs);

  const { error } = await sb.rpc("entregar_ordem", {
    p_ordem_id: idOs, p_funcionario_saida: idFunc, p_cliente_retirou: "Teste",
  });
  if (!error) throw new Error("DEIXOU entregar sem vistoria de saída!");
  if (!/vistoria de saida/i.test(error.message)) {
    throw new Error(`barrou por outro motivo: ${error.message}`);
  }
  return "barrou corretamente";
});

await testar("Storage de fotos", async () => {
  const { data, error } = await sb.storage.from("vistorias").list();
  if (error) throw new Error(error.message);
  return `bucket acessível (${data.length} pasta(s))`;
});

// --- relatório ---
console.log("\n=== CADASTROS ===\n");
let falhas = 0;
for (const r of resultados) {
  const marca = r.ok ? "OK    " : "FALHOU";
  if (!r.ok) falhas++;
  console.log(`  ${marca} ${r.nome.padEnd(38)} ${r.detalhe}`);
}

// --- limpeza, na ordem inversa das dependências ---
for (const [tabela, registro] of criados.reverse()) {
  await sb.from(tabela).delete().eq("id", registro);
}

console.log(`\n${resultados.length - falhas} de ${resultados.length} passaram.`);
console.log(falhas === 0 ? "Nenhuma falha." : `${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
