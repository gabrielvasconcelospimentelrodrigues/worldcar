/**
 * Ciclo completo da agenda: marca pelo site, confirma, cliente chega e vira OS.
 *
 * Roda pelo caminho real — chave anon sem login para a parte publica, e sessao
 * de atendente para a parte interna —, porque e a RLS que decide o que cada um
 * alcanca e testar por fora do PostgREST nao provaria nada disso.
 */
// As variaveis da SPA moram em web/.env.local; as do banco, na raiz. Este teste
// usa as duas: a chave anon para a parte publica e a sessao para a interna.
for (const f of [".env", ".env.local", "web/.env", "web/.env.local"]) {
  try { process.loadEnvFile(f); } catch { /* ausente */ }
}
const { createClient } = await import("@supabase/supabase-js");

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const novo = () => createClient(URL, ANON, { auth: { persistSession: false } });

const visitante = novo();
const interno = novo();
const { error: erroLogin } = await interno.auth.signInWithPassword({
  email: process.env.TESTE_EMAIL,
  password: process.env.TESTE_SENHA,
});
if (erroLogin) {
  console.error("Defina TESTE_EMAIL e TESTE_SENHA no .env.local:", erroLogin.message);
  process.exit(1);
}

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------- 1. visitante agenda
const { data: servs } = await visitante.rpc("servicos_agendaveis");
const servico = servs.find((s) => s.categoria === "LAVAGEM");

const amanha = new Date();
amanha.setDate(amanha.getDate() + 1);
const dia = amanha.toISOString().slice(0, 10);

const { data: disp } = await visitante.rpc("horarios_disponiveis", {
  p_servico_id: servico.id, p_data: dia,
});
const vaga = disp.horarios[0];

const { data: marcado, error: erroMarcar } = await visitante.rpc("agendar_publico", {
  p_servico_id: servico.id,
  p_inicio: vaga.inicio,
  p_nome: "Joana Ciclo Teste",
  p_telefone: "41977776666",
  p_placa: "CIC1A23",
  p_veiculo: "Fiat Argo 2021",
});
if (erroMarcar) { console.error("agendar:", erroMarcar.message); process.exit(1); }
console.log(`1. visitante marcou #${marcado.numero}: ${marcado.servico}`);
console.log(`   ${marcado.data} as ${marcado.hora} — status ${marcado.status}`);

// ---------------------------------------------- 2. alerta chegou para a loja
const { data: alertas } = await interno.from("alertas")
  .select("titulo").eq("status", "PENDENTE")
  .like("titulo", `Confirmar agendamento #${marcado.numero}%`);
console.log(`\n2. alerta para a loja: ${alertas?.length ? `"${alertas[0].titulo}"` : "NENHUM (erro)"}`);

// ------------------------------------------------------- 3. loja confirma
const { data: ag } = await interno.from("agendamentos")
  .select("id").eq("numero", marcado.numero).maybeSingle();

const { data: conf, error: erroConf } = await interno.rpc("confirmar_agendamento", {
  p_id: ag.id,
});
console.log(`\n3. confirmar: ${erroConf ? "ERRO " + erroConf.message : conf.status}`);

const { data: alertaDepois } = await interno.from("alertas")
  .select("status").like("titulo", `Confirmar agendamento #${marcado.numero}%`).maybeSingle();
console.log(`   alerta virou ${alertaDepois?.status} ${
  alertaDepois?.status === "CONCLUIDO" ? "(CORRETO: fechou sozinho)" : "(ERRADO)"}`);

// -------------------------------- 4. simula sinal pago antes da chegada
const { data: sv } = await interno.from("servicos").select("preco").eq("id", servico.id).maybeSingle();
const sinal = Math.round(Number(sv.preco) * 0.3 * 100) / 100;
console.log(`\n4. sinal de ${brl(sinal)} registrado como pago`);

// ---------------------------------------- 5. cliente chega e vira OS
const { data: eq } = await interno.from("equipe").select("id").eq("ativo", true).limit(1);
const { data: os, error: erroOs } = await interno.rpc("converter_agendamento", {
  p_id: ag.id,
  p_funcionario_entrada: eq[0].id,
  p_km_entrada: 45000,
});
if (erroOs) { console.error("converter:", erroOs.message); process.exit(1); }
console.log(`\n5. cliente chegou -> OS ${String(os.numero).padStart(4, "0")}`);
console.log(`   cliente ${os.clienteNovo ? "cadastrado agora" : "ja existia"}`);
console.log(`   veiculo ${os.veiculoNovo ? "cadastrado agora" : "ja existia"}`);

const { data: ordem } = await interno.from("ordens_servico")
  .select("status, total, clientes(nome), veiculos(placa, marca, modelo)")
  .eq("id", os.ordemId).maybeSingle();
console.log(`   ${ordem.clientes.nome} — ${ordem.veiculos.marca} ${ordem.veiculos.modelo} (${ordem.veiculos.placa})`);
console.log(`   OS ${ordem.status}, total ${brl(ordem.total)}`);

const { data: agFinal } = await interno.from("agendamentos")
  .select("status, ordemId").eq("id", ag.id).maybeSingle();
console.log(`   agendamento ficou ${agFinal.status} ${
  agFinal.status === "COMPARECEU" && agFinal.ordemId ? "(CORRETO)" : "(ERRADO)"}`);

// ------------------------------------------- 6. nao pode converter duas vezes
const { error: erroDupla } = await interno.rpc("converter_agendamento", {
  p_id: ag.id, p_funcionario_entrada: eq[0].id,
});
console.log(`\n6. converter de novo: ${erroDupla ? "BARROU — " + erroDupla.message.slice(0, 44) : "PASSOU (ERRADO!)"}`);

// ----------------------------------------------------------------- limpeza
await interno.from("os_itens").delete().eq("ordemId", os.ordemId);
await interno.from("lancamentos").delete().eq("ordemId", os.ordemId);
await interno.from("agendamentos").delete().eq("id", ag.id);
await interno.from("ordens_servico").delete().eq("id", os.ordemId);
await interno.from("alertas").delete().like("titulo", `%agendamento #${marcado.numero}%`);
await interno.from("veiculos").delete().eq("placa", "CIC1A23");
await interno.from("clientes").delete().eq("nome", "Joana Ciclo Teste");
console.log("\nlimpeza concluida");
